// MIT License — Copyright (c) 2026 Decentralized Science Labs
// GL1F Crypto Web3 API: run any Crypto AI model on GenesisL1 from code (browser or Node 18+), with ethers v6.
//   const gl1f = new GL1FCrypto({ ethers, rpcUrl, registry, runtime, nft });
//   const model = await gl1f.model(42);                                   // title, question, pricing, plans, inputs
//   const inputs = await gl1f.latestInputs(model, { engine });            // the model's inputs on the latest candle
//   const out = await gl1f.predict(model, inputs.valuesQ, { accessKey }); // { scoreQ, probability, via }
// Free and tips models: a free read (predictView). Paid models: an access key with an active plan signs each request
// (predictAccessView, a free read), the admin's wallet signs (predictOwnerView), or a wallet pays per run (predictTx).
import { ABI_REGISTRY, ABI_RUNTIME, ABI_MODELNFT } from "../studio/abis.js";
import { unpackFeatures, profileFromMeta } from "../studio/profile.js";

export const PRICING = ["free", "tips", "paid"];
export const VIEW_TYPES = { AccessView: [{ name: "modelId", type: "bytes32" }, { name: "packedHash", type: "bytes32" }, { name: "deadline", type: "uint256" }] };
export const OWNER_TYPES = { OwnerView: VIEW_TYPES.AccessView };
// Inputs as the runtime receives them: one little-endian int32 per signal.
export function packInputs(valuesQ) {
  const out = new Uint8Array(valuesQ.length * 4), dv = new DataView(out.buffer);
  valuesQ.forEach((q, i) => dv.setInt32(i * 4, Number(q), true));
  return out;
}
// Float signal values to the model's integers (identical to the studio and the on-chain runtime).
export const quantize = (values, scaleQ) => Array.from(values, (v) => Math.max(-2147483648, Math.min(2147483647, Math.round(Math.fround(Number(v)) * scaleQ))));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

export class GL1FCrypto {
  constructor({ ethers, rpcUrl, provider, chainId, registry, runtime, nft }) {
    if (!ethers) throw new Error("Pass the ethers v6 module: new GL1FCrypto({ ethers, ... })");
    if (!registry || !runtime) throw new Error("Pass the registry and runtime addresses (shown in the studio's Web3 API panel)");
    this.e = ethers;
    this.provider = provider || new ethers.JsonRpcProvider(rpcUrl, chainId, chainId ? { staticNetwork: true } : undefined);
    this.registry = new ethers.Contract(registry, [...ABI_REGISTRY, ...(ABI_REGISTRY.some((f) => f.includes("modelNFT()")) ? [] : ["function modelNFT() view returns (address)"])], this.provider);
    this.runtime = new ethers.Contract(runtime, ABI_RUNTIME, this.provider);
    this.nftAddress = nft || null;
  }
  async chainId() { return this._chainId ??= Number((await this.provider.getNetwork()).chainId); }
  async nft() {
    this.nftAddress ||= await this.registry.modelNFT();
    return this._nft ??= new this.e.Contract(this.nftAddress, ABI_MODELNFT, this.provider);
  }
  // Everything needed to call a model: its pricing, plans, scale and the inputs it expects (names and profile).
  async model(tokenId) {
    const s = await this.registry.getModelSummary(tokenId);
    if (!s.exists) throw new Error(`No Crypto AI model #${tokenId}`);
    const nft = await this.nft(), [text, rt, planCount] = await Promise.all([nft.features(tokenId), this.registry.getModelRuntime(s.modelId), this.registry.accessPlanCount(s.modelId).catch(() => 0)]);
    const { meta, features } = unpackFeatures(text), plans = [];
    for (let id = 1; id <= Number(planCount); id++) {
      const p = await this.registry.getAccessPlan(s.modelId, id);
      plans.push({ id, durationBlocks: Number(p.durationBlocks), priceWei: p.priceWei, active: p.active });
    }
    return { tokenId: Number(tokenId), modelId: s.modelId, title: s.title, description: s.description, pricing: PRICING[Number(rt.pricingMode)] || "free",
      pricingMode: Number(rt.pricingMode), feeWei: rt.feeWei, inferenceEnabled: rt.inferenceEnabled, scaleQ: Number(rt.scaleQ), nFeatures: Number(rt.nFeatures),
      featureNames: features, profile: profileFromMeta(meta), report: meta?.report || null, plans };
  }
  // The model's inputs on the latest completed candle, from public exchange data, by the GL1F market engine.
  async latestInputs(model, { engine, asOfMs = null } = {}) {
    if (!engine) throw new Error("Pass an engine: await GL1FCrypto.browserEngine() or await GL1FCrypto.nodeEngine()");
    const p = model.profile;
    if (!p?.label) throw new Error("This model has no market profile; compute its inputs yourself");
    return engine.infer({ mode: asOfMs ? "historical" : "latest", asOfMs, exchange: p.exchange, market: p.symbol, candle: p.candle, features: model.featureNames,
      featureFamily: p.featureFamily || "auto", scaleQ: model.scaleQ, warmupBars: p.warmupBars || null, featureSeedStartMs: p.featureSeedStartMs ?? null,
      basePeriod: p.label.basePeriod, btcSymbol: p.btcContext, cacheCandles: false });
  }
  // Runs the model on GenesisL1. Free/tips: no options. Paid: { accessKey } (private key or ethers Wallet with an active
  // plan), { owner } (the admin's signer) or { payer } (a signer that pays the fee per run in a transaction).
  async predict(model, valuesQ, { accessKey, owner, payer, deadlineSec = 300 } = {}) {
    const m = typeof model === "object" ? model : await this.model(model);
    if (valuesQ.length !== m.nFeatures) throw new Error(`Model #${m.tokenId} takes ${m.nFeatures} inputs, got ${valuesQ.length}`);
    const packed = packInputs(valuesQ), done = (scoreQ, via, extra = {}) => ({ scoreQ: BigInt(scoreQ), probability: sigmoid(Number(scoreQ) / m.scaleQ), via, ...extra });
    if (payer) {
      const tx = await this.runtime.connect(payer).predictTx(m.modelId, packed, { value: m.pricingMode === 2 ? m.feeWei : 0n });
      const receipt = await tx.wait(), ev = receipt.logs.map((l) => { try { return this.runtime.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === "Inference");
      return done(ev.args.scoreQ, "predictTx", { tx: tx.hash });
    }
    if (m.pricingMode !== 2) return done(await this.runtime.predictView(m.modelId, packed), "predictView");
    const deadline = Math.floor(Date.now() / 1000) + deadlineSec;
    const domain = { name: "GenesisL1 Forest", version: "1", chainId: await this.chainId(), verifyingContract: await this.runtime.getAddress() };
    const message = { modelId: m.modelId, packedHash: this.e.keccak256(packed), deadline };
    if (owner) return done(await this.runtime.predictOwnerView(m.modelId, packed, deadline, await owner.signTypedData(domain, OWNER_TYPES, message)), "predictOwnerView");
    if (!accessKey) throw new Error(`Model #${m.tokenId} is paid: pass { accessKey } with an active plan, { owner }, or { payer }`);
    const key = typeof accessKey === "string" ? new this.e.Wallet(accessKey) : accessKey;
    return done(await this.runtime.predictAccessView(m.modelId, packed, deadline, await key.signTypedData(domain, VIEW_TYPES, message)), "predictAccessView");
  }
  // A new access key: keep its private key secret; a plan bought for its address lets it run the model.
  newAccessKey() { const w = this.e.Wallet.createRandom(); return { address: w.address, privateKey: w.privateKey }; }
  async buyAccess(model, planId, keyAddress, signer) {
    const m = typeof model === "object" ? model : await this.model(model), plan = m.plans.find((p) => p.id === Number(planId));
    if (!plan?.active) throw new Error(`Plan ${planId} is not available for model #${m.tokenId}`);
    const tx = await this.registry.connect(signer).buyAccess(m.modelId, plan.id, keyAddress, { value: plan.priceWei });
    await tx.wait();
    return { tx: tx.hash, ...(await this.accessStatus(m, keyAddress)) };
  }
  async accessStatus(model, keyAddress) {
    const m = typeof model === "object" ? model : await this.model(model);
    const [until, block] = await Promise.all([this.registry.accessExpiry(m.modelId, keyAddress), this.provider.getBlockNumber()]);
    const max = 2n ** 64n - 1n;
    return { untilBlock: until === max ? Infinity : Number(until), block, active: until === max || Number(until) >= block };
  }
  // The GL1F market engine in a browser worker (same code as the studio).
  static async browserEngine(url = "https://crypto.gl1f.com/sdk/gl1f-engine.js") {
    const source = await (await fetch(url)).text(), worker = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
    worker.postMessage({ type: "env", worldUrl: null, copyUrl: new URL("data/world.json", new URL(".", new URL("..", url))).href });
    let seq = 0;
    const pending = new Map();
    worker.onmessage = (e) => { const m = e.data || {}, p = pending.get(m.requestId); if (!p) return; if (m.type === "vector") { pending.delete(m.requestId); p.resolve(m); } else if (m.type === "error") { pending.delete(m.requestId); p.reject(new Error(m.message)); } };
    return { infer: (job) => new Promise((resolve, reject) => { const requestId = `sdk-${++seq}`; pending.set(requestId, { resolve, reject }); worker.postMessage({ type: "infer", job, requestId }); }), close: () => worker.terminate() };
  }
  // The same engine in Node 18+ (source: a URL, a file path or the script text).
  static async nodeEngine(source = "https://crypto.gl1f.com/sdk/gl1f-engine.js") {
    const vm = await import("node:vm"), fs = await import("node:fs");
    const code = /^https?:/.test(source) ? await (await fetch(source)).text() : fs.existsSync(source) ? fs.readFileSync(source, "utf8") : source;
    const context = { module: { exports: {} }, self: { postMessage() {} }, postMessage() {}, console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, fetch: globalThis.fetch, AbortController, performance, crypto: globalThis.crypto };
    vm.runInNewContext(code, context);
    const engine = context.module.exports;
    return { infer: (job) => engine.runInference(job), close() {} };
  }
}
export default GL1FCrypto;
