// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Deploys the GL1F Crypto contracts with any ethers v6 signer (a private key in Node, or a browser wallet). Used by
// scripts/deploy_crypto_contracts.mjs: the same steps give the same result with any signer.

// Writes every catalog license the registry does not have yet, in catalog order, a few per transaction.
export async function seedLicenses(registry, { catalog, batch = 12, send }) {
  const count = Number(await registry.licenseCount());
  const have = new Set();
  for (let id = 1; id <= count; id++) have.add(await registry.licenseSpdx(id));
  const todo = catalog.licenses.filter((l) => !have.has(l.spdx));
  for (let i = 0; i < todo.length; i += batch) {
    const part = todo.slice(i, i + batch);
    await send(`registry.addLicensesWithSpdx ${part[0].spdx} … ${part[part.length - 1].spdx}`,
      registry.addLicensesWithSpdx(part.map((l) => l.name), part.map((l) => l.url), part.map((l) => l.spdx), part.map((l) => l.openness)));
  }
  return Number(await registry.licenseCount());
}

export async function deployCryptoContracts({ ethers, signer, artifacts, tos, catalog, creationFeeWei, sizeFeeWeiPerByte, listingFeeWei,
  defaultLicense = catalog?.default, newOwner = null, seed = true, log = () => {}, onStep = () => {} }) {
  if (!ethers || !artifacts || !catalog || typeof tos !== "string") throw new Error("deployCryptoContracts needs ethers, artifacts, catalog and the Terms text");
  const owner = await signer.getAddress();
  const txs = [];
  const deploy = async (name, args = []) => {
    onStep(`deploy ${name}`, "run");
    const factory = new ethers.ContractFactory(artifacts[name].abi, artifacts[name].bytecode, signer);
    const contract = await factory.deploy(...args);
    const receipt = await contract.deploymentTransaction().wait();
    txs.push({ step: `deploy ${name}`, hash: receipt.hash, gasUsed: receipt.gasUsed.toString() });
    log(`${name} ${await contract.getAddress()}`);
    onStep(`deploy ${name}`, "ok", receipt.hash);
    return contract;
  };
  const send = async (step, promise) => {
    onStep(step, "run");
    const receipt = await (await promise).wait();
    txs.push({ step, hash: receipt.hash, gasUsed: receipt.gasUsed.toString() });
    onStep(step, "ok", receipt.hash);
  };
  const store = await deploy("ModelStore");
  const registry = await deploy("CryptoModelRegistry", [owner, tos]);
  const nft = await deploy("ModelNFT", [await registry.getAddress(), "GenesisL1 Forest Crypto Model", "GL1FC"]);
  await send("registry.setModelNFT", registry.setModelNFT(await nft.getAddress()));
  const runtime = await deploy("ForestRuntime", [await registry.getAddress()]);
  const market = await deploy("CryptoModelMarketplace", [await nft.getAddress(), owner]);
  if (creationFeeWei !== undefined) await send("registry.setDeployFeeWei", registry.setDeployFeeWei(creationFeeWei));
  if (sizeFeeWeiPerByte !== undefined) await send("registry.setSizeFeeWeiPerByte", registry.setSizeFeeWeiPerByte(sizeFeeWeiPerByte));
  if (listingFeeWei !== undefined) await send("market.setListingFeeWei", market.setListingFeeWei(listingFeeWei));
  if (seed) await seedLicenses(registry, { catalog, send });
  if (defaultLicense) {
    const id = Number(await registry.licenseIdBySpdx(defaultLicense));
    if (!id) throw new Error(`Default license ${defaultLicense} is not in the on-chain catalog`);
    if (id !== Number(await registry.activeLicenseId())) await send("registry.setActiveLicenseId", registry.setActiveLicenseId(id));
  }
  if (newOwner && ethers.getAddress(newOwner) !== ethers.getAddress(owner)) {
    // Step 1 of the handover. The new owner (for example a multisig) takes control with acceptOwnership().
    await send("registry.transferOwnership", registry.transferOwnership(ethers.getAddress(newOwner)));
    await send("market.transferOwnership", market.transferOwnership(ethers.getAddress(newOwner)));
  }
  const provider = signer.provider;
  const contracts = {
    modelStore: await store.getAddress(), modelRegistry: await registry.getAddress(), modelNft: await nft.getAddress(),
    forestRuntime: await runtime.getAddress(), modelMarketplace: await market.getAddress(),
  };
  const codeHashes = {};
  for (const [key, address] of Object.entries(contracts)) codeHashes[key] = ethers.keccak256(await provider.getCode(address));
  const network = await provider.getNetwork();
  const defaultId = Number(await registry.activeLicenseId());
  const pending = async (c) => { const a = await c.pendingOwner(); return a === ethers.ZeroAddress ? null : a; };
  return {
    schema: "gl1f-crypto-deployment/v2", chainId: Number(network.chainId), deployer: owner,
    blockNumber: await provider.getBlockNumber(), contracts, codeHashes,
    fees: {
      creationFeeWei: (await registry.deployFeeWei()).toString(), sizeFeeWeiPerByte: (await registry.sizeFeeWeiPerByte()).toString(),
      listingFeeWei: (await market.listingFeeWei()).toString(), burnAddress: await registry.BURN_ADDRESS(),
    },
    licenses: { count: Number(await registry.licenseCount()), defaultId, defaultSpdx: await registry.licenseSpdx(defaultId) },
    admin: { registryOwner: await registry.owner(), registryPendingOwner: await pending(registry), marketOwner: await market.owner(), marketPendingOwner: await pending(market) },
    transactions: txs, instances: { store, registry, nft, runtime, market },
  };
}

// The lines to paste into site/runtime-config.js after a deployment.
export function runtimeConfigBlock(result) {
  const c = result.contracts, h = result.codeHashes, f = (o) => `{ store: "${o.modelStore}", registry: "${o.modelRegistry}", nft: "${o.modelNft}", runtime: "${o.forestRuntime}", market: "${o.modelMarketplace}" }`;
  return `    status: "live",\n    contracts: Object.freeze(${f(c)}),\n    codeHashes: Object.freeze(${f(h)}),`;
}
