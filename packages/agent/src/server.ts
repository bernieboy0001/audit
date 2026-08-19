import { createServer } from "node:http";
import { Config } from "./config.js";
import { Store } from "./store.js";

function send(
  res: import("node:http").ServerResponse,
  code: number,
  body: unknown
): void {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(body));
}

export function startServer(config: Config, store: Store): void {
  const server = createServer((req, res) => {
    if (req.method === "OPTIONS") return send(res, 204, {});
    const url = new URL(req.url ?? "/", `http://localhost:${config.port}`);

    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, {
        service: "AUDIT agent",
        status: "running",
        endpoints: ["/health", "/state", "/ledger", "/human-veto", "/run-cycle"]
      });
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, cycle: store.cycle });
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
    return send(res, 404, { error: "not found" });
  });

  server.listen(config.port, () =>
    console.log(`[AUDIT] dashboard API on http://localhost:${config.port}`)
  );
}
