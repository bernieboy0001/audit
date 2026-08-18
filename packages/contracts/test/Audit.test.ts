import { expect } from "chai";
import { ethers } from "hardhat";
import { MinimalAMM, MintableERC20, AuditRegistry } from "../typechain-types";

describe("MinimalAMM", function () {
  let amm: MinimalAMM;
  let auth: MintableERC20;
  let auds: MintableERC20;
  let deployer: any;
  let trader: any;

  const RESERVE_AUTH = ethers.parseEther("1000000");
  const RESERVE_AUDS = ethers.parseEther("100000");

  beforeEach(async function () {
    [deployer, trader] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MintableERC20");
    auth = (await Token.deploy("AUTH", "AUTH")) as unknown as MintableERC20;
    auds = (await Token.deploy("AUDS", "AUDS")) as unknown as MintableERC20;
    const AMM = await ethers.getContractFactory("MinimalAMM");
    amm = (await AMM.deploy(await auth.getAddress(), await auds.getAddress())) as unknown as MinimalAMM;

    await auth.mint(await amm.getAddress(), RESERVE_AUTH);
    await auds.mint(await amm.getAddress(), RESERVE_AUDS);
    await amm.initializeLiquidity(RESERVE_AUTH, RESERVE_AUDS);
  });

  it("seeds liquidity at 0.1 AUDS per AUTH", async function () {
    const [r0, r1] = await amm.getReserves();
    expect(r0).to.equal(RESERVE_AUTH);
    expect(r1).to.equal(RESERVE_AUDS);
    const price = await amm.getPrice();
    expect(price).to.equal(ethers.parseEther("10")); // 1e18 * r0 / r1 = 10
  });

  it("applies the 0.3% fee on swap", async function () {
    await auth.mint(trader.address, ethers.parseEther("1000"));
    await auth.connect(trader).approve(await amm.getAddress(), ethers.parseEther("1000"));
    const amountIn = ethers.parseEther("100");

    await expect(
      amm.connect(trader).swap(await auth.getAddress(), amountIn, 0)
    ).to.emit(amm, "Swap");

    const [r0, r1] = await amm.getReserves();
    // bought AUDS, so reserve0 up, reserve1 down
    expect(r0).to.be.greaterThan(RESERVE_AUTH);
    expect(r1).to.be.lessThan(RESERVE_AUDS);
  });

  it("reverts on slippage exceeded", async function () {
    await auth.mint(trader.address, ethers.parseEther("1000"));
    await auth.connect(trader).approve(await amm.getAddress(), ethers.parseEther("1000"));
    const amountIn = ethers.parseEther("100");
    const exactOut = await amm.getAmountOut(amountIn, RESERVE_AUTH, RESERVE_AUDS);
    await expect(
      amm.connect(trader).swap(await auth.getAddress(), amountIn, exactOut + 1n)
    ).to.be.revertedWith("slippage");
  });

  it("blocks non-deployer from initializing liquidity", async function () {
    const AMM = await ethers.getContractFactory("MinimalAMM");
    const amm2 = (await AMM.deploy(await auth.getAddress(), await auds.getAddress())) as unknown as MinimalAMM;
    await expect(
      amm2.connect(trader).initializeLiquidity(1, 1)
    ).to.be.revertedWith("only deployer");
  });
});

describe("AuditRegistry", function () {
  it("commits, reads back and rejects duplicates", async function () {
    const [deployer] = await ethers.getSigners();
    const Audit = await ethers.getContractFactory("AuditRegistry");
    const audit = (await Audit.deploy()) as unknown as AuditRegistry;

    const h = ethers.keccak256(ethers.toUtf8Bytes("decision-1"));
    await expect(audit.commit(h, "decision-1")).to.emit(audit, "Committed");
    await expect(audit.commit(h, "decision-1")).to.be.revertedWith("duplicate");

    expect(await audit.entryCount()).to.equal(1);
    const [ts, hash, submitter, ref] = await audit.getEntry(0);
    expect(hash).to.equal(h);
    expect(submitter).to.equal(deployer.address);
    expect(ref).to.equal("decision-1");
    expect(ts).to.be.greaterThan(0n);
  });

  it("rejects empty hashes", async function () {
    const Audit = await ethers.getContractFactory("AuditRegistry");
    const audit = (await Audit.deploy()) as unknown as AuditRegistry;
    await expect(audit.commit(ethers.ZeroHash, "")).to.be.revertedWith("empty hash");
  });
});
