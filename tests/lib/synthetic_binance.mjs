// MIT License — Copyright (c) 2026 Decentralized Science Labs
// A deterministic synthetic Binance USD-M market for replay tests: candles, server time, exchange info and funding.
// A realistic deterministic market: a fat-tailed random walk (about 0.4% per 15 minutes), volume rising with big moves.
export const MIN = 60_000, DAY = 86_400_000, NOW = Math.floor(Date.now() / (15 * MIN)) * 15 * MIN + 7 * MIN;
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
export async function fakeFetch(url) {
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
