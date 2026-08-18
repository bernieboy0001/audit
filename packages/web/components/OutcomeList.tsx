"use client";

import { fmtPrice } from "@/lib/format";
import type { OutcomeView } from "@/lib/types";

export default function OutcomeList({ outcomes }: { outcomes: OutcomeView[] }) {
  return (
    <div className="panel">
      <h3>Re-scored outcomes — did it work?</h3>
      {outcomes.length === 0 && <div className="small muted">waiting for the first verdict…</div>}
      <div className="scroll">
        {outcomes.slice().reverse().map((o, i) => {
          const ok = o.vetoCorrect !== undefined ? o.vetoCorrect : o.hit;
          return (
            <div key={`${o.decisionId}-${i}`} className="entry">
              <div className="row">
                <span className={`badge ${ok ? "approved" : "vetoed"}`}>
                  {ok ? "right" : "wrong"}
                </span>
                <span className="small muted mono">
                  c{o.cycle} · {o.realizedBps >= 0 ? "+" : ""}
                  {o.realizedBps.toFixed(0)} bps vs{" "}
                  {o.expectedBps >= 0 ? "+" : ""}
                  {o.expectedBps} exp
                </span>
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                {fmtPrice(o.entryPrice)} → {fmtPrice(o.exitPrice)}
                <span className="muted"> · </span>
                {o.note}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}