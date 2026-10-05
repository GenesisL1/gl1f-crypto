/*
MIT License

Copyright (c) 2026 Decentralized Science Labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function loadMarketWorker() {
  const path = new URL("../src/studio/market_worker.js", import.meta.url);
  const moduleRecord = { exports: {} };
  vm.runInNewContext(readFileSync(path, "utf8"), {
    module: moduleRecord, URL, Blob, DOMException, AbortController, setTimeout, clearTimeout, console,
  }, { filename: path.pathname, timeout: 5_000 });
  return moduleRecord.exports;
}

function oneSplitModel() {
  const bytes = new Uint8Array(40);
  bytes.set([0x47, 0x4c, 0x31, 0x46, 1], 0); // GL1F v1
  const view = new DataView(bytes.buffer);
  view.setUint16(6, 1, true);       // nFeatures
  view.setUint16(8, 1, true);       // depth
  view.setUint32(10, 1, true);      // nTrees
  view.setInt32(14, 0, true);       // baseQ
  view.setUint32(18, 1_000_000, true);
  view.setUint16(22, 0, true);      // reserved
  view.setUint16(24, 0, true);      // feature index
  view.setInt32(26, 1_147_032, true);
  view.setUint16(30, 0, true);      // node reserved
  view.setInt32(32, 111, true);     // equality/left leaf
  view.setInt32(36, 222, true);     // greater/right leaf
  return bytes;
}

const raw = 1.1470325589023234;
assert.equal(Math.round(raw * 1_000_000), 1_147_033);
assert.equal(Math.round(Math.fround(raw) * 1_000_000), 1_147_032);

for (const modulePath of ["../src/studio/local_infer.js"]) {
  const { decodeModel, predictQ } = await import(modulePath);
  const model = decodeModel(oneSplitModel());
  assert.equal(
    predictQ(model, [raw]),
    111,
    `${modulePath} must cast manual preview inputs to float32 before quantization`,
  );
}

const requestedOrder = ["ret_2h", "ret_1h"];
const marketWorker = loadMarketWorker();

const datasetJob = {
  exchange: "binance",
  market: "XLM",
  candle: "15m",
  direction: "up",
  basePeriod: 5,
  movePct: 1,
  retracePct: 0.5,
  horizonBars: 20,
  startMs: 0,
  endMs: 900_000,
  features: requestedOrder,
};
assert.deepEqual(
  Array.from(marketWorker.validateJob(datasetJob).features),
  requestedOrder,
  "Dataset builds must preserve the caller's authoritative feature order",
);
assert.throws(
  () => marketWorker.validateJob({ ...datasetJob, features: ["ret_1h", "ret_1h"] }),
  /duplicate feature/i,
  "Dataset builds must reject duplicate feature names",
);
assert.throws(
  () => marketWorker.validateJob({ ...datasetJob, exchange: "coinbase", market: "XLM-USD", features: ["taker_imbalance"] }),
  /does not publish taker flow/,
  "Coinbase datasets must reject features Coinbase does not publish",
);

const inferenceJob = {
  exchange: "binance",
  market: "XLM",
  candle: "15m",
  features: requestedOrder,
  scaleQ: 1_000_000,
  mode: "latest",
  basePeriod: 5,
  featureFamily: "legacy",
};
assert.deepEqual(
  Array.from(marketWorker.validateInferJob(inferenceJob).features),
  requestedOrder,
  "Inference replay must preserve the model's authoritative feature order",
);
assert.throws(
  () => marketWorker.validateInferJob({ ...inferenceJob, features: ["ret_1h", "ret_1h"] }),
  /duplicate feature/i,
  "Inference replay must reject duplicate feature names",
);
assert.equal(marketWorker.featureGroup("downside_variation_share_4h"), "Volatility");

console.log("Runtime numeric contract: quantization, equality-left traversal, worker feature order, duplicate rejection, exchange availability, and grouping passed.");
