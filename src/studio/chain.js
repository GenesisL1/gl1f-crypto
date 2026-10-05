// MIT License — Copyright (c) 2026 Decentralized Science Labs
// GenesisL1 reads (verified against audited bytecode) and model deployment.
import { ABI_STORE, ABI_REGISTRY, ABI_MODELNFT, ABI_RUNTIME, ABI_MARKET } from "./abis.js";
import { currentProvider, pickWallet, walletRequest, hasWallets, onWalletSelected } from "./wallets.js";
import { GL1FCrypto } from "../sdk/gl1f-crypto.js";
import { decodeModel } from "./local_infer.js";
import { unpackFeatures, profileFromMeta, titleWords } from "./profile.js";
import { describeLicense, staticLicenseCatalog, isReserved } from "./licenses.js";

export const CHUNK_SIZE = 24_000;
const VIEW = Object.freeze({ gasLimit: 2_000_000_000 });
const REGISTRY_ABI = [
  ...ABI_REGISTRY,
  "function tokenIdByModelId(bytes32 modelId) view returns (uint256)",
  "event ModelRegistered(uint256 indexed tokenId, bytes32 indexed modelId, address indexed creator)",
  "function internalsVisibility(uint256) view returns (uint8)",
  "function mintedAt(uint256) view returns (uint64)",
  "function setInternalsVisibility(uint256 tokenId, uint8 visibility) external",
  "function subscribedUntil(bytes32) view returns (uint64)",
];

export function config() {
  const cfg = globalThis.GL1F_RUNTIME;
  if (!cfg?.network) throw new Error("runtime-config.js is missing or incomplete");
  return cfg;
}
export function lib() {
  const e = globalThis.ethers;
  if (!e) throw new Error("The ethers library did not load. Check the connection and reload the page.");
  return e;
}
const SET_KEYS = ["store", "registry", "nft", "runtime"];
// The GL1F Crypto contract set (burnable fees), from runtime-config.js.
export function contractSet(set = "crypto") {
  const cfg = globalThis.GL1F_RUNTIME || {};
  return { set: "crypto", addresses: cfg.contracts || null, hashes: cfg.codeHashes || {} };
}
export function setLive(set = "crypto") {
  const { addresses } = contractSet(set);
  return !!addresses && SET_KEYS.every((k) => /^0x[0-9a-fA-F]{40}$/.test(String(addresses[k] || "")));
}
export function cryptoLive() { return setLive("crypto"); }
export function chainAvailable(set = "crypto") { return !!globalThis.ethers && setLive(set); }
export function explorerTx(hash) { return `${config().network.explorer}/tx/${hash}`; }
// Shareable page per model: GL1F Crypto models get their own page with a preview card on crypto.gl1f.com.
// A model's page: model.html?id=<n>, one static file drawn from the chain, so it works on any static host
// (relative to the linking page, so local copies and staging stay on themselves).
export function modelPage(tokenId, root = "./") {
  const rel = `${root}model.html?id=${Number(tokenId)}`;
  return typeof location !== "undefined" ? new URL(rel, location.href).href : `${config().origin || "https://crypto.gl1f.com"}/model.html?id=${Number(tokenId)}`;
}

let provider = null;
export function readProvider() {
  if (!provider) {
    const e = lib(), cfg = config();
    provider = new e.JsonRpcProvider(cfg.network.rpcUrl, { chainId: cfg.network.chainId, name: "genesisl1" }, { staticNetwork: true });
  }
  return provider;
}

const verified = new Set();
export async function verifyContracts(keys, blockTag = "latest", set = "crypto") {
  const e = lib(), cfg = config(), p = readProvider();
  for (const key of keys) {
    if (verified.has(`${set}:${key}`)) continue;
    const { addresses, hashes } = contractSet(set);
    const address = addresses?.[key], expected = hashes?.[key];
    if (!address) throw new Error(`Contract "${key}" is not configured`);
    const code = await p.getCode(address, blockTag);
    if (!code || code === "0x") throw new Error(`No contract code at ${address}`);
    if (expected && e.keccak256(code).toLowerCase() !== String(expected).toLowerCase()) {
      throw new Error(`The ${key} contract at ${address} does not match the audited deployment`);
    }
    verified.add(`${set}:${key}`);
  }
}

function contracts(runner = readProvider(), set = "crypto") {
  const e = lib(), a = contractSet(set).addresses;
  if (!a) throw new Error(set === "crypto" ? "The GL1F Crypto contracts are not deployed yet" : "GL1F contracts are not configured");
  return {
    store: new e.Contract(a.store, ABI_STORE, runner),
    registry: new e.Contract(a.registry, REGISTRY_ABI, runner),
    nft: new e.Contract(a.nft, ABI_MODELNFT, runner),
    runtime: new e.Contract(a.runtime, ABI_RUNTIME, runner),
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  });
  await Promise.all(workers);
  return out;
}

function pngDataUrl(bytes) {
  try {
    const u8 = lib().getBytes(bytes);
    if (!u8.length) return null;
    let s = "";
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return `data:image/png;base64,${btoa(s)}`;
  } catch { return null; }
}

// One published model, as shown in lists, the marketplace and the admin panel.
// 0 = default (private when paid), 1 = public, 2 = private: how this front-end shows a model's trees, depth and signals.
export const internalsPrivate = (visibility, pricingMode) => visibility === 2 || (visibility !== 1 && Number(pricingMode) === 2);
// A model can be deleted by its admin once no paid subscription is running; the registry enforces the same rule.
// The Web3 API client the studio uses for its API panel: the same helper published at sdk/gl1f-crypto.js.
export function apiClient(set = "crypto") {
  const a = contractSet(set).addresses;
  if (!a) throw new Error("The GL1F Crypto contracts are not deployed yet");
  return new GL1FCrypto({ ethers: lib(), provider: readProvider(), registry: a.registry, runtime: a.runtime, nft: a.nft });
}
export async function apiConfig(set = "crypto") {
  const a = contractSet(set).addresses || {}, p = readProvider();
  let chainId = null; try { chainId = Number((await p.getNetwork()).chainId); } catch { /* offline */ }
  return { rpcUrl: p._getConnection?.().url || "", chainId, registry: a.registry || "", runtime: a.runtime || "", nft: a.nft || "" };
}
export async function walletSigner() {
  let st = await walletState();
  if (!st.onGenesis) { await switchToGenesis(); st = await walletState(); }
  return new (lib().BrowserProvider)(currentProvider() || (await pickWallet()).provider).getSigner();
}
export async function deletionStatus(modelId) {
  const p = readProvider(), { registry } = contracts(p);
  const [until, block] = await Promise.all([registry.subscribedUntil(modelId, VIEW).catch(() => 0n), p.getBlockNumber()]);
  return { untilBlock: Number(until), block, canDelete: block >= Number(until) };
}
export async function deleteModel(tokenId) {
  const w = await writer(["registry"]);
  return done(await w.registry.burnAndDelete(tokenId));
}
export async function setInternalsVisibility(tokenId, visibility) {
  const w = await writer(["registry"]);
  return done(await w.registry.setInternalsVisibility(tokenId, visibility));
}

async function modelItem(registry, nft, id) {
    let s;
    try { s = await registry.getModelSummary(id, VIEW); } catch { return null; }
    if (!s.exists) return null;
    const [featuresText, icon, visibility, minted] = await Promise.all([
      nft.features(id, VIEW).catch(() => ""),
      nft.icon(id, VIEW).catch(() => "0x"),
      registry.internalsVisibility(id, VIEW).catch(() => 0n),
      registry.mintedAt(id, VIEW).catch(() => 0n),
    ]);
    const { meta, features } = unpackFeatures(featuresText);
    return {
      tokenId: id, modelId: s.modelId, title: s.title || `Model #${id}`, description: s.description,
      nFeatures: Number(s.nFeatures), nTrees: Number(s.nTrees), depth: Number(s.depth),
      pricingMode: Number(s.pricingMode), feeWei: s.feeWei, feeRecipient: s.feeRecipient, inferenceEnabled: s.inferenceEnabled, creator: s.creator,
      task: meta?.task || null, meta, featureNames: features, profile: profileFromMeta(meta), icon: pngDataUrl(icon),
      internalsVisibility: Number(visibility), internalsPrivate: internalsPrivate(Number(visibility), Number(s.pricingMode)), mintedAtMs: Number(minted) * 1000, report: meta?.report || null,
    };
}

// Newest first. `before` is the next token ID to read downward from.
export async function listModels({ before = null, limit = 12, set = "crypto" } = {}) {
  await verifyContracts(["registry", "nft"], "latest", set);
  const { registry, nft } = contracts(readProvider(), set);
  const total = Number(await nft.totalMinted(VIEW));
  const from = before === null ? total : before;
  const ids = [];
  for (let id = from; id >= 1 && ids.length < limit; id--) ids.push(id);
  const items = await mapLimit(ids, 6, (id) => modelItem(registry, nft, id));
  return { total, next: from - ids.length, items: items.filter(Boolean) };
}

function stripGl1c(codeHex, context) {
  const bytes = lib().getBytes(codeHex);
  if (bytes.length < 4 || String.fromCharCode(...bytes.slice(0, 4)) !== "GL1C") throw new Error(`${context} does not begin with GL1C`);
  return bytes.slice(4);
}

// Reconstruct and verify the exact model bytes committed by the registry.
export async function loadChainModel(tokenId, onProgress = () => {}, set = "crypto") {
  const e = lib(), p = readProvider();
  onProgress(0.03, "Pinning a block");
  const block = await p.getBlock("latest");
  const blockTag = block.number;
  onProgress(0.06, "Verifying contracts");
  await verifyContracts(["registry", "nft", "runtime"], blockTag, set);
  const { registry, nft } = contracts(readProvider(), set);
  const at = { blockTag, ...VIEW };
  const summary = await registry.getModelSummary(BigInt(tokenId), at);
  if (!summary.exists) throw new Error(`Model #${tokenId} is not active`);
  const modelId = summary.modelId;
  const [runtimeInfo, bytesInfo, featuresText] = await Promise.all([
    registry.getModelRuntime(modelId, at), registry.getModelBytesInfo(modelId, at), nft.features(BigInt(tokenId), at),
  ]);
  const chunkSize = Number(bytesInfo.chunkSize), numChunks = Number(bytesInfo.numChunks), totalBytes = Number(bytesInfo.totalBytes);
  if (!chunkSize || !numChunks || numChunks !== Math.ceil(totalBytes / chunkSize) || totalBytes > 20_000_000) throw new Error("On-chain byte layout is outside the supported profile");
  onProgress(0.1, "Reading pointer table");
  const table = stripGl1c(await p.getCode(bytesInfo.tablePtr, blockTag), "Pointer table");
  if (table.length !== numChunks * 32) throw new Error("Pointer table length does not match the chunk count");
  const pointers = [];
  for (let i = 0; i < numChunks; i++) {
    const slot = table.slice(i * 32, i * 32 + 32);
    if (slot.slice(0, 12).some(Boolean)) throw new Error(`Pointer ${i} is malformed`);
    pointers.push(e.hexlify(slot.slice(12)));
  }
  let done = 0;
  const chunks = await mapLimit(pointers, 5, async (address, index) => {
    const payload = stripGl1c(await p.getCode(address, blockTag), `Chunk ${index + 1}`);
    const expected = Math.min(chunkSize, totalBytes - index * chunkSize);
    if (payload.length !== expected) throw new Error(`Chunk ${index + 1} has ${payload.length} bytes; expected ${expected}`);
    onProgress(0.1 + 0.8 * (++done / numChunks), `Verified ${done} of ${numChunks} chunks`);
    return payload;
  });
  const core = new Uint8Array(totalBytes);
  chunks.forEach((chunk, i) => core.set(chunk, i * chunkSize));
  if (e.keccak256(core).toLowerCase() !== modelId.toLowerCase()) throw new Error("Reconstructed bytes do not match the registry commitment");
  const decoded = decodeModel(core);
  const checks = [
    ["features", Number(runtimeInfo.nFeatures), decoded.nFeatures], ["trees", Number(runtimeInfo.nTrees), decoded.nTrees],
    ["depth", Number(runtimeInfo.depth), decoded.depth], ["scaleQ", Number(runtimeInfo.scaleQ), decoded.scaleQ],
  ];
  for (const [name, a, b] of checks) if (a !== b) throw new Error(`On-chain ${name} (${a}) disagrees with the model bytes (${b})`);
  const { meta, features } = unpackFeatures(featuresText);
  if (features.length !== decoded.nFeatures) throw new Error(`The NFT lists ${features.length} features but the model needs ${decoded.nFeatures}`);
  onProgress(1, "Model verified");
  return {
    core, decoded, modelId, meta, featureNames: features, profile: profileFromMeta(meta),
    title: summary.title || `Model #${tokenId}`, description: summary.description,
    chain: {
      tokenId: String(tokenId), blockNumber: block.number, blockHash: block.hash,
      pricingMode: Number(runtimeInfo.pricingMode), feeWei: runtimeInfo.feeWei.toString(), inferenceEnabled: runtimeInfo.inferenceEnabled,
    },
  };
}

export function packQ(valuesQ) {
  const out = new Uint8Array(valuesQ.length * 4), dv = new DataView(out.buffer);
  valuesQ.forEach((q, i) => dv.setInt32(i * 4, q, true));
  return out;
}

export async function predictOnChain(modelId, valuesQ, blockTag = "latest", set = "crypto") {
  await verifyContracts(["runtime"], "latest", set);
  const { runtime } = contracts(readProvider(), set);
  const block = blockTag === "latest" ? (await readProvider().getBlock("latest")).number : blockTag;
  const score = await runtime.predictView(modelId, packQ(valuesQ), { blockTag: block, ...VIEW });
  return { scoreQ: BigInt(score), blockNumber: block };
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export function hasWallet() { return hasWallets(); }

export async function walletState() {
  if (!hasWallet()) return { available: false, address: null, chainId: null, onGenesis: false };
  const [accounts, chainHex] = await Promise.all([
    (currentProvider() ? walletRequest(currentProvider(), { method: "eth_accounts" }, 8000) : Promise.resolve([])).catch(() => []),
    (currentProvider() ? walletRequest(currentProvider(), { method: "eth_chainId" }, 8000) : Promise.resolve(null)).catch(() => null),
  ]);
  const chainId = chainHex ? Number(BigInt(chainHex)) : null;
  return { available: true, address: accounts?.[0] || null, chainId, onGenesis: chainId === config().network.chainId };
}

export async function connectWallet() {
  if (!hasWallet()) throw new Error("No EVM wallet found. Install MetaMask or a compatible wallet.");
  await walletRequest((await pickWallet()).provider, { method: "eth_requestAccounts" });
  return walletState();
}

export async function switchToGenesis() {
  const cfg = config(), chainId = `0x${cfg.network.chainId.toString(16)}`;
  try {
    await walletRequest(currentProvider() || (await pickWallet()).provider, { method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if (error?.code !== 4902 && error?.data?.originalError?.code !== 4902) throw error;
    await walletRequest(currentProvider() || (await pickWallet()).provider, {
      method: "wallet_addEthereumChain",
      params: [{
        chainId, chainName: cfg.network.name,
        nativeCurrency: cfg.network.currency || { name: "L1 coin", symbol: "L1", decimals: 18 },
        rpcUrls: [cfg.network.rpcUrl], blockExplorerUrls: [cfg.network.explorer],
      }],
    });
  }
  return walletState();
}

export function onWalletChange(callback) {
  // Follows the chosen wallet: listeners move when the person picks another one.
  let attached = null;
  const attach = () => {
    const p = currentProvider();
    if (p === attached) return;
    if (attached?.removeListener) { attached.removeListener("accountsChanged", callback); attached.removeListener("chainChanged", callback); }
    attached = p;
    if (p?.on) { p.on("accountsChanged", callback); p.on("chainChanged", callback); }
  };
  attach();
  onWalletSelected(() => { attach(); callback(); });
}

// ---------------------------------------------------------------------------
// Deployment
// ---------------------------------------------------------------------------

export async function deployTerms(totalBytes) {
  if (!cryptoLive()) throw new Error("The GL1F Crypto contracts are not deployed yet");
  await verifyContracts(["registry"]);
  const { registry } = contracts();
  const [feeWei, tosVersion, catalog] = await Promise.all([registry.requiredDeployFeeWei(totalBytes, VIEW), registry.tosVersion(VIEW), licenseCatalog("crypto")]);
  return { feeWei: BigInt(feeWei), tosVersion: Number(tosVersion), licenseId: catalog.defaultId, license: catalog.items.find((l) => l.id === catalog.defaultId) || null,
    licenses: catalog.items, chunks: Math.ceil(totalBytes / CHUNK_SIZE) };
}

// ---------- Licenses ----------
// The registry's license catalog: every entry, whether new models may use it, and the global default.
// Before the contracts are live: the catalog the deployment will write on-chain, in the same order.
export async function licenseCatalog(set = "crypto") {
  if (!globalThis.ethers || !setLive(set)) return staticLicenseCatalog();
  await verifyContracts(["registry"], "latest", set);
  const { registry } = contracts(readProvider(), set);
  const [count, defaultId] = await Promise.all([registry.licenseCount(VIEW), registry.activeLicenseId(VIEW)]);
  const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
  const items = await mapLimit(ids, 8, async (id) => {
    const l = await registry.getLicenseInfo(id, VIEW);
    return describeLicense({ id, name: l.name, url: l.url, spdx: l.spdx, selectable: l.selectable, openness: Number(l.openness), supersedes: Number(l.supersedes) });
  });
  return { live: true, defaultId: Number(defaultId), items };
}
// The license a published model was minted under.
async function modelLicense(registry, tokenId, modelId) {
  try { const l = await registry.licenseOf(tokenId, VIEW); return describeLicense({ id: Number(l.id), name: l.name, url: l.url, spdx: l.spdx, openness: Number(l.openness), sinceBlock: Number(l.sinceBlock) }); } catch {}
  try {
    const id = Number((await registry.models(modelId, VIEW)).licenseIdAccepted);
    if (!id) return null;
    const l = await registry.getLicense(id, VIEW);
    return describeLicense({ id, name: l.name, url: l.url, spdx: "" });
  } catch { return null; }
}
// Whether this browser may run a published model itself, under its license. A model under a reserved license (all
// rights reserved, such as the GL1F On-Chain Use License) runs off-chain only while it is free to run, or for its
// admin and holders of active access; for anyone else it can be used only through the on-chain runtime.
export async function localRunPermission(tokenId, set = "crypto") {
  await verifyContracts(["registry", "nft"], "latest", set);
  const { registry, nft } = contracts(readProvider(), set);
  const s = await registry.getModelSummary(tokenId, VIEW);
  const license = await modelLicense(registry, Number(tokenId), s.modelId);
  if (!isReserved(license) || Number(s.pricingMode) !== 2) return { ok: true, license };
  let me = null;
  try { me = (await walletState()).address || null; } catch {}
  if (me) {
    const [owner, until, block] = await Promise.all([nft.ownerOf(tokenId, VIEW), registry.accessExpiry(s.modelId, me, VIEW), readProvider().getBlockNumber()]);
    if (owner.toLowerCase() === me.toLowerCase() || Number(until) > block) return { ok: true, license };
  }
  return { ok: false, license };
}
// The Terms of Service in force, as recorded in the registry (null before the contracts are live).
export async function termsOnChain() {
  if (!globalThis.ethers || !cryptoLive()) return null;
  await verifyContracts(["registry"]);
  const { registry } = contracts();
  const [version, hash, text] = await Promise.all([registry.tosVersion(VIEW), registry.tosHash(VIEW), registry.tosText(VIEW)]);
  return { version: Number(version), hash, text };
}
// Who holds the protocol settings of the GL1F Crypto registry and marketplace, and any handover in progress.
export async function protocolOwners() {
  if (!globalThis.ethers || !cryptoLive()) return null;
  const e = lib(), a = contractSet("crypto").addresses, p = readProvider();
  const abi = ["function owner() view returns (address)", "function pendingOwner() view returns (address)"];
  const read = async (address) => {
    const c = new e.Contract(address, abi, p);
    const [owner, pending] = await Promise.all([c.owner(VIEW), c.pendingOwner(VIEW).catch(() => ZERO_ADDRESS)]);
    return { owner, pending: /^0x0+$/.test(pending) ? null : pending };
  };
  return { registry: await read(a.registry), market: a.market ? await read(a.market) : null };
}

export async function registeredTokenId(modelId) {
  await verifyContracts(["registry"]);
  return BigInt(await contracts().registry.tokenIdByModelId(modelId, VIEW));
}

export async function deployModel({ bytes, modelId, decoded, title, description, iconBytes, featuresPacked, pricingMode, feeWei, recipient, ownerKey, licenseId, resume, onStep }) {
  const e = lib(), cfg = config();
  const state = await walletState();
  if (!state.address) throw new Error("Connect a wallet first");
  if (!state.onGenesis) throw new Error(`Switch the wallet to ${cfg.network.name}`);
  await verifyContracts(["store", "registry", "nft", "runtime"]);
  if (e.keccak256(bytes).toLowerCase() !== modelId.toLowerCase()) throw new Error("Model bytes do not match the model ID");
  if (await registeredTokenId(modelId) > 0n) throw new Error("This exact model is already registered on GenesisL1");
  // The license is checked before anything is stored, and again right before registration.
  const pre = await deployTerms(bytes.length), wanted = Number(licenseId ?? pre.licenseId);
  const usable = (t) => !!t.licenses.find((l) => l.id === wanted)?.selectable;
  if (!usable(pre)) throw new Error("The chosen license is not open to new models; pick another one");
  const signer = await new e.BrowserProvider(currentProvider() || (await pickWallet()).provider).getSigner();
  if (!cryptoLive()) throw new Error("The GL1F Crypto contracts are not deployed yet");
  const { store, registry } = contracts(signer);
  const iface = new e.Interface(ABI_STORE);
  const pointerOf = (receipt) => {
    for (const log of receipt.logs) {
      try { const parsed = iface.parseLog(log); if (parsed?.name === "ChunkWritten") return parsed.args.pointer; } catch {}
    }
    throw new Error("The store did not emit ChunkWritten");
  };
  const chunks = [];
  for (let off = 0; off < bytes.length; off += CHUNK_SIZE) chunks.push(bytes.slice(off, off + CHUNK_SIZE));
  const progress = resume?.modelId === modelId ? resume : { modelId, pointers: [], tablePtr: null, txs: [] };

  for (let i = 0; i < chunks.length; i++) {
    const id = `chunk-${i}`, label = `Store chunk ${i + 1} of ${chunks.length}`;
    if (i < progress.pointers.length) { onStep({ id, label, status: "ok", hash: progress.txs[i] }); continue; }
    onStep({ id, label, status: "run" });
    const tx = await store.write(chunks[i], { gasLimit: 30_000_000 });
    onStep({ id, label, status: "run", hash: tx.hash });
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error(`${label} failed`);
    progress.pointers.push(pointerOf(receipt)); progress.txs.push(tx.hash);
    onStep({ id, label, status: "ok", hash: tx.hash });
  }
  if (!progress.tablePtr) {
    const id = "table", label = "Store pointer table";
    onStep({ id, label, status: "run" });
    const table = new Uint8Array(progress.pointers.length * 32);
    progress.pointers.forEach((pointer, i) => table.set(e.getBytes(pointer), i * 32 + 12));
    const tx = await store.write(table, { gasLimit: 30_000_000 });
    onStep({ id, label, status: "run", hash: tx.hash });
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error("Pointer table transaction failed");
    progress.tablePtr = pointerOf(receipt); progress.tableTx = tx.hash;
    onStep({ id, label, status: "ok", hash: tx.hash });
  } else onStep({ id: "table", label: "Store pointer table", status: "ok", hash: progress.tableTx });

  const terms = await deployTerms(bytes.length);
  if (!usable(terms)) throw new Error("The chosen license was closed to new models in the meantime; pick another one");
  const id = "register", label = "Register and mint Model NFT";
  onStep({ id, label, status: "run" });
  const tx = await registry.registerModel(
    modelId, progress.tablePtr, CHUNK_SIZE, chunks.length, bytes.length,
    decoded.nFeatures, decoded.nTrees, decoded.depth, decoded.baseQ, decoded.scaleQ,
    title, description, iconBytes, featuresPacked,
    titleWords(title).map((w) => e.keccak256(e.toUtf8Bytes(w))),
    pricingMode, feeWei, recipient || state.address, terms.tosVersion, wanted, ownerKey,
    { value: terms.feeWei, gasLimit: 35_000_000 },
  );
  onStep({ id, label, status: "run", hash: tx.hash });
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("Registration transaction failed");
  const regIface = new e.Interface(REGISTRY_ABI);
  let tokenId = null;
  for (const log of receipt.logs) {
    try { const parsed = regIface.parseLog(log); if (parsed?.name === "ModelRegistered") { tokenId = parsed.args.tokenId.toString(); break; } } catch {}
  }
  if (!tokenId) tokenId = (await registeredTokenId(modelId)).toString();
  onStep({ id, label, status: "ok", hash: tx.hash });
  return { tokenId, registerTx: tx.hash, progress };
}

// ---------- Burnable protocol fees (GL1F Crypto contracts) ----------
const FEES_REGISTRY_ABI = [
  "function deployFeeWei() view returns (uint256)", "function sizeFeeWeiPerByte() view returns (uint256)",
  "function totalCreationFeesWei() view returns (uint256)", "function totalSizeFeesWei() view returns (uint256)",
  "function totalFeesBurnedWei() view returns (uint256)", "function pendingBurnWei() view returns (uint256)",
  "function burnCount() view returns (uint256)", "function totalBytesRegistered() view returns (uint256)",
  "function BURN_ADDRESS() view returns (address)", "function burnFees() returns (uint256)",
];
const FEES_MARKET_ABI = [
  "function listingFeeWei() view returns (uint256)", "function totalListingFeesWei() view returns (uint256)",
  "function totalFeesBurnedWei() view returns (uint256)", "function pendingBurnWei() view returns (uint256)",
  "function burnCount() view returns (uint256)", "function burnFees() returns (uint256)",
];

export async function feeStats() {
  if (!cryptoLive()) return null;
  const e = lib(), p = readProvider(), a = contractSet("crypto").addresses;
  await verifyContracts(a.market ? ["registry", "nft", "market"] : ["registry", "nft"]);
  const block = await p.getBlockNumber(), o = { blockTag: block, ...VIEW };
  const reg = new e.Contract(a.registry, FEES_REGISTRY_ABI, p), nft = new e.Contract(a.nft, ABI_MODELNFT, p);
  const [creationFeeWei, sizeFeeWeiPerByte, creationWei, sizeWei, burnedWei, pendingWei, burns, bytes, minted, burnAddress] = await Promise.all([
    reg.deployFeeWei(o), reg.sizeFeeWeiPerByte(o), reg.totalCreationFeesWei(o), reg.totalSizeFeesWei(o), reg.totalFeesBurnedWei(o),
    reg.pendingBurnWei(o), reg.burnCount(o), reg.totalBytesRegistered(o), nft.totalMinted(o), reg.BURN_ADDRESS(o),
  ]);
  let market = null;
  if (a.market) {
    const m = new e.Contract(a.market, FEES_MARKET_ABI, p);
    const [listingFeeWei, listingWei, mBurnedWei, mPendingWei, mBurns] = await Promise.all([m.listingFeeWei(o), m.totalListingFeesWei(o), m.totalFeesBurnedWei(o), m.pendingBurnWei(o), m.burnCount(o)]);
    market = { listingFeeWei, collectedWei: listingWei, burnedWei: mBurnedWei, pendingWei: mPendingWei, burns: Number(mBurns) };
  }
  return {
    block, burnAddress, minted: Number(minted),
    registry: { creationFeeWei, sizeFeeWeiPerByte, creationWei, sizeWei, collectedWei: creationWei + sizeWei, burnedWei, pendingWei, burns: Number(burns), bytes: Number(bytes) },
    market,
  };
}

export async function modelStats(set = "crypto", { max = 500, onProgress = () => {} } = {}) {
  await verifyContracts(["registry", "nft"], "latest", set);
  const { registry, nft } = contracts(readProvider(), set);
  const total = Number(await nft.totalMinted(VIEW));
  const ids = [];
  for (let id = total; id >= 1 && ids.length < max; id--) ids.push(id);
  let done = 0;
  const rows = (await mapLimit(ids, 8, async (id) => {
    try {
      const s = await registry.getModelSummary(id, VIEW);
      return s.exists ? { tokenId: id, title: s.title || `Model #${id}`, pricingMode: Number(s.pricingMode), feeWei: s.feeWei, enabled: s.inferenceEnabled, nTrees: Number(s.nTrees), depth: Number(s.depth), nFeatures: Number(s.nFeatures), creator: String(s.creator) } : null;
    } catch { return null; } finally { onProgress(++done / Math.max(1, ids.length)); }
  })).filter(Boolean);
  const count = (f) => rows.filter(f).length;
  return {
    total, scanned: ids.length, live: rows.length, removed: ids.length - rows.length,
    free: count((r) => r.pricingMode === 0), tips: count((r) => r.pricingMode === 1), paid: count((r) => r.pricingMode === 2),
    enabled: count((r) => r.enabled), creators: new Set(rows.map((r) => r.creator.toLowerCase())).size,
    trees: rows.reduce((a, r) => a + r.nTrees, 0), latest: rows.slice(0, 10),
  };
}

// Anyone can call. Sends everything the contract holds to the burn address.
export async function burnFees(which = "registry") {
  if (!cryptoLive()) throw new Error("The GL1F Crypto contracts are not deployed yet");
  const e = lib(), a = contractSet("crypto").addresses, key = which === "market" ? "market" : "registry";
  if (!a[key]) throw new Error(`No ${key} contract configured`);
  let st = await walletState();
  if (!st.available) throw new Error("No browser wallet found");
  if (!st.address) { await connectWallet(); st = await walletState(); }
  if (!st.onGenesis) { await switchToGenesis(); st = await walletState(); }
  await verifyContracts([key]);
  const signer = await new e.BrowserProvider(currentProvider() || (await pickWallet()).provider).getSigner();
  const c = new e.Contract(a[key], key === "market" ? FEES_MARKET_ABI : FEES_REGISTRY_ABI, signer);
  const pending = await c.pendingBurnWei();
  if (pending === 0n) throw new Error("Nothing to burn right now");
  const receipt = await (await c.burnFees()).wait();
  return { hash: receipt.hash, amountWei: pending };
}

// ---------------- Model admin, subscriptions and marketplace ----------------
// The owner of the Model NFT is the model admin: only that address can change inference access,
// fees, the fee recipient and subscription plans, or list the model for sale. A buyer becomes the new admin.
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
function marketRead(set) {
  const a = contractSet(set).addresses;
  if (!a?.market) throw new Error("No marketplace contract configured");
  return new (lib().Contract)(a.market, ABI_MARKET, readProvider());
}
async function writer(keys) {
  if (!cryptoLive()) throw new Error("Trading and model admin open when the GL1F Crypto contracts go live");
  let st = await walletState();
  if (!st.available) throw new Error("No browser wallet found");
  if (!st.address) { await connectWallet(); st = await walletState(); }
  if (!st.onGenesis) { await switchToGenesis(); st = await walletState(); }
  await verifyContracts(keys);
  const signer = await new (lib().BrowserProvider)(currentProvider() || (await pickWallet()).provider).getSigner();
  const a = contractSet("crypto").addresses, e = lib();
  return { signer, me: await signer.getAddress(), a,
    registry: new e.Contract(a.registry, ABI_REGISTRY, signer), nft: new e.Contract(a.nft, ABI_MODELNFT, signer), market: a.market ? new e.Contract(a.market, ABI_MARKET, signer) : null };
}
const done = async (tx) => (await tx.wait()).hash;

// Average block time, measured on-chain, to turn plan durations in days into blocks.
export async function blockTimeSec() {
  const p = readProvider(), latest = await p.getBlock("latest");
  const back = await p.getBlock(Math.max(1, latest.number - 20_000));
  const dt = (latest.timestamp - back.timestamp) / Math.max(1, latest.number - back.number);
  return dt > 0.2 && dt < 120 ? dt : 6;
}
export async function modelDetails(tokenId, set = "crypto") {
  await verifyContracts(["registry", "nft"], "latest", set);
  const { registry, nft } = contracts(readProvider(), set);
  const item = await modelItem(registry, nft, Number(tokenId));
  if (!item) throw new Error(`Model #${tokenId} does not exist`);
  const [owner, count, license] = await Promise.all([nft.ownerOf(tokenId, VIEW), registry.accessPlanCount(item.modelId, VIEW), modelLicense(registry, Number(tokenId), item.modelId)]);
  const plans = [];
  for (let id = 1; id <= Number(count); id++) {
    const plan = await registry.getAccessPlan(item.modelId, id, VIEW);
    plans.push({ id, durationBlocks: Number(plan.durationBlocks), priceWei: plan.priceWei, active: plan.active });
  }
  let listing = { listed: false, priceWei: 0n, seller: null };
  try { const l = await marketRead(set).getListing(tokenId, VIEW); listing = { listed: l.listed, priceWei: l.priceWei, seller: l.seller }; } catch {}
  return { ...item, owner, plans, listing, license };
}
// Marketplace listings for the given models only (the ones on screen): tokenId -> { listed, priceWei, seller }.
export async function listingsFor(tokenIds, set = "crypto") {
  const out = new Map();
  if (!tokenIds.length || !contractSet(set).addresses?.market) return out;
  await mapLimit(tokenIds, 6, async (id) => {
    try { const l = await marketRead(set).getListing(id, VIEW); if (l.listed) out.set(Number(id), { listed: true, priceWei: l.priceWei, seller: l.seller }); } catch { /* not listed */ }
  });
  return out;
}
export async function listingsPage({ cursor = 0, limit = 24, set = "crypto" } = {}) {
  await verifyContracts(["registry", "nft", "market"], "latest", set);
  const r = await marketRead(set).getListingsPage(cursor, limit, VIEW);
  const { registry, nft } = contracts(readProvider(), set);
  const rows = r.tokenIds.map((id, k) => ({ tokenId: Number(id), priceWei: r.prices[k], seller: r.sellers[k] }));
  const items = await mapLimit(rows, 6, async (row) => { const it = await modelItem(registry, nft, row.tokenId).catch(() => null); return it && { ...it, listing: { listed: true, priceWei: row.priceWei, seller: row.seller } }; });
  return { items: items.filter(Boolean), next: Number(r.nextCursor) };
}
export async function listingFee(set = "crypto") { return marketRead(set).listingFeeWei(VIEW); }
export async function ownedModels(address, { set = "crypto", max = 60 } = {}) {
  await verifyContracts(["registry", "nft"], "latest", set);
  const { registry, nft } = contracts(readProvider(), set);
  const n = Math.min(max, Number(await nft.balanceOf(address, VIEW)));
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(Number(await nft.tokenOfOwnerByIndex(address, i, VIEW)));
  return (await mapLimit(ids, 6, (id) => modelItem(registry, nft, id))).filter(Boolean);
}
export async function saveModelSettings({ tokenId, enabled, pricingMode, feeWei, recipient }) {
  const w = await writer(["registry", "nft"]);
  if ((await w.nft.ownerOf(tokenId)).toLowerCase() !== w.me.toLowerCase()) throw new Error("Only the model owner (the model admin) can change its settings");
  return { hash: await done(await w.registry.updateModelSettings(tokenId, !!enabled, pricingMode, pricingMode === 0 ? 0n : feeWei, recipient || w.me)) };
}
export async function changeModelLicense({ tokenId, licenseId }) {
  const w = await writer(["registry", "nft"]);
  if ((await w.nft.ownerOf(tokenId)).toLowerCase() !== w.me.toLowerCase()) throw new Error("Only the model owner (the model admin) can change its license");
  return { hash: await done(await w.registry.changeModelLicense(tokenId, licenseId)) };
}
export async function saveAccessPlan({ modelId, planId = 0, durationBlocks, priceWei, active = true }) {
  const w = await writer(["registry"]);
  if (!(durationBlocks > 0 && durationBlocks < 2 ** 32)) throw new Error("Plan duration is out of range");
  const tx = planId ? await w.registry.setAccessPlan(modelId, planId, durationBlocks, priceWei, !!active) : await w.registry.createAccessPlan(modelId, durationBlocks, priceWei, !!active);
  return { hash: await done(tx) };
}
export async function buyAccessPlan({ modelId, planId, priceWei, key }) {
  const w = await writer(["registry"]);
  return { hash: await done(await w.registry.buyAccess(modelId, planId, key || w.me, { value: priceWei })) };
}
export async function accessUntil(modelId, key, set = "crypto") {
  const { registry } = contracts(readProvider(), set);
  return Number(await registry.accessExpiry(modelId, key, VIEW));
}
export async function listForSale({ tokenId, priceWei }) {
  const w = await writer(["nft", "market"]);
  if ((await w.nft.ownerOf(tokenId)).toLowerCase() !== w.me.toLowerCase()) throw new Error("Only the model owner can list it");
  const hashes = [], market = w.a.market;
  const approved = (await w.nft.getApproved(tokenId)).toLowerCase() === market.toLowerCase() || (await w.nft.isApprovedForAll(w.me, market));
  if (!approved) hashes.push(await done(await w.nft.approve(market, tokenId)));
  const feeWei = await w.market.listingFeeWei();
  hashes.push(await done(await w.market.list(tokenId, priceWei, { value: feeWei })));
  return { hashes, feeWei };
}
export async function cancelListing(tokenId) {
  const w = await writer(["market"]);
  return { hash: await done(await w.market.cancel(tokenId)) };
}
export async function buyListing({ tokenId, priceWei }) {
  const w = await writer(["market"]);
  const l = await w.market.getListing(tokenId);
  if (!l.listed) throw new Error("This model is no longer for sale");
  if (l.priceWei !== BigInt(priceWei)) throw new Error("The price changed; refresh and check it again");
  return { hash: await done(await w.market.buy(tokenId, { value: l.priceWei })) };
}
export { ZERO_ADDRESS };
