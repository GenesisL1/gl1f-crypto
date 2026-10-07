// src/studio/abis.js
var ABI_REGISTRY = [
  "function deployFeeWei() view returns (uint256)",
  "function sizeFeeWeiPerByte() view returns (uint256)",
  "function requiredDeployFeeWei(uint32 totalBytes) view returns (uint256)",
  "function activeLicenseId() view returns (uint32)",
  "function getLicense(uint256 id) view returns (string name, string url)",
  "function licenseCount() view returns (uint32)",
  "function getLicenseInfo(uint32 id) view returns (string name, string url, string spdx, bool selectable, uint8 openness, uint32 supersedes)",
  "function changeModelLicense(uint256 tokenId, uint32 newId) external",
  "function setInternalsVisibility(uint256 tokenId, uint8 visibility) external",
  "function burnAndDelete(uint256 tokenId) external",
  "function subscribedUntil(bytes32) view returns (uint64)",
  "function ownerKeyHolder(bytes32, address) view returns (address)",
  "event ModelBurned(uint256 indexed tokenId, bytes32 indexed modelId)",
  "function internalsVisibility(uint256) view returns (uint8)",
  "function mintedAt(uint256) view returns (uint64)",
  "event InternalsVisibilitySet(uint256 indexed tokenId, uint8 visibility)",
  "function licenseOf(uint256 tokenId) view returns (uint32 id, string name, string url, string spdx, uint8 openness, uint64 sinceBlock)",
  "function payoutAddressOf(uint256 tokenId) view returns (address)",
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
  "function models(bytes32 modelId) view returns (bool exists, bool active, bytes32 modelId, address tablePtr, uint32 chunkSize, uint32 numChunks, uint32 totalBytes, uint16 nFeatures, uint16 nTrees, uint16 depth, int32 baseQ, uint32 scaleQ, bool inferenceEnabled, uint8 pricingMode, uint256 feeWei, address feeRecipient, address creator, uint32 tosVersionAccepted, uint32 licenseIdAccepted, uint256 tokenId)",
  "function tosVersion() view returns (uint32)",
  "function tosHash() view returns (bytes32)",
  "function tosText() view returns (string)",
  "function creatorOf(uint256 tokenId) view returns (address)",
  "function getModelSummary(uint256 tokenId) view returns (bool exists, bytes32 modelId, address tablePtr, uint16 nFeatures, uint16 nTrees, uint16 depth, int32 baseQ, uint8 pricingMode, uint256 feeWei, address feeRecipient, bool inferenceEnabled, address creator, uint32 tosVersionAccepted, string title, string description)",
  "function getModelBytesInfo(bytes32 modelId) view returns (address tablePtr, uint32 chunkSize, uint32 numChunks, uint32 totalBytes)",
  "function getModelRuntime(bytes32 modelId) view returns (address tablePtr, uint32 chunkSize, uint32 numChunks, uint32 totalBytes, uint16 nFeatures, uint16 nTrees, uint16 depth, int32 baseQ, uint32 scaleQ, bool inferenceEnabled, uint8 pricingMode, uint256 feeWei, address feeRecipient)",
  "function searchTitleWords(bytes32[] words, uint256 cursor, uint256 limit) view returns (uint256[] tokenIds, uint256 nextCursor)",
  "function updateModelSettings(uint256 tokenId, bool enabled, uint8 pricingMode, uint256 feeWei, address recipient) external",
  "function registerModel(bytes32 modelId, address tablePtr, uint32 chunkSize, uint32 numChunks, uint32 totalBytes, uint16 nFeatures, uint16 nTrees, uint16 depth, int32 baseQ, uint32 scaleQ, string title, string description, bytes iconPng32, string featuresPacked, bytes32[] titleWordHashes, uint8 pricingMode, uint256 feeWei, address recipient, uint32 tosVersionAccepted, uint32 licenseIdAccepted, address ownerKey) payable external",
  "function accessPlanCount(bytes32 modelId) view returns (uint8)",
  "function accessExpiry(bytes32 modelId, address key) view returns (uint64)",
  "function getAccessPlan(bytes32 modelId, uint8 planId) view returns (uint32 durationBlocks, uint256 priceWei, bool active)",
  "function createAccessPlan(bytes32 modelId, uint32 durationBlocks, uint256 priceWei, bool active) external returns (uint8 planId)",
  "function setAccessPlan(bytes32 modelId, uint8 planId, uint32 durationBlocks, uint256 priceWei, bool active) external",
  "function buyAccess(bytes32 modelId, uint8 planId, address key) payable external returns (uint64 newExpiry)",
  "function setOwnerAccessKey(bytes32 modelId, address key) external",
  "function revokeAccessKey(bytes32 modelId, address key) external"
];
var ABI_MODELNFT = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  // --- ERC-721 approvals (required for Ai store listings) ---
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function approve(address to, uint256 tokenId) external",
  "function setApprovalForAll(address operator, bool approved) external",
  "function icon(uint256 tokenId) view returns (bytes)",
  "function title(uint256 tokenId) view returns (string)",
  "function description(uint256 tokenId) view returns (string)",
  "function features(uint256 tokenId) view returns (string)"
];
var ABI_RUNTIME = [
  "function predictView(bytes32 modelId, bytes packedFeaturesQ) view returns (int256)",
  "function predictOwnerView(bytes32 modelId, bytes packedFeaturesQ, uint256 deadline, bytes signature) view returns (int256)",
  "function predictTx(bytes32 modelId, bytes packedFeaturesQ) payable returns (int256)",
  "event Inference(bytes32 indexed modelId, address indexed caller, int256 scoreQ, uint256 valueWei)",
  "function predictAccessView(bytes32 modelId, bytes packedFeaturesQ, uint256 deadline, bytes sig) view returns (int256)",
  // Multiclass classification (model format v2)
  "function predictClassView(bytes32 modelId, bytes packedFeaturesQ) view returns (uint16 classIndex, int256 bestScoreQ)",
  "function predictClassOwnerView(bytes32 modelId, bytes packedFeaturesQ, uint256 deadline, bytes signature) view returns (uint16 classIndex, int256 bestScoreQ)",
  "function predictClassTx(bytes32 modelId, bytes packedFeaturesQ) payable returns (uint16 classIndex, int256 bestScoreQ)",
  "event InferenceClass(bytes32 indexed modelId, address indexed caller, uint16 classIndex, int256 bestScoreQ, uint256 valueWei)",
  "function predictClassAccessView(bytes32 modelId, bytes packedFeaturesQ, uint256 deadline, bytes sig) view returns (uint16 classIndex, int256 bestScoreQ)",
  // Vector-output (model format v2). Used for multilabel classification.
  // Returns logitsQ per label; UI applies sigmoid(logitQ/scaleQ) for probabilities.
  "function predictMultiView(bytes32 modelId, bytes packedFeaturesQ) view returns (int256[] logitsQ)",
  "function predictMultiOwnerView(bytes32 modelId, bytes packedFeaturesQ, uint256 deadline, bytes signature) view returns (int256[] logitsQ)",
  "function predictMultiTx(bytes32 modelId, bytes packedFeaturesQ) payable returns (int256[] logitsQ)",
  "event InferenceMulti(bytes32 indexed modelId, address indexed caller, int256[] logitsQ, uint256 valueWei)",
  "function predictMultiAccessView(bytes32 modelId, bytes packedFeaturesQ, uint256 deadline, bytes sig) view returns (int256[] logitsQ)"
];

// src/studio/profile.js
var PROFILE_SCHEMA = "gl1f-dataset-profile/v1";
var INTERVAL_MIN = Object.freeze({ "1m": 1, "3m": 3, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "2h": 120, "4h": 240, "6h": 360, "8h": 480, "12h": 720, "1d": 1440 });
var VENUES = Object.freeze({
  "binance-usdm": Object.freeze({ exchange: "binance", name: "Binance USD-M", short: "Binance", btc: "BTCUSDT" }),
  "coinbase-spot": Object.freeze({ exchange: "coinbase", name: "Coinbase", short: "Coinbase", btc: "BTC-USD" }),
  "hyperliquid-perp": Object.freeze({ exchange: "hyperliquid", name: "Hyperliquid", short: "Hyperliquid", btc: "BTC" })
});
var EXCHANGE_VENUE = Object.freeze({ binance: "binance-usdm", coinbase: "coinbase-spot", hyperliquid: "hyperliquid-perp" });
function horizonWords(bars, candle) {
  const m = Number(bars) * (INTERVAL_MIN[candle] || NaN);
  if (!Number.isFinite(m) || m <= 0) return "the horizon";
  const [n, unit] = m % 1440 === 0 ? [m / 1440, "day"] : m % 60 === 0 ? [m / 60, "hour"] : [m, "minute"];
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}
function questionText(profile) {
  const l = profile?.label;
  if (!l) return null;
  const up = l.direction !== "down", coin = profile.ticker || profile.symbol || "the coin";
  return `Will ${coin} ${up ? "rise" : "fall"} ${l.movePct}% before it ${up ? "drops" : "bounces"} ${l.retracePct}% within ${horizonWords(l.horizonBars, profile.candle)}?`;
}
function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.schema && raw.schema !== PROFILE_SCHEMA) throw new Error(`Unsupported input profile schema ${raw.schema}`);
  const venue = raw.venue || raw.market?.venue;
  const info = VENUES[venue];
  if (!info) throw new Error(`Unsupported market venue ${venue || "(missing)"}`);
  const candle = raw.candle || raw.market?.candle;
  if (!(candle in INTERVAL_MIN)) throw new Error(`Unsupported candle ${candle || "(missing)"}`);
  const symbol = String(raw.symbol || raw.market?.symbol || "").toUpperCase();
  const ticker = String(raw.ticker || raw.market?.ticker || symbol.split("-")[0].replace(/USDT$/, "")).toUpperCase();
  const quote = String(raw.quote || raw.market?.quote || (info.exchange === "binance" ? "USDT" : symbol.split("-")[1] || "USD")).toUpperCase();
  const label = raw.label || {};
  const seed = raw.featureSeedStartMs ?? raw.featureContract?.featureSeedStartMs;
  return {
    venue,
    exchange: info.exchange,
    exchangeName: info.name,
    exchangeShort: info.short,
    symbol: symbol && symbol !== "*" ? symbol : info.exchange === "binance" ? `${ticker}USDT` : `${ticker}-${quote}`,
    ticker,
    quote,
    btcContext: String(raw.btcContext || raw.market?.btcContext || info.btc).toUpperCase(),
    candle,
    featureFamily: raw.featureFamily || raw.featureContract?.builder || "auto",
    featureVersion: raw.featureVersion || null,
    featureSeedStartMs: seed === null || seed === void 0 || seed === "" ? null : Number(seed),
    warmupBars: Number(raw.warmupBars ?? raw.featureContract?.warmupBars) || null,
    scaleQ: Number(raw.scaleQ ?? raw.quantization?.scaleQ) || 1e6,
    label: label.direction ? {
      direction: label.direction,
      basePeriod: Number(label.basePeriod),
      movePct: Number(label.movePct),
      retracePct: Number(label.retracePct),
      horizonBars: Number(label.horizonBars)
    } : null,
    featureOrder: Array.isArray(raw.featureOrder) ? raw.featureOrder.map(String) : null,
    featureOrderSha256: raw.featureOrderSha256 || raw.audit?.featureOrderChecksum?.value || null
  };
}
function unpackFeatures(text) {
  const lines = String(text || "").split("\n").map((s) => s.trim()).filter(Boolean);
  let meta = null, start = 0;
  if (lines[0]?.startsWith("#meta=")) {
    try {
      meta = JSON.parse(lines[0].slice(6));
    } catch {
      meta = null;
    }
    start = 1;
  }
  return { meta, features: lines.slice(start) };
}
function profileFromMeta(meta) {
  try {
    return normalizeProfile(meta?.dataset || meta?.inputProfile || null);
  } catch {
    return null;
  }
}

// src/studio/threshold.js
var DEFAULT_THRESHOLD = 0.5;
var DEFAULT_THRESHOLD_MAX = 1;
var given = (v) => v !== void 0 && v !== null && v !== "";
function yesRange({ threshold, thresholdMax } = {}) {
  const lo = given(threshold) ? Number(threshold) : DEFAULT_THRESHOLD, hi = given(thresholdMax) ? Number(thresholdMax) : DEFAULT_THRESHOLD_MAX;
  if (!(lo >= 0 && lo <= 1)) throw new RangeError("threshold must be a number from 0 to 1");
  if (!(hi >= 0 && hi <= 1)) throw new RangeError("thresholdMax must be a number from 0 to 1");
  if (lo > hi) throw new RangeError("threshold must not be above thresholdMax");
  return { threshold: lo, thresholdMax: hi };
}
function decide(probability, range = {}) {
  const { threshold, thresholdMax } = yesRange(range), p = Number(probability);
  const yes = Number.isFinite(p) && p >= threshold && p <= thresholdMax;
  return { yes, answer: yes ? "yes" : "no", threshold, thresholdMax };
}
function rangeText({ threshold = DEFAULT_THRESHOLD, thresholdMax = DEFAULT_THRESHOLD_MAX } = {}, digits = 2) {
  const lo = Number(threshold).toFixed(digits);
  return Number(thresholdMax) >= 1 ? `P ≥ ${lo}` : `${lo} ≤ P ≤ ${Number(thresholdMax).toFixed(digits)}`;
}

// src/sdk/gl1f-crypto.js
var candleMinutes = (c) => parseInt(c, 10) * ({ m: 1, h: 60, d: 1440, w: 10080 }[String(c).slice(-1)] || 1);
var PRICING = ["free", "tips", "paid"];
var VIEW_TYPES = { AccessView: [{ name: "modelId", type: "bytes32" }, { name: "packedHash", type: "bytes32" }, { name: "deadline", type: "uint256" }] };
var OWNER_TYPES = { OwnerView: VIEW_TYPES.AccessView };
function packInputs(valuesQ) {
  const out = new Uint8Array(valuesQ.length * 4), dv = new DataView(out.buffer);
  valuesQ.forEach((q, i) => dv.setInt32(i * 4, Number(q), true));
  return out;
}
var quantize = (values, scaleQ) => Array.from(values, (v) => Math.max(-2147483648, Math.min(2147483647, Math.round(Math.fround(Number(v)) * scaleQ))));
var sigmoid = (x) => 1 / (1 + Math.exp(-x));
var GL1FCrypto = class {
  constructor({ ethers, rpcUrl, provider, chainId, registry, runtime, nft }) {
    if (!ethers) throw new Error("Pass the ethers v6 module: new GL1FCrypto({ ethers, ... })");
    if (!registry || !runtime) throw new Error("Pass the registry and runtime addresses (shown in the studio's Web3 API panel)");
    this.e = ethers;
    this.provider = provider || new ethers.JsonRpcProvider(rpcUrl, chainId, chainId ? { staticNetwork: true } : void 0);
    this.registry = new ethers.Contract(registry, [...ABI_REGISTRY, ...ABI_REGISTRY.some((f) => f.includes("modelNFT()")) ? [] : ["function modelNFT() view returns (address)"]], this.provider);
    this.runtime = new ethers.Contract(runtime, ABI_RUNTIME, this.provider);
    this.nftAddress = nft || null;
  }
  async chainId() {
    return this._chainId ?? (this._chainId = Number((await this.provider.getNetwork()).chainId));
  }
  async nft() {
    this.nftAddress || (this.nftAddress = await this.registry.modelNFT());
    return this._nft ?? (this._nft = new this.e.Contract(this.nftAddress, ABI_MODELNFT, this.provider));
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
    return {
      tokenId: Number(tokenId),
      modelId: s.modelId,
      title: s.title,
      description: s.description,
      pricing: PRICING[Number(rt.pricingMode)] || "free",
      pricingMode: Number(rt.pricingMode),
      feeWei: rt.feeWei,
      inferenceEnabled: rt.inferenceEnabled,
      scaleQ: Number(rt.scaleQ),
      nFeatures: Number(rt.nFeatures),
      featureNames: features,
      profile: profileFromMeta(meta),
      report: meta?.report || null,
      plans
    };
  }
  // The model's inputs on the latest completed candle, from public exchange data, by the GL1F market engine.
  async latestInputs(model, { engine, asOfMs = null } = {}) {
    if (!engine) throw new Error("Pass an engine: await GL1FCrypto.browserEngine() or await GL1FCrypto.nodeEngine()");
    const p = model.profile;
    if (!p?.label) throw new Error("This model has no market profile; compute its inputs yourself");
    return engine.infer({
      mode: asOfMs ? "historical" : "latest",
      asOfMs,
      exchange: p.exchange,
      market: p.symbol,
      candle: p.candle,
      features: model.featureNames,
      featureFamily: p.featureFamily || "auto",
      scaleQ: model.scaleQ,
      warmupBars: p.warmupBars || null,
      featureSeedStartMs: p.featureSeedStartMs ?? null,
      basePeriod: p.label.basePeriod,
      btcSymbol: p.btcContext,
      cacheCandles: false
    });
  }
  // Runs the model on GenesisL1. Free/tips: no options. Paid: { accessKey } (private key or ethers Wallet with an active
  // plan), { owner } (the admin's signer) or { payer } (a signer that pays the fee per run in a transaction).
  // { threshold, thresholdMax } (optional, defaults 0.5 and 1) set when the answer is yes; they are checked before the
  // model runs, so a payer never pays for a call with a wrong range.
  async predict(model, valuesQ, { accessKey, owner, payer, deadlineSec = 300, threshold, thresholdMax } = {}) {
    const range = yesRange({ threshold, thresholdMax });
    const m = typeof model === "object" ? model : await this.model(model);
    if (valuesQ.length !== m.nFeatures) throw new Error(`Model #${m.tokenId} takes ${m.nFeatures} inputs, got ${valuesQ.length}`);
    const packed = packInputs(valuesQ), done = (scoreQ, via, extra = {}) => {
      const probability = sigmoid(Number(scoreQ) / m.scaleQ);
      return { scoreQ: BigInt(scoreQ), probability, via, ...decide(probability, range), ...extra };
    };
    if (payer) {
      const tx = await this.runtime.connect(payer).predictTx(m.modelId, packed, { value: m.pricingMode === 2 ? m.feeWei : 0n });
      const receipt = await tx.wait(), ev = receipt.logs.map((l) => {
        try {
          return this.runtime.interface.parseLog(l);
        } catch {
          return null;
        }
      }).find((x) => x?.name === "Inference");
      return done(ev.args.scoreQ, "predictTx", { tx: tx.hash });
    }
    if (m.pricingMode !== 2) return done(await this.runtime.predictView(m.modelId, packed), "predictView");
    const deadline = Math.floor(Date.now() / 1e3) + deadlineSec;
    const domain = { name: "GenesisL1 Forest", version: "1", chainId: await this.chainId(), verifyingContract: await this.runtime.getAddress() };
    const message = { modelId: m.modelId, packedHash: this.e.keccak256(packed), deadline };
    if (owner) return done(await this.runtime.predictOwnerView(m.modelId, packed, deadline, await owner.signTypedData(domain, OWNER_TYPES, message)), "predictOwnerView");
    if (!accessKey) throw new Error(`Model #${m.tokenId} is paid: pass { accessKey } with an active plan, { owner }, or { payer }`);
    const key = typeof accessKey === "string" ? new this.e.Wallet(accessKey) : accessKey;
    return done(await this.runtime.predictAccessView(m.modelId, packed, deadline, await key.signTypedData(domain, VIEW_TYPES, message)), "predictAccessView");
  }
  // The model's answer for the latest completed candle (or the candle at asOfMs), in one call: its inputs from public
  // exchange data, the run on GenesisL1 and yes or no by { threshold, thresholdMax }. Paid models take the same
  // { accessKey }, { owner } or { payer } as predict().
  async ask(model, { engine, asOfMs = null, threshold, thresholdMax, accessKey, owner, payer, deadlineSec } = {}) {
    const range = yesRange({ threshold, thresholdMax });
    const m = typeof model === "object" ? model : await this.model(model);
    const inputs = await this.latestInputs(m, { engine, asOfMs });
    const r = await this.predict(m, inputs.valuesQ, { accessKey, owner, payer, deadlineSec, ...range });
    const open = Number(inputs.selectedOpenMs), close = open + candleMinutes(m.profile.candle) * 6e4;
    return {
      model: m.tokenId,
      question: questionText(m.profile),
      market: m.profile.symbol,
      candle: m.profile.candle,
      candleOpen: new Date(open).toISOString(),
      candleClose: new Date(close).toISOString(),
      ...r
    };
  }
  // A new access key: keep its private key secret; a plan bought for its address lets it run the model.
  newAccessKey() {
    const w = this.e.Wallet.createRandom();
    return { address: w.address, privateKey: w.privateKey };
  }
  async buyAccess(model, planId, keyAddress, signer) {
    const m = typeof model === "object" ? model : await this.model(model), plan = m.plans.find((p) => p.id === Number(planId));
    if (!plan?.active) throw new Error(`Plan ${planId} is not available for model #${m.tokenId}`);
    const tx = await this.registry.connect(signer).buyAccess(m.modelId, plan.id, keyAddress, { value: plan.priceWei });
    await tx.wait();
    return { tx: tx.hash, ...await this.accessStatus(m, keyAddress) };
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
    const pending = /* @__PURE__ */ new Map();
    worker.onmessage = (e) => {
      const m = e.data || {}, p = pending.get(m.requestId);
      if (!p) return;
      if (m.type === "vector") {
        pending.delete(m.requestId);
        p.resolve(m);
      } else if (m.type === "error") {
        pending.delete(m.requestId);
        p.reject(new Error(m.message));
      }
    };
    return { infer: (job) => new Promise((resolve, reject) => {
      const requestId = `sdk-${++seq}`;
      pending.set(requestId, { resolve, reject });
      worker.postMessage({ type: "infer", job, requestId });
    }), close: () => worker.terminate() };
  }
  // The same engine in Node 18+ (source: a URL, a file path or the script text).
  static async nodeEngine(source = "https://crypto.gl1f.com/sdk/gl1f-engine.js") {
    const vm = await import("node:vm"), fs = await import("node:fs");
    const code = /^https?:/.test(source) ? await (await fetch(source)).text() : fs.existsSync(source) ? fs.readFileSync(source, "utf8") : source;
    const context = { module: { exports: {} }, self: { postMessage() {
    } }, postMessage() {
    }, console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, fetch: globalThis.fetch, AbortController, performance, crypto: globalThis.crypto };
    vm.runInNewContext(code, context);
    const engine = context.module.exports;
    return { infer: (job) => engine.runInference(job), close() {
    } };
  }
};
var gl1f_crypto_default = GL1FCrypto;
export {
  DEFAULT_THRESHOLD,
  DEFAULT_THRESHOLD_MAX,
  GL1FCrypto,
  OWNER_TYPES,
  PRICING,
  VIEW_TYPES,
  decide,
  gl1f_crypto_default as default,
  packInputs,
  quantize,
  questionText,
  rangeText,
  yesRange
};
