"use client";

import { fmtPrice, fmtWei } from "@/lib/format";
import type { AppState } from "@/lib/types";

export default function EnginePanel({ state }: { state: AppState }) {
  const e = state.engine;
  if (!e) {
    return (
      <div className="panel">
        <h3>Engine</h3>
        <div className="small muted">waiting for first reading…</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>Signal engine — deterministic, not the model</h3>
      <div className="row">
        <span className={`badge ${e.grade}`}>{e.grade}</span>
        <span className="mono small">
          score {e.score.toFixed(3)} · expected {e.expectedBps >= 0 ? "+" : ""}
          {e.expectedBps} bps
        </span>
      </div>
      <hr className="rule" />
      <div className="vstack">
        {e.signals.map((s) => {
          const pct = Math.max(0, Math.min(100, Math.abs(s.value) * 100));
          return (
            <div key={s.key} className="enginebar">
              <span className="small muted mono" style={{ width: 130 }}>
                {s.key.replace(/_/g, " ")}
              </span>
              <div className="track">
                <div
                  className="fill"
                  style={{
                    width: `${pct}%`,
                    background: s.value >= 0 ? "#37d399" : "#ff5d6c",
                    left: s.value >= 0 ? "50%" : `${50 - pct}%`,
                    position: "absolute"
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: "#2a3242"
                  }}
                />
              </div>
              <span className={`small mono ${s.value >= 0 ? "green" : "red"}`}>
                {s.value >= 0 ? "+" : ""}
                {s.value.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
      <hr className="rule" />
      <div className="grid2">
        <div>
          <div className="small muted">treasury</div>
          <div className="small mono">
            AUTH {fmtWei(state.treasury?.auth ?? "0")}
          </div>
          <div className="small mono">
            AUDS {fmtWei(state.treasury?.auds ?? "0")}
          </div>
        </div>
        <div>
          <div className="small muted">pool reserves</div>
          <div className="small mono">
            AUTH {fmtWei(state.reserves?.auth ?? "0")}
          </div>
          <div className="small mono">
            AUDS {fmtWei(state.reserves?.auds ?? "0")}
          </div>
        </div>
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>
        price {fmtPrice(e.price)} · {state.priceChangeBps !== null && state.priceChangeBps !== undefined
          ? `${state.priceChangeBps >= 0 ? "+" : ""}${state.priceChangeBps.toFixed(1)} bps/cycle`
          : ""}
      </div>
    </div>
  );
}