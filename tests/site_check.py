import re
#!/usr/bin/env python3
# MIT License — Copyright (c) 2026 Decentralized Science Labs
"""Static checks for the GL1F Crypto site, config and contracts."""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE, SRC = ROOT / "site", ROOT / "src"
V = json.loads((ROOT / "package.json").read_text())["version"]
errors = []
def check(ok, message):
    if not ok: errors.append(message)

REQUIRED = ["index.html", "app.html", "docs.html", "runtime-config.js", "site.webmanifest", "sitemap.xml", "robots.txt",
            "assets/gl1f.css", "assets/theme.js", "assets/car-mark.svg", "assets/favicon.svg", "assets/favicon-32.png", "assets/apple-touch-icon.png",
            "assets/icon-192.png", "assets/icon-512.png", "assets/og-home.jpg", "assets/og-studio.jpg", "assets/og-market.jpg", "assets/og-docs.jpg", "market.html", "js/market.js", "js/site.js", "assets/car-poster-light.webp", "assets/car-poster-dark.webp",
            "assets/three.LICENSE.txt", "assets/icon-maskable-512.png", "favicon.ico", "llms.txt", "js/home.js", "js/studio.js", "js/docs.js", "js/car3d.js",
            "legal/terms.html", "legal/onchain-use-1.0.html", "legal/terms-v1.txt", "legal/onchain-use-1.0.txt",
            "llms-full.txt", "index.md", "app.md", "market.md", "docs.md", "legal/terms.md", "legal/onchain-use-1.0.md", "licenses.json", "assets/og-car.webp", "data/world.json", "signals.txt", "assets/consent.js", "api.html", "api.md", "sdk/gl1f-crypto.js", "sdk/gl1f-engine.js", "legal/cookies.html", "legal/cookies.md", "legal/cookies.txt"]
for rel in REQUIRED: check((SITE / rel).is_file(), f"missing site/{rel}")

pages = {n: (SITE / n).read_text() for n in ["index.html", "app.html", "market.html", "docs.html"]}
help_keys = set(re.findall(r'^\s*"([a-z]+\.[A-Za-z0-9_.]+)":\s*\{', (SRC / "studio/help_texts.js").read_text(), re.M))
for name, html in pages.items():
    low = html.lower()
    check('type="module"' not in html, f"{name}: pages must use classic scripts (works from disk and any host)")
    for local in re.findall(r'(?:src|href)="\./((?:assets|js)/[^"?]+\.(?:js|css|svg|png|webp))(\?v=[^"]*)?"', html):
        check(local[1] == f"?v={V}", f"{name}: {local[0]} must be cache-busted with ?v={V}")
    for needle in ["<title>", 'name="description"', 'rel="canonical"', 'property="og:image"', 'name="viewport"', "assets/theme.js", "data-theme-toggle", 'class="rail"', 'class="bottom-nav"', "data-search"]:
        check(needle in html, f"{name}: missing {needle}")
    check(len(re.findall(r"<h1[\s>]", html)) == 1, f"{name}: exactly one h1")
    check("not investment advice" in low or "no investment advice" in low, f"{name}: disclaimer")
    check(not any(w in low for w in ["lamborghini", "pump.fun", "pumpfun"]), f"{name}: third-party brand in copy")
    check("powered by GenesisL1" in html and "./favicon.ico" in html, f"{name}: brand line and favicon.ico")
    check('class="icon-btn share-btn" type="button" data-share' in html and "footer-share" in html, f"{name}: share button and footer share links")
    for tag in ['property="og:image:secure_url"', 'property="og:image:type" content="image/jpeg"', 'property="og:image:alt"', 'name="twitter:image:alt"', 'rel="image_src"']:
        check(tag in html, f"{name}: link preview tag {tag}")
    check("No warranty" in html or "without warranty of any kind" in html, f"{name}: no-warranty disclaimer")
    check("AI model" in re.search(r"<title>(.*?)</title>", html).group(1) or "crypto AI" in re.search(r"<title>(.*?)</title>", html).group(1), f"{name}: title must carry the crypto AI narrative")
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try: json.loads(block)
        except ValueError as error: errors.append(f"{name}: invalid JSON-LD ({error})")
    ids = re.findall(r'\sid="([^"]+)"', html)
    check(len(ids) == len(set(ids)), f"{name}: duplicate ids {sorted({i for i in ids if ids.count(i) > 1})}")
    missing = set(re.findall(r'data-help="([^"]+)"', html)) - help_keys
    check(not missing, f"{name}: help keys without text {sorted(missing)}")

def js_ids(path):
    text = path.read_text()
    return set(re.findall(r'\$\("#([A-Za-z0-9_-]+)"\)', text)) | set(re.findall(r'getElementById\("([A-Za-z0-9_-]+)"\)', text))
page_ids = {n: set(re.findall(r'\sid="([^"]+)"', h)) for n, h in pages.items()}
for module in ["app.js", "step_dataset.js", "step_train.js", "step_backtest.js", "step_deploy.js", "step_infer.js"]:
    missing = js_ids(SRC / "studio" / module) - page_ids["app.html"]
    check(not missing, f"src/studio/{module} binds ids missing from app.html: {sorted(missing)}")
check(not (js_ids(SRC / "studio/docs.js") - page_ids["docs.html"]), "src/studio/docs.js binds ids missing from docs.html")
check(not (js_ids(SRC / "pages/home.mjs") - page_ids["index.html"]), "src/pages/home.mjs binds ids missing from index.html")
check(not ({i for i in re.findall(r'\$\("#([A-Za-z0-9_-]+)"\)', (SRC / "pages/market.mjs").read_text())} - page_ids["market.html"]), "src/pages/market.mjs binds ids missing from market.html")
for bundle in ["home", "studio", "market", "docs", "car3d"]:
    text = (SITE / "js" / f"{bundle}.js").read_text()
    check(text.startswith("/*!") and not re.search(r"^\s*(import|export)\s", text, re.M) and "import.meta" not in text, f"js/{bundle}.js must be a self-contained classic script")
check("createWorker(\"market\")" in (SRC / "studio/app.js").read_text() and "createWorker(\"train\")" in (SRC / "studio/step_train.js").read_text(), "workers must start from embedded blob sources")

check("GenesisL1 EVM" in pages["index.html"] and "is your quant." in pages["index.html"], "home: GenesisL1 EVM is your quant")
check("next few hours or days" in pages["index.html"] and "Save Crypto AI model (.gl1f)" in pages["app.html"] and 'id="dp-share"' in pages["app.html"], "hero wording, save card and deploy share link")
check("Launch your own</span>" in pages["index.html"] and "Crypto AI model.</span></h1>" in pages["index.html"], "home: two-line headline")
check("Model monetization" in pages["index.html"] and "Subscription plans" in pages["app.html"] and "model admin" in pages["market.html"], "monetization, plans and model admin must be stated")
robots = (SITE / "robots.txt").read_text()
check("User-agent: GPTBot" in robots and "User-agent: ClaudeBot" in robots and "Sitemap: " in robots, "robots.txt must welcome AI crawlers and list the sitemap")
check("8.64e15" not in (SRC / "studio/market_worker.js").read_text(), "Hyperliquid clock probe must stay inside representable timestamps")
cfg = (SITE / "runtime-config.js").read_text()
KEYS = ("store", "registry", "nft", "runtime", "market")
if 'status: "live"' in cfg:
    # Deployed: the five contracts and their code hashes (the app checks each hash before any read or transaction).
    a = re.search(r"\bcontracts: Object\.freeze\(\{([^}]*)\}\)", cfg); h = re.search(r"\bcodeHashes: Object\.freeze\(\{([^}]*)\}\)", cfg)
    check(bool(a and h) and all(re.search(rf'\b{k}: "0x[0-9a-fA-F]{{40}}"', a.group(1)) for k in KEYS) and all(re.search(rf'\b{k}: "0x[0-9a-f]{{64}}"', h.group(1)) for k in KEYS),
          "live config: five contract addresses and five code hashes")
else:
    check(re.search(r"\bcontracts:\s*null,", cfg) and re.search(r"\bcodeHashes:\s*null,", cfg) and 'status: "preview"' in cfg, "crypto contracts stay null/preview until deployed")
check("0x000000000000000000000000000000000000dEaD" in cfg and "api.hyperliquid.xyz" in cfg, "burn address and Hyperliquid in config")

for rel in ["contracts/CryptoModelRegistry.sol", "contracts/CryptoModelMarketplace.sol"]:
    src = (ROOT / rel).read_text()
    check("function burnFees() external" in src and "0x000000000000000000000000000000000000dEaD" in src, f"{rel}: public burn")
    check("owner.call{value" not in src and not re.search(r"function\s+(withdraw|sweep|rescue)", src, re.I), f"{rel}: no path for anyone to withdraw fees")
worker = (SRC / "studio/market_worker.js").read_text()
check("Math.max(-2147483648, Math.min(2147483647, rounded))" in worker, "worker quantizer must saturate to int32 (manuscript eq. quantizer)")
readme = (ROOT / "README.md").read_text() if (ROOT / "README.md").exists() else ""
check("api.hyperliquid.xyz" in readme and "worker-src 'self' blob:" in readme, "README CSP must allow Hyperliquid and blob workers")

lic = json.loads((SRC / "studio/licenses.json").read_text())
spdx_ids, groups = [l["spdx"] for l in lic["licenses"]], {g["id"] for g in lic["groups"]}
check(len(spdx_ids) == len(set(spdx_ids)) and spdx_ids[0] == lic["default"] == "CC-BY-SA-4.0", "license catalog: unique identifiers; CC-BY-SA-4.0 is entry 1 and the default")
for entry in lic["licenses"]:
    check(entry["group"] in groups and entry["url"].startswith("https://") and 0 < len(entry["name"].encode()) <= 31 and entry["summary"], f"license {entry['spdx']}: group, https link, short on-chain name, summary")
    check(entry["spdxListed"] or entry["spdx"].startswith("LicenseRef-"), f"license {entry['spdx']}: identifiers not on the SPDX list must be LicenseRef-")
    check(f'data-lic="{entry["spdx"]}"' in pages["docs.html"], f"docs: license table misses {entry['spdx']}")
for name, page_html in pages.items():
    check(page_html.count('class="alpha"') >= 2 and "topbar-alpha" in page_html and "Early alpha" in page_html, f"{name}: early alpha badge in the brand and the top bar")
check('id="dp-license-select"' in pages["app.html"] and 'id="licenses"' in pages["docs.html"] and 'id="admin"' in pages["docs.html"], "license picker, license and admin docs")
reg_src = (ROOT / "contracts/CryptoModelRegistry.sol").read_text()
check(all(f in reg_src for f in ["function licenseOf(", "function setLicenseEnabled(", "function payoutAddressOf(", 'require(address(modelNFT) == address(0), "NFT_SET")']), "registry: per-model licenses, income follows the NFT, one-time NFT wiring")
check("function acceptOwnership()" in (ROOT / "contracts/SimpleOwnable.sol").read_text(), "contracts: two-step ownership")
check(all("openness" in e and 0 <= e["openness"] <= 4 for e in lic["licenses"]), "license catalog: every license has an openness class")
check(next((e["openness"] for e in lic["licenses"] if e["spdx"] == lic.get("paidDefault")), 1) == 0, "license catalog: the paid default is a reserved license")
for name, page_html in pages.items():
    check('name="gl1f-terms-version"' in page_html and "./legal/terms.html" in page_html, f"{name}: Terms version meta and Terms of Service link")
terms_page = (SITE / "legal/terms.html").read_text()
check(terms_page.count("<h1") == 1 and "respect the license of every model" in terms_page and 'href="../assets/gl1f.css' in terms_page, "legal/terms.html: one h1, the license duty, styles from the site root")
check((SITE / "legal/terms-v1.txt").read_text() == (ROOT / "legal/terms.md").read_text(), "Terms plain text equals legal/terms.md, the text stored on-chain")
check('class="brand-top"' in pages["index.html"].split('class="rail"', 1)[1].split("</aside>", 1)[0], "sidebar brand in one row with the badge")
from html.parser import HTMLParser
class _Containers(HTMLParser):
    """Containers that need an explicit end tag must nest and close properly (a stray </div> breaks a layout silently)."""
    TAGS = {"div", "section", "aside", "details", "article", "main", "nav", "header", "footer", "table", "form", "ul", "ol", "dl", "figure", "dialog", "summary"}
    def __init__(self): super().__init__(); self.stack, self.errors = [], []
    def handle_starttag(self, tag, attrs):
        if tag in self.TAGS: self.stack.append((tag, self.getpos()[0]))
    def handle_endtag(self, tag):
        if tag not in self.TAGS: return
        if not self.stack or self.stack[-1][0] != tag: self.errors.append(f"</{tag}> on line {self.getpos()[0]} closes {self.stack[-1] if self.stack else 'nothing'}"); return
        self.stack.pop()
for name, page_html in pages.items():
    cp = _Containers(); cp.feed(page_html); cp.close()
    check(not cp.errors and not cp.stack, f"{name}: containers nest and close properly {(cp.errors + [f'unclosed {t} from line {l}' for t, l in cp.stack])[:2]}")
check("data/world.js" not in pages["app.html"], "app.html needs no data file: world data loads live in the browser")
for name, page_html in pages.items():
    check(f'assets/consent.js?v={V}"' in page_html and "runtime-config.js?v=" in page_html and "googletagmanager" not in page_html and "data-cookie-settings" in page_html,
          f"{name}: consent-first cookie notice and analytics (no Google tag in the HTML), with Cookie settings")
check(not any("fonts.googleapis" in h or "fonts.gstatic" in h for h in pages.values()) and "fonts.googleapis" not in (SITE / "assets/gl1f.css").read_text(), "fonts are self-hosted: nothing is requested from Google before consent")
check(all((SITE / "assets/fonts" / f).exists() for f in ["inter.woff2", "instrument-serif.woff2", "instrument-serif-italic.woff2", "jetbrains-mono.woff2", "OFL-Inter.txt", "OFL-InstrumentSerif.txt", "OFL-JetBrainsMono.txt"]), "self-hosted fonts and their licenses")
for name, page_html in pages.items():
    check(re.search(r'href="(\./|\.\./|\.\./\.\./)*api\.html"', page_html) is not None, f"{name}: links to the Web3 API page")
check("#web3-api" in pages["docs.html"] and 'href="./api.html"' in pages["app.html"], "Docs and the studio point to the Web3 API")
rc = (SITE / "runtime-config.js").read_text()
check(re.search(r'analytics: Object\.freeze\(\{ googleMeasurementId: "(G-[A-Z0-9]{4,})?" \}\)', rc) is not None, "runtime-config.js: analytics.googleMeasurementId (empty or G-...)")
cj = (SITE / "assets/consent.js").read_text()
check("analytics_storage" in cj and "globalPrivacyControl" in cj and "gl1f-consent" in cj and "_ga_" in cj, "consent.js: consent mode, Global Privacy Control, remembered choice, cookie removal on withdrawal")
robots = (SITE / "robots.txt").read_text()
check(all(f"User-agent: {bot}\nAllow: /" in robots for bot in ["TelegramBot", "Twitterbot", "facebookexternalhit", "LinkedInBot", "WhatsApp", "Discordbot", "Slackbot", "ClaudeBot", "GPTBot"]), "robots.txt welcomes link-preview bots and AI crawlers")
from PIL import Image as _Image
for og_name in ["home", "studio", "market", "docs"]:
    og_path = SITE / f"assets/og-{og_name}.jpg"
    with _Image.open(og_path) as og_img: og_ok = og_img.size == (1200, 630) and og_img.format == "JPEG"
    check(og_ok and og_path.stat().st_size < 400_000, f"og-{og_name}.jpg: 1200x630 JPEG under 400 KB for Telegram, X and WhatsApp")
for name, page_html in pages.items():
    head_html = page_html.split("</head>", 1)[0]
    check('property="og:image" content="https://' in head_html and 'name="twitter:image" content="https://' in head_html and 'rel="alternate" type="text/markdown"' in head_html, f"{name}: absolute preview image and a Markdown alternate in <head>")
llms, llms_full = (SITE / "llms.txt").read_text(), (SITE / "llms-full.txt").read_text()
check(llms.startswith("# GL1F Crypto\n\n> ") and "## Docs" in llms and "## Optional" in llms and "docs.md" in llms, "llms.txt follows the llmstxt.org layout")
check("respect the license of every model" in llms_full and "| 38 |" in llms_full and "## The five steps" in llms_full, "llms-full.txt: overview, studio, docs, license catalog, terms and license")
docs_md = (SITE / "docs.md").read_text()
check(docs_md.count("\n## ") >= 8 and "| # | License | SPDX | In short |" in docs_md and "](https://" in docs_md, "docs.md: headings, license tables and absolute links")
check("changeModelLicense" in reg_src and "setLicenseSupersedes" in reg_src, "registry: license versions and model-admin upgrades")

if errors:
    print("site check FAILED:\n  " + "\n  ".join(errors)); sys.exit(1)
print(f"site check: {len(REQUIRED)} files, classic cache-busted scripts, {len(help_keys)} help texts, bindings, SEO, config and burnable-fee contracts OK")
