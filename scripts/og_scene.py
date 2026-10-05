# MIT License — Copyright (c) 2026 Decentralized Science Labs
"""Dark, car-themed scene for 1200x630 link previews (Telegram, X, WhatsApp, LinkedIn, Slack, Facebook): the GL1F
hypercar over a neon floor, as on the launch cover. Used by render_assets.py (page previews).
Fonts come from Google Fonts, or from GL1F_FONTS_DIR when set (offline)."""
import math
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
A = ROOT / "site" / "assets"
PAGE_CHIPS = [(758, 150, "274 signals", .9, "#6d8bff"), (990, 196, "P(up) = 0.71", 1, "#9b6bff"), (744, 222, "funding −0.021%", .85, "#34d17b"),
              (1044, 142, "moon phase", .5, "#e9e7ff"), (930, 252, "liquidations", .7, "#ff4d6a")]

def fonts():
    d = os.environ.get("GL1F_FONTS_DIR")
    if d:
        p = lambda f: pathlib.Path(d, f).as_uri()
        return (f"@font-face{{font-family:Inter;src:url({p('Inter.ttf')});font-weight:100 900}}"
                f"@font-face{{font-family:'Instrument Serif';src:url({p('InstrumentSerif-Italic.ttf')});font-style:italic}}"
                f"@font-face{{font-family:'JetBrains Mono';src:url({p('JetBrainsMono.ttf')});font-weight:100 900}}")
    return "@import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&family=Instrument+Serif:ital@1&family=JetBrains+Mono:wght@500;600&display=block');"

def scene(text_html, *, chips=PAGE_CHIPS, car=(500, 262, 700), top_right=""):
    candles, v = [], 0.0
    for i in range(34):
        o = v; v += math.sin(i * 0.9) * 9 + math.cos(i * 0.37) * 7 + (i % 7 - 3) * 2.2
        hi, lo, cx, col = max(o, v) + 6 + (i * 13 % 9), min(o, v) - 6 - (i * 7 % 8), 20 + i * 38, "#34d17b" if v >= o else "#ff4d6a"
        candles.append(f'<line x1="{cx}" x2="{cx}" y1="{150 - hi}" y2="{150 - lo}" stroke="{col}" stroke-width="2"/><rect x="{cx - 8}" y="{150 - max(o, v)}" width="16" height="{max(3, abs(v - o))}" fill="{col}"/>')
    loss = " ".join(f"{20 + i * 22},{40 + 300 * math.exp(-i / 11) + 8 * math.sin(i)}" for i in range(46))
    val = " ".join(f"{20 + i * 22},{60 + 270 * math.exp(-i / 13) + 18 * (i / 45) ** 2 + 9 * math.cos(i * 0.8)}" for i in range(46))
    chip = "".join(f'<div class="chip" style="left:{x}px;top:{y}px;opacity:{o}"><i style="background:{c};color:{c}"></i>{t}</div>' for x, y, t, o, c in chips)
    cl, ct, cw = car
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{fonts()}
*{{margin:0;box-sizing:border-box}} body{{width:1200px;height:630px;overflow:hidden;position:relative;background:#040406;font-family:Inter,sans-serif;color:#fff}}
.sky{{position:absolute;inset:0;background:radial-gradient(42% 50% at 72% 84%,rgba(124,77,255,.44),transparent 70%),radial-gradient(26% 32% at 82% 76%,rgba(255,46,126,.30),transparent 70%),
 radial-gradient(36% 46% at 8% 4%,rgba(47,91,255,.22),transparent 70%),linear-gradient(180deg,#050508 0%,#08070f 55%,#0d0a1a 100%)}}
.floor{{position:absolute;left:-200px;right:-200px;top:500px;height:420px;transform:perspective(380px) rotateX(62deg);transform-origin:top;
 background:repeating-linear-gradient(90deg,rgba(155,107,255,.30) 0 1px,transparent 1px 58px),repeating-linear-gradient(0deg,rgba(155,107,255,.24) 0 1px,transparent 1px 30px);
 -webkit-mask-image:linear-gradient(180deg,#000 0%,rgba(0,0,0,.5) 40%,transparent 90%)}}
.horizon{{position:absolute;left:0;right:0;top:499px;height:2px;background:linear-gradient(90deg,transparent 4%,rgba(124,77,255,.95) 45%,rgba(255,46,126,1) 72%,transparent 96%);filter:blur(1.4px)}}
.data{{position:absolute;opacity:.15}}
.streak{{position:absolute;height:2px;border-radius:9px;filter:blur(1px);background:linear-gradient(90deg,transparent,rgba(167,139,250,.9) 55%,rgba(255,46,126,.9) 80%,transparent)}}
.under{{position:absolute;left:{cl + 90}px;top:{ct + int(cw * .34)}px;width:{int(cw * .86)}px;height:{int(cw * .16)}px;border-radius:50%;background:radial-gradient(closest-side,rgba(140,90,255,.8),rgba(255,46,126,.28) 55%,transparent);filter:blur(24px)}}
.car{{position:absolute;left:{cl}px;top:{ct}px;width:{cw}px;filter:drop-shadow(0 0 26px rgba(255,30,70,.45)) drop-shadow(0 0 80px rgba(124,77,255,.35))}}
.chip{{position:absolute;display:flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;font:500 13px 'JetBrains Mono',monospace;letter-spacing:.02em;color:#e9e7ff;
 background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);box-shadow:0 6px 24px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);white-space:nowrap}}
.chip i{{width:7px;height:7px;border-radius:50%;box-shadow:0 0 9px currentColor}}
.text{{position:absolute;left:56px;top:46px;width:680px}}
.eyebrow{{display:inline-flex;align-items:center;gap:10px;font:500 12.5px 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:#b4b2c6;padding:7px 13px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.06)}}
.eyebrow b{{width:8px;height:8px;border-radius:50%;background:#34d17b;box-shadow:0 0 10px #34d17b}}
h1{{margin-top:22px;font-weight:800;font-size:56px;line-height:.98;letter-spacing:-.05em;text-shadow:0 4px 40px rgba(0,0,0,.6)}}
h1 em,.q{{font-family:'Instrument Serif',serif;font-weight:400;letter-spacing:-.015em;background:linear-gradient(100deg,#6d8bff 0%,#9b6bff 40%,#ff3d8b 78%,#ff5a45 100%);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(155,107,255,.35))}}
h1 em{{display:block;font-size:66px;line-height:1.04;padding:0 .06em .08em 0}}
.sub{{margin-top:16px;max-width:440px;font-weight:500;font-size:18px;line-height:1.4;color:#c9c7d6;letter-spacing:-.01em}}
.title{{display:flex;align-items:center;gap:14px;margin-top:20px}} .title img{{width:54px;height:54px;border-radius:13px;border:1px solid rgba(255,255,255,.18);flex:none}}
.mt{{font-weight:800;font-size:44px;line-height:1.04;letter-spacing:-.04em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 4px 40px rgba(0,0,0,.6)}}
.q{{margin-top:14px;max-width:560px;font-style:italic;font-size:32px;line-height:1.12;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;padding-bottom:4px}}
.tags{{margin-top:16px;display:flex;flex-wrap:wrap;gap:7px;max-width:520px}} .tags span{{font:500 13px 'JetBrains Mono',monospace;color:#e9e7ff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 10px}}
.brand{{position:absolute;left:56px;bottom:38px;display:flex;align-items:center;gap:12px}} .brand img{{height:17px}} .row{{display:flex;align-items:center;gap:11px}}
.brand b{{font-weight:750;font-size:20px;letter-spacing:-.03em}} .brand b span{{color:#a1a1b3;font-weight:500;margin-left:5px}}
.alpha{{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;font:600 10px 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:#fff;background:linear-gradient(100deg,#2f5bff,#7c4dff 50%,#ff2e7e);box-shadow:0 0 16px rgba(124,77,255,.55)}}
.brand small{{display:block;font:500 11px 'JetBrains Mono',monospace;color:#a1a1b3;letter-spacing:.05em;margin-top:3px}}
.tr{{position:absolute;right:56px;top:52px;text-align:right;font-family:'Instrument Serif',serif;font-style:italic;font-size:24px;color:#fff}}
.tr small{{display:block;font:500 10.5px 'JetBrains Mono',monospace;font-style:normal;color:#8a8a9c;letter-spacing:.08em;text-transform:uppercase;margin-top:5px}}
.tr code{{font:500 13px 'JetBrains Mono',monospace;font-style:normal;color:#b4b2c6}}
.grain{{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay}} .vignette{{position:absolute;inset:0;background:radial-gradient(120% 90% at 55% 50%,transparent 55%,rgba(0,0,0,.6))}}
</style></head><body><div class="sky"></div><div class="floor"></div><div class="horizon"></div>
<svg class="data" style="left:0;top:380px;width:1300px" viewBox="0 0 1320 300">{''.join(candles)}</svg>
<svg class="data" style="left:720px;top:40px;width:430px;opacity:.18" viewBox="0 0 1030 360"><polyline points="{loss}" fill="none" stroke="#94a3b8" stroke-width="4"/><polyline points="{val}" fill="none" stroke="#6d8bff" stroke-width="5"/></svg>
<div class="streak" style="left:{cl + 40}px;top:{ct + 150}px;width:620px;opacity:.45"></div><div class="streak" style="left:{cl + 160}px;top:{ct + 205}px;width:460px;opacity:.3"></div><div class="streak" style="left:{cl - 30}px;top:{ct + 255}px;width:700px;opacity:.35"></div>
<div class="under"></div><img class="car" src="{(A / 'og-car.webp').as_uri()}" alt="">{chip}
<div class="text">{text_html}</div>{f'<div class="tr">{top_right}</div>' if top_right else ''}
<div class="brand"><img src="{(A / 'car-mark.svg').as_uri()}" alt=""><div><div class="row"><b>GL1F<span>Crypto</span></b><span class="alpha">Early alpha</span></div><small>powered by GenesisL1</small></div></div>
<svg class="grain" width="100%" height="100%"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg><div class="vignette"></div>
<script>Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {{}}))]).then(() => {{ document.body.dataset.ready = 1; }});</script>
</body></html>"""
