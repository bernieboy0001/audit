"use client";

import { fmtPrice } from "@/lib/format";
import type { OutcomeView } from "@/lib/types";

export default function OutcomeList({ outcomes }: { outcomes: OutcomeView[] }) {
  return (
    <div className="panel">
      <h3>Did it get it right?</h3>
      <p className="sub">
        Each decision is re-judged later against what the price actually did. The
        result feeds the report card above. Nothing here is the AI&apos;s opinion.
      </p>
      {outcomes.length === 0 && (
        <div className="small muted">waiting for the first verdict…</div>
      )}
      <div className="scroll">
        {outcomes.slice().reverse().map((o, i) => {
          const isVeto = o.vetoCorrect !== undefined;
          const ok = isVeto ? o.vetoCorrect : o.hit;
          const cls = isVeto ? (ok ? "outcome-save" : "outcome-miss") : ok ? "outcome-hit" : "outcome-miss";
          const verdictLabel = isVeto
            ? ok
              ? "the stop saved money"
              : "the stop was a mistake"
            : ok
            ? "the AI was right"
            : "the AI was wrong";
          return (
            <div key={`${o.decisionId}-${i}`} className={`entry ${cls}`}>
              <div className="row">
                <span className={`badge ${ok ? "approved" : "vetoed"}`}>
                  {ok ? "right" : "wrong"}
                </span>
                <span className="small muted">
                  {fmtPrice(o.entryPrice)} → {fmtPrice(o.exitPrice)}
                </span>
                <span className="small muted mono" style={{ marginLeft: "auto" }}>
                  {o.realizedBps >= 0 ? "+" : ""}
                  {o.realizedBps.toFixed(0)} bps move
                </span>
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                <b className={ok ? "green" : "red"}>{verdictLabel}</b>
                <span className="muted"> — {o.note}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}