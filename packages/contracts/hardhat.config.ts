import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    hardhat: { chainId: 31337 },
    baseSepolia: {
      // publicnode is more reliable than the official sepolia.base.org RPC.
      // No fixed gasPrice: ethers bumps its own re-broadcast fee on drop, and a
      // forced price below that bump causes "replacement transaction underpriced".
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://base-sepolia-rpc.publicnode.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  paths: { sources: "./contracts", tests: "./test" }
};

export default config;
