// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Training reports: metrics and the row fingerprint are deterministic, AUC handles ties, and any change is detected.
import assert from "node:assert/strict";
import { computeReport, compareReports, aucOf, sha256Hex, quantizeRow } from "../src/studio/report.js";
assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "SHA-256 test vector");
assert.equal(aucOf([0.1, 0.4, 0.35, 0.8], [0, 0, 1, 1]), 0.75); assert.equal(aucOf([0.5, 0.5, 0.5, 0.5], [0, 1, 0, 1]), 0.5, "ties count half");
const rows = Array.from({ length: 200 }, (_, i) => ({ t: 1_700_000_000_000 + i * 900_000, y: i % 3 === 0 ? 1 : 0, q: (i % 3 === 0 ? 400 : -300) + ((i * 37) % 500) - 250 }));
const a = await computeReport(rows, 1000), b = await computeReport(rows.map((r) => ({ ...r })), 1000);
assert.deepEqual(a, b, "the same rows give the same report");
assert.equal(a.rows, 200); assert.equal(a.firstOpenMs, rows[0].t); assert.equal(a.lastOpenMs, rows[199].t); assert.match(a.fingerprint, /^[0-9a-f]{64}$/);
assert.ok(a.auc > 0.5 && a.auc <= 1 && a.logloss > 0 && a.brier > 0 && a.brier < 1 && a.accuracy > 0.5);
const tampered = await computeReport(rows.map((r, i) => (i === 120 ? { ...r, q: r.q + 1 } : r)), 1000);
assert.equal(compareReports(a, tampered).match, false, "one changed score changes the fingerprint");
assert.ok(compareReports(a, tampered).diffs.includes("fingerprint"));
assert.deepEqual(compareReports(a, { ...a, auc: 0.99 }).diffs, ["auc"], "an edited metric is caught");
assert.deepEqual(quantizeRow([0.5, -1.25, 1e12], 1000), [500, -1250, 2147483647]);
console.log(`training reports: metrics and SHA-256 row fingerprint deterministic over ${a.rows} rows (AUC ${a.auc}); edited metrics or a single changed score are detected`);
