// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Small helpers for the MCP server: candle lengths, model numbers from links, and the Yes rule of the website
// (src/studio/threshold.js; test/util_test.js checks the two agree): Yes when threshold <= P <= thresholdMax.
export const candleMinutes = (c) => parseInt(c, 10) * ({ m: 1, h: 60, d: 1440, w: 10080 }[String(c).slice(-1)] || 1);
export const parseModelId = (arg) => {
  const s = String(arg || "").trim(), m = s.match(/[?&]id=(\d+)/) || s.match(/\/m\/(\d+)/) || s.match(/^#?(\d+)$/);
  return m ? Number(m[1]) : null;
};

export const DEFAULT_THRESHOLD = 0.5, DEFAULT_THRESHOLD_MAX = 1;
const given = (v) => v !== undefined && v !== null && v !== "";
export function yesRange({ threshold, thresholdMax } = {}) {
  const lo = given(threshold) ? Number(threshold) : DEFAULT_THRESHOLD, hi = given(thresholdMax) ? Number(thresholdMax) : DEFAULT_THRESHOLD_MAX;
  if (!(lo >= 0 && lo <= 1)) throw new RangeError("threshold must be a number from 0 to 1");
  if (!(hi >= 0 && hi <= 1)) throw new RangeError("threshold_max must be a number from 0 to 1");
  if (lo > hi) throw new RangeError("threshold must not be above threshold_max");
  return { threshold: lo, thresholdMax: hi };
}
export function decide(probability, range = {}) {
  const { threshold, thresholdMax } = yesRange(range), p = Number(probability);
  const yes = Number.isFinite(p) && p >= threshold && p <= thresholdMax;
  return { yes, answer: yes ? "yes" : "no", threshold, thresholdMax };
}
export const rangeText = ({ threshold, thresholdMax }) =>
  thresholdMax >= 1 ? `P ≥ ${threshold.toFixed(2)}` : `${threshold.toFixed(2)} ≤ P ≤ ${thresholdMax.toFixed(2)}`;
