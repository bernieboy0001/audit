import { Config } from "../config.js";
import { llmJson } from "../llm.js";
import { EngineOutput } from "../types.js";
import { Proposal } from "./trader.js";

const AUDITOR_SYSTEM = `You are the RISK AUDITOR of AUDIT, an autonomous fund. The TRADER agent has proposed a trade.
Hard rules — you MUST veto regardless of any other reasoning:
1. sizePct > 20 (position too large)
2. engine |score| < 0.25 on a non-hold (trading noise)
3. post-trade AUTH exposure would exceed 50% of treasury
Beyond hard rules, weigh soft risks: momentum exhaustion, elevated volatility, thin liquidity, chasing a spike.
Respond ONLY with strict JSON:
{"verdict":"approved"|"vetoed","reason":"...","checks":["..."]}`;

export interface ProposalInput {
  proposal: Proposal;
  engine: EngineOutput;
  treasury: { auth: number; auds: number };
}

export interface Review {
  verdict: "approved" | "vetoed";
  reason: string;
  checks: string[];
  hardViolations: string[];
}

function exposureAfter(proposal: Proposal, treasury: { auth: number; auds: number }, price: number): number {
  const total = treasury.auth * price + treasury.auds;
  if (total <= 0) return 0;
  let auth = treasury.auth;
  if (proposal.side === "buy") {
    const audsOut = treasury.auds * (proposal.sizePct / 100);
    auth += audsOut / price;
  } else if (proposal.side === "sell") {
    const authOut = treasury.auth * (proposal.sizePct / 100);
    auth -= authOut;
  }
  return (auth * price) / total;
}

export async function reviewProposal(
  config: Config,
  input: ProposalInput
): Promise<Review> {
  const hard: string[] = [];
  const { proposal, engine, treasury } = input;

  if (proposal.sizePct > config.maxSizePct) {
    hard.push(`size ${proposal.sizePct}% exceeds ${config.maxSizePct}% cap`);
  }
  if (proposal.side !== "hold" && Math.abs(engine.score) < config.minSignalAbs) {
    hard.push(`signal strength ${engine.score.toFixed(3)} below ${config.minSignalAbs} floor`);
  }
  const expo = exposureAfter(proposal, treasury, engine.price);
  // A sell always reduces exposure; only a buy can push it over the cap.
  if (proposal.side === "buy" && expo > 0.5) {
    hard.push(`post-trade AUTH exposure ${(expo * 100).toFixed(0)}% exceeds 50%`);
  }

  const json = await llmJson(config.llm, AUDITOR_SYSTEM, JSON.stringify(input));

  let verdict: "approved" | "vetoed";
  let reason: string;
  let llmReason = json?.reason ? String(json.reason) : "";

  if (hard.length > 0) {
    verdict = "vetoed";
    reason =
      "HARD RULE VIOLATION: " +
      hard.join("; ") +
      (llmReason ? ` | auditor adds: ${llmReason}` : "");
  } else if (json && (json.verdict === "vetoed" || json.verdict === "approved")) {
    verdict = json.verdict;
    reason = llmReason || (verdict === "approved" ? "approved" : "vetoed");
  } else {
    verdict = "approved";
    reason = "approved (deterministic gate: no hard rule violated)";
  }

  const checks = [
    ...hard,
    ...(Array.isArray(json?.checks) ? json.checks.map(String) : [])
  ];

  return { verdict, reason, checks, hardViolations: hard };
}
