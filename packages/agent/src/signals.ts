import { EngineOutput, Signal } from "./types.js";

const clamp = (x: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x));

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    out.push(prev > 0 ? Math.log(prices[i] / prev) : 0);
  }
  return out;
}

/**
 * Deterministic engine. Numbers come from here and nowhere else —
 * the LLM writes prose, never figures.
 */
export function computeSignals(prices: number[]): EngineOutput {
  const n = prices.length;
  const price = prices[n - 1];
  const prevPrice = n > 1 ? prices[n - 2] : price;

  const ret = (k: number) =>
    n > k && prices[n - 1 - k] !== 0 ? Math.log(price / prices[n - 1 - k]) : 0;

  const shortRet = ret(Math.min(5, Math.max(1, n - 1)));
  const mediumRet = ret(Math.min(20, Math.max(1, n - 1)));

  const window = prices.slice(-30);
  const vol = std(logReturns(window.length > 1 ? window : [price, price]));

  const signals: Signal[] = [];
  signals.push({
    key: "short_momentum",
    value: clamp(shortRet * 200),
    weight: 0.4,
    note: `log-return over last ${Math.min(5, Math.max(1, n - 1))} points`
  });
  signals.push({
    key: "medium_momentum",
    value: clamp(mediumRet * 200),
    weight: 0.35,
    note: `log-return over last ${Math.min(20, Math.max(1, n - 1))} points`
  });

  let ema = price;
  for (const p of prices.slice(-30)) ema = 0.05 * p + 0.95 * ema;
  const reversion = clamp(((ema - price) / price) * 50);
  signals.push({
    key: "mean_reversion",
    value: reversion,
    weight: 0.15,
    note: "distance from EMA30"
  });

  const volScore = clamp((vol - 0.02) * 20);
  signals.push({
    key: "volatility",
    value: -Math.abs(volScore),
    weight: 0.1,
    note: `30pt log-vol ${(vol * 100).toFixed(2)}%`
  });

  let score = signals.reduce((a, s) => a + s.value * s.weight, 0);

  // Anti-whipsaw, tuned to damp but not silence: only penalize when the two
  // timeframes actively pull apart (chopping), and never below half strength —
  // otherwise the engine holds forever and the demo looks dead.
  const diff = Math.abs(shortRet - mediumRet);
  if (Math.sign(shortRet) !== Math.sign(mediumRet) && diff > 0.012) {
    score *= Math.max(0.5, 1 - Math.min(1, diff * 6));
  }

  // Don't chase tops. When price is stretched far above its EMA30, buying
  // inherits a reversal; same for selling into a washed-out price. This is a
  // soft discount, so real trends still trade, but local tops stop being buys.
  const reversionV = signals.find((s) => s.key === "mean_reversion")?.value ?? 0;
  if (score > 0 && reversionV < -0.6) {
    score *= 1 - 0.35 * Math.min(1, (-reversionV - 0.6) * 1.25);
  } else if (score < 0 && reversionV > 0.6) {
    score *= 1 - 0.35 * Math.min(1, (reversionV - 0.6) * 1.25);
  }

  const direction = clamp(score);
  const expectedBps = Math.round(direction * 150);
  const grade =
    score > 0.2 ? "bullish" : score < -0.2 ? "bearish" : "neutral";

  // Confidence is an engine estimate (not a model opinion): base 0.5, raised
  // by signal strength and by short/medium momentum agreeing. It's published
  // on every decision and then graded against the actual outcome.
  const strength = Math.min(1, Math.abs(direction));
  const shortV = signals.find((s) => s.key === "short_momentum")?.value ?? 0;
  const medV = signals.find((s) => s.key === "medium_momentum")?.value ?? 0;
  const agreement = 1 - Math.min(1, Math.abs(shortV - medV));
  const confidence = Math.min(0.95, 0.5 + 0.28 * strength + 0.14 * agreement);

  return {
    signals,
    direction,
    expectedBps,
    score,
    grade,
    price,
    prevPrice,
    confidence
  };
}
