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

const PNG_1X1 = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex");
// A minimal multisig stand-in: a contract account that executes calls for its operator.
const MULTISIG = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract MockMultisig {
    address public immutable operator;
    constructor() { operator = msg.sender; }
    function exec(address to, uint256 value, bytes calldata data) external payable returns (bytes memory out) {
        require(msg.sender == operator, "OP");
        bool ok;
        (ok, out) = to.call{value: value}(data);
        if (!ok) { assembly { revert(add(out, 32), mload(out)) } }
    }
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) { return 0x150b7a02; }
    receive() external payable {}
}`;
function compileMultisig() {
  const input = { language: "Solidity", sources: { "MockMultisig.sol": { content: MULTISIG } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "istanbul", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  const c = out.contracts["MockMultisig.sol"].MockMultisig;
  return { abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` };
}
const reason = async (promise) => { try { await promise; return null; } catch (e) { return e.reason || e.shortMessage || e.message; } };
const parse = (contract, receipt) => receipt.logs.map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } }).filter(Boolean);

// The UI's human-readable ABIs must match the compiled contracts: every function exists with the same inputs and
// mutability, and every view returns the same types (a wrong output type silently decodes garbage).
function checkAbi(ui, compiled, label) {
  const want = new Interface(ui), have = new Interface(compiled);
  let n = 0;
  want.forEachFunction((f) => {
    const g = have.getFunction(f.format("sighash"));
    assert.ok(g, `${label}: ${f.format("sighash")} is missing from the contract`);
    assert.equal(f.stateMutability, g.stateMutability, `${label}: ${f.name} mutability`);
    if (f.stateMutability === "view" || f.stateMutability === "pure") assert.deepEqual(f.outputs.map((o) => o.type), g.outputs.map((o) => o.type), `${label}: ${f.name} outputs`);
    n++;
  });
  return n;
}

const eip1193 = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 8, defaultBalance: 1_000, deterministic: true }, chain: { chainId: 1337, hardfork: "shanghai" }, miner: { instamine: "eager" } });
try {
  const provider = new BrowserProvider(eip1193, undefined, { cacheTimeout: -1 });
  const [owner, creator, buyer, stranger, payee, payee2, operator] = await Promise.all([0, 1, 2, 3, 4, 5, 6].map((i) => provider.getSigner(i)));
  const addr = async (s) => getAddress(await s.getAddress());
  const bal = (a) => provider.getBalance(a);
  const artifacts = compileCryptoContracts();
  const abiCount = checkAbi(ABI_REGISTRY, artifacts.CryptoModelRegistry.abi, "registry") + checkAbi(ABI_MARKET, artifacts.CryptoModelMarketplace.abi, "market")
    + checkAbi(ABI_MODELNFT, artifacts.ModelNFT.abi, "nft") + checkAbi(ABI_RUNTIME, artifacts.ForestRuntime.abi, "runtime");

  // 1. Deployment writes the whole license catalog in file order; CC BY-SA 4.0 (#1) is the default.
  const d = await deployCryptoContracts({ signer: owner, artifacts, tos: "GL1F Crypto admin test terms" });
  const { store, registry, nft, runtime, market } = d.instances;
  const L = LICENSE_CATALOG.licenses, idOf = (spdx) => L.findIndex((l) => l.spdx === spdx) + 1;
  assert.equal(Number(await registry.licenseCount()), L.length);
  for (const [i, l] of L.entries()) {
    const info = await registry.getLicenseInfo(i + 1);
    assert.deepEqual([info.name, info.url, info.spdx, info.selectable, Number(info.openness)], [l.name, l.url, l.spdx, true, l.openness], `license #${i + 1}`);
    assert.equal(Number(await registry.licenseIdBySpdx(l.spdx)), i + 1);
  }
  assert.equal(L[0].spdx, LICENSE_CATALOG.default);
  assert.deepEqual([d.licenses.count, d.licenses.defaultId, d.licenses.defaultSpdx], [L.length, 1, "CC-BY-SA-4.0"]);
  assert.equal(await reason(registry.connect(owner).addLicenseWithSpdx.staticCall("MIT again", "https://example.org/", "MIT", 3)), "LIC_DUP");
  assert.equal(await reason(registry.connect(stranger).addLicenseWithSpdx.staticCall("X", "https://example.org/", "X-1.0", 1)), "OWN");
  assert.equal(await reason(registry.connect(owner).setModelNFT.staticCall(await nft.getAddress())), "NFT_SET");

  // 2. Each creator picks a license when minting; it is fixed for good.
  let seq = 0;
  const writeChunk = async (signer, payload) => getAddress(parse(store, await (await store.connect(signer).write(hexlify(payload))).wait()).find((e) => e.name === "ChunkWritten").args.pointer);
  async function mint(signer, { license = 1, mode = 0, feeWei = 0n, recipient = ZeroAddress, tos = null } = {}, dryRun = false) {
    seq += 1;
    const bytes = Buffer.from(serializeV1({ nFeatures: 2, depth: 2, baseQ: 1_000 + seq, scaleQ: 1_000, trees: [{ nodes: [{ feature: 0, threshold: 0 }, { feature: 1, threshold: -10 }, { feature: 1, threshold: 10 }], leaves: [-100, -20, 30, 200] }] }));
    const pointer = await writeChunk(signer, bytes), table = Buffer.alloc(32);
    Buffer.from(pointer.slice(2), "hex").copy(table, 12);
    const tablePtr = await writeChunk(signer, table), modelId = keccak256(bytes), me = await addr(signer);
    const args = [modelId, tablePtr, 24_000, 1, bytes.length, 2, 1, 2, 1_000 + seq, 1_000, `Model ${seq}`, "license and admin test", PNG_1X1, "#meta={\"v\":1}\nf0\nf1", [],
      mode, feeWei, recipient, tos ?? await registry.tosVersion(), license, me, { value: await registry.requiredDeployFeeWei(bytes.length) }];
    if (dryRun) return reason(registry.connect(signer).registerModel.staticCall(...args));
    const events = parse(registry, await (await registry.connect(signer).registerModel(...args)).wait());
    const tokenId = events.find((e) => e.name === "ModelRegistered").args.tokenId, licensed = events.find((e) => e.name === "ModelLicensed");
    assert.equal(licensed.args.tokenId, tokenId); assert.equal(Number(licensed.args.licenseId), license);
    return { tokenId, modelId };
  }
  const m1 = await mint(creator, { license: idOf("MIT") });
  const lo = await registry.licenseOf(m1.tokenId);
  assert.deepEqual([Number(lo.id), lo.name, lo.url, lo.spdx], [idOf("MIT"), "MIT", L[idOf("MIT") - 1].url, "MIT"]);
  assert.equal(Number((await registry.models(m1.modelId)).licenseIdAccepted), idOf("MIT"));
  const m2 = await mint(creator, { license: idOf("CC-BY-NC-4.0") });
  assert.equal(await mint(creator, { license: 0 }, true), "LIC");
  assert.equal(await mint(creator, { license: L.length + 1 }, true), "LIC");
  assert.equal(await mint(creator, { license: 1, mode: 3, feeWei: 1n }, true), "MODE");
  await (await registry.connect(owner).setLicenseEnabled(idOf("CC-BY-NC-4.0"), false)).wait();
  assert.equal((await registry.getLicenseInfo(idOf("CC-BY-NC-4.0"))).selectable, false);
  assert.equal(await mint(creator, { license: idOf("CC-BY-NC-4.0") }, true), "LIC", "disabled licenses are closed to new models");
  assert.equal((await registry.licenseOf(m2.tokenId)).spdx, "CC-BY-NC-4.0", "existing models keep a disabled license");
  assert.equal(await reason(registry.connect(owner).setActiveLicenseId.staticCall(idOf("CC-BY-NC-4.0"))), "LIC_DISABLED");
  assert.equal(await reason(registry.connect(owner).setLicenseEnabled.staticCall(1, false)), "LIC_DEFAULT");
  await (await registry.connect(owner).setActiveLicenseId(idOf("Apache-2.0"))).wait();
  await mint(creator, { license: idOf("Apache-2.0") });
  assert.equal((await registry.licenseOf(m1.tokenId)).spdx, "MIT", "changing the default never touches existing models");

  // 2b. License versions: a model admin may move its model to a later version of its license or to a more open
  //     license, never to a more restrictive one; the protocol admin publishes new versions.
  const R1 = idOf("LicenseRef-GL1F-OnChain-Use-1.0");
  assert.equal(R1, L.length); assert.equal(L[R1 - 1].group, "reserved"); assert.equal(LICENSE_CATALOG.paidDefault, L[R1 - 1].spdx);
  const reserved = await mint(creator, { license: R1, mode: 2, feeWei: parseEther("0.01") });
  let current = await registry.licenseOf(reserved.tokenId);
  assert.equal(Number(current.openness), 0); assert.ok(Number(current.sinceBlock) > 0);
  await (await registry.connect(owner).addLicenseWithSpdx("GL1F On-Chain Use 1.1", "https://example.org/onchain-use-1.1", "LicenseRef-GL1F-OnChain-Use-1.1", 0)).wait();
  const R2 = Number(await registry.licenseIdBySpdx("LicenseRef-GL1F-OnChain-Use-1.1"));
  assert.equal(await reason(registry.connect(owner).setLicenseSupersedes.staticCall(R2, idOf("MIT"))), "LIC_OPEN", "a later version keeps the openness");
  assert.equal(await reason(registry.connect(owner).setLicenseSupersedes.staticCall(R1, R2)), "LIC_ID", "versions point backwards only");
  assert.equal(await reason(registry.connect(stranger).setLicenseSupersedes.staticCall(R2, R1)), "OWN");
  await (await registry.connect(owner).setLicenseSupersedes(R2, R1)).wait();
  assert.equal(await reason(registry.connect(owner).setLicenseSupersedes.staticCall(R2, R1)), "LIC_SET");
  assert.equal(await reason(registry.connect(stranger).changeModelLicense.staticCall(reserved.tokenId, R2)), "NOT_OWNER");
  const moved = parse(registry, await (await registry.connect(creator).changeModelLicense(reserved.tokenId, R2)).wait()).find((e) => e.name === "ModelLicenseChanged");
  assert.deepEqual([Number(moved.args.fromId), Number(moved.args.toId)], [R1, R2]);
  current = await registry.licenseOf(reserved.tokenId);
  assert.equal(current.spdx, "LicenseRef-GL1F-OnChain-Use-1.1"); assert.ok(Number(current.sinceBlock) > 0);
  assert.equal(await reason(registry.connect(creator).changeModelLicense.staticCall(reserved.tokenId, R1)), "LIC_DOWNGRADE", "no way back to an earlier version");
  await (await registry.connect(creator).changeModelLicense(reserved.tokenId, idOf("MIT"))).wait();
  for (const stricter of [idOf("CC-BY-SA-4.0"), idOf("CC-BY-ND-4.0"), R2])
    assert.equal(await reason(registry.connect(creator).changeModelLicense.staticCall(reserved.tokenId, stricter)), "LIC_DOWNGRADE", "never more restrictive");
  await (await registry.connect(creator).changeModelLicense(reserved.tokenId, idOf("CC0-1.0"))).wait();
  assert.equal(Number((await registry.licenseOf(reserved.tokenId)).openness), 4);

  // 3. Creator income follows the NFT: the seller's recipient stops applying after a sale.
  const [payeeA, payee2A, buyerA, strangerA] = await Promise.all([payee, payee2, buyer, stranger].map(addr));
  const fee = parseEther("0.1");
  const paid = await mint(creator, { license: idOf("CC-BY-4.0"), mode: 2, feeWei: fee, recipient: payeeA });
  assert.equal(getAddress(await registry.payoutAddressOf(paid.tokenId)), payeeA);
  let before = await bal(payeeA);
  await (await runtime.connect(stranger).predictTx(paid.modelId, packFeatures([3, 20]), { value: fee })).wait();
  assert.equal(await bal(payeeA), before + fee, "the creator's recipient is paid while the creator owns the NFT");
  await (await nft.connect(creator).approve(await market.getAddress(), paid.tokenId)).wait();
  await (await market.connect(creator).list(paid.tokenId, parseEther("5"), { value: await market.listingFeeWei() })).wait();
  await (await market.connect(buyer).buy(paid.tokenId, { value: parseEther("5") })).wait();
  assert.equal(getAddress(await nft.ownerOf(paid.tokenId)), buyerA);
  for (const read of [registry.payoutAddressOf(paid.tokenId), registry.getModelSummary(paid.tokenId).then((s) => s.feeRecipient), registry.getModelRuntime(paid.modelId).then((r) => r.feeRecipient)])
    assert.equal(getAddress(await read), buyerA);
  before = await bal(buyerA);
  await (await runtime.connect(stranger).predictTx(paid.modelId, packFeatures([3, 20]), { value: fee })).wait();
  assert.equal(await bal(buyerA), before + fee, "after the sale, inference fees go to the new owner");
  await (await registry.connect(buyer).createAccessPlan(paid.modelId, 100, parseEther("1"), true)).wait();
  before = await bal(buyerA);
  await (await registry.connect(stranger).buyAccess(paid.modelId, 1, strangerA, { value: parseEther("1") })).wait();
  assert.equal(await bal(buyerA), before + parseEther("1"), "after the sale, subscriptions pay the new owner");
  const settings = parse(registry, await (await registry.connect(buyer).updateModelSettings(paid.tokenId, true, 2, fee, payee2A)).wait()).find((e) => e.name === "ModelSettingsUpdated");
  assert.ok(settings && getAddress(settings.args.recipient) === payee2A, "settings changes emit ModelSettingsUpdated");
  assert.equal(getAddress(await registry.payoutAddressOf(paid.tokenId)), payee2A);
  assert.equal(await reason(registry.connect(buyer).updateModelSettings.staticCall(paid.tokenId, true, 3, fee, payee2A)), "MODE");

  // 4. The protocol admin moves to a multisig in two steps, using transactions built by scripts/owner_tx.mjs.
  const ms = compileMultisig();
  const multisig = await new ContractFactory(ms.abi, ms.bytecode, operator).deploy();
  await multisig.waitForDeployment();
  const msA = getAddress(await multisig.getAddress()), ownerA = await addr(owner);
  const at = { registry: await registry.getAddress(), market: await market.getAddress() };
  const fromOwner = async (txs) => { for (const t of txs) await (await owner.sendTransaction({ to: t.to, data: t.data })).wait(); };
  const fromMultisig = async (txs) => { for (const t of txs) await (await multisig.connect(operator).exec(t.to, 0, t.data)).wait(); };
  await fromOwner(await buildOwnerTxs("transfer-ownership", [msA, "both"], at));
  assert.equal(getAddress(await registry.pendingOwner()), msA); assert.equal(getAddress(await market.pendingOwner()), msA);
  assert.equal(getAddress(await registry.owner()), ownerA, "nothing changes before the multisig accepts");
  assert.equal(await reason(registry.connect(stranger).acceptOwnership.staticCall()), "NOT_PENDING_OWNER");
  await fromMultisig(await buildOwnerTxs("accept-ownership", ["both"], at));
  assert.equal(getAddress(await registry.owner()), msA); assert.equal(getAddress(await market.owner()), msA);
  assert.equal(await registry.pendingOwner(), ZeroAddress);
  assert.equal(await reason(registry.connect(owner).setDeployFeeWei.staticCall(1n)), "OWN", "the old owner has no power left");
  for (const [action, params] of [["set-creation-fee", ["5"]], ["set-byte-fee-wei", ["7"]], ["set-listing-fee", ["0.25"]], ["set-default-license", ["CDLA-Permissive-2.0"]],
    ["set-license-enabled", [String(idOf("CC-BY-NC-4.0")), "true"]], ["add-license", ["Example License 1.0", "https://example.org/license", "LicenseRef-Example-1.0", "1"]],
    ["add-license", ["GL1F On-Chain Use 1.2", "https://example.org/onchain-use-1.2", "LicenseRef-GL1F-OnChain-Use-1.2", "0"]]])
    await fromMultisig(await buildOwnerTxs(action, params, at));
  assert.equal(await registry.deployFeeWei(), parseEther("5")); assert.equal(await registry.sizeFeeWeiPerByte(), 7n);
  assert.equal(await market.listingFeeWei(), parseEther("0.25"));
  assert.ok((await market.queryFilter(market.filters.ListingFeeSet())).some((e) => e.args.feeWei === parseEther("0.25")), "listing fee changes emit ListingFeeSet");
  assert.equal(Number(await registry.activeLicenseId()), idOf("CDLA-Permissive-2.0"));
  assert.equal((await registry.getLicenseInfo(idOf("CC-BY-NC-4.0"))).selectable, true);
  assert.equal(Number(await registry.licenseIdBySpdx("LicenseRef-Example-1.0")), L.length + 2);
  const R3 = Number(await registry.licenseIdBySpdx("LicenseRef-GL1F-OnChain-Use-1.2"));
  await fromMultisig(await buildOwnerTxs("set-license-supersedes", [String(R3), String(R2)], at));
  assert.equal(Number((await registry.getLicenseInfo(R3)).supersedes), R2);
  // The multisig publishes a new version of the Terms of Service; minting then requires accepting it.
  const termsFile = join(tmpdir(), "gl1f-terms-v2.md");
  writeFileSync(termsFile, "# GL1F Crypto Terms of Service\n\nVersion 2 (test)\n");
  await fromMultisig(await buildOwnerTxs("set-tos", [termsFile], at));
  assert.equal(Number(await registry.tosVersion()), 2); assert.equal(await registry.tosText(), "# GL1F Crypto Terms of Service\n\nVersion 2 (test)\n");
  assert.equal(await mint(creator, { tos: 1 }, true), "TOS", "minting under an old version of the terms is refused");
  await mint(creator, { license: idOf("MIT") });
  await fromMultisig(await buildOwnerTxs("transfer-ownership", [strangerA, "registry"], at));
  await fromMultisig(await buildOwnerTxs("transfer-ownership", [ZeroAddress, "registry"], at));
  assert.equal(await registry.pendingOwner(), ZeroAddress, "a pending handover can be cancelled");
  assert.equal(await reason(registry.connect(stranger).acceptOwnership.staticCall()), "NOT_PENDING_OWNER");
  await (await nft.connect(buyer).transferFrom(buyerA, msA, paid.tokenId)).wait();
  assert.equal(getAddress(await registry.payoutAddressOf(paid.tokenId)), msA, "a multisig can be a model admin too; income follows the NFT there");
  before = await bal(msA);
  await (await registry.connect(stranger).buyAccess(paid.modelId, 1, strangerA, { value: parseEther("1") })).wait();
  assert.equal(await bal(msA), before + parseEther("1"));
  // 9. Mint time is on-chain; a model's admin, and only its admin, sets how front-ends show its internals.
  const shown = await mint(creator, { mode: 0 }), mintBlock = await provider.getBlock("latest");
  assert.ok(Math.abs(Number(await registry.mintedAt(shown.tokenId)) - mintBlock.timestamp) <= 1, "the mint time is recorded");
  assert.equal(Number(await registry.internalsVisibility(shown.tokenId)), 0, "default: private when paid, public otherwise");
  assert.equal(await reason(registry.connect(stranger).setInternalsVisibility.staticCall(shown.tokenId, 2)), "NOT_OWNER");
  assert.equal(await reason(registry.connect(creator).setInternalsVisibility.staticCall(shown.tokenId, 3)), "BAD_VISIBILITY");
  const visEvent = parse(registry, await (await registry.connect(creator).setInternalsVisibility(shown.tokenId, 2)).wait()).find((e) => e.name === "InternalsVisibilitySet");
  assert.equal(Number(visEvent.args.visibility), 2); assert.equal(Number(await registry.internalsVisibility(shown.tokenId)), 2);
  await (await registry.connect(creator).setInternalsVisibility(shown.tokenId, 1)).wait();
  assert.equal(Number(await registry.internalsVisibility(shown.tokenId)), 1, "the admin can change it after mint");
  // 10. A model's admin can delete it only when nobody is owed access; the protocol owner cannot delete at all.
  assert.equal(typeof registry.adminBurnAndDelete, "undefined", "no emergency delete for the protocol owner");
  const doomed = await mint(creator, { mode: 2, feeWei: parseEther("0.01") });
  await (await registry.connect(creator).createAccessPlan(doomed.modelId, 5, parseEther("0.1"), true)).wait();
  await (await registry.connect(stranger).buyAccess(doomed.modelId, 1, strangerA, { value: parseEther("0.1") })).wait();
  const subUntil = Number(await registry.subscribedUntil(doomed.modelId));
  assert.ok(subUntil > (await provider.getBlockNumber()), "a running subscription is recorded");
  assert.equal(await reason(registry.connect(creator).burnAndDelete.staticCall(doomed.tokenId)), "ACTIVE_SUBSCRIPTIONS", "not while a subscriber is owed access");
  assert.equal(await reason(registry.connect(stranger).burnAndDelete.staticCall(doomed.tokenId)), "NOT_OWNER");
  while ((await provider.getBlockNumber()) < subUntil) await provider.send("evm_mine", []);
  const burned = parse(registry, await (await registry.connect(creator).burnAndDelete(doomed.tokenId)).wait()).find((e) => e.name === "ModelBurned");
  assert.equal(burned.args.tokenId, doomed.tokenId, "deleted once every subscription has ended");
  assert.ok(await reason(nft.ownerOf(doomed.tokenId)), "its NFT is burned");
  const gone = await registry.getModelSummary(doomed.tokenId).catch(() => null);
  assert.ok(!gone || !gone.exists, "and it is gone from the registry");
  const unsold = await mint(creator, { mode: 0 });
  await (await registry.connect(creator).burnAndDelete(unsold.tokenId)).wait();
  assert.ok(await reason(nft.ownerOf(unsold.tokenId)), "a model nobody subscribed to can be deleted at once");
  // 11. Access keys: an owner key follows the NFT; subscriptions cannot be revoked or turned into owner keys.
  const keyed = await mint(creator, { mode: 2, feeWei: parseEther("0.01") }), creatorA = await addr(creator), buyerB = await addr(buyer);
  assert.equal(await registry.accessExpiry(keyed.modelId, creatorA), 2n ** 64n - 1n, "the minter's owner key has unlimited access");
  await (await registry.connect(creator).createAccessPlan(keyed.modelId, 50, parseEther("0.1"), true)).wait();
  await (await registry.connect(stranger).buyAccess(keyed.modelId, 1, strangerA, { value: parseEther("0.1") })).wait();
  assert.equal(await reason(registry.connect(creator).revokeAccessKey.staticCall(keyed.modelId, strangerA)), "NOT_OWNER_KEY", "a paid subscription cannot be revoked");
  assert.equal(await reason(registry.connect(creator).setOwnerAccessKey.staticCall(keyed.modelId, strangerA)), "KEY_SUBSCRIBED", "nor turned into an owner key");
  await (await nft.connect(creator).transferFrom(creatorA, buyerB, keyed.tokenId)).wait();
  assert.equal(await registry.accessExpiry(keyed.modelId, creatorA), 0n, "after a sale the previous owner's key stops working");
  assert.ok(Number(await registry.accessExpiry(keyed.modelId, strangerA)) > 0, "subscribers keep their access");
  await (await registry.connect(buyer).setOwnerAccessKey(keyed.modelId, buyerB)).wait();
  assert.equal(await registry.accessExpiry(keyed.modelId, buyerB), 2n ** 64n - 1n, "the new admin sets their own owner key");
  await (await registry.connect(buyer).revokeAccessKey(keyed.modelId, buyerB)).wait();
  assert.equal(await registry.accessExpiry(keyed.modelId, buyerB), 0n, "and can revoke it");
  console.log(`admin and licenses: ${L.length} catalog licenses seeded and chosen per model; default and disabling enforced; versions and upgrades only to a later version or more open; terms upgraded by the multisig; two-step handover to a multisig contract; income follows the NFT after a sale and a transfer; ${abiCount} app ABI functions match the compiled contracts.`);
} finally {
  await eip1193.disconnect();
}
