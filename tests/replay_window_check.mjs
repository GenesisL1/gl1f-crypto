// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Inference replays at most 120 days (or 4,000 candles) instead of everything since the model's training seed. This
// checks the inputs are bit-identical to a full replay from the seed for every market signal, on a realistic synthetic
// market (fat-tailed random walk), and that the bounded replay downloads less.
import assert from "node:assert/strict";
import vm from "node:vm"; import { readFileSync } from "node:fs";
import { MIN, DAY, NOW, fakeFetch } from "./lib/synthetic_binance.mjs";
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
