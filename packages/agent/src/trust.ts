import { LedgerEntry, TrustState } from "./types.js";

const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

/**
 * The Trust Score is computed by the engine, not the model.
 * Base 50. Every resolved outcome moves it. The score can be audited
 * because it is derived only from the append-only ledger.
 */
export function computeTrust(entries: LedgerEntry[]): TrustState {
  let score = 50;
  const history: TrustState["history"] = [];
  const proposalIds = new Set<string>();
  const resolvedIds = new Set<string>();

  let resolved = 0;
  let hits = 0;
  let misses = 0;
  let vetoes = 0;
  let vetoCorrect = 0;

  for (const e of entries) {
    const d = e.data;
    if (e.kind === "proposal") {
      proposalIds.add(String(d.id));
    } else if (e.kind === "review" && d.verdict === "vetoed") {
      vetoes++;
    } else if (e.kind === "outcome") {
      resolvedIds.add(String(d.decisionId));
      resolved++;
      if (d.side === "hold") {
        // Standing aside is not a graded call: the score measures what the
        // agent actually *did*, not the trades it declined to make.
        continue;
      }
      if (d.vetoCorrect === true) {
        vetoCorrect++;
        score += 4;
        history.push({ ts: e.ts, delta: 4, why: "auditor veto was right" });
      } else if (d.vetoCorrect === false) {
        score -= 5;
        history.push({ ts: e.ts, delta: -5, why: "auditor veto was unnecessary" });
      } else if (d.hit === true) {
        hits++;
        score += 6;
        history.push({ ts: e.ts, delta: 6, why: "decision hit" });
      } else {
        misses++;
        score -= 8;
        history.push({ ts: e.ts, delta: -8, why: "decision missed" });
      }
    } else if (e.kind === "human_veto") {
      resolvedIds.add(String(d.decisionId));
    } else if (e.kind === "risk_violation") {
      score -= 10;
      history.push({ ts: e.ts, delta: -10, why: "execution risk rule violated" });
    }
  }

  const pending = [...proposalIds].filter((id) => !resolvedIds.has(id)).length;

  return {
    score: clamp(score),
    totalDecisions: proposalIds.size,
    resolved,
    hits,
    misses,
    vetoes,
    vetoCorrect,
    pending,
    history: history.slice(-20)
  };
}
