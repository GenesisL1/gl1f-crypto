// MIT License — Copyright (c) 2026 Decentralized Science Labs
// GL1F Crypto contracts: protocol fees accumulate in-contract and anyone can burn them.
import assert from "node:assert/strict";
import ganache from "ganache";
import { BrowserProvider, getAddress, hexlify, keccak256, parseEther } from "ethers";
import { serializeV1, referenceV1, packFeatures } from "./helpers/gl1f_reference.mjs";
import { compileCryptoContracts, deployCryptoContracts } from "../scripts/deploy_crypto_contracts.mjs";

const DEAD = "0x000000000000000000000000000000000000dEaD";
const PNG_1X1 = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex");
const eip1193 = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 4, defaultBalance: 1_000, deterministic: true }, chain: { chainId: 1337, hardfork: "shanghai" }, miner: { instamine: "eager" } });
try {
  const provider = new BrowserProvider(eip1193, undefined, { cacheTimeout: -1 }); // no request cache: balances are re-read after each burn
  const [owner, creator, stranger] = await Promise.all([0, 1, 2].map((i) => provider.getSigner(i)));
  const artifacts = compileCryptoContracts();
  for (const name of ["CryptoModelRegistry", "CryptoModelMarketplace"]) {
    assert.ok(artifacts[name].runtimeBytes <= 24_576, `${name} exceeds EIP-170`);
    const fns = artifacts[name].abi.filter((x) => x.type === "function").map((x) => x.name);
    assert.ok(fns.includes("burnFees") && fns.includes("pendingBurnWei"), `${name} exposes burnFees`);
    assert.ok(!fns.some((f) => /withdraw|sweep|rescue/i.test(f)), `${name} must not let anyone withdraw fees`);
    const burn = artifacts[name].abi.find((x) => x.name === "burnFees");
    assert.equal(burn.stateMutability, "nonpayable");
  }
  const creationFee = parseEther("10"), byteFee = 1_000_000_000_000n, listingFee = parseEther("0.5");
  const d = await deployCryptoContracts({ signer: owner, artifacts, tos: "GL1F Crypto test terms", creationFeeWei: creationFee, sizeFeeWeiPerByte: byteFee, listingFeeWei: listingFee });
  const { store, registry, nft, runtime, market } = d.instances;
  assert.equal(getAddress(d.fees.burnAddress), getAddress(DEAD));
  const ownerAddress = await owner.getAddress(), creatorAddress = await creator.getAddress();
  const ownerBefore = await provider.getBalance(ownerAddress);

  // Store a small binary model and register it, paying creation + per-byte fees.
  const bytes = Buffer.from(serializeV1({ nFeatures: 2, depth: 2, baseQ: 1_000, scaleQ: 1_000, trees: [{ nodes: [{ feature: 0, threshold: 0 }, { feature: 1, threshold: -10 }, { feature: 1, threshold: 10 }], leaves: [-100, -20, 30, 200] }] }));
  const write = async (payload) => {
    const receipt = await (await store.connect(creator).write(hexlify(payload))).wait();
    const event = receipt.logs.map((l) => { try { return store.interface.parseLog(l); } catch { return null; } }).find((e) => e?.name === "ChunkWritten");
    return getAddress(event.args.pointer);
  };
  const pointer = await write(bytes);
  const table = Buffer.alloc(32); Buffer.from(pointer.slice(2), "hex").copy(table, 12);
  const tablePtr = await write(table);
  const required = await registry.requiredDeployFeeWei(bytes.length);
  assert.equal(required, creationFee + byteFee * BigInt(bytes.length));
  const modelId = keccak256(bytes);
  const [tos, license] = [await registry.tosVersion(), await registry.activeLicenseId()];
  const receipt = await (await registry.connect(creator).registerModel(
    modelId, tablePtr, 24_000, 1, bytes.length, 2, 1, 2, 1_000, 1_000, "ETH 15m UP test", "GL1F Crypto fee burn test model",
    PNG_1X1, "#meta={\"v\":1}\nf0\nf1", [keccak256(Buffer.from("eth"))], 0, 0, creatorAddress, tos, license, creatorAddress, { value: required },
  )).wait();
  const collected = receipt.logs.map((l) => { try { return registry.interface.parseLog(l); } catch { return null; } }).filter((e) => e?.name === "FeesCollected");
  assert.deepEqual(collected.map((e) => [Number(e.args.kind), e.args.amountWei]), [[0, creationFee], [1, byteFee * BigInt(bytes.length)]]);
  assert.equal(await provider.getBalance(await registry.getAddress()), required, "fees stay in the registry");
  assert.equal(await provider.getBalance(ownerAddress), ownerBefore, "owner receives nothing");
  assert.equal(await registry.totalCreationFeesWei(), creationFee);
  assert.equal(await registry.totalSizeFeesWei(), byteFee * BigInt(bytes.length));
  assert.equal(await registry.totalFeesCollectedWei(), required);
  assert.equal(await registry.totalBytesRegistered(), BigInt(bytes.length));
  assert.equal(await registry.pendingBurnWei(), required);

  // The contract set still works end to end: NFT minted, runtime scores exactly.
  const tokenId = await registry.tokenIdByModelId(modelId);
  assert.equal(await nft.ownerOf(tokenId), creatorAddress);
  for (const features of [[-5, 0], [3, -20], [3, 20]]) {
    assert.equal(await runtime.predictView(modelId, packFeatures(features)), BigInt(referenceV1(bytes, features)));
  }

  // Marketplace listing fee is retained, then burned.
  await (await nft.connect(creator).approve(await market.getAddress(), tokenId)).wait();
  await (await market.connect(creator).list(tokenId, parseEther("3"), { value: listingFee })).wait();
  assert.equal(await market.pendingBurnWei(), listingFee);
  assert.equal(await market.totalListingFeesWei(), listingFee);

  // Anyone burns. Burned value lands at 0x…dEaD; counters and events are exact.
  const deadBefore = await provider.getBalance(DEAD);
  const burn = await (await registry.connect(stranger).burnFees()).wait();
  const burned = burn.logs.map((l) => { try { return registry.interface.parseLog(l); } catch { return null; } }).find((e) => e?.name === "FeesBurned");
  assert.equal(getAddress(burned.args.caller), await stranger.getAddress());
  assert.equal(burned.args.amountWei, required);
  await (await market.connect(stranger).burnFees()).wait();
  assert.equal(await provider.getBalance(DEAD), deadBefore + required + listingFee);
  assert.equal(await registry.totalFeesBurnedWei(), required);
  assert.equal(await market.totalFeesBurnedWei(), listingFee);
  assert.equal(await registry.burnCount(), 1n);
  assert.equal(await registry.pendingBurnWei(), 0n);
  await assert.rejects(registry.connect(stranger).burnFees.staticCall(), /NOTHING_TO_BURN/);
  await assert.rejects(market.connect(owner).burnFees.staticCall(), /NOTHING_TO_BURN/);
  console.log(`crypto fee burn: registry ${d.contracts.modelRegistry}, creation+size fees ${required} wei and listing fee ${listingFee} wei burned by a third party; counters exact; runtime parity kept.`);
} finally {
  await eip1193.disconnect();
}
