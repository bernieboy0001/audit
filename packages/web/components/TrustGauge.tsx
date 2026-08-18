"use client";

import { TrustState } from "@/lib/types";

function color(score: number): string {
  if (score >= 60) return "#37d399";
  if (score >= 40) return "#ffb454";
  return "#ff5d6c";
}

function GaugeArc({ value, color }: { value: number; color: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="#1c222d"
        strokeWidth="9"
      />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s ease" }}
      />
      <text
        x="60"
        y="60"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        style={{ fontFamily: "var(--mono)", fontSize: 26, fontWeight: 800 }}
      >
        {value}
      </text>
      <text
        x="60"
        y="82"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#8b94a7"
        style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: 1 }}
      >
        / 100
      </text>
    </svg>
  );
}

export default function TrustGauge({ trust }: { trust: TrustState }) {
  const score = trust.score;
  return (
    <div className="panel fade-in">
      <h3>Trust Score · engine-computed, model never writes it</h3>
      <div className="gaugewrap">
        <GaugeArc value={score} color={color(score)} />
        <div>
          <div className="small muted" style={{ marginBottom: 8 }}>
            earned from outcomes
          </div>
          <div className="statgrid" style={{ marginTop: 0 }}>
            <div className="stat">
              <div className="k">decisions</div>
              <div className="v">{trust.totalDecisions}</div>
            </div>
            <div className="stat">
              <div className="k">resolved</div>
              <div className="v">{trust.resolved}</div>
            </div>
            <div className="stat">
              <div className="k">hits</div>
              <div className="v green">{trust.hits}</div>
            </div>
            <div className="stat">
              <div className="k">misses</div>
              <div className="v red">{trust.misses}</div>
            </div>
            <div className="stat">
              <div className="k">vetoes</div>
              <div className="v">{trust.vetoes}</div>
            </div>
            <div className="stat">
              <div className="k">veto right</div>
              <div className="v">{trust.vetoCorrect}</div>
            </div>
          </div>
        </div>
      </div>
      {trust.history.length > 0 && (
        <>
          <hr className="rule" />
          <div className="small muted" style={{ marginBottom: 6 }}>
            last moves
          </div>
          <div className="vstack">
            {trust.history.slice(-5).reverse().map((h, i) => (
              <div key={i} className="row small">
                <span className={`mono ${h.delta >= 0 ? "green" : "red"}`} style={{ width: 40 }}>
                  {h.delta >= 0 ? "+" : ""}
                  {h.delta}
                </span>
                <span className="muted">{h.why}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}