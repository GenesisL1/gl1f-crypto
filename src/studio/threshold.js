// MIT License — Copyright (c) 2026 Decentralized Science Labs
// When a Crypto AI model's answer counts as Yes: its probability P is at least the threshold and at most the upper
// limit (thresholdMax). The defaults, 0.5 and 1, give the classic answer: Yes at 50% or more. One rule for the Web3 API,
// the model page, the studio's inference step and the backtest, so every surface decides the same way.
export const DEFAULT_THRESHOLD = 0.5;
export const DEFAULT_THRESHOLD_MAX = 1;

const given = (v) => v !== undefined && v !== null && v !== "";

// The Yes range, checked: both limits from 0 to 1, the threshold not above the upper limit.
export function yesRange({ threshold, thresholdMax } = {}) {
  const lo = given(threshold) ? Number(threshold) : DEFAULT_THRESHOLD, hi = given(thresholdMax) ? Number(thresholdMax) : DEFAULT_THRESHOLD_MAX;
  if (!(lo >= 0 && lo <= 1)) throw new RangeError("threshold must be a number from 0 to 1");
  if (!(hi >= 0 && hi <= 1)) throw new RangeError("thresholdMax must be a number from 0 to 1");
  if (lo > hi) throw new RangeError("threshold must not be above thresholdMax");
  return { threshold: lo, thresholdMax: hi };
}

// Yes or no for one probability: { yes, answer, threshold, thresholdMax }.
export function decide(probability, range = {}) {
  const { threshold, thresholdMax } = yesRange(range), p = Number(probability);
  const yes = Number.isFinite(p) && p >= threshold && p <= thresholdMax;
  return { yes, answer: yes ? "yes" : "no", threshold, thresholdMax };
}

// The rule in a few characters: "P ≥ 0.60", or "0.60 ≤ P ≤ 0.85" when there is an upper limit.
export function rangeText({ threshold = DEFAULT_THRESHOLD, thresholdMax = DEFAULT_THRESHOLD_MAX } = {}, digits = 2) {
  const lo = Number(threshold).toFixed(digits);
  return Number(thresholdMax) >= 1 ? `P ≥ ${lo}` : `${lo} ≤ P ≤ ${Number(thresholdMax).toFixed(digits)}`;
}

export const isDefaultRange = (r) => Number(r?.threshold) === DEFAULT_THRESHOLD && Number(r?.thresholdMax) === DEFAULT_THRESHOLD_MAX;
