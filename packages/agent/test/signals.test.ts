import { describe, expect, it } from "vitest";
import { computeSignals } from "../src/signals.js";

function rising(n = 30, step = 0.02, start = 1): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(start * Math.pow(1 + step, i));
  return out;
}

function falling(n = 30, step = 0.02, start = 1): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(start * Math.pow(1 - step, i));
  return out;
}

function flat(n = 30): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(1 + Math.sin(i) * 0.0001);
  return out;
}

describe("computeSignals", () => {
  it("calls a steady climb bullish", () => {
    const engine = computeSignals(rising());
    expect(engine.grade).toBe("bullish");
    expect(engine.score).toBeGreaterThan(0.25);
    expect(engine.expectedBps).toBeGreaterThan(0);
  });

  it("calls a steady decline bearish", () => {
    const engine = computeSignals(falling());
    expect(engine.grade).toBe("bearish");
    expect(engine.score).toBeLessThan(-0.25);
    expect(engine.expectedBps).toBeLessThan(0);
  });

  it("calls a flat tape neutral", () => {
    const engine = computeSignals(flat());
    expect(engine.grade).toBe("neutral");
    expect(Math.abs(engine.score)).toBeLessThan(0.25);
  });

  it("is deterministic for identical input", () => {
    const a = computeSignals(rising());
    const b = computeSignals(rising());
    expect(a.score).toBeCloseTo(b.score, 10);
  });

  it("handles short histories", () => {
    const engine = computeSignals([1.0, 1.02, 1.04]);
    expect(Number.isFinite(engine.score)).toBe(true);
  });
});
