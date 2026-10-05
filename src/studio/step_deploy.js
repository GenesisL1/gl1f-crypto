// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Step 3 · Deploy
import { $, el, fmtBytes, formatL1, shortHex, setKV, setPill, showError, downloadJson } from "./ui.js";
import { predictQ as reportPredictQ } from "./local_infer.js";
import { replayReport, computeReport, compareReports } from "./report.js";
import { chainAvailable, deployTerms, deployModel, explorerTx, modelPage, registeredTokenId, config, cryptoLive, saveAccessPlan, blockTimeSec, licenseCatalog, setInternalsVisibility } from "./chain.js";
import { LICENSE_GROUPS, licenseText, PAID_DEFAULT } from "./licenses.js";
import { packFeatures, marketLabel, targetLabel, questionText, profileForFeatures } from "./profile.js";
import { readModelPackage } from "./model_file.js";

async function generateIcon(profile, fallback = "GL1F") {
  const size = 128, canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#0f172a"); grad.addColorStop(1, "#2563eb");
  g.fillStyle = grad;
  g.beginPath(); g.roundRect(0, 0, size, size, 26); g.fill();
  g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = 1;
  for (let x = 16; x < size; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, size); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(size, x); g.stroke(); }
  const down = profile?.label?.direction === "down";
  const pts = down ? [[14, 44], [38, 52], [56, 46], [78, 66], [96, 62], [114, 84]] : [[14, 84], [38, 76], [56, 82], [78, 60], [96, 64], [114, 42]];
  g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 4; g.lineJoin = "round"; g.lineCap = "round";
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  g.fillStyle = "#ffffff";
  const [ex, ey] = pts[pts.length - 1];
  g.beginPath(); g.arc(ex, ey, 6, 0, Math.PI * 2); g.fill();
  const ticker = (profile?.ticker || fallback).slice(0, 5);
  g.font = `700 ${ticker.length > 4 ? 22 : 26}px Inter, system-ui, sans-serif`;
  g.textBaseline = "alphabetic";
  g.fillText(ticker, 14, 32);
  g.font = "600 13px 'JetBrains Mono', ui-monospace, monospace";
  g.fillStyle = "rgba(255,255,255,0.75)";
  const sub = profile ? `${profile.candle} ${down ? "DOWN" : "UP"}` : "MODEL";
  g.fillText(sub, 14, 114);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

async function validateIcon(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!png.every((b, i) => bytes[i] === b)) throw new Error("The icon must be a PNG file");
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  if (bitmap.width !== 128 || bitmap.height !== 128) throw new Error("The icon must be exactly 128 × 128 pixels");
  if (bytes.length > 64_000) throw new Error("The icon must be under 64 KB");
  return bytes;
}

const toUrl = (bytes) => URL.createObjectURL(new Blob([bytes], { type: "image/png" }));

export function initDeploy(ctx) {
  const { state } = ctx;
  const ui = {
    empty: $("#dp-empty"), ready: $("#dp-ready"), file: $("#dp-file"),
    title: $("#dp-model-title"), sub: $("#dp-model-sub"), tag: $("#dp-model-tag"),
    icon: $("#dp-icon"), iconFile: $("#dp-icon-file"), name: $("#dp-title"), desc: $("#dp-desc"),
    pricing: $("#dp-pricing"), feeField: $("#dp-fee-field"), fee: $("#dp-fee"), recipientField: $("#dp-recipient-field"), recipient: $("#dp-recipient"),
    keyGenerate: $("#dp-key-generate"), keyAddress: $("#dp-key-address"), keyDownload: $("#dp-key-download"), keySaved: $("#dp-key-saved"),
    cost: $("#dp-cost"), terms: $("#dp-terms"), license: $("#dp-license"), reportOn: $("#dp-report-on"), reportKv: $("#dp-report"), reportNote: $("#dp-report-note"), privateTick: $("#dp-private"), licenseSelect: $("#dp-license-select"), licenseNote: $("#dp-license-note"), pill: $("#dp-pill"), deploy: $("#dp-deploy"), steps: $("#dp-steps"),
    error: $("#dp-error"), result: $("#dp-result"), resultTitle: $("#dp-result-title"), resultId: $("#dp-result-id"), open: $("#dp-open"),
  };
  let model = null, iconBytes = null, iconUrl = null, ownerKey = null, terms = null, termsFor = null, deploying = false, resume = null, licenses = null, licensePick = null;

  function setIcon(bytes) {
    iconBytes = bytes;
    if (iconUrl) URL.revokeObjectURL(iconUrl);
    iconUrl = toUrl(bytes);
    ui.icon.src = iconUrl;
  }

  async function setModel(next) {
    model = next;
    resume = null;
    ui.empty.hidden = !!model;
    ui.ready.hidden = !model;
    ui.result.hidden = true;
    ui.steps.hidden = true;
    ui.steps.replaceChildren();
    showError(ui.error, null);
    if (!model) return;
    ui.title.textContent = model.profile ? marketLabel(model.profile) : model.title;
    ui.sub.textContent = `${model.usedTrees || model.decoded.nTrees} trees · depth ${model.decoded.depth} · ${model.decoded.nFeatures} features · ${fmtBytes(model.bytes.length)}${model.profile?.label ? ` · ${targetLabel(model.profile.label, model.profile.candle)}` : ""}`;
    ui.tag.textContent = model.origin === "file" ? "Model file" : "Trained in this session";
    ui.name.value = model.title || "";
    ui.desc.value = model.description || "";
    setIcon(await generateIcon(model.profile));
    ownerKey = null;
    ui.keyAddress.textContent = "—";
    ui.keyDownload.disabled = true;
    ui.keySaved.checked = false;
    terms = null; termsFor = null;
    if (model.chain?.tokenId) showDeployed(model.chain.tokenId);
    loadTerms();
    update();
  }

  async function loadTerms() {
    { const lk = $("#dp-locked"); if (lk) lk.hidden = cryptoLive(); }
    if (!model || !chainAvailable()) { setKV(ui.cost, [["Model bytes", fmtBytes(model?.bytes.length)], ["Status", globalThis.ethers ? "GL1F Crypto contracts pending deployment" : "Wallet library not loaded"], ["Fees", "Creation + per-byte, burnable by anyone"]]); update(); return; }
    const key = model.modelId;
    if (termsFor === key && terms) return;
    termsFor = key;
    setKV(ui.cost, [["Deploy fee", "Loading…"]]);
    try {
      const t = await deployTerms(model.bytes.length);
      if (termsFor !== key) return;
      terms = t;
      renderLicenses({ live: true, defaultId: t.licenseId, items: t.licenses });
      setKV(ui.cost, [
        ["Deploy fee", formatL1(t.feeWei)],
        ["Transactions", `${t.chunks + 2} (${t.chunks} storage chunk${t.chunks === 1 ? "" : "s"}, pointer table, registration)`],
        ["Contracts", `${config().network.name} · GL1F registry ${shortHex(config().contracts.registry)}`],
        ["Terms", `Version ${t.tosVersion}`],
      ]);
      const existing = await registeredTokenId(model.modelId).catch(() => 0n);
      if (existing > 0n) { model.chain = { ...(model.chain || {}), tokenId: existing.toString() }; showDeployed(existing.toString(), true); }
    } catch (error) {
      termsFor = null;
      setKV(ui.cost, [["Deploy fee", "Unavailable"], ["Reason", error?.shortMessage || error?.message || String(error)]]);
    }
    update();
  }

  // ---------------- license: chosen at mint, permanent ----------------
  function chosenLicense() { return licenses?.items.find((l) => String(l.id) === ui.licenseSelect.value) || null; }
  function renderLicenses(catalog) {
    licenses = catalog;
    const before = ui.licenseSelect.value, paid = Number(ui.pricing.value) === 2;
    // Paid models start with the reserved license (copying is unlawful); a creator's own choice always wins.
    const keep = licensePick ?? (paid ? catalog.items.find((l) => l.spdx === PAID_DEFAULT && l.selectable)?.id : null) ?? catalog.defaultId;
    const groups = LICENSE_GROUPS.map((g) => {
      const items = catalog.items.filter((l) => l.group === g.id);
      if (!items.length) return null;
      return el("optgroup", { label: g.title }, ...items.map((l) => {
        const o = el("option", { value: String(l.id), text: `${l.name}${l.id === catalog.defaultId ? " · default" : ""}${l.selectable ? "" : " · closed to new models"}` });
        o.disabled = !l.selectable;
        return o;
      }));
    }).filter(Boolean);
    ui.licenseSelect.replaceChildren(...groups);
    const pick = catalog.items.find((l) => l.id === keep && l.selectable) || catalog.items.find((l) => l.id === catalog.defaultId);
    if (pick) ui.licenseSelect.value = String(pick.id);
    if (before && before !== ui.licenseSelect.value) ui.terms.checked = false;
    showLicense();
  }
  function showLicense() {
    const l = chosenLicense();
    if (!l) { ui.licenseNote.replaceChildren(); ui.license.textContent = "the selected license"; return; }
    const group = LICENSE_GROUPS.find((g) => g.id === l.group);
    const warn = Number(ui.pricing.value) === 2 && (l.openness ?? 0) > 0
      ? el("p", { class: "lic-warn", text: "This model is paid, but this license lets anyone copy it and run it for free, so the fee works like a tip. GL1F On-Chain Use makes copying unlawful." }) : null;
    ui.licenseNote.replaceChildren(...[
      el("b", { text: l.title || l.name }),
      el("p", { text: l.summary || "A license from the on-chain catalog." }),
      el("p", {}, el("a", { href: l.url, target: "_blank", rel: "noopener noreferrer", text: "Read the full license" }), " · Written on-chain when you mint; later its admin can only open it up or move it to a later version."),
      el("span", { class: "lic-meta", text: `${l.spdx || "no SPDX identifier"} · ${group?.title || "Other"} · license #${l.id}${l.id === licenses.defaultId ? " · global default" : ""}${licenses.live ? "" : " · catalog preview"}` }),
      warn,
    ].filter(Boolean));
    ui.license.replaceChildren(el("a", { href: l.url, target: "_blank", rel: "noopener noreferrer", text: licenseText(l) }));
  }
  async function loadLicenses() {
    try { if (!terms) renderLicenses(await licenseCatalog()); }
    catch (error) { ui.licenseNote.textContent = `The license catalog could not be read (${error?.shortMessage || error?.message || error}).`; }
    update();
  }

  // ---------------- subscription plans (paid access only) ----------------
  const planUi = { box: $("#dp-plans"), list: $("#dp-plan-list"), add: $("#dp-plan-add"), hint: $("#dp-plan-hint") };
  let plans = [{ days: 30, price: "1", active: true }];
  function renderPlans() {
    planUi.list.replaceChildren(...plans.map((plan, k) => {
      const days = el("input", { type: "number", min: "1", max: "3650", step: "1", value: String(plan.days), "aria-label": `Plan ${k + 1} duration in days` });
      const price = el("input", { type: "number", min: "0", step: "0.01", value: plan.price, "aria-label": `Plan ${k + 1} price in L1` });
      const active = el("input", { type: "checkbox", "aria-label": `Plan ${k + 1} active` }); active.checked = plan.active;
      const remove = el("button", { class: "btn2", type: "button", text: "Remove" });
      days.addEventListener("input", () => { plan.days = Number(days.value); update(); });
      price.addEventListener("input", () => { plan.price = price.value; update(); });
      active.addEventListener("change", () => { plan.active = active.checked; });
      remove.addEventListener("click", () => { plans.splice(k, 1); renderPlans(); update(); });
      return el("div", { class: "plan-row" }, el("span", { class: "plan-n", text: `Plan ${k + 1}` }),
        el("label", { class: "plan-f" }, el("span", { text: "Days" }), days), el("label", { class: "plan-f" }, el("span", { text: "Price · L1" }), price),
        el("label", { class: "check" }, active, el("span", { text: "Active" })), remove);
    }));
    planUi.add.disabled = plans.length >= 8;
    planUi.hint.textContent = plans.length ? `${plans.length} plan${plans.length === 1 ? "" : "s"} · durations are converted to blocks at the chain's measured block time` : "No plans: access is pay-per-inference only.";
  }
  planUi.add.addEventListener("click", () => { if (plans.length < 8) { plans.push({ days: plans.length ? 90 : 30, price: "2.5", active: true }); renderPlans(); update(); } });
  function planProblem() {
    if (Number(ui.pricing.value) !== 2) return null;
    for (const [k, plan] of plans.entries()) {
      if (!(Number.isInteger(plan.days) && plan.days >= 1 && plan.days <= 3650)) return `Plan ${k + 1}: duration must be 1 to 3650 days`;
      try { if (globalThis.ethers.parseEther(String(plan.price || "0")) < 0n) throw new Error(); } catch { return `Plan ${k + 1}: price is not a valid L1 amount`; }
    }
    return null;
  }
  async function createPlans(modelId) {
    if (Number(ui.pricing.value) !== 2 || !plans.length) return 0;
    const seconds = await blockTimeSec();
    let created = 0;
    for (const [k, plan] of plans.entries()) {
      const id = `plan-${k}`, label = `Subscription plan ${k + 1}: ${plan.days} days · ${plan.price} L1`;
      stepRow({ id, label, status: "run" });
      try {
        const out = await saveAccessPlan({ modelId, durationBlocks: Math.max(1, Math.round((plan.days * 86_400) / seconds)), priceWei: globalThis.ethers.parseEther(String(plan.price || "0")), active: plan.active });
        stepRow({ id, label, status: "ok", hash: out.hash }); created++;
      } catch (error) {
        stepRow({ id, label, status: "fail" });
        showError(ui.error, `${label} was not created (${error?.shortMessage || error?.message || error}). The model is live; add plans later on the marketplace page.`);
      }
    }
    return created;
  }

  function pricing() {
    const mode = Number(ui.pricing.value);
    let feeWei = 0n;
    if (mode !== 0) {
      try { feeWei = globalThis.ethers.parseEther(String(ui.fee.value || "0")); } catch { feeWei = 0n; }
    }
    return { mode, feeWei, recipient: ui.recipient.value.trim() };
  }

  function blocker() {
    const w = state.wallet;
    if (!model) return "No model";
    if (model.chain?.tokenId) return "Already deployed";
    if (!chainAvailable()) return globalThis.ethers ? "GL1F Crypto contracts are not live yet" : "Wallet library not loaded";
    if (!w.available) return "Install an EVM wallet";
    if (!w.address) return "Connect a wallet";
    if (!w.onGenesis) return "Switch to GenesisL1";
    if (!ui.name.value.trim()) return "Enter a name";
    if (!ui.desc.value.trim()) return "Enter a description";
    if (!iconBytes?.length) return "Add an icon";
    const p = pricing();
    if (p.mode !== 0 && p.feeWei <= 0n) return "Enter a fee above 0";
    if (p.mode !== 0 && p.recipient && !globalThis.ethers.isAddress(p.recipient)) return "Recipient is not an address";
    const planIssue = planProblem();
    if (planIssue) return planIssue;
    if (!ownerKey) return "Generate an owner key";
    if (!ui.keySaved.checked) return "Confirm the key is saved";
    const lic = chosenLicense();
    if (!lic) return "Choose a license";
    if (!lic.selectable) return "Choose a license that is open to new models";
    if (!terms) return "Loading fees";
    if (!ui.terms.checked) return "Accept the terms";
    return null;
  }

  function update() {
    const reason = deploying ? "Deploying…" : blocker();
    ui.deploy.disabled = !!reason;
    if (!deploying) setPill(ui.pill, reason || "Ready to deploy", reason ? "" : "ok");
    const paid = Number(ui.pricing.value) !== 0;
    ui.feeField.hidden = !paid;
    ui.recipientField.hidden = !paid;
    planUi.box.hidden = Number(ui.pricing.value) !== 2;
    ui.deploy.textContent = resume ? "Resume deployment" : "Deploy model";
  }

  function stepRow(step) {
    let row = ui.steps.querySelector(`[data-id="${step.id}"]`);
    if (!row) {
      row = el("li", { dataset: { id: step.id } }, el("span", { class: "label" }), el("span", { class: "link" }));
      ui.steps.append(row);
    }
    row.className = step.status || "";
    row.querySelector(".label").textContent = step.label || row.querySelector(".label").textContent;
    if (step.hash) row.querySelector(".link").replaceChildren(el("a", { href: explorerTx(step.hash), target: "_blank", rel: "noopener noreferrer", text: shortHex(step.hash, 8, 6) }));
    ui.steps.hidden = false;
  }

  // ---------------- training report (computed by the studio, read-only) ----------------
  // The final test rows are rebuilt from public candles with the backtest replay anyone can run; the report is published
  // only if the rebuild matches this session exactly, so every number in it can be checked later.
  let reportState = { model: null, report: null, error: null, busy: false }, privacyTouched = false;
  const reportMarket = ctx.market;
  const fmtPct = (x) => (x == null ? "—" : x.toFixed(4));
  function renderReport() {
    const r = reportState.report;
    ui.reportKv.replaceChildren();
    if (r) for (const [k, v] of [["Test rows", r.rows.toLocaleString("en-US")], ["Window", `${new Date(r.firstOpenMs).toISOString().slice(0, 16).replace("T", " ")} → ${new Date(r.lastOpenMs).toISOString().slice(0, 16).replace("T", " ")} UTC`],
      ["ROC AUC", fmtPct(r.auc)], ["Log-loss", fmtPct(r.logloss)], ["Accuracy", fmtPct(r.accuracy)], ["Fingerprint", `${r.fingerprint.slice(0, 16)}…`]]) ui.reportKv.append(el("div", { class: "k", text: k }), el("div", { class: "v", text: v }));
    ui.reportOn.disabled = !r;
    if (!r) ui.reportOn.checked = false;
    ui.reportNote.textContent = reportState.busy ? "Rebuilding the final test rows from public candles…" : reportState.error ? reportState.error
      : r ? "Computed by the studio from this session's final test; it cannot be edited. Anyone who can run the model can rebuild these rows from public candles and check every number." : "";
  }
  async function prepareReport() {
    const m = state.model, ds = state.dataset;
    if (!m || (reportState.model === m && (reportState.report || reportState.error || reportState.busy))) return;
    reportState = { model: m, report: null, error: null, busy: true }; renderReport();
    try {
      const p = m.profile, idx = m.testIndex, mx = ds?.matrix;
      if (!p?.label || !idx?.length || !mx) throw new Error("A training report needs a model trained in this session.");
      const nF = mx.nFeatures, row = (i) => (Array.isArray(mx.X[i]) ? mx.X[i] : mx.X.subarray(i * nF, (i + 1) * nF));
      const sessionRows = idx.map((i) => ({ t: Number(mx.times[i]), y: Number(mx.y[i]), q: Number(reportPredictQ(m.decoded, row(i))) })).sort((a, b) => a.t - b.t);
      const session = await computeReport(sessionRows, m.decoded.scaleQ);
      const { report } = await replayReport(reportMarket, m, p, session.firstOpenMs, session.lastOpenMs);
      const cmp = compareReports(session, report);
      if (!cmp.match) throw new Error(`Rebuilding the test rows from public candles gave a different result (${cmp.diffs.join(", ")}), so others could not verify it; it will not be published.`);
      if (reportState.model === m) { reportState.report = report; ui.reportOn.checked = true; }
    } catch (e) { if (reportState.model === m) reportState.error = e?.message || String(e); }
    if (reportState.model === m) { reportState.busy = false; renderReport(); }
  }
  ui.privateTick.addEventListener("change", () => { privacyTouched = true; });
  document.querySelector("#dp-monetization")?.addEventListener("click", () => setTimeout(() => { if (!privacyTouched) ui.privateTick.checked = pricing().mode === 2; }, 0));
  document.querySelector("#dp-monetization")?.addEventListener("change", () => { if (!privacyTouched) ui.privateTick.checked = pricing().mode === 2; });
  ctx.on("step", (s) => { if (s === "deploy") { if (!privacyTouched) ui.privateTick.checked = pricing().mode === 2; prepareReport(); } });

  async function deploy() {
    if (blocker() || deploying) return;
    if (ui.reportOn.checked && reportState.busy) { showError(ui.error, "Wait a moment: the training report is still being computed."); return; }
    deploying = true;
    showError(ui.error, null);
    setPill(ui.pill, "Confirm in your wallet", "busy");
    update();
    const p = pricing();
    const progress = resume || { modelId: model.modelId, pointers: [], tablePtr: null, txs: [] };
    try {
      const report = ui.reportOn.checked && !ui.reportOn.disabled && reportState.model === model ? reportState.report : null;
      // The profile is bound to the model's own signals at mint, whatever path produced the dataset.
      const featuresPacked = packFeatures(model.featureNames, await profileForFeatures(model.profile, model.featureNames), report);
      const out = await deployModel({
        bytes: model.bytes, modelId: model.modelId, decoded: model.decoded,
        title: ui.name.value.trim(), description: ui.desc.value.trim(), iconBytes, featuresPacked,
        pricingMode: p.mode, feeWei: p.feeWei, recipient: p.recipient || state.wallet.address, ownerKey: ownerKey.address, licenseId: Number(ui.licenseSelect.value),
        resume: progress,
        onStep: (step) => { stepRow(step); if (step.status === "run") setPill(ui.pill, step.hash ? "Waiting for confirmation" : "Confirm in your wallet", "busy"); },
      });
      resume = null;
      // Internals: private by default when paid, public otherwise; only a different choice needs a transaction.
      const wantPrivate = ui.privateTick.checked;
      if (wantPrivate !== (p.mode === 2)) {
        stepRow({ id: "privacy", label: wantPrivate ? "Keep internals private" : "Show internals", status: "run" });
        const hash = await setInternalsVisibility(out.tokenId, wantPrivate ? 2 : 1);
        stepRow({ id: "privacy", label: wantPrivate ? "Keep internals private" : "Show internals", status: "ok", hash });
      }
      model.title = ui.name.value.trim();
      const plansCreated = await createPlans(model.modelId);
      model.chain = { tokenId: out.tokenId, pricingMode: p.mode, inferenceEnabled: true, feeWei: p.feeWei.toString(), plans: plansCreated, license: chosenLicense() };
      showDeployed(out.tokenId);
      ctx.emit("deployed", model);
    } catch (error) {
      if (progress.pointers.length || progress.tablePtr) resume = progress;
      const message = error?.code === "ACTION_REJECTED" || error?.code === 4001 ? "Transaction rejected in the wallet." : (error?.shortMessage || error?.reason || error?.message || String(error));
      showError(ui.error, message);
      ui.steps.querySelectorAll("li.run").forEach((li) => { li.className = "fail"; });
    } finally {
      deploying = false;
      update();
    }
  }

  function showDeployed(tokenId, existing = false) {
    ui.result.hidden = false;
    ui.resultTitle.textContent = existing ? `Already deployed as Model #${tokenId}` : `Deployed as Model #${tokenId}`;
    ui.resultId.textContent = shortHex(model.modelId, 10, 8);
    ui.open.href = modelPage(tokenId);
    const shareUrl = modelPage(tokenId, "crypto"), share = $("#dp-share"), field = $("#dp-share-url");
    share.dataset.shareUrl = shareUrl;
    share.dataset.shareText = `${ui.name.value.trim() || model.title || "My Crypto AI model"}: a Crypto AI model on GenesisL1. ${model.profile?.label ? questionText(model.profile) : ""}`.trim();
    field.value = shareUrl;
    ctx.stepStatus("deploy", `Model #${tokenId}`, true);
    update();
  }

  ui.file.addEventListener("change", async () => {
    const file = ui.file.files?.[0];
    ui.file.value = "";
    if (!file) return;
    try {
      const loaded = await readModelPackage(file);
      state.model = loaded;
      ctx.emit("model", loaded);
    } catch (error) {
      let node = ui.empty.querySelector(".alert");
      if (!node) { node = el("div", { class: "alert", role: "alert" }); ui.empty.append(node); }
      node.textContent = error.message;
    }
  });
  ui.iconFile.addEventListener("change", async () => {
    const file = ui.iconFile.files?.[0];
    ui.iconFile.value = "";
    if (!file) return;
    try { setIcon(await validateIcon(file)); showError(ui.error, null); } catch (error) { showError(ui.error, error); }
    update();
  });
  ui.keyGenerate.addEventListener("click", () => {
    try {
      ownerKey = globalThis.ethers.Wallet.createRandom();
      ui.keyAddress.textContent = shortHex(ownerKey.address, 8, 6);
      ui.keyAddress.title = ownerKey.address;
      ui.keyDownload.disabled = false;
      ui.keySaved.checked = false;
    } catch (error) { showError(ui.error, error); }
    update();
  });
  ui.keyDownload.addEventListener("click", () => {
    if (!ownerKey) return;
    downloadJson(`gl1f-owner-key-${ownerKey.address.slice(2, 10).toLowerCase()}.json`, {
      kind: "gl1f-owner-access-key", address: ownerKey.address, privateKey: ownerKey.privateKey,
      model: { modelId: model?.modelId, title: ui.name.value.trim() }, network: "GenesisL1 (chainId 29)", createdAt: new Date().toISOString(),
      note: "Keep this file private. It signs owner inference calls for this model; it cannot move funds from your wallet.",
    });
  });
  for (const node of [ui.name, ui.desc, ui.fee, ui.recipient]) node.addEventListener("input", update);
  for (const node of [ui.pricing, ui.keySaved, ui.terms]) node.addEventListener("change", update);
  // A different license must be accepted again.
  ui.pricing.addEventListener("change", () => { if (licenses) renderLicenses(licenses); });
  ui.licenseSelect.addEventListener("change", () => { licensePick = Number(ui.licenseSelect.value); ui.terms.checked = false; showLicense(); update(); });
  ui.deploy.addEventListener("click", deploy);
  $("#dp-to-infer").addEventListener("click", () => { ctx.emit("infer-source", "session"); ctx.goTo("infer"); });

  ctx.on("model", (m) => setModel(m));
  ctx.on("wallet", () => update());
  ctx.on("step", (step) => { if (step === "deploy" && model) loadTerms(); });
  setModel(state.model);
  renderPlans();
  loadLicenses();
}
