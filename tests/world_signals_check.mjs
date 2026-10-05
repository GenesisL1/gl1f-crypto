// MIT License — Copyright (c) 2026 Decentralized Science Labs
// World signals: holidays, Fed and election calendars, Moon phases and planetary retrogrades against known dates,
// public-data lags (no look-ahead) and clear errors when data is missing; every signal has a plain name.
import assert from "node:assert/strict";
import { WORLD_FEATURES, WORLD_META, addWorldFeatures, usMarketHolidays, isRetrograde, moonElongation } from "../src/studio/world_signals.js";
import { featureLabel } from "../src/studio/feature_labels.js";
import { loadMarketWorker } from "../scripts/lib/market_worker_node.mjs";
const { ALL_FEATURES } = loadMarketWorker();
const DAY = 86_400_000, at = (s, h = 12) => Date.parse(`${s}T${String(h).padStart(2, "0")}:00:00Z`);
const fmt = (d) => new Date(d * DAY).toISOString().slice(0, 10);
assert.deepEqual(usMarketHolidays(2025).map(fmt), ["2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26", "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25"]);
assert.ok(usMarketHolidays(2022).map(fmt).includes("2022-06-20") && usMarketHolidays(2021).map(fmt).includes("2021-12-24") && !usMarketHolidays(2021).map(fmt).includes("2021-12-31"), "observed-day rules");
const elong = (s) => moonElongation(at(s));
for (const s of ["2025-01-13", "2025-02-12", "2025-03-14", "2025-04-13", "2025-05-12", "2025-06-11", "2025-07-10", "2025-08-09", "2025-09-07", "2025-10-07", "2025-11-05", "2025-12-04"])
  assert.ok(Math.abs(elong(s) - 180) < 13, `full moon ${s}: elongation ${elong(s).toFixed(1)}`);
for (const s of ["2025-01-29", "2025-02-28", "2025-03-29", "2025-04-27", "2025-05-27", "2025-06-25", "2025-07-24", "2025-08-23", "2025-09-21", "2025-10-21", "2025-11-20", "2025-12-20"])
  assert.ok(Math.min(elong(s), 360 - elong(s)) < 13, `new moon ${s}: elongation ${elong(s).toFixed(1)}`);
const retro = (body, s) => isRetrograde(body, at(s));
for (const [a, b] of [["2024-04-01", "2024-04-25"], ["2024-08-05", "2024-08-28"], ["2024-11-26", "2024-12-15"], ["2025-03-15", "2025-04-07"], ["2025-07-18", "2025-08-11"], ["2025-11-09", "2025-11-29"]]) {
  const mid = new Date((at(a) + at(b)) / 2).toISOString().slice(0, 10), before = new Date(at(a) - 4 * DAY).toISOString().slice(0, 10), after = new Date(at(b) + 4 * DAY).toISOString().slice(0, 10);
  assert.ok(retro("mercury", mid) && !retro("mercury", before) && !retro("mercury", after), `Mercury retrograde ${a} to ${b}`);
}
assert.ok(retro("venus", "2025-03-20") && !retro("venus", "2025-02-20") && !retro("venus", "2025-04-25"), "Venus retrograde March-April 2025");
assert.ok(retro("mars", "2025-01-10") && !retro("mars", "2024-11-25") && !retro("mars", "2025-03-05"), "Mars retrograde December 2024 to February 2025");
const store = (names) => ({ cols: new Map(), wants(n) { return names.includes(n); }, wantsAny(ns) { return ns.some((n) => names.includes(n)); }, add(n, a) { this.cols.set(n, a); } });
const calNames = WORLD_FEATURES.filter((n) => !WORLD_META[n].needs.length), s1 = store(calNames);
const opens = ["2025-09-17", "2025-09-10", "2024-11-05", "2025-01-29", "2025-10-03", "2025-09-19", "2025-10-17", "2026-10-02", "2025-07-03", "2025-06-15", "2022-02-26"].map((d) => at(d, 11));
await addWorldFeatures(s1, opens, 60, async () => { throw new Error("no data needed"); });
const v = (name, i) => s1.cols.get(name)[i];
assert.equal(v("cal_fomc_day", 0), 1); assert.equal(v("cal_days_to_fomc", 1), 7); assert.equal(v("cal_us_election_week", 2), 1); assert.equal(v("cal_lunar_new_year", 3), 1);
assert.equal(v("cal_china_golden_week", 4), 1); assert.equal(v("cal_us_jobs_day", 4), 1); assert.equal(v("cal_options_expiry", 5), 1); assert.equal(v("cal_quarterly_expiry", 5), 1);
assert.equal(v("cal_options_expiry", 6), 1); assert.equal(v("cal_quarterly_expiry", 6), 0); assert.equal(v("cal_days_to_us_election", 7), 32); assert.equal(v("cal_us_holiday_eve", 8), 1);
assert.equal(v("cal_us_dst", 9), 1); assert.equal(v("event_war_escalation_week", 10), 1); assert.equal(v("event_days_since_war_escalation", 10), 2);
for (const name of calNames) assert.ok(s1.cols.get(name).every(Number.isFinite), `${name} finite`);
const world = { series: { US10Y: [[20000, 4.0], [20001, 4.1], [20002, 9.9]], US2Y: [[20000, 3.5], [20001, 3.6], [20002, 3.7]] }, quakes: [[20001 * DAY + 3600_000, 6.5], [20002 * DAY, 7.1]],
  storms: [[20000, 20003, [[20000, 60], [20002, 90], [20003, 130]]]], warViews: [], sources: { US10Y: "DBnomics", US2Y: "DBnomics", QUAKES: "USGS", EONET: "NASA EONET" }, errors: {} };
const s2 = store(["mkt_us10y", "mkt_yield_curve", "event_quakes_m6_7d", "event_quake_max_7d", "event_storms_active", "event_storm_wind_max"]);
await addWorldFeatures(s2, [20003 * DAY + 600_000 - 3600_000], 60, async () => world);
assert.equal(s2.cols.get("mkt_us10y")[0], 4.1, "a daily value counts from two days after its date, never the same day");
assert.ok(Math.abs(s2.cols.get("mkt_yield_curve")[0] - 0.5) < 1e-9);
assert.equal(s2.cols.get("event_quakes_m6_7d")[0], 2); assert.equal(s2.cols.get("event_quake_max_7d")[0], 7.1);
assert.equal(s2.cols.get("event_storms_active")[0], 1); assert.equal(s2.cols.get("event_storm_wind_max")[0], 90);
await assert.rejects(addWorldFeatures(store(["mkt_fed_funds"]), [20003 * DAY], 60, async () => ({ ...world, errors: { FEDFUNDS: "DBnomics (Federal Reserve H.15, effective federal funds rate): this browser could not reach it" } })), /Could not load public data in this browser: DBnomics/);
for (const name of ALL_FEATURES) assert.notEqual(featureLabel(name), name, `${name} has a plain name`);
const s3 = store(["event_war_attention"]);
await assert.rejects(addWorldFeatures(s3, [Date.UTC(2015, 0, 5)], 60, async () => world), /Not enough history for War attention \(data from 2015-07\): start the dataset on or after 2015-10-09/);
const s4 = store(["cal_days_to_fomc"]);
await assert.rejects(addWorldFeatures(s4, [Date.UTC(2013, 5, 1)], 60, async () => world), /Not enough history/, "list-based signals start in 2014");
console.log(`world signals: ${WORLD_FEATURES.length} new signals (${calNames.length} computed, ${WORLD_FEATURES.length - calNames.length} from public data); holidays, Fed and election calendars, Moon phases and Mercury/Venus/Mars retrogrades match known dates; no look-ahead; ${ALL_FEATURES.length} signals with plain names.`);
