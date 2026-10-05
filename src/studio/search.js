// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Heuristic hyperparameter search, the same moves as the GenesisL1/Forest studio: each candidate
// perturbs the best settings so far (75%) or the user's settings (25%). Split, seed, bins and early-stop
// metric never change, so every candidate is scored on the same folds and stays comparable.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const SEARCH_BOUNDS = Object.freeze({ trees: [10, 5000], depth: [1, 12], lr: [0.001, 1], minLeaf: [1, 5000], patience: [1, 500] });
const FIXED = ["task", "seed", "bins", "binning", "earlyStop", "earlyStopMetric", "splitTrain", "splitVal", "nClasses", "imbalance", "scaleQ", "expectedRows", "validation"];

export function heuristicCandidate({ baseParams, bestParams, rng, fitsSize = () => true }) {
  const pivot = bestParams && rng() < 0.75 ? bestParams : baseParams;
  const p = { ...pivot };
  p.trees = clampInt(Math.round((Number(pivot.trees) * 2 ** ((rng() - 0.5) * 1.4)) / 25) * 25, ...SEARCH_BOUNDS.trees);
  p.depth = clampInt((pivot.depth | 0) + Math.round((rng() - 0.5) * 4), ...SEARCH_BOUNDS.depth);
  p.lr = Math.round(clamp(Number(pivot.lr) * 10 ** ((rng() - 0.5) * 0.8), ...SEARCH_BOUNDS.lr) * 1e6) / 1e6;
  p.minLeaf = clampInt(Number(pivot.minLeaf) * 2 ** ((rng() - 0.5) * 2), ...SEARCH_BOUNDS.minLeaf);
  if (pivot.earlyStop) p.patience = clampInt(Math.round(((pivot.patience | 0) * 2 ** ((rng() - 0.5) * 1.6)) / 5) * 5, ...SEARCH_BOUNDS.patience);
  if (pivot.lrSchedule?.mode === "plateau") {
    const s = { ...pivot.lrSchedule };
    s.patience = clampInt((s.patience | 0) * 2 ** ((rng() - 0.5) * 1.2), 1, 1000);
    s.dropPct = clampInt((s.dropPct | 0) + Math.round((rng() - 0.5) * 20), 1, 99);
    s.minLR = clamp(Number(s.minLR || 0) * 10 ** ((rng() - 0.5) * 1.2), 0, 1);
    p.lrSchedule = s;
  } else p.lrSchedule = pivot.lrSchedule ? { ...pivot.lrSchedule } : null;
  for (const key of FIXED) if (key in baseParams) p[key] = baseParams[key];
  while (!fitsSize(p.trees, p.depth) && p.depth > 1) p.depth--;
  while (!fitsSize(p.trees, p.depth) && p.trees > 10) p.trees = Math.max(10, Math.floor((p.trees * 0.8) / 10) * 10);
  return p;
}
