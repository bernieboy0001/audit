import { createServer } from "node:http";
import { Config } from "./config.js";
import { Chain } from "./chain.js";
import { Store } from "./store.js";
import { inspectAddress } from "./inspect.js";

function send(
  res: import("node:http").ServerResponse,
  code: number,
  body: unknown
): void {
  if (res.destroyed || res.writableEnded) return;
  try {
    res.writeHead(code, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end(JSON.stringify(body));
  } catch {
    /* client went away mid-response — nothing to do */
  }
}

export function startServer(config: Config, store: Store, chain: Chain): void {
  const server = createServer((req, res) => {
    if (req.method === "OPTIONS") return send(res, 204, {});
    const url = new URL(req.url ?? "/", `http://localhost:${config.port}`);

    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, {
        service: "AUDIT agent",
        status: "running",
        endpoints: ["/health", "/state", "/ledger", "/human-veto", "/run-cycle", "/inspect", "/reset"]
      });
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, {
        ok: true,
        cycle: store.cycle,
        llm: config.llm.enabled ? { enabled: true, model: config.llm.model } : { enabled: false }
      });
    }
    if (req.method === "GET" && url.pathname === "/state") {
      return send(res, 200, store.snapshot());
    }
    if (req.method === "GET" && url.pathname === "/ledger") {
      const n = Number(url.searchParams.get("n") ?? 50);
      return send(res, 200, store.ledger.tail(n));
    }
    if (req.method === "POST" && url.pathname === "/human-veto") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const { decisionId } = JSON.parse(body || "{}");
          const ok = store.humanVeto(decisionId);
          return send(res, ok ? 200 : 404, { ok, decisionId });
        } catch {
          return send(res, 400, { error: "bad json" });
        }
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/run-cycle") {
      store.forceRun = true;
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/reset") {
      store.reset();
      return send(res, 200, { ok: true, note: "live report card re-zeroed" });
    }
    if (req.method === "POST" && url.pathname === "/inspect") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        (async () => {
          try {
            const { target } = JSON.parse(body || "{}");
            if (!target || typeof target !== "string") {
              return send(res, 400, { error: "send a target address" });
            }
            const result = await inspectAddress(
              chain,
              target,
              {
                rpcUrls: config.inspectRpcUrls,
                chainLabel: config.inspectChainLabel
              }
            );
            store.recordInspection(result);
            return send(res, 200, result);
          } catch (e) {
            return send(res, 400, {
              error: `couldn't inspect that address: ${(e as Error).message}`
            });
          }
        })();
      });
      return;
    }
    return send(res, 404, { error: "not found" });
  });

  server.listen(config.port, () =>
    console.log(`[AUDIT] dashboard API on http://localhost:${config.port}`)
  );
}
