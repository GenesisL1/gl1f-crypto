// SPDX-License-Identifier: MIT
// Validation-only model selection shared by the browser and local trainer UI.
// The training callback receives explicit indices; test indices are supplied
// only after every candidate has been scored and a final model selected.

export function summarizeFoldScores(scores) {
  if (!scores.length || scores.some(x => !Number.isFinite(x))) {
    throw new Error("Every validation fold must produce a finite score.");
  }
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sd = scores.length > 1
    ? Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / (scores.length - 1)) : null;
  return { mean, sd, count: scores.length };
}

export function freezeLearningRateSchedule(params, result, count) {
  if (params.lrSchedule?.mode !== "plateau") return params.lrSchedule || null;
  const rates = result.meta?.learningRates || result.curve?.lr;
  if (!Array.isArray(rates) || rates.length < count ||
      rates.slice(0, count).some(x => !Number.isFinite(x) || x <= 0)) {
    throw new Error("The trainer did not return the learning-rate history required for final fitting. Update the local trainer from this bundle.");
  }
  const segments = [];
  for (let i = 0; i < count; i++) {
    const previous = segments[segments.length - 1];
    if (previous && previous.lr === rates[i]) previous.end = i + 1;
    else segments.push({ start: i + 1, end: i + 1, lr: rates[i] });
  }
  return { mode: "piecewise", segments };
}

export async function runValidationSearch({
  plan, baseParams, rounds = 1, refit = false, trainRound, candidate,
  onEntry = () => {}, onPhase = () => {}, isAborted = () => false,
}) {
  if (!plan || plan.audit?.valid === false || plan.audit?.errors?.length || !Array.isArray(plan.folds) || !plan.folds.length || !plan.test?.length) {
    throw new Error("Validate a complete, error-free split before training.");
  }
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 1000) throw new Error("Search rounds must be an integer from 1 to 1000.");
  if (rounds > 1 && typeof candidate !== "function") throw new Error("A search with multiple rounds requires a candidate generator.");
  // Candidate requests deliberately omit the test indices, so an individual
  // trainer cannot detect a reserved test row mistakenly present in a fold.
  // Validate the complete plan once before giving any rows to a trainer.
  const membership = (indices, label) => {
    if ((!Array.isArray(indices) && !ArrayBuffer.isView(indices)) || !indices.length) throw new Error(`${label} must contain row indices.`);
    const seen = new Set();
    for (const index of indices) {
      if (!Number.isSafeInteger(index) || index < 0 || seen.has(index) ||
          (Number.isInteger(plan.audit?.totalRows) && index >= plan.audit.totalRows)) {
        throw new Error(`${label} contains a duplicate or invalid row index.`);
      }
      seen.add(index);
    }
    return seen;
  };
  const testRows = membership(plan.test, "Final test");
  for (let i = 0; i < plan.folds.length; i++) {
    const train = membership(plan.folds[i]?.train, `Fold ${i + 1} training`);
    const val = membership(plan.folds[i]?.val, `Fold ${i + 1} validation`);
    for (const row of train) if (testRows.has(row)) throw new Error(`Fold ${i + 1} training overlaps the locked final test.`);
    for (const row of val) {
      if (testRows.has(row)) throw new Error(`Fold ${i + 1} validation overlaps the locked final test.`);
      if (train.has(row)) throw new Error(`Fold ${i + 1} training and validation overlap.`);
    }
  }
  if (refit) for (const row of membership(plan.finalTrain, "Final training")) {
    if (testRows.has(row)) throw new Error("Final training overlaps the locked final test.");
  }
  const stop = () => { if (isAborted()) throw new Error("Training stopped; final test remains locked."); };
  let best = null;
  for (let round = 1; round <= rounds; round++) {
    stop();
    const params = round === 1 ? { ...baseParams } : candidate(round, best?.params);
    const entry = { round, status: "running", params, meta: null, curve: null, error: null };
    onEntry(entry, true);
    const results = [];
    try {
      for (let i = 0; i < plan.folds.length; i++) {
        stop();
        const fold = plan.folds[i];
        onPhase(`Candidate ${round}/${rounds} · fold ${i + 1}/${plan.folds.length}`);
        const result = await trainRound({
          ...params, refitTrainVal: false, finalFit: false, lockTest: true,
          imbalance: params.imbalance ? { ...params.imbalance, stratify: false } : null,
          splitIndices: { train: fold.train, val: fold.val, test: [] },
        }, {
          round: (round - 1) * plan.folds.length + i + 1,
          totalRounds: rounds * plan.folds.length + 1,
          label: `Candidate ${round}/${rounds} · fold ${i + 1}/${plan.folds.length}`,
        });
        stop();
        if (result.meta?.testLocked !== true || result.meta?.testEvaluated !== false ||
            result.meta?.testEvaluationCount !== 0 || Number.isFinite(result.meta?.bestTestMetric) ||
            Number.isFinite(result.meta?.bestTestAcc) || result.meta?.testStatistics != null) {
          throw Object.assign(new Error("The trainer did not confirm that the final test remained locked. Use the local trainer supplied in this bundle."), { code: "GL1F_TRAINING_REPORT_UNSUPPORTED" });
        }
        results.push(result);
      }
      const summary = summarizeFoldScores(results.map(r => r.meta?.bestValMetric));
      const last = results[results.length - 1];
      const trainScores = results.map(r => r.meta?.bestTrainMetric);
      const accuracies = results.map(r => r.meta?.bestValAcc);
      const monitorScores = results.map(r => r.meta?.bestEarlyStopScore);
      entry.status = "done";
      entry.meta = {
        ...last.meta, bestValMetric: summary.mean, validationSD: summary.sd,
        bestTrainMetric: trainScores.every(Number.isFinite) ? summarizeFoldScores(trainScores).mean : null,
        bestValAcc: accuracies.every(Number.isFinite) ? summarizeFoldScores(accuracies).mean : null,
        bestEarlyStopScore: monitorScores.every(Number.isFinite) ? summarizeFoldScores(monitorScores).mean : null,
        foldCount: summary.count, bestTestMetric: null, bestTestAcc: null,
        testLocked: true, testEvaluated: false,
        foldScores: results.map((r, i) => ({
          fold: i + 1, score: r.meta.bestValMetric, usedTrees: r.meta.usedTrees,
          trainScore: r.meta.bestTrainMetric, validationAccuracy: r.meta.bestValAcc ?? null,
          earlyStopScore: r.meta.bestEarlyStopScore ?? null,
          trainRows: plan.folds[i].train.length, validationRows: plan.folds[i].val.length,
        })),
      };
      entry.curve = last.curve;
      if (!best || summary.mean < best.summary.mean) {
        best = { params, summary, last, round, foldScores: entry.meta.foldScores };
      }
    } catch (error) {
      entry.status = isAborted() ? "stopped" : "error";
      entry.error = error.message || String(error);
      if (error.code === "GL1F_TRAINING_REPORT_UNSUPPORTED") { onEntry(entry, false); throw error; }
      if (isAborted()) { onEntry(entry, false); stop(); }
    }
    onEntry(entry, false);
  }
  stop();
  if (!best) throw new Error("No candidate completed every validation fold. Review the search errors; the test remains locked.");
  const trees = Number(best.last.meta?.usedTrees);
  if (!Number.isInteger(trees) || trees < 1) throw new Error("Selected trainer result has an invalid tree count.");
  // The most recent fold determines the fixed training duration and LR trace.
  // Earlier folds contribute to model selection, not to test-driven decisions.
  const finalTrain = refit ? plan.finalTrain : plan.folds[plan.folds.length - 1].train;
  const finalParams = {
    ...best.params, trees, earlyStop: false, refitTrainVal: false,
    lrSchedule: freezeLearningRateSchedule(best.params, best.last, trees),
    finalFit: true, lockTest: false,
    imbalance: best.params.imbalance ? { ...best.params.imbalance, stratify: false } : null,
    splitIndices: { train: finalTrain, val: [], test: plan.test },
  };
  onPhase(refit ? "Fit selected model on development data; evaluate final test once" : "Fit selected model; evaluate final test once");
  stop();
  const result = await trainRound(finalParams, { round: 1, totalRounds: 1, label: "Selected final model" });
  if (isAborted()) throw new Error("Training stopped after final-test evaluation; this holdout has already been exposed.");
  if (!Number.isFinite(result.meta?.bestTestMetric)) throw new Error("Final test evaluation did not return a finite metric.");
  if (result.meta?.testLocked !== false || result.meta?.testEvaluated !== true || result.meta?.testEvaluationCount !== 1) {
    throw new Error("The selected model did not confirm exactly one final-test evaluation.");
  }
  return { result, finalParams, best, finalTrain };
}
