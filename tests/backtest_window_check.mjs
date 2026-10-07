// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Backtests warm up like inference: on the 120 days (or 4,000 candles) before the range, or from the training seed when
// that is later. A range before a model's training data can be backtested, a range long after it gives inputs
// bit-identical to the exact replay from the seed, and a training report still gets that exact replay.
import assert from "node:assert/strict";
import vm from "node:vm"; import { readFileSync } from "node:fs";
import { MIN, DAY, NOW, fakeFetch } from "./lib/synthetic_binance.mjs";
const counting = fakeFetch;
const code = readFileSync(new URL("../site/sdk/gl1f-engine.js", import.meta.url), "utf8");
const ctx = { module: { exports: {} }, self: { postMessage() {} }, postMessage() {}, console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, AbortController, performance, crypto: globalThis.crypto, fetch: counting, Response };
vm.runInNewContext(code, ctx);
const E = ctx.module.exports, M15 = 15 * MIN;
const WORLD = new Set(["Holidays & events", "Astronomy", "Macro & markets", "Disasters & conflict"]);
const features = E.ALL_FEATURES.filter((f) => !WORLD.has(E.featureGroup(f)));
const seed = Math.floor((NOW - 200 * DAY) / M15) * M15;
const base = { exchange: "binance", market: "ZECUSDT", candle: "15m", features, featureFamily: "auto", scaleQ: 1_000_000, basePeriod: 15, btcSymbol: "BTCUSDT", cacheCandles: false, featureSeedStartMs: seed, warmupBars: null };

// 1. A range before the training data: it runs, its start is kept, the features warm up on the 120 days before it.
const before = { startMs: seed - 100 * DAY, endMs: seed - 95 * DAY };
const early = await E.runBacktest({ ...base, ...before });
assert.equal(early.startMoved, false, "the start is not moved");
assert.ok(early.startMs >= before.startMs && early.startMs < before.startMs + 2 * M15, "the range starts where it was asked");
assert.ok(before.startMs - early.fetchStartMs >= 119 * DAY, "warmed up on about 120 days before the range");
assert.equal(early.warmupSource, "converged window");
assert.ok(early.nRows >= 470, `five days of 15m candles (${early.nRows})`);

// 2. A training report replays exactly from the seed, as the dataset was built: the same range is refused there.
await assert.rejects(E.runBacktest({ ...base, ...before, exactSeedReplay: true }), /warmed up/, "the exact replay still needs the range after the seed");

// 3. Long after the seed: a 120-day window, bit-identical to the exact replay from the seed.
const after = { startMs: seed + 150 * DAY, endMs: seed + 155 * DAY };
const fast = await E.runBacktest({ ...base, ...after });
const exact = await E.runBacktest({ ...base, ...after, exactSeedReplay: true });
assert.equal(exact.fetchStartMs, seed, "the exact replay starts at the seed");
assert.ok(fast.fetchStartMs > seed && after.startMs - fast.fetchStartMs <= 121 * DAY, "the backtest replays about 120 days");
assert.equal(fast.nRows, exact.nRows); assert.equal(fast.startMs, exact.startMs);
let differ = 0, invalid = 0;
for (let k = 0; k < fast.X.length; k++) if (!Object.is(fast.X[k], exact.X[k])) differ++;
for (let r = 0; r < fast.nRows; r++) if (fast.valid[r] !== exact.valid[r]) invalid++;
assert.equal(differ, 0, `${differ} feature values differ from the exact replay`);
assert.equal(invalid, 0, "the same candles are complete");
// 4. A recent seed (range shortly after it) still replays from the seed itself.
const young = await E.runBacktest({ ...base, featureSeedStartMs: Math.floor((NOW - 60 * DAY) / M15) * M15, startMs: NOW - 20 * DAY, endMs: NOW - 15 * DAY });
assert.equal(young.warmupSource, "profile seed");
console.log(`backtest window: a range before the training data runs (start kept, ${early.nRows} candles); ${features.length} market signals x ${fast.nRows} candles bit-identical to the exact replay from the seed; training reports keep the exact replay`);
