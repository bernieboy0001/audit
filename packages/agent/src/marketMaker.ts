import { Config } from "./config.js";
import { Chain, doSwap, getReserves } from "./chain.js";

/**
 * Demo market maker. In the sandbox there is no external trader, so this bot
 * creates honest price movement the agent reacts to. It alternates between
 * choppy noise and short trends so the agent's signals actually fire.
 * Turn it off (`MARKET_MAKER=off`) to run against a real market.
 */

let trendDir = 0;
let trendRemaining = 0;
let running = false;

export async function marketMakerTick(
  chain: Chain,
  config: Config
): Promise<void> {
  if (running) return;
  running = true;
  try {
    const [r0, r1] = await getReserves(chain);
    let frac: number;
    let dir: number;

    if (trendRemaining > 0) {
      dir = trendDir;
      frac = 0.01 + Math.random() * 0.025;
      trendRemaining--;
} else {
      dir = Math.random() > 0.5 ? 1 : -1;
      const roll = Math.random();
      if (roll < 0.3) {
        trendDir = dir;
        trendRemaining = 4 + Math.floor(Math.random() * 5);
        frac = 0.012 + Math.random() * 0.02;
      } else if (roll < 0.62) {
        frac = 0.006 + Math.random() * 0.012;
      } else {
        frac = 0.002 + Math.random() * 0.005;
      }
    }

    // dir > 0 buys AUTH (pays AUDS) so the AUTH price rises.
    const tokenIn: "auth" | "auds" = dir > 0 ? "auds" : "auth";
    const sideReserve = dir > 0 ? r1 : r0;
    const amountIn = (sideReserve * BigInt(Math.round(frac * 10_000))) / 10_000n;
    if (amountIn <= 0n) return;

    await doSwap(chain, tokenIn, amountIn, 0n, chain.mm);
  } finally {
    running = false;
  }
}

export function startMarketMaker(
  chain: Chain,
  config: Config
): NodeJS.Timeout {
  if (!config.marketMakerEnabled) {
    console.log("[AUDIT] market maker disabled");
    return null as unknown as NodeJS.Timeout;
  }
  const ms = Math.max(1500, Math.round(config.cycleMs / 3));
  console.log(`[AUDIT] market maker started (every ${ms}ms)`);
  return setInterval(() => {
    marketMakerTick(chain, config).catch((e) =>
      console.warn("[mm] tick failed:", (e as Error).message)
    );
  }, ms);
}
