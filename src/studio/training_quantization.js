// SPDX-License-Identifier: MIT
// Shared automatic quantization scale for browser and headless validation.
const DEFAULT_SCALE_Q = 1_000_000;
const INT32_SAFE = 2_147_480_000;

export function chooseScaleQ(task, maxAbsX, maxAbsY) {
  // Keep scaleQ high for precision, but clamp so quantized int32 values won't overflow.
  let limX = INT32_SAFE;
  if (Number.isFinite(maxAbsX) && maxAbsX > 0) limX = Math.floor(INT32_SAFE / maxAbsX);

  let limY = INT32_SAFE;
  if (task === "regression") {
    if (Number.isFinite(maxAbsY) && maxAbsY > 0) limY = Math.floor(INT32_SAFE / maxAbsY);
  }

  let scaleQ = Math.min(DEFAULT_SCALE_Q, limX, limY);
  if (!Number.isFinite(scaleQ) || scaleQ < 1) scaleQ = 1;
  return Math.floor(scaleQ);
}
