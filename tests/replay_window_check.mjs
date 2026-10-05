// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Inference replays at most 120 days (or 4,000 candles) instead of everything since the model's training seed. This
// checks the inputs are bit-identical to a full replay from the seed for every market signal, on a realistic synthetic
// market (fat-tailed random walk), and that the bounded replay downloads less.
import assert from "node:assert/strict";
import vm from "node:vm"; import { readFileSync } from "node:fs";
// A realistic deterministic market: a fat-tailed random walk (about 0.4% per 15 minutes), volume rising with big moves.
const MIN = 60_000, DAY = 86_400_000, NOW = Math.floor(Date.now() / (15 * MIN)) * 15 * MIN + 7 * MIN;
const STEPS = { "1m": MIN, "5m": 5 * MIN, "15m": 15 * MIN, "30m": 30 * MIN, "1h": 60 * MIN, "4h": 240 * MIN, "1d": 1440 * MIN };
const hash = (a, b) => { let h = 2166136261 ^ a; h = Math.imul(h ^ b, 16777619); h ^= h >>> 13; h = Math.imul(h, 2246822507); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const paths = new Map();
function path(symbol, step) {
  const key = `${symbol}:${step}`; if (paths.has(key)) return paths.get(key);
  const origin = Math.floor((NOW - 560 * DAY) / step) * step, n = Math.ceil((NOW - origin) / step) + 2, seed = [...symbol].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0;
  const sigma = 0.004 * Math.sqrt(step / (15 * MIN)), logp = new Float64Array(n + 1), z = new Float64Array(n);
  logp[0] = Math.log(symbol.startsWith("BTC") ? 60000 : 40);
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(1e-12, hash(seed, 2 * i)), u2 = hash(seed, 2 * i + 1), g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const tail = hash(seed + 99, i) < 0.03 ? 3 : 1;   // occasional large moves
    z[i] = g * tail; logp[i + 1] = logp[i] + sigma * z[i];
  }
  const p = { origin, logp, z, sigma, seed }; paths.set(key, p); return p;
}
function candle(symbol, t, step) {
  const p = path(symbol, step), i = Math.round((t - p.origin) / step), o = Math.exp(p.logp[i]), c = Math.exp(p.logp[i + 1]);
  const h = Math.max(o, c) * (1 + 0.4 * p.sigma * hash(p.seed + 7, i)), l = Math.min(o, c) * (1 - 0.4 * p.sigma * hash(p.seed + 8, i));
  const v = 1000 * (0.4 + hash(p.seed + 9, i)) * (1 + 2 * Math.abs(p.z[i])) * step / MIN;
  return [o, h, l, c, v];
}
const r10 = (x) => Number(x.toPrecision(10));
async function fakeFetch(url) {
  const u = new URL(String(url)), q = Object.fromEntries(u.searchParams), json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
  if (u.pathname === "/fapi/v1/time") return json({ serverTime: NOW });
  if (u.pathname === "/fapi/v1/exchangeInfo") return json({ symbols: ["BTC", "ETH", "ZEC"].map((b) => ({ symbol: `${b}USDT`, baseAsset: b, quoteAsset: "USDT", status: "TRADING", contractType: "PERPETUAL", onboardDate: 0 })) });
  if (u.pathname === "/fapi/v1/klines") {
    const step = STEPS[q.interval], start = +q.startTime, end = +q.endTime, limit = +q.limit, rows = [];
    for (let t = Math.ceil(start / step) * step; t <= end && rows.length < limit && t + step <= NOW; t += step) {
      const [o, h, l, c, v] = candle(q.symbol, t, step), qv = r10(v * c);
      rows.push([t, String(r10(o)), String(r10(h)), String(r10(l)), String(r10(c)), String(r10(v)), t + step - 1, String(qv), 50 + Math.floor(hash(t, 3) * 100), String(r10(v * 0.52)), String(r10(qv * 0.52)), "0"]);
    }
    return json(rows);
  }
  if (u.pathname === "/fapi/v1/fundingRate") {
    const p8 = 8 * 60 * MIN, rows = [];
    for (let t = Math.ceil(+q.startTime / p8) * p8; t <= +q.endTime && rows.length < 1000; t += p8) rows.push({ fundingTime: t, fundingRate: String(r10(0.0001 * Math.sin(t / DAY) + 0.00005 * (hash(t, 5) - 0.5))) });
    return json(rows);
  }
  return new Response("not found", { status: 404 });
}
let klineRequests = 0;
const counting = (url) => { if (String(url).includes("/fapi/v1/klines")) klineRequests++; return fakeFetch(url); };
const code = readFileSync(new URL("../site/sdk/gl1f-engine.js", import.meta.url), "utf8");
const ctx = { module: { exports: {} }, self: { postMessage() {} }, postMessage() {}, console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, AbortController, performance, crypto: globalThis.crypto, fetch: counting, Response };
vm.runInNewContext(code, ctx);
const E = ctx.module.exports, M15 = 15 * MIN;
const WORLD = new Set(["Holidays & events", "Astronomy", "Macro & markets", "Disasters & conflict"]);
const features = E.ALL_FEATURES.filter((f) => !WORLD.has(E.featureGroup(f)));
const seed = Math.floor((NOW - 240 * DAY) / M15) * M15, asOfMs = Math.floor((NOW - 2 * DAY) / M15) * M15;
const base = { exchange: "binance", market: "ZECUSDT", candle: "15m", features, featureFamily: "auto", scaleQ: 1_000_000, basePeriod: 15, btcSymbol: "BTCUSDT", cacheCandles: false, mode: "historical", asOfMs };
klineRequests = 0;
const bounded = await E.runInference({ ...base, featureSeedStartMs: seed, warmupBars: null });
const boundedRequests = klineRequests;
assert.match(bounded.warmupSource, /converged window/, "an old seed replays a bounded window");
assert.ok(bounded.fetchStartMs > seed && asOfMs - bounded.fetchStartMs <= 121 * DAY, "about 120 days are replayed");
// Reference: a replay from the seed itself (a warm-up exactly as long as the distance to the seed).
const warm = Math.round((Math.floor((asOfMs - 15 * MIN) / M15) * M15 - seed) / M15);
klineRequests = 0;
const full = await E.runInference({ ...base, featureSeedStartMs: null, warmupBars: warm });
assert.equal(full.fetchStartMs, seed, "the reference replays from the seed");
assert.ok(klineRequests > boundedRequests * 1.5, `the bounded replay downloads less (${boundedRequests} vs ${klineRequests} requests)`);
const differ = features.filter((f, i) => bounded.valuesQ[i] !== full.valuesQ[i]);
// (the engine runs in its own VM realm, so compare counts rather than arrays across realms)
assert.equal(differ.length, 0, `inputs differ from a full replay: ${differ.slice(0, 5).join(", ")}`);
// A recent seed is replayed in full, as before.
const recent = Math.floor((NOW - 40 * DAY) / M15) * M15;
const young = await E.runInference({ ...base, featureSeedStartMs: recent, warmupBars: null });
assert.equal(young.fetchStartMs, recent); assert.equal(young.warmupSource, "profile seed");
console.log(`replay window: ${features.length} market signals bit-identical to a 240-day replay from the seed with a 120-day window (${boundedRequests} vs ${klineRequests} candle requests); a recent seed is replayed in full`);
