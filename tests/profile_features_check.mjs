// MIT License — Copyright (c) 2026 Decentralized Science Labs
// A dataset trimmed for retraining keeps its profile's settings with fewer signals: profileForFeatures binds the profile to
// the model's own signals, so the check passes in the studio and after a round trip through the on-chain metadata.
import assert from "node:assert/strict";
import { normalizeProfile, verifyProfileFeatures, profileForFeatures, packFeatures, unpackFeatures, profileFromMeta, VENUES } from "../src/studio/profile.js";
import { createHash } from "node:crypto";
const full = ["ret_1_bps", "rsi_14", "atr_14_bps", "vol_z_20", "ema20_1h_logdist_bps"], kept = ["ret_1_bps", "atr_14_bps", "vol_z_20"];
const hash = createHash("sha256").update(full.join("\n") + "\n").digest("hex");
const venue = Object.keys(VENUES).find((v) => VENUES[v].exchange === "binance") || Object.keys(VENUES)[0];
const raw = { venue, symbol: "ETHUSDT", candle: "15m", featureFamily: "auto", featureOrder: full,
  label: { direction: "up", basePeriod: 15, movePct: 1, retracePct: 0.5, horizonBars: 16 }, audit: { featureOrderChecksum: { algorithm: "sha-256", encoding: "hex", value: hash } } };
await verifyProfileFeatures(normalizeProfile(raw), full);
await assert.rejects(verifyProfileFeatures(normalizeProfile(raw), kept), /feature (order|checksum) does not match/, "a trimmed model fails against the untrimmed profile");
const bound = await profileForFeatures(raw, kept);
assert.deepEqual(bound.featureOrder, kept); assert.equal(bound.symbol, "ETHUSDT"); assert.deepEqual(raw.featureOrder, full, "the original profile is not changed");
await verifyProfileFeatures(normalizeProfile(bound), kept);
const meta = unpackFeatures(packFeatures(kept, normalizeProfile(bound)));
assert.deepEqual(meta.features, kept);
await verifyProfileFeatures(profileFromMeta(meta.meta), meta.features);
const stale = unpackFeatures(packFeatures(kept, normalizeProfile(raw)));
await assert.rejects(verifyProfileFeatures(profileFromMeta(stale.meta), stale.features), /does not match/, "what models minted before the fix carry");
console.log("profile features: a trimmed retrain binds its profile to the kept signals; the check passes in the studio and after the on-chain metadata round trip; the pre-fix stale checksum is detected");
