import { describe, expect, it } from "vitest";
import {
  highConvictionGate,
  MissStreak,
  Proposal
} from "../src/agents/trader.js";
import { EngineOutput } from "../src/types.js";

const PASSING = {
  signals: [
    { key: "short_momentum", value: 0.8, weight: 0.4, note: "" },
    { key: "medium_momentum", value: 0.6, weight: 0.35, note: "" },
    { key: "mean_reversion", value: -0.2, weight: 0.15, note: "" },
    { key: "volatility", value: -0.1, weight: 0.1, note: "" }
  ],
  direction: 0.49,
  expectedBps: 74,
  score: 0.49,
  grade: "bullish" as const,
  price: 1.1,
  prevPrice: 1.09,
  confidence: 0.8
};

function engine(over: Partial<EngineOutput> = {}): EngineOutput {
  return { ...PASSING, ...over };
}

function overrides(
  patch: Record<string, number>
): { signals: EngineOutput["signals"] } {
  const signals = PASSING.signals.map((s) =>
    patch[s.key] !== undefined ? { ...s, value: patch[s.key] } : s
  );
  return { signals };
}

const buy: Proposal = {
  side: "buy",
  sizePct: 12,
  reason: "engine says up",
  riskFlags: [],
  toolsUsed: ["engine"],
  llm: false
};
const sell: Proposal = { ...buy, side: "sell" };
const hold: Proposal = { ...buy, side: "hold", sizePct: 0 };

const clean: MissStreak = { buy: 0, sell: 0 };

describe("highConvictionGate", () => {
  it("lets a clean, agreeing, strong signal trade", () => {
    const out = highConvictionGate(engine(), buy, clean);
    expect(out.side).toBe("buy");
    expect(out.sizePct).toBe(12);
    expect(out.reason).toContain("engine says up");
  });

  it("passes holds straight through", () => {
    const out = highConvictionGate(engine(), hold, clean);
    expect(out).toBe(hold);
  });

  it("downgrades to hold when momentum timeframes disagree", () => {
    const e = engine({
      ...overrides({ short_momentum: 0.7, medium_momentum: -0.5 })
    });
    const out = highConvictionGate(e, buy, clean);
    expect(out.side).toBe("hold");
    expect(out.reason).toContain("do not agree");
  });

  it("downgrades when the signal is under the 0.40 floor", () => {
    const e = engine({
      ...overrides({ short_momentum: 0.3, medium_momentum: 0.3 }),
      score: 0.19
    });
    const out = highConvictionGate(e, buy, clean);
    expect(out.side).toBe("hold");
    expect(out.reason).toContain("0.40 high-conviction floor");
  });

  it("refuses to buy a stretched top", () => {
    const e = engine({ ...overrides({ mean_reversion: -0.8 }) });
    const out = highConvictionGate(e, buy, clean);
    expect(out.side).toBe("hold");
    expect(out.reason).toContain("buying a top");
  });

  it("refuses to sell a washed-out bottom", () => {
    const e = engine({ ...overrides({ mean_reversion: 0.8 }) });
    const out = highConvictionGate(e, sell, clean);
    expect(out.side).toBe("hold");
    expect(out.reason).toContain("selling a bottom");
  });

  it("stands down during extreme volatility", () => {
    const e = engine({ ...overrides({ volatility: -0.5 }) });
    const out = highConvictionGate(e, buy, clean);
    expect(out.side).toBe("hold");
    expect(out.reason).toContain("volatility is extreme");
  });

  it("stands down when recent same-side calls were all misses", () => {
    const out = highConvictionGate(engine(), buy, { buy: 2, sell: 0 });
    expect(out.side).toBe("hold");
    expect(out.reason).toContain("the last 2 graded calls");
  });

  it("ignores the miss streak of the opposite side", () => {
    const out = highConvictionGate(engine(), buy, { buy: 0, sell: 3 });
    expect(out.side).toBe("buy");
  });
});