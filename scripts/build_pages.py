#!/usr/bin/env python3
# MIT License — Copyright (c) 2026 Decentralized Science Labs
"""Compose site/index.html, site/app.html and site/docs.html from one platform shell and the page bodies in src/pages/."""
import html
import urllib.parse
import json
import os
import pathlib
import re
from html.parser import HTMLParser
from urllib.parse import urljoin

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "pages"
SITE = ROOT / "site"
V = json.loads((ROOT / "package.json").read_text())["version"]
LIC = json.loads((ROOT / "src" / "studio" / "licenses.json").read_text())
LIC_DEFAULT = next(l["name"] for l in LIC["licenses"] if l["spdx"] == LIC["default"])
LIC_COUNT, SPDX_VER = len(LIC["licenses"]), LIC["spdxLicenseListVersion"]
TERMS_MD = (ROOT / "legal" / "terms.md").read_text()
TERMS_VERSION = int(re.search(r"^Version (\d+)", TERMS_MD, re.M).group(1))
# Legal pages, rendered from the same text that goes on-chain: (source, page, plain-text copy, title, description)
LEGAL = [("legal/terms.md", "legal/terms.html", f"legal/terms-v{TERMS_VERSION}.txt", "Terms of Service | GL1F Crypto",
          "Terms of Service for GL1F Crypto: the app, the website and the smart contracts on GenesisL1, including respecting the license of every Crypto AI model."),
         ("legal/onchain-use-1.0.md", "legal/onchain-use-1.0.html", "legal/onchain-use-1.0.txt", "GL1F On-Chain Use License 1.0 | GL1F Crypto",
          "The GL1F On-Chain Use License: all rights reserved for a Crypto AI model on GenesisL1, used only through GenesisL1 on its admin's terms. No copying."),
         ("legal/cookies.md", "legal/cookies.html", "legal/cookies.txt", "Cookie policy | GL1F Crypto",
          "Cookie policy for GL1F Crypto: what the site keeps in your browser, and Google Analytics only with your consent.")]
LASTMOD = "2026-10-02"
# The address the site is served from: the Pages workflow sets GL1F_ORIGIN, so previews, canonical links and the
# LLM files always point at the real deployment (a custom domain or the github.io address).
ORIGIN = os.environ.get("GL1F_ORIGIN", "https://crypto.gl1f.com/").rstrip("/") + "/"
# Markdown copy of each page, for language models and agents (advertised with rel="alternate").
MD_MIRROR = {"": "index.md", "index.html": "index.md", "api.html": "api.md", "app.html": "app.md", "market.html": "market.md", "docs.html": "docs.md",
             "legal/terms.html": "legal/terms.md", "legal/onchain-use-1.0.html": "legal/onchain-use-1.0.md", "legal/cookies.html": "legal/cookies.md"}
ETHERS = ('<script src="https://cdn.jsdelivr.net/npm/ethers@6.12.1/dist/ethers.umd.min.js" '
          'integrity="sha384-ZE/wK5p9CtYydQ2IWO7H7mb0024vP3kJ1eOG7JD9+UA/0VBGZeYIxtttlh93VoK7" crossorigin="anonymous"></script>')

ICON = {
    "home": '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/>',
    "studio": '<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6.2 6.2l2.6 2.6M15.2 15.2l2.6 2.6M6.2 17.8l2.6-2.6M15.2 8.8l2.6-2.6"/>',
    "models": '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    "backtest": '<path d="M3.5 20h17"/><path d="M5.5 15.5 9.5 11l3.5 3 5.5-7.5"/>',
    "infer": '<path d="M13 2.5 4.5 13.5H11L10 21.5l8.5-11H12z"/>',
    "market": '<path d="M4 9.5 5.6 4h12.8L20 9.5"/><path d="M4 9.5c0 1.4 1.1 2.5 2.5 2.5S9 10.9 9 9.5c0 1.4 1.1 2.5 2.5 2.5h1c1.4 0 2.5-1.1 2.5-2.5 0 1.4 1.1 2.5 2.5 2.5S20 10.9 20 9.5"/><path d="M5.5 12v8h13v-8"/><path d="M10 20v-4.5h4V20"/>',
    "burn": '<path d="M12 21.5c4 0 6.8-2.7 6.8-6.3 0-3.4-2.4-5.6-4-8.4-.7 1.7-1.6 2.7-2.8 3.4.3-2.7-.6-5.3-2.9-8.2-.5 4.5-3.9 6.6-3.9 11.6 0 4 2.9 7.9 6.8 7.9z"/>',
    "stats": '<path d="M3 12h4l3-7.5 4 15 3-7.5h4"/>',
    "docs": '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
    "learn": '<path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z"/><path d="M6.5 11v4.8c3.2 2.2 7.8 2.2 11 0V11"/>',
    "api": '<path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/><path d="m13.5 5-3 14"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "search": '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
}
def icon(name, size=20):
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="currentColor" stroke-width="1.8" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICON[name]}</svg>')

THEME = ('<button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="Switch theme">'
         '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg>'
         '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/></svg></button>')
SHARE = ('<button class="icon-btn share-btn" type="button" data-share aria-label="Share this page">'
         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7.5 7.5 4.5-4.5 4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></button>')
ALPHA = '<span class="alpha" title="Early alpha: expect bugs and changes">Early alpha</span>'
def brand(wide=True):
    word = '<span class="word"><b>GL1F</b><span>Crypto</span></span>'
    text = (f'<span class="brand-top">{word}{ALPHA}</span><span class="powered">powered by GenesisL1</span>' if wide
            else f'{word}<span class="powered">powered by GenesisL1</span>{ALPHA}')
    return (f'<a class="brand{"" if wide else " stacked"}" href="./index.html" aria-label="GL1F Crypto, early alpha, powered by GenesisL1: home"><span class="mark"><img src="./assets/car-mark.svg?v={V}" alt="" width="48" height="15" /></span>'
            f'<span class="brand-text">{text}</span></a>')

def rail(current):
    def link(href, key, label, name):
        cur = ' aria-current="page"' if key == current else ""
        return f'<a href="{href}"{cur}>{icon(name)}<span>{label}</span></a>'
    return f'''<aside class="rail" aria-label="Primary">
    {brand(wide=True)}
    <div class="rail-cta"><a class="btn hype" href="./app.html" aria-label="Create Crypto AI model">{icon("plus", 18)}<span class="cta-text">Create Crypto AI model</span></a></div>
    <nav class="rail-nav" aria-label="Main">
      {link("./index.html", "home", "Home", "home")}
      {link("./app.html#dataset", "studio", "Studio", "studio")}
      {link("./market.html", "market", "Marketplace", "market")}
      {link("./market.html#all", "models", "Explore models", "models")}
      {link("./app.html#backtest", "backtest", "Backtest", "backtest")}
      {link("./app.html#infer", "infer", "Inference", "infer")}
    </nav>
    <div class="rail-label">Protocol</div>
    <nav class="rail-nav" aria-label="Protocol">
      {link("./docs.html#fees", "burn", "Burns &amp; fees", "burn")}
      {link("./docs.html#stats", "stats", "Live stats", "stats")}
      {link("./docs.html", "docs", "Docs", "docs")}
      {link("./api.html", "api", "Web3 API", "api")}
      {link("./index.html#learn", "learn", "Learn", "learn")}
    </nav>
    <div class="rail-foot">
      <div class="row"><span class="net"><span class="status">GenesisL1 EVM · 29</span></span></div>
      <div class="social"><a href="https://gl1f.com">GL1F</a><a href="https://github.com/GenesisL1">GitHub</a><a href="https://x.com/genesis_L1">X</a><a href="#" data-cookie-settings>Cookies</a></div>
    </div>
  </aside>'''

def bottom_nav(current):
    items = [("./index.html", "home", "Home", "home"), ("./app.html", "studio", "Create", "plus"), ("./market.html", "market", "Market", "market"), ("./docs.html", "docs", "Docs", "docs")]
    cur = ' aria-current="page"'
    return '<nav class="bottom-nav" aria-label="Mobile">' + "".join(
        f'<a href="{h}"{cur if k == current else ""}>{icon(i, 22)}<span>{l}</span></a>' for h, k, l, i in items) + "</nav>"

FOOTER = f'''<footer class="footer">
    <div class="footer-grid">
      <div>{brand(wide=True)}<p class="tagline">GenesisL1 EVM is your quant.</p><p style="max-width:40ch">No-code crypto AI models, from candles to chain: train in your browser, backtest with fees, run on-chain AI inference on GenesisL1.</p></div>
      <div><h4>Product</h4><a href="./app.html">Crypto AI model studio</a><a href="./market.html">Marketplace</a><a href="./index.html#monetization">Model monetization</a><a href="./api.html">Web3 API</a><a href="./docs.html">Docs</a><a href="./docs.html#stats">Live stats</a><a href="./legal/terms.html">Terms of Service</a></div>
      <div><h4>Learn</h4><a href="./index.html#how">How it works</a><a href="./index.html#questions">Example questions</a><a href="./index.html#learn">ML in five minutes</a><a href="./index.html#faq">FAQ</a></div>
      <div><h4>GenesisL1</h4><a href="https://gl1f.com">gl1f.com</a><a href="https://genesisl1.com">genesisl1.com</a><a href="https://roadmap.genesisl1.com">Roadmap</a><a href="https://explorer.genesisl1.org">Explorer</a><a href="https://github.com/GenesisL1">GitHub</a><a href="https://x.com/genesis_L1">X</a></div>
    </div>
    <div class="footer-share"><span>Share GL1F Crypto</span><a href="https://twitter.com/intent/tweet?text=Launch%20your%20own%20Crypto%20AI%20model%2C%20no%20code%2C%20on%20the%20GenesisL1%20EVM&amp;url=https%3A%2F%2Fcrypto.gl1f.com%2F&amp;hashtags=CryptoAI,GenesisL1" target="_blank" rel="noopener noreferrer">X</a><a href="https://t.me/share/url?url=https%3A%2F%2Fcrypto.gl1f.com%2F&amp;text=Launch%20your%20own%20Crypto%20AI%20model" target="_blank" rel="noopener noreferrer">Telegram</a><a href="https://wa.me/?text=Launch%20your%20own%20Crypto%20AI%20model%20https%3A%2F%2Fcrypto.gl1f.com%2F" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fcrypto.gl1f.com%2F" target="_blank" rel="noopener noreferrer">LinkedIn</a><button class="btn2 small" type="button" data-share data-share-url="https://crypto.gl1f.com/" data-share-text="Launch your own Crypto AI model: no code, on the GenesisL1 EVM.">Copy link</button></div>
    <p class="legal">GL1F Crypto is open-source, experimental data-science software for educational purposes, provided “as is”, without warranty of any kind; it may contain bugs, errors and imperfections, and no one is liable for any loss. Nothing here is investment advice. Trading involves serious risk of loss; models must not be used in live or automated setups. On-chain deployments are permanent and their protocol fees are burned. Binance, Coinbase and Hyperliquid are trademarks of their respective owners and are named only as public data sources. L1 coin is described only in its operational role as the unit GenesisL1 settles fees in. <a href="./docs.html#disclaimer">Full disclaimer</a> · <a href="./legal/terms.html">Terms of Service</a> · © 2026 Decentralized Science Labs · GenesisL1 Blockchain.</p>
    <p class="legal-links"><a href="./legal/terms.html">Terms of Service</a><a href="./legal/cookies.html">Cookie policy</a><a href="#" data-cookie-settings>Cookie settings</a><span class="ver">GL1F Crypto v{V}</span></p>
  </footer>'''

KEYWORDS = ("Crypto AI model, AI crypto trading model, no-code AI, machine learning crypto, on-chain AI, Crypto AI model NFT, "
            "Bitcoin AI prediction, Ethereum AI, Solana AI, memecoin AI, Hyperliquid AI, crypto backtest, walk-forward validation, "
            "gradient boosted trees, GenesisL1, EVM AI, decentralized AI, DeSci, GL1F")
def page(**kw):
    root = kw.get("root", "./")
    out = _page(**kw)
    return out if root == "./" else out.replace('="./', f'="{root}')

OG_ALT = {"api": "GL1F Crypto Web3 API: run any Crypto AI model on GenesisL1 from code", "home": "Launch your own Crypto AI model: GL1F Crypto, powered by GenesisL1", "studio": "Train, backtest and deploy Crypto AI models in the GL1F Crypto studio",
          "market": "Buy, sell and subscribe to Crypto AI models on the GL1F Crypto marketplace", "docs": "How GL1F Crypto runs Crypto AI models on-chain on GenesisL1"}
def _page(*, name, path, title, description, current, body, actions, scripts, head="", after="", og_type="website", ld=None, og_image=None, og_alt=None, root="./", keywords=None):
    # Every page: the runtime config (for the analytics ID) and the consent-first cookie notice.
    consent_scripts = ("" if "runtime-config.js" in scripts else f'  <script src="{root}runtime-config.js?v={V}"></script>\n') + f'  <script src="{root}assets/consent.js?v={V}"></script>\n'
    md_path = MD_MIRROR.get(path) or (path + "index.md" if re.fullmatch(r"m/\d+/", path) else None)
    md_link = f'  <link rel="alternate" type="text/markdown" href="{ORIGIN}{md_path}" title="Markdown version" />\n' if md_path else ""
    url = ORIGIN + path
    og = og_image or f"{ORIGIN}assets/og-{name}.jpg?v={V}"
    alt = html.escape(og_alt or OG_ALT[name])
    if ld: head = '  <script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", "@graph": ld}, ensure_ascii=False) + "</script>\n" + head
    return f'''<!doctype html>
<!-- MIT License — Copyright (c) 2026 Decentralized Science Labs. Generated by scripts/build_pages.py; edit src/pages/. -->
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(description)}" />
  <meta name="keywords" content="{html.escape(keywords or KEYWORDS)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="application-name" content="GL1F Crypto" />
  <meta name="gl1f-terms-version" content="{TERMS_VERSION}" />
  <meta name="apple-mobile-web-app-title" content="GL1F Crypto" />
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
  <meta name="color-scheme" content="light dark" />
  <link rel="canonical" href="{url}" />
{md_link}  <link rel="alternate" type="text/plain" href="{ORIGIN}llms.txt" title="Summary for language models" />
  <meta property="og:type" content="{og_type}" />
  <meta property="og:site_name" content="GL1F Crypto" />
  <meta property="og:title" content="{html.escape(title)}" />
  <meta property="og:description" content="{html.escape(description)}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{og}" />
  <meta property="og:image:secure_url" content="{og}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="{alt}" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@genesis_L1" />
  <meta name="twitter:title" content="{html.escape(title)}" />
  <meta name="twitter:description" content="{html.escape(description)}" />
  <meta name="twitter:image" content="{og}" />
  <meta name="twitter:image:alt" content="{alt}" />
  <meta name="twitter:creator" content="@genesis_L1" />
  <meta name="twitter:label1" content="Runs in" />
  <meta name="twitter:data1" content="Your browser, no code" />
  <meta name="twitter:label2" content="Chain" />
  <meta name="twitter:data2" content="GenesisL1 EVM · 29" />
  <link rel="image_src" href="{og}" />
  <link rel="icon" href="./favicon.ico?v={V}" sizes="48x48" />
  <link rel="icon" href="./assets/favicon.svg?v={V}" type="image/svg+xml" />
  <link rel="icon" href="./assets/favicon-32.png?v={V}" sizes="32x32" type="image/png" />
  <link rel="apple-touch-icon" href="./assets/apple-touch-icon.png?v={V}" />
  <link rel="manifest" href="./site.webmanifest" />
  <link rel="preload" href="{root}assets/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />
  <script src="./assets/theme.js?v={V}"></script>
  <link rel="stylesheet" href="./assets/gl1f.css?v={V}" />
{head}</head>
<body data-page="{name}">
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="shell">
  {rail(current)}
  <div class="main">
    <header class="topbar">
      {brand()}
      <span class="alpha topbar-alpha" aria-hidden="true">Early alpha</span>
      <form class="search" role="search" action="./app.html" method="get" data-search>
        {icon("search", 18)}<input name="m" type="search" placeholder="Build a Crypto AI model: ETH, SOL, HYPE, kPEPE, BTC-USD…" aria-label="Market for your Crypto AI model" autocomplete="off" spellcheck="false" enterkeyhint="go" /><kbd aria-hidden="true">/</kbd>
      </form>
      <div class="actions">{actions}</div>
    </header>
    <main id="main" class="page">
{body}
    {FOOTER}
    </main>
  </div>
  </div>
  {bottom_nav(current)}
{after}
{scripts}
{consent_scripts}</body>
</html>
'''

def q(emoji, venue, ex, m, c, d, move, stop, h, text):
    chips = [f"{'Up' if d == 'up' else 'Down'} {move}%", f"Stop {stop}%", f"{h}h"]
    href = f"./app.html?ex={ex}&amp;m={m}&amp;c={c}&amp;dir={d}&amp;move={move}&amp;stop={stop}&amp;h={h}&amp;hu=hours"
    return (f'<a class="card q-card lift" href="{href}"><div class="top"><span class="avatar" aria-hidden="true">{emoji}</span>'
            f'<span class="venue"><b>{m}</b>{venue} · {c}</span></div><p class="q">{text}</p>'
            f'<div class="chips">{"".join(f"<span>{x}</span>" for x in chips)}</div><span class="go">Build this model →</span></a>')
MAJORS = [q("📈", "Binance", "binance", "ETH", "15m", "up", 1, 0.5, 5, "Will ETH rise 1% before it drops 0.5% in the next 5 hours?"),
          q("🧱", "Binance", "binance", "BTC", "1h", "up", 1.5, 1, 12, "Is BTC about to push 1.5% higher before a 1% pullback, within half a day?"),
          q("🌡️", "Binance", "binance", "SOL", "1h", "down", 2, 1, 8, "When funding runs hot, does SOL cool off 2% before squeezing 1% higher?"),
          q("🏦", "Coinbase", "coinbase", "ETH-USD", "5m", "up", 0.8, 0.4, 2, "On Coinbase spot, does ETH-USD gain 0.8% before losing 0.4% within 2 hours?"),
          q("🌊", "Binance", "binance", "XRP", "4h", "down", 3, 1.5, 24, "Does XRP slide 3% before it bounces 1.5% over the next day?"),
          q("🔗", "Binance", "binance", "LINK", "1h", "up", 2, 1, 12, "Is LINK trending cleanly enough to add 2% before giving back 1%?")]
TRENCHES = [q("🐕", "Binance", "binance", "DOGE", "15m", "up", 5, 2, 6, "Will DOGE send 5% before it dumps 2% in the next 6 hours?"),
            q("🐸", "Binance", "binance", "1000PEPE", "5m", "up", 4, 2, 2, "Is this PEPE volume spike the start of a run, or the top?"),
            q("🧢", "Binance", "binance", "WIF", "15m", "up", 3, 1.5, 4, "Does WIF hold a pump into the New York session?"),
            q("🦴", "Binance", "binance", "1000BONK", "15m", "down", 6, 3, 8, "After a vertical candle, does BONK retrace 6% before squeezing 3% higher?"),
            q("🌋", "Binance", "binance", "DOGE", "15m", "down", 3, 1.5, 4, "When BTC dumps, do memes dump harder? DOGE −3% before +1.5%, within 4 hours."),
            q("🎰", "Binance", "binance", "1000SHIB", "1h", "up", 3, 1.5, 24, "Can SHIB do +3% before −1.5% by tomorrow, or is it just vibes?")]
HL = [q("⚡", "Hyperliquid", "hyperliquid", "HYPE", "15m", "up", 3, 1.5, 6, "Does HYPE rip 3% before it dips 1.5% within 6 hours?"),
      q("🐸", "Hyperliquid", "hyperliquid", "kPEPE", "15m", "up", 5, 2.5, 8, "Can kPEPE send 5% before a 2.5% flush in the next 8 hours?"),
      q("🧪", "Hyperliquid", "hyperliquid", "ETH", "1h", "up", 1.5, 1, 12, "With hourly funding in the mix, does ETH add 1.5% before losing 1%?"),
      q("🟠", "Hyperliquid", "hyperliquid", "BTC", "1h", "down", 1, 0.5, 6, "Does BTC drop 1% before it pops 0.5% within 6 hours?"),
      q("🌞", "Hyperliquid", "hyperliquid", "SOL", "15m", "up", 2, 1, 4, "Is SOL’s momentum good for +2% before −1% within 4 hours?"),
      q("🐶", "Hyperliquid", "hyperliquid", "DOGE", "15m", "up", 4, 2, 6, "Will DOGE pump 4% before it dumps 2% in 6 hours on Hyperliquid?")]
MARKETS = [("BTC", "binance"), ("ETH", "binance"), ("SOL", "binance"), ("HYPE", "hyperliquid"), ("kPEPE", "hyperliquid"), ("DOGE", "binance"), ("WIF", "binance"),
           ("XRP", "binance"), ("1000BONK", "binance"), ("LINK", "binance"), ("BTC-USD", "coinbase"), ("ETH-USD", "coinbase"), ("AVAX", "binance"), ("SUI", "binance"), ("ENA", "binance"), ("TAO", "binance")]
def ticker():
    one = "".join(f'<a href="./app.html?ex={ex}&amp;m={m}">{m}<span>{ex.upper()}</span></a>' for m, ex in MARKETS)
    two = "".join(f'<a href="./app.html?ex={ex}&amp;m={m}" tabindex="-1" aria-hidden="true">{m}<span>{ex.upper()}</span></a>' for m, ex in MARKETS)
    return one + two
FAQ = [
    ("Which signals can a Crypto AI model use?", "274 signals: 212 from the market itself (returns, trend, volatility, volume and taker flow, funding, BTC context) and 62 world signals: US and Asian holidays, Fed decision days, elections and expiries; Moon phases, Mercury, Venus and Mars retrogrades and planetary alignment; Treasury yields, the Fed funds rate, oil and natural gas, the dollar, VIX, the S&P 500, gold, inflation and unemployment; earthquakes, tropical storms and war attention. They load live in the browser, with years of history behind each one, and nothing to install. Every value uses only what was known when the candle closed. The full list is at signals.txt."),
    ("What is a Crypto AI model?", "A machine-learning model that reads market signals such as recent returns, volatility, volume, funding and how Bitcoin is moving, and outputs the probability that your yes-or-no question comes true, for example: will ETH rise 1% before it drops 0.5% in the next 5 hours? GL1F Crypto builds it from exchange candles with gradient-boosted decision trees."),
    ("Can AI predict crypto prices?", "Sometimes a little, often not at all. Markets are noisy, and most patterns are weak or vanish after fees. That is why every Crypto AI model here is tested walk-forward on data it never saw and backtested with costs, and why the honest answer can be: no edge."),
    ("Is this an AI trading bot?", "No. GL1F Crypto is an educational Crypto AI model builder. It never places trades, never connects to exchange accounts or funds, and its Crypto AI models must not be used for live or automated trading."),
    ("What makes it on-chain AI?", "The Crypto AI model is stored on GenesisL1 as an Crypto AI Model NFT, and its inference runs as integer math inside the EVM, so anyone can recompute a prediction on-chain and get exactly the score your browser shows. GenesisL1 EVM is your quant."),
    ("What is GL1F Crypto?", "A free, open-source crypto AI studio that turns a market question into a machine-learning Crypto AI model. It downloads completed candles from Binance, Coinbase or Hyperliquid, trains gradient-boosted trees in your browser, backtests them with fees, and can mint the Crypto AI model as an Crypto AI Model NFT on GenesisL1 so anyone can verify its predictions."),
    ("Do I need to code or know machine learning?", "No. Every field has a question mark with a plain-language explanation, and the defaults are sensible. You pick a coin, a target move, a stop and a time window; the studio does the rest."),
    ("Will it make me money?", "Nobody can promise that, and we don't. GL1F Crypto is educational, experimental software. Most market patterns are weak and many disappear after fees. Crypto AI models must not be used for live trading. Crypto trading can lose you all of your money."),
    ("Where does my data go?", "Nowhere. Candles are fetched straight from the exchange's public API into your browser, and training runs locally. Only deploying a model sends a transaction to GenesisL1."),
    ("What happens to deployment fees?", "The model creation fee and the per-byte storage fee stay in the registry contract, and anyone can burn them to an unspendable address with one public call. No one, including the deployer, can withdraw them."),
    ("Why does my Crypto AI model look great in training and bad in the backtest?", "That is usually overfitting, fees, or both, and it's exactly what the backtest is for. Try a simpler Crypto AI model (fewer trees, lower depth), turn on heuristic search, pick a bigger target or a longer candle, or accept that this question has no edge."),
    ("Why does Hyperliquid start at 15-minute candles?", "Its public API keeps only the latest 5,000 candles per size. The signals need 22 days of warm-up history, which smaller candles can't cover, so the studio starts at 15m and sets the earliest possible start date for you."),
    ("Can I use someone else's Crypto AI model?", "Yes. Published Crypto AI models can be run on the latest candle or any past moment and their scores verified on-chain; paid ones offer a fee per run or a subscription. Each shows the license it was published under."),
    ("Which license does a Crypto AI model NFT have?", "The one its creator picked when minting it, from a catalog of standard licenses stored on GenesisL1: public domain (such as CC0), permissive (such as MIT, Apache 2.0, CC BY 4.0 or OpenMDW, made for machine-learning models), share-alike (such as CC BY-SA 4.0, GPL or ODbL) or restricted (non-commercial or no changes). The default is CC BY-SA 4.0. The license is written on-chain at mint; later its admin can only open it up or move it to a later version, even after a sale."),
    ("Can someone copy a model from the chain?", "Technically yes: every model's bytes are public on GenesisL1. Legally it depends on the model's license. Open licenses allow copying; the GL1F On-Chain Use License, preselected for paid models, reserves all rights and allows use only through GenesisL1 on the admin's terms. The Terms of Service bind every user of the app and the contracts to respect each model's license."),
]
def faq_html():
    return "".join(f"<details><summary>{html.escape(a)}</summary><p>{html.escape(b)}</p></details>" for a, b in FAQ)
ORG = {"@type": "Organization", "@id": "https://genesisl1.com/#org", "name": "GenesisL1", "url": "https://genesisl1.com", "logo": ORIGIN + "assets/icon-512.png",
       "sameAs": ["https://x.com/genesis_L1", "https://github.com/GenesisL1", "https://gl1f.com"]}
APP = {"@type": "SoftwareApplication", "@id": ORIGIN + "#app", "name": "GL1F Crypto: Crypto AI model builder", "url": ORIGIN + "app.html",
       "applicationCategory": "FinanceApplication", "softwareVersion": f"{V} (early alpha)", "applicationSubCategory": "Crypto AI model builder", "operatingSystem": "Web browser", "isAccessibleForFree": True,
       "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}, "publisher": {"@id": "https://genesisl1.com/#org"},
       "description": "No-code crypto AI: build a dataset from Binance, Coinbase or Hyperliquid candles, train a machine-learning Crypto AI model with walk-forward validation and heuristic search, backtest it with fees, mint it as an Crypto AI Model NFT and run on-chain AI inference on the GenesisL1 EVM. Educational software; not financial advice.",
       "featureList": ["No-code Crypto AI model training in the browser", "Binance, Coinbase and Hyperliquid market data", "212 causal market signals", "62 world signals: holidays, Fed decisions and elections, Moon and planets, macro, disasters and war",
                       "Walk-forward validation with 2 to 20 folds", "Heuristic hyperparameter search and live training chart", "Backtests with fees, slippage and stops",
                       "Crypto AI Model NFT on GenesisL1", "Verifiable on-chain AI inference", "Protocol fees burnable by anyone", f"One license per Crypto AI model NFT, chosen from {LIC_COUNT} standard licenses"],
       "keywords": KEYWORDS}
def crumbs(*items):
    return {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": ORIGIN + u} for i, (n, u) in enumerate(items)]}
HOME_LD = [ORG,
    {"@type": "WebSite", "@id": ORIGIN + "#site", "url": ORIGIN, "name": "GL1F Crypto", "alternateName": "GL1F Crypto AI", "publisher": {"@id": "https://genesisl1.com/#org"},
     "potentialAction": {"@type": "SearchAction", "target": {"@type": "EntryPoint", "urlTemplate": ORIGIN + "app.html?m={search_term_string}"}, "query-input": "required name=search_term_string"}},
    APP,
    {"@type": "HowTo", "name": "How to build a Crypto AI model without code", "totalTime": "PT15M",
     "step": [{"@type": "HowToStep", "position": i + 1, "name": n, "text": t, "url": ORIGIN + "app.html#" + a} for i, (n, t, a) in enumerate([
         ("Build a dataset", "Pick Binance, Coinbase or Hyperliquid, a coin, a candle size and a yes-or-no question; the studio turns completed candles into signals and labels.", "dataset"),
         ("Train the Crypto AI model", "Gradient-boosted trees learn from the past, walk-forward validation tests them on the future, and optional heuristic search tunes the settings.", "train"),
         ("Backtest it", "Replay history with fees, slippage and stops to see the equity curve, drawdown and win rate.", "backtest"),
         ("Deploy on-chain", "Mint the Crypto AI model as an Crypto AI Model NFT on GenesisL1; protocol fees are burnable by anyone.", "deploy"),
         ("Run AI inference", "Score the latest candle or any past moment and verify the result on-chain.", "infer")])]},
    {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": a, "acceptedAnswer": {"@type": "Answer", "text": b}} for a, b in FAQ]}]
STUDIO_LD = [ORG, APP, crumbs(("GL1F Crypto", ""), ("Crypto AI model studio", "app.html"))]
MARKET_LD = [ORG, {"@type": "CollectionPage", "name": "Crypto AI model marketplace", "url": ORIGIN + "market.html", "isPartOf": {"@id": ORIGIN + "#site"},
                   "about": ["Crypto AI model NFTs", "model monetization", "subscription plans", "GenesisL1"], "publisher": {"@id": "https://genesisl1.com/#org"}},
             crumbs(("GL1F Crypto", ""), ("Marketplace", "market.html"))]
DOCS_LD = [ORG, {"@type": "TechArticle", "headline": "GL1F Crypto docs: on-chain Crypto AI model contracts, burnable fees and methodology", "url": ORIGIN + "docs.html",
                 "about": ["Crypto AI model", "on-chain AI", "walk-forward validation", "GenesisL1"], "publisher": {"@id": "https://genesisl1.com/#org"}, "inLanguage": "en"},
           crumbs(("GL1F Crypto", ""), ("Docs", "docs.html"))]

def licenses_html():
    out = []
    for g in LIC["groups"]:
        rows = [(n + 1, l) for n, l in enumerate(LIC["licenses"]) if l["group"] == g["id"]]
        if not rows: continue
        trs = ""
        for n, l in rows:
            cls = ' class="is-default"' if l["spdx"] == LIC["default"] else ""
            trs += (f'<tr data-lic="{html.escape(l["spdx"])}"{cls}><td>{n}</td><td><a href="{html.escape(l["url"])}" target="_blank" rel="noopener noreferrer" title="{html.escape(l["title"])}">{html.escape(l["name"])}</a>'
                    f'<span class="tag def">default</span></td><td><code>{html.escape(l["spdx"])}</code></td><td>{html.escape(l["summary"])}</td></tr>')
        out.append(f'<h3>{html.escape(g["title"])}</h3><p class="small muted">{html.escape(g["summary"])}</p>'
                   f'<div class="table-scroll"><table class="tbl lic-table"><tr><th>#</th><th>License</th><th>SPDX</th><th>In short</th></tr>{trs}</table></div>')
    return "".join(out)

def md(src):
    """Small Markdown subset for the legal texts: headings, paragraphs, lists, bold, code and links."""
    def inline(t):
        t = html.escape(t, quote=False)
        t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
        t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
        return re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', t)
    out, para, items, kind = [], [], [], None
    def flush():
        nonlocal para, items, kind
        if para: out.append(f"<p>{inline(' '.join(para))}</p>"); para = []
        if items: out.append(f"<{kind}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{kind}>"); items, kind = [], None
    for raw in src.splitlines():
        line = raw.strip(); h = re.match(r"(#{1,3}) (.+)", line); li = re.match(r"(?:- |\d+\. )(.+)", line)
        if not line: flush()
        elif h: flush(); out.append(f"<h{len(h.group(1))}>{inline(h.group(2))}</h{len(h.group(1))}>")
        elif li:
            k = "ul" if line.startswith("- ") else "ol"
            if para or (kind and kind != k): flush()
            kind = k; items.append(li.group(1))
        else:
            if items: flush()
            para.append(line)
    flush()
    return "\n".join(out)

def fill(text):
    return text.replace("{{V}}", V)

home_body = fill((SRC / "home.body.html").read_text()).replace("{{TICKER}}", ticker()).replace("{{FAQ}}", faq_html())
home_body = home_body.replace("{{Q_MAJORS}}", "".join(MAJORS)).replace("{{Q_TRENCHES}}", "".join(TRENCHES)).replace("{{Q_HL}}", "".join(HL))
common_scripts = f'  {ETHERS}\n  <script src="./runtime-config.js?v={V}"></script>\n'
pages = {
    "index.html": page(name="home", path="", current="home",
        title="GL1F Crypto: build your own Crypto AI model, no code | On-chain AI on GenesisL1",
        description="No-code crypto AI: turn a trading question into your own Crypto AI model in minutes. Pull Bitcoin, Ethereum, Solana, memecoin or Hyperliquid candles, train a machine-learning Crypto AI model in your browser, backtest it with fees and mint it as an on-chain Crypto AI model on GenesisL1. Educational, not financial advice.",
        body=home_body, ld=HOME_LD,
        actions=f'{SHARE}{THEME}<a class="btn primary small hide-sm" href="./app.html">Create Crypto AI model</a>',
        scripts=common_scripts + f'  <script src="./js/home.js?v={V}"></script>'),
    "app.html": page(name="studio", path="app.html", current="studio",
        title="Crypto AI model studio: train, backtest and deploy AI trading models | GL1F Crypto",
        description="Build a Crypto AI model in five steps: Binance, Coinbase or Hyperliquid candles, Crypto AI model training with walk-forward validation, heuristic search and a live chart, backtests with fees, an Crypto AI Model NFT on GenesisL1 and verifiable on-chain AI inference. Free, no code. Educational, not financial advice.", ld=STUDIO_LD,
        body=fill((SRC / "studio.body.html").read_text()), after=(SRC / "studio.modal.html").read_text(),
        actions=f'{SHARE}{THEME}<span class="pill hide-sm" id="walletPill">Not connected</span><button class="btn small connect-btn" type="button" id="connectBtn" aria-label="Connect wallet" title="Connect wallet" data-state="off"><svg class="connect-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg><span class="connect-txt">Connect</span></button>',
        scripts=common_scripts + f'  <script src="./js/studio.js?v={V}"></script>'),
    "market.html": page(name="market", path="market.html", current="market",
        title="Crypto AI model marketplace: buy, sell and subscribe | GL1F Crypto on GenesisL1",
        description="Marketplace for Crypto AI models on GenesisL1. Buy and sell Crypto AI Model NFTs, subscribe to paid models, and manage your own: the owner is the model admin who sets access, fees and subscription plans. Protocol fees are burnable by anyone. Educational, not financial advice.", ld=MARKET_LD,
        body=fill((SRC / "market.body.html").read_text()),
        actions=f'{SHARE}{THEME}<a class="btn primary small hide-sm" href="./app.html">Create Crypto AI model</a>',
        scripts=common_scripts + f'  <script src="./js/market.js?v={V}"></script>'),
    "api.html": page(name="api", path="api.html", current="api", og_type="article",
        title="GL1F Crypto Web3 API: run Crypto AI models on GenesisL1 from code",
        description="Call any Crypto AI model on GenesisL1 from JavaScript or Node: free reads, access keys with subscription plans, pay per run, the market engine for live inputs, and a full reference.",
        body=fill((SRC / "api.body.html").read_text()),
        actions=f'{SHARE}{THEME}<a class="btn primary small hide-sm" href="./app.html#infer">Try in the studio</a>',
        scripts=common_scripts),
    "docs.html": page(name="docs", path="docs.html", current="docs", og_type="article",
        title="GL1F Crypto docs: on-chain Crypto AI model contracts, burnable fees and methodology",
        description="How the Crypto AI model builder works: GenesisL1 EVM contracts for on-chain Crypto AI models, creation and per-byte fees anyone can burn, live Crypto AI model stats, market data, walk-forward validation, heuristic search, backtest rules and the full disclaimer.", ld=DOCS_LD,
        body=fill((SRC / "docs.body.html").read_text()).replace("{{LICENSES}}", licenses_html()).replace("{{LIC_DEFAULT}}", LIC_DEFAULT).replace("{{SPDX_VERSION}}", SPDX_VER).replace("{{TERMS_VERSION}}", str(TERMS_VERSION)),
        actions=f'{SHARE}{THEME}<a class="btn primary small hide-sm" href="./app.html">Create Crypto AI model</a>',
        scripts=common_scripts + f'  <script src="./js/docs.js?v={V}"></script>'),
}
MODELS = json.loads((SITE / "m" / "models.json").read_text())["models"] if (SITE / "m" / "models.json").exists() else []
COPY_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'
FINEPRINT = '<p class="fineprint"><span aria-hidden="true">⚠</span><span><strong>Educational, experimental software.</strong> Not investment advice. A Crypto AI model estimates a probability; it can be wrong, and trading can lose you everything. Blockchain transactions are final.</span></p>'
def model_article():
    """The model page, model.html?id=<n>, drawn from the chain by js/model.js. The question leads; the run, the access
    and sale, sharing and the details sit on one grid of the same width, with a sticky sidebar on wide screens."""
    links = "".join(f'<a data-mp-share="{k}" href="#" target="_blank" rel="noopener noreferrer">{n}</a>' for k, n in [("x", "X"), ("telegram", "Telegram"), ("whatsapp", "WhatsApp"), ("linkedin", "LinkedIn")])
    return f'''<article class="model-page" data-model-page data-root="./" data-token="" data-dynamic="1">
<nav class="mp-crumbs" aria-label="Breadcrumb"><a href="./market.html">Marketplace</a><span aria-hidden="true">/</span><a class="mp-crumb-mid" href="./market.html#all">Crypto AI models</a><span class="mp-crumb-mid" aria-hidden="true">/</span><span id="mp-num" aria-current="page">Crypto AI model</span></nav>
<header class="mp-hero">
  <div class="mp-icon" id="mp-icon"><div class="model-icon ph" aria-hidden="true"></div></div>
  <div class="mp-head">
    <p class="mp-name"><span id="mp-title">Crypto AI model</span><span class="mp-symbol" id="mp-market-label"></span></p>
    <h1 id="mp-question">Crypto AI model</h1>
    <p class="lead" id="mp-lead">Reading this model from GenesisL1…</p>
    <div class="mp-meta" id="mp-meta"><span class="mp-buy" id="mp-buy" hidden></span></div>
  </div>
</header>
<div class="alert mp-error" id="mp-error" role="alert" hidden></div>
<div class="mp-layout">
  <section class="card mp-ask" aria-labelledby="mp-run-h">
    <div class="mp-card-head"><h2 id="mp-run-h">Ask the model</h2><span class="mp-pill" id="mp-run-pill">Free · no wallet, no gas</span></div>
    <p class="mp-desc" id="mp-run-desc">It answers the question above for the latest completed candle: your browser computes the inputs from public exchange data, and the model answers on GenesisL1.</p>
    <div class="mp-thr" role="group" aria-labelledby="mp-thr-label">
      <span class="mp-thr-label" id="mp-thr-label">Answer <b>Yes</b> when the probability is</span>
      <label class="mp-thr-field">from <input id="mp-thr" type="number" min="0" max="1" step="0.01" value="0.50" inputmode="decimal" /></label>
      <label class="mp-thr-field">to <input id="mp-thr-max" type="number" min="0" max="1" step="0.01" value="1.00" inputmode="decimal" /></label>
      <button class="mp-thr-reset" type="button" id="mp-thr-reset" hidden>Reset</button>
      <span class="mp-thr-note" id="mp-thr-note" aria-live="polite">The default: Yes at 50% or more.</span>
    </div>
    <div class="mp-run-row"><button class="btn hype lg" type="button" id="mp-run-btn">Run on the latest candle</button><span class="small muted" id="mp-run-note"></span></div>
    <div class="mp-result" id="mp-result" aria-live="polite"><p class="mp-result-empty">The answer appears here: <b>Yes</b> or <b>No</b>, with the probability the model gives it.</p></div>
  </section>
  <aside class="mp-side">
    <section class="card mp-market" id="mp-market" aria-labelledby="mp-market-h">
      <div class="mp-card-head"><h2 id="mp-market-h">Access and sale</h2></div>
      <div id="mp-market-body"><p class="small muted">Reading the live status from GenesisL1…</p></div>
      <p class="small mp-status" id="mp-status" aria-live="polite" hidden></p>
      <div class="mp-wallet-row"><button class="btn2 small" type="button" id="mp-wallet">Connect wallet</button><button class="change-wallet" type="button" data-change-wallet hidden>Change wallet</button></div>
    </section>
    <section class="card mp-share" aria-labelledby="mp-share-h">
      <div class="mp-card-head"><h2 id="mp-share-h">Share</h2><span class="mp-copied" id="mp-copied" hidden>Link copied</span></div>
      <div class="mp-link"><span class="mp-url" id="mp-url"></span><button class="mp-copy" type="button" id="mp-copy" aria-label="Copy link to this model" title="Copy link">{COPY_SVG}</button></div>
      <div class="mp-share-links">{links}</div>
    </section>
  </aside>
  <section class="card mp-about" aria-labelledby="mp-about-h">
    <h2 id="mp-about-h">About this model</h2>
    <dl class="mp-dl" id="mp-spec"></dl>
  </section>
  <section class="card mp-admin" id="mp-admin" hidden></section>
</div>
<nav class="mp-links" aria-label="More"><a class="btn2" id="mp-studio" href="./app.html#infer">Open in the studio</a><a class="btn2" href="./market.html">Marketplace</a><a class="btn2" href="./market.html#all">All Crypto AI models</a></nav>
{FINEPRINT}
</article>'''
pages["model.html"] = page(name="market", path="model.html", current="market", title="Crypto AI model | GL1F Crypto",
        description="A Crypto AI model on GL1F Crypto: run it on the latest candle, see its access and price, share it.",
        body=model_article(),
        actions=f'{SHARE}{THEME}<a class="btn primary small hide-sm" href="./app.html">Create Crypto AI model</a>', scripts=common_scripts + f'  <script src="./js/model.js?v={V}"></script>')
pages["404.html"] = page(name="home", path="404.html", current="", title="Page not found | GL1F Crypto", description="This page does not exist on GL1F Crypto.",
        head='  <base href="/" />\n  <meta name="robots" content="noindex" />\n  <script>(function () { var m = location.pathname.match(/\\/m\\/(\\d+)\\/?(index\\.html)?$/); if (m) location.replace(location.pathname.slice(0, m.index + 1) + "model.html?id=" + m[1]); else if (/\\/m\\/(page\\/\\d+\\/)?$/.test(location.pathname)) location.replace("/market.html#all"); })();</script>\n',
        body='<div class="app-head"><div><div class="eyebrow"><span class="status">404</span><span>Not found</span></div><h1>This page <span class="serif hype-text">does not exist.</span></h1><p>Go to the <a href="./">home page</a>, the <a href="./market.html">marketplace</a> or <a href="./market.html#all">all Crypto AI models</a>.</p></div></div>',
        actions=f'{SHARE}{THEME}', scripts=f'  <script src="./js/site.js?v={V}"></script>')

for src, out_html, out_txt, title, description in LEGAL:
    text = (ROOT / src).read_text()
    body = f'<article class="legal-doc">{md(text)}<p class="legal-meta">Plain-text copy: <a href="./{out_txt}">{out_txt.rsplit("/", 1)[1]}</a></p></article>'
    pages[out_html] = page(name="docs", path=out_html, current="docs", title=title, description=description, body=body, root="../", og_alt=title.split(" | ")[0],
                           actions=f'{SHARE}{THEME}<a class="btn primary small hide-sm" href="./app.html">Create Crypto AI model</a>', scripts=f'  <script src="./js/site.js?v={V}"></script>')
    (SITE / out_txt).parent.mkdir(parents=True, exist_ok=True)
    (SITE / out_txt).write_text(text)
for name, text in pages.items():
    (SITE / name).parent.mkdir(parents=True, exist_ok=True)
    (SITE / name).write_text(text)
BOTS_PREVIEW = ["TelegramBot", "Twitterbot", "facebookexternalhit", "Facebot", "LinkedInBot", "Slackbot", "Slackbot-LinkExpanding", "Discordbot", "WhatsApp", "Applebot", "redditbot", "Pinterestbot", "SkypeUriPreview"]
BOTS_SEARCH_AI = ["Googlebot", "Bingbot", "DuckDuckBot", "YandexBot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai",
                  "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Meta-ExternalAgent", "Amazonbot", "DuckAssistBot", "MistralAI-User", "cohere-ai", "CCBot"]
(SITE / "robots.txt").write_text("# GL1F Crypto: search engines, AI assistants and link previews are welcome.\n# Summary for language models: " + ORIGIN + "llms.txt (everything in one file: " + ORIGIN + "llms-full.txt)\n"
    "User-agent: *\nAllow: /\n\n# Link previews (Telegram, X, Facebook, LinkedIn, Slack, Discord, WhatsApp, iMessage, Reddit)\n"
    + "".join(f"User-agent: {bot}\nAllow: /\n" for bot in BOTS_PREVIEW) + "\n# Search engines and AI assistants\n"
    + "".join(f"User-agent: {bot}\nAllow: /\n" for bot in BOTS_SEARCH_AI) + "\nSitemap: " + ORIGIN + "sitemap.xml\n")
(SITE / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
    f"  <url><loc>{ORIGIN}{u}</loc><lastmod>{LASTMOD}</lastmod><changefreq>{c}</changefreq><priority>{p}</priority></url>\n" for u, c, p in [("", "weekly", "1.0"), ("app.html", "weekly", "0.9"), ("api.html", "monthly", "0.7"), ("market.html", "daily", "0.8"), ("docs.html", "monthly", "0.7"), ("legal/terms.html", "yearly", "0.4"), ("legal/onchain-use-1.0.html", "yearly", "0.4"), ("legal/cookies.html", "yearly", "0.3"), ("llms.txt", "monthly", "0.3"), ("llms-full.txt", "monthly", "0.3")] + ([("m/", "daily", "0.7")] if MODELS else [])) + "</urlset>\n")
SUMMARY = ("GL1F Crypto is a no-code crypto AI model builder on GenesisL1, an EVM Layer 1 blockchain (chain id 29). In the browser you build a dataset "
           "from Binance, Coinbase or Hyperliquid candles, train a gradient-boosted tree model with walk-forward validation, backtest it with fees, "
           "slippage and leverage, publish it as a Crypto AI model NFT and run inference that anyone can verify on-chain. Early alpha, educational, "
           "not financial advice.")
HOWTO = next(x for x in HOME_LD if x.get("@type") == "HowTo")["step"]

class HtmlToMd(HTMLParser):
    """Page HTML to readable Markdown: headings, paragraphs, lists, links, emphasis, code and tables; skips controls and hidden parts."""
    SKIP, VOID = {"script", "style", "svg", "button", "select", "option", "canvas", "noscript", "template", "textarea", "dialog", "form"}, {"br", "img", "hr", "input", "meta", "link", "source", "wbr", "col"}
    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base, self.out, self.skip, self.lists, self.href, self.cell, self.row, self.table = base, [], 0, [], [], None, None, None
    def w(self, text): (self.cell if self.cell is not None else self.out).append(text)
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in self.VOID:
            if not self.skip and tag == "br": self.w("\n")
            return
        if self.skip or tag in self.SKIP or a.get("aria-hidden") == "true" or "hidden" in a: self.skip += 1; return
        if tag in ("h1", "h2", "h3", "h4"): self.w("\n\n" + "#" * int(tag[1]) + " ")
        elif tag in ("ul", "ol"): self.lists.append([tag, 0]); self.w("\n")
        elif tag == "li":
            if not self.lists: self.lists.append(["ul", 0])
            self.lists[-1][1] += 1
            self.w("\n" + "  " * (len(self.lists) - 1) + ("- " if self.lists[-1][0] == "ul" else f"{self.lists[-1][1]}. "))
        elif tag == "a": self.href.append(a.get("href")); self.w("[")
        elif tag in ("strong", "b"): self.w("**")
        elif tag in ("em", "i"): self.w("*")
        elif tag == "code": self.w("`")
        elif tag == "table": self.table = []
        elif tag == "tr": self.row = []
        elif tag in ("td", "th"): self.cell = []
        elif tag in ("p", "div", "section", "article", "header", "aside", "figure", "blockquote", "details", "summary", "dl", "dt", "dd"): self.w("\n\n")
    def handle_endtag(self, tag):
        if tag in self.VOID: return
        if self.skip: self.skip -= 1; return
        if tag in ("h1", "h2", "h3", "h4"): self.w("\n\n")
        elif tag in ("ul", "ol"):
            if self.lists: self.lists.pop()
            self.w("\n\n")
        elif tag == "a":
            href = self.href.pop() if self.href else None
            self.w(f"]({urljoin(self.base, href)})" if href and not href.startswith("javascript:") else "]")
        elif tag in ("strong", "b"): self.w("**")
        elif tag in ("em", "i"): self.w("*")
        elif tag == "code": self.w("`")
        elif tag in ("td", "th") and self.cell is not None:
            text = re.sub(r"\s+", " ", "".join(self.cell)).strip().replace("|", "\\|")
            self.cell = None
            if self.row is not None: self.row.append(text)
        elif tag == "tr" and self.row is not None:
            if self.table is not None: self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table:
            head, *rows = self.table
            self.out.append("\n\n| " + " | ".join(head) + " |\n|" + "---|" * len(head) + "\n" + "".join("| " + " | ".join(r) + " |\n" for r in rows) + "\n")
            self.table = None
        elif tag in ("p", "div", "section", "article", "aside", "blockquote", "dd"): self.w("\n\n")
    def handle_data(self, data):
        if self.skip: return
        text = re.sub(r"\s+", " ", data)
        if text.strip() or (self.out and not self.out[-1].endswith(("\n", " "))): self.w(text)

def html_to_md(fragment, base):
    p = HtmlToMd(base); p.feed(fragment); p.close()
    md = re.sub(r"[ \t]+\n", "\n", "".join(p.out))
    md = re.sub(r"\n[ \t]+(?=[^\s-])", "\n", md)
    return re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"

def links_md():
    return (f"## Links\n\n- [Studio]({ORIGIN}app.html): build, backtest and publish a Crypto AI model ([Markdown]({ORIGIN}app.md))\n"
            f"- [Marketplace]({ORIGIN}market.html): published Crypto AI model NFTs ([Markdown]({ORIGIN}market.md))\n- [Docs]({ORIGIN}docs.html) ([Markdown]({ORIGIN}docs.md))\n"
            f"- [MCP server for AI agents]({ORIGIN}api.html#mcp): {ORIGIN}mcp (Streamable HTTP, no key), tools list_models, get_model, ask_model and trading_rules\n"
            f"- [Yes threshold]({ORIGIN}docs.html#threshold): a model's answer is yes when threshold <= P <= threshold_max (defaults 0.5 and 1)\n"
            f"- [Terms of Service]({ORIGIN}legal/terms.html) ([Markdown]({ORIGIN}legal/terms.md))\n- [GL1F On-Chain Use License]({ORIGIN}legal/onchain-use-1.0.html) ([Markdown]({ORIGIN}legal/onchain-use-1.0.md))\n"
            f"- [Everything in one file]({ORIGIN}llms-full.txt)\n- [Source code](https://github.com/GenesisL1/gl1f-crypto) (MIT)\n")

FACTS = f"""- Chain: GenesisL1, EVM Layer 1, chain id 29, live since 2021
- Model format: GL1F integer tree ensembles (gradient-boosted trees); the same integer score in the browser and inside the EVM
- Data: Binance, Coinbase and Hyperliquid candles fetched by the browser; only completed candles, frozen to the exchange's server time
- Signals: 274 in all: 212 from market data (momentum, volatility, volume, funding, BTC context) and 62 world signals (holidays and events, astronomy, macro and markets, disasters and conflict); list at {ORIGIN}signals.txt
- Validation: walk-forward folds (2 to 20), expanding or rolling windows, and a final test set kept locked until the end
- Backtests: entries at the next candle's open, fees, slippage, stops, leverage from 1x to 100x, liquidation and account ruin
- Crypto AI model NFTs: one per published model; its holder is the model admin; access is free, tips, a fee per inference, or subscriptions
- Licenses: every model carries the license its creator chose at mint, from {LIC_COUNT} standard licenses (SPDX License List {SPDX_VER}); default {LIC_DEFAULT}; paid models default to the GL1F On-Chain Use License (all rights reserved, use only through GenesisL1); a model's admin can only open its license up or move it to a later version
- Terms of Service: version {TERMS_VERSION}, stored in full on-chain; the registry owner publishes new versions and users accept them in the app
- Fees: protocol fees (model creation, per-byte storage, listing) are burned; creator income goes to the model admin
- Admin: the registry and marketplace owners set protocol fees, terms and the license catalog; ownership moves in two steps and can go to a multisig; nobody can withdraw protocol fees
- Status: early alpha; educational; not financial advice; not for live or automated trading
- Source: https://github.com/GenesisL1/gl1f-crypto (MIT)
"""

def index_md():
    steps = "".join(f"{i + 1}. **{s['name']}:** {s['text']}\n" for i, s in enumerate(HOWTO))
    faq = "".join(f"### {q}\n\n{a}\n\n" for q, a in FAQ)
    return (f"# GL1F Crypto: launch your own Crypto AI model\n\n> {SUMMARY}\n\n## Build a Crypto AI model in five steps\n\n{steps}\n"
            "## What a Crypto AI model answers\n\nA yes-or-no question about the next hours or days on one market, for example: "
            "\"Will ETH rise 1% before it drops 0.5% within 5 hours?\" or \"Will DOGE drop 7% within the next 2 days?\". "
            "It answers with a probability, computed by the same integer math in the browser and in the GenesisL1 EVM, so anyone can check a prediction on-chain.\n\n"
            f"## Key facts\n\n{FACTS}\n## Questions and answers\n\n{faq}{links_md()}")

def app_md():
    steps = "".join(f"### {i + 1}. {s['name']}\n\n{s['text']}\n\n" for i, s in enumerate(HOWTO))
    return (f"# GL1F Crypto Studio: build a Crypto AI model without code\n\n> The studio runs entirely in your browser: market data comes straight from the exchange, "
            "training and backtests run on your device, and nothing is uploaded until you choose to publish.\n\n"
            f"Open it at {ORIGIN}app.html. Every step has help texts; the first visit asks you to accept the Terms of Service.\n\n## The five steps\n\n{steps}"
            "## Saving and publishing\n\n- Save any trained model as a `.gl1f` file and load it again later.\n"
            "- Publishing stores the model on GenesisL1 and mints its Crypto AI model NFT. You choose its access (free, tips, a fee per inference, subscriptions) and its license. "
            "Paid models start with the GL1F On-Chain Use License, which reserves all rights; an open license on a paid model shows a warning.\n"
            "- Every published model has its own page, model.html?id=<n>, drawn live from GenesisL1.\n\n"
            "## Licenses in the studio\n\nThe studio runs a published model on your device only when its license allows it. Models under the GL1F On-Chain Use License run in the browser "
            "only for their admin, active subscribers, or anyone while the model is free to run.\n\n" + links_md())

def market_md():
    return (f"# GL1F Crypto Marketplace: Crypto AI model NFTs\n\n> Published Crypto AI models on GenesisL1, each one an NFT. Run them, subscribe to paid ones, buy and sell them.\n\n"
            "## Access modes\n\n- **Free:** anyone runs the model.\n- **Tips:** anyone runs it; payments are optional.\n"
            "- **Paid:** a fee per inference, and optionally subscription plans that give an address access for a number of blocks.\n\n"
            "## The model admin\n\nThe holder of a model NFT is its admin: it sets access, fees, the fee recipient and subscription plans, can pause inference and can list the NFT for sale. "
            "A buyer becomes the new admin, and creator income follows the NFT: a fee recipient set by the previous owner stops applying after a sale or transfer.\n\n"
            "## Licenses\n\nEvery model shows the license it was published under, recorded on-chain. Its admin can move it only to a later version of the same license or to a more open license, never to a stricter one.\n\n"
            "## Fees\n\nCreator income (fees per inference, tips, subscriptions) goes to the model admin. Protocol fees (creation, storage, listing) are burned; nobody can withdraw them.\n\n" + links_md())

def model_md(m):
    lic = m.get("license") or {}
    rows = [("Question", m.get("question")), ("Market", m.get("market")), ("Access", m.get("access")), *([] if m.get("internalsPrivate", m.get("access") == "Paid") else [("Signals", m.get("nFeatures")), ("Trees", m.get("nTrees"))]),
            ("License", f"[{lic.get('name')}]({lic.get('url')})" if lic.get("url") else lic.get("name")), ("Creator", m.get("creator")), ("Token", f"#{m['tokenId']}")]
    return (f"# {m['title']}\n\n> Crypto AI model #{m['tokenId']} on GenesisL1. {m.get('description') or ''}".rstrip() + "\n\n"
            + "".join(f"- **{k}:** {v}\n" for k, v in rows if v not in (None, "")) +
            f"\nRun it: {ORIGIN}app.html?model={m['tokenId']}#infer · Marketplace: {ORIGIN}market.html#m={m['tokenId']} · Page: {ORIGIN}m/{m['tokenId']}/\n\nNot financial advice.\n")

docs_html = fill((SRC / "docs.body.html").read_text()).replace("{{LICENSES}}", licenses_html()).replace("{{LIC_DEFAULT}}", LIC_DEFAULT).replace("{{SPDX_VERSION}}", SPDX_VER).replace("{{TERMS_VERSION}}", str(TERMS_VERSION))
MD = {"index.md": index_md(), "app.md": app_md(), "market.md": market_md(), "docs.md": "# GL1F Crypto docs\n\n> " + SUMMARY + "\n\n" + html_to_md(docs_html, ORIGIN + "docs.html"),
      "legal/terms.md": TERMS_MD, "legal/onchain-use-1.0.md": (ROOT / "legal" / "onchain-use-1.0.md").read_text(), "legal/cookies.md": (ROOT / "legal" / "cookies.md").read_text(),
      "api.md": "# GL1F Crypto Web3 API\n\n> Run any Crypto AI model on GenesisL1 from code.\n\n" + html_to_md(fill((SRC / "api.body.html").read_text()).split("<script>")[0], ORIGIN + "api.html")}
for m in MODELS or []: MD[f"m/{m['tokenId']}/index.md"] = model_md(m)
for name, text in MD.items():
    (SITE / name).parent.mkdir(parents=True, exist_ok=True)
    (SITE / name).write_text(text)
(SITE / "licenses.json").write_text((ROOT / "src" / "studio" / "licenses.json").read_text())
models_fallback = f"- [All published Crypto AI models]({ORIGIN}m/): one page per model, with the question it answers\n"
models_list = "".join(f"- [#{m['tokenId']} {m['title']}]({ORIGIN}m/{m['tokenId']}/index.md): {m.get('question') or m.get('description') or ''}\n" for m in (MODELS or [])[:200])
(SITE / "llms.txt").write_text(f"""# GL1F Crypto

> {SUMMARY}

Every page has a Markdown version for language models, linked below. Prices, predictions and backtests are educational and are not financial advice.

## Key facts

{FACTS}
## Docs

- [Overview]({ORIGIN}index.md): what GL1F Crypto is, the five steps, key facts, questions and answers
- [Studio]({ORIGIN}app.md): dataset, training, backtest, publishing and inference, all in the browser
- [Marketplace]({ORIGIN}market.md): access modes, the model admin, licenses and income
- [Web3 API]({ORIGIN}api.md): call any model from code: free reads, access keys with plans, pay per run, live inputs, full reference
- [Documentation]({ORIGIN}docs.md): contracts, fees, licenses, admins and multisigs, data sources, validation, backtest rules, disclaimer
- [Terms of Service]({ORIGIN}legal/terms.md): the terms for the app, the website and the smart contracts, version {TERMS_VERSION}
- [GL1F On-Chain Use License]({ORIGIN}legal/onchain-use-1.0.md): the reserved license for models that may be used only through GenesisL1

## Crypto AI models

{models_list or models_fallback}
## Optional

- [Everything in one file]({ORIGIN}llms-full.txt)
- [License catalog (JSON)]({ORIGIN}licenses.json): the {LIC_COUNT} licenses a model can be published under, with SPDX identifiers
- [All signals]({ORIGIN}signals.txt): plain name, machine name and meaning of every signal
- [Sitemap]({ORIGIN}sitemap.xml)
- [Source code](https://github.com/GenesisL1/gl1f-crypto): MIT
""")
lic_table = "| # | License | SPDX | Group | In short |\n|---|---|---|---|---|\n" + "".join(f"| {n + 1} | [{l['name']}]({l['url']}) | {l['spdx']} | {l['group']} | {l['summary']} |\n" for n, l in enumerate(LIC["licenses"]))
(SITE / "llms-full.txt").write_text(f"# GL1F Crypto: full text for language models\n\nSource: {ORIGIN} · generated {LASTMOD} · version {V}\n\n" + "\n---\n\n".join(
    [MD["index.md"], MD["app.md"], MD["market.md"], MD["docs.md"], "# License catalog\n\n" + lic_table, MD["legal/terms.md"], MD["legal/onchain-use-1.0.md"]]
    + [MD[f"m/{m['tokenId']}/index.md"] for m in (MODELS or [])[:200]]))
print("pages:", ", ".join(f"{n} ({len(t) // 1024} KB)" for n, t in list(pages.items())[:5]), f"+ {len(MODELS)} model pages" if MODELS else "")
