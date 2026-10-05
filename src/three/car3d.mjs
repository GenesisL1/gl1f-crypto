// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Interactive 3D hero car for crypto.gl1f.com. Procedural geometry, no model files.
// Drag or swipe to spin it, click or tap to rev: wheels, exhaust smoke and the GL1F engine glow respond.
// three.js r160 (MIT) is vendored in ./vendor.
import * as THREE from "three";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (x, s) => Math.exp(-(x / s) * (x / s));

// Monotone cubic interpolation through [x, y] control points (no overshoot).
function monotone(points) {
  const n = points.length, xs = points.map((p) => p[0]), ys = points.map((p) => p[1]), d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// ---------- The car, in metres: +x front, +y up, +z right side ----------
const XF = 2.38, XR = -2.34, AF = 1.3, AR = -1.38, RW = 0.35, RA = 0.405, WELL = 0.4;
const topLine = monotone([[XR, 0.74], [-2.25, 0.88], [-2.0, 0.895], [-1.5, 0.89], [-1.1, 0.87], [-0.4, 0.84], [0.4, 0.8], [0.75, 0.785], [1.1, 0.765], [1.6, 0.69], [2.0, 0.56], [2.25, 0.43], [XF, 0.3]]);
const crestLine = monotone([[XR, 0.76], [-2.25, 0.905], [-1.95, 0.95], [-1.45, 0.965], [-1.0, 0.93], [-0.5, 0.87], [0.2, 0.835], [0.8, 0.83], [1.25, 0.84], [1.7, 0.78], [2.05, 0.65], [2.28, 0.47], [XF, 0.31]]);
const roofLine = monotone([[-1.18, 0.885], [-0.95, 1.0], [-0.6, 1.1], [-0.25, 1.16], [0.05, 1.14], [0.35, 1.03], [0.55, 0.9], [0.66, 0.815]]);

function halfWidth(x) {
  let w = 1.0;
  w *= 1 - 0.3 * Math.pow(smooth(1.55, XF, x), 1.6);
  w *= 1 - 0.1 * smooth(-1.95, XR, x);
  w *= 1 + 0.035 * gauss(x - AF, 0.55) + 0.055 * gauss(x - AR, 0.6);
  w *= 1 - 0.025 * gauss(x + 0.1, 0.7);
  return w;
}
const bottom = (x) => 0.15 + 0.12 * Math.pow(smooth(1.9, XF, x), 2) + 0.14 * Math.pow(smooth(-1.9, XR, x), 2);
function archTop(x) {
  for (const a of [AF, AR]) {
    const dx = Math.abs(x - a);
    if (dx < RA) return RW + Math.sqrt(RA * RA - dx * dx);
    if (dx < RA + 0.08) return lerp(RW, 0, (dx - RA) / 0.08);
  }
  return 0;
}

// Half cross-section from the bottom centre, up the right side, to the top centre (17 points).
function halfSection(x) {
  const W = halfWidth(x), yb = bottom(x);
  const yt = Math.max(topLine(x), yb + 0.02), yf = Math.max(crestLine(x), yt);
  const yL = Math.max(yb, Math.min(Math.max(yb, archTop(x)), yf - 0.07));
  const win = Math.max(0.08, W - WELL), h = yf - yL;
  return [
    [0, yb], [win * 0.55, yb], [win, yb], [win, lerp(yb, yL, 0.5)], [win, yL], [lerp(win, W * 0.96, 0.5), yL], [W * 0.96, yL],
    [W * 0.993, yL + 0.1 * h], [W, yL + 0.28 * h], [W * 0.996, yL + 0.48 * h], [W * 0.978, yL + 0.67 * h],
    [W * 0.945, yL + 0.82 * h], [W * 0.89, yL + 0.94 * h], [W * 0.8, yf],
    [W * 0.62, lerp(yf, yt, 0.42)], [W * 0.34, lerp(yf, yt, 0.86)], [0, yt],
  ];
}
function mirrorRing(half) {
  const ring = half.slice();
  for (let i = half.length - 2; i >= 1; i--) ring.push([-half[i][0], half[i][1]]);
  return ring;
}
const bodySection = (x) => mirrorRing(halfSection(x));
const canopyWidth = (x) => lerp(0.56, 0.78, smooth(-1.2, 0.66, x));
function canopySection(x) {
  const yb = topLine(x) - 0.03, yr = Math.max(roofLine(x), yb + 0.01), Wc = canopyWidth(x), H = yr - yb, n = 2.6, K = 16;
  const ring = [[0, yb], [Wc * 0.5, yb], [Wc, yb]];
  for (let k = 1; k < K; k++) {
    const th = (k / K) * Math.PI, c = Math.cos(th), s = Math.sin(th), f = Math.pow(s, 2 / n);
    ring.push([Wc * Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * (1 - 0.12 * f), yb + H * f]);
  }
  ring.push([-Wc, yb], [-Wc * 0.5, yb]);
  return ring;
}
// Height of the upper body surface at (x, |z|), and the side surface z at (x, y): used to seat details.
function surfaceY(x, z) {
  const half = halfSection(x), az = Math.abs(z);
  for (let i = 8; i < half.length - 1; i++) {
    const [z0, y0] = half[i], [z1, y1] = half[i + 1];
    if (az <= z0 && az >= z1) return lerp(y0, y1, (z0 - az) / Math.max(1e-6, z0 - z1));
  }
  return half[half.length - 1][1];
}
function sideZ(x, y) {
  const half = halfSection(x);
  for (let i = 6; i < 13; i++) {
    const [z0, y0] = half[i], [z1, y1] = half[i + 1];
    if (y >= y0 && y <= y1) return lerp(z0, z1, (y - y0) / Math.max(1e-6, y1 - y0));
  }
  return halfWidth(x);
}

// Loft rings along x (ascending) into a closed, outward-facing mesh.
function loft(stations, sectionFn) {
  const rings = stations.map(sectionFn), M = rings[0].length, N = stations.length, pos = [], idx = [];
  stations.forEach((x, i) => { for (const [z, y] of rings[i]) pos.push(x, y, z); });
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * M + j, b = i * M + ((j + 1) % M), c = (i + 1) * M + j, d = (i + 1) * M + ((j + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  const cap = (i, flip) => {
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < M; j++) { cx += pos[(i * M + j) * 3]; cy += pos[(i * M + j) * 3 + 1]; cz += pos[(i * M + j) * 3 + 2]; }
    const center = pos.length / 3;
    pos.push(cx / M, cy / M, cz / M);
    for (let j = 0; j < M; j++) {
      const a = i * M + j, b = i * M + ((j + 1) % M);
      if (flip) idx.push(center, b, a); else idx.push(center, a, b);
    }
  };
  cap(0, false);
  cap(N - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

// ---------- Textures drawn on canvas ----------
function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const radial = (stops) => canvasTexture(256, 256, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  for (const [o, c] of stops) r.addColorStop(o, c);
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
const engineTexture = () => canvasTexture(512, 360, (g, w, h) => {
  g.fillStyle = "#12070a"; g.fillRect(0, 0, w, h);
  const r = g.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, 250);
  r.addColorStop(0, "#fff4c8"); r.addColorStop(0.2, "#ffb020"); r.addColorStop(0.52, "#ff2e7e"); r.addColorStop(0.86, "#5a1bd6"); r.addColorStop(1, "#12070a");
  g.fillStyle = r; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(8,6,10,0.8)";
  for (let y = 16; y < h; y += 42) g.fillRect(0, y, w, 17);
  g.font = "700 70px ui-monospace, Menlo, monospace"; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = "#ffb020"; g.shadowBlur = 24; g.fillStyle = "rgba(255,255,255,0.95)"; g.fillText("GL1F", w / 2, h / 2 + 4);
});
const badgeTexture = () => canvasTexture(256, 64, (g, w, h) => {
  g.font = "700 44px ui-monospace, Menlo, monospace"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#e9edf3"; g.fillText("GL1F", w / 2, h / 2 + 2);
});
const smokeTexture = () => canvasTexture(128, 128, (g, w, h) => {
  const blob = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
  blob(64, 64, 62, 0.5);
  for (const [x, y, r] of [[50, 54, 34], [80, 60, 30], [60, 80, 28], [74, 44, 24]]) blob(x, y, r, 0.22);
}, false);

// Studio lighting for reflections: long softboxes read as sleek highlights on the paint.
function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x15181f);
  const panel = (w, h, pos, rot, intensity, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.set(...rot); env.add(m);
  };
  panel(18, 2.6, [0, 9, 0], [Math.PI / 2, 0, 0], 3.4);
  panel(18, 1.1, [0, 3.6, 9], [0, 0, 0], 2.6);
  panel(18, 1.1, [0, 3.6, -9], [0, Math.PI, 0], 1.8);
  panel(5, 7, [11, 3, 0], [0, -Math.PI / 2, 0], 1.6, 0xfff0dc);
  panel(5, 7, [-11, 3, 0], [0, Math.PI / 2, 0], 1.3, 0xdbe6ff);
  panel(30, 30, [0, -2, 0], [-Math.PI / 2, 0, 0], 0.18, 0x9aa3b2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}

// ---------- Build ----------
function buildCar() {
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xe0142f, metalness: 0.42, roughness: 0.27, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.25 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x131a2a, metalness: 0.85, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.1 }),
    carbon: new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.45, roughness: 0.42, envMapIntensity: 0.9 }),
    black: new THREE.MeshStandardMaterial({ color: 0x06070a, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }),
    tire: new THREE.MeshStandardMaterial({ color: 0x111215, metalness: 0, roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xd2d7de, metalness: 1, roughness: 0.24 }),
    rimDark: new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.9, roughness: 0.38 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x70757f, metalness: 0.9, roughness: 0.32 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0xffab1a, metalness: 0.25, roughness: 0.35 }),
    head: new THREE.MeshBasicMaterial({ color: 0xf2f6ff, toneMapped: false }),
    tail: new THREE.MeshBasicMaterial({ color: 0xff2238, toneMapped: false }),
  };
  const car = new THREE.Group(), body = new THREE.Group();
  car.add(body);
  const add = (geo, mat, pos, rot, parent = body) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); parent.add(m); return m; };

  add(loft(range(XR, XF, 156), bodySection), mats.paint);
  add(loft(range(-1.18, 0.66, 64), canopySection), mats.glass);

  // Headlights: a dark housing with a thin LED blade, seated on the nose.
  for (const s of [1, -1]) {
    const x = 2.03, z = s * 0.56, y = surfaceY(x, z);
    add(new THREE.BoxGeometry(0.42, 0.022, 0.09), mats.black, [x, y - 0.004, z], [0, s * 0.475, -0.3]);
    add(new THREE.BoxGeometry(0.39, 0.02, 0.036), mats.head, [x + 0.005, y + 0.01, z + s * 0.012], [0, s * 0.475, -0.3]);
  }
  // Rear: full-width light bar, badge, exhaust tips, diffuser.
  const wTail = halfWidth(XR) * 0.9;
  add(new THREE.BoxGeometry(0.014, 0.03, wTail * 2), mats.tail, [XR - 0.006, 0.64, 0]);
  const badge = add(new THREE.PlaneGeometry(0.34, 0.085), new THREE.MeshBasicMaterial({ map: badgeTexture(), transparent: true, toneMapped: false }), [XR - 0.008, 0.52, 0], [0, -Math.PI / 2, 0]);
  badge.renderOrder = 2;
  const exhaust = [];
  for (const s of [1, -1]) {
    add(new THREE.CylinderGeometry(0.062, 0.062, 0.16, 28), mats.rim, [XR + 0.02, 0.37, s * 0.17], [0, 0, Math.PI / 2]);
    add(new THREE.CylinderGeometry(0.046, 0.046, 0.02, 24), mats.black, [XR - 0.052, 0.37, s * 0.17], [0, 0, Math.PI / 2]);
    exhaust.push(new THREE.Vector3(XR - 0.09, 0.37, s * 0.17));
  }
  add(new THREE.BoxGeometry(0.55, 0.12, 1.4), mats.carbon, [XR + 0.27, 0.215, 0]);
  for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(0.52, 0.13, 0.016), mats.carbon, [XR + 0.26, 0.2, k * 0.24]);
  // Front splitter and lower intake.
  add(new THREE.BoxGeometry(0.3, 0.018, 1.46), mats.carbon, [XF - 0.14, 0.155, 0]);
  add(new THREE.BoxGeometry(0.1, 0.06, 1.0), mats.black, [XF - 0.07, 0.235, 0]);
  // Engine cover: the GL1F core glowing under louvres.
  const glowMat = new THREE.MeshBasicMaterial({ map: engineTexture(), toneMapped: false });
  add(new THREE.PlaneGeometry(0.7, 0.4), glowMat, [-1.62, surfaceY(-1.62, 0.2) + 0.012, 0], [-Math.PI / 2, 0, 0]);
  const glowLight = new THREE.PointLight(0xff7a3d, 6, 3.2, 2);
  glowLight.position.set(-1.62, 1.25, 0);
  body.add(glowLight);
  // Rear wing on two struts.
  const foil = new THREE.Shape();
  foil.moveTo(0, 0); foil.quadraticCurveTo(-0.12, 0.058, -0.46, 0.03); foil.lineTo(-0.46, 0.012); foil.quadraticCurveTo(-0.2, -0.02, 0, 0);
  add(new THREE.ExtrudeGeometry(foil, { depth: 1.84, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 16 }), mats.carbon, [-1.86, 1.07, -0.92]);
  for (const s of [1, -1]) {
    add(new THREE.BoxGeometry(0.46, 0.14, 0.012), mats.carbon, [-2.09, 1.04, s * 0.93]);
    add(new THREE.BoxGeometry(0.05, 0.19, 0.018), mats.carbon, [-2.0, 0.98, s * 0.42]);
  }
  // Side intakes, skirts and mirrors.
  const intake = new THREE.Shape();
  intake.moveTo(-0.98, 0.64); intake.lineTo(-0.3, 0.6); intake.quadraticCurveTo(-0.42, 0.47, -0.56, 0.4); intake.lineTo(-0.98, 0.44); intake.lineTo(-0.98, 0.64);
  const intakeGeo = new THREE.ShapeGeometry(intake, 12);
  for (const s of [1, -1]) {
    add(intakeGeo, mats.black, [0, 0, s * (sideZ(-0.64, 0.52) + 0.008)]);
    add(new THREE.BoxGeometry(1.72, 0.045, 0.03), mats.carbon, [-0.04, 0.19, s * (halfWidth(-0.04) * 0.965 + 0.012)]);
    const mirror = add(new THREE.SphereGeometry(1, 24, 14), mats.paint, [0.42, 0.935, s * 0.87]);
    mirror.scale.set(0.11, 0.055, 0.07);
    add(new THREE.BoxGeometry(0.06, 0.02, 0.16), mats.carbon, [0.42, 0.905, s * 0.77]);
  }

  // Wheels: lathe tyre, silver twin-spoke rim, disc, amber caliper.
  const tireGeo = new THREE.LatheGeometry([[0.245, -0.15], [0.32, -0.152], [0.345, -0.13], [0.352, -0.06], [0.352, 0.06], [0.345, 0.13], [0.32, 0.152], [0.245, 0.15]].map(([r, y]) => new THREE.Vector2(r, y)), 56);
  const barrelGeo = new THREE.CylinderGeometry(0.245, 0.245, 0.28, 48, 1, true), discGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.03, 40);
  const spokeGeo = new THREE.BoxGeometry(0.2, 0.026, 0.03), lipGeo = new THREE.TorusGeometry(0.245, 0.011, 8, 56), hubGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.05, 24);
  const wheels = [];
  for (const [ax, steer] of [[AF, 0.14], [AR, 0]]) {
    for (const s of [1, -1]) {
      const outer = new THREE.Group(), orient = new THREE.Group(), spin = new THREE.Group();
      outer.position.set(ax, RW, s * (halfWidth(ax) - 0.21));
      outer.rotation.y = steer;
      orient.rotation.y = s > 0 ? 0 : Math.PI;
      add(tireGeo, mats.tire, null, [Math.PI / 2, 0, 0], spin);
      add(barrelGeo, mats.rimDark, null, [Math.PI / 2, 0, 0], spin);
      add(discGeo, mats.disc, [0, 0, 0.02], [Math.PI / 2, 0, 0], spin);
      for (let k = 0; k < 5; k++) {
        for (const off of [-0.085, 0.085]) {
          const holder = new THREE.Group();
          holder.rotation.z = (k / 5) * Math.PI * 2 + off;
          add(spokeGeo, mats.rim, [0.135, 0, 0], null, holder);
          holder.position.z = 0.125;
          spin.add(holder);
        }
      }
      add(lipGeo, mats.rim, [0, 0, 0.132], null, spin);
      add(hubGeo, mats.rim, [0, 0, 0.14], [Math.PI / 2, 0, 0], spin);
      add(new THREE.BoxGeometry(0.1, 0.15, 0.05), mats.caliper, [-0.11, 0.1, 0.055], [0, 0, 0.75], orient);
      orient.add(spin);
      outer.add(orient);
      car.add(outer);
      wheels.push({ spin, sign: s > 0 ? -1 : 1 });
    }
  }

  // Hotspot anchors (car space) with outward normals for visibility.
  const anchors = [
    { key: "ENGINE", text: "GL1F integer trees", p: [-1.62, surfaceY(-1.62, 0) + 0.03, 0], n: [0, 1, 0] },
    { key: "FUEL", text: "Binance · Coinbase · Hyperliquid", p: [-0.66, 0.52, sideZ(-0.66, 0.52) + 0.01], n: [0, 0.1, 1] },
    { key: "DASHBOARD", text: "backtest with fees", p: [0.1, roofLine(0.1) - 0.04, 0.36], n: [0.35, 1, 0.45] },
    { key: "KEYS", text: "your Model NFT", p: [2.05, surfaceY(2.05, 0.56) + 0.02, 0.56], n: [1, 0.6, 0.5] },
    { key: "CHASSIS", text: "GenesisL1 · chain id 29", p: [0.05, 0.3, sideZ(0.05, 0.3) + 0.01], n: [0, -0.1, 1] },
    { key: "EXHAUST", text: "fees burned to 0x…dEaD", p: [XR - 0.1, 0.37, 0.17], n: [-1, 0, 0.2] },
  ];
  return { car, body, wheels, exhaust, glowMat, glowLight, anchors };
}

// ---------- Mount ----------
export function mountCar(host, opts = {}) {
  const canvas = host.querySelector("canvas");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const still = !!opts.still;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (error) {
    console.warn("3D car unavailable:", error);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1d24, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(4, 7, 5); scene.add(key);
  const rimLight = new THREE.DirectionalLight(0x9db4ff, 1.2); rimLight.position.set(-6, 3, -4); scene.add(rimLight);

  const built = buildCar();
  const { car, body, wheels, exhaust, glowMat, glowLight, anchors } = built;
  scene.add(car);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.9), new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(0,0,0,0.9)"], [0.42, "rgba(0,0,0,0.5)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004; car.add(shadow);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.3), new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(124,77,255,0.95)"], [0.45, "rgba(47,91,255,0.4)"], [1, "rgba(47,91,255,0)"]]), transparent: true, depthWrite: false, toneMapped: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.006; car.add(glow);

  const gridMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uOffset: { value: new THREE.Vector2() }, uColor: { value: new THREE.Color(0x0a0c10) }, uOpacity: { value: 0.1 }, uScale: { value: 0.9 } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: "uniform vec2 uOffset; uniform vec3 uColor; uniform float uOpacity; uniform float uScale; varying vec3 vW;" +
      "void main(){ vec2 p = (vW.xz + uOffset) / uScale; vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p); float line = 1.0 - min(min(g.x, g.y), 1.0);" +
      "float fade = 1.0 - smoothstep(2.4, 8.5, length(vW.xz)); gl_FragColor = vec4(uColor, line * uOpacity * fade); }",
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), gridMat);
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = -1; scene.add(floor);

  // Exhaust smoke: world-space soft points that trail behind the car.
  const P = 280, sPos = new Float32Array(P * 3), sSize = new Float32Array(P), sAlpha = new Float32Array(P);
  const jet = new Float32Array(P * 3), life = new Float32Array(P), maxLife = new Float32Array(P).fill(1), size0 = new Float32Array(P), alpha0 = new Float32Array(P), grow = new Float32Array(P);
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  smokeGeo.setAttribute("aSize", new THREE.BufferAttribute(sSize, 1));
  smokeGeo.setAttribute("aAlpha", new THREE.BufferAttribute(sAlpha, 1));
  const smokeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uMap: { value: smokeTexture() }, uColor: { value: new THREE.Color(0x8a93a3) }, uScale: { value: 500 } },
    vertexShader: "attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA; void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform sampler2D uMap; uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = texture2D(uMap, gl_PointCoord).a * vA * smoothstep(0.5, 0.12, d); if (a < 0.003) discard; gl_FragColor = vec4(uColor, a); }",
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.frustumCulled = false; smoke.renderOrder = 3;
  scene.add(smoke);
  let cursor = 0, smokeAlpha = 1;
  const tmp = new THREE.Vector3();
  function emit(strength) {
    const back = new THREE.Vector3(-Math.cos(car.rotation.y), 0, Math.sin(car.rotation.y));
    for (const e of exhaust) {
      const i = cursor; cursor = (cursor + 1) % P;
      tmp.copy(e); body.localToWorld(tmp);
      sPos[i * 3] = tmp.x; sPos[i * 3 + 1] = tmp.y; sPos[i * 3 + 2] = tmp.z;
      const out = 0.35 + Math.random() * 0.5 + strength * 1.3;
      jet[i * 3] = back.x * out + (Math.random() - 0.5) * (0.5 + strength * 1.2);
      jet[i * 3 + 1] = 0.1 + Math.random() * 0.25 + strength * 0.35;
      jet[i * 3 + 2] = back.z * out + (Math.random() - 0.5) * (0.5 + strength * 1.2);
      life[i] = 0; maxLife[i] = 0.8 + Math.random() * 0.7 + strength * 0.9;
      size0[i] = 0.14 + Math.random() * 0.12; grow[i] = 4 + Math.random() * 3 + strength * 5;
      alpha0[i] = (0.05 + strength * 0.3) * (0.75 + Math.random() * 0.5);
    }
  }
  function updateSmoke(dt, speed) {
    const fx = Math.cos(car.rotation.y), fz = -Math.sin(car.rotation.y), decay = Math.exp(-1.6 * dt);
    for (let i = 0; i < P; i++) {
      if (life[i] >= maxLife[i]) { sAlpha[i] = 0; sSize[i] = 0; continue; }
      life[i] += dt;
      const t = Math.min(1, life[i] / maxLife[i]);
      jet[i * 3] = jet[i * 3] * decay + (Math.random() - 0.5) * 0.9 * dt; jet[i * 3 + 2] = jet[i * 3 + 2] * decay + (Math.random() - 0.5) * 0.9 * dt;
      jet[i * 3 + 1] = jet[i * 3 + 1] * decay + 0.07 * dt;
      sPos[i * 3] += (jet[i * 3] - fx * speed * 0.35) * dt;
      sPos[i * 3 + 1] += jet[i * 3 + 1] * dt;
      sPos[i * 3 + 2] += (jet[i * 3 + 2] - fz * speed * 0.35) * dt;
      sSize[i] = size0[i] * (1 + grow[i] * (1 - Math.pow(1 - t, 2)));
      sAlpha[i] = alpha0[i] * smokeAlpha * Math.pow(1 - t, 1.6) * smooth(0, 0.08, t);
    }
    smokeGeo.attributes.position.needsUpdate = true;
    smokeGeo.attributes.aSize.needsUpdate = true;
    smokeGeo.attributes.aAlpha.needsUpdate = true;
  }

  // Camera: low 3/4 product shot that frames the car at any aspect ratio.
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 80);
  const target = new THREE.Vector3(0, 0.55, 0);
  let dist = 10, width = 1, height = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
    dist = Math.max(2.78 / Math.tan(hf), 1.34 / Math.tan(vf));
    camera.updateProjectionMatrix();
    const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
    smokeMat.uniforms.uScale.value = size.y / (2 * Math.tan(vf));
    host.classList.toggle("compact", width < 520);
  }

  function applyTheme() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    gridMat.uniforms.uColor.value.set(dark ? 0xffffff : 0x0a0c10);
    gridMat.uniforms.uOpacity.value = dark ? 0.17 : 0.11;
    glow.material.opacity = dark ? 0.95 : 0.3;
    shadow.material.opacity = dark ? 0.9 : 0.55;
    smokeMat.uniforms.uColor.value.set(dark ? 0xe6e9ef : 0xa9b0bc);
    smokeAlpha = dark ? 0.55 : 0.9;
    renderer.toneMappingExposure = dark ? 1.0 : 1.08;
  }
  applyTheme();
  document.addEventListener("themechange", applyTheme);

  // Hotspots.
  const layer = host.querySelector(".car3d-hotspots");
  const spots = opts.hotspots === false || !layer ? [] : anchors.map((a) => {
    const el = document.createElement("div");
    el.className = "hs";
    el.innerHTML = `<div class="inner"><span class="dot"></span><span class="tag"><b></b><small></small></span></div>`;
    el.querySelector("b").textContent = a.key; el.querySelector("small").textContent = a.text;
    layer.append(el);
    return { el, p: new THREE.Vector3(...a.p), n: new THREE.Vector3(...a.n).normalize() };
  });
  const wp = new THREE.Vector3(), wn = new THREE.Vector3(), vd = new THREE.Vector3();
  function updateSpots() {
    for (const s of spots) {
      wp.copy(s.p); car.localToWorld(wp);
      wn.copy(s.n).applyQuaternion(car.quaternion);
      vd.copy(camera.position).sub(wp).normalize();
      const vis = smooth(0.08, 0.35, wn.dot(vd));
      wp.project(camera);
      const x = (wp.x + 1) / 2 * width, y = (1 - wp.y) / 2 * height;
      s.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      s.el.style.opacity = vis.toFixed(2);
      s.el.classList.toggle("left", x > width * 0.6);
    }
  }

  // State and interaction.
  let yaw = opts.yaw ?? -0.25, yawVel = 0, elev = opts.elev ?? 0.2, az = 0.62, idle = 99, rev = 0, clock = 0, wheelAngle = 0;
  const par = new THREE.Vector2(), parTarget = new THREE.Vector2(), offset = new THREE.Vector2();
  let dragging = false, downX = 0, downY = 0, lastX = 0, lastY = 0, downT = 0, moved = 0;
  function revUp() {
    rev = 1; idle = 0;
    for (let k = 0; k < 22; k++) emit(1);
    host.classList.add("revving");
    clearTimeout(revUp.t); revUp.t = setTimeout(() => host.classList.remove("revving"), 700);
  }
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; moved = 0; downX = lastX = e.clientX; downY = lastY = e.clientY; downT = performance.now();
    canvas.setPointerCapture?.(e.pointerId);
    host.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = host.getBoundingClientRect();
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      yaw += dx * 0.0075; yawVel = lerp(yawVel, dx * 0.0075 * 60, 0.5);
      elev = clamp(elev - dy * 0.0035, 0.04, 0.5); idle = 0;
    } else if (e.pointerType === "mouse") {
      parTarget.set(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
    }
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false; host.classList.remove("dragging");
    canvas.releasePointerCapture?.(e.pointerId);
    if (moved < 8 && performance.now() - downT < 400) revUp();
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", (e) => { dragging = false; host.classList.remove("dragging"); canvas.releasePointerCapture?.(e.pointerId); });
  canvas.addEventListener("pointerleave", () => parTarget.set(0, 0));
  host.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { yawVel -= 1.4; idle = 0; e.preventDefault(); }
    else if (e.key === "ArrowRight") { yawVel += 1.4; idle = 0; e.preventDefault(); }
    else if (e.key === "Enter" || e.key === " ") { revUp(); e.preventDefault(); }
  });

  function update(dt) {
    clock += dt; idle += dt;
    rev = Math.max(0, rev - dt / 1.6);
    const boost = rev * rev * (3 - 2 * rev);
    const speed = (reduced ? 0 : 1.15) + 8 * boost;
    if (!dragging) {
      yaw += yawVel * dt;
      yawVel *= Math.exp(-2.6 * dt);
      if (!reduced && idle > 2.5) yaw += 0.17 * dt * smooth(2.5, 4, idle);
    }
    car.rotation.y = yaw;
    body.position.y = boost * 0.012 * Math.sin(clock * 34) + (reduced ? 0 : 0.0025 * Math.sin(clock * 2.1));
    body.rotation.z = -boost * 0.012;
    wheelAngle += (speed / RW) * dt;
    for (const w of wheels) w.spin.rotation.z = w.sign * wheelAngle;
    const fx = Math.cos(yaw), fz = -Math.sin(yaw);
    offset.x += fx * speed * dt; offset.y += fz * speed * dt;
    gridMat.uniforms.uOffset.value.copy(offset);
    const pulse = reduced ? 0.9 : 0.82 + 0.18 * Math.sin(clock * 3.2);
    glowMat.color.setScalar(pulse + boost * 1.3);
    glowLight.intensity = 5 + 3 * Math.sin(clock * 3.2) + 20 * boost;
    if (!reduced || rev > 0) {
      emitAcc += dt * (reduced ? 0 : 4) + dt * 60 * boost;
      while (emitAcc >= 1) { emit(boost); emitAcc -= 1; }
    }
    updateSmoke(dt, speed);
    par.lerp(parTarget, 1 - Math.exp(-4 * dt));
    const a = az + par.x * 0.12, el = elev - par.y * 0.05, shake = boost > 0.5 ? (Math.random() - 0.5) * 0.02 * boost : 0;
    camera.position.set(target.x + dist * Math.cos(el) * Math.sin(a), target.y + dist * Math.sin(el) + shake, target.z + dist * Math.cos(el) * Math.cos(a));
    camera.lookAt(target);
  }
  let emitAcc = 0;

  resize();
  const ro = new ResizeObserver(() => { resize(); if (!running) renderer.render(scene, camera); });
  ro.observe(host);

  let running = false, raf = 0, last = 0, visible = true, first = true, slow = 0, downgraded = false;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    slow = slow * 0.97 + (dt > 0.034 ? 0.03 : 0);
    if (!downgraded && clock > 2 && slow > 0.6) { downgraded = true; renderer.setPixelRatio(1); resize(); }
    update(dt);
    renderer.render(scene, camera);
    updateSpots();
    if (first) { first = false; ready(); }
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || still) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function ready() { host.parentElement?.classList.add("ready"); host.dispatchEvent(new CustomEvent("car3d:ready")); }

  if (still) {
    for (let k = 0; k < 3; k++) update(1 / 60);
    renderer.render(scene, camera);
    updateSpots();
    ready();
  } else {
    new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
      if (visible && !document.hidden) start(); else stop();
    }).observe(host);
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else if (visible) start(); });
    start();
  }
  return { rev: revUp, stop, start, state: () => ({ yaw, rev, running }) };
}
