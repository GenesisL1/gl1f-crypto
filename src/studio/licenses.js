// MIT License — Copyright (c) 2026 Decentralized Science Labs
// License catalog for Crypto AI model NFTs: the standard licenses a creator can pick when minting.
// licenses.json lists them in on-chain order (license id = position); the registry stores the same entries.
import CATALOG from "./licenses.json" with { type: "json" };

export { CATALOG };
export const LICENSE_GROUPS = [...CATALOG.groups, { id: "other", title: "Other", summary: "Added to the on-chain catalog after launch." }];
const BY_SPDX = new Map(CATALOG.licenses.map((l) => [l.spdx, l]));
const BY_NAME = new Map(CATALOG.licenses.map((l) => [l.name.toLowerCase(), l]));

// Adds the plain-language summary, group and full title to a license read from the chain. Matches the SPDX
// identifier, or the display name when no SPDX identifier is recorded.
export function describeLicense(entry) {
  if (!entry) return null;
  const meta = (entry.spdx && BY_SPDX.get(entry.spdx)) || (entry.name && BY_NAME.get(String(entry.name).toLowerCase())) || null;
  return { ...entry, spdx: entry.spdx || meta?.spdx || "", title: meta?.title || entry.name, group: meta?.group || "other", summary: meta?.summary || "", kind: meta?.kind || null,
    openness: entry.openness ?? meta?.openness ?? 0, supersedes: entry.supersedes || 0 };
}

// The catalog before the contracts are live: exactly the entries the deployment writes on-chain, in the same order.
export function staticLicenseCatalog() {
  const items = CATALOG.licenses.map((l, i) => describeLicense({ id: i + 1, name: l.name, url: l.url, spdx: l.spdx, selectable: true, openness: l.openness }));
  return { live: false, defaultId: CATALOG.licenses.findIndex((l) => l.spdx === CATALOG.default) + 1, items };
}

export const PAID_DEFAULT = CATALOG.paidDefault;
// Openness 0 means all rights reserved (the GL1F On-Chain Use License, or a license whose terms are unknown here).
export const isReserved = (l) => !!l && (l.openness ?? 0) === 0;

// Licenses a model admin may move a model to: a later version of its license, or any more open license.
export function licenseUpgradeOptions(current, items) {
  if (!current) return [];
  const later = (l) => {
    for (let x = l.supersedes, n = 0; x && n < 32; n++) { if (x === current.id) return true; x = items.find((i) => i.id === x)?.supersedes || 0; }
    return false;
  };
  return items.filter((l) => l.selectable && l.id !== current.id && (later(l) || (l.openness ?? 0) > (current.openness ?? 0)));
}

export function licenseText(l) {
  if (!l) return "—";
  return l.spdx && l.spdx !== l.name ? `${l.name} (${l.spdx})` : l.name;
}
