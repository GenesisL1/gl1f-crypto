// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Owner transactions for the GL1F Crypto registry and marketplace, printed as JSON { to, value, data } so that a
// multisig (for example the custom-data form of a Safe transaction builder) or an ordinary wallet can send them.
//
//   node scripts/owner_tx.mjs <action> [arguments] [--registry 0x…] [--market 0x…] [--rpc URL]
//
//   accept-ownership [registry|market|both]              the proposed owner takes control (step 2 of 2)
//   transfer-ownership <address> [registry|market|both]  propose a new owner (step 1 of 2); 0x000…000 cancels
//   set-creation-fee <L1>   set-byte-fee-wei <wei>   set-listing-fee <L1>
//   set-default-license <SPDX identifier or id>         set-license-enabled <id> <true|false>
//   add-license <name> <url> <SPDX identifier> <openness 0-4>   set-license-supersedes <id> <older id>
//   set-tos <file>   (publishes a new version of the Terms of Service, stored in full on-chain)
//
// Addresses default to site/runtime-config.js. SPDX identifiers are resolved on-chain with --rpc; without it, by
// their position in src/studio/licenses.json, the order in which the deploy script writes them on-chain.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { Contract, Interface, JsonRpcProvider, getAddress, parseEther } from "ethers";

const CATALOG = JSON.parse(readFileSync(new URL("../src/studio/licenses.json", import.meta.url), "utf8"));
const OWNABLE = ["function acceptOwnership()", "function transferOwnership(address newOwner)"];
export const REGISTRY_OWNER_ABI = new Interface([...OWNABLE, "function setDeployFeeWei(uint256 feeWei)", "function setSizeFeeWeiPerByte(uint256 weiPerByte)",
  "function setActiveLicenseId(uint32 id)", "function setLicenseEnabled(uint32 id, bool enabled)", "function addLicenseWithSpdx(string name, string url, string spdx, uint8 openness)", "function setLicenseSupersedes(uint32 id, uint32 older)",
  "function setToS(string text)", "function licenseIdBySpdx(string spdx) view returns (uint32)"]);
export const MARKET_OWNER_ABI = new Interface([...OWNABLE, "function setListingFeeWei(uint256 feeWei)"]);

async function licenseId(value, { registry, rpc }) {
  if (/^\d+$/.test(String(value))) return Number(value);
  if (rpc) {
    const id = Number(await new Contract(registry, REGISTRY_OWNER_ABI, new JsonRpcProvider(rpc)).licenseIdBySpdx(value));
    if (!id) throw new Error(`${value} is not in the on-chain license catalog`);
    return id;
  }
  const i = CATALOG.licenses.findIndex((l) => l.spdx === value);
  if (i < 0) throw new Error(`${value} is not in src/studio/licenses.json`);
  return i + 1;
}

// The transactions for one owner action, each { contract, to, value, data, description }.
export async function buildOwnerTxs(action, params = [], { registry, market, rpc } = {}) {
  const tx = (contract, to, iface, fn, args, description) => {
    if (!to) throw new Error(`No ${contract} address: pass --${contract} 0x… or deploy the contracts first`);
    return { contract, to: getAddress(to), value: "0", data: iface.encodeFunctionData(fn, args), description };
  };
  const pick = (which = "both", make) => {
    if (!["both", "registry", "market"].includes(which)) throw new Error("Choose registry, market or both");
    return [...(which !== "market" ? [make("registry", registry, REGISTRY_OWNER_ABI)] : []), ...(which !== "registry" ? [make("market", market, MARKET_OWNER_ABI)] : [])];
  };
  switch (action) {
    case "accept-ownership": return pick(params[0], (c, to, i) => tx(c, to, i, "acceptOwnership", [], `Accept ownership of the ${c} (sent by the proposed owner)`));
    case "transfer-ownership": {
      const next = getAddress(params[0]);
      return pick(params[1], (c, to, i) => tx(c, to, i, "transferOwnership", [next], /^0x0+$/.test(next) ? `Cancel the pending ${c} handover` : `Propose ${next} as owner of the ${c}`));
    }
    case "set-creation-fee": return [tx("registry", registry, REGISTRY_OWNER_ABI, "setDeployFeeWei", [parseEther(String(params[0]))], `Model creation fee: ${params[0]} L1`)];
    case "set-byte-fee-wei": return [tx("registry", registry, REGISTRY_OWNER_ABI, "setSizeFeeWeiPerByte", [BigInt(params[0])], `Per-byte fee: ${params[0]} wei`)];
    case "set-listing-fee": return [tx("market", market, MARKET_OWNER_ABI, "setListingFeeWei", [parseEther(String(params[0]))], `Listing fee: ${params[0]} L1`)];
    case "set-default-license": {
      const id = await licenseId(params[0], { registry, rpc });
      return [tx("registry", registry, REGISTRY_OWNER_ABI, "setActiveLicenseId", [id], `Global default license: #${id} (${params[0]})`)];
    }
    case "set-license-enabled": {
      const on = String(params[1]).toLowerCase();
      if (!/^\d+$/.test(String(params[0])) || !["true", "false"].includes(on)) throw new Error("Usage: set-license-enabled <id> <true|false>");
      return [tx("registry", registry, REGISTRY_OWNER_ABI, "setLicenseEnabled", [Number(params[0]), on === "true"], `${on === "true" ? "Enable" : "Disable"} license #${params[0]} for new models`)];
    }
    case "add-license": {
      const openness = Number(params[3]);
      if (params.length < 4 || !(Number.isInteger(openness) && openness >= 0 && openness <= 4)) throw new Error("Usage: add-license <name> <url> <SPDX identifier> <openness: 0 reserved, 1 restricted, 2 share-alike, 3 permissive, 4 public domain>");
      return [tx("registry", registry, REGISTRY_OWNER_ABI, "addLicenseWithSpdx", [params[0], params[1], params[2], openness], `Add license ${params[0]} (${params[2]}, openness ${openness})`)];
    }
    case "set-license-supersedes":
      if (!/^\d+$/.test(String(params[0])) || !/^\d+$/.test(String(params[1]))) throw new Error("Usage: set-license-supersedes <id> <older id>");
      return [tx("registry", registry, REGISTRY_OWNER_ABI, "setLicenseSupersedes", [Number(params[0]), Number(params[1])], `License #${params[0]} is a later version of #${params[1]}`)];
    case "set-tos": return [tx("registry", registry, REGISTRY_OWNER_ABI, "setToS", [readFileSync(params[0], "utf8")], `New terms from ${params[0]}`)];
    default: throw new Error(`Unknown action "${action}"`);
  }
}

function configAddresses() {
  try { const box = {}; vm.runInNewContext(readFileSync(new URL("../site/runtime-config.js", import.meta.url), "utf8"), box); return box.GL1F_RUNTIME?.contracts || {}; }
  catch { return {}; }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  const argv = process.argv.slice(2), opts = {}, rest = [];
  for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith("--")) opts[argv[i].slice(2)] = argv[++i]; else rest.push(argv[i]); }
  const [action, ...params] = rest;
  if (!action) { console.error("Usage: node scripts/owner_tx.mjs <action> [arguments] [--registry 0x…] [--market 0x…] [--rpc URL]  (see the header of this file)"); process.exit(2); }
  const cfg = configAddresses();
  try { console.log(JSON.stringify(await buildOwnerTxs(action, params, { registry: opts.registry || cfg.registry, market: opts.market || cfg.market, rpc: opts.rpc }), null, 2)); }
  catch (error) { console.error(error.message); process.exit(1); }
}
