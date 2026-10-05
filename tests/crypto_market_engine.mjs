// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Crypto runtime market engine checks (no network): mock Binance USD-M and
// Coinbase endpoints, build datasets, and verify that an inference replay
// reproduces the exported feature row exactly.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const WORKER = process.env.GL1F_MARKET_WORKER
  || fileURLToPath(new URL("../src/studio/market_worker.js", import.meta.url));
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 20, 12, 7, 31);
// The mock exchanges are frozen at NOW. Run the engine's clock from NOW as well, so the test gives the same answer
// on any date (the Hyperliquid clock probe searches ±days around Date.now()).
const realNow = Date.now, clockOffset = NOW - realNow();
Date.now = () => realNow() + clockOffset;

// ---- deterministic market model -------------------------------------------
function hash(x) { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); }
function priceAt(symbol, t) {
  const seed = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
  const m = t / MIN;
  const base = symbol.startsWith("BTC") ? 60000 : 2.5 + seed % 7;
  return base * Math.exp(0.08 * Math.sin(m / 911 + seed) + 0.03 * Math.sin(m / 97 + seed / 3) + 0.004 * Math.sin(m / 7.3));
}
function candle(symbol, t, stepMs) {
  const o = priceAt(symbol, t), c = priceAt(symbol, t + stepMs);
  const h = Math.max(o, c) * (1 + 0.002 * hash(t / MIN + 1)), l = Math.min(o, c) * (1 - 0.002 * hash(t / MIN + 2));
  const v = 1000 * (0.2 + hash(t / MIN + 3)) * stepMs / MIN;
  return { o, h, l, c, v };
}
const round = (x) => Number(x.toPrecision(10));
// Coinbase omits buckets without trades: drop a deterministic subset for thin products.
const noTrade = (symbol, t) => !symbol.startsWith("BTC") && hash(t / MIN + 7) < 0.06;

let requestLog = [];
function json(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}
const HL_STEP = { "1m": MIN, "3m": 3 * MIN, "5m": 5 * MIN, "15m": 15 * MIN, "30m": 30 * MIN, "1h": HOUR, "2h": 2 * HOUR, "4h": 4 * HOUR, "8h": 8 * HOUR, "12h": 12 * HOUR, "1d": DAY };
// Hyperliquid only emits buckets with trades, keeps the latest 5,000 candles, and returns at most 5,000 per call.
const hlNoTrade = (coin, t) => coin !== "BTC" && hash(t / MIN + 13) < 0.03;
// Like the real API: out-of-range or fractional times fail with HTTP 500, non-JSON bodies are refused,
// and time-range answers are capped at 500 rows so pagination is exercised.
const HL_MIN_TIME = Date.UTC(2015, 0, 1), HL_MAX_TIME = NOW + 30 * DAY;
const hlBadTime = (v) => v !== undefined && (!Number.isInteger(v) || v < 0 || v > HL_MAX_TIME);
function hyperliquid(body, init) {
  if (init.headers?.["Content-Type"] !== "application/json") return json("Internal Server Error", 500);
  const times = body.type === "candleSnapshot" ? [body.req?.startTime, body.req?.endTime] : [body.startTime, body.endTime];
  if (times.some(hlBadTime) || (body.type === "candleSnapshot" && times.some((v) => v < HL_MIN_TIME && v !== 0))) return json("Internal Server Error", 500);
  if (body.type === "meta") return json({ universe: [{ name: "BTC", szDecimals: 5 }, { name: "ETH", szDecimals: 4 }, { name: "kPEPE", szDecimals: 0 }, { name: "OLD", isDelisted: true }] });
  if (body.type === "candleSnapshot") {
    const { coin, interval, startTime, endTime } = body.req, stepMs = HL_STEP[interval];
    if (!stepMs) return json("invalid interval", 422);
    const oldest = Math.floor(NOW / stepMs) * stepMs - 4999 * stepMs, out = [];
    for (let t = Math.max(oldest, Math.ceil(startTime / stepMs) * stepMs); t <= endTime && t <= NOW && out.length < 500; t += stepMs) {
      if (hlNoTrade(coin, t)) continue;
      const k = candle(coin, t, Math.min(stepMs, NOW - t));
      out.push({ t, T: t + stepMs - 1, s: coin, i: interval, o: String(round(k.o)), c: String(round(k.c)), h: String(round(k.h)), l: String(round(k.l)), v: String(round(k.v)), n: 10 + Math.floor(hash(t / MIN + 11) * 90) });
    }
    return json(out);
  }
  if (body.type === "fundingHistory") {
    const out = [];
    for (let t = Math.ceil(body.startTime / HOUR) * HOUR; t <= Math.min(body.endTime ?? NOW, NOW) && out.length < 500; t += HOUR) out.push({ coin: body.coin, fundingRate: String(round(0.0000125 * Math.sin(t / DAY + 1))), premium: "0", time: t });
    return json(out);
  }
  return json("unknown request", 422);
}
async function mockFetch(input, init = {}) {
  const url = new URL(String(input));
  requestLog.push(url.toString());
  if (url.host === "api.hyperliquid.xyz" && url.pathname === "/info" && init.method === "POST") return hyperliquid(JSON.parse(init.body), init);
  if (url.host === "fapi.binance.com") {
    if (url.pathname === "/fapi/v1/time") return json({ serverTime: NOW });
    if (url.pathname === "/fapi/v1/klines") {
      const symbol = url.searchParams.get("symbol"), interval = url.searchParams.get("interval");
      const stepMs = { "1m": MIN, "5m": 5 * MIN, "15m": 15 * MIN, "1h": HOUR, "4h": 4 * HOUR }[interval];
      const start = Number(url.searchParams.get("startTime")), end = Number(url.searchParams.get("endTime")), limit = Number(url.searchParams.get("limit"));
      const rows = [];
      for (let t = Math.ceil(start / stepMs) * stepMs; t <= end && rows.length < limit; t += stepMs) {
        if (t + stepMs > NOW) break;
        const k = candle(symbol, t, stepMs), v = round(k.v), q = round(k.v * k.c);
        rows.push([t, String(round(k.o)), String(round(k.h)), String(round(k.l)), String(round(k.c)), String(v), t + stepMs - 1, String(q), 50 + Math.floor(hash(t) * 100), String(round(v * 0.52)), String(round(q * 0.52)), "0"]);
      }
      return json(rows);
    }
    if (url.pathname === "/fapi/v1/fundingRate") {
      const start = Number(url.searchParams.get("startTime")), end = Number(url.searchParams.get("endTime"));
      const rows = [];
      for (let t = Math.ceil(start / (8 * HOUR)) * 8 * HOUR; t <= end && rows.length < 1000; t += 8 * HOUR) rows.push({ fundingTime: t, fundingRate: String(round(0.0001 * Math.sin(t / DAY))) });
      return json(rows);
    }
  }
  if (url.host === "api.exchange.coinbase.com") {
    if (url.pathname === "/time") return json({ iso: new Date(NOW).toISOString(), epoch: NOW / 1000 });
    const m = /^\/products\/([^/]+)\/candles$/.exec(url.pathname);
    if (m) {
      const product = decodeURIComponent(m[1]), g = Number(url.searchParams.get("granularity"));
      if (![60, 300, 900, 3600, 21600, 86400].includes(g)) return json({ message: "Unsupported granularity" }, 400);
      const start = Date.parse(url.searchParams.get("start")), end = Date.parse(url.searchParams.get("end")), stepMs = g * 1000;
      if ((end - start) / stepMs > 300) return json({ message: "granularity too small for the requested time range" }, 400);
      const rows = [];
      // Inclusive end, newest first, and one bucket before start (documented behaviour).
      for (let t = Math.floor(start / stepMs) * stepMs - stepMs; t <= end; t += stepMs) {
        if (t < 0 || t + stepMs > NOW - 1000 || noTrade(product, t)) continue;
        const k = candle(product, t, stepMs);
        rows.push([t / 1000, round(k.l), round(k.h), round(k.o), round(k.c), round(k.v)]);
      }
      rows.sort((a, b) => b[0] - a[0]);
      return json(rows);
    }
    if (url.pathname === "/products") return json([{ id: "ETH-USD", base_currency: "ETH", quote_currency: "USD", status: "online", trading_disabled: false }]);
  }
  return json({ message: `unmocked ${url}` }, 404);
}

function loadEngine() {
  const sandbox = {
    module: { exports: {} }, fetch: mockFetch, URL, Blob, DOMException, AbortController, TextEncoder, TextDecoder,
    setTimeout: (fn) => setImmediate(fn), clearTimeout: () => {}, console, Math, Date, Number, String, Array, Object, Map, Set,
  };
  sandbox.exports = sandbox.module.exports;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(WORKER, "utf8"), sandbox, { filename: WORKER });
  return sandbox.module.exports;
}

async function csvRows(blob) {
  const lines = (await blob.text()).trim().split("\n");
  const header = lines[0].split(",");
  return { header, rows: lines.slice(1).map((line) => line.split(",")) };
}

function job(overrides) {
  return {
    direction: "up", basePeriod: 5, movePct: 1, retracePct: 0.5, horizonBars: 20, horizonText: "5h",
    startMs: Date.UTC(2026, 7, 20), endMs: Date.UTC(2026, 8, 20), cacheCandles: true, ...overrides,
  };
}

async function assertReplay(engine, result, exchange, market, candleMs, picks, cacheCandles = true) {
  const { header, rows } = await csvRows(result.blob);
  const features = header.slice(1, -1);
  for (const index of picks) {
    const row = rows[index], openMs = Date.parse(row[0].replace(" ", "T").replace("+00:00", "Z"));
    const vector = await engine.runInference({
      exchange, market, candle: result.contract.candle, features, featureFamily: result.contract.featureFamily,
      scaleQ: 1_000_000, warmupBars: result.warmupBars, featureSeedStartMs: result.contract.featureSeedStartMs,
      basePeriod: 5, mode: "historical", asOfMs: openMs + candleMs, btcSymbol: result.contract.btcContext, cacheCandles,
    });
    assert.equal(vector.selectedOpenMs, openMs, "replay selected the dataset candle");
    features.forEach((name, j) => {
      const exported = Number(row[j + 1]);
      assert.equal(vector.values[j], exported, `${exchange} ${name} at row ${index}: replay ${vector.values[j]} != csv ${exported}`);
      assert.equal(vector.valuesQ[j], Math.round(Math.fround(exported) * 1_000_000));
    });
  }
  return rows.length;
}

const engine = loadEngine();

// 1. Catalogue availability.
{
  const cb = engine.catalogue("coinbase"), bn = engine.catalogue("binance");
  assert.equal(bn.filter((f) => f.available).length, 212);
  assert.equal(cb.filter((f) => f.available).length, 193);
  const count = (list) => list.filter((n) => engine.featureAvailable(n, "coinbase")).length;
  assert.deepEqual([count(engine.SMALL_FEATURES), count(engine.OPTIMAL_FEATURES), count(engine.FULL_FEATURES)], [38, 43, 152]);
  assert.equal(engine.resolveMarket("coinbase", "eth").symbol, "ETH-USD");
  assert.equal(engine.resolveMarket("coinbase", "sol-usdc").btcSymbol, "BTC-USD");
  assert.equal(engine.resolveMarket("binance", "ethusdt").symbol, "ETHUSDT");
  assert.equal(engine.nativeInterval("coinbase", "4h"), "1h");
  assert.equal(engine.nativeInterval("coinbase", "12h"), "6h");
  assert.equal(engine.nativeInterval("coinbase", "30m"), "15m");
}

// 2. Binance 15m optimal dataset and exact replay.
{
  requestLog = [];
  const result = await engine.runJob(job({ exchange: "binance", market: "ETH", candle: "15m", preset: "optimal", features: engine.OPTIMAL_FEATURES }));
  assert.equal(result.contract.venue, "binance-usdm");
  assert.ok(result.stats.rows > 2000);
  const m = result.matrix, { header, rows } = await csvRows(result.blob);
  assert.equal(m.nRows, rows.length); assert.deepEqual([...m.featureNames], header.slice(1, -1)); assert.equal(m.close.length, m.nRows);
  for (const r of [0, Math.floor(rows.length / 2), rows.length - 1]) {
    for (let j = 0; j < m.nFeatures; j++) assert.equal(m.X[r * m.nFeatures + j], Math.fround(Number(rows[r][j + 1])));
    assert.equal(m.y[r], Number(rows[r][rows[r].length - 1]));
  }
  const n = await assertReplay(engine, result, "binance", "ETH", 15 * MIN, [0, 777, rows.length - 1]);
  console.log(`binance 15m optimal: ${n} rows, ${m.nFeatures} features, replay exact`);
}

// 3. Coinbase 15m with no-trade buckets; replay exact (cached and uncached).
{
  requestLog = [];
  const features = engine.OPTIMAL_FEATURES.filter((f) => engine.featureAvailable(f, "coinbase"));
  const result = await engine.runJob(job({ exchange: "coinbase", market: "ETH-USD", candle: "15m", preset: "optimal", features }));
  assert.equal(result.contract.venue, "coinbase-spot");
  assert.equal(result.contract.symbol, "ETH-USD");
  assert.equal(result.contract.btcContext, "BTC-USD");
  assert.ok(result.cache.synthetic > 0, "no-trade buckets were filled");
  for (const u of requestLog.filter((x) => x.includes("/candles"))) {
    const p = new URL(u).searchParams, span = (Date.parse(p.get("end")) - Date.parse(p.get("start"))) / (Number(p.get("granularity")) * 1000);
    assert.ok(span <= 300, "each Coinbase request stays within 300 buckets");
  }
  const { rows } = await csvRows(result.blob);
  await assertReplay(engine, result, "coinbase", "ETH-USD", 15 * MIN, [0, 999, rows.length - 1]);
  await assertReplay(engine, result, "coinbase", "ETH-USD", 15 * MIN, [1500], false);
  console.log(`coinbase 15m optimal: ${rows.length} rows, ${result.cache.synthetic} filled buckets, replay exact (cached + network)`);
}

// 4. Coinbase 4h aggregated from 1h buckets, legacy engine.
{
  const features = engine.SMALL_FEATURES.filter((f) => engine.featureAvailable(f, "coinbase"));
  const result = await engine.runJob(job({ exchange: "coinbase", market: "SOL-USD", candle: "4h", preset: "small", features, startMs: Date.UTC(2026, 4, 1), horizonBars: 6, horizonText: "24h" }));
  assert.equal(result.sources[0].nativeInterval, "1h");
  const { rows } = await csvRows(result.blob);
  await assertReplay(engine, result, "coinbase", "SOL-USD", 4 * HOUR, [0, rows.length - 1]);
  console.log(`coinbase 4h small: ${rows.length} rows from 1h buckets, replay exact`);
}

// 6. Backtest replay reproduces the dataset rows (same seed, same engine) and returns OHLC + EMA.
{
  const result = await engine.runJob(job({ exchange: "coinbase", market: "ETH-USD", candle: "15m", preset: "optimal", features: engine.OPTIMAL_FEATURES.filter((f) => engine.featureAvailable(f, "coinbase")) }));
  const { header, rows } = await csvRows(result.blob);
  const features = header.slice(1, -1), candleMs = 15 * MIN;
  const startRow = rows.length - 400, startMs = Date.parse(rows[startRow][0].replace(" ", "T").replace("+00:00", "Z"));
  const bt = await engine.runBacktest({ exchange: "coinbase", market: "ETH-USD", candle: "15m", features, featureFamily: result.contract.featureFamily,
    scaleQ: 1_000_000, warmupBars: result.warmupBars, featureSeedStartMs: result.contract.featureSeedStartMs, basePeriod: 5,
    startMs, endMs: Date.parse(rows[rows.length - 1][0].replace(" ", "T").replace("+00:00", "Z")) + candleMs, btcSymbol: result.contract.btcContext });
  assert.equal(bt.times[0], startMs);
  assert.equal(bt.nRows, 400);
  for (const r of [0, 199, 399]) {
    assert.equal(bt.valid[r], 1);
    features.forEach((name, j) => assert.equal(bt.X[r * features.length + j], Math.fround(Number(rows[startRow + r][j + 1])), `backtest ${name} row ${r}`));
  }
  for (let i = 0; i < bt.nRows; i++) assert.ok(bt.high[i] >= Math.max(bt.open[i], bt.close[i]) && bt.low[i] <= Math.min(bt.open[i], bt.close[i]) && Number.isFinite(bt.baseline[i]));
  console.log(`backtest replay: ${bt.nRows} candles, rows identical to the dataset, OHLC + EMA baseline returned`);
}

// 7. Coinbase holes longer than 6 hours are refused (outage), shorter no-trade runs are filled.
{
  const step = 60 * MIN, t0 = Date.UTC(2026, 7, 1);
  const traded = new Map([[t0, [t0, 1, 1, 1, 1, 5, 0]], [t0 + 5 * step, [t0 + 5 * step, 1, 1, 1, 1, 5, 0]], [t0 + 20 * step, [t0 + 20 * step, 1, 1, 1, 1, 5, 0]]]);
  assert.throws(() => engine.fillCoinbaseRows(traded, t0, t0 + 21 * step, step, NaN), /outage or a halted market/);
  const ok = engine.fillCoinbaseRows(new Map([...traded].slice(0, 2)), t0, t0 + 6 * step, step, NaN);
  assert.equal(ok.synthetic, 4); assert.equal(ok.maxGapMinutes, 240);
}

// 8. Hyperliquid perps: POST /info candles with gap fill, trade counts, hourly funding, 5,000-candle history.
{
  assert.equal(engine.resolveMarket("hyperliquid", "1000PEPE").symbol, "kPEPE");
  assert.equal(engine.resolveMarket("hyperliquid", "kPEPE").symbol, "kPEPE");
  assert.equal(engine.resolveMarket("hyperliquid", "eth-perp").symbol, "ETH");
  const available = engine.ALL_FEATURES.filter((f) => engine.featureAvailable(f, "hyperliquid"));
  assert.ok(available.some((f) => f.startsWith("funding_")) && available.includes("log_trades") && !available.some((f) => f.includes("taker")));
  assert.deepEqual([...(await engine.fetchMarkets("hyperliquid")).markets.map((m) => m.symbol)], ["BTC", "ETH", "kPEPE"]);
  assert.equal(engine.nativeInterval("hyperliquid", "6h"), "2h");
  assert.equal(engine.nativeInterval("hyperliquid", "8h"), "8h");
  const features = engine.OPTIMAL_FEATURES.filter((f) => engine.featureAvailable(f, "hyperliquid"));
  const result = await engine.runJob(job({ exchange: "hyperliquid", market: "ETH", candle: "15m", preset: "optimal", features, startMs: Date.UTC(2026, 8, 1), endMs: Date.UTC(2026, 8, 20) }));
  const { header, rows } = await csvRows(result.blob);
  assert.deepEqual(header.slice(1, -1), [...features]);
  assert.ok(rows.length > 1500, `hyperliquid rows ${rows.length}`);
  const candleMs = 15 * MIN;
  for (const index of [0, Math.floor(rows.length / 2), rows.length - 1]) {
    const row = rows[index], openMs = Date.parse(row[0].replace(" ", "T").replace("+00:00", "Z"));
    const vector = await engine.runInference({ exchange: "hyperliquid", market: "ETH", candle: "15m", features, featureFamily: result.contract.featureFamily,
      scaleQ: 1_000_000, warmupBars: result.warmupBars, featureSeedStartMs: result.contract.featureSeedStartMs, basePeriod: 5, mode: "historical",
      asOfMs: openMs + candleMs, btcSymbol: result.contract.btcContext, cacheCandles: true });
    assert.equal(vector.selectedOpenMs, openMs);
    assert.deepEqual([...vector.saturated], []);
    features.forEach((name, j) => assert.equal(vector.values[j], Number(row[j + 1]), `hyperliquid ${name} row ${index}`));
    vector.valuesQ.forEach((q, j) => assert.equal(q, Math.max(-2147483648, Math.min(2147483647, Math.round(Math.fround(vector.values[j]) * 1_000_000)))));
  }
  await assert.rejects(engine.runJob(job({ exchange: "hyperliquid", market: "ETH", candle: "15m", preset: "optimal", features, startMs: Date.UTC(2026, 7, 10), endMs: Date.UTC(2026, 8, 20), cacheCandles: false })), /latest 5,000 15m candles/);
  assert.throws(() => engine.validateJob(job({ exchange: "hyperliquid", market: "ETH", candle: "5m", preset: "optimal", features })), /choose 15m or larger/);
  const six = await engine.runJob(job({ exchange: "hyperliquid", market: "ETH", candle: "6h", preset: "full", features: ["ret_1h", "log_trades", "funding_rate"], startMs: Date.UTC(2026, 8, 1), endMs: Date.UTC(2026, 8, 20), horizonBars: 4 }));
  const sixRows = (await csvRows(six.blob)).rows;
  assert.ok(sixRows.length > 50 && sixRows.every((r) => Number.isFinite(Number(r[2])) && Number.isFinite(Number(r[3]))), "6h trades (summed from 2h) and hourly funding are finite");
  console.log(`hyperliquid 15m optimal: ${rows.length} rows, ${features.length} features, replay exact; 6h from 2h with trades; history guard and 15m minimum enforced; ${available.length}/${engine.ALL_FEATURES.length} signals available`);
}

// 5. Unavailable features are rejected for Coinbase.
await assert.rejects(() => engine.runJob(job({ exchange: "coinbase", market: "ETH-USD", candle: "1h", features: ["taker_imbalance"] })), /does not publish taker flow/);

console.log("crypto market engine: ok");
