// MIT License — Copyright (c) 2026 Decentralized Science Labs
// World signals for Crypto AI models: holidays and events, astronomy, macro and markets, disasters and conflict.
// Holidays, events and astronomy are computed from each candle's close time and need no data. Macro, markets,
// disasters and war-news signals read data/world.json, refreshed from public sources at deployment
// (scripts/fetch_world_data.mjs). Every value uses only what was known when the candle closed.

const DAY = 86_400_000;
const dayOf = (ms) => Math.floor(ms / DAY);
const isoDay = (s) => dayOf(Date.parse(`${s}T00:00:00Z`));
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI, wrap360 = (x) => ((x % 360) + 360) % 360;

// ---------------- curated calendars (UTC dates; update once a year) ----------------
export const FOMC_DECISIONS = `2014-01-29 2014-03-19 2014-04-30 2014-06-18 2014-07-30 2014-09-17 2014-10-29 2014-12-17 2015-01-28 2015-03-18 2015-04-29 2015-06-17
2015-07-29 2015-09-17 2015-10-28 2015-12-16 2016-01-27 2016-03-16 2016-04-27 2016-06-15 2016-07-27 2016-09-21 2016-11-02 2016-12-14
2017-02-01 2017-03-15 2017-05-03 2017-06-14 2017-07-26 2017-09-20 2017-11-01 2017-12-13 2018-01-31 2018-03-21 2018-05-02 2018-06-13
2018-08-01 2018-09-26 2018-11-08 2018-12-19 2019-01-30 2019-03-20 2019-05-01 2019-06-19 2019-07-31 2019-09-18 2019-10-30 2019-12-11
2020-01-29 2020-03-03 2020-03-15 2020-04-29 2020-06-10 2020-07-29 2020-09-16 2020-11-05 2020-12-16 2021-01-27 2021-03-17 2021-04-28
2021-06-16 2021-07-28 2021-09-22 2021-11-03 2021-12-15 2022-01-26 2022-03-16 2022-05-04 2022-06-15 2022-07-27 2022-09-21 2022-11-02
2022-12-14 2023-02-01 2023-03-22 2023-05-03 2023-06-14 2023-07-26 2023-09-20 2023-11-01 2023-12-13 2024-01-31 2024-03-20 2024-05-01
2024-06-12 2024-07-31 2024-09-18 2024-11-07 2024-12-18 2025-01-29 2025-03-19 2025-05-07 2025-06-18 2025-07-30 2025-09-17 2025-10-29
2025-12-10 2026-01-28 2026-03-18 2026-04-29 2026-06-17 2026-07-29 2026-09-16 2026-10-28 2026-12-09`.split(/\s+/).map(isoDay);
export const LUNAR_NEW_YEAR = `2014-01-31 2015-02-19 2016-02-08 2017-01-28 2018-02-16 2019-02-05 2020-01-25 2021-02-12 2022-02-01 2023-01-22
2024-02-10 2025-01-29 2026-02-17 2027-02-06 2028-01-26 2029-02-13 2030-02-03`.split(/\s+/).map(isoDay);
export const WORLD_ELECTIONS = [["2014-05-16", "India: general election results"], ["2014-10-26", "Brazil: presidential run-off"], ["2014-12-14", "Japan: general election"],
  ["2015-05-07", "United Kingdom: general election"], ["2016-06-23", "United Kingdom: EU referendum"], ["2017-05-07", "France: presidential run-off"], ["2017-09-24", "Germany: federal election"],
  ["2018-07-01", "Mexico: general election"], ["2018-10-28", "Brazil: presidential run-off"], ["2019-05-23", "India: general election results"], ["2019-12-12", "United Kingdom: general election"],
  ["2020-01-11", "Taiwan: presidential election"], ["2021-09-26", "Germany: federal election"], ["2022-03-09", "South Korea: presidential election"], ["2022-04-24", "France: presidential run-off"],
  ["2022-10-30", "Brazil: presidential run-off"], ["2023-05-28", "Turkey: presidential run-off"], ["2024-01-13", "Taiwan: presidential election"], ["2024-06-02", "Mexico: general election"],
  ["2024-06-04", "India: general election results"], ["2024-06-09", "European Union: parliament election"], ["2024-07-04", "United Kingdom: general election"],
  ["2024-10-27", "Japan: general election"], ["2025-02-23", "Germany: federal election"], ["2025-06-03", "South Korea: presidential election"]].map(([d, what]) => [isoDay(d), what]);
export const WAR_ESCALATIONS = [["2014-02-27", "Russia seizes Crimea"], ["2020-01-03", "US strike kills Iran's Qasem Soleimani"], ["2022-02-24", "Russia's full-scale invasion of Ukraine"],
  ["2023-10-07", "Hamas attacks Israel; Israel-Hamas war"], ["2024-04-13", "Iran's drone and missile attack on Israel"], ["2024-10-01", "Iran's ballistic missile attack on Israel"],
  ["2025-05-07", "India strikes Pakistan"], ["2025-06-13", "Israel strikes Iran; twelve-day war"], ["2025-06-22", "US strikes Iran's nuclear sites"]].map(([d, what]) => [isoDay(d), what]);

// ---------------- the catalogue: [name, label, group, note, data series needed] ----------------
const H = "Holidays & events", A = "Astronomy", M = "Macro & markets", E = "Disasters & conflict";
const ROWS = [
  ["cal_us_holiday", "US market holiday", H, "1 on New York Stock Exchange holidays (US Eastern date).", []],
  ["cal_us_holiday_eve", "Day before a US market holiday", H, "1 on the trading day before an NYSE holiday.", []],
  ["cal_days_to_us_holiday", "Days to the next US market holiday", H, "Calendar days, capped at 30.", []],
  ["cal_fomc_day", "Fed decision day (FOMC)", H, "1 on the day the Federal Reserve announces its rate decision.", []],
  ["cal_days_to_fomc", "Days to the next Fed decision", H, "Calendar days to the next FOMC decision, capped at 60.", []],
  ["cal_days_since_fomc", "Days since the last Fed decision", H, "Calendar days since the last FOMC decision, capped at 60.", []],
  ["cal_us_election_week", "US election week", H, "1 within 3 days of a US federal election day (even years).", []],
  ["cal_days_to_us_election", "Days to the next US election", H, "Calendar days to the next US federal election day, capped at 365.", []],
  ["cal_world_election_week", "Major election week worldwide", H, "1 within 3 days of a major election (UK, EU, France, Germany, India, Japan, Korea, Taiwan, Brazil, Mexico, Turkey).", []],
  ["cal_lunar_new_year", "Lunar New Year holidays", H, "1 from 2 days before to 6 days after Lunar New Year (China, Hong Kong, Singapore, Korea, Vietnam).", []],
  ["cal_china_golden_week", "China Golden Week", H, "1 from 1 to 7 October.", []],
  ["cal_japan_golden_week", "Japan Golden Week", H, "1 from 29 April to 5 May.", []],
  ["cal_asia_holiday", "Major Asian holiday", H, "1 during Lunar New Year, China or Japan Golden Week, or Japan's New Year (1 to 3 January).", []],
  ["cal_christmas_new_year", "Christmas to New Year", H, "1 from 24 December to 1 January.", []],
  ["cal_options_expiry", "Monthly options expiry", H, "1 on the third Friday of the month.", []],
  ["cal_quarterly_expiry", "Quarterly expiry (triple witching)", H, "1 on the third Friday of March, June, September and December.", []],
  ["cal_us_jobs_day", "US jobs report day", H, "1 on the first Friday of the month, the usual US jobs report day.", []],
  ["cal_days_to_month_end", "Days to month end", H, "Calendar days to the last day of the month.", []],
  ["cal_days_to_quarter_end", "Days to quarter end", H, "Calendar days to the last day of the quarter.", []],
  ["cal_year_sin", "Season of the year (sine)", H, "Day of the year on a circle.", []],
  ["cal_year_cos", "Season of the year (cosine)", H, "Day of the year on a circle.", []],
  ["cal_us_dst", "US daylight saving time", H, "1 while US clocks are on daylight saving time.", []],
  ["astro_moon_phase", "Moon phase", A, "0 at new moon, 0.5 at full moon, back to 1 at the next new moon.", []],
  ["astro_moon_illumination", "Moon illumination", A, "Lit fraction of the Moon, 0 to 1.", []],
  ["astro_days_to_full_moon", "Days to the next full moon", A, "Days, 0 to about 29.5.", []],
  ["astro_days_to_new_moon", "Days to the next new moon", A, "Days, 0 to about 29.5.", []],
  ["astro_full_moon", "Full moon", A, "1 within a day of full moon.", []],
  ["astro_new_moon", "New moon", A, "1 within a day of new moon.", []],
  ["astro_mercury_retrograde", "Mercury retrograde", A, "1 while Mercury appears to move backwards against the stars, seen from Earth.", []],
  ["astro_venus_retrograde", "Venus retrograde", A, "1 while Venus appears to move backwards, seen from Earth.", []],
  ["astro_mars_retrograde", "Mars retrograde", A, "1 while Mars appears to move backwards, seen from Earth.", []],
  ["astro_retrograde_count", "Planets in retrograde", A, "How many of Mercury, Venus, Mars, Jupiter and Saturn appear to move backwards.", []],
  ["astro_planet_spread", "Planetary alignment", A, "Smallest arc of sky holding Mercury to Saturn, as a share of the full circle: lower means more aligned.", []],
  ["astro_days_to_season", "Days to the next equinox or solstice", A, "Days to the nearest equinox or solstice (Sun's position).", []],
  ["mkt_us10y", "US 10-year Treasury yield", M, "Percent, as published 2 days earlier (Federal Reserve H.15 via DBnomics).", ["US10Y"]],
  ["mkt_us10y_chg_20d", "US 10-year yield, 20-day change", M, "Percentage points over 20 trading days (Federal Reserve H.15 via DBnomics).", ["US10Y"]],
  ["mkt_us2y", "US 2-year Treasury yield", M, "Percent (Federal Reserve H.15 via DBnomics).", ["US2Y"]],
  ["mkt_yield_curve", "Yield curve (10-year minus 2-year)", M, "Percentage points; negative means an inverted curve (Federal Reserve H.15 via DBnomics).", ["US10Y", "US2Y"]],
  ["mkt_fed_funds", "Fed funds rate", M, "Effective federal funds rate, percent (Federal Reserve H.15 via DBnomics).", ["FEDFUNDS"]],
  ["mkt_fed_funds_chg_90d", "Fed funds rate, 90-day change", M, "Percentage points over 90 days: hikes positive, cuts negative (Federal Reserve H.15 via DBnomics).", ["FEDFUNDS"]],
  ["mkt_wti_ret_5d", "Oil (WTI), 5-day change", M, "Percent change of the WTI spot price over 5 trading days (EIA via DataHub).", ["WTI"]],
  ["mkt_wti_ret_20d", "Oil (WTI), 20-day change", M, "Percent change over 20 trading days (EIA via DataHub).", ["WTI"]],
  ["mkt_brent_ret_5d", "Oil (Brent), 5-day change", M, "Percent change of the Brent spot price over 5 trading days (EIA via DataHub).", ["BRENT"]],
  ["mkt_natgas_ret_5d", "Natural gas, 5-day change", M, "Percent change of the Henry Hub spot price over 5 trading days (EIA via DataHub).", ["NATGAS"]],
  ["mkt_dollar_ret_20d", "US dollar index, 20-day change", M, "Percent change over 20 trading days of the dollar index (DXY weights) built from Federal Reserve H.10 exchange rates (via DataHub).", ["DOLLAR"]],
  ["mkt_vix", "VIX volatility index", M, "Daily close, as published 2 days earlier (Cboe via DataHub).", ["VIX"]],
  ["mkt_vix_chg_5d", "VIX, 5-day change", M, "Points over 5 trading days (Cboe via DataHub).", ["VIX"]],
  ["mkt_spx_ret_1m", "S&P 500, last month's change", M, "Percent change of the monthly average, counted from 40 days after the month (Robert Shiller's data via DataHub).", ["SP500M"]],
  ["mkt_spx_drawdown_12m", "S&P 500 below its 12-month high", M, "Percent below the highest monthly average of the last 12 months (Shiller via DataHub).", ["SP500M"]],
  ["mkt_gold_ret_1m", "Gold, last month's change", M, "Percent change of the monthly gold price, counted from 40 days after the month (via DataHub).", ["GOLDM"]],
  ["macro_cpi_yoy", "US inflation (CPI, year over year)", M, "Percent, counted from 45 days after the month it measures (BLS CPI-U via DataHub).", ["CPI"]],
  ["macro_unemployment", "US unemployment rate", M, "Percent, counted from 40 days after the month it measures (BLS via DBnomics).", ["UNRATE"]],
  ["event_quakes_m6_7d", "Strong earthquakes (M6+), last 7 days", E, "Count worldwide (USGS).", ["QUAKES"]],
  ["event_quake_max_7d", "Largest earthquake, last 7 days", E, "Highest magnitude of M6+ earthquakes worldwide, 0 if none (USGS).", ["QUAKES"]],
  ["event_quakes_m7_30d", "Major earthquakes (M7+), last 30 days", E, "Count worldwide (USGS).", ["QUAKES"]],
  ["event_storms_active", "Active hurricanes, typhoons and cyclones", E, "Tropical storms tracked the day before (NASA EONET).", ["EONET"]],
  ["event_storm_wind_max", "Strongest active storm (wind)", E, "Highest wind reported the day before among active tropical storms, in knots; 0 if none (NASA EONET).", ["EONET"]],
  ["event_major_storms_active", "Major hurricanes and typhoons", E, "Tropical storms with winds of 96 knots or more the day before: category 3 or stronger (NASA EONET).", ["EONET"]],
  ["event_new_storms_7d", "New tropical storms, last 7 days", E, "Tropical storms first tracked in the last 7 days (NASA EONET).", ["EONET"]],
  ["event_war_attention", "War attention", E, "Wikipedia views of War, World War III and Nuclear warfare the day before, versus their 90-day average.", ["WARVIEWS"]],
  ["event_days_since_war_escalation", "Days since a major war escalation", E, "Days since the latest major escalation in the built-in list, capped at 365.", []],
  ["event_war_escalation_week", "Week after a major war escalation", E, "1 during the 7 days after a major escalation (Ukraine, Israel and Gaza, Iran, India and Pakistan).", []],
];
// History: every world signal has years of data behind it. Data signals start when their sources do; signals from the
// built-in Fed, election, holiday and war lists start in February 2014 (before the oldest exchange candles, 2015).
export const LIST_SINCE = "2014-02-01";
const LIST_SIGNALS = new Set(["cal_fomc_day", "cal_days_to_fomc", "cal_days_since_fomc", "cal_world_election_week", "cal_lunar_new_year", "cal_asia_holiday", "event_days_since_war_escalation", "event_war_escalation_week"]);
const sinceOf = (needs, name) => needs.length ? needs.map((k) => SOURCES[k].since).sort().pop() : LIST_SIGNALS.has(name) ? LIST_SINCE : null;
export const WORLD_META = Object.fromEntries(ROWS.map(([name, label, group, note, needs]) => { const since = sinceOf(needs, name); return [name, { label, group, needs, since, note: since ? `${note} History from ${since.slice(0, 4)}.` : note }]; }));
// Days of history a signal needs before its first value is complete (changes, averages, year-over-year).
const LOOKBACK = { mkt_us10y_chg_20d: 35, mkt_fed_funds_chg_90d: 100, mkt_wti_ret_5d: 14, mkt_wti_ret_20d: 35, mkt_brent_ret_5d: 14, mkt_natgas_ret_5d: 14, mkt_dollar_ret_20d: 35, mkt_vix_chg_5d: 14,
  mkt_spx_ret_1m: 80, mkt_spx_drawdown_12m: 420, mkt_gold_ret_1m: 80, macro_cpi_yoy: 420, macro_unemployment: 45, event_quakes_m6_7d: 8, event_quake_max_7d: 8, event_quakes_m7_30d: 31, event_war_attention: 100, event_new_storms_7d: 8 };
export const historyStart = (name) => { const s = WORLD_META[name]?.since; return s ? dayOf(Date.parse(`${s}T00:00:00Z`)) + (LOOKBACK[name] ?? 3) : null; };
export const WORLD_FEATURES = ROWS.map((r) => r[0]);
export { fetchLiveWorld, hasWorldKey, mergeWorldKey, SOURCES } from "./world_sources.js";
import { hasWorldKey, SOURCES } from "./world_sources.js";
// World data signals are always offered: their public data is fetched live in the browser when a dataset is built.
export function worldAvailability(features) {
  return features.map((f) => {
    const needs = WORLD_META[f.name]?.needs;
    return needs?.length ? { ...f, available: true, requires: `live public data: ${[...new Set(needs.map((k) => SOURCES[k].via))].join(", ")}` } : f;
  });
}

// ---------------- calendar helpers ----------------
function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return dayOf(Date.UTC(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1));
}
const weekday = (day) => new Date(day * DAY).getUTCDay();
function nthWeekday(y, month, dow, n) { const first = weekday(dayOf(Date.UTC(y, month, 1))); return dayOf(Date.UTC(y, month, 1)) + ((dow - first + 7) % 7) + 7 * (n - 1); }
function lastWeekday(y, month, dow) { const last = dayOf(Date.UTC(y, month + 1, 0)); return last - ((weekday(last) - dow + 7) % 7); }
// New York Stock Exchange holidays (rules since 2022 include Juneteenth).
export function usMarketHolidays(y) {
  const d = (m, day) => dayOf(Date.UTC(y, m, day)), observed = (day) => (weekday(day) === 6 ? day - 1 : weekday(day) === 0 ? day + 1 : day);
  const out = [], ny = d(0, 1);
  if (weekday(ny) === 0) out.push(ny + 1); else if (weekday(ny) !== 6) out.push(ny);
  out.push(nthWeekday(y, 0, 1, 3), nthWeekday(y, 1, 1, 3), easterSunday(y) - 2, lastWeekday(y, 4, 1));
  if (y >= 2022) out.push(observed(d(5, 19)));
  out.push(observed(d(6, 4)), nthWeekday(y, 8, 1, 1), nthWeekday(y, 10, 4, 4), observed(d(11, 25)));
  return out.sort((a, b) => a - b);
}
const usElectionDay = (y) => nthWeekday(y, 10, 1, 1) + 1; // the Tuesday after the first Monday of November
function usDst(ms) {
  const y = new Date(ms).getUTCFullYear();
  const start = nthWeekday(y, 2, 0, 2) * DAY + 7 * 3600_000, end = nthWeekday(y, 10, 0, 1) * DAY + 6 * 3600_000;
  return ms >= start && ms < end ? 1 : 0;
}
const nextIn = (sorted, day) => { for (const x of sorted) if (x >= day) return x; return null; };
const prevIn = (sorted, day) => { let p = null; for (const x of sorted) { if (x > day) break; p = x; } return p; };

// ---------------- astronomy (JPL approximate planetary elements, low-precision Moon) ----------------
const ELEMENTS = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  mars: [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
};
const centuries = (ms) => (ms / DAY + 2440587.5 - 2451545.0) / 36525;
function helio(body, T) {
  const [e0, r] = ELEMENTS[body], a = e0[0] + r[0] * T, e = e0[1] + r[1] * T, I = rad(e0[2] + r[2] * T), L = e0[3] + r[3] * T, wbar = e0[4] + r[4] * T, node = e0[5] + r[5] * T;
  const M = rad(wrap360(L - wbar + 180) - 180), w = rad(wbar - node), O = rad(node);
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E), cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I);
  return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp, (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp];
}
export function geocentricLongitude(body, ms) {
  const T = centuries(ms), p = helio(body, T), e = helio("earth", T);
  return wrap360(deg(Math.atan2(p[1] - e[1], p[0] - e[0])));
}
export function sunLongitude(ms) { const e = helio("earth", centuries(ms)); return wrap360(deg(Math.atan2(-e[1], -e[0]))); }
export function isRetrograde(body, ms) {
  const d = geocentricLongitude(body, ms + DAY / 2) - geocentricLongitude(body, ms - DAY / 2);
  return wrap360(d + 180) - 180 < 0;
}
// Moon-Sun elongation from a low-precision lunar theory (error well under a degree, about an hour in phase timing).
export function moonElongation(ms) {
  const d = ms / DAY + 2440587.5 - 2451545.0;
  const Lm = 218.316 + 13.176396 * d, Mm = rad(134.963 + 13.064993 * d), D = rad(297.85 + 12.190749 * d), Ms = rad(357.529 + 0.98560028 * d), F = rad(93.272 + 13.22935 * d);
  const moon = Lm + 6.289 * Math.sin(Mm) + 1.274 * Math.sin(2 * D - Mm) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * Mm) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F);
  return wrap360(moon - sunLongitude(ms));
}
const SYNODIC = 29.530588853;

// ---------------- data helpers (world.json) ----------------
function series(world, key) {
  const rows = world?.series?.[key];
  if (!Array.isArray(rows) || !rows.length) return null;
  return { day: Int32Array.from(rows, (x) => x[0]), val: Float64Array.from(rows, (x) => x[1]) };
}
function asOf(s, day) { let lo = 0, hi = s.day.length - 1, ans = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (s.day[mid] <= day) { ans = mid; lo = mid + 1; } else hi = mid - 1; } return ans; }
const pct = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (100 * (a - b)) / Math.abs(b) : 0);

// Adds every selected world signal to the store. openTimes are candle open times (ms); a candle's signal time is its close.
export async function addWorldFeatures(store, openTimes, candleMinutes, loadWorld) {
  const wanted = WORLD_FEATURES.filter((name) => store.wants(name));
  if (!wanted.length) return;
  const n = openTimes.length, close = new Float64Array(n);
  for (let i = 0; i < n; i++) close[i] = Number(openTimes[i]) + candleMinutes * 60_000;
  const col = (fn) => { const out = new Float64Array(n); for (let i = 0; i < n; i++) out[i] = fn(i, close[i], dayOf(close[i])); return out; };
  const firstDay = dayOf(close[0]), early = wanted.filter((name) => historyStart(name) !== null && firstDay < historyStart(name));
  if (early.length) {
    const from = new Date(Math.max(...early.map(historyStart)) * DAY).toISOString().slice(0, 10);
    throw new Error(`Not enough history for ${early.map((n) => `${WORLD_META[n].label} (data from ${WORLD_META[n].since.slice(0, 7)})`).join(", ")}: start the dataset on or after ${from}, or deselect ${early.length === 1 ? "it" : "them"}.`);
  }
  const keys = [...new Set(wanted.flatMap((name) => WORLD_META[name].needs))];
  const world = keys.length ? await loadWorld({ keys, fromDay: dayOf(close[0]), toDay: dayOf(close[n - 1]) }) : null;
  if (keys.length) {
    const missing = keys.filter((k) => !hasWorldKey(world, k));
    if (missing.length) throw new Error(`Could not load public data in this browser: ${[...new Set(missing.map((k) => world?.errors?.[k] || SOURCES[k]?.via || k))].join("; ")}. Check the connection and try again, or deselect those world signals.`);
  }
  const want = (name) => wanted.includes(name);
  const years = [...new Set(Array.from(close, (t) => new Date(t).getUTCFullYear()))].flatMap((y) => [y - 1, y, y + 1]);
  const yearsSet = [...new Set(years)].sort();
  // Holidays and events
  const holidays = [...new Set(yearsSet.flatMap(usMarketHolidays))].sort((a, b) => a - b);
  const holidaySet = new Set(holidays), et = (t) => dayOf(t - 5 * 3600_000);
  const nextTradingDay = (day) => { let x = day + 1; while (weekday(x) === 0 || weekday(x) === 6 || holidaySet.has(x)) x++; return x; };
  const elections = yearsSet.filter((y) => y % 2 === 0).map(usElectionDay).sort((a, b) => a - b);
  const lunar = LUNAR_NEW_YEAR, worldElections = WORLD_ELECTIONS.map((x) => x[0]), wars = WAR_ESCALATIONS.map((x) => x[0]);
  const near = (list, day, before, after) => list.some((x) => day >= x - before && day <= x + after) ? 1 : 0;
  const monthDay = (t) => { const d = new Date(t); return [d.getUTCMonth(), d.getUTCDate(), d.getUTCFullYear()]; };
  const thirdFriday = (t) => { const d = new Date(t); return d.getUTCDay() === 5 && d.getUTCDate() >= 15 && d.getUTCDate() <= 21; };
  const F = {
    cal_us_holiday: (i, t) => (holidaySet.has(et(t)) ? 1 : 0),
    cal_us_holiday_eve: (i, t) => { const d = et(t); return weekday(d) !== 0 && weekday(d) !== 6 && !holidaySet.has(d) && holidaySet.has(d + 1) ? 1 : (holidaySet.has(nextTradingDay(d) - 1) && nextTradingDay(d) - d > 1 && weekday(d) === 5 && holidaySet.has(d + 3) ? 1 : 0); },
    cal_days_to_us_holiday: (i, t) => { const n2 = nextIn(holidays, et(t)); return n2 === null ? 30 : Math.min(30, n2 - et(t)); },
    cal_fomc_day: (i, t, d) => (FOMC_DECISIONS.includes(d) ? 1 : 0),
    cal_days_to_fomc: (i, t, d) => { const n2 = nextIn(FOMC_DECISIONS, d); return n2 === null ? 60 : Math.min(60, n2 - d); },
    cal_days_since_fomc: (i, t, d) => { const p = prevIn(FOMC_DECISIONS, d); return p === null ? 60 : Math.min(60, d - p); },
    cal_us_election_week: (i, t, d) => near(elections, d, 3, 3),
    cal_days_to_us_election: (i, t, d) => { const n2 = nextIn(elections, d); return n2 === null ? 365 : Math.min(365, n2 - d); },
    cal_world_election_week: (i, t, d) => near(worldElections, d, 3, 3),
    cal_lunar_new_year: (i, t, d) => near(lunar, d, 2, 6),
    cal_china_golden_week: (i, t) => { const [m, day] = monthDay(t); return m === 9 && day <= 7 ? 1 : 0; },
    cal_japan_golden_week: (i, t) => { const [m, day] = monthDay(t); return (m === 3 && day >= 29) || (m === 4 && day <= 5) ? 1 : 0; },
    cal_asia_holiday: (i, t, d) => { const [m, day] = monthDay(t); return near(lunar, d, 2, 6) || (m === 9 && day <= 7) || (m === 3 && day >= 29) || (m === 4 && day <= 5) || (m === 0 && day <= 3) ? 1 : 0; },
    cal_christmas_new_year: (i, t) => { const [m, day] = monthDay(t); return (m === 11 && day >= 24) || (m === 0 && day === 1) ? 1 : 0; },
    cal_options_expiry: (i, t) => (thirdFriday(t) ? 1 : 0),
    cal_quarterly_expiry: (i, t) => (thirdFriday(t) && [2, 5, 8, 11].includes(new Date(t).getUTCMonth()) ? 1 : 0),
    cal_us_jobs_day: (i, t) => { const d = new Date(t); return d.getUTCDay() === 5 && d.getUTCDate() <= 7 ? 1 : 0; },
    cal_days_to_month_end: (i, t, d) => { const [m, , y] = monthDay(t); return dayOf(Date.UTC(y, m + 1, 0)) - d; },
    cal_days_to_quarter_end: (i, t, d) => { const [m, , y] = monthDay(t); return dayOf(Date.UTC(y, Math.floor(m / 3) * 3 + 3, 0)) - d; },
    cal_year_sin: (i, t) => { const [, , y] = monthDay(t), start = Date.UTC(y, 0, 1), len = Date.UTC(y + 1, 0, 1) - start; return Math.sin((2 * Math.PI * (t - start)) / len); },
    cal_year_cos: (i, t) => { const [, , y] = monthDay(t), start = Date.UTC(y, 0, 1), len = Date.UTC(y + 1, 0, 1) - start; return Math.cos((2 * Math.PI * (t - start)) / len); },
    cal_us_dst: (i, t) => usDst(t),
    event_days_since_war_escalation: (i, t, d) => { const p = prevIn(wars, d - 1); return p === null ? 365 : Math.min(365, d - p); },
    event_war_escalation_week: (i, t, d) => (wars.some((x) => d - x >= 1 && d - x <= 7) ? 1 : 0),
  };
  // Astronomy: Moon per candle; planets once per day at noon UTC.
  const daily = new Map(), dayAstro = (d) => {
    if (!daily.has(d)) {
      const noon = d * DAY + DAY / 2, retro = ["mercury", "venus", "mars", "jupiter", "saturn"].map((b) => isRetrograde(b, noon));
      const lons = ["mercury", "venus", "mars", "jupiter", "saturn"].map((b) => geocentricLongitude(b, noon)).sort((a, b) => a - b);
      let gap = 360 - lons[lons.length - 1] + lons[0];
      for (let k = 1; k < lons.length; k++) gap = Math.max(gap, lons[k] - lons[k - 1]);
      const s = sunLongitude(noon), toSeason = Math.min(...[0, 90, 180, 270, 360].map((x) => Math.abs(s - x)));
      daily.set(d, { retro, spread: (360 - gap) / 360, season: toSeason / 0.98564736 });
    }
    return daily.get(d);
  };
  Object.assign(F, {
    astro_moon_phase: (i, t) => moonElongation(t) / 360,
    astro_moon_illumination: (i, t) => (1 - Math.cos(rad(moonElongation(t)))) / 2,
    astro_days_to_full_moon: (i, t) => (wrap360(180 - moonElongation(t)) / 360) * SYNODIC,
    astro_days_to_new_moon: (i, t) => (wrap360(360 - moonElongation(t)) / 360) * SYNODIC,
    astro_full_moon: (i, t) => (Math.abs(moonElongation(t) - 180) / 360 * SYNODIC <= 1 ? 1 : 0),
    astro_new_moon: (i, t) => { const e = moonElongation(t); return (Math.min(e, 360 - e) / 360) * SYNODIC <= 1 ? 1 : 0; },
    astro_mercury_retrograde: (i, t, d) => (dayAstro(d).retro[0] ? 1 : 0),
    astro_venus_retrograde: (i, t, d) => (dayAstro(d).retro[1] ? 1 : 0),
    astro_mars_retrograde: (i, t, d) => (dayAstro(d).retro[2] ? 1 : 0),
    astro_retrograde_count: (i, t, d) => dayAstro(d).retro.filter(Boolean).length,
    astro_planet_spread: (i, t, d) => dayAstro(d).spread,
    astro_days_to_season: (i, t, d) => dayAstro(d).season,
  });
  // Macro, markets, disasters and war attention from live public data: daily series as published 2 days earlier,
  // monthly series after their release lag, events up to the day before. Day-level values are computed once per day.
  if (world) {
    const S = (k) => series(world, k), daily2 = (s, d) => asOf(s, d - 2), perDay = (fn) => { const m = new Map(); return (i, t, d) => { if (!m.has(d)) m.set(d, fn(i, t, d)); return m.get(d); }; };
    const lvl = (s) => (i, t, d) => { const j = daily2(s, d); return j < 0 ? 0 : s.val[j]; };
    const chg = (s, k) => (i, t, d) => { const j = daily2(s, d); return j < k ? 0 : s.val[j] - s.val[j - k]; };
    const ret = (s, k) => (i, t, d) => { const j = daily2(s, d); return j < k ? 0 : pct(s.val[j], s.val[j - k]); };
    const monthly = (s, lag, d) => asOf(s, d - lag);
    const add = (name, keys2, make) => { if (want(name)) F[name] = perDay(make(...keys2.map(S))); };
    add("mkt_us10y", ["US10Y"], (s) => lvl(s)); add("mkt_us10y_chg_20d", ["US10Y"], (s) => chg(s, 20)); add("mkt_us2y", ["US2Y"], (s) => lvl(s));
    add("mkt_yield_curve", ["US10Y", "US2Y"], (a, b) => (i, t, d) => { const x = daily2(a, d), y = daily2(b, d); return x < 0 || y < 0 ? 0 : a.val[x] - b.val[y]; });
    add("mkt_fed_funds", ["FEDFUNDS"], (s) => lvl(s));
    add("mkt_fed_funds_chg_90d", ["FEDFUNDS"], (s) => (i, t, d) => { const x = asOf(s, d - 2), y = asOf(s, d - 92); return x < 0 || y < 0 ? 0 : s.val[x] - s.val[y]; });
    add("mkt_wti_ret_5d", ["WTI"], (s) => ret(s, 5)); add("mkt_wti_ret_20d", ["WTI"], (s) => ret(s, 20)); add("mkt_brent_ret_5d", ["BRENT"], (s) => ret(s, 5));
    add("mkt_natgas_ret_5d", ["NATGAS"], (s) => ret(s, 5)); add("mkt_dollar_ret_20d", ["DOLLAR"], (s) => ret(s, 20));
    add("mkt_vix", ["VIX"], (s) => lvl(s)); add("mkt_vix_chg_5d", ["VIX"], (s) => chg(s, 5));
    add("mkt_spx_ret_1m", ["SP500M"], (s) => (i, t, d) => { const j = monthly(s, 40, d); return j < 1 ? 0 : pct(s.val[j], s.val[j - 1]); });
    add("mkt_spx_drawdown_12m", ["SP500M"], (s) => (i, t, d) => { const j = monthly(s, 40, d); if (j < 0) return 0; let hi = -Infinity; for (let k = Math.max(0, j - 11); k <= j; k++) hi = Math.max(hi, s.val[k]); return pct(s.val[j], hi); });
    add("mkt_gold_ret_1m", ["GOLDM"], (s) => (i, t, d) => { const j = monthly(s, 40, d); return j < 1 ? 0 : pct(s.val[j], s.val[j - 1]); });
    add("macro_cpi_yoy", ["CPI"], (s) => (i, t, d) => { const j = monthly(s, 45, d); return j < 12 ? 0 : pct(s.val[j], s.val[j - 12]); });
    add("macro_unemployment", ["UNRATE"], (s) => (i, t, d) => { const j = monthly(s, 40, d); return j < 0 ? 0 : s.val[j]; });
    if (wanted.some((x) => x.startsWith("event_quake"))) {
      const q = (world.quakes || []).map(([ms, mag]) => [Number(ms), Number(mag)]).sort((a, b) => a[0] - b[0]);
      const lastAtOrBefore = (t) => { let lo = 0, hi = q.length - 1, ans = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (q[mid][0] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; } return ans; };
      const win = (days, minMag, reducer) => (i, t) => { let v = 0; for (let k = lastAtOrBefore(t); k >= 0 && q[k][0] > t - days * DAY; k--) if (q[k][1] >= minMag) v = reducer(v, q[k][1]); return v; };
      F.event_quakes_m6_7d = win(7, 6, (v) => v + 1); F.event_quake_max_7d = win(7, 6, (v, m) => Math.max(v, m)); F.event_quakes_m7_30d = win(30, 7, (v) => v + 1);
    }
    // Storms are read only up to the day before: active means tracked that day; wind is that day's report.
    const storms = (world.storms || []).map(([first, last, track]) => ({ first, last, wind: new Map(track) }));
    const windOn = (x) => storms.filter((s) => s.wind.has(x)).map((s) => s.wind.get(x));
    F.event_storms_active = perDay((i, t, d) => windOn(d - 1).length);
    F.event_storm_wind_max = perDay((i, t, d) => Math.max(0, ...windOn(d - 1)));
    F.event_major_storms_active = perDay((i, t, d) => windOn(d - 1).filter((w) => w >= 96).length);
    F.event_new_storms_7d = perDay((i, t, d) => storms.filter((s) => s.first >= d - 7 && s.first <= d - 1).length);
    if (want("event_war_attention")) {
      const w = { day: Int32Array.from(world.warViews || [], (x) => x[0]), val: Float64Array.from(world.warViews || [], (x) => x[1]) };
      F.event_war_attention = perDay((i, t, d) => { const j = asOf(w, d - 1); if (j < 0) return 1; let sum = 0, cnt = 0; for (let k = j - 1; k >= 0 && w.day[k] >= d - 91; k--) { sum += w.val[k]; cnt++; } return cnt && sum > 0 ? w.val[j] / (sum / cnt) : 1; });
    }
  }
  for (const name of wanted) store.add(name, col(F[name]));
}
