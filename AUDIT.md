# GL1F Crypto audit, version 1.9.0 (4 October 2026)

An internal review of the smart contracts, the studio, the marketplace and the new Web3 API, with the bugs found, how each was fixed and the tests that now guard it. It is not an independent security audit: before the contracts hold real value, have them reviewed by an outside firm.

## Contracts

Scope: CryptoModelRegistry and CryptoModelMarketplace (generated from the upstream GenesisL1 Forest contracts plus the patches in `scripts/generate_crypto_contracts.py`), ForestRuntime, ModelNFT, ModelStore.

| # | Severity | Finding | Fix | Test |
|---|---|---|---|---|
| 1 | High (for subscribers) | `revokeAccessKey` let a model's admin revoke **any** key, including a subscriber's paid plan, so prepaid access could be taken away. | Only owner keys (the admin's own) can be revoked (`NOT_OWNER_KEY`). | `admin and licenses`, step 11 |
| 2 | High (for subscribers) | `setOwnerAccessKey` could turn a subscriber's key into an owner key, which could then be revoked. | Refused while the key has a running plan (`KEY_SUBSCRIBED`). | step 11 |
| 3 | Medium | Owner keys had unlimited access forever: after an NFT sale the previous owner's key kept running the paid model. | `ownerKeyHolder` records who set each owner key; `accessExpiry` returns 0 once that address no longer holds the NFT. Access follows the NFT, like income. | step 11 |
| 4 | Low | Marketplace `buy` transferred the NFT and paid the seller before deleting the listing; a seller contract could re-enter (for example `cancel`) and remove the listing twice, corrupting the for-sale index. | Listing removed before any external call (checks-effects-interactions). | `crypto contracts match` + existing buy tests |
| 5 | Design | Model deletion (1.8.1) must not take anything owed. | `burnAndDelete` refuses until `subscribedUntil` (the last block any paid plan runs to); the protocol owner has no delete. | step 10 |

Checked and found correct: pay-per-run (`predictTx`) pays the current admin's payout address (income follows the NFT); NFT IDs start at 1, so 0 safely means "none"; `buyAccess` refuses deleted models; signed reads are EIP-712, bound to the chain and the runtime contract, expire (deadline) and cover the exact inputs; subscription expiry arithmetic cannot overflow (checked math, an owner key's maximum reverts); protocol fees can only be burned; ownership moves in two steps; licenses can only be opened up or moved to a later version.

## Studio and marketplace

Bugs found and fixed during this release cycle (each now covered by a browser check or a test):

- 1.9.0: retraining needed a manual export of the dataset: now a keep tick on every feature score and **Retrain without unticked signals** (trimmed dataset, same rows and labels; the verifiable report stays reproducible after retraining).
- 1.8.0: a key-value layout bug made report labels and values run together; the plateau learning-rate schedule did nothing when chosen (a helper out of scope); both fixed.
- 1.7.x: a stray closing tag pushed "The question" into the narrow right column; storm wind could use a storm's later peak (look-ahead); signals with only months of history were removed; public data now loads in the browser with no setup; the signal picker list did not show; feature scores failed to render.

Every page is checked for containers that nest and close properly, every bound element exists, every help text is present, and scripts are cache-busted (`site check`).

## Privacy

Google Analytics loads only after consent (no Google tag in the HTML; checked on every page), Global Privacy Control is honoured, withdrawing consent deletes the `_ga` cookies, and fonts are self-hosted so no request reaches Google before consent. The only other third parties are the services the app reads from the browser (exchanges, public data, GenesisL1 RPC) and jsDelivr for the ethers library; the cookie policy lists them.

## Web3 API

`site/sdk/gl1f-crypto.js` (helper) and `site/sdk/gl1f-engine.js` (the studio's market engine). The `web3 api` test runs on a local chain: model metadata and plans; a free read, an access key with a bought plan, the admin's signature and pay-per-run all return exactly the score the local engine computes; keys without a plan or after their plan ends are refused; the fee reaches the model's admin.

## Not verified here

- Studio and marketplace flows that need a connected wallet were tested at the contract and API level, not clicked through in a browser: minting from the studio, buying a plan in the Web3 API panel, a model admin's actions (internals, delete), the Verify button on a minted model.
- DBnomics, USGS, NASA EONET and Wikipedia cannot be reached from the build machine; their parsers are tested against realistic responses. DataHub was tested live.
- The local test chain (ganache) rejects the standard `eth_signTypedData_v4` request that wallets accept; the test signs the owner path with a local key instead.
- Terms of Service, the GL1F On-Chain Use License and the cookie policy need legal review.

## Test suites (`npm test`)

site check · model pages · backtest rules · runtime numeric contract · crypto market engine · world signals · live world data · training reports · contracts match upstream plus patches · fee burn · admin and licenses (including access keys and deletion) · web3 api.
