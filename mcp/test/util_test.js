// MIT License — Copyright (c) 2026 Decentralized Science Labs
// The MCP server's Yes rule is the website's (src/studio/threshold.js): same answers, same refusals.
import * as mine from "../lib/util.js";
import * as site from "../../src/studio/threshold.js";
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

Deno.test("the MCP server decides exactly like the website", () => {
  const ranges = [{}, { threshold: 0.6 }, { threshold: 0.6, thresholdMax: 0.85 }, { threshold: 0 }, { threshold: 1, thresholdMax: 1 }, { threshold: 0.3, thresholdMax: 0.3 }, { threshold: "0.55" }];
  for (const r of ranges) for (let i = 0; i <= 1000; i++) {
    const p = i / 1000, a = mine.decide(p, r), b = site.decide(p, r);
    assert(a.yes === b.yes && a.answer === b.answer && a.threshold === b.threshold && a.thresholdMax === b.thresholdMax, `p=${p} ${JSON.stringify(r)}`);
  }
  for (const bad of [{ threshold: 1.2 }, { threshold: -0.1 }, { thresholdMax: 2 }, { threshold: 0.7, thresholdMax: 0.6 }, { threshold: "x" }]) {
    let a = false, b = false;
    try { mine.yesRange(bad); } catch { a = true; }
    try { site.yesRange(bad); } catch { b = true; }
    assert(a && b, `both refuse ${JSON.stringify(bad)}`);
  }
  assert(mine.decide(NaN).answer === "no" && site.decide(NaN).answer === "no", "no probability: no");
  assert(mine.DEFAULT_THRESHOLD === site.DEFAULT_THRESHOLD && mine.DEFAULT_THRESHOLD_MAX === site.DEFAULT_THRESHOLD_MAX, "same defaults");
});

Deno.test("model numbers and candle lengths", () => {
  assert(mine.parseModelId("https://crypto.gl1f.com/model.html?id=12") === 12 && mine.parseModelId("#7") === 7 && mine.parseModelId("/m/3/") === 3 && mine.parseModelId("abc") === null, "parseModelId");
  assert(mine.candleMinutes("15m") === 15 && mine.candleMinutes("4h") === 240 && mine.candleMinutes("1d") === 1440, "candleMinutes");
});
