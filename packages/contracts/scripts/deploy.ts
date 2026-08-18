import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { Wallet as EthersWallet } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { AuditRegistry, MintableERC20, MinimalAMM } from "../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Token = await ethers.getContractFactory("MintableERC20");
  const auth = (await Token.deploy("AUTH", "AUTH")) as unknown as MintableERC20;
  const auds = (await Token.deploy("AUDS", "AUDS")) as unknown as MintableERC20;
  await auth.waitForDeployment();
  await auds.waitForDeployment();

  const AMM = await ethers.getContractFactory("MinimalAMM");
  const amm = (await AMM.deploy(await auth.getAddress(), await auds.getAddress())) as unknown as MinimalAMM;
  await amm.waitForDeployment();

  const Audit = await ethers.getContractFactory("AuditRegistry");
  const audit = (await Audit.deploy()) as unknown as AuditRegistry;
  await audit.waitForDeployment();

  // Seed liquidity: 1,000,000 AUTH vs 100,000 AUDS  ->  price 0.1 AUDS per AUTH
  const rAuth = ethers.parseEther("1000000");
  const rAuds = ethers.parseEther("100000");
  await auth.mint(await amm.getAddress(), rAuth);
  await auds.mint(await amm.getAddress(), rAuds);
  await (await amm.initializeLiquidity(rAuth, rAuds)).wait();

  // Fund the agent treasury — mostly stable (AUDS), a little AUTH, so the
  // exposure guard has room to actually matter during the demo.
  const agentWallet = process.env.AGENT_PRIVATE_KEY
    ? new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, ethers.provider)
    : deployer;
  const agentAddress = await agentWallet.getAddress();
  await auth.mint(agentAddress, ethers.parseEther("2000"));
  await auds.mint(agentAddress, ethers.parseEther("100000"));

  // Fund the demo market maker so it can create price movement
  let marketMakerAddress = deployer.address;
  let marketMakerWallet: HardhatEthersSigner | EthersWallet = deployer;
  if (process.env.MARKET_MAKER_PRIVATE_KEY) {
    marketMakerWallet = new ethers.Wallet(process.env.MARKET_MAKER_PRIVATE_KEY, ethers.provider);
    marketMakerAddress = await marketMakerWallet.getAddress();
  }
  await auth.mint(marketMakerAddress, ethers.parseEther("200000"));
  await auds.mint(marketMakerAddress, ethers.parseEther("200000"));

  // Pre-approve the AMM for the agent and market maker wallets so no
  // approval transaction is ever needed inside the live loop.
  const max = ethers.MaxUint256;
  await (await auth.connect(agentWallet).approve(await amm.getAddress(), max)).wait();
  await (await auds.connect(agentWallet).approve(await amm.getAddress(), max)).wait();
  await (await auth.connect(marketMakerWallet).approve(await amm.getAddress(), max)).wait();
  await (await auds.connect(marketMakerWallet).approve(await amm.getAddress(), max)).wait();

  // Genesis audit entry
  const genesisHash = ethers.keccak256(ethers.toUtf8Bytes("AUDIT genesis: treasury initialized"));
  await (await audit.commit(genesisHash, "AUDIT genesis: treasury initialized")).wait();

  const out = {
    network: process.env.HARDHAT_NETWORK || "hardhat",
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    agent: agentAddress,
    marketMaker: marketMakerAddress,
    tokens: { auth: await auth.getAddress(), auds: await auds.getAddress() },
    amm: await amm.getAddress(),
    auditRegistry: await audit.getAddress(),
    initialLiquidity: { auth: rAuth.toString(), auds: rAuds.toString() },
    genesisHash
  };

  const dataDir = path.join(__dirname, "../../../.data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "deployed.json"), JSON.stringify(out, null, 2));
  console.log("Deployed:", JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
