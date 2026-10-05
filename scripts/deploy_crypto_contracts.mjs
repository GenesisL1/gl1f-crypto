// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Compile and deploy the GL1F Crypto contract set: burnable protocol fees, per-model licenses, two-step ownership.
//
//   GL1F_DEPLOYER_KEY=0x… npm run deploy:contracts -- \
//     --rpc https://rpc.genesisl1.org --creation-fee 10 --byte-fee-wei 0 --listing-fee 0 \
//     [--default-license CC-BY-SA-4.0] [--owner 0xYourMultisig] [--tos-file legal/terms.md] \
//     --out deployments/crypto-genesisl1.json
//
// Writes the license catalog of src/studio/licenses.json on-chain in file order (license id = position).
// With --owner, the deployer proposes that address (for example a multisig) as the new owner of the registry and
// the marketplace; it takes control by calling acceptOwnership() on each (scripts/owner_tx.mjs prints the data).
// Prints the `contracts` and `codeHashes` blocks for site/runtime-config.js.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import solc from "solc";
import * as ethers from "ethers";
import { JsonRpcProvider, Wallet, parseEther } from "ethers";
import { deployCryptoContracts as deployCore, seedLicenses as seedCore, runtimeConfigBlock } from "../src/deploy/deploy_core.js";
export { runtimeConfigBlock };

export const CRYPTO_SOURCES = [
  "contracts/SimpleOwnable.sol", "contracts/Base64.sol", "contracts/ModelNFT.sol", "contracts/ModelStore.sol",
  "contracts/ForestRuntime.sol", "contracts/CryptoModelRegistry.sol", "contracts/CryptoModelMarketplace.sol",
];

export const LICENSE_CATALOG = JSON.parse(readFileSync(new URL("../src/studio/licenses.json", import.meta.url), "utf8"));
// The Terms of Service in force are stored on-chain in full (tosText); the owner publishes new versions with setToS().
export const DEFAULT_TOS = readFileSync(new URL("../legal/terms.md", import.meta.url), "utf8");

export function compileCryptoContracts(root = process.cwd()) {
  const read = (p) => readFileSync(resolve(root, p), "utf8");
  const input = {
    language: "Solidity",
    sources: Object.fromEntries(CRYPTO_SOURCES.map((p) => [p, { content: read(p) }])),
    settings: {
      optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: "istanbul",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: (p) => ({ contents: read(p) }) }));
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  const pick = (file, name) => {
    const c = output.contracts?.[file]?.[name];
    if (!c?.evm?.bytecode?.object) throw new Error(`missing artifact ${file}:${name}`);
    return { abi: c.abi, bytecode: `0x${c.evm.bytecode.object}`, runtimeBytes: c.evm.deployedBytecode.object.length / 2 };
  };
  return {
    ModelStore: pick("contracts/ModelStore.sol", "ModelStore"),
    CryptoModelRegistry: pick("contracts/CryptoModelRegistry.sol", "CryptoModelRegistry"),
    ModelNFT: pick("contracts/ModelNFT.sol", "ModelNFT"),
    ForestRuntime: pick("contracts/ForestRuntime.sol", "ForestRuntime"),
    CryptoModelMarketplace: pick("contracts/CryptoModelMarketplace.sol", "CryptoModelMarketplace"),
  };
}

// The deployment itself is in src/deploy/deploy_core.js.
export async function seedLicenses(registry, opts = {}) { return seedCore(registry, { catalog: LICENSE_CATALOG, ...opts }); }
export async function deployCryptoContracts(opts) {
  return deployCore({ ethers, catalog: LICENSE_CATALOG, ...opts, artifacts: opts.artifacts || compileCryptoContracts(), tos: opts.tos ?? DEFAULT_TOS });
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, "")] = argv[i + 1];
  return out;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  const a = args(process.argv.slice(2));
  const key = process.env.GL1F_DEPLOYER_KEY;
  if (!key || !a.rpc) {
    console.error("Usage: GL1F_DEPLOYER_KEY=0x… node scripts/deploy_crypto_contracts.mjs --rpc URL [--creation-fee L1] [--byte-fee-wei WEI] [--listing-fee L1] [--default-license SPDX] [--owner 0x…] [--tos-file PATH] [--out FILE]");
    process.exit(2);
  }
  const provider = new JsonRpcProvider(a.rpc);
  const signer = new Wallet(key, provider);
  const tos = a["tos-file"] ? readFileSync(a["tos-file"], "utf8") : DEFAULT_TOS;
  const result = await deployCryptoContracts({
    signer, tos, log: (m) => console.error(m),
    creationFeeWei: a["creation-fee"] !== undefined ? parseEther(a["creation-fee"]) : undefined,
    sizeFeeWeiPerByte: a["byte-fee-wei"] !== undefined ? BigInt(a["byte-fee-wei"]) : undefined,
    listingFeeWei: a["listing-fee"] !== undefined ? parseEther(a["listing-fee"]) : undefined,
    defaultLicense: a["default-license"] || LICENSE_CATALOG.default, newOwner: a.owner || null,
  });
  delete result.instances;
  if (a.out) writeFileSync(a.out, JSON.stringify(result, null, 2) + "\n");
  const c = result.contracts, h = result.codeHashes;
  console.log(`contracts: { store: "${c.modelStore}", registry: "${c.modelRegistry}", nft: "${c.modelNft}", runtime: "${c.forestRuntime}", market: "${c.modelMarketplace}" }`);
  console.log(`codeHashes: { store: "${h.modelStore}", registry: "${h.modelRegistry}", nft: "${h.modelNft}", runtime: "${h.forestRuntime}", market: "${h.modelMarketplace}" }`);
  console.log(`licenses: ${result.licenses.count} in the catalog, default #${result.licenses.defaultId} ${result.licenses.defaultSpdx}`);
  if (result.admin.registryPendingOwner) {
    console.log(`owner handover started: ${result.admin.registryPendingOwner} must call acceptOwnership() on the registry and on the marketplace.`);
    console.log(`  transaction data: node scripts/owner_tx.mjs accept-ownership both --registry ${c.modelRegistry} --market ${c.modelMarketplace}`);
  }
}
