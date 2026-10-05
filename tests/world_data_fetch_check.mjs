// MIT License — Copyright (c) 2026 Decentralized Science Labs
// World data loaded live in the browser, against realistic mocked responses from DataHub (EIA, BLS, Federal Reserve
// H.10, Cboe, Shiller), DBnomics (Federal Reserve H.15, BLS), USGS, NASA EONET and Wikipedia: parsing, the dollar index,
// caching, per-source errors, the scheduled job's fallback copy, and every world data signal computing from the result.
import assert from "node:assert/strict";
import { fetchLiveWorld, SOURCES, DXY_WEIGHTS } from "../src/studio/world_sources.js";
import { addWorldFeatures, WORLD_FEATURES, WORLD_META } from "../src/studio/world_signals.js";
import { buildWorld } from "../scripts/fetch_world_data.mjs";
const DAY = 86_400_000, d0 = Date.UTC(2025, 0, 1) / DAY, toDay = d0 + 400, iso = (d) => new Date(d * DAY).toISOString().slice(0, 10);
const daily = (f, n = 420) => Array.from({ length: n }, (_, i) => [iso(d0 - 20 + i), f(i)]);
const csv = (head, rows) => head + "\n" + rows.map((r) => r.join(",")).join("\n") + "\n";
const months = Array.from({ length: 30 }, (_, i) => iso(Date.UTC(2023, 6 + i, 1) / DAY));
const FX = { Euro: 0.88, Japan: 150, "United Kingdom": 0.76, Canada: 1.38, Sweden: 10.1, Switzerland: 0.84, Brazil: 5.2 };
const bodies = {
  "oil-prices/main/data/wti-daily.csv": csv("Date,Price", daily((i) => (70 + Math.sin(i / 9) * 5).toFixed(2))),
  "oil-prices/main/data/brent-daily.csv": csv("Date,Price", daily((i) => (75 + Math.sin(i / 8) * 5).toFixed(2))),
  "natural-gas/main/data/daily.csv": csv("Date,Price", daily((i) => (3 + Math.sin(i / 7) / 2).toFixed(2))),
  "finance-vix/main/data/vix-daily.csv": csv("DATE,OPEN,HIGH,LOW,CLOSE", daily((i) => [15, 16, 14, (15 + Math.sin(i / 5) * 3).toFixed(2)].join(","))),
  "cpi-us/main/data/cpiai.csv": csv("Date,Index,Inflation", months.map((m, i) => [m, (300 * 1.003 ** i).toFixed(3), "0.3"])),
  "s-and-p-500/main/data/data.csv": csv("Date,SP500,Dividend", [...months.map((m, i) => [m, (5000 + i * 40).toFixed(2), "0"]), [iso(Date.UTC(2026, 0, 1) / DAY), "0.0", "0.0"]]),
  "gold-prices/main/data/monthly.csv": csv("Date,Price", months.map((m, i) => [m.slice(0, 7), (2000 + i * 30).toFixed(1)])),
  "exchange-rates/main/data/daily.csv": csv("Date,Country,Exchange rate", daily((i) => i).flatMap(([date, i]) => Object.entries(FX).map(([c, v]) => [date, c, (v * (1 + i / 4000)).toFixed(4)]))),
};
const dbn = (vals, monthly = false) => ({ series: { docs: [{ period_start_day: monthly ? months : daily((i) => i).map((r) => r[0]), value: vals } ] } });
const dbnomics = { "FED/H15/RIFLGFCY10_N.B": dbn(daily((i) => (i === 5 ? "NA" : 4 + i / 1000)).map((r) => r[1])), "FED/H15/RIFLGFCY02_N.B": dbn(daily((i) => 3.6 + i / 2000).map((r) => r[1])),
  "FED/H15/RIFSPFF_N.B": dbn(daily((i) => (i < 200 ? 5.33 : 5.08)).map((r) => r[1])), "BLS/ln/LNS14000000": dbn(months.map((m, i) => 4 + (i % 4) / 10), true) };
const quake = (day, mag) => ({ properties: { time: day * DAY + 3_600_000, mag } });
const usgs = { type: "FeatureCollection", features: [quake(d0 + 100, 6.4), quake(d0 + 103, 7.2), quake(d0 + 200, 6.1)] };
const geo = (day, kts) => ({ date: `${iso(day)}T00:00:00Z`, magnitudeValue: kts, magnitudeUnit: kts == null ? null : "kts" });
const eonet = { severeStorms: { events: [{ id: "S1", closed: `${iso(d0 + 106)}T00:00:00Z`, categories: [{ id: "severeStorms" }], geometry: [geo(d0 + 100, 45), geo(d0 + 103, 120), geo(d0 + 105, 80)] },
  { id: "S2", closed: null, categories: [{ id: "severeStorms" }], geometry: [geo(d0 + 390, 60)] }] } };
const wiki = (scale) => ({ items: Array.from({ length: 520 }, (_, i) => ({ timestamp: iso(d0 - 110 + i).replace(/-/g, "") + "00", views: Math.round(scale * (1000 + (i % 30) * 10)) })) });
let calls = 0;
const reply = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => body });
const fetchImpl = async (url) => {
  calls++;
  if (url.startsWith("https://raw.githubusercontent.com/datasets/")) return reply(bodies[url.slice("https://raw.githubusercontent.com/datasets/".length)]);
  if (url.startsWith("https://api.db.nomics.world/v22/series/")) return reply(dbnomics[url.slice(39).split("?")[0]]);
  if (url.startsWith("https://earthquake.usgs.gov/")) return reply(usgs);
  if (url.startsWith("https://eonet.gsfc.nasa.gov/")) return reply(eonet[new URL(url).searchParams.get("category")] || { events: [] });
  if (url.startsWith("https://wikimedia.org/")) return reply(wiki(url.includes("World_War_III") ? 2 : 1));
  throw new Error(`unexpected ${url}`);
};
const keys = Object.keys(SOURCES), cache = new Map();
const { world, errors } = await fetchLiveWorld({ keys, fromDay: d0, toDay, fetchImpl, cache });
assert.deepEqual(errors, {}, "every source loads");
assert.equal(world.series.US10Y.length, 419, "DBnomics NA values are skipped");
assert.equal(world.series.SP500M.length, 30, "the S&P 500 placeholder row with 0 is skipped");
assert.equal(world.series.GOLDM[0][0], Date.UTC(2023, 6, 1) / DAY, "YYYY-MM months parse to their first day");
const fx0 = Object.entries(DXY_WEIGHTS).reduce((a, [c, w]) => a + w * Math.log(FX[c]), 0);
assert.ok(Math.abs(world.series.DOLLAR[0][1] - 50.14348112 * Math.exp(fx0)) < 0.002, "the dollar index uses the DXY formula");
assert.deepEqual(world.storms, [[d0 + 100, d0 + 105, [[d0 + 100, 45], [d0 + 103, 120], [d0 + 105, 80]]], [d0 + 390, d0 + 390, [[d0 + 390, 60]]]], "storms: first day, last day, daily wind track");
const DAYMS = 86_400_000, threeYears = Math.floor(Date.now() / DAYMS) - 3 * 365;
for (const [k, src] of Object.entries(SOURCES)) assert.ok(src.since && Date.parse(src.since) / DAYMS <= threeYears, `${k}: at least 3 years of history (from ${src.since})`);
const v = world.warViews.find(([d]) => d === d0), base = 1000 + (110 % 30) * 10;
assert.equal(v[1], base * 4, "war attention sums the three articles");
const before = calls;
await fetchLiveWorld({ keys, fromDay: d0, toDay, fetchImpl, cache });
assert.equal(calls, before, "a second load in the same session uses the cache");
const blocked = await fetchLiveWorld({ keys: ["US10Y", "WTI"], fromDay: d0, toDay, fetchImpl: async (url) => { if (url.includes("db.nomics")) throw new TypeError("Failed to fetch"); return fetchImpl(url); } });
assert.ok(/DBnomics.*could not reach/.test(blocked.errors.US10Y) && !blocked.errors.WTI, "a source the browser cannot reach is reported by name");
const dataNames = WORLD_FEATURES.filter((n) => WORLD_META[n].needs.length);
const cols = new Map(), store = { wants: (n) => dataNames.includes(n), wantsAny: (ns) => ns.some((n) => dataNames.includes(n)), add: (n, a) => cols.set(n, a) };
const opens = Array.from({ length: 300 }, (_, i) => (d0 + 90 + i) * DAY);  // well after every source's history start
await addWorldFeatures(store, opens, 60, async () => ({ ...world, errors: {} }));
for (const n of dataNames) assert.ok(cols.get(n)?.every(Number.isFinite), `${n} computes from live data`);
const at = (n, day) => cols.get(n)[day - (d0 + 90)];
assert.equal(at("event_storms_active", d0 + 104), 1, "tracked the day before"); assert.equal(at("event_storm_wind_max", d0 + 104), 120); assert.equal(at("event_major_storms_active", d0 + 104), 1);
assert.equal(at("event_storm_wind_max", d0 + 101), 45, "the wind of the day before, not the storm's later peak"); assert.equal(at("event_major_storms_active", d0 + 101), 0);
assert.equal(at("event_storms_active", d0 + 103), 0, "no report the day before (a gap in the track)"); assert.equal(at("event_storms_active", d0 + 150), 0);
assert.equal(at("event_new_storms_7d", d0 + 104), 1); assert.equal(at("event_new_storms_7d", d0 + 120), 0); assert.equal(at("event_quakes_m6_7d", d0 + 104), 2);
assert.ok(Math.abs(at("mkt_fed_funds_chg_90d", d0 + 250) - -0.25) < 1e-9, "a 25 basis point cut shows as -0.25");
const job = await buildWorld({ fetchImpl, now: new Date(toDay * DAY), log() {}, warn() {} });
assert.equal(job.failed, 0); assert.ok(!job.out.series.VIX && !job.out.series.SP500M, "the published copy leaves out licensed index data by default");
const withLicensed = await buildWorld({ fetchImpl, includeLicensed: true, now: new Date(toDay * DAY), log() {}, warn() {} });
assert.ok(withLicensed.out.series.VIX.length && withLicensed.out.series.SP500M.length);
const kept = await buildWorld({ fetchImpl: async (url) => { if (url.includes("usgs")) throw new Error("down"); return fetchImpl(url); }, old: { sources: { QUAKES: "USGS" }, quakes: [[1, 6.5]] }, now: new Date(toDay * DAY), log() {}, warn() {} });
assert.deepEqual(kept.out.quakes, [[1, 6.5]], "the job keeps the previous copy of a failing source");
console.log(`live world data: ${keys.length} sources (DataHub, DBnomics, USGS, NASA EONET, Wikipedia) parsed from realistic responses; dollar index by the DXY formula; cached per session; blocked sources named; ${dataNames.length} world data signals compute; the published copy keeps failing sources and leaves out licensed data`);
