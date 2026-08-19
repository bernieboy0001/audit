import { LedgerEntry } from "./types.js";

export interface Tracking {
  /** Verified hit-rate over the last 20 graded decisions (engine-computed). */
  accuracy: number;
  /** Number of graded decisions in the window. */
  samples: number;
}

/**
 * The AI's memory: how often its graded calls have actually been right,
 * measured only from the append-only ledger. This is what sizes bets and
 * tightens the risk gate — the model can't fake it, because only the ledger
 * can feed it.
 */
export function rollingAccuracy(entries: LedgerEntry[]): Tracking {
  const graded: boolean[] = [];
  for (const e of entries) {
    if (e.kind !== "outcome") continue;
    const d = e.data as { side?: string; hit?: boolean; vetoCorrect?: boolean };
    if (d.side === "hold") continue;
    graded.push(d.vetoCorrect !== undefined ? d.vetoCorrect : d.hit === true);
  }
  const window = graded.slice(-20);
  if (!window.length) return { accuracy: 0.5, samples: 0 };
  const hits = window.filter(Boolean).length;
  return { accuracy: hits / window.length, samples: window.length };
}

/**
 * Publishes an honest probability: blend the strategy's conviction with the
 * AI's measured track record. A confident call from a cold streak is priced
 * lower; a modest call from a hot streak is priced higher. Then it gets graded
 * against reality, so the estimate itself can be audited.
 */
export function calibrateConfidence(base: number, t: Tracking): number {
  if (t.samples < 3) return base;
  const calibrated = 0.5 + (t.accuracy - 0.5) * 0.6 + (base - 0.5) * 0.4;
  return Math.max(0.3, Math.min(0.92, calibrated));
}

/** Bet-sizing factor: cool-off below 45% accuracy, press the edge above 55%. */
export function sizeMultiplier(t: Tracking): number {
  if (t.samples < 8) return 1;
  return Math.max(0.6, Math.min(1.4, 0.6 + t.accuracy * 0.8));
}

/** The gate tightens when the AI is on a cold streak, protecting capital. */
export function marginOfSafety(t: Tracking): number {
  if (t.samples < 8 || t.accuracy > 0.45) return 1;
  return 1.4;
}