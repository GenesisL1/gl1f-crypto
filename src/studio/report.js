// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Verifiable training reports. At mint the studio rebuilds the model's final test rows from public candles (the same
// backtest replay anyone can run), scores them with the model and publishes the metrics plus a SHA-256 fingerprint of
// every row (open time, label, integer score) in the model's on-chain metadata. Anyone who can run the model repeats
// the exact procedure and gets the same fingerprint and metrics, or sees that something differs.
import { predictQ } from "./local_infer.js";

const round6 = (x) => (Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : null);
export function aucOf(scores, labels) {
  const idx = Array.from(scores.keys()).sort((a, b) => scores[a] - scores[b]);
  let rankSum = 0, pos = 0, i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && scores[idx[j + 1]] === scores[idx[i]]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if (labels[idx[k]] > 0.5) { rankSum += r; pos++; }
    i = j + 1;
  }
  const neg = idx.length - pos;
  return pos && neg ? (rankSum - (pos * (pos + 1)) / 2) / (pos * neg) : NaN;
}
export async function sha256Hex(text) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// rows: [{ t: open time ms, y: 0 or 1, q: integer score }] in time order.
export async function computeReport(rows, scaleQ) {
  if (!rows.length) throw new Error("No test rows to report on");
  const p = rows.map((r) => 1 / (1 + Math.exp(-r.q / scaleQ))), y = rows.map((r) => r.y), n = rows.length, eps = 1e-15;
  let logloss = 0, brier = 0, correct = 0, positives = 0;
  for (let i = 0; i < n; i++) {
    const pi = Math.min(1 - eps, Math.max(eps, p[i]));
    logloss -= y[i] ? Math.log(pi) : Math.log(1 - pi);
    brier += (p[i] - y[i]) ** 2;
    correct += (p[i] >= 0.5 ? 1 : 0) === y[i] ? 1 : 0;
    positives += y[i];
  }
  return {
    v: 1, method: "gl1f-backtest-replay", rows: n, firstOpenMs: rows[0].t, lastOpenMs: rows[n - 1].t,
    auc: round6(aucOf(p, y)), logloss: round6(logloss / n), brier: round6(brier / n), accuracy: round6(correct / n), positiveRate: round6(positives / n),
    fingerprint: await sha256Hex(rows.map((r) => `${r.t},${r.y},${r.q}`).join("\n")),
  };
}
// The replay job for a model over a window, with labels (same rules as dataset building), from the model's own seed.
export function replayJob(m, p, startMs, endMs) {
  return {
    exchange: p.exchange, market: p.symbol, candle: p.candle, features: m.featureNames, featureFamily: p.featureFamily || "auto",
    scaleQ: m.decoded.scaleQ, warmupBars: p.warmupBars || null, featureSeedStartMs: p.featureSeedStartMs ?? null,
    basePeriod: p.label.basePeriod, startMs, endMs, btcSymbol: p.btcContext, cacheCandles: true, label: p.label,
  };
}
// Rows of a replay result inside [fromMs, toMs]: complete signals, a decided label, a real (not gap-filled) candle.
export function replayRows(bt, model, fromMs, toMs) {
  const rows = [], F = bt.nFeatures;
  for (let r = 0; r < bt.nRows; r++) {
    const t = Number(bt.times[r]);
    if (t < fromMs || t > toMs || !bt.valid[r] || !(bt.y?.[r] >= 0) || bt.synthetic?.[r]) continue;
    rows.push({ t, y: bt.y[r], q: Number(predictQ(model.decoded, bt.X.subarray(r * F, (r + 1) * F))), r });
  }
  return rows;
}
export const candleMsOf = (candle) => ({ "1m": 1, "3m": 3, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "2h": 120, "4h": 240, "6h": 360, "8h": 480, "12h": 720, "1d": 1440 }[candle] || 60) * 60_000;
// Rebuilds and scores a window, returning the report and the rows (rows keep their replay index for on-chain checks).
export async function replayReport(market, m, p, fromMs, toMs, onProgress) {
  const horizon = Number(p.label?.horizonBars) || 1, candleMs = candleMsOf(p.candle);
  const bt = await market.request("backtest", { job: replayJob(m, p, fromMs, Math.min(Date.now(), toMs + (horizon + 2) * candleMs)) }, { onProgress });
  const rows = replayRows(bt, m, fromMs, toMs);
  return { report: rows.length ? await computeReport(rows, m.decoded.scaleQ) : null, rows, bt };
}
const KEYS = ["rows", "firstOpenMs", "lastOpenMs", "auc", "logloss", "brier", "accuracy", "positiveRate", "fingerprint"];
export function compareReports(published, recomputed) {
  const diffs = KEYS.filter((k) => published?.[k] !== recomputed?.[k]);
  return { match: !diffs.length, diffs };
}
// Integer inputs exactly as the on-chain runtime receives them (same rounding as predictQ).
export const quantizeRow = (values, scaleQ) => Array.from(values, (v) => Math.max(-2147483648, Math.min(2147483647, Math.round(Math.fround(Number(v)) * scaleQ))));
