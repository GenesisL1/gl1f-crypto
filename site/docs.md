# GL1F Crypto docs

> GL1F Crypto is a no-code crypto AI model builder on GenesisL1, an EVM Layer 1 blockchain (chain id 29). In the browser you build a dataset from Binance, Coinbase or Hyperliquid candles, train a gradient-boosted tree model with walk-forward validation, backtest it with fees, slippage and leverage, publish it as a Crypto AI model NFT and run inference that anyone can verify on-chain. Early alpha, educational, not financial advice.

[Overview](https://crypto.gl1f.com/docs.html#overview)[Contracts](https://crypto.gl1f.com/docs.html#contracts)[Fees & burns](https://crypto.gl1f.com/docs.html#fees)[Model monetization](https://crypto.gl1f.com/docs.html#monetization)[Licenses](https://crypto.gl1f.com/docs.html#licenses)[Admin & multisig](https://crypto.gl1f.com/docs.html#admin)[Live stats](https://crypto.gl1f.com/docs.html#stats) [Data & signals](https://crypto.gl1f.com/docs.html#data)[Validation](https://crypto.gl1f.com/docs.html#validation)[Backtests](https://crypto.gl1f.com/docs.html#backtests)[Verify it yourself](https://crypto.gl1f.com/docs.html#verify)[Web3 API](https://crypto.gl1f.com/docs.html#web3-api)[Track record](https://crypto.gl1f.com/docs.html#track-record)[Disclaimer](https://crypto.gl1f.com/docs.html#disclaimer)[Terms of Service](https://crypto.gl1f.com/legal/terms.html)

**Docs** / Overview Contracts pending

# How GL1F Crypto works.

GL1F Crypto is a static web app. It downloads completed candles from Binance USD-M or Hyperliquid perpetuals, or Coinbase spot, straight into your browser, computes up to 212 causal market signals and 62 world signals, labels every candle with a target-before-stop question, trains integer gradient-boosted trees, and backtests them with fees. A Crypto AI model can be minted on GenesisL1 as a Crypto AI Model NFT; for a registered Crypto AI model, the local and on-chain evaluators return exactly the same integer score.

Nothing runs on a server we control. There is no account, no API key, and no data leaves your device except the public transactions you sign.

**01** / Contracts

## Dedicated crypto contracts, burnable fees.

The crypto runtime gets its own contract set on GenesisL1 (chain id 29): a store for Crypto AI model bytes, a registry, a Crypto AI Model NFT, the on-chain runtime and a marketplace. The registry and marketplace are the GL1F contracts with a few changes: protocol fees are never paid out to anyone and accumulate until someone burns them; creators choose a license for each model; creator income follows the NFT when it changes hands; and contract ownership moves in two steps, so it can safely go to a multisig.

**02** / Fees & burns

## Every protocol fee goes up in smoke.

Deploying a Crypto AI model costs a flat **Crypto AI model creation fee** plus a **per-byte fee** for the bytes stored on-chain. Listing a Crypto AI Model NFT in the marketplace costs a **listing fee**. All three stay inside the contract that collected them. Anyone, at any time, can call `burnFees()` to send the whole balance to `0x000000000000000000000000000000000000dEaD`, an address no key controls. The owner can adjust fee levels; nobody can withdraw.

Crypto AI model creation fee**—**set at deployment

Per-byte fee**—**set at deployment

Listing fee**—**set at deployment

deploy fee = creation fee + per-byte fee × Crypto AI model bytes · paid in L1 · held by the registry until burned

### Burn what's waiting

Burning is a public good: the caller pays only gas, and the event records who pressed the button.

Registry · waiting to burn**—**creation + per-byte fees

Marketplace · waiting to burn**—**listing fees

Creator income is different: paid-inference fees, tips and access passes go to each Crypto AI model's admin (its current owner) or the recipient that admin chose, and are never burned.

## Model monetization and the marketplace.

**The owner is the model admin.** Every Crypto AI model is an NFT. Whoever owns it is the model admin, the only address that can change its access mode, fee per inference, fee recipient and subscription plans, pause or resume inference, and list it for sale. When the NFT is sold or transferred, the new owner becomes the admin.

### Business models

- **Free:** anyone can run the model and verify its scores on-chain.
- **Tips:** inference stays open and users may pay the fee recipient voluntarily.
- **Pay per inference:** each on-chain inference pays the fee the admin sets.
- **Subscription plans:** for paid models the admin can publish plans (duration in blocks, price in L1, active or not). A subscriber pays once with `buyAccess` and their access key can run the model until the plan expires; buying again extends it. Durations are entered in days and converted at GenesisL1's measured block time.

### Marketplace

An admin can list the Crypto AI Model NFT at a price (the marketplace takes a small listing fee, which is burnable like every protocol fee), cancel the listing, and anyone can buy it at the listed price. The sale price goes to the seller and the buyer receives the NFT and the admin rights.

### Who gets paid

Inference fees, tips and subscription payments go to the fee recipient chosen by the current admin. When the NFT is sold or transferred, a recipient chosen by the previous owner stops applying and payments go to the new owner until it chooses its own. Sale prices go to the seller. Protocol fees (model creation, per-byte storage, listing) stay in the contracts until anyone burns them to 0x…dEaD. Nobody, including the contract owner, can withdraw them. The contract owner's powers are listed under [Admin & multisig](https://crypto.gl1f.com/docs.html#admin).

## One license per model, chosen at mint.

Every Crypto AI model NFT carries a license for the model it holds. The creator picks it when minting, from a catalog of standard licenses stored in the registry; the global default, **CC BY-SA 4.0**, is preselected in the studio. The choice is written on-chain. Changing the default, closing an entry to new models or selling the NFT never changes it. Only the model admin can move it, and only to a later version of the same license or to a more open license, so rights already granted always stand. Anyone can read it with `licenseOf(tokenId)`, and model pages and the marketplace show it.

Every model's bytes are public on GenesisL1, so no license can stop copying technically; the license decides what is lawful. For paid models the studio preselects the [GL1F On-Chain Use License](https://crypto.gl1f.com/legal/onchain-use-1.0.html): all rights reserved, use only through GenesisL1 on the admin's terms, and runs off-chain only for the admin, its subscribers, or anyone while the model is free to run. The [Terms of Service](https://crypto.gl1f.com/legal/terms.html) bind every user of the app and the contracts to respect each model's license, and the studio follows the same rules.

The protocol admin can add licenses and new versions of a license to the catalog, close an entry to new models and change the default. It cannot change the license of a model that exists.

Summaries are informal and are not legal advice; the linked license text is what counts. Identifiers follow the SPDX License List 3.29.0. OpenMDW 1.1 is newer than that list and uses LicenseRef-OpenMDW-1.1.

### Public domain

No conditions at all.

| # | License | SPDX | In short |
|---|---|---|---|
| 2 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)default | `CC0-1.0` | Public domain dedication: anyone may use, change and sell it, with no credit required. |
| 3 | [The Unlicense](https://unlicense.org/)default | `Unlicense` | Public domain dedication written for software: no conditions. |
| 4 | [ODC PDDL 1.0](https://spdx.org/licenses/PDDL-1.0.html)default | `PDDL-1.0` | Open Data Commons public domain dedication for data and databases: no conditions. |
| 5 | [BSD Zero Clause](https://opensource.org/license/0BSD)default | `0BSD` | Use for any purpose with no conditions, not even keeping the notice. |
| 6 | [MIT No Attribution](https://github.com/aws/mit-0)default | `MIT-0` | The MIT license without the attribution condition: no conditions. |

### Permissive

Use for anything, including commercially; keep the credit or notice the license asks for.

| # | License | SPDX | In short |
|---|---|---|---|
| 7 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)default | `CC-BY-4.0` | Use, share and adapt for any purpose, including commercially; credit the creator and link the license. |
| 8 | [MIT](https://opensource.org/license/MIT)default | `MIT` | Use for anything, including commercially; keep the copyright and license notice. |
| 9 | [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)default | `Apache-2.0` | Like MIT, plus an explicit patent grant; keep the notices and mark the files you change. |
| 10 | [BSD 2-Clause](https://opensource.org/license/BSD-2-Clause)default | `BSD-2-Clause` | Use for anything; keep the copyright notice and the disclaimer. |
| 11 | [BSD 3-Clause](https://opensource.org/license/BSD-3-Clause)default | `BSD-3-Clause` | BSD 2-Clause, plus: the authors' names may not be used to promote derived work. |
| 12 | [ISC](https://www.isc.org/licenses/)default | `ISC` | Functionally the same as MIT, in simpler words. |
| 13 | [zlib](https://opensource.org/license/Zlib)default | `Zlib` | Use for anything; do not misrepresent the origin, and mark altered versions as altered. |
| 14 | [Boost 1.0](https://opensource.org/license/BSL-1.0)default | `BSL-1.0` | Use for anything; keep the license text with copies of the source. |
| 15 | [UPL 1.0](https://opensource.org/license/UPL-1.0)default | `UPL-1.0` | Permissive, with an explicit patent grant; keep the license notice. |
| 16 | [Blue Oak 1.0.0](https://blueoakcouncil.org/license/1.0.0)default | `BlueOak-1.0.0` | Modern permissive license with a patent grant; pass on the license text or a link to it. |
| 17 | [Academic Free 3.0](https://opensource.org/license/AFL-3.0)default | `AFL-3.0` | Permissive, with a patent grant; keep the attribution notices. |
| 18 | [OpenMDW 1.1](https://openmdw.ai/license/1-1/)default | `LicenseRef-OpenMDW-1.1` | Linux Foundation license made for machine-learning models: use for anything under copyright, patent, database and trade-secret rights; keep the license and notices. |
| 19 | [OpenMDW 1.0](https://spdx.org/licenses/OpenMDW-1.0.html)default | `OpenMDW-1.0` | The first OpenMDW version for machine-learning models, listed by SPDX; same permissions as 1.1. |
| 20 | [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0)default | `CDLA-Permissive-2.0` | Linux Foundation data license: use and share freely; pass on the license text. Results you compute are unrestricted. |
| 21 | [ODC Attribution 1.0](https://spdx.org/licenses/ODC-By-1.0.html)default | `ODC-By-1.0` | Open Data Commons attribution license for databases: use for anything; credit the source. |

### Share-alike (copyleft)

Use for anything; versions you share must stay under the same license.

| # | License | SPDX | In short |
|---|---|---|---|
| 1 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)default | `CC-BY-SA-4.0` | Use for anything, including commercially; credit the creator, and share changed versions under the same license. |
| 22 | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)default | `ODbL-1.0` | Database share-alike: credit the source; adapted databases you share publicly stay under ODbL. |
| 23 | [CDLA Sharing 1.0](https://spdx.org/licenses/CDLA-Sharing-1.0.html)default | `CDLA-Sharing-1.0` | Linux Foundation data share-alike: data you share, including your additions, stays under the same terms. |
| 24 | [MPL 2.0](https://www.mozilla.org/MPL/2.0/)default | `MPL-2.0` | File-level copyleft: changed MPL files stay MPL and their source is shared; may be combined with other work. |
| 25 | [EPL 2.0](https://www.eclipse.org/legal/epl-2.0)default | `EPL-2.0` | Weak copyleft from the Eclipse Foundation: changes to EPL-licensed parts are shared under the EPL. |
| 26 | [EUPL 1.2](https://spdx.org/licenses/EUPL-1.2.html)default | `EUPL-1.2` | European Union copyleft license, valid in all EU languages, with a list of compatible licenses. |
| 27 | [OSL 3.0](https://opensource.org/license/OSL-3.0)default | `OSL-3.0` | Copyleft that also applies when the work is offered to others over a network. |
| 28 | [LGPL 3.0 only](https://www.gnu.org/licenses/lgpl-3.0.html)default | `LGPL-3.0-only` | Weak copyleft, version 3 only: changes to the licensed work stay LGPL; other works may use it. |
| 29 | [LGPL 3.0 or later](https://www.gnu.org/licenses/lgpl-3.0.html)default | `LGPL-3.0-or-later` | Weak copyleft, version 3 or any later version: changes to the licensed work stay LGPL; other works may use it. |
| 30 | [GPL 3.0 only](https://www.gnu.org/licenses/gpl-3.0.html)default | `GPL-3.0-only` | Strong copyleft, version 3 only: anything distributed that is based on it must be GPL, with source. |
| 31 | [GPL 3.0 or later](https://www.gnu.org/licenses/gpl-3.0.html)default | `GPL-3.0-or-later` | Strong copyleft, version 3 or any later version: anything distributed that is based on it must be GPL, with source. |
| 32 | [AGPL 3.0 only](https://www.gnu.org/licenses/agpl-3.0.html)default | `AGPL-3.0-only` | GPL 3.0 only, plus: offering a changed version as a network service also requires sharing its source. |
| 33 | [AGPL 3.0 or later](https://www.gnu.org/licenses/agpl-3.0.html)default | `AGPL-3.0-or-later` | GPL 3.0 or later, plus: offering a changed version as a network service also requires sharing its source. |

### Restricted (not open source)

Standard Creative Commons licenses that forbid commercial use, changed versions, or both.

| # | License | SPDX | In short |
|---|---|---|---|
| 34 | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)default | `CC-BY-NC-4.0` | Non-commercial use only; credit the creator. Changed versions allowed. |
| 35 | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)default | `CC-BY-NC-SA-4.0` | Non-commercial use only; credit the creator; share changed versions under the same license. |
| 36 | [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/)default | `CC-BY-ND-4.0` | Share unchanged copies only, commercial use allowed; credit the creator. No changed versions may be shared. |
| 37 | [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/)default | `CC-BY-NC-ND-4.0` | Share unchanged copies for non-commercial purposes only; credit the creator. |

### Reserved (no copying)

All rights reserved. The model may be used only through GenesisL1 on its admin's terms; copying it is not allowed, even though its bytes are public.

| # | License | SPDX | In short |
|---|---|---|---|
| 38 | [GL1F On-Chain Use 1.0](https://crypto.gl1f.com/legal/onchain-use-1.0.html)default | `LicenseRef-GL1F-OnChain-Use-1.0` | All rights reserved: use it only through GenesisL1 on the terms its admin sets (free, per run or by subscription). No copying, sharing or derived models. Its admin and active subscribers may also run it themselves, and anyone may while it is free to run. |

## Who can change what: admins and multisigs.

Each change is a transaction from the owner's wallet or multisig; `npm run owner:tx` in the repository prepares them.

### Model admin

The owner of a Crypto AI model NFT runs that model: access, fees, fee recipient, subscription plans, pausing and sales. To put a model under a multisig, transfer the NFT to the multisig; its income follows. Owner-signed free inference needs a single-key signature, so a multisig that owns a paid model can give an ordinary wallet an access key with `setOwnerAccessKey`.

### Protocol owners

The registry and the marketplace each have an owner. Together they can:

- set the model creation fee and the per-byte fee (registry) and the listing fee (marketplace);
- publish new versions of the [Terms of Service](https://crypto.gl1f.com/legal/terms.html), stored in full on-chain, add licenses and new versions of a license, close a license to new models and choose the default license;
- cancel any marketplace listing;

A model's admin can delete it once no paid subscription is still running, so nobody is owed access. Deleting burns the NFT and removes the model from the registry, the marketplace and search; the bytes already written to GenesisL1 storage stay on-chain, since deployed code cannot be erased. Until then the admin can pause inference. The protocol admins cannot delete models, cannot withdraw protocol fees, change a model's license, bytes or settings, move anyone's NFT, or point the registry at a different NFT contract (that wiring happens once, at deployment). Every change is a public transaction.

### Handing the protocol admin to a multisig

1. Set up the multisig on GenesisL1 (chain id 29) and check that it can send a transaction there.
2. The current owner calls `transferOwnership(multisig)` on the registry and on the marketplace. Nothing changes yet.
3. The multisig calls `acceptOwnership()` on each contract and takes control. Until then the old owner stays in charge and can cancel with `transferOwnership(0x0)`, so a mistyped address, or a multisig that only exists on another chain, can never lock the contracts.

Terms of Service in force: version 1, as bundled with this site. Each new version is recorded in the registry with `setToS`; the app asks every user to accept it, and publishing a model requires it.

`scripts/owner_tx.mjs` in the repository prints the transaction data for each step and for fee, license and terms changes, ready for a multisig's custom transaction form.

**03** / Live stats

## Read straight from the chain.

These numbers are view calls against GenesisL1, made by your browser when the page loads.

Access mix

Fees

Latest Crypto AI models

**04** / Data & signals

## Completed candles, causal signals.

- **Binance USD-M** (`fapi.binance.com`): OHLCV, quote volume, trade count, taker buy volume, funding history. All 212 signals.
- **Coinbase spot** (`api.exchange.coinbase.com`): OHLCV. Signals needing trade counts, taker flow or funding are unavailable, leaving 193. Native candles are 1m, 5m, 15m, 1h, 6h and 1d; other sizes are aggregated from the next smaller native size and labelled as derived.
- **Hyperliquid perps** (`api.hyperliquid.xyz/info`): OHLCV, trade counts and hourly funding; no taker flow, leaving 204 signals. The API serves only the latest 5,000 candles per coin and size, so candles start at 15m and the studio sets the earliest start date for you (15m ≈ 52 days of history including the 22-day warm-up, 1h ≈ 208 days). Candles you have already downloaded stay in the browser cache. Memecoins use a k prefix (kPEPE); 6h candles are built from 2h.
- Only completed candles are used, frozen to the exchange's server time. Coinbase and Hyperliquid publish nothing for buckets without trades; those gaps are filled with the previous close and zero volume, but a hole longer than 6 hours is treated as an outage and stops the build. Funding signals use each venue's own published rates (Binance every 8 hours, Hyperliquid hourly), so a Crypto AI model belongs to the venue it was trained on.
- Every signal at candle *t* uses candles up to and including *t*. Values are cast to binary32 and quantized with GL1F's rule, clampint32(⌊Q·x + ½⌋), exactly as the trainers and the on-chain runtime do. Warm-up history is fetched before your start date so long indicators are complete from the first row.
- Candles are cached in your browser (IndexedDB). Clearing site data removes them.

## Web3 API: run any model from code.

The [Web3 API page](https://crypto.gl1f.com/api.html) has the full reference, the addresses and a bot example. Every Crypto AI model can be called from your own code, in a browser or in Node 18+, with the GL1F Crypto helper [sdk/gl1f-crypto.js](https://crypto.gl1f.com/sdk/gl1f-crypto.js) and `ethers` v6. The Inference step's **Web3 API** panel shows ready code for the open model, its contract addresses and RPC.

import * as ethers from "ethers"; import { GL1FCrypto } from "./gl1f-crypto.js"; const gl1f = new GL1FCrypto({ ethers, rpcUrl, chainId: 29, registry, runtime }); const model = await gl1f.model(42); // title, question, pricing, plans, inputs const engine = await GL1FCrypto.nodeEngine(); // browser: await GL1FCrypto.browserEngine() const inputs = await gl1f.latestInputs(model, { engine }); // latest completed candle, the studio's own engine const out = await gl1f.predict(model, inputs.valuesQ); // { probability, scoreQ, via }

| Model | Call | What it costs |
|---|---|---|
| Free or tips | `predict(model, valuesQ)`: a read of `predictView` | Nothing: no key, no gas |
| Paid, with a plan | `predict(model, valuesQ, { accessKey })`: the access key signs the request (EIP-712 `AccessView`) and `predictAccessView` checks it | The plan, bought once for the key's address with `buyAccess(model, planId, key.address, signer)`; each call is a free read |
| Paid, per run | `predict(model, valuesQ, { payer })`: a `predictTx` transaction | The model's fee per run, paid to its admin, plus gas |
| Your own paid model | `predict(model, valuesQ, { owner })`: your wallet signs (`OwnerView`) | Nothing |

**Access keys.** `gl1f.newAccessKey()` makes a key pair; buy a plan for its address once and keep its private key on your server or bot. Signatures expire after 5 minutes by default and cover the exact inputs, so a key cannot be replayed for other inputs. `accessStatus(model, address)` tells until which block a key works. The studio can create a key and buy a plan for it in the Web3 API panel.

Inputs are the model's signals on a completed candle, quantized to integers (`quantize(values, scaleQ)`). `latestInputs` computes them with the published market engine ([sdk/gl1f-engine.js](https://crypto.gl1f.com/sdk/gl1f-engine.js)), the code the studio runs, so the score equals the studio's and the chain's. Models that use world signals fetch the same public data.

## A track record anyone can check.

When you publish a Crypto AI model, the studio can add its training report to the model's on-chain record: the final test window and row count, ROC AUC, log-loss, accuracy and a SHA-256 fingerprint of every test row (open time, label, integer score). The studio computes it; nobody can type it in. It rebuilds the same test rows from public candles with the backtest replay and publishes the report only if the result matches the training session exactly. After minting the report can never change.

In the Inference step, anyone who can run the model (anyone for a free model; the admin and subscribers of a paid one) can press **Verify with on-chain inference**: the studio rebuilds the rows, compares every metric and the fingerprint with the published report, and checks sampled scores against GenesisL1's on-chain inference. It also scores every completed candle since the model was minted, data it could not have seen; the mint time is recorded on-chain. A report is the creator's own test, so the record since minting is the stronger evidence.

**Private internals.** Any model can keep its number of trees, depth and signal list private on the marketplace, model pages, preview cards and in the studio, for everyone but its admin. It is on by default for paid models and the admin can change it at any time after minting. The bytes stay public on-chain: this makes copying harder, it is not encryption.

## World signals: calendars, the sky, macro, disasters.

Besides 212 market signals, a Crypto AI model can learn from 62 world signals. Holidays, events and astronomy are computed from each candle's close time. Macro, disaster and war signals are fetched live in your browser when you build a dataset, straight from public sources that allow it, with no key and nothing to install. Every value uses only what was known when the candle closed. The plain name, machine name and meaning of all 274 signals are in [signals.txt](https://crypto.gl1f.com/signals.txt).

| Group | Examples | Source and timing |
|---|---|---|
| Holidays & events | US market holidays, Fed decision days, US and major world elections, Lunar New Year, Golden Weeks, options expiry, US jobs day | Computed: NYSE holiday rules and built-in Fed, election and holiday lists |
| Astronomy | Moon phase and illumination, full and new moon, Mercury, Venus and Mars retrograde, planetary alignment, days to equinox or solstice | Computed: JPL approximate orbital elements and a low-precision lunar theory |
| Macro & markets | 10-year and 2-year Treasury yields, yield curve, Fed funds rate, WTI and Brent oil, natural gas, US dollar index, VIX, S&P 500, gold, CPI inflation, unemployment | Live: Federal Reserve and BLS data via DBnomics; EIA, BLS, Federal Reserve H.10, Cboe and Shiller data via DataHub. Daily series count from 2 days after their date, monthly ones from 40 to 45 days after the month |
| Disasters & conflict | M6+ and M7+ earthquakes, active hurricanes and typhoons, their winds, major storms, new storms, war attention, days since a major war escalation | Live: USGS (since 1973), NASA EONET tropical storms (since 2000) and Wikipedia pageviews (since July 2015), counted up to the day before; escalations from a built-in list |

If a live source cannot be reached, the studio uses the copy this site publishes at [data/world.json](https://crypto.gl1f.com/data/world.json), refreshed by its scheduled job. Every world signal has years of history: the signal list shows where each one starts, and a dataset that starts before a selected signal's history is stopped with a clear message. Fed decision dates, elections and war escalations are built-in lists from 2014 that need a yearly update. A model that uses world signals loads the same data again when it runs inference.

**05** / Validation

## Tested on the future, never the past.

The final temporal test partition (the last 15% of rows) is fixed before any development folds are built, and it is scored once. Walk-forward validation (the default) uses five expanding-window folds, starting from the first 40% of development rows. Every earlier/later boundary is protected by the label's outcome look-ahead (your horizon), followed by purge and embargo margins, which are zero by default; no training row's outcome window reaches the rows it is evaluated on. Each fold's early stopping picks the number of trees; candidates are compared by their mean validation loss across completed folds, the most recent fold supplies the retained tree budget, and the final Crypto AI model is fitted on that fold's training rows or, with refit, on all development rows before the final test is scored. Shuffled validation is available for experiments and is clearly labelled as optimistic. The number of folds is adjustable from 2 to 20, the window can be expanding or rolling, and the first-window and final-test shares can be changed in the studio.

**Heuristic search (optional).** Instead of one training run, the studio can try up to 200 candidate settings. The first candidate is exactly yours; each later one varies trees, depth, learning rate, minimum leaf size and patience around the best candidate so far, the same moves as the GenesisL1 Forest studio. Every candidate is scored on all walk-forward folds, the lowest mean validation log-loss wins, and only then is the final test evaluated, once. A live chart can show train and validation loss tree by tree while this runs.

Scores reported: ROC AUC, log-loss, balanced accuracy, precision and recall at 0.5, Brier score, the confusion matrix, and the baseline of always predicting the majority answer.

**06** / Backtests

## The rules of the test drive.

- The worker replays the Crypto AI model's exact signals over the chosen period using the same engine and feature seed as the training dataset.
- A signal is a candle whose probability is at or above the threshold. The trade enters at the next candle's open, long for Up Crypto AI models and short for Down Crypto AI models.
- Target and stop are the label's levels, measured from the EMA baseline at the signal candle. If both are touched in one candle, the stop wins. A candle that opens beyond a level exits at that open. Signals whose entry price is already past the target or the stop are skipped and counted separately.
- Without a hit, the trade exits at the close of the last horizon candle. One position at a time; by default the whole account is the margin at 1× (no leverage), and both can be changed (see below).
- Fees are charged on entry and exit; slippage worsens both fills. Funding payments, partial fills, liquidity and outages are not modelled.
- The default period is the Crypto AI model's final test period, which it never trained on. Earlier periods are in-sample and flagged.

**Entries and leverage.** A signal exists only after its candle has closed, so the earliest trade is the next candle's open. There is no trade if that candle had no trades (a gap-filled bucket), if there is no next candle, or if its open is already beyond the target or the stop the signal defined. One position at a time; when the target and the stop are both touched in one candle, the stop is assumed first. Leverage from 1× to 100× multiplies returns on margin and fees on the full notional; with isolated margin, a position is liquidated when the adverse move reaches about 1 / leverage minus the maintenance margin, losing that trade's margin. Funding payments are not included. Coinbase spot runs without leverage.

**07** / Verify it yourself

## Don't trust. Re-run.

Every contract address above is checked against the keccak-256 hash of its deployed bytecode before the app reads or writes anything. Published Crypto AI models are rebuilt from on-chain chunks and hashed against their Crypto AI model ID. On the Inference step, "Verify on GenesisL1" asks the on-chain runtime for the same prediction and compares the integer score. The source code, contracts and tests are public in the [GL1F Crypto repository](https://github.com/GenesisL1/gl1f-crypto), derived from [GenesisL1 Forest](https://github.com/GenesisL1/Forest).

## Disclaimer

**GL1F Crypto is open-source, experimental data-science software provided for educational and research purposes only.** It is not a trading product, signal service, broker, exchange, fund or adviser.

- **No investment advice.** Nothing in the software, its documentation, its example questions or any Crypto AI model is financial, investment, trading, legal or tax advice, or a recommendation or solicitation to buy, sell or hold any asset.
- **Serious risk.** Trading crypto-assets, and especially derivatives, leveraged products and memecoins, carries a high risk of rapid and total loss. Only you can decide what risk is appropriate for you.
- **Crypto AI models can be wrong.** Predictions are statistical estimates from historical data. They can be overfit, stale, biased by data errors or broken by changing market conditions. Past performance, including any backtest, does not indicate future results.
- **Backtests are simulations.** They ignore many real-world effects such as liquidity, partial fills, latency, funding, outages and your own behaviour.
- **Not for live setups.** Crypto AI models built or run with this software must not be used for live trading, trading bots, copy-trading or any automated execution.
- **No warranty, no liability.** The software is provided "as is", without warranty of any kind, express or implied. In no event shall the authors, contributors or copyright holders be liable for any claim, damages or other liability arising from its use.
- **Permanent transactions.** Deployments, listings and burns on GenesisL1 are public and irreversible. Protocol fees are burned and cannot be refunded.
- **Your responsibility.** You are responsible for your decisions, for securing your wallet and keys, and for complying with the laws and regulations that apply to you.

Binance, Coinbase and Hyperliquid are trademarks of their respective owners and are named only to identify public market-data sources. GL1F Crypto is not affiliated with, endorsed by or sponsored by any of them. L1 coin is referred to only in its operational role as the unit in which GenesisL1 fees are paid.

### No warranty of any kind

The software, the website, the smart contracts, the Crypto AI models and all data are provided “as is” and “as available”, without warranty of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, title, non-infringement, accuracy, reliability, security, availability, or that results will be error-free. The software may contain bugs, errors, defects, inaccuracies, omissions and other imperfections, and may behave differently from its description. The smart contracts have not been audited and may contain vulnerabilities. Market data comes from third parties and may be wrong, delayed or incomplete.

To the maximum extent permitted by law, in no event shall the authors, contributors, Decentralized Science Labs, the GenesisL1 Association or any affiliated party be liable for any claim, loss or damage of any kind (direct, indirect, incidental, special, consequential or exemplary), including loss of funds, profits, data or opportunity, arising from or in connection with the software, its results or its use, whether in contract, tort or otherwise, even if advised of the possibility of such damage. You use it entirely at your own risk.
