// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Crypto AI models for the MCP server: list them, describe one, the trading rules its backtest uses, and its latest
// answer on GenesisL1. The model runs once per candle, shared by everyone who asks; each caller's Yes range
// (threshold <= P <= threshold_max, defaults 0.5 and 1) is applied to that shared probability.
import { candleMinutes, decide, yesRange, rangeText } from "./util.js";

export const DISCLAIMER = "Educational, experimental software, not investment advice. A Crypto AI model estimates a probability and can be wrong.";
const L1 = (wei) => (Number(wei || 0n) / 1e18).toString();

export function createModels({ sdk, engine, questionText, siteUrl, now = () => Date.now(), modelTtlMs = 10 * 60_000 }) {
  const cache = new Map(), answers = new Map(), inflight = new Map();
  const url = (id) => `${siteUrl}model.html?id=${id}`;
  async function model(id) {
    const hit = cache.get(id);
    if (hit && now() - hit.at < modelTtlMs) return hit.model;
    const m = await sdk.model(id);
    cache.set(id, { model: m, at: now() });
    return m;
  }
  const access = (m) => (m.pricingMode === 2 ? "paid" : m.pricingMode === 1 ? "tips" : "free");
  function describe(m) {
    const p = m.profile || null, open = !(m.internalsPrivate ?? m.pricingMode === 2);
    return {
      id: m.tokenId, title: m.title, description: m.description || "", question: p ? questionText(p) : null,
      market: p ? { exchange: p.exchange || null, symbol: p.symbol, coin: p.ticker || null, candle: p.candle } : null,
      access: access(m), feePerRunL1: m.pricingMode ? L1(m.feeWei) : "0", inferenceEnabled: m.inferenceEnabled !== false,
      signals: open ? m.nFeatures : null, url: url(m.tokenId),
    };
  }
  // The rules of the site's Backtest page for this model, so an agent acts the way the backtest did.
  function rules(m, range = {}) {
    const p = m.profile, L = p?.label;
    if (!L) return null;
    const r = yesRange(range), when = rangeText(r), up = L.direction !== "down", mins = candleMinutes(p.candle);
    return {
      model: m.tokenId, direction: up ? "long" : "short", threshold: r.threshold, thresholdMax: r.thresholdMax, candle: p.candle, market: p.symbol,
      signal: `${when} at the close of a ${p.candle} candle (P is the model's probability)`,
      entry: "at the open of the next candle, only if that open is still between the stop and the target",
      baseline: `EMA${L.basePeriod} of the ${p.symbol} ${p.candle} closes, at the signal candle`, basePeriod: L.basePeriod,
      targetPct: L.movePct, stopPct: L.retracePct, horizonCandles: L.horizonBars, horizonMinutes: L.horizonBars * mins,
      exit: `at the target, at the stop, or at the close of candle ${L.horizonBars} after entry; the stop first when both are touched in one candle`,
      onePositionAtATime: true,
      summary: `${up ? "Long" : "Short"} when ${when} at a ${p.candle} candle close → enter at the next open (only if it is between stop and target) · target ${up ? "+" : "−"}${L.movePct}% / stop ${up ? "−" : "+"}${L.retracePct}% from EMA${L.basePeriod} · exit at target, stop or the close of candle ${L.horizonBars} · stop first when both are touched in one candle · one position at a time.`,
    };
  }
  async function list({ before = null, limit = 10 } = {}) {
    const nft = await sdk.nft(), total = Number(await nft.totalMinted());
    const from = Math.min(total, before ? Number(before) - 1 : total), n = Math.min(20, Math.max(1, Number(limit) || 10)), ids = [];
    for (let id = from; id >= 1 && ids.length < n; id--) ids.push(id);
    const models = (await Promise.all(ids.map((id) => model(id).then(describe).catch(() => null)))).filter(Boolean);
    return { total, models, more: ids.length && ids.at(-1) > 1 ? { before: ids.at(-1) } : null };
  }
  // The model's probability for the latest completed candle, computed once per candle for everyone.
  async function latest(id) {
    const m = await model(id);
    if (!m.profile?.label) throw new Error(`Model #${id} has no market profile, so its inputs cannot be computed here.`);
    if (m.inferenceEnabled === false) throw new Error(`Model #${id}: its admin has switched inference off.`);
    if (m.pricingMode === 2) throw new Error(`Model #${id} is paid: its answers are for its subscribers (${url(id)}).`);
    const step = candleMinutes(m.profile.candle) * 60_000, latestClose = Math.floor((now() - 5_000) / step) * step;
    const hit = answers.get(id);
    if (hit && hit.closeMs >= latestClose) return hit;   // this candle's answer
    if (inflight.has(id)) return inflight.get(id);
    const job = (async () => {
      const inputs = await sdk.latestInputs(m, { engine }), r = await sdk.predict(m, inputs.valuesQ);
      const closeMs = Number(inputs.selectedOpenMs) + step;
      const a = { model: id, title: m.title, question: questionText(m.profile), probability: Number(r.probability.toFixed(6)),
        candleClose: new Date(closeMs).toISOString(), closeMs, market: `${m.profile.symbol} ${m.profile.candle}`, answeredOn: `GenesisL1 (${r.via})` };
      answers.set(id, a);
      return a;
    })().finally(() => inflight.delete(id));
    inflight.set(id, job);
    return job;
  }
  // The latest answer, yes or no by the caller's range (checked before anything runs).
  async function ask(id, range = {}) {
    const r = yesRange(range), a = await latest(id), d = decide(a.probability, r);
    return { model: a.model, title: a.title, question: a.question, answer: d.answer, yes: d.yes, probability: a.probability,
      threshold: d.threshold, thresholdMax: d.thresholdMax, rule: `yes when ${rangeText(r)}`, candleClose: a.candleClose,
      market: a.market, answeredOn: a.answeredOn, url: url(id), disclaimer: DISCLAIMER };
  }
  return { model, describe, rules, list, ask, url };
}
