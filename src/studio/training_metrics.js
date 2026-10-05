// SPDX-License-Identifier: MIT
// Unweighted diagnostics for the selected model. Training loss retains the
// trainer's weighting policy; these population counts and ratios never do.
const EPS = 1e-12;
const ratio = (numerator, denominator) => denominator > 0 ? numerator / denominator : null;
const mean = values => {
  const defined = values.filter(Number.isFinite);
  return defined.length ? defined.reduce((a, b) => a + b, 0) / defined.length : null;
};
const sigmoid = x => x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
const clipped = p => Math.max(EPS, Math.min(1 - EPS, p));

export function resolveEarlyStopMetric(task, requested) {
  const regression = task === 'regression';
  const metric = requested == null || requested === '' || requested === 'loss' ? (regression ? 'mse' : 'logloss') : String(requested).toLowerCase();
  const allowed = regression ? ['mse', 'mae'] : ['logloss', 'accuracy', 'balanced_accuracy', 'f1', ...(task === 'binary_classification' ? ['brier'] : [])];
  if (!allowed.includes(metric)) throw new Error(`Unsupported early-stop metric '${metric}' for ${task}.`);
  const names = { mse: 'MSE', mae: 'MAE', logloss: 'LogLoss', accuracy: 'Accuracy', balanced_accuracy: 'Balanced accuracy', f1: 'F1', brier: 'Brier score' };
  return { metric, name: names[metric], direction: ['accuracy', 'balanced_accuracy', 'f1'].includes(metric) ? 'max' : 'min' };
}

function binaryCounts(tn, fp, fn, tp) {
  const n = tn + fp + fn + tp;
  const recall = ratio(tp, tp + fn);
  const specificity = ratio(tn, tn + fp);
  const denominator = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  return { support: tp + fn, negativeSupport: tn + fp, predicted: tp + fp,
    accuracy: ratio(tp + tn, n), precision: ratio(tp, tp + fp), recall, specificity,
    f1: ratio(2 * tp, 2 * tp + fp + fn), balancedAccuracy: mean([recall, specificity]),
    mcc: ratio(tp * tn - fp * fn, denominator), confusionMatrix: [[tn, fp], [fn, tp]] };
}

// Equal scores enter as one group. AUC gives ties half credit; AP uses the
// precision after each whole tied group, not an arbitrary within-tie ordering.
function rankingMetrics(observations) {
  const ranked = observations.slice().sort((a, b) => b[0] - a[0]);
  const positives = ranked.reduce((sum, row) => sum + row[1], 0);
  const negatives = ranked.length - positives;
  if (!positives || !negatives) return { rocAuc: null, averagePrecision: positives ? 1 : null };
  let tp = 0, fp = 0, auc = 0, ap = 0;
  for (let i = 0; i < ranked.length;) {
    let j = i, pos = 0, neg = 0;
    while (j < ranked.length && ranked[j][0] === ranked[i][0]) {
      if (ranked[j][1]) pos++; else neg++;
      j++;
    }
    auc += neg * (tp + pos / 2);
    tp += pos; fp += neg;
    ap += (pos / positives) * (tp / (tp + fp));
    i = j;
  }
  return { rocAuc: auc / (positives * negatives), averagePrecision: ap };
}

function classCountsSummary(matrix) {
  const width = matrix.length;
  const classCounts = matrix.map(row => row.reduce((a, b) => a + b, 0));
  const predictedCounts = Array.from({ length: width }, (_, k) => matrix.reduce((sum, row) => sum + row[k], 0));
  const n = classCounts.reduce((a, b) => a + b, 0);
  const perClass = matrix.map((row, k) => {
    const tp = row[k], fn = classCounts[k] - tp, fp = predictedCounts[k] - tp;
    const summary = binaryCounts(n - tp - fn - fp, fp, fn, tp);
    return { classIndex: k, support: classCounts[k], predicted: predictedCounts[k], precision: summary.precision,
      recall: summary.recall, specificity: summary.specificity, f1: summary.f1 };
  });
  return { classCounts, classPrevalence: classCounts.map(count => ratio(count, n)), predictedCounts, perClass,
    majorityBaselineAccuracy: n ? Math.max(...classCounts) / n : null };
}

function multiclassProbabilities(options, r) {
  const width = options.nClasses;
  if (!options.predictions?.length) return Array.from({ length: width }, (_, k) => options.probabilities[r * width + k]);
  const values = Array.from({ length: width }, (_, k) => options.predictions[r * width + k] / options.scaleQ);
  const max = Math.max(...values);
  const exponentials = values.map(value => Math.exp(value - max));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map(value => value / total);
}

function probability(options, r, k = 0) {
  const width = options.nClasses || 1;
  if (options.task === 'multiclass_classification') return options.probabilities[r * width + k];
  return sigmoid(options.predictions[r * width + k] / options.scaleQ);
}

// Linear-time stopping scores. Only validation indices are supplied during
// boosting; ranking metrics are deliberately restricted to the final report.
export function earlyStopScore(options) {
  const { task, metric, y, predictions, indices, scaleQ, yQ } = options;
  if (!indices.length) return null;
  if (metric === 'logloss' || metric === 'mse') return Number.isFinite(options.loss) ? options.loss : null;
  if (task === 'regression') {
    let total = 0;
    for (const r of indices) total += Math.abs(y[r] - predictions[r] / scaleQ);
    return total / indices.length;
  }
  const multilabel = task === 'multilabel_classification';
  const multiclass = task === 'multiclass_classification';
  const width = multiclass || multilabel ? options.nClasses : 2;
  const tp = new Float64Array(width), actual = new Float64Array(width), predicted = new Float64Array(width);
  let correct = 0, brier = 0;
  if (multilabel) {
    const negativeCorrect = new Float64Array(width);
    for (const r of indices) for (let k = 0; k < width; k++) {
      const target = y[r * width + k] >= 0.5 ? 1 : 0;
      const label = probability(options, r, k) >= 0.5 ? 1 : 0;
      actual[k] += target; predicted[k] += label;
      if (target && label) tp[k]++;
      if (target === label) { correct++; if (!target) negativeCorrect[k]++; }
    }
    if (metric === 'accuracy') return correct / (indices.length * width);
    if (metric === 'f1') return mean(Array.from(tp, (count, k) => ratio(2 * count, actual[k] + predicted[k])));
    // Multilabel balanced accuracy: average each label's defined positive and
    // negative recalls, then macro-average across labels.
    return mean(Array.from(tp, (count, k) => mean([ratio(count, actual[k]), ratio(negativeCorrect[k], indices.length - actual[k])])));
  }
  for (const r of indices) {
    const target = multiclass ? y[r] | 0 : y[r] >= 0.5 ? 1 : 0;
    let label = 0;
    if (multiclass) {
      // Argmax is computed from Q scores directly so float32 softmax
      // rounding cannot create a false tie in a non-loss monitor.
      const values = options.predictions?.length ? options.predictions : options.probabilities;
      for (let k = 1; k < width; k++) if (values[r * width + k] > values[r * width + label]) label = k;
    } else {
      const p = probability(options, r);
      label = p >= 0.5 ? 1 : 0;
      brier += (p - target) ** 2;
    }
    actual[target]++; predicted[label]++;
    if (target === label) { tp[target]++; correct++; }
  }
  if (metric === 'accuracy') return correct / indices.length;
  if (metric === 'brier') return brier / indices.length;
  if (metric === 'balanced_accuracy') return mean(Array.from(tp, (count, k) => ratio(count, actual[k])));
  if (!multiclass) return ratio(2 * tp[1], actual[1] + predicted[1]);
  return mean(Array.from(tp, (count, k) => ratio(2 * count, actual[k] + predicted[k])));
}

export function computeTestStatistics(options) {
  const { task, y, predictions, indices, scaleQ, yQ } = options;
  const n = indices.length;
  const result = { version: 1, task, nRows: n, weighted: false, threshold: task === 'binary_classification' || task === 'multilabel_classification' ? 0.5 : null };
  if (!n) return null;
  if (task === 'regression') {
    let min = Infinity, max = -Infinity, targetMean = 0, targetSS = 0, squared = 0, absolute = 0, count = 0;
    for (const r of indices) {
      const target = y[r], prediction = predictions[r] / scaleQ;
      const delta = target - targetMean; count++; targetMean += delta / count; targetSS += delta * (target - targetMean);
      min = Math.min(min, target); max = Math.max(max, target);
      squared += (target - prediction) ** 2; absolute += Math.abs(target - prediction);
    }
    return { ...result, mse: squared / n, rmse: Math.sqrt(squared / n), mae: absolute / n,
      r2: targetSS > 0 ? 1 - squared / targetSS : null, target: { min, max, mean: targetMean, std: Math.sqrt(targetSS / n) } };
  }
  const multilabel = task === 'multilabel_classification';
  const multiclass = task === 'multiclass_classification';
  if (multilabel) {
    const width = options.nClasses;
    const matrices = Array.from({ length: width }, () => [[0, 0], [0, 0]]);
    const ranking = Array.from({ length: width }, () => []);
    const losses = new Float64Array(width), briers = new Float64Array(width);
    let subsetCorrect = 0;
    for (const r of indices) {
      let allCorrect = true;
      for (let k = 0; k < width; k++) {
        const target = y[r * width + k] >= 0.5 ? 1 : 0, p = probability(options, r, k), label = p >= 0.5 ? 1 : 0;
        matrices[k][target][label]++;
        if (target !== label) allCorrect = false;
        ranking[k].push([p, target]);
        const cp = clipped(p); losses[k] -= target ? Math.log(cp) : Math.log(1 - cp); briers[k] += (p - target) ** 2;
      }
      if (allCorrect) subsetCorrect++;
    }
    const perLabel = matrices.map((m, k) => ({ labelIndex: k, ...binaryCounts(m[0][0], m[0][1], m[1][0], m[1][1]),
      alwaysNegativeAccuracy: (m[0][0] + m[0][1]) / n, logLoss: losses[k] / n, brier: briers[k] / n, ...rankingMetrics(ranking[k]) }));
    const pooled = matrices.reduce((a, m) => a.map((value, k) => value + m[k >> 1][k & 1]), [0, 0, 0, 0]);
    const micro = binaryCounts(...pooled);
    const macro = { precision: mean(perLabel.map(s => s.precision)), recall: mean(perLabel.map(s => s.recall)), f1: mean(perLabel.map(s => s.f1)) };
    return { ...result, nLabels: width, confusionMatrix: micro.confusionMatrix,
      classCounts: perLabel.map(s => s.support), classPrevalence: perLabel.map(s => s.support / n),
      predictedCounts: perLabel.map(s => s.predicted), accuracy: micro.accuracy, subsetAccuracy: subsetCorrect / n,
      balancedAccuracy: mean(perLabel.map(s => s.balancedAccuracy)), precision: macro.precision, recall: macro.recall,
      specificity: mean(perLabel.map(s => s.specificity)), f1: macro.f1, mcc: micro.mcc,
      rocAuc: mean(perLabel.map(s => s.rocAuc)), averagePrecision: mean(perLabel.map(s => s.averagePrecision)),
      logLoss: mean(perLabel.map(s => s.logLoss)), brier: mean(perLabel.map(s => s.brier)),
      micro: { precision: micro.precision, recall: micro.recall, f1: micro.f1 }, macro, perLabel,
      alwaysNegativeAccuracy: (pooled[0] + pooled[1]) / (n * width),
      majorityBaselineAccuracy: mean(perLabel.map(s => Math.max(s.support, s.negativeSupport) / n)) };
  }
  const width = multiclass ? options.nClasses : 2;
  const matrix = Array.from({ length: width }, () => Array(width).fill(0));
  const ranking = [];
  let loss = 0, brier = 0;
  for (const r of indices) {
    const target = multiclass ? y[r] | 0 : y[r] >= 0.5 ? 1 : 0;
    let label = 0;
    if (multiclass) {
      const probabilities = multiclassProbabilities(options, r);
      for (let k = 1; k < width; k++) if (probabilities[k] > probabilities[label]) label = k;
      loss -= Math.log(clipped(probabilities[target]));
    } else {
      const p = probability(options, r); label = p >= 0.5 ? 1 : 0; ranking.push([p, target]);
      const cp = clipped(p); loss -= target ? Math.log(cp) : Math.log(1 - cp); brier += (p - target) ** 2;
    }
    matrix[target][label]++;
  }
  const summary = classCountsSummary(matrix);
  if (!multiclass) return { ...result, ...binaryCounts(matrix[0][0], matrix[0][1], matrix[1][0], matrix[1][1]), ...summary,
    ...rankingMetrics(ranking), logLoss: loss / n, brier: brier / n, alwaysNegativeAccuracy: summary.classCounts[0] / n };
  const correct = matrix.reduce((sum, row, k) => sum + row[k], 0);
  const covariance = correct * n - summary.classCounts.reduce((sum, count, k) => sum + count * summary.predictedCounts[k], 0);
  const denominator = Math.sqrt((n * n - summary.classCounts.reduce((sum, count) => sum + count * count, 0)) *
    (n * n - summary.predictedCounts.reduce((sum, count) => sum + count * count, 0)));
  return { ...result, ...summary, confusionMatrix: matrix, accuracy: correct / n,
    balancedAccuracy: mean(summary.perClass.map(s => s.recall)), precision: mean(summary.perClass.map(s => s.precision)),
    recall: mean(summary.perClass.map(s => s.recall)), specificity: mean(summary.perClass.map(s => s.specificity)),
    f1: mean(summary.perClass.map(s => s.f1)), mcc: ratio(covariance, denominator),
    rocAuc: null, averagePrecision: null,
    logLoss: loss / n, brier: null, alwaysNegativeAccuracy: null };
}
