/* eslint-disable node/no-unsupported-features/es-syntax */
/* eslint-disable node/no-unsupported-features/es-builtins */
/* eslint-disable no-unused-expressions */
import { expect } from "chai";
import moment from "moment";
import { BigNumber, BigNumberish } from "ethers";
import { ethers, network } from "hardhat";
import { DummyERC721, Lease } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const DAO_ACCOUNT_ID = "dao_account.eth";
const MARKET_CREATOR_ACCOUNT_ID = "creator.eth";
const ASSET_ACCOUNT_ID = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const TENANT_ACCOUNT_ID = "0x41231dadda96380c114e75e0da8a2b207d9232c2";

// async function approveCollateralTokenSpending(
//   collateralToken: DummyERC20,
//   owner: SignerWithAddress,
//   spender: string,
//   amount: BigNumberish
// ) {
//   const [, , collateralTokenOwner] = await ethers.getSigners();

//   await collateralToken
//     .connect(collateralTokenOwner)
//     .transfer(owner.address, amount);

//   return await collateralToken.connect(owner).approve(spender, amount);
// }

async function getBlockTimestamp() {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const blockTimestamp = blockBefore.timestamp;

  return blockTimestamp;
}

async function createERC721Contract() {
  const [, , owner] = await ethers.getSigners();

  const ERC721 = await ethers.getContractFactory("DummyERC721");

  const contract = await ERC721.connect(owner).deploy("name", "DUMMY");

  return contract;
}

async function createLeaseContract(overrides?: Record<string, any>) {
  const [assetAccountId] = await ethers.getSigners();

  const Lease = await ethers.getContractFactory("Lease");

  const _asset = overrides?.asset || assetAccountId;
  const _tokenId = overrides?.tokenId || 0;
  const _pricePerHour = overrides?.pricePerHour || 1;

  const contract = await Lease.deploy(_asset, _tokenId, _pricePerHour);

  return contract;
}

describe("Lease", function () {
  it("Initialize: call constructor", async function () {
    const [, , owner, tenant] = await ethers.getSigners();

    const ERC721 = await createERC721Contract();

    const name = await ERC721.name();
    const symbol = await ERC721.symbol();

    const ownerOf0 = await ERC721.ownerOf(0);
    const ownerOf1 = await ERC721.ownerOf(1);
    const ownerOf2 = await ERC721.ownerOf(2);
    const ownerOf3 = await ERC721.ownerOf(3);

    expect(name).to.equal("name");
    expect(symbol).to.equal("DUMMY");

    console.log({ ownerOf0, ownerOf1, ownerOf2, ownerOf3 });

    expect(ownerOf0).to.equal(owner.address);
    expect(ownerOf1).to.equal(owner.address);
    expect(ownerOf2).to.equal(owner.address);
    expect(ownerOf3).to.equal(owner.address);

    const NFTAddress = await ERC721.getAddress();

    const leaseContract = await createLeaseContract({
      asset: NFTAddress,
      tokenId: 0,
      pricePerHour: 1,
    });

    const asset = await leaseContract.asset();
    const currentTenant = await leaseContract.tenant();
    const tokenId = await leaseContract.tokenId();
    const duration = await leaseContract.duration();
    const pricePerHour = await leaseContract.pricePerHour();

    console.log({ NFTAddress, asset, currentTenant, tokenId, duration, pricePerHour });

    expect(asset).to.equal(NFTAddress);
    expect(currentTenant).to.equal(ethers.ZeroAddress);
    expect(tokenId).to.equal(0n);
    expect(duration).to.equal(0n);
    expect(pricePerHour).to.equal(1n);
  });

  it("rent: fail with ERR_INVALID_PRICE_PER_HOUR_AMOUNT", async function () {
    const [, , , tenant] = await ethers.getSigners();

    const ERC721 = await createERC721Contract();

    const NFTAddress = await ERC721.getAddress();

    const leaseContract = await createLeaseContract({
      asset: NFTAddress,
      tokenId: 0,
      pricePerHour: 2,
    });

    await expect(leaseContract.rent(1)).to.be.revertedWith("ERR_INVALID_PRICE_PER_HOUR_AMOUNT");
  });

  it("rent: approve ERC721 usage to tenant for duration period", async function () {
    const [, , owner, tenant] = await ethers.getSigners();

    const ERC721 = await createERC721Contract();

    const NFTAddress = await ERC721.getAddress();

    const leaseContract = await createLeaseContract({
      asset: NFTAddress,
      tokenId: 0,
      pricePerHour: 1,
    });

    const leaseContractAddress = await leaseContract.getAddress();

    console.log({ leaseContractAddress, owner: owner.address });

    await ERC721.connect(owner).setApprovalForAll(leaseContractAddress, true);

    const approvedAddress = await ERC721.getApproved(0);
    const isApprovedForAll = await ERC721.isApprovedForAll(owner.address, leaseContractAddress);
    const ownerOf = await ERC721.ownerOf(0);

    console.log({ approvedAddress, ownerOf, isApprovedForAll });

    expect(owner).to.equal(ownerOf);
    expect(isApprovedForAll).to.be.true;

    await leaseContract.connect(tenant).rent(1n, { value: 1n });

    const currentTenant = await leaseContract.tenant();
    expect(currentTenant).to.equal(tenant);

    const duration = await leaseContract.duration();
    const blockTimestamp = await getBlockTimestamp();
    expect(duration).to.equal(3600n + ethers.toBigInt(blockTimestamp));
  });

  it("terminate: revoke approve for tenant", async function () {
    const [whoever, , owner, tenant] = await ethers.getSigners();

    const ERC721 = await createERC721Contract();

    const NFTAddress = await ERC721.getAddress();

    const leaseContract = await createLeaseContract({
      asset: NFTAddress,
      tokenId: 0,
      pricePerHour: 1,
    });

    const leaseContractAddress = await leaseContract.getAddress();

    console.log({ leaseContractAddress, owner: owner.address });

    await ERC721.connect(owner).setApprovalForAll(leaseContractAddress, true);

    let approvedAddress = await ERC721.getApproved(0);
    const isApprovedForAll = await ERC721.isApprovedForAll(owner.address, leaseContractAddress);
    const ownerOf = await ERC721.ownerOf(0);

    console.log({ approvedAddress, ownerOf, isApprovedForAll });

    expect(owner).to.equal(ownerOf);
    expect(isApprovedForAll).to.be.true;

    await leaseContract.connect(tenant).rent(1n, { value: 1n });

    const duration = await leaseContract.duration();
    const blockTimestamp = await getBlockTimestamp();

    await network.provider.send("evm_setNextBlockTimestamp", [
      moment
        .unix(Number(duration) + blockTimestamp)
        .add(1, "minute")
        .unix(),
    ]);

    await leaseContract.connect(whoever).terminate();

    approvedAddress = await ERC721.getApproved(0);
    expect(approvedAddress).to.equal(ethers.ZeroAddress);

    const currentTenant = await leaseContract.tenant();
    expect(currentTenant).to.equal(ethers.ZeroAddress);
  });

  it("rent: fail with ERR_ALREADY_RENTED", async function () {
    const [whoever, , owner, tenant] = await ethers.getSigners();

    const ERC721 = await createERC721Contract();

    const NFTAddress = await ERC721.getAddress();

    const leaseContract = await createLeaseContract({
      asset: NFTAddress,
      tokenId: 0,
      pricePerHour: 1,
    });

    const leaseContractAddress = await leaseContract.getAddress();

    console.log({ leaseContractAddress, owner: owner.address });

    await ERC721.connect(owner).setApprovalForAll(leaseContractAddress, true);

    const approvedAddress = await ERC721.getApproved(0);
    const isApprovedForAll = await ERC721.isApprovedForAll(owner.address, leaseContractAddress);
    const ownerOf = await ERC721.ownerOf(0);

    console.log({ approvedAddress, ownerOf, isApprovedForAll });

    expect(owner).to.equal(ownerOf);
    expect(isApprovedForAll).to.be.true;

    await leaseContract.connect(tenant).rent(1n, { value: 1n });

    await expect(leaseContract.connect(whoever).rent(1)).to.be.revertedWith("ERR_ALREADY_RENTED");
  });
});
