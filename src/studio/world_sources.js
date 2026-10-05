// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Public data for world signals, fetched live in the browser when a dataset is built: every source below lets web
// pages read it (CORS) and needs no key or account. The site's scheduled job fetches the same data into
// data/world.json, which the studio uses only when a live source cannot be reached.
const DAY = 86_400_000;
const dayOf = (s) => { const x = String(s).trim(); return Math.floor(Date.parse(x.length === 7 ? `${x}-01T00:00:00Z` : x.length === 10 ? `${x}T00:00:00Z` : x) / DAY); };
const isoDay = (d) => new Date(d * DAY).toISOString().slice(0, 10);
const ymd = (d) => isoDay(d).replace(/-/g, "");
export const DATAHUB = "https://raw.githubusercontent.com/datasets", DBNOMICS = "https://api.db.nomics.world/v22/series";
export const USGS = "https://earthquake.usgs.gov/fdsnws/event/1/query", EONET = "https://eonet.gsfc.nasa.gov/api/v3/events";
export const WIKI = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user";
export const SOURCES = {
  US10Y: { since: "1962-01-02", via: "DBnomics", what: "Federal Reserve H.15, 10-year Treasury", url: `${DBNOMICS}/FED/H15/RIFLGFCY10_N.B?observations=1` },
  US2Y: { since: "1976-06-01", via: "DBnomics", what: "Federal Reserve H.15, 2-year Treasury", url: `${DBNOMICS}/FED/H15/RIFLGFCY02_N.B?observations=1` },
  FEDFUNDS: { since: "1954-07-01", via: "DBnomics", what: "Federal Reserve H.15, effective federal funds rate", url: `${DBNOMICS}/FED/H15/RIFSPFF_N.B?observations=1` },
  UNRATE: { since: "1948-01-01", via: "DBnomics", what: "BLS unemployment rate", url: `${DBNOMICS}/BLS/ln/LNS14000000?observations=1` },
  WTI: { since: "1986-01-02", via: "DataHub", what: "EIA WTI spot price", url: `${DATAHUB}/oil-prices/main/data/wti-daily.csv`, col: "Price" },
  BRENT: { since: "1987-05-20", via: "DataHub", what: "EIA Brent spot price", url: `${DATAHUB}/oil-prices/main/data/brent-daily.csv`, col: "Price" },
  NATGAS: { since: "1997-01-07", via: "DataHub", what: "EIA Henry Hub natural gas spot price", url: `${DATAHUB}/natural-gas/main/data/daily.csv`, col: "Price" },
  VIX: { since: "1990-01-02", via: "DataHub", what: "Cboe VIX daily close", url: `${DATAHUB}/finance-vix/main/data/vix-daily.csv`, col: "CLOSE", licensed: true },
  CPI: { since: "1913-01-01", via: "DataHub", what: "BLS CPI-U index", url: `${DATAHUB}/cpi-us/main/data/cpiai.csv`, col: "Index" },
  SP500M: { since: "1871-01-01", via: "DataHub", what: "S&P 500 monthly average (Robert Shiller)", url: `${DATAHUB}/s-and-p-500/main/data/data.csv`, col: "SP500", licensed: true },
  GOLDM: { since: "1833-01-01", via: "DataHub", what: "gold monthly price", url: `${DATAHUB}/gold-prices/main/data/monthly.csv`, col: "Price" },
  DOLLAR: { since: "1999-01-04", via: "DataHub", what: "Federal Reserve H.10 exchange rates, combined with DXY weights", url: `${DATAHUB}/exchange-rates/main/data/daily.csv` },
  QUAKES: { since: "1973-01-01", via: "USGS", what: "earthquakes of magnitude 6 and above" },
  EONET: { since: "2000-01-01", via: "NASA EONET", what: "tropical storms, tracked since 2000" },
  WARVIEWS: { since: "2015-07-01", via: "Wikipedia", what: "daily views of War, World War III and Nuclear warfare" },
};
const EVENT_FIELDS = { QUAKES: ["quakes"], EONET: ["storms"], WARVIEWS: ["warViews"] };
const rowsOf = (text) => String(text).replace(/\r/g, "").split("\n").filter((l) => l.trim() && !l.startsWith("#"));
export function parseDatedCsv(text, col) {
  const [head, ...rows] = rowsOf(text), cols = head.split(",").map((c) => c.trim().toLowerCase()), vi = cols.indexOf(col.toLowerCase());
  if (vi < 0) throw new Error(`column ${col} missing`);
  const out = [];
  for (const r of rows) {
    const c = r.split(","), raw = (c[vi] || "").trim(), d = dayOf(c[0]), v = Number(raw);
    if (raw && Number.isFinite(d) && Number.isFinite(v) && !(col === "SP500" && v === 0)) out.push([d, v]);
  }
  if (!out.length) throw new Error("no rows");
  return out.sort((a, b) => a[0] - b[0]);
}
// DXY = 50.14348112 × EURUSD^-0.576 × USDJPY^0.136 × GBPUSD^-0.119 × USDCAD^0.091 × USDSEK^0.042 × USDCHF^0.036; the file quotes every currency per US dollar.
export const DXY_WEIGHTS = { Euro: 0.576, Japan: 0.136, "United Kingdom": 0.119, Canada: 0.091, Sweden: 0.042, Switzerland: 0.036 };
export function parseDollarIndex(text) {
  const by = new Map();
  for (const r of rowsOf(text).slice(1)) {
    const [date, country, rate] = r.split(","), w = DXY_WEIGHTS[country], v = Number(rate);
    if (w === undefined || !(v > 0)) continue;
    const d = dayOf(date), e = by.get(d) || { n: 0, log: 0 };
    e.n++; e.log += w * Math.log(v); by.set(d, e);
  }
  const out = [...by.entries()].filter(([, e]) => e.n === 6).map(([d, e]) => [d, Math.round(50.14348112 * Math.exp(e.log) * 1000) / 1000]).sort((a, b) => a[0] - b[0]);
  if (!out.length) throw new Error("no complete days");
  return out;
}
export function parseDbnomics(json) {
  const doc = json?.series?.docs?.[0];
  if (!doc) throw new Error("no series in the response");
  const days = doc.period_start_day || doc.period || [], vals = doc.value || [], out = [];
  for (let i = 0; i < vals.length; i++) { const v = Number(vals[i]); if (vals[i] !== "NA" && vals[i] !== null && Number.isFinite(v)) out.push([dayOf(String(days[i]).slice(0, 10)), v]); }
  if (!out.length) throw new Error("no observations");
  return out.sort((a, b) => a[0] - b[0]);
}
export const parseUsgs = (json) => (json?.features || []).map((f) => [Number(f.properties?.time), Number(f.properties?.mag)]).filter(([t, m]) => Number.isFinite(t) && Number.isFinite(m)).sort((a, b) => a[0] - b[0]);
// Tropical storms (NASA EONET has tracked them since 2000; its other categories have little history, so they are not used):
// [first day, last day, [[day, highest wind that day in knots], ...]]. Signals read a storm only up to the day before.
export function parseEonet(jsons) {
  const storms = [], seen = new Set();
  for (const json of jsons) for (const e of json?.events || []) {
    if (seen.has(e.id) || e.categories?.[0]?.id !== "severeStorms") continue;
    seen.add(e.id);
    const byDay = new Map();
    for (const g of e.geometry || []) {
      const d = dayOf(String(g.date).slice(0, 10)), kts = /kt/i.test(String(g.magnitudeUnit || "")) ? Number(g.magnitudeValue) || 0 : 0;
      if (Number.isFinite(d)) byDay.set(d, Math.max(byDay.get(d) || 0, kts));
    }
    if (!byDay.size) continue;
    const track = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
    storms.push([track[0][0], track[track.length - 1][0], track]);
  }
  return storms.sort((a, b) => a[0] - b[0]);
}
export function parseWikiViews(jsons) {
  const by = new Map();
  for (const j of jsons) for (const it of j?.items || []) { const ts = String(it.timestamp), d = dayOf(`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`); if (Number.isFinite(d)) by.set(d, (by.get(d) || 0) + Number(it.views || 0)); }
  return [...by.entries()].sort((a, b) => a[0] - b[0]);
}
export const WAR_ARTICLES = ["War", "World_War_III", "Nuclear_warfare"];
// Fetches what the selected signals need. Returns the data and, per key, why a source failed (the browser may block it).
export async function fetchLiveWorld({ keys, fromDay, toDay, fetchImpl = globalThis.fetch, cache = new Map() }) {
  const world = { series: {}, quakes: [], storms: [], warViews: [], sources: {} }, errors = {};
  const get = (url, as) => {
    const key = `${as}:${url}`;
    if (!cache.has(key)) cache.set(key, (async () => { const r = await fetchImpl(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return as === "json" ? r.json() : r.text(); })().catch((e) => { cache.delete(key); throw e; }));
    return cache.get(key);
  };
  const task = {
    QUAKES: async () => { world.quakes = parseUsgs(await get(`${USGS}?format=geojson&starttime=${isoDay(fromDay - 31)}&endtime=${isoDay(toDay + 1)}&minmagnitude=6&orderby=time-asc`, "json")); },
    EONET: async () => { world.storms = parseEonet([await get(`${EONET}?status=all&category=severeStorms&start=${isoDay(fromDay - 40)}&end=${isoDay(toDay + 1)}&limit=5000`, "json")]); },
    WARVIEWS: async () => { world.warViews = parseWikiViews(await Promise.all(WAR_ARTICLES.map((a) => get(`${WIKI}/${a}/daily/${ymd(fromDay - 100)}00/${ymd(toDay)}00`, "json")))); },
  };
  await Promise.all([...new Set(keys)].map(async (k) => {
    const src = SOURCES[k];
    if (!src) return;
    try {
      if (task[k]) await task[k]();
      else if (src.via === "DBnomics") world.series[k] = parseDbnomics(await get(src.url, "json"));
      else world.series[k] = k === "DOLLAR" ? parseDollarIndex(await get(src.url, "text")) : parseDatedCsv(await get(src.url, "text"), src.col);
      world.sources[k] = src.via;
    } catch (e) {
      errors[k] = `${src.via} (${src.what}): ${e?.message === "Failed to fetch" || e?.name === "TypeError" ? "this browser could not reach it" : e?.message || e}`;
    }
  }));
  return { world, errors };
}
export function hasWorldKey(world, key) {
  if (!world) return false;
  if (EVENT_FIELDS[key]) return !!world.sources?.[key] && EVENT_FIELDS[key].every((f) => Array.isArray(world[f]));
  return Array.isArray(world.series?.[key]) && world.series[key].length > 0;
}
export function mergeWorldKey(into, from, key) {
  if (EVENT_FIELDS[key]) for (const f of EVENT_FIELDS[key]) into[f] = from[f];
  else into.series[key] = from.series[key];
  into.sources[key] = `${from.sources?.[key] || SOURCES[key]?.via || key}, published copy`;
}
