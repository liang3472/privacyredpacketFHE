import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const ONE_HOUR = 60 * 60;

describe("PrivacyRedPacket", () => {
  async function deployContract() {
    const factory = await ethers.getContractFactory("PrivacyRedPacket");
    const contract = await factory.deploy();
    return contract;
  }

  it("creates an average packet and allows claiming with correct password", async () => {
    const [creator, claimer] = await ethers.getSigners();
    const contract = await deployContract();

    const password = "secret123";
    const passwordHash = ethers.keccak256(ethers.toUtf8Bytes(password));
    const total = ethers.parseEther("1");
    const shares = 5;

    await contract
      .connect(creator)
      .createRedPacket(1, ethers.ZeroAddress, total, shares, ONE_HOUR, passwordHash, { value: total });

    const packetId = (await contract.nextPacketId()) - 1n;
    const expectedShare = total / BigInt(shares);

    await expect(contract.connect(claimer).claim(packetId, password)).to.changeEtherBalances(
      [claimer, contract],
      [expectedShare, -expectedShare]
    );

    const summary = await contract.packetSummary(packetId);
    expect(summary.remainingShares).to.equal(shares - 1);
    expect(summary.remainingAmount).to.equal(total - expectedShare);
  });

  it("reverts claim when password is wrong", async () => {
    const [creator, claimer] = await ethers.getSigners();
    const contract = await deployContract();

    const passwordHash = ethers.keccak256(ethers.toUtf8Bytes("right"));
    const total = ethers.parseEther("0.1");

    await contract
      .connect(creator)
      .createRedPacket(1, ethers.ZeroAddress, total, 2, ONE_HOUR, passwordHash, { value: total });

    const packetId = (await contract.nextPacketId()) - 1n;

    await expect(contract.connect(claimer).claim(packetId, "wrong")).to.be.revertedWithCustomError(
      contract,
      "InvalidPassword"
    );
  });

  it("allows creator to refund after expiry", async () => {
    const [creator] = await ethers.getSigners();
    const contract = await deployContract();

    const passwordHash = ethers.keccak256(ethers.toUtf8Bytes("refund"));
    const total = ethers.parseEther("0.5");

    await contract
      .connect(creator)
      .createRedPacket(1, ethers.ZeroAddress, total, 3, ONE_HOUR, passwordHash, { value: total });

    const packetId = (await contract.nextPacketId()) - 1n;

    await time.increase(ONE_HOUR + 1);

    await expect(contract.connect(creator).refundExpired(packetId)).to.changeEtherBalances(
      [creator, contract],
      [total, -total]
    );

    const summary = await contract.packetSummary(packetId);
    expect(summary.refunded).to.equal(true);
    expect(summary.remainingAmount).to.equal(0);
    expect(summary.remainingShares).to.equal(0);
  });
});

