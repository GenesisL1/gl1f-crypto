# Changelog

## 1.12.1 (2026-10-05)
- This public repository leaves out the protocol admin page: the contracts are deployed with `npm run deploy:contracts` and run with `npm run owner:tx`.
- Model page redesign. The question is the headline (the model's name and market sit above it), with a breadcrumb, the description and chips for access, license, signals and BUY. Everything shares one width and one grid: Ask the model and About this model on the left; Access and sale (price and Buy first) and Share in a sidebar that stays in view on wide screens. One details style everywhere.
- The answer reads at a glance: Yes or No, the probability on a bar with the 50% mark, and one sentence that repeats the question. Before a run, the space says what will appear; subscription plans show as compact rows.
- Phones: the same order in one column, a one-line breadcrumb, compact details rows, a full-width Run button. Dark mode follows the same design.
- Share links carry the model's name and question.

## 1.12.0 (2026-10-05)
- Fully static: the site is HTML and JavaScript that read GenesisL1 from the browser, and nothing runs on the server. Upload the site folder to any static host.
- Each model's page is model.html?id=<n>, drawn from the chain: every model card, list row, share link and copy link uses it, so it works on any host. Old /m/<n>/ links are forwarded by 404.html. The page sets its own title, description, preview tags, canonical link and structured data.
- View all Crypto AI models opens the marketplace's All models tab (market.html#all; #mine and #sale also open their tabs).
- Removed the generated per-model pages, their preview cards and the server-side refresh job (scripts/fetch_models.mjs, render_model_cards.py, card_cache.py, server_refresh.sh). The GitHub Pages workflow only publishes the site folder.
- deploy/setup-crypto-nginx.sh is a plain static-site setup (HTTPS, caching, security headers, 404 page, optional staging redirect) and removes the 1.11.x refresh job if it finds it.
- A site-only zip is the deployment package; the repository zip holds the sources.

## 1.11.5 (2026-10-05)
- Fix: scripts/build_pages.py used an f-string that only Python 3.12 accepts, so on servers with Python 3.8 to 3.11 the refresh job built no model pages (/m/<id>/ answered 403: a folder without index.html). All Python scripts now compile and build on Python 3.8 and 3.10.
- scripts/server_refresh.sh reports a failed page build ("finished with errors", exit 1) instead of "done", and logs the Python and Node versions it ran with.

## 1.11.4 (2026-10-05)
- deploy/setup-crypto-nginx.sh: sets up crypto.gl1f.com on a server's nginx from scratch, safe for the other sites (own vhost file only, backup, nginx -t before every reload with rollback, certbot --webroot, http2 only where it cannot change other sites). Serves the bundle's site/ folder with a real 404 page (it opens models published since the last build), revalidated pages, a year's cache for versioned scripts, security headers everywhere, Markdown and manifest types, cross-origin Web3 API files, and an optional 301 from the staging domain. Installs the refresh job: a system user, a private Node 20, Playwright and Chromium inside the project folder, a cron entry and a first run. PRINT_CONFIG=1 shows the vhost; REFRESH_ONLY=1 only updates the refresh job after a release.
- scripts/server_refresh.sh: locks on itself instead of a file in /tmp (a root-owned lock could block the cron job for good), and a run started as root continues as the project's owner, so its files stay replaceable by the cron job.
- ethers is a runtime dependency: servers and the Pages workflow install it alone (npm ci --omit=dev). The lock file no longer pins a macOS-only package, so a full npm ci also works on Linux.

## 1.11.3 (2026-10-05)
- Self-hosting: deploy/SERVER.md, an nginx config (deploy/nginx/gl1f-crypto.conf: HTTPS for crypto.gl1f.com, 404.html for missing paths so new models open at /m/<id>/, revalidated pages, year-long cache for versioned scripts and styles, gzip, Markdown and manifest types, cross-origin Web3 API files, and a permanent redirect from stagecrypto.gl1f.com that keeps the path), and scripts/server_refresh.sh for cron, doing the Pages workflow's work every 30 minutes. Preview cards are kept between runs (scripts/card_cache.py) and only new or changed models are rendered (render_model_cards.py --missing).

## 1.11.2 (2026-10-05)
- Every model card opens the model's own page (m/<id>/). Fixed: the home page cards were still links to the studio inside a link to the model page, so the studio link won.
- Home page: the five newest models, each with its access price and, when listed, BUY and the price; View all Crypto AI models below.
- Studio, Inference: GL1F Crypto AI models comes first and opens by default (This session second; a model trained in this tab still opens there). Each row shows the access price and, when listed, BUY and the price, with Use (the model page) and Buy (the model page's sale) buttons.
- The footer shows the site version, to check what is deployed.

## 1.11.1 (2026-10-05)
- Google Analytics 4 is on: measurement ID G-4LSBDBBKHN in site/runtime-config.js. Every page loads gtag.js with this ID once a visitor accepts the cookie notice (consent first; advertising features and Google signals off).

## 1.11.0 (2026-10-05)
- One page per model, and no more pop-ups: every model card (marketplace, studio, home, model index) links to the model's page. It shows the question, market, access, license and live sale status; runs the model on the latest candle right there (free models with no wallet; paid models with the owner's or a subscriber's wallet signature); buys it when listed, subscribes to its plans, and holds the owner's admin tools. Sharing: the link with a copy icon, and X, Telegram, WhatsApp and LinkedIn.
- SEO: static model pages with title, description, canonical link, preview card and structured data; the model index is static and paginated (m/, m/page/2/, …) with rel prev/next and sitemap entries. Models published after the last site build open through 404.html at the same address, drawn from the chain.
- BUY and the price appear wherever a listed model is shown: marketplace, studio list, home page, model index and model page.
- Lists load ten models per page with page navigation, reading only the models on screen and their listings from the chain: marketplace (for sale, all, mine), studio, model index.
- The studio's model sources are This session and GL1F Crypto AI models. Fixed: app.html?model=N#infer switched back to This session right after opening the model, so the link showed nothing.
- GL1F Crypto no longer refers to or reads any other GL1F contract set (runtime-config, docs, marketplace, home, studio, model fetcher).

## 1.10.7 (2026-10-05)
- Inference no longer replays a model's whole life: it replays from the training seed or 120 days (or 4,000 of the model's candles, if longer) before the candle, whichever is later. Measured against a full replay from the seed, every one of the 212 market signals gives bit-identical inputs with 90 days of history; a new test checks this with a 120-day window against a 240-day replay. A model trained on 13 months of 15-minute candles now runs in a fresh browser with 24 candle requests in about 7 seconds (was about 80 and growing every day). Backtests and the verified track record still replay from the seed.
- Hyperliquid models older than the exchange's 5,000-candle history no longer fail: the replay starts at the oldest candle Hyperliquid keeps.
- The model card states how much history inference replays.

## 1.10.6 (2026-10-05)
- Faster candle downloads: Binance and Coinbase history is fetched several pages at a time (Binance up to 6 in flight, about 1,760 of its 2,400 request weight per minute; Coinbase up to 4, 8 requests per second), instead of one page after another with a pause. A 13-month 15-minute history with BTC context downloads in about a third of the time; the candles are identical (same dataset SHA-256). Dataset builds, backtests and inference all benefit.
- Inference explains its replay: the model card's replay seed notes that the history is cached after the first run. Inference replays signals from the model's training seed so inputs match training exactly; in a browser that already has the history it takes about two seconds and downloads nothing.

## 1.10.5 (2026-10-05)
- Fix: a model trained with "Retrain without unticked signals" kept the input profile's checksum of the larger signal list it was trimmed from, so inference refused it ("The input profile's feature checksum does not match the model"), locally and after minting. The profile is now bound to the model's own signals when a dataset is trimmed, when a model file is exported and at mint (profileForFeatures).
- Models already minted with the old checksum run again: inputs are computed by name in the model's own signal order, so inference notes the mismatch and continues. Loading a dataset CSV with its profile file stays strict.
- New test: the profile round trip through on-chain metadata after a trimmed retrain.

## 1.10.4 (2026-10-04)
- Live: the GL1F Crypto contracts are deployed on GenesisL1 (store 0x555e…E906, registry 0xF93C…038B, NFT 0xad38…10C4, runtime 0x99aA…9932, marketplace 0xa11a…68c9); site/runtime-config.js carries their addresses and code hashes and status "live".

## 1.10.3 (2026-10-04)
- Phone header: the car, GL1F Crypto and EARLY ALPHA sit on one line, the car centred on it, with "powered by GenesisL1" below (it was three lines with the badge last and the car at the top). Compact sizes keep it beside the actions down to 320 px. The footer and sidebar use the same lockup and alignment.
- Studio on phones: Connect becomes a wallet icon, with a green dot when connected to GenesisL1 and amber on the wrong network.
- Phones: the Docs and Web3 API pages no longer scroll sideways (one-column layouts may shrink, code scrolls in its own box); the home page fits 320 px (meta items wrap between items, the example tabs share the width); the footer brand spans the full width on phones and small tablets.

## 1.10.2 (2026-10-04)
- Wallets: with several wallet extensions installed (for example MetaMask and Binance Wallet), the last one to load took over window.ethereum, and a broken one made Connect hang. Every page now finds wallets with EIP-6963, lets the person choose (remembered, with Change wallet on the studio, marketplace and admin page), still supports older single-wallet injection, and stops waiting on a wallet that never answers with a clear message.

## 1.10.1 (2026-10-04)
- Terms of Service: the party is Decentralized Science Labs LLC, a Wyoming limited liability company; governing law is Wyoming law with the state and federal courts in Wyoming (instead of Swiss law and Zug), keeping users' mandatory consumer protections. The cookie policy and the GL1F On-Chain Use License name the LLC.

## 1.10.0 (2026-10-04)
- Protocol admin page (admin.html, linked from the footer and the Docs): deploy the contracts from a browser wallet (fees, default license, optional multisig handover, Terms) and copy the lines for runtime-config.js; see status with code-hash checks; change fees; burn collected fees; publish new Terms versions; enable, disable, add and set the default license; hand ownership over in two steps and accept it. When the wallet is not the owner, changes become a Safe Transaction Builder batch instead of transactions.
- The deployment is shared by the command line and the page (src/admin/deploy_core.js); compiled contracts are committed as site/admin/artifacts.{js,json} with a freshness check. New tests: the admin logic on a local chain, and the whole page clicked through with a wallet on a local GenesisL1-like chain.

## 1.9.3 (2026-10-04)
- Web3 API page (api.html, also api.md): quick start, live addresses, access modes, access keys and plans, inputs, full reference, errors, security and a bot example, with downloads of the helper and the market engine. Linked from the sidebar and footer on every page, the Docs table of contents and the studio's Inference step.
- Cookie notice on every first visit: with no measurement ID it is a short notice with OK (nothing to consent to); with an ID it asks Accept or Decline as before. Google tag IDs (GT-...) are accepted, and the Pages workflow reads GA_MEASUREMENT_ID from a repository variable or a secret.

## 1.9.2 (2026-10-04)
- Cookie notice in plainer words: it asks to use cookies to count visits and improve the site (no ads, only if you agree) and links to the cookie policy, which names Google Analytics and explains it in full. The Terms speak of statistics cookies.

## 1.9.1 (2026-10-04)
- Cookie notice and Google Analytics, consent first: a small card that never blocks the page, with Accept and Decline equally easy. Google Analytics 4 loads only after Accept (consent mode, advertising features and Google signals off); Decline or the Global Privacy Control signal means nothing is requested from Google. The choice is remembered for 12 months; Cookie settings on every page reopens it, and withdrawing consent deletes the Google Analytics cookies.
- One setting: put the measurement ID in site/runtime-config.js (analytics.googleMeasurementId), or set the repository variable GA_MEASUREMENT_ID and the Pages workflow writes it (scripts/set_analytics_id.mjs). With no ID there are no analytics cookies and no notice.
- Cookie policy page (legal/cookies) and a Privacy and cookies section in the Terms of Service (section 9; later sections renumbered).
- Fonts are self-hosted (subset WOFF2 with their Open Font License texts), so no visitor data reaches Google Fonts; the main font is preloaded.

## 1.9.0 (2026-10-04)
- Web3 API: `site/sdk/gl1f-crypto.js` runs any Crypto AI model from code (browser or Node 18+) with ethers v6: model metadata and plans, the latest inputs from the published market engine (`site/sdk/gl1f-engine.js`), and inference by a free read, an access key with a plan (EIP-712 signed reads), the admin's signature or pay-per-run. Access keys are created in the browser and plans bought for them. A Web3 API panel in the Inference step shows ready code, addresses, a key creator, plan purchase and a live try; the docs have a Web3 API section.
- Feature scores: a keep tick on every signal and Retrain without unticked signals (optionally also the signals the model never used): a trimmed dataset with the same rows and labels, trained again with the same settings.
- Audit (see AUDIT.md): subscriptions can no longer be revoked or taken over by a model's admin; owner keys stop working once their setter no longer holds the NFT; the marketplace removes a listing before transferring and paying. New tests for each.

## 1.8.1 (2026-10-04)
- A model's admin can delete the model once nobody is owed access: the registry records the last block any paid subscription runs to (subscribedUntil) and burnAndDelete refuses until then (ACTIVE_SUBSCRIPTIONS). Deleting burns the NFT and removes the model from the registry, marketplace and search; bytes already written to storage stay on-chain. The protocol owner still cannot delete models.
- Marketplace admin panel: a Delete model section that says when deletion becomes possible, or deletes after typing DELETE.

## 1.8.0 (2026-10-04)
- Verifiable training reports: an optional tick at deploy publishes the final test report in the model's on-chain metadata (rows, window, ROC AUC, log-loss, Brier, accuracy and a SHA-256 fingerprint of every row). Computed by the studio and read-only; published only if rebuilding the rows from public candles matches the training session exactly; fixed forever at mint.
- Verified track record in the Inference step: anyone with inference access rebuilds the rows, compares every metric and the fingerprint, spot-checks scores against on-chain inference, and sees the model's results on every candle since minting. The registry records the mint time (mintedAt).
- Private internals for any model: an optional tick at deploy (on by default for paid models) and a setting the model's admin can change any time after mint (setInternalsVisibility). Marketplace cards, model pages, preview cards and the studio follow it.

## 1.7.4 (2026-10-04)
- Signal picker: every category has an icon and a tick that selects or clears the whole category (only the signals shown while searching); the tick shows a partial state when some are selected.
- Presets: All now selects every signal (274 with world signals, not 212); new Exotic preset: Small plus the 12 astronomy signals.

## 1.7.3 (2026-10-04)
- Only signals with years of history: every live source declares where its data starts (gold 1833, CPI 1913, fed funds 1954, 10-year yield 1962, earthquakes 1973, oil 1986, VIX 1990, natural gas 1997, dollar index 1999, tropical storms 2000, Wikipedia July 2015), shown as "History from ..." in the picker and the signal list. A test fails if any source has less than 3 years, and a dataset that starts before a selected signal's history stops with a clear message.
- NASA EONET volcanoes and its other disaster categories have little history, so "Erupting volcanoes" and "New natural disasters" are replaced by "Major hurricanes and typhoons" and "New tropical storms, last 7 days" (tropical storms are tracked since 2000).
- Fix: storm winds now use only reports up to the day before (the peak of a storm's whole life could leak future intensification).
- The built-in Fed decision, election and Lunar New Year lists start in 2014, before the oldest exchange candles.

## 1.7.2 (2026-10-04)
- World data now loads live in the browser when a dataset is built, with nothing to install or download: Federal Reserve and BLS data via DBnomics; EIA oil and gas, BLS CPI, Federal Reserve H.10 exchange rates (dollar index with DXY weights), Cboe VIX, Shiller S&P 500 and gold via DataHub on GitHub; USGS earthquakes; NASA EONET storms, volcanoes and natural events; Wikipedia pageviews for war attention. These sources allow web pages to read them; FRED, GDACS and GDELT were replaced. If a live source cannot be reached, the studio uses the copy the site publishes at data/world.json. The local data script (world.js) is gone.
- Signals: S&P 500, VIX, natural gas and gold are back or new; storms now come with their highest wind; erupting volcanoes and new natural disasters replace GDACS alerts; war attention replaces GDELT war news. Still 274 signals.

## 1.7.1 (2026-10-04)
- Fix: a stray closing tag from 1.7.0 pushed "The question" into the narrow right-hand column of the dataset step; it is back in the main column with its diagram at full width. Every page is now checked for containers that nest and close properly.
- The question diagram keeps its window label away from the target label, so they never overlap; the horizon count keeps room for its spinner.
- Public data for world signals also loads when the studio is opened from disk: scripts/fetch_world_data.mjs writes site/data/world.js next to world.json, and app.html loads it. The signal picker says when that data has not been downloaded and how to get it (`node scripts/fetch_world_data.mjs`); a deployed site downloads it automatically. The downloader is tested against mocked FRED, USGS, GDACS and GDELT responses.

## 1.7.0 (2026-10-03)
- 62 world signals: holidays and events (US market holidays, Fed decision days, US and world elections, Lunar New Year, Golden Weeks, expiries, US jobs day), astronomy (Moon phase, full and new moon, Mercury, Venus and Mars retrograde, planetary alignment, seasons), macro and markets (Treasury yields, yield curve, Fed funds, oil, US dollar, CPI, unemployment) and disasters and conflict (earthquakes, hurricanes and typhoons, red disaster alerts, war news, war escalations). Public data comes from FRED, USGS, GDACS and GDELT, refreshed at deployment into data/world.json; S&P 500, Nasdaq and VIX are licensed and off by default. 274 signals in all, listed in SIGNALS.txt and site/signals.txt.
- Every signal shows its plain name first and its machine name in brackets. Fix: the expanded signal picker showed only its search box (an empty search set the hidden attribute on every signal).
- Training: early stopping can be switched off; learning-rate schedule with Constant, Cut on plateau (wait, cut, lowest rate) and Piecewise by tree ranges, as in GenesisL1 Forest. Feature scores after training: share of splits and final-test AUC lost when each signal is shuffled.
- Paid models keep their internals private: trees, depth and signal counts are hidden on marketplace cards, model pages, preview cards, LLM files and in the studio, except for the model's admin.
- Models are permanent: the delete functions are removed from the registry, so neither the protocol admin nor a model's admin can delete a published model.
- Layout: paired fields wrap together (market with candle, start date with end date), so a date range never splits across lines; every input and select has one height, with one select style and left-aligned dates in Safari. Shorter studio texts; the ? popovers carry the detail.

## 1.6.0 (2026-10-02)
- Fix (iPhone and everywhere): the next studio step now opens at its top. The scroll target was measured from the sticky step bar, so the page never moved and the next step showed its bottom.
- Link previews: dark, car-themed preview images in the style of the launch cover for every page and every published model, 1200x630 JPEG for Telegram, X, WhatsApp, LinkedIn, Slack and Facebook. The Pages workflow stamps the real deployment address into every preview, canonical link, sitemap and LLM file, so previews work on a custom domain and on the github.io address alike. robots.txt welcomes the preview bots by name.
- SEO and LLMs: llms.txt in the llmstxt.org layout; llms-full.txt with the overview, studio, marketplace, docs, license catalog, Terms of Service and the GL1F On-Chain Use License in one file; a Markdown copy of every page (index.md, app.md, market.md, docs.md, legal/*.md, m/<id>/index.md) linked from each page's head; the license catalog as licenses.json; more AI crawlers welcomed.
- Checks: preview image size and format, absolute preview URLs, Markdown alternates, robots rules and the LLM files.

## 1.5.0 (2026-10-02)
- Sidebar logo in one row, as on the cover: car, GL1F Crypto and the EARLY ALPHA badge, "powered by GenesisL1" below.
- Terms of Service for the whole dapp (app, website, smart contracts), including the duty to respect every model's license. Stored in full on-chain at deployment; the owner publishes new versions with `setToS`; the studio and the marketplace ask users to accept the version in force; minting requires it. Pages at `/legal/terms.html` plus a plain-text copy.
- GL1F On-Chain Use License 1.0, a reserved license for public on-chain models: all rights reserved, use only through GenesisL1 on the admin's terms, off-chain runs only for the admin, active subscribers, or anyone while the model is free. Added to the catalog (38 licenses) in a new Reserved group and preselected for paid models; an open license on a paid model shows a warning.
- License versions: the owner can publish a later version of a license (`setLicenseSupersedes`); a model admin can move a model to a later version or to a more open license (`changeModelLicense`), never to a stricter one. Every license has an openness class on-chain; `licenseOf` returns it with the block the license applies from. Admin panel control on the marketplace.
- The studio respects licenses: it does not run a paid model under a reserved license in the browser except for its admin and active subscribers.
- Tests: reserved license, license versions and the no-downgrade rule, Terms upgraded by the multisig, minting refused under old Terms.

## 1.4.0 (2026-10-02)
- Early alpha badge in the brand on every page (sidebar, phone header, footer), in the top bar on tablets, and on the link-preview images.
- Licenses: the creator of each Crypto AI model NFT chooses its license when minting, from an on-chain catalog of 37 standard licenses (public domain, permissive, share-alike, restricted; identifiers checked against the SPDX License List 3.29.0, plus OpenMDW 1.1). CC BY-SA 4.0 stays the global default. A model's license is fixed at mint. The protocol admin can add licenses, close them to new models and change the default. Shown in the studio, the marketplace, model pages (with structured data) and the docs.
- Admin: contract ownership moves in two steps (`transferOwnership`, then `acceptOwnership` by the new owner), so it can safely go to a multisig. The deploy script takes `--owner` and `--default-license`; `scripts/owner_tx.mjs` prints owner transactions for a multisig.
- Fix: after a model NFT was sold, inference fees and subscription payments kept going to the seller's fee recipient. Income now follows the NFT: a recipient set by a previous owner stops applying.
- Hardening: the registry's NFT contract can be wired only once; settings updates emit `ModelSettingsUpdated`; access modes above Paid are rejected; listing-fee changes emit `ListingFeeSet`.
- Docs: licenses, admin powers and the multisig handover; corrected the contract owner's powers, who receives creator income, and the backtest leverage rules.
- Tests: license catalog and per-model licenses, two-step handover to a multisig contract, income after a sale and a transfer, owner transactions, and the app's ABIs against the compiled contracts.

## 1.3.0 (2026-09-28)
- Share button on every page and share links in the footer; native share sheet on phones.
- One shareable page per published Crypto AI model (`/m/<tokenId>/`) with its own title, question, description, keywords, structured data and preview card, rebuilt automatically every 30 minutes by the Pages workflow; model directory at `/m/`.
- Prominent "Save Crypto AI model" card after training; share card with the model's link after deploying; `?model=<id>` and `#m=<id>` deep links.
- Hero: "Ask a yes-or-no question about the next few hours or days."

## 1.2.0 (2026-09-28)
- Backtest: leverage 1× to 100× with margin per trade, maintenance margin, isolated-margin liquidation and account ruin; entries only at the next candle's open when that candle traded and its open is still between stop and target; skipped signals reported. New unit tests.
- Model monetization in the deploy step: free, tips, pay per inference and subscription plans, created on-chain right after minting; the owner is the model admin.
- Marketplace page: listings, all models, model details with subscriptions and buying, and an admin panel for access, fees, plans and sales.
- Two-line hero headline, "Crypto AI model" wording, calmer type scale; hero columns and page bottoms aligned with the sidebar.
- Red favicon car on white; white link-preview images per page with full Open Graph, X/Twitter, Slack and legacy tags.
- Disclaimers: no warranty of any kind, bugs, errors and imperfections, unaudited contracts, third-party data, no liability.

## 1.1.0 (2026-09-28)
- Hyperliquid works again: the clock probe asked for candles up to the year 275,760, which the API answers with HTTP 500. Probes now stay near the present, candles paginate by cursor (answers capped at 500 rows are handled), server error text is shown, and retries are shorter. The test mock now rejects impossible timestamps like the real API.
- Training: walk-forward folds adjustable from 2 to 20, expanding or rolling windows, first-window and final-test shares, reduce-on-plateau learning rate, optional heuristic search with a results table and "use best settings", optional live training chart.
- Favicon: a front-view car on red that reads at 16 px; favicon.ico, maskable app icon.
- SEO: crypto AI model narrative in titles, descriptions and copy; keywords; social cards; structured data; robots.txt for AI crawlers; sitemap; llms.txt.
- Brand line "powered by GenesisL1"; "GenesisL1 EVM is your quant."
- Card buttons align at the bottom of every card; charts draw at their real width so labels stay small in the wide layout.

## 1.0.0 (2026-09-28)
- First standalone release of the GL1F Crypto runtime and its burnable-fee contracts.
