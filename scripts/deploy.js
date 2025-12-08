require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const factory = await hre.ethers.getContractFactory("PrivacyRedPacket");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`PrivacyRedPacket deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

