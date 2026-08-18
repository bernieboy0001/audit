import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { canonical, hashEntry, Ledger } from "../src/ledger.js";

describe("ledger hashing", () => {
  it("produces identical hashes for identical input", () => {
    const a = canonical({ b: 1, a: { d: 2, c: 3 } });
    const b = canonical({ a: { c: 3, d: 2 }, b: 1 });
    expect(a).toBe(b);
  });

  it("hashes depend on content", () => {
    const h1 = hashEntry({ side: "buy" }, "proposal", 1000, 1);
    const h2 = hashEntry({ side: "sell" }, "proposal", 1000, 1);
    expect(h1).not.toBe(h2);
  });
});

describe("Ledger", () => {
  it("appends, reads and tails", () => {
    const file = path.join(os.tmpdir(), `ledger-test-${Date.now()}.jsonl`);
    const ledger = new Ledger(file);
    ledger.append("proposal", { id: "1" }, { cycle: 1 });
    ledger.append("proposal", { id: "2" }, { cycle: 2 });

    const all = ledger.readAll();
    expect(all.length).toBe(2);
    expect(ledger.tail(1)[0].data.id).toBe("2");
    expect(ledger.decision("1")?.data.id).toBe("1");
    expect(ledger.decision("nope")).toBeUndefined();

    fs.rmSync(file, { force: true });
  });
});
