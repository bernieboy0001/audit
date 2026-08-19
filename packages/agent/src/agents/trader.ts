import { Config } from "../config.js";
import { llmJson } from "../llm.js";
import { sizeMultiplier } from "../learn.js";
import { EngineOutput, Side, TrackingState } from "../types.js";

const TRADER_SYSTEM = `You are the TRADER agent of AUDIT, an autonomous fund trading a demo AMM pool on Base testnet.
You propose ONE trade per cycle. You never invent numbers: every figure in your reasoning comes from the ENGINE JSON supplied to you.
Rules:
- "buy" means buy AUTH paying AUDS; "sell" means sell AUTH; "hold" means do nothing.
- A clear bullish engine grade MEANS buy, a clear bearish grade MEANS sell — that is your job, do not hesitate just because it feels risky. The risk auditor handles risk.
- TREND EXIT: if you recently bought and short momentum has flipped negative while medium momentum is still positive, the move is rolling over — propose "sell" to LOCK the gain or CUT the loss promptly. Same exit logic on the short side. Good exits are how you win; winners are only wins once they're taken.
- BUT the auditor caps AUTH exposure at 60% of treasury. If position.authShare is already near or above ~0.6, a buy will be blocked — so propose "sell" to take profit and rebalance instead, or hold.
- You may only "hold" on a neutral grade, or when treasury genuinely lacks the token needed.
- tracking.accuracy is your VERIFIED hit-rate over the last N graded decisions, computed only from the ledger. Treat it as your real skill level:
  - above ~0.6: you are in a hot streak — take the clear signals at good size.
  - below ~0.45: you are cold — shrink size, and only trade the strongest signals.
- sizePct is 5-20, the percent of treasury to deploy. Use a larger size when the engine is confident AND you are verified-hot.
- riskFlags: concrete concerns (high volatility, momentum exhaustion, thin liquidity).
- reason must cite actual engine signal values.
Respond ONLY with strict JSON, nothing else:
{"side":"buy"|"sell"|"hold","sizePct":number,"reason":"...","riskFlags":["..."],"toolsUsed":["engine","balances","ledger"]}`;

export interface ProposalInput {
  engine: EngineOutput;
  treasury: { auth: number; auds: number };
  tracking: TrackingState;
  position: { authShare: number };
  recentSides: Side[];
}

export interface Proposal {
  side: Side;
  sizePct: number;
  reason: string;
  riskFlags: string[];
  toolsUsed: string[];
  llm: boolean;
}

function clampSize(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(20, Math.round(x)));
}

function normalizeSide(v: unknown): Side | null {
  if (v === "buy" || v === "sell" || v === "hold") return v;
  return null;
}

export async function proposeTrade(
  config: Config,
  input: ProposalInput
): Promise<Proposal> {
  const user = JSON.stringify({
    engine: input.engine,
    treasury: input.treasury,
    tracking: input.tracking,
    position: input.position,
    recentSides: input.recentSides
  });
  const json = await llmJson(config.llm, TRADER_SYSTEM, user);
  if (json) {
    const side = normalizeSide(json.side);
    if (side) {
      return {
        side,
        sizePct: clampSize(Number(json.sizePct)),
        reason: String(json.reason ?? ""),
        riskFlags: Array.isArray(json.riskFlags)
          ? json.riskFlags.map(String)
          : [],
        toolsUsed: Array.isArray(json.toolsUsed)
          ? json.toolsUsed.map(String)
          : ["engine"],
        llm: true
      };
    }
  }

  // Deterministic fallback — the system works even with no LLM.
  // It adapts: verified-hot → press the edge; cold → shrink and stand down
  // unless the signal is unmistakable. This is engine-computed, never guessed.
  const g = input.engine.grade;
  const cold = input.tracking.samples >= 8 && input.tracking.accuracy <= 0.45;
  const scale = sizeMultiplier(input.tracking);
  let side: Side = "hold";
  let sizePct = 0;
  const strength = Math.abs(input.engine.score);

  // Trend exit: short momentum rolling over against a still-positive medium
  // trend is the signal to lock gains / cut losses — not to cling.
  const shortV = input.engine.signals.find((s) => s.key === "short_momentum")?.value ?? 0;
  const medV = input.engine.signals.find((s) => s.key === "medium_momentum")?.value ?? 0;
  const authorLong = input.position.authShare >= 0.35;

  if (medV > 0.06 && shortV < -0.12 && authorLong) {
    side = "sell";
    sizePct = clampSize((7 + Math.round(strength * 12)) * scale);
  } else if (g === "bullish" && !(cold && strength < 0.3)) {
    side = "buy";
    sizePct = clampSize((8 + Math.round(strength * 12)) * scale);
  } else if (g === "bearish" && !(cold && strength < 0.3)) {
    side = "sell";
    sizePct = clampSize((8 + Math.round(strength * 12)) * scale);
  }
  // Already concentrated? A buy would be exposure-blocked anyway. Turn it
  // into a rebalance sell (or stand down) instead of banging on a locked door.
  if (side === "buy" && input.position.authShare >= 0.6) {
    side = "hold";
    sizePct = 0;
  }
  return {
    side,
    sizePct,
    reason: `Deterministic fallback (no LLM): engine grade ${g}, score ${strength.toFixed(3)}, verified hit-rate ${(input.tracking.accuracy * 100).toFixed(0)}% over ${input.tracking.samples} graded calls`,
    riskFlags: [],
    toolsUsed: ["engine"],
    llm: false
  };
}
