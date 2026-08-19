import { loadConfig } from "./config.js";
import { connectChain } from "./chain.js";
import { Store } from "./store.js";
import { startMarketMaker } from "./marketMaker.js";
import { startLoop } from "./loop.js";
import { startServer } from "./server.js";

function banner(config: ReturnType<typeof loadConfig>): void {
  console.log("----------------------------------------");
  console.log("  AUDIT — self-auditing autonomous fund");
  console.log("----------------------------------------");
  console.log("network :", config.deployed.network, "chainId", config.deployed.chainId);
  console.log("agent   :", config.deployed.agent);
  console.log("amm     :", config.deployed.amm);
  console.log("registry:", config.deployed.auditRegistry);
  console.log(
    "llm     :",
    config.llm.enabled ? config.llm.model : "DISABLED (deterministic fallback)"
  );
  console.log("mode    :", config.marketMakerEnabled ? "demo sandbox" : "live");
  console.log("cycle   :", `${config.cycleMs}ms`, "| veto window:", config.vetoWindowCycles, "cycles");
}

async function main(): Promise<void> {
  const config = loadConfig();
  banner(config);

  const chain = connectChain(config);
  const store = new Store(config);
  store.load();

  startMarketMaker(chain, config);
  startLoop(chain, config, store);
  startServer(config, store, chain);

  const shutdown = () => {
    console.log("\n[AUDIT] shutting down");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
