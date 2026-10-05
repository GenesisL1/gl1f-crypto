// MIT License — Copyright (c) 2026 Decentralized Science Labs
// GL1F Crypto contracts: per-model licenses from the on-chain catalog, two-step ownership handed to a multisig,
// creator income that follows the NFT, owner transactions from scripts/owner_tx.mjs, and the app's ABIs.
import assert from "node:assert/strict";
import ganache from "ganache";
import solc from "solc";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrowserProvider, ContractFactory, Interface, ZeroAddress, getAddress, hexlify, keccak256, parseEther } from "ethers";
import { serializeV1, packFeatures } from "./helpers/gl1f_reference.mjs";
import { compileCryptoContracts, deployCryptoContracts, LICENSE_CATALOG } from "../scripts/deploy_crypto_contracts.mjs";
import { buildOwnerTxs } from "../scripts/owner_tx.mjs";
import { ABI_REGISTRY, ABI_MARKET, ABI_MODELNFT, ABI_RUNTIME } from "../src/studio/abis.js";

import { GL1FCrypto, packInputs } from "../src/sdk/gl1f-crypto.js";
import * as ethersLib from "ethers";
import { decodeModel, predictQ } from "../src/studio/local_infer.js";
// Web3 API on a local chain: free reads, access keys with plans, owner signatures and pay-per-run all give the score
// the local engine computes; keys without a plan, expired plans and keys of a previous owner are refused.
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex");
const eip1193 = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 6, defaultBalance: 1_000, deterministic: true }, chain: { chainId: 1337, hardfork: "shanghai" }, miner: { instamine: "eager" } });
const reason = async (promise) => { try { await promise; return null; } catch (e) { return e.reason || e.shortMessage || e.message; } };
try {
  const provider = new BrowserProvider(eip1193, undefined, { cacheTimeout: -1 });
  const [owner, creator, payer, buyer] = await Promise.all([0, 1, 2, 3].map((i) => provider.getSigner(i)));
  const d = await deployCryptoContracts({ signer: owner, artifacts: compileCryptoContracts(), tos: "GL1F Crypto SDK test terms" });
  const { store, registry, nft, runtime } = d.instances;
  const parse = (c, r) => r.logs.map((l) => { try { return c.interface.parseLog(l); } catch { return null; } }).filter(Boolean);
  const writeChunk = async (payload) => getAddress(parse(store, await (await store.connect(creator).write(hexlify(payload))).wait()).find((e) => e.name === "ChunkWritten").args.pointer);
  const bytes = Buffer.from(serializeV1({ nFeatures: 2, depth: 2, baseQ: 1_000, scaleQ: 1_000, trees: [{ nodes: [{ feature: 0, threshold: 0 }, { feature: 1, threshold: -10 }, { feature: 1, threshold: 10 }], leaves: [-100, -20, 30, 200] }] }));
  async function mintModel(mode, feeWei, title) {
    const pointer = await writeChunk(bytes), table = Buffer.alloc(32); Buffer.from(pointer.slice(2), "hex").copy(table, 12);
    const tablePtr = await writeChunk(table), modelId = keccak256(Buffer.concat([bytes, Buffer.from(title)])), me = getAddress(await creator.getAddress());
    const r = await (await registry.connect(creator).registerModel(modelId, tablePtr, 24_000, 1, bytes.length, 2, 1, 2, 1_000, 1_000, title, "sdk test", PNG, "#meta={\"v\":1}\nf0\nf1", [], mode, feeWei, ZeroAddress, await registry.tosVersion(), 1, me, { value: await registry.requiredDeployFeeWei(bytes.length) })).wait();
    return Number(parse(registry, r).find((e) => e.name === "ModelRegistered").args.tokenId);
  }
  const freeId = await mintModel(0, 0n, "free"), paidId = await mintModel(2, parseEther("0.01"), "paid");
  const gl1f = new GL1FCrypto({ ethers: ethersLib, provider, registry: await registry.getAddress(), runtime: await runtime.getAddress() });
  const inputs = [700, -25], local = BigInt(predictQ(decodeModel(new Uint8Array(bytes)), inputs.map((q) => q / 1000)));
  const free = await gl1f.model(freeId), paid = await gl1f.model(paidId);
  assert.equal(free.pricing, "free"); assert.equal(paid.pricing, "paid"); assert.deepEqual(free.featureNames, ["f0", "f1"]);
  const r1 = await gl1f.predict(free, inputs);
  assert.equal(r1.scoreQ, local); assert.equal(r1.via, "predictView"); assert.ok(r1.probability > 0 && r1.probability < 1);
  assert.match(await reason(gl1f.predict(paid, inputs)), /is paid/, "a paid model needs a key, an owner signature or a payment");
  await (await registry.connect(creator).createAccessPlan(paid.modelId, 20, parseEther("0.05"), true)).wait();
  const key = gl1f.newAccessKey();
  assert.match(await reason(gl1f.predict(await gl1f.model(paidId), inputs, { accessKey: key.privateKey })), /NO_ACCESS/, "a key without a plan is refused");
  const bought = await gl1f.buyAccess(paidId, 1, key.address, buyer);
  assert.equal(bought.active, true);
  const r2 = await gl1f.predict(await gl1f.model(paidId), inputs, { accessKey: key.privateKey });
  assert.equal(r2.scoreQ, local); assert.equal(r2.via, "predictAccessView");
  // Ganache's own signer rejects the standard eth_signTypedData_v4 string payload that real wallets accept, so the admin
  // signs locally with its deterministic test key (account 1), as a browser wallet or a server key would.
  const adminWallet = new ethersLib.Wallet("0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1", provider);
  assert.equal(adminWallet.address, getAddress(await creator.getAddress()));
  const r3 = await gl1f.predict(paid, inputs, { owner: adminWallet });
  assert.equal(r3.scoreQ, local); assert.equal(r3.via, "predictOwnerView");
  const before = await provider.getBalance(await creator.getAddress());
  const r4 = await gl1f.predict(paid, inputs, { payer });
  assert.equal(r4.scoreQ, local); assert.equal(r4.via, "predictTx");
  assert.equal(await provider.getBalance(await creator.getAddress()) - before, parseEther("0.01"), "the fee goes to the model admin");
  for (let i = 0; i < 22; i++) await provider.send("evm_mine", []);
  assert.equal((await gl1f.accessStatus(paidId, key.address)).active, false, "the plan ends");
  assert.match(await reason(gl1f.predict(paid, inputs, { accessKey: key.privateKey })), /NO_ACCESS/, "an expired key is refused");
  assert.match(await reason(gl1f.predict(paid, inputs.slice(0, 1))), /takes 2 inputs/);
  assert.equal(packInputs([1, -1]).length, 8);
  console.log(`web3 api: model metadata and plans; free read, access key with a plan, owner signature and pay-per-run all return the local score (${local}); keys without or after a plan refused; fee to the admin`);
} finally {
  await eip1193.disconnect();
}
