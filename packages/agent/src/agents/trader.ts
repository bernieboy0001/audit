import { Config } from "../config.js";
import { llmJson } from "../llm.js";
import { EngineOutput, Side } from "../types.js";

const TRADER_SYSTEM = `You are the TRADER agent of AUDIT, an autonomous fund trading a demo AMM pool on Base testnet.
You propose ONE trade per cycle. You never invent numbers: every figure in your reasoning comes from the ENGINE JSON supplied to you.
Rules:
- "buy" means buy AUTH paying AUDS; "sell" means sell AUTH; "hold" means do nothing.
- A clear bullish engine grade MEANS buy, a clear bearish grade MEANS sell — that is your job, do not hesitate just because it feels risky. The risk auditor handles risk.
- You may only "hold" on a neutral grade, or when treasury genuinely lacks the token needed.
- sizePct is 5-20, the percent of treasury to deploy. Use a larger size when the engine is confident.
- riskFlags: concrete concerns (high volatility, momentum exhaustion, thin liquidity).
- reason must cite actual engine signal values.
Respond ONLY with strict JSON, nothing else:
{"side":"buy"|"sell"|"hold","sizePct":number,"reason":"...","riskFlags":["..."],"toolsUsed":["engine","balances","ledger"]}`;

export interface ProposalInput {
  engine: EngineOutput;
  treasury: { auth: number; auds: number };
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
  const g = input.engine.grade;
  let side: Side = "hold";
  let sizePct = 0;
  if (g === "bullish") {
    side = "buy";
    sizePct = clampSize(8 + Math.round(Math.abs(input.engine.score) * 12));
  } else if (g === "bearish") {
    side = "sell";
    sizePct = clampSize(8 + Math.round(Math.abs(input.engine.score) * 12));
  }
  return {
    side,
    sizePct,
    reason: `Deterministic fallback (no LLM): engine grade ${g}, score ${input.engine.score.toFixed(3)}`,
    riskFlags: [],
    toolsUsed: ["engine"],
    llm: false
  };
}
