# GL1F Crypto

**Early alpha.** Expect bugs and changes; read the disclaimer before using anything here.

No-code crypto AI on [GenesisL1](https://genesisl1.com): build a dataset from **Binance**, **Coinbase** or **Hyperliquid** candles, train a gradient-boosted AI model in the browser with walk-forward validation (2 to 20 folds), optional heuristic search and a live training chart, backtest it with fees, mint it as an AI Model NFT, and run verifiable on-chain AI inference. GenesisL1 EVM is your quant. Protocol fees on the GL1F Crypto contracts are **burnable by anyone** with one public call.

> **Disclaimer.** Open-source, experimental data-science software for education and research, provided “as is” and “as available”, without warranty of any kind, express or implied. It may contain bugs, errors, defects and other imperfections; the smart contracts are not audited; market data comes from third parties. To the maximum extent permitted by law, no author, contributor or affiliated party is liable for any loss or damage. Not investment advice. Trading carries serious risk of loss; models and backtests can be wrong and must not be used in live or automated trading. On-chain actions are permanent and protocol fees are burned.

## What's inside

```
site/                      Deployable static site (open index.html directly, or host anywhere)
  index.html app.html market.html docs.html   Home, Studio (dataset → train → backtest → deploy → inference), Marketplace, Docs
  runtime-config.js        Network, contract addresses (crypto set pending), exchanges
  assets/                  Design system (gl1f.css), car mark, favicons, hero stills, share image
  js/                      Built classic bundles: home, studio (workers embedded), docs, 3D car
src/
  pages/                   Page bodies (HTML partials) and page entry points
  studio/                  Studio modules, market engine worker, training worker, shared GL1F modules
  three/car3d.mjs          The procedural 3D hero car (three.js)
contracts/                 Solidity: CryptoModelRegistry, CryptoModelMarketplace (burnable fees) + ModelStore,
  upstream/                ModelNFT, ForestRuntime; upstream Forest sources the crypto contracts derive from
scripts/                   build, page generator, contract generator/deployer, asset renderer
deploy/                    Server setup: the site on nginx, the MCP service, a one-command upgrade (see DEPLOY.md)
mcp/                       MCP server for AI agents (Deno): list, read and ask Crypto AI models, served at /mcp
tests/                     Market engine, numeric contract, burnable-fee contracts (local chain), static site check
deployments/genesisl1.json The original GL1F contract set, read-only here
```

## Quick start

```bash
npm ci            # esbuild, three, ethers, solc, ganache (pinned)
npm run build     # site/js/*.js and site/*.html
npm run serve     # http://localhost:8080  (or just open site/index.html)
npm test          # static site check, numeric contract, market engine, contracts
```

Everything in `site/` is plain static files with classic scripts, so the site also works when opened straight from disk. The market and training workers are embedded in `site/js/studio.js` and started from `blob:` URLs.

## Data

| Exchange | Endpoint | Signals | Notes |
| --- | --- | --- | --- |
| Binance USD-M | `fapi.binance.com` | 212 | funding (8-hourly), trade counts, taker flow |
| Hyperliquid perps | `api.hyperliquid.xyz/info` (POST) | 204 | hourly funding, trade counts, no taker flow; the API keeps only the latest 5,000 candles per size, so candles start at 15m and the studio sets the earliest start date |
| Coinbase spot | `api.exchange.coinbase.com` | 193 | OHLCV only |

Completed candles only, frozen to the venue's clock. Coinbase and Hyperliquid no-trade buckets are filled with the previous close and zero volume; holes longer than 6 hours stop the build. Candles are cached in IndexedDB. Features are cast to binary32 and quantized with GL1F's rule `clamp_int32(floor(Q·x + 1/2))`, exactly as the trainers and the on-chain runtime do.

## Training

* **Validation:** walk-forward with 2 to 20 folds (default 5), expanding or rolling windows, adjustable first-window share, and a locked final test (default 15%) scored exactly once. Chronological holdout and shuffled split are also available.
* **Heuristic search (optional):** up to 200 candidates. The first is your settings; each later one varies trees, depth, learning rate, minimum leaf and patience around the best so far (the GenesisL1 Forest studio's moves). The lowest mean validation log-loss across all folds wins, then the final fit runs and the test is opened. A results table lets you copy the winner back into the form.
* **Live training chart (optional):** train and validation log-loss tree by tree, plus the best candidate's curve during a search.

## Backtests

A signal exists only after its candle closes, so trades enter at the next candle's open, and only if that candle traded and its open is still between the stop and the target the signal defined; otherwise there is no trade. One position at a time, stop first when both levels are touched in one candle. Leverage from 1× to 100× (margin per trade, maintenance margin, isolated-margin liquidation, account ruin) is tested in `tests/backtest_rules.mjs`. Funding payments are not included; Coinbase spot runs without leverage. The entry threshold can have an upper P limit (a trade opens only when the probability is in the range), and leverage is any whole number from 1× to 100×.

## Model monetization and marketplace

The owner of a Crypto AI Model NFT is the model admin: the only address that can set access (free, tips or paid), the fee per inference, the fee recipient and subscription plans (duration and price, bought with `buyAccess`), pause inference, and list the model for sale. `site/market.html` lists models for sale, shows every model with its plans, and gives owners an admin panel. A sale moves the NFT and the admin rights to the buyer, and creator income follows: a fee recipient set by the previous owner stops applying. Protocol fees are burned.

## Contracts: burnable protocol fees

`contracts/CryptoModelRegistry.sol` and `contracts/CryptoModelMarketplace.sol` are generated from the GenesisL1/Forest `ModelRegistry.sol` and `ModelMarketplace.sol` in `contracts/upstream/` (`npm run generate:contracts`; CI checks they are current). Changes:

* model creation fees, per-byte fees and listing fees are never forwarded to anyone; they stay in the contract;
* `burnFees()` is public: anyone can send the whole balance to `0x000000000000000000000000000000000000dEaD`;
* collected, burned and pending amounts are public counters with `FeesCollected` / `FeesBurned` events;
* the owner can set fee levels and cannot withdraw;
* per-model licenses: the registry holds a catalog of standard licenses (SPDX identifiers); the creator picks one when minting (the license id passed to `registerModel`), `activeLicenseId` is the global default, and `licenseOf(tokenId)` returns a model's license; afterwards only its admin can move it, and only to a later version of the same license (`setLicenseSupersedes`) or to a more open license (`changeModelLicense`);
* creator income follows the NFT: a fee recipient set by a previous owner stops applying after a sale or transfer (`payoutAddressOf`);
* a model's admin can delete it with `burnAndDelete` only after every paid subscription has ended (`subscribedUntil`, the last block any subscription runs to); the owner's emergency `adminBurnAndDelete` is removed;
* `setModelNFT` works once, `updateModelSettings` emits `ModelSettingsUpdated`, access modes above 2 are rejected, and listing-fee changes emit `ListingFeeSet`.

`SimpleOwnable` hands ownership over in two steps (`transferOwnership`, then `acceptOwnership` by the new owner). `ModelStore`, `ModelNFT` and `ForestRuntime` are unchanged. `npm run test:contracts` deploys the set on a local chain and checks that fees stay in the contracts, the owner receives nothing, a third party can burn, counters and events are exact, on-chain predictions match the reference evaluator, the license catalog and per-model licenses behave as described, a multisig contract can take over ownership, income follows the NFT, and the app's ABIs match the compiled contracts.

### Licenses

`src/studio/licenses.json` is the catalog: 37 standard licenses in four groups (public domain, permissive, share-alike, restricted) plus the GL1F On-Chain Use License (reserved: all rights reserved, use only through GenesisL1; the studio's default for paid models), 38 in all, identifiers checked against the SPDX License List 3.29.0, plus OpenMDW 1.1 as `LicenseRef-OpenMDW-1.1`. The deploy script writes it on-chain in file order, so license id = position; entry 1, CC BY-SA 4.0, is the default (`--default-license` picks another). Summaries are informal, not legal advice.

### Admin and multisig

The owners of the registry and the marketplace set protocol fees, the terms creators accept and the license catalog (add, close to new models, choose the default); they can cancel listings. They cannot delete models; a model's admin can, once every paid subscription has ended. They cannot withdraw fees, change a model's license or settings, or move NFTs. Ownership moves in two steps, so it can safely go to a multisig: deploy with `--owner 0xMultisig`, or call `transferOwnership` later, then have the multisig call `acceptOwnership()` on both contracts. `npm run owner:tx -- <action> …` prints the transaction data (`accept-ownership`, `transfer-ownership`, `set-creation-fee`, `set-byte-fee-wei`, `set-listing-fee`, `set-default-license`, `set-license-enabled`, `add-license`, `set-tos`) for a multisig's custom transaction form. A model admin moves to a multisig by transferring the NFT.

### Hosting

GL1F Crypto is a static site: HTML and JavaScript that read GenesisL1 from the visitor's browser. Upload the `site/` folder to any static host (nginx, Apache, GitHub Pages, Netlify, Cloudflare Pages, S3) and it works; nothing runs on the server. Each model's page is `model.html?id=<n>`, drawn from the chain, so it works on every host. On nginx, `deploy/setup-crypto-nginx.sh` (see `deploy/SERVER.md`) sets up HTTPS, caching and an optional redirect from a staging domain.

### Deploy and run the protocol

`GL1F_DEPLOYER_KEY=0x… npm run deploy:contracts -- --rpc https://rpc.genesisl1.org --creation-fee 10 --byte-fee-wei 0 --listing-fee 0 [--owner 0xMultisig] --out deployments/crypto-genesisl1.json` prints the same lines for `runtime-config.js`; `node scripts/owner_tx.mjs` prepares owner transactions for a multisig. The deployment steps are in `src/deploy/deploy_core.js`.

### Cookies and Google Analytics

Set your Google Analytics 4 measurement ID once: `analytics.googleMeasurementId` in `site/runtime-config.js` (for example `"G-ABC123XYZ"`), or the repository variable `GA_MEASUREMENT_ID`, which the Pages workflow writes with `scripts/set_analytics_id.mjs`. Every page loads `assets/consent.js`: with an ID it shows a small cookie notice and loads Google Analytics only after Accept (consent mode; advertising features and Google signals off; Global Privacy Control honoured; Cookie settings on every page to change the choice). With no ID there is no notice and nothing from Google. The cookie policy is `legal/cookies.md`. Fonts are self-hosted in `site/assets/fonts/`. Have the cookie policy and Terms reviewed by counsel.

### Web3 API

`site/sdk/gl1f-crypto.js` (source `src/sdk/gl1f-crypto.js`) calls any model from code with ethers v6: `model(tokenId)`, `latestInputs(model, { engine })` with `GL1FCrypto.nodeEngine()` or `browserEngine()` (the published engine `site/sdk/gl1f-engine.js`), `predict(model, valuesQ, { accessKey | owner | payer, threshold, thresholdMax })` (the answer is yes when threshold <= P <= thresholdMax, defaults 0.5 and 1), `ask(model, { engine, threshold })` (the latest answer in one call), `decide(probability, range)`, `newAccessKey()`, `buyAccess(model, planId, key, signer)` and `accessStatus(model, key)`. Paid models are read with an access key that holds a plan (EIP-712 `AccessView`, verified by `predictAccessView`), the admin's signature (`OwnerView`) or a fee per run (`predictTx`). Tested on a local chain by `tests/sdk_check.mjs`. See the docs page and the Inference step's Web3 API panel.

### MCP server for AI agents

`mcp/` is a Model Context Protocol server, so AI assistants and agents (Claude, ChatGPT, Claude Code, Codex...) can use
the models without code: `list_models`, `get_model`, `ask_model` (with an optional `threshold` and `threshold_max`)
and `trading_rules`. It runs on Deno with ethers as its only dependency, reads the deployed site's own files, and is
read-only (no keys). Live at `https://crypto.gl1f.com/mcp`; see `mcp/README.md`, and `deploy/setup-mcp.sh` to run it.

### Audit

`AUDIT.md` lists the review of the contracts, studio and API, the bugs found and fixed, the tests that guard them and what still needs an external audit.

### Verifiable training reports and private internals

At mint the deploy step can publish a training report in the model's on-chain metadata (`src/studio/report.js`): final test window and rows, ROC AUC, log-loss, Brier score, accuracy and a SHA-256 fingerprint of every test row (open time, label, integer score). It is computed by the studio, shown read-only, and published only if rebuilding the rows from public candles with the backtest replay (`backtest` job with `label`) matches the training session exactly. The Inference step verifies it for anyone with inference access and scores every candle since minting (`mintedAt`, recorded by the registry). `setInternalsVisibility(tokenId, 0|1|2)` lets a model's admin choose whether front-ends show its trees, depth and signals (0 = private when paid, 1 = public, 2 = private), at mint or any time after.

### World signals

Besides 212 market signals, models can use 62 world signals (full list: `SIGNALS.txt`, also `site/signals.txt`). Holidays, events and astronomy are computed from each candle's close time (`src/studio/world_signals.js`). Macro, disaster and war signals are fetched live in the browser when a dataset is built (`src/studio/world_sources.js`), from public sources that allow web pages to read them and need no key: DBnomics (Federal Reserve H.15, BLS), DataHub on GitHub (EIA, BLS CPI, Federal Reserve H.10, Cboe VIX, Shiller S&P 500, gold), USGS, NASA EONET (tropical storms) and Wikipedia pageviews. Every source has years of history (from 1833 for gold to July 2015 for Wikipedia); sources with only months of history are not used, and a test enforces at least 3 years. Users install nothing. The Pages workflow also publishes the same data at `site/data/world.json` (`scripts/fetch_world_data.mjs`, at most every 6 hours); the studio reads that copy only when a live source cannot be reached. S&P 500 and VIX are left out of that copy unless `GL1F_INCLUDE_LICENSED=1`. The built-in lists of Fed decision dates, elections and war escalations need a yearly update.

### Link previews, search engines and language models

Every page has a 1200x630 dark preview image (`site/assets/og-*.jpg`, `npm run assets -- --og-only` re-renders them from `scripts/og_scene.py`), and every published model gets its own card. The Pages workflow sets `GL1F_ORIGIN` to the real deployment address, so preview, canonical and sitemap links always resolve. For language models: `llms.txt` (llmstxt.org layout), `llms-full.txt` (everything in one file), a Markdown copy of each page linked with `rel="alternate"`, and `licenses.json`. After a deployment, Telegram may keep an old preview cached: send the link to @WebpageBot to refresh it; X refreshes within days, and Facebook and LinkedIn have their own preview inspectors.

### Terms of Service and the GL1F On-Chain Use License

`legal/terms.md` is the Terms of Service for the whole dapp: the app, the website and the contracts, including the duty to respect every model's license. The deploy script stores its full text on-chain (`tosText`, version `tosVersion`); the owner publishes a new version with `setToS` (`npm run owner:tx -- set-tos legal/terms.md`), the app asks every user to accept the version in force, and minting requires it. `legal/onchain-use-1.0.md` is the GL1F On-Chain Use License: every model's bytes are public on GenesisL1, so it reserves all rights and allows use only through GenesisL1 on the admin's terms, with off-chain runs only for the admin, active subscribers, or anyone while the model is free. The studio follows it: it will not run such a paid model in the browser for anyone else. Both texts are published as pages under `site/legal/` with plain-text copies. They are drafts for legal review before launch.

**Status: not deployed.** `site/runtime-config.js` keeps `contracts: null` and `status: "preview"`; deployment is locked in the studio and the original GL1F contracts are read for published models. To deploy:

```bash
GL1F_DEPLOYER_KEY=0x… npm run deploy:contracts -- --rpc https://rpc.genesisl1.org \
  --creation-fee 10 --byte-fee-wei 0 --listing-fee 0 [--default-license CC-BY-SA-4.0] [--owner 0xMultisig] \
  --out deployments/crypto-genesisl1.json
```

Paste the printed `contracts` and `codeHashes` blocks into `site/runtime-config.js`, set `status` to `"live"`, and commit.

## Sharing and per-model pages

Every page has a share button (the native share sheet on phones; X, Telegram, WhatsApp, LinkedIn, Facebook, Reddit, email and copy link elsewhere) and share links in the footer. Every published Crypto AI model has its own page, `model.html?id=<tokenId>`, drawn live from GenesisL1: its title, the question it answers, its market, access and price (BUY when listed), a run on the latest candle, the owner's tools and a copy-link button. The page sets its own title, description, canonical link and structured data, and works on any static host.

## SEO and crawlers

Every page carries titles and descriptions for the crypto AI narrative, Open Graph and Twitter cards, and JSON-LD (Organization, WebSite with site search, SoftwareApplication, HowTo, FAQPage, BreadcrumbList, TechArticle). `site/robots.txt` welcomes search engines and AI crawlers, `site/sitemap.xml` lists the pages, and `site/llms.txt` summarises the project for AI assistants. All are generated by `scripts/build_pages.py`.

## Hosting

`.github/workflows/pages.yml` publishes `site/` to GitHub Pages on every push to `main` (add a `site/CNAME` file for a custom domain such as `crypto.gl1f.com`). On hosts that support headers, this policy works:

```
default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com; img-src 'self' data: blob:; worker-src 'self' blob:;
connect-src 'self' https://fapi.binance.com https://api.exchange.coinbase.com https://api.hyperliquid.xyz https://rpc.genesisl1.org
```

## Provenance

Derived from [GenesisL1/Forest](https://github.com/GenesisL1/Forest) (commit `03b9338`). The shared GL1F modules in `src/studio/` (`local_infer.js`, `training_*.js`, `validation_*.js`, `csv_parse.js`, `model_file.js`, `abis.js`) and the unchanged contracts follow the GL1F manuscript: integer tree traversal, the saturating quantizer, and walk-forward validation with a fixed final test partition, outcome look-ahead, purge and embargo margins.

## License

MIT (see `LICENSE`). Bundled three.js r160 is MIT (`site/assets/three.LICENSE.txt`); ethers is loaded from jsDelivr (MIT); fonts are served by Google Fonts (SIL OFL).
