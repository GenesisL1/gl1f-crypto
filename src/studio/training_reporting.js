// SPDX-License-Identifier: MIT
// Reject incomplete or incompatible trainer responses before displaying them
// as a completed model. This validates reporting only; it never evaluates rows.
import { resolveEarlyStopMetric } from './training_metrics.js';

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const rowCount = value => Number.isInteger(value) && value >= 0;

export function assertTrainingReport(meta, params = {}, { engine = 'Browser' } = {}) {
  const local = /python|c\+\+|cpp/i.test(engine);
  const cpp = /c\+\+|cpp/i.test(engine);
  const guidance = local
    ? `Replace the complete local project with this bundle and restart local_trainer_server.py.${cpp ? ' Rebuild C++ with ./build_cpp_trainer.sh (Linux/macOS) or build_cpp_trainer.bat (Windows).' : ''}`
    : 'Reload the latest training page and its worker files from the complete updated bundle.';
  const fail = reason => {
    const error = new Error(`${engine} trainer reporting is incompatible: ${reason} ${guidance}`);
    error.code = 'GL1F_TRAINING_REPORT_UNSUPPORTED';
    throw error;
  };
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) fail('The training report is missing.');
  const task = params.task || meta.task;
  if (!task) fail('The task is missing.');
  let monitor;
  try { monitor = resolveEarlyStopMetric(task, params.earlyStopMetric); }
  catch (error) { fail(error.message); }
  if (meta.earlyStopMetric !== monitor.metric) {
    fail(`The requested ${monitor.name} validation monitor was not confirmed by the trainer.`);
  }
  if (meta.earlyStopDirection !== monitor.direction) fail('The validation-monitor direction was not confirmed by the trainer.');
  if (!own(meta, 'bestEarlyStopScore') || !own(meta, 'testStatistics')) fail('Validation-monitor or final-test statistics fields are missing.');
  if (meta.task && meta.task !== task) fail('The reported task does not match the requested task.');

  const explicit = params.splitIndices;
  const countFor = role => {
    if (explicit && Array.isArray(explicit[role])) return explicit[role].length;
    for (const counts of [meta.splitCounts, meta.splitSizes]) {
      if (rowCount(counts?.[role])) return counts[role];
    }
    return null;
  };
  const valRows = countFor('val');
  const monitorActive = !!params.earlyStop || params.lrSchedule?.mode === 'plateau';
  const validationExpected = valRows === null ? params.splitVal !== 0 : valRows > 0;
  if (!params.finalFit && monitorActive && validationExpected && !Number.isFinite(meta.bestEarlyStopScore)) {
    fail('The selected validation monitor has no finite score.');
  }
  const stats = meta.testStatistics;
  if (params.lockTest) {
    if (stats !== null || meta.testLocked === false || meta.testEvaluated === true ||
        (Number.isFinite(meta.testEvaluationCount) && meta.testEvaluationCount > 0) ||
        Number.isFinite(meta.bestTestMetric)) {
      fail('The trainer reported test evaluation while the final test was locked.');
    }
    return meta;
  }
  const testRows = countFor('test');
  if (stats === null && testRows === 0) return meta;
  if (!stats || typeof stats !== 'object' || Array.isArray(stats) || stats.version !== 1) {
    fail('The completed model has no supported final-test statistics report.');
  }
  if (stats.task !== task || !rowCount(stats.nRows)) fail('The final-test report has an invalid task or row count.');
  if (testRows !== null && stats.nRows !== testRows) fail('The final-test statistics row count does not match the test split.');
  return meta;
}
