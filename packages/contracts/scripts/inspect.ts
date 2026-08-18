import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deployedPath = path.join(__dirname, "../../../.data/deployed.json");
  if (!fs.existsSync(deployedPath)) {
    console.log("no deployed.json");
    return;
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const registry = await ethers.getContractAt(
    "AuditRegistry",
    deployed.auditRegistry
  );
  const count = await registry.entryCount();
  console.log("registry entries:", count.toString());
  const [ts, hash, submitter, ref] = await registry.latest();
  console.log("latest entry:", { ts: ts.toString(), hash, submitter, ref });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
