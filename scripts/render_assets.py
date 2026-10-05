#!/usr/bin/env python3
# MIT License — Copyright (c) 2026 Decentralized Science Labs
"""Render brand assets: the car mark and favicons (from the 3D car's profile) and the hero stills.
Needs: python3 with Playwright + Chromium, Pillow, and a built site/js/car3d.js (npm run build)."""
import math
import os
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
A = ROOT / "site" / "assets"
XF, XR, AF, AR, RW, RA = 2.38, -2.34, 1.3, -1.38, 0.35, 0.405

def monotone(points):
    n = len(points); xs = [p[0] for p in points]; ys = [p[1] for p in points]
    d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(n - 1)]
    m = [0.0] * n; m[0] = d[0]; m[-1] = d[-1]
    for i in range(1, n - 1): m[i] = 0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2
    for i in range(n - 1):
        if d[i] == 0: m[i] = m[i + 1] = 0; continue
        a, b = m[i] / d[i], m[i + 1] / d[i]; s = a * a + b * b
        if s > 9: t = 3 / math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]
    def f(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[-1]: return ys[-1]
        i = 0
        while x > xs[i + 1]: i += 1
        h = xs[i + 1] - xs[i]; t = (x - xs[i]) / h; t2 = t * t; t3 = t2 * t
        return (2*t3 - 3*t2 + 1) * ys[i] + (t3 - 2*t2 + t) * h * m[i] + (-2*t3 + 3*t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
    return f
crest = monotone([[XR, 0.76], [-2.25, 0.905], [-1.95, 0.95], [-1.45, 0.965], [-1.0, 0.93], [-0.5, 0.87], [0.2, 0.835], [0.8, 0.83], [1.25, 0.84], [1.7, 0.78], [2.05, 0.65], [2.28, 0.47], [XF, 0.31]])
roof = monotone([[-1.18, 0.885], [-0.95, 1.0], [-0.6, 1.1], [-0.25, 1.16], [0.05, 1.14], [0.35, 1.03], [0.55, 0.9], [0.66, 0.815]])
smooth = lambda e0, e1, x: (lambda t: t * t * (3 - 2 * t))(min(1, max(0, (x - e0) / (e1 - e0))))
bottom = lambda x: 0.15 + 0.12 * smooth(1.9, XF, x) ** 2 + 0.14 * smooth(-1.9, XR, x) ** 2
def arch(x):
    for a in (AF, AR):
        dx = abs(x - a)
        if dx < RA: return RW + math.sqrt(RA * RA - dx * dx)
    return 0

S, PAD, TOP = 10, 0.9, 1.19
X = lambda x: (x - XR) * S + PAD
Y = lambda y: (TOP - y) * S + PAD
P = lambda x, y: f"{X(x):.2f},{Y(y):.2f}"
xs = [XR + (XF - XR) * i / 160 for i in range(161)]
BODY = "M" + P(XR, bottom(XR)) + " L" + " L".join(P(x, crest(x)) for x in xs) + " L" + P(XF, bottom(XF)) + " L" + " L".join(P(x, max(bottom(x), arch(x))) for x in reversed(xs)) + " Z"
cx = [-1.18 + 1.84 * i / 60 for i in range(61)]
GLASS = "M" + " L".join(P(x, max(roof(x), crest(x))) for x in cx) + " L" + " L".join(P(x, crest(x) - 0.012) for x in reversed(cx)) + " Z"
SHINE = "M" + " L".join(P(x, roof(x) - 0.028) for x in [-0.85 + 1.2 * i / 24 for i in range(25)])
WING = "M" + " L".join([P(-1.87, 1.095), P(-2.33, 1.14), P(-2.345, 1.08), P(-1.89, 1.075)]) + " Z"
W, H = round(X(XF) + PAD, 2), round(Y(0) + PAD, 2)

def car(uid):
    wheels = "".join(
        f'<circle cx="{X(a):.2f}" cy="{Y(RW):.2f}" r="{RW * S:.2f}" fill="#0d0f13"/>'
        f'<circle cx="{X(a):.2f}" cy="{Y(RW):.2f}" r="{0.235 * S:.2f}" fill="#23272f" stroke="#e7eaf0" stroke-width="0.55"/>'
        f'<circle cx="{X(a):.2f}" cy="{Y(RW):.2f}" r="0.55" fill="#e7eaf0"/>' for a in (AR, AF))
    return (f'<defs><linearGradient id="b{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a55"/><stop offset=".5" stop-color="#e3122e"/><stop offset="1" stop-color="#860a17"/></linearGradient>'
            f'<linearGradient id="g{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4a73"/><stop offset=".55" stop-color="#141a2c"/><stop offset="1" stop-color="#0a0d16"/></linearGradient></defs>'
            f'<path d="{WING}" fill="#15181f"/><rect x="{X(-2.03):.2f}" y="{Y(1.08):.2f}" width="0.7" height="{(1.08 - crest(-2.0)) * S + 0.3:.2f}" fill="#15181f"/>'
            f'<path d="{BODY}" fill="url(#b{uid})"/><path d="{GLASS}" fill="url(#g{uid})"/>'
            f'<path d="{SHINE}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="0.4" stroke-linecap="round"/>'
            f'<path d="M{P(1.95, crest(1.95) - 0.07)} L{P(2.22, crest(2.22) - 0.055)}" stroke="#f4f7ff" stroke-width="0.6" stroke-linecap="round"/>' + wheels)

def mark_svg():
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="GL1F Crypto"><title>GL1F Crypto</title>{car("m")}</svg>\n'
# Favicon: a red front-view hypercar (roof, windshield, headlights, intake, tyres) on white; reads at 16 px on light and dark tabs.
CAR_FRONT = ('<rect x="9" y="40" width="9" height="12" rx="2.6" fill="#101116"/><rect x="46" y="40" width="9" height="12" rx="2.6" fill="#101116"/>'
             '<path d="M22 17.5C23 16.3 24.2 16 26 16H38C39.8 16 41 16.3 42 17.5L48.5 27.5C52.5 28.3 55.6 30.2 57 33.5L58 38.5V44.5C58 46.4 56.6 47.5 54.8 47.5H9.2C7.4 47.5 6 46.4 6 44.5V38.5L7 33.5C8.4 30.2 11.5 28.3 15.5 27.5Z" fill="url(#body)"/>'
             '<path d="M25.2 19.6H38.8L44.3 27.9H19.7Z" fill="#141826"/><path d="M26.5 20.8H37.5" stroke="#fff" stroke-opacity=".5" stroke-width=".9" stroke-linecap="round"/>'
             '<path d="M10 34.4 22.6 36.9 21.7 39.7 10.4 38.3Z" fill="#fff"/><path d="M54 34.4 41.4 36.9 42.3 39.7 53.6 38.3Z" fill="#fff"/>'
             '<rect x="24" y="41" width="16" height="3.4" rx="1.7" fill="#141826"/>')
def favicon(size=64, scale=1.0, rounded=True):
    bg = ('<rect x=".5" y=".5" width="63" height="63" rx="15" fill="#fff" stroke="#e4e4ea"/>' if rounded else '<rect width="64" height="64" fill="#fff"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}"><title>GL1F Crypto</title>'
            '<defs><linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a45"/><stop offset=".55" stop-color="#e3122e"/><stop offset="1" stop-color="#a70b22"/></linearGradient></defs>'
            f'{bg}<g transform="translate(32 34) scale({scale}) translate(-32 -34)">{CAR_FRONT}</g></svg>\n')

# Link previews: the dark, car-themed scene of the launch cover (scripts/og_scene.py), one headline per page.
from og_scene import scene
OG = {"home": ("No-code crypto AI · GenesisL1 EVM", "Launch your own", "Crypto AI model.", "Train it in your browser on Binance, Coinbase or Hyperliquid candles, backtest it honestly, mint it on GenesisL1."),
      "studio": ("GL1F Crypto · Studio", "Train, backtest, mint", "your Crypto AI model.", "Ask a market question, train on 274 signals with walk-forward validation, backtest with leverage."),
      "market": ("GL1F Crypto · Marketplace", "Run, subscribe, own", "Crypto AI model NFTs.", "Free, tips, a fee per run or subscriptions. Every model's license is on-chain."),
      "api": ("GL1F Crypto · Web3 API", "Run any model", "from code.", "Free reads, access keys with plans, pay per run. One JavaScript helper for every Crypto AI model."),
      "docs": ("GL1F Crypto · Docs", "How GL1F Crypto", "works, on-chain.", "Contracts, licenses, burnable fees, data, validation and backtest rules, explained.")}
def og_html(name):
    eyebrow, l1, l2, sub = OG[name]
    return scene(f'<div class="eyebrow"><b></b>{eyebrow}</div><h1>{l1}<em>{l2}</em></h1><p class="sub">{sub}</p>',
                 top_right="GenesisL1 EVM is your quant.<small>Educational · not financial advice</small>")

def main():
    from playwright.sync_api import sync_playwright
    from PIL import Image
    og_only = "--og-only" in sys.argv  # re-render only the link-preview images
    if not og_only:
        (A / "car-mark.svg").write_text(mark_svg())
        (A / "favicon.svg").write_text(favicon())
    pngs = {"favicon-32.png": (32, favicon(32)), "apple-touch-icon.png": (180, favicon(180, 0.86, False)), "icon-192.png": (192, favicon(192)),
            "icon-512.png": (512, favicon(512)), "icon-maskable-512.png": (512, favicon(512, 0.7, False)),
            "_ico16.png": (16, favicon(16)), "_ico32.png": (32, favicon(32)), "_ico48.png": (48, favicon(48))}
    car3d = (ROOT / "site" / "js" / "car3d.js").as_uri()
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        for name, (size, svg) in ({} if og_only else pngs).items():
            pg = b.new_page(viewport={"width": size, "height": size})
            pg.set_content(f"<html><body style='margin:0;background:transparent'>{svg}</body></html>")
            pg.screenshot(path=str(A / name), omit_background=True); pg.close()
        if not og_only:
            icons = [Image.open(A / f"_ico{n}.png").convert("RGBA") for n in (48, 32, 16)]
            icons[0].save(ROOT / "site" / "favicon.ico", format="ICO", sizes=[(48, 48), (32, 32), (16, 16)], append_images=icons[1:])
            for n in (16, 32, 48): (A / f"_ico{n}.png").unlink()
        for theme in (() if og_only else ("light", "dark")):
            with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
                f.write(f"""<!doctype html><html data-theme="{theme}"><body style="margin:0;background:transparent">
<div id="car3d" style="position:relative;width:1600px;height:1000px"><canvas class="car3d-canvas" style="position:absolute;inset:0;width:100%;height:100%"></canvas></div>
<script src="{car3d}"></script><script>GL1FCar3D.mountCar(document.getElementById("car3d"), {{ still: true, hotspots: false, yaw: -0.25, elev: 0.2 }}); document.body.dataset.ready = "1";</script></body></html>""")
            pg = b.new_page(viewport={"width": 1600, "height": 1000})
            pg.goto(pathlib.Path(f.name).as_uri()); pg.wait_for_selector("body[data-ready='1']", timeout=60_000); pg.wait_for_timeout(300)
            png = A / f"car-poster-{theme}.png"
            pg.screenshot(path=str(png), omit_background=True); pg.close()
            Image.open(png).save(A / f"car-poster-{theme}.webp", "WEBP", quality=86, method=6); png.unlink()
        for name in OG:
            with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
                f.write(og_html(name))
            pg = b.new_page(viewport={"width": 1200, "height": 630})
            pg.goto(pathlib.Path(f.name).as_uri()); pg.wait_for_selector("body[data-ready='1']", timeout=60_000); pg.wait_for_timeout(300)
            png = A / f"og-{name}.png"
            pg.screenshot(path=str(png)); pg.close()
            Image.open(png).convert("RGB").save(A / f"og-{name}.jpg", "JPEG", quality=88, optimize=True, progressive=True); png.unlink()
        b.close()
    print("assets:", sorted(x.name for x in A.iterdir()))

if __name__ == "__main__":
    main()
