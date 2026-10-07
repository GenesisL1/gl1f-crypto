// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Step 4 · Inference
import { decide, rangeText } from "./threshold.js";
import { $, el, fmtInt, fmtPct, fmtPrice, fmtUtc, shortHex, setKV, renderStats, setPill, setProgress, showError, segmented, downloadJson, downloadText, sha256Hex, table, csvCell, renderPager, buyBadge, formatL1 } from "./ui.js";
import { replayReport, compareReports, quantizeRow } from "./report.js";
import { chainAvailable, listModels, loadChainModel, predictOnChain, modelPage, modelDetails, cryptoLive, localRunPermission, apiClient, apiConfig, walletSigner, listingsFor } from "./chain.js";
import { predictQ } from "./local_infer.js";
import { marketLabel, targetLabel, horizonLabel, INTERVAL_MIN, VENUES, EXCHANGE_VENUE, verifyProfileFeatures } from "./profile.js";
import { readModelPackage } from "./model_file.js";

const MARKET_DEFAULT = { binance: "ETH", coinbase: "ETH-USD", hyperliquid: "ETH" };
const sigmoid = (z) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));
const utcInput = (ms) => new Date(ms).toISOString().slice(0, 16);
const parseUtcInput = (value) => (value ? Date.parse(`${value}:00Z`) : NaN);

// How much history inference replays at most: 120 days or 4,000 of the model's candles, whichever is longer (the
// engine's bounded replay window; inputs equal a replay from the training seed).
function replayDays(candle) {
  const m = /^(\d+)([mhdw])$/.exec(String(candle || "")), unit = { m: 1, h: 60, d: 1440, w: 10080 };
  const minutes = m ? Number(m[1]) * unit[m[2]] : 15;
  return Math.round(Math.max(120, (4000 * minutes) / 1440)).toLocaleString("en-US");
}

export function initInfer(ctx) {
  const { state, market } = ctx;
  const ui = {
    sessionPane: $("#in-src-session"), sessionEmpty: $("#in-session-empty"), publishedPane: $("#in-src-published"), filePane: $("#in-src-file"),
    listStatus: $("#in-list-status"), refresh: $("#in-refresh"), list: $("#in-list"), pager: $("#in-pager"),
    drop: $("#in-drop"), file: $("#in-file"),
    model: $("#in-model"), title: $("#in-model-title"), sub: $("#in-model-sub"), tag: $("#in-model-tag"), profileKv: $("#in-profile-kv"),
    manual: $("#in-manual"), mExchange: $("#in-m-exchange"), mCandle: $("#in-m-candle"), mFamily: $("#in-m-family"), mSeed: $("#in-m-seed"),
    market: $("#in-market"), markets: $("#in-markets"), asofField: $("#in-asof-field"), asof: $("#in-asof"), threshold: $("#in-threshold"), thresholdMax: $("#in-threshold-max"), markMax: $("#in-prob-mark-max"),
    verifyWrap: $("#in-verify-wrap"), verify: $("#in-verify"), pill: $("#in-pill"), cancel: $("#in-cancel"), run: $("#in-run"),
    box: $("#in-run-box"), stage: $("#in-stage"), pct: $("#in-pct"), bar: $("#in-bar"), progress: $("#in-progress"), message: $("#in-message"),
    error: $("#in-error"), result: $("#in-result"), signal: $("#in-signal"), signalLabel: $("#in-signal-label"), probability: $("#in-probability"),
    decision: $("#in-decision"), fill: $("#in-prob-fill"), mark: $("#in-prob-mark"), signalSub: $("#in-signal-sub"),
    stats: $("#in-stats"), evidence: $("#in-evidence"), vec: $("#in-vec"), vecCount: $("#in-vec-count"),
  };
  const models = { session: state.model || null, published: null, file: null };
  let pubSet = "crypto";
  const PAGE = 10;
  const loadChainModelIn = (set, id, cb) => loadChainModel(id, cb, set);
  const marketLists = {};
  const list = { items: [], page: 0, total: 0, loading: false, loaded: false, selected: null };
  let source = "session", catalogueNames = null, running = false, last = null;

  const sourceSeg = segmented($("#in-source"), (value) => setSource(value));
  $("#in-to-backtest")?.addEventListener("click", () => { if (!state.inferModel) return; ctx.emit("infer-model", state.inferModel); ctx.goTo("backtest"); });
  const modeSeg = segmented($("#in-mode"), (value) => {
    ui.asofField.hidden = value !== "historical";
    if (value === "historical" && !ui.asof.value) ui.asof.value = utcInput(Math.floor(Date.now() / 3_600_000) * 3_600_000 - 86_400_000);
  });

  market.request("catalogue", { exchange: "binance" }).then((reply) => {
    catalogueNames = new Set(reply.features.map((f) => f.name));
    if (list.loaded) renderList();
  }).catch(() => {});

  const active = () => models[source];

  // ---------------- verified track record: the report published at mint, rebuilt and checked by anyone with access ----------------
  const fmt4 = (x) => (x == null || !Number.isFinite(x) ? "—" : x.toFixed(4)), utc = (ms) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
  function kvInto(node, rows) { node.replaceChildren(...rows.flatMap(([k, v]) => [el("div", { class: "k", text: k }), el("div", { class: "v", text: v })])); }
  function renderReportCard(m) {
    const box = $("#in-report"), r = m?.report;
    box.hidden = !(m?.origin === "chain" && (r || m.mintedAtMs));
    if (box.hidden) return;
    $("#in-report-hint").textContent = r ? `ROC AUC ${fmt4(r.auc)} on ${Number(r.rows).toLocaleString("en-US")} test rows` : "No report was published at mint";
    kvInto($("#in-report-kv"), r ? [["Published at mint", `${Number(r.rows).toLocaleString("en-US")} test rows · ${utc(r.firstOpenMs)} → ${utc(r.lastOpenMs)} UTC`], ["ROC AUC", fmt4(r.auc)], ["Log-loss", fmt4(r.logloss)], ["Accuracy", fmt4(r.accuracy)], ["Fingerprint", `${String(r.fingerprint).slice(0, 16)}…`]] : [["Published at mint", "No training report"]]);
    $("#in-report-result").textContent = ""; $("#in-since-kv").replaceChildren();
  }
  async function verifyReport() {
    const m = active(), out = $("#in-report-result"), button = $("#in-report-verify");
    if (!m || m.origin !== "chain" || market.busy) return;
    button.disabled = true;
    const p = effectiveProfile(m), lines = [];
    try {
      out.textContent = "Checking inference access…";
      const perm = await localRunPermission(m.tokenId, m.contractSet || "crypto").catch(() => ({ ok: true }));
      if (perm?.ok === false) throw new Error("Verifying needs access to this model's inference: subscribe, or ask its admin.");
      if (m.report) {
        out.textContent = "Rebuilding the published test rows from public candles…";
        const { report, rows, bt } = await replayReport(market, m, p, m.report.firstOpenMs, m.report.lastOpenMs);
        const cmp = compareReports(m.report, report);
        lines.push(cmp.match ? `Verified: ${report.rows.toLocaleString("en-US")} test rows rebuilt from public candles; every metric and the fingerprint match the report published at mint.` : `Does not match the report published at mint: ${cmp.diffs.join(", ")} differ.`);
        const picks = rows.length ? [...new Set([0, Math.floor(rows.length / 2), rows.length - 1])].map((i) => rows[i]) : [];
        let agree = 0;
        try {
          for (const row of picks) { const onChain = await predictOnChain(m.modelId, quantizeRow(bt.X.subarray(row.r * bt.nFeatures, (row.r + 1) * bt.nFeatures), m.decoded.scaleQ), "latest", m.contractSet || "crypto"); if (onChain.scoreQ === BigInt(row.q)) agree++; }
          lines.push(`On-chain inference on GenesisL1 gives the same score on ${agree} of ${picks.length} sampled rows.`);
        } catch (e) { lines.push(`On-chain spot check unavailable: ${e?.shortMessage || e?.message || e}`); }
      }
      if (m.mintedAtMs) {
        out.textContent = lines.concat("Scoring every completed candle since minting…").join(" ");
        const candleMs = ({ "1m": 1, "3m": 3, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "2h": 120, "4h": 240, "6h": 360, "8h": 480, "12h": 720, "1d": 1440 }[p.candle] || 60) * 60_000;
        const fromMs = Math.ceil(m.mintedAtMs / candleMs) * candleMs, toMs = Date.now() - ((Number(p.label?.horizonBars) || 1) + 2) * candleMs;
        if (toMs - fromMs < 50 * candleMs) kvInto($("#in-since-kv"), [["Since minting", "Too young: not enough candles with known outcomes yet"]]);
        else {
          const since = await replayReport(market, m, p, fromMs, toMs);
          kvInto($("#in-since-kv"), since.report ? [["Since minting", `${since.report.rows.toLocaleString("en-US")} rows the model never saw · ${utc(since.report.firstOpenMs)} → ${utc(since.report.lastOpenMs)} UTC`], ["ROC AUC", fmt4(since.report.auc)], ["Log-loss", fmt4(since.report.logloss)], ["Accuracy", fmt4(since.report.accuracy)]] : [["Since minting", "No rows with known outcomes yet"]]);
        }
      }
      out.textContent = lines.join(" ") || "Done.";
    } catch (e) { out.textContent = e?.message || String(e); }
    finally { button.disabled = false; }
  }
  $("#in-report-verify").addEventListener("click", verifyReport);

  // ---------------- Web3 API: the same calls from code, with ready code, access keys and a live try ----------------
  let apiKey = null, apiModel = null, lastInputs = null;
  const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");
  function apiSnippet(m, cfg, paid) {
    const lines = [
      `// npm i ethers   ·   download ${new URL("./sdk/gl1f-crypto.js", location.href).href} next to your script (Node 18+), or import it from that URL in a browser`,
      `import * as ethers from "ethers";`,
      `import { GL1FCrypto } from "./gl1f-crypto.js";`,
      ``,
      `const gl1f = new GL1FCrypto({ ethers, rpcUrl: "${cfg.rpcUrl}", chainId: ${cfg.chainId ?? 29}, registry: "${cfg.registry}", runtime: "${cfg.runtime}" });`,
      `const model = await gl1f.model(${m.tokenId});   // ${m.title || "Crypto AI model"}`,
      ``,
      `// Inputs on the latest completed candle, computed by the GL1F market engine (the studio's own code):`,
      `const engine = await GL1FCrypto.nodeEngine();   // in a browser: await GL1FCrypto.browserEngine()`,
      `const inputs = await gl1f.latestInputs(model, { engine });`,
    ];
    if (paid) lines.push(``, `// Paid model: buy a plan once for an access key (keep key.privateKey secret), then sign each request with it.`,
      `// const key = gl1f.newAccessKey(); await gl1f.buyAccess(model, PLAN_ID, key.address, walletSigner);`,
      `const out = await gl1f.predict(model, inputs.valuesQ, { accessKey: process.env.GL1F_ACCESS_KEY });`,
      `// or pay per run from a wallet: await gl1f.predict(model, inputs.valuesQ, { payer: walletSigner })`);
    else lines.push(``, `const out = await gl1f.predict(model, inputs.valuesQ);   // a free read: no key, no gas`);
    lines.push(`console.log(model.title, "P =", out.probability.toFixed(4), out.answer, "via", out.via);   // yes at 0.5 or more; pass { threshold, thresholdMax } to change it`);
    return lines.join("\n");
  }
  async function renderApi(m) {
    const box = $("#in-api");
    box.hidden = !(m?.origin === "chain");
    if (box.hidden) return;
    apiModel = null;
    const paid = Number(m.pricingMode) === 2, cfg = await apiConfig(m.contractSet || "crypto").catch(() => ({}));
    kvInto($("#in-api-kv"), [["Token", `#${m.tokenId}`], ["Model ID", short(m.modelId)], ["Access", paid ? "Paid: an access key with a plan, the admin's signature, or a fee per run" : "Free read: no key, no gas"],
      ["Registry", cfg.registry || "—"], ["Runtime", cfg.runtime || "—"], ["RPC", cfg.rpcUrl || "—"], ["Chain ID", String(cfg.chainId ?? "—")]]);
    $("#in-api-code").textContent = apiSnippet(m, cfg, paid);
    $("#in-api-keybox").hidden = !paid;
    $("#in-api-result").textContent = "";
    if (paid) {
      try {
        apiModel = await apiClient(m.contractSet || "crypto").model(m.tokenId);
        $("#in-api-plan").replaceChildren(...apiModel.plans.filter((p) => p.active).map((p) => el("option", { value: String(p.id), text: `Plan ${p.id}: ${p.durationBlocks.toLocaleString("en-US")} blocks · ${Number(p.priceWei) / 1e18} L1` })));
      } catch (e) { $("#in-api-result").textContent = `Could not read the plans: ${e?.shortMessage || e?.message || e}`; }
    }
  }
  $("#in-api-copy").addEventListener("click", () => navigator.clipboard?.writeText($("#in-api-code").textContent).then(() => { $("#in-api-result").textContent = "Code copied."; }));
  $("#in-api-newkey").addEventListener("click", () => {
    apiKey = apiClient().newAccessKey();
    kvInto($("#in-api-keykv"), [["Key address", apiKey.address], ["Private key", apiKey.privateKey]]);
    $("#in-api-buy").disabled = !$("#in-api-plan").value;
  });
  $("#in-api-buy").addEventListener("click", async () => {
    const m = active(), out = $("#in-api-result");
    if (!m || !apiKey) return;
    try {
      out.textContent = "Confirm the plan purchase in your wallet…";
      const r = await apiClient(m.contractSet || "crypto").buyAccess(apiModel || m.tokenId, Number($("#in-api-plan").value), apiKey.address, await walletSigner());
      out.textContent = `Plan bought for ${short(apiKey.address)}: active until block ${r.untilBlock.toLocaleString("en-US")}.`;
    } catch (e) { out.textContent = `Purchase failed: ${e?.shortMessage || e?.reason || e?.message || e}`; }
  });
  $("#in-api-inputs").addEventListener("click", () => {
    if (!lastInputs) return;
    navigator.clipboard?.writeText(JSON.stringify(lastInputs, null, 1)).then(() => { $("#in-api-result").textContent = "Inputs copied (JSON with valuesQ)."; });
  });
  $("#in-api-try").addEventListener("click", async () => {
    const m = active(), out = $("#in-api-result");
    if (!m || !lastInputs) return;
    try {
      out.textContent = "Calling GenesisL1…";
      const r = await apiClient(m.contractSet || "crypto").predict(apiModel || m.tokenId, lastInputs.valuesQ, apiKey ? { accessKey: apiKey.privateKey } : {});
      out.textContent = `API result: P = ${r.probability.toFixed(4)} (score ${r.scoreQ}) via ${r.via}.`;
    } catch (e) { out.textContent = `API call failed: ${e?.shortMessage || e?.reason || e?.message || e}`; }
  });

  function setSource(value) {
    // Two sources: this session's model, or a model published on GL1F Crypto.
    if (value !== "session") value = "crypto";
    sourceSeg.set(value, false);
    source = value === "crypto" ? "published" : "session";
    ui.sessionPane.hidden = source !== "session";
    ui.publishedPane.hidden = source !== "published";
    ui.filePane.hidden = true;
    if (source === "published" && !list.loaded && !list.loading) loadList(0);
    showError(ui.error, null);
    renderModel();
  }

  // ---------------- published models ----------------

  function replayability(item) {
    if (item.task && item.task !== "binary_classification") return { ok: false, label: item.task.replace(/_classification$/, "").replace(/_/g, " "), tone: "" };
    if (item.profile) return { ok: true, label: `${VENUES[item.profile.venue]?.short} · ${item.profile.symbol} · ${item.profile.candle}`, tone: "good" };
    if (catalogueNames && item.featureNames.length && item.featureNames.every((f) => catalogueNames.has(f))) return { ok: true, label: "Market features · set profile", tone: "warn" };
    return { ok: false, label: "Custom features", tone: "" };
  }

  function renderList() {
    const rows = list.items;
    ui.list.replaceChildren(...rows.map((item) => {
      // Every row opens the model's own page: Use runs it there, Buy goes to its sale.
      const r = replayability(item), page = modelPage(item.tokenId);
      const access = item.pricingMode === 0 ? "Free" : item.pricingMode === 1 ? "Tips" : `Paid · ${formatL1(item.feeWei)} / run`;
      const main = el("a", { class: "model-row-main", href: page },
        item.icon ? el("img", { src: item.icon, alt: "" }) : el("img", { alt: "" }),
        el("div", { class: "meta" },
          el("strong", { text: `#${item.tokenId} · ${item.title}` }),
          el("div", { class: "tags" },
            buyBadge(item.listing) || "",
            el("span", { class: "tag price", text: access }),
            el("span", { class: `tag${r.tone ? ` ${r.tone}` : ""}`, text: r.label }),
            ((item.internalsPrivate ?? Number(item.pricingMode) === 2) ? el("span", { class: "tag", text: "Internals private" }) : el("span", { class: "tag", text: `${item.nTrees} tree${item.nTrees === 1 ? "" : "s"}` })))));
      const actions = el("div", { class: "row-actions" },
        item.listing?.listed ? el("a", { class: "btn hype small", href: `${page}#mp-market`, text: `Buy · ${formatL1(item.listing.priceWei)}` }) : "",
        el("a", { class: "btn2 small", href: page, text: "Use" }));
      return el("div", { class: "model-row", role: "listitem" }, main, actions);
    }));
    const pages = Math.max(1, Math.ceil((list.total || 0) / PAGE));
    ui.listStatus.textContent = list.loading ? "Loading from GenesisL1…" : list.total ? `Page ${list.page + 1} of ${pages} · ${list.total} published, newest first` : "";
    renderPager(ui.pager, list.page, list.loading ? 0 : pages, (page) => loadList(page));
    if (list.loaded && !rows.length && !list.loading) ui.list.replaceChildren(el("div", { class: "empty" }, el("p", {}, el("strong", { text: "No Crypto AI models on this page." }), " Deploy one in the Deploy step.")));
  }

  // Ten models per page, newest first: only the models on screen are read from the chain, with their listings.
  async function loadList(page = 0) {
    if (!chainAvailable(pubSet)) { ui.listStatus.textContent = !globalThis.ethers ? "GenesisL1 is unavailable: the wallet library did not load." : "The GL1F Crypto contracts are not live yet."; return; }
    list.loading = true;
    renderList();
    try {
      const before = page > 0 && list.total ? Math.max(0, list.total - page * PAGE) : null;
      const res = await listModels({ before, limit: PAGE, set: pubSet });
      const listings = await listingsFor(res.items.map((i) => i.tokenId), pubSet).catch(() => new Map());
      for (const it of res.items) it.listing = listings.get(Number(it.tokenId)) || null;
      list.total = res.total; list.page = before === null ? 0 : page; list.items = res.items; list.loaded = true;
    } catch (error) {
      ui.listStatus.textContent = "";
      showError(ui.error, `Could not read GenesisL1: ${error?.shortMessage || error?.message || error}`);
    } finally {
      list.loading = false;
      renderList();
    }
  }

  async function selectPublished(item) {
    if (running) return;
    running = true;
    showError(ui.error, null);
    ui.box.hidden = false;
    ui.message.textContent = "";
    ui.stage.textContent = `Loading model #${item.tokenId}`;
    renderList();
    try {
      // The model's license decides whether this browser may run it: reserved licenses allow it only while the model
      // is free to run, or for its admin and holders of active access.
      const permission = await localRunPermission(item.tokenId, pubSet);
      if (!permission.ok) throw new Error(`Model #${item.tokenId} is licensed for on-chain use only (${permission.license?.name || "all rights reserved"}). Its admin and active subscribers can run it here; anyone else can subscribe to it on the marketplace.`);
      const loaded = await loadChainModelIn(pubSet, item.tokenId, (value, text) => {
        ui.pct.textContent = `${setProgress(ui.bar, ui.progress, value)}%`;
        ui.message.textContent = text;
      });
      list.selected = item.tokenId;
      models.published = { origin: "chain", contractSet: pubSet, ...loaded, usedTrees: loaded.decoded.nTrees, icon: item.icon, pricingMode: item.pricingMode, owner: item.owner, internalsPrivate: item.internalsPrivate, mintedAtMs: item.mintedAtMs, report: item.report };
      ui.result.hidden = true;
    } catch (error) {
      showError(ui.error, error?.shortMessage || error?.message || String(error));
    } finally {
      running = false;
      ui.box.hidden = true;
      renderList();
      renderModel();
    }
  }

  // ---------------- model card ----------------

  function effectiveProfile(m) {
    if (m.profile) return m.profile;
    const exchange = ui.mExchange.value, seed = parseUtcInput(ui.mSeed.value);
    return {
      venue: EXCHANGE_VENUE[exchange], exchange, exchangeName: VENUES[EXCHANGE_VENUE[exchange]].name, exchangeShort: VENUES[EXCHANGE_VENUE[exchange]].short,
      symbol: null, candle: ui.mCandle.value, featureFamily: ui.mFamily.value, featureSeedStartMs: Number.isFinite(seed) ? seed : null,
      warmupBars: null, scaleQ: m.decoded.scaleQ, label: null, btcContext: null, manual: true,
    };
  }

  async function loadMarkets(exchange) {
    if (!marketLists[exchange]) {
      try { marketLists[exchange] = (await market.request("markets", { exchange })).markets; } catch { marketLists[exchange] = []; }
    }
    ui.markets.replaceChildren(...marketLists[exchange].slice(0, 1200).map((m) => el("option", { value: m.value })));
  }

  function renderModel() {
    { const am = active(); state.inferModel = am || null; const b = $("#in-to-backtest"); if (b) b.hidden = !am?.profile?.label; }
    const m = active();
    ui.sessionEmpty.hidden = !(source === "session" && !m);
    ui.model.hidden = !m;
    if (!m) { ui.run.disabled = true; return; }
    const p = effectiveProfile(m);
    ui.title.textContent = m.title || (m.profile ? marketLabel(m.profile) : "Model");
    const origin = m.origin === "chain" ? `GenesisL1 · block ${fmtInt(m.chain.blockNumber)}` : m.origin === "trained" ? "Trained in this session" : "Model file";
    // Paid models keep their internals private, except for their admin (the NFT owner).
    const privateInternals = m.origin === "chain" && (m.internalsPrivate ?? Number(m.pricingMode) === 2) && !(state.wallet?.address && m.owner && state.wallet.address.toLowerCase() === String(m.owner).toLowerCase());
    ui.sub.textContent = privateInternals ? `${origin} · paid model · internals private` : `${origin} · ${m.usedTrees || m.decoded.nTrees} trees · depth ${m.decoded.depth} · ${m.decoded.nFeatures} features`;
    renderReportCard(m);
    renderApi(m);
    ui.tag.textContent = m.chain?.tokenId ? `Model #${m.chain.tokenId}` : m.origin === "trained" ? "Local" : "File";
    ui.tag.className = `tag${m.chain?.tokenId ? " blue" : ""}`;
    ui.manual.hidden = !!m.profile;
    const engineOk = !catalogueNames || m.featureNames.every((f) => catalogueNames.has(f));
    setKV(ui.profileKv, [
      ["Market", m.profile ? marketLabel(m.profile) : "Set below"],
      ["Target", m.profile?.label ? targetLabel(m.profile.label, m.profile.candle) : "Not recorded"],
      ["Feature engine", privateInternals ? `private for paid models${engineOk ? "" : " · not buildable here"}` : `${m.profile?.featureFamily || p.featureFamily} · ${m.featureNames.length} features${engineOk ? "" : " · not buildable here"}`],
      ["Replay seed", p.featureSeedStartMs ? `${fmtUtc(p.featureSeedStartMs)} · inference replays at most ${replayDays(p.candle)} days, cached after the first run` : "Minimum warm-up"],
      ["Model ID", shortHex(m.modelId, 10, 8)],
    ]);
    const exchange = p.exchange;
    if (!ui.market.value || ui.market.dataset.model !== m.modelId) {
      ui.market.value = m.profile?.symbol || MARKET_DEFAULT[exchange];
      ui.market.dataset.model = m.modelId;
    }
    loadMarkets(exchange);
    const verifiable = !!m.chain?.tokenId && m.chain.pricingMode !== 2 && m.chain.inferenceEnabled !== false && chainAvailable(m.contractSet || "crypto");
    ui.verifyWrap.hidden = !verifiable;
    ui.run.disabled = running || !engineOk;
    setPill(ui.pill, engineOk ? "Ready" : "Features not supported", engineOk ? "" : "warn");
  }

  ui.mExchange.addEventListener("change", () => {
    ui.market.value = MARKET_DEFAULT[ui.mExchange.value];
    renderModel();
  });
  for (const node of [ui.mCandle, ui.mFamily, ui.mSeed]) node.addEventListener("change", renderModel);

  // ---------------- run ----------------

  function job(m, p) {
    const symbolInput = ui.market.value.trim();
    const sameMarket = !!m.profile && symbolInput.toUpperCase() === String(m.profile.symbol).toUpperCase();
    const mode = modeSeg.value, asOfMs = mode === "historical" ? parseUtcInput(ui.asof.value) : null;
    if (mode === "historical" && !Number.isFinite(asOfMs)) throw new Error("Enter a historical UTC time");
    if (!symbolInput) throw new Error("Enter a market");
    return {
      exchange: p.exchange, market: symbolInput, candle: p.candle, features: m.featureNames, featureFamily: p.featureFamily || "auto",
      scaleQ: m.decoded.scaleQ, warmupBars: p.warmupBars || null, featureSeedStartMs: m.profile ? (sameMarket ? p.featureSeedStartMs : null) : p.featureSeedStartMs,
      basePeriod: p.label?.basePeriod || 0, mode, asOfMs, btcSymbol: sameMarket ? p.btcContext : undefined, cacheCandles: true,
    };
  }

  async function run() {
    const m = active();
    if (!m || running) return;
    if (market.busy) { showError(ui.error, "Wait for the dataset build to finish."); return; }
    showError(ui.error, null);
    let j;
    const p = effectiveProfile(m);
    try {
      // Inputs are computed by name in the model's own signal order, so a profile that records a different list (a model
      // retrained with fewer signals and minted before 1.10.5) cannot change them: note it and run.
      if (m.profile) await verifyProfileFeatures(m.profile, m.featureNames).catch((e) => console.info(`GL1F: ${e.message}; the inputs follow the model's own signal list.`));
      j = job(m, p);
    } catch (error) { showError(ui.error, error); return; }
    running = true;
    ui.run.disabled = true;
    ui.cancel.hidden = false;
    ui.box.hidden = false;
    ui.result.hidden = true;
    setPill(ui.pill, "Replaying features…", "busy");
    ui.stage.textContent = "Starting"; ui.message.textContent = "";
    setProgress(ui.bar, ui.progress, 0); ui.pct.textContent = "0%";
    try {
      const vector = await market.request("infer", { job: j }, {
        onProgress: (msg) => {
          ui.pct.textContent = `${setProgress(ui.bar, ui.progress, msg.value * 0.9)}%`;
          ui.stage.textContent = { prepare: "Preparing", fetch: "Downloading candles", features: "Replaying features", ready: "Scoring" }[msg.stage] || msg.stage;
          if (msg.message) ui.message.textContent = msg.message;
        },
      });
      const scoreQ = predictQ(m.decoded, vector.values);
      lastInputs = { tokenId: m.tokenId ?? null, modelId: m.modelId, selectedOpenMs: vector.selectedOpenMs ?? null, valuesQ: Array.from(vector.valuesQ) };
      for (const id of ["#in-api-inputs", "#in-api-try"]) $(id).disabled = false;
      const probability = sigmoid(scoreQ / m.decoded.scaleQ);
      let chainCheck = null;
      if (!ui.verifyWrap.hidden && ui.verify.checked) {
        ui.stage.textContent = "Verifying on GenesisL1";
        setPill(ui.pill, "Calling predictView…", "busy");
        try {
          const out = await predictOnChain(m.modelId, vector.valuesQ, "latest", m.contractSet || "crypto");
          chainCheck = { blockNumber: out.blockNumber, scoreQ: out.scoreQ.toString(), match: out.scoreQ === BigInt(scoreQ) };
        } catch (error) {
          chainCheck = { error: error?.shortMessage || error?.reason || error?.message || String(error) };
        }
      }
      ui.pct.textContent = `${setProgress(ui.bar, ui.progress, 1)}%`;
      const vectorSha = await sha256Hex(vector.valuesQ.join(","));
      last = { model: m, profile: p, vector, scoreQ, probability, chainCheck, vectorSha, threshold: Number(ui.threshold.value), thresholdMax: Number(ui.thresholdMax.value), createdAt: new Date().toISOString() };
      renderResult(last);
      setPill(ui.pill, chainCheck?.match === false ? "On-chain mismatch" : "Done", chainCheck?.match === false ? "bad" : "ok");
      ctx.stepStatus("infer", `${fmtPct(probability)} · ${vector.symbol} ${vector.candle}`, true);
    } catch (error) {
      setPill(ui.pill, error.name === "AbortError" ? "Cancelled" : "Failed", error.name === "AbortError" ? "" : "bad");
      if (error.name !== "AbortError") showError(ui.error, humanize(error, p.exchange));
    } finally {
      running = false;
      ui.cancel.hidden = true;
      ui.box.hidden = true;
      renderModel();
    }
  }

  function humanize(error, exchange) {
    const text = String(error?.message || error), name = { coinbase: "Coinbase", hyperliquid: "Hyperliquid" }[exchange] || "Binance";
    if (/Failed to fetch|NetworkError|network or CORS/i.test(text)) return `${name} could not be reached from this browser. Check the connection, VPN or regional access, then retry.`;
    if (/HTTP 404|NotFound/i.test(text)) return `Market not found on ${name}. Check the symbol.`;
    return text;
  }

  function renderResult(r) {
    const { vector, probability, profile: p } = r;
    let range;   // the Yes range from the two fields: threshold <= P <= upper limit (defaults 0.5 and 1)
    try { range = decide(probability, { threshold: r.threshold, thresholdMax: r.thresholdMax }); } catch { range = null; }
    const threshold = range?.threshold ?? 0.5, on = !!range?.yes;
    ui.signal.classList.toggle("on", on);
    ui.probability.textContent = fmtPct(probability, 1);
    ui.decision.textContent = !range ? "Check the range" : on ? "Signal" : "No signal";
    ui.fill.style.width = `${(probability * 100).toFixed(2)}%`;
    ui.mark.style.left = `${(threshold * 100).toFixed(2)}%`;
    if (ui.markMax) { ui.markMax.hidden = !(range && range.thresholdMax < 1); if (range) ui.markMax.style.left = `${(range.thresholdMax * 100).toFixed(2)}%`; }
    ui.signalLabel.textContent = p.label ? `P(${p.label.direction === "down" ? "down" : "up"} target first)` : "P(class 1)";
    ui.signalSub.textContent = `${vector.symbol} · ${vector.exchangeName} · ${vector.candle} candle closed ${fmtUtc(vector.signalAvailableMs)} · ${range ? `signal when ${rangeText(range)}` : "the upper limit must not be below the threshold"}`;
    const candleMs = INTERVAL_MIN[vector.candle] * 60_000, items = [
      { label: "Candle close", value: fmtPrice(vector.candleData.close) },
    ];
    if (p.label && Number.isFinite(vector.baseline)) {
      const up = p.label.direction !== "down", b = vector.baseline;
      items.push({ label: `EMA${p.label.basePeriod} baseline`, value: fmtPrice(b) });
      items.push({ label: `Target ${up ? "+" : "−"}${p.label.movePct}%`, value: fmtPrice(up ? b * (1 + p.label.movePct / 100) : b * (1 - p.label.movePct / 100)) });
      items.push({ label: `Stop ${up ? "−" : "+"}${p.label.retracePct}%`, value: fmtPrice(up ? b * (1 - p.label.retracePct / 100) : b * (1 + p.label.retracePct / 100)) });
      const ends = new Date(vector.signalAvailableMs + p.label.horizonBars * candleMs).toISOString();
      items.push({ label: `Window ends (${horizonLabel(p.label.horizonBars, vector.candle)}) · UTC`, value: `${ends.slice(5, 10)} ${ends.slice(11, 16)}` });
    }
    items.push({ label: "Score (int)", value: String(r.scoreQ) });
    renderStats(ui.stats, items);
    const evidence = [`Replayed ${vector.features.length} features from ${fmtInt(Math.round((vector.signalAvailableMs - vector.fetchStartMs) / candleMs))} candles (${vector.warmupSource})`, `vector sha-256 ${r.vectorSha.slice(0, 16)}…`];
    if (vector.candleData.synthetic) evidence.push("no trades in this candle (filled with the previous close)");
    if (r.chainCheck?.match === true) evidence.push(`GenesisL1 predictView at block ${fmtInt(r.chainCheck.blockNumber)} returned the identical score`);
    else if (r.chainCheck?.match === false) evidence.push(`GenesisL1 returned ${r.chainCheck.scoreQ}, which differs from the local score`);
    else if (r.chainCheck?.error) evidence.push(`On-chain check unavailable: ${r.chainCheck.error}`);
    else evidence.push("scored locally with the exact GL1F integer runtime");
    ui.evidence.textContent = evidence.join(" · ");
    ui.vecCount.textContent = `${vector.features.length} values`;
    table(ui.vec, ["Feature", "Value", "Quantized"], vector.features.map((name, i) => [name, String(vector.values[i]), String(vector.valuesQ[i])]));
    ui.result.hidden = false;
    ui.result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  }

  function receipt(r) {
    const m = r.model, v = r.vector;
    return {
      schema: "gl1f-crypto-inference/v1", createdAt: r.createdAt,
      model: { source: m.origin, title: m.title, modelId: m.modelId, tokenId: m.chain?.tokenId || null, page: m.chain?.tokenId ? modelPage(m.chain.tokenId) : null, scaleQ: m.decoded.scaleQ },
      market: { exchange: v.exchange, venue: v.venue, symbol: v.symbol, candle: v.candle },
      candle: { openUtc: new Date(v.selectedOpenMs).toISOString(), closeUtc: new Date(v.signalAvailableMs).toISOString(), ...v.candleData, emaBaseline: v.baseline },
      target: r.profile.label ? { ...r.profile.label, horizon: horizonLabel(r.profile.label.horizonBars, v.candle) } : null,
      replay: { featureFamily: v.featureFamily, featureVersion: v.featureVersion, fetchStartUtc: new Date(v.fetchStartMs).toISOString(), warmupSource: v.warmupSource, serverTimeUtc: new Date(v.serverTimeMs).toISOString() },
      output: (() => { let d = null; try { d = decide(r.probability, { threshold: r.threshold, thresholdMax: r.thresholdMax }); } catch {}
        return { scoreQ: String(r.scoreQ), probability: r.probability, threshold: d?.threshold ?? r.threshold, thresholdMax: d?.thresholdMax ?? r.thresholdMax, signal: !!d?.yes }; })(),
      onChain: r.chainCheck,
      vector: { sha256: r.vectorSha, features: v.features, values: v.values, valuesQ: v.valuesQ },
    };
  }

  ui.run.addEventListener("click", run);
  ui.cancel.addEventListener("click", () => market.cancel());
  $("#in-receipt").addEventListener("click", () => last && downloadJson(`gl1f-inference-${last.vector.symbol}-${last.vector.candle}-${new Date(last.vector.selectedOpenMs).toISOString().slice(0, 16).replace(/[:T]/g, "")}.json`, receipt(last)));
  $("#in-vector").addEventListener("click", () => {
    if (!last) return;
    const v = last.vector;
    const lines = ["feature,value,value_q", ...v.features.map((name, i) => [name, v.values[i], v.valuesQ[i]].map(csvCell).join(","))];
    downloadText(`gl1f-vector-${v.symbol}-${v.candle}.csv`, lines.join("\n") + "\n", "text/csv");
  });
  for (const node of [ui.threshold, ui.thresholdMax]) node?.addEventListener("input", () => {
    if (last && !ui.result.hidden) { last.threshold = Number(ui.threshold.value); last.thresholdMax = Number(ui.thresholdMax.value); renderResult(last); }
  });
  ui.refresh.addEventListener("click", () => loadList(list.page || 0));
  ui.file.addEventListener("change", async () => {
    const file = ui.file.files?.[0];
    ui.file.value = "";
    if (!file) return;
    try { models.file = await readModelPackage(file); showError(ui.error, null); ui.result.hidden = true; }
    catch (error) { showError(ui.error, error); }
    renderModel();
  });
  for (const type of ["dragenter", "dragover"]) ui.drop.addEventListener(type, (e) => { e.preventDefault(); ui.drop.classList.add("drag"); });
  for (const type of ["dragleave", "drop"]) ui.drop.addEventListener(type, () => ui.drop.classList.remove("drag"));
  ui.drop.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    ui.file.files = transfer.files;
    ui.file.dispatchEvent(new Event("change"));
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-source]");
    if (button) setSource(button.dataset.source);
  });

  // A model trained in this session opens here (unless a model link was followed).
  let lastSession = null;
  const fromLink = Number(new URLSearchParams(location.search).get("model")) > 0;
  const syncSession = () => {
    models.session = state.model || null;
    if (models.session && models.session !== lastSession) { lastSession = models.session; if (source !== "session" && !fromLink) setSource("session"); }
    if (source === "session") { ui.result.hidden = true; renderModel(); }
  };
  ctx.on("model", syncSession);
  ctx.on("deployed", syncSession);
  ctx.on("infer-source", (value) => setSource(value));
  ctx.on("step", (step) => { if (step === "infer") renderModel(); });
  // Shared links: app.html?model=<tokenId>#infer opens that published Crypto AI model, selected and ready to run.
  // (Before 1.10.8 the source was switched back to "This session" right after, so the link showed nothing.)
  const shared = Number(new URLSearchParams(location.search).get("model"));
  if (Number.isInteger(shared) && shared > 0) {
    setSource("crypto");
    ctx.goTo?.("infer");
    modelDetails(shared, "crypto").then((item) => selectPublished(item).then(() => ui.run?.scrollIntoView?.({ block: "center", behavior: "smooth" })))
      .catch((error) => showError(ui.error, `Model #${shared} could not be loaded: ${error?.message || error}`));
  } else setSource("crypto");
}
