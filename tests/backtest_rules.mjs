// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Backtest trade rules: next-candle entry only, entry must be tradable and inside stop/target, leverage and liquidation.
import assert from "node:assert/strict";
import { simulate } from "../src/studio/step_backtest.js";

function market(rows, synthetic = []) {
  const n = rows.length, f = (k) => Float64Array.from(rows.map((r) => r[k]));
  return { nRows: n, times: Float64Array.from(rows.map((_, i) => i * 60_000)), open: f(0), high: f(1), low: f(2), close: f(3),
    baseline: Float64Array.from(rows.map(() => 100)), synthetic: Uint8Array.from(rows.map((_, i) => (synthetic.includes(i) ? 1 : 0))) };
}
const label = { direction: "up", movePct: 1, retracePct: 0.5, horizonBars: 3 };
const base = { threshold: 0.5, feePct: 0, slipBps: 0, ...label };
const flat = [100, 100.2, 99.9, 100];
const prob = (n, at = [0]) => Float64Array.from({ length: n }, (_, i) => (at.includes(i) ? 0.9 : 0.1));

// 1. Signal at candle 0 closes; entry is candle 1's open, never candle 0's close.
let s = simulate(market([flat, [100, 101.3, 99.8, 101.1], flat, flat]), prob(4), base);
assert.equal(s.trades.length, 1); assert.equal(s.trades[0].entryTime, 60_000); assert.equal(s.trades[0].entry, 100);
assert.equal(s.trades[0].outcome, "target"); assert.equal(s.trades[0].exit, 101);
// 2. Next candle opens beyond the target (or the stop): the signal is void, no trade.
s = simulate(market([flat, [101.2, 101.5, 101, 101.2], flat, flat]), prob(4), base);
assert.equal(s.trades.length, 0); assert.equal(s.stats.skipped.target, 1);
s = simulate(market([flat, [99.4, 99.6, 99, 99.2], flat, flat]), prob(4), base);
assert.equal(s.trades.length, 0); assert.equal(s.stats.skipped.stop, 1);
// 3. Next candle had no trades (gap-filled) or does not exist: no trade.
s = simulate(market([flat, flat, flat, flat], [1]), prob(4), base);
assert.equal(s.trades.length, 0); assert.equal(s.stats.skipped.untradable, 1);
s = simulate(market([flat, flat, flat, flat]), prob(4, [3]), base);
assert.equal(s.trades.length, 0); assert.equal(s.stats.skipped.untradable, 1);
// 4. Stop first when both levels are touched in one candle.
s = simulate(market([flat, [100, 101.5, 99.4, 100], flat, flat]), prob(4), base);
assert.equal(s.trades[0].outcome, "stop");
// 5. Leverage multiplies the return on margin; fees are charged on the leveraged notional.
s = simulate(market([flat, [100, 101.3, 99.8, 101.1], flat, flat]), prob(4), { ...base, leverage: 10, feePct: 0.05 });
assert.ok(Math.abs(s.trades[0].net - (10 * 0.01 - 0.0005 * 10 * (1 + 1.01))) < 1e-12);
// 6. At 100x the liquidation level (1% - 0.5% maintenance = 0.5%) is reached no later than the 0.5% stop: whole margin lost.
s = simulate(market([flat, [100, 100.2, 99.4, 99.6], flat, flat]), prob(4), { ...base, leverage: 100, mmrPct: 0.5 });
assert.equal(s.trades[0].outcome, "liquidated"); assert.equal(s.trades[0].net, -1); assert.equal(s.stats.liquidations, 1);
// 7. Losing all margin with 100% margin per trade ends the account; nothing trades afterwards.
s = simulate(market([flat, [100, 100.2, 99.4, 99.6], flat, flat, flat, flat]), prob(6, [0, 3]), { ...base, leverage: 100, mmrPct: 0.5 });
assert.equal(s.stats.bankrupt, true); assert.equal(s.trades.length, 1); assert.equal(s.stats.totalReturn, -1);
// 8. 1x keeps the original spot arithmetic.
s = simulate(market([flat, [100, 101.3, 99.8, 101.1], flat, flat]), prob(4), { ...base, feePct: 0.1 });
assert.ok(Math.abs(s.trades[0].net - (1.01 * 0.999 * 0.999 - 1)) < 1e-12);
console.log("backtest rules: next-open entry, void signals, untradable candles, stop-first, leverage fees, liquidation and ruin OK");
