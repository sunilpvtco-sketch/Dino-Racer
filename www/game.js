/* DIANO RACER — 3D jungle endless runner (Three.js r149, no build step) */
(function () {
'use strict';
const THREE = window.THREE;
const $ = (id) => document.getElementById(id);
const R = (a, b) => a + Math.random() * (b - a);
const RI = (a, b) => Math.floor(R(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const PI = Math.PI;

/* ------------------------------------------------------------ storage */
const store = {
  get(k, d) { try { const v = localStorage.getItem('diano.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('diano.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};
const settings = Object.assign({ music: true, sfx: true, vibe: true, quality: 'high' }, store.get('settings', {}));
const profile = Object.assign({ best: 0, bestDist: 0, wallet: 0, skin: 0, zone: 0, runs: [], tutorial: false }, store.get('profile', {}));
const saveProfile = () => store.set('profile', profile);

/* ------------------------------------------------------------ renderer */
const canvas = $('game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('loadText').textContent = 'WEBGL NOT AVAILABLE';
  $('loadSub').textContent = 'This device or browser cannot run 3D graphics.';
  return;
}
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
scene.fog = new THREE.Fog(0xb3cfb0, 25, 150);

function applyQuality() {
  const hi = settings.quality === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 2 : 1));
  sun && (sun.castShadow = hi);
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const vf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(34)) / camera.aspect) * 180 / PI;
  baseFov = clamp(vf, 58, 86);
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  if (particles) particles.forEach((p) => (p.mat.uniforms.scale.value = h * renderer.getPixelRatio() * 0.5));
}
let baseFov = 62;
window.addEventListener('resize', resize);

/* ------------------------------------------------------------ canvas texture helpers */
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = ANISO;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function tiled(w, h, x, y, r, fn) {
  for (let dx = -w; dx <= w; dx += w) for (let dy = -h; dy <= h; dy += h) {
    const X = x + dx, Y = y + dy;
    if (X + r < 0 || X - r > w || Y + r < 0 || Y - r > h) continue;
    fn(X, Y);
  }
}
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
function blob(g, X, Y, r, c0, c1) {
  const gr = g.createRadialGradient(X, Y, 0, X, Y, r);
  gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.fillRect(X - r, Y - r, r * 2, r * 2);
}
function speckle(g, W, H, n, fn) {
  for (let i = 0; i < n; i++) { const x = R(0, W), y = R(0, H), r = R(0.6, 2.4); g.fillStyle = fn(); g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill(); }
}
function grassEdges(g, W, H, dark) {
  for (const side of [0, 1]) {
    const gr = g.createLinearGradient(side ? W : 0, 0, side ? W - 46 : 46, 0);
    gr.addColorStop(0, dark ? 'rgba(20,40,14,.95)' : 'rgba(46,84,26,.95)'); gr.addColorStop(1, 'rgba(46,84,26,0)');
    g.fillStyle = gr; g.fillRect(side ? W - 46 : 0, 0, 46, H);
    for (let i = 0; i < 260; i++) {
      const y = R(0, H), x0 = side ? W - R(0, 10) : R(0, 10), len = R(10, 34);
      g.strokeStyle = hsl(R(85, 110), R(40, 60), R(dark ? 14 : 20, dark ? 26 : 38), 0.9); g.lineWidth = R(1.5, 3);
      g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo(x0 + (side ? -len * 0.6 : len * 0.6), y - R(-8, 8), x0 + (side ? -len : len), y + R(-10, 10)); g.stroke();
    }
  }
}
function leafSpecks(g, W, H, n, hueA, hueB) {
  for (let i = 0; i < n; i++) {
    const x = R(0, W), y = R(0, H), s = R(3, 8), a = R(0, PI);
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = hsl(R(hueA, hueB), R(40, 70), R(18, 40), 0.85);
    g.beginPath(); g.ellipse(0, 0, s, s * 0.42, 0, 0, PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
    g.restore();
  }
}

/* ---- road surfaces (each returns {map, rough}) ---- */
function genMud() {
  const W = 512, H = 1024, [c, g] = mk(W, H), [rc, rg] = mk(W, H);
  g.fillStyle = '#6b4527'; g.fillRect(0, 0, W, H);
  rg.fillStyle = '#e0e0e0'; rg.fillRect(0, 0, W, H);
  for (let i = 0; i < 170; i++) {
    const x = R(0, W), y = R(0, H), r = R(20, 75), l = R(14, 36);
    tiled(W, H, x, y, r, (X, Y) => blob(g, X, Y, r, hsl(R(20, 32), R(28, 46), l, 0.34), 'rgba(80,50,25,0)'));
  }
  speckle(g, W, H, 4200, () => hsl(R(18, 34), R(25, 45), R(12, 40), R(0.4, 0.8)));
  const lanes = [W * 0.222, W * 0.5, W * 0.778];
  g.lineCap = 'round';
  for (const lx of lanes) for (const s of [-1, 1]) {
    const ph = R(0, 6), x0 = lx + s * 26;
    const path = (off, lw, col) => {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      for (let y = -10; y <= H + 10; y += 8) { const x = x0 + off + Math.sin(y * PI * 2 / H * 3 + ph) * 5; y === -10 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    };
    path(0, 20, 'rgba(38,22,10,.5)'); path(0, 8, 'rgba(24,13,5,.55)'); path(s * 12, 3, 'rgba(176,132,86,.35)'); path(-s * 12, 2, 'rgba(176,132,86,.25)');
    g.strokeStyle = 'rgba(20,10,4,.38)'; g.lineWidth = 2;
    for (let y = 0; y < H; y += 9) { const x = x0 + Math.sin(y * PI * 2 / H * 3 + ph) * 5; g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y + 3); g.stroke(); }
  }
  for (let i = 0; i < 5; i++) {
    const x = R(40, W - 40), y = R(0, H), rx = R(16, 40), ry = R(28, 78);
    tiled(W, H, x, y, ry + 10, (X, Y) => {
      blob(g, X, Y, ry * 1.3, 'rgba(30,18,8,.45)', 'rgba(30,18,8,0)');
      g.save(); g.translate(X, Y); g.scale(1, ry / rx);
      const gr = g.createRadialGradient(-rx * 0.2, -rx * 0.3, 0, 0, 0, rx);
      gr.addColorStop(0, '#7f969a'); gr.addColorStop(0.55, '#55686c'); gr.addColorStop(1, '#33403f');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, PI * 2); g.fill();
      g.strokeStyle = 'rgba(35,20,8,.8)'; g.lineWidth = 3; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(-rx * 0.15, -rx * 0.2, rx * 0.55, PI * 1.1, PI * 1.5); g.stroke();
      g.restore();
      rg.save(); rg.translate(X, Y); rg.scale(1, ry / rx); rg.fillStyle = '#4a4a4a'; rg.beginPath(); rg.arc(0, 0, rx, 0, PI * 2); rg.fill(); rg.restore();
      rg.save(); blob(rg, X, Y, ry * 1.25, 'rgba(90,90,90,.8)', 'rgba(224,224,224,0)'); rg.restore();
    });
  }
  for (let i = 0; i < 240; i++) {
    const x = R(0, W), y = R(0, H), r = R(2, 6);
    g.fillStyle = hsl(R(25, 45), R(5, 15), R(35, 60)); g.beginPath(); g.ellipse(x, y, r, r * 0.75, R(0, PI), 0, PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, PI * 2); g.fill();
  }
  leafSpecks(g, W, H, 90, 20, 100);
  grassEdges(g, W, H, false);
  return { map: tex(c, { repeat: true }), rough: tex(rc, { repeat: true, srgb: false }) };
}
function genStones({ rowH = 64, wMin = 50, wMax = 82, hue = [30, 48], sat = [6, 14], lit = [36, 56], moss = 0.6, mortar = '#3a3427', W = 512, H = 1024, edge = true, slab = false }) {
  const [c, g] = mk(W, H), [rc, rg] = mk(W, H);
  g.fillStyle = mortar; g.fillRect(0, 0, W, H); rg.fillStyle = '#f0f0f0'; rg.fillRect(0, 0, W, H);
  speckle(g, W, H, 3000, () => hsl(R(30, 60), 20, R(10, 30), 0.6));
  const rows = Math.round(H / rowH), rh = H / rows;
  for (let r = 0; r < rows; r++) {
    let x = R(0, wMax);
    const start = x;
    while (x < start + W) {
      const w = R(wMin, wMax), y = r * rh, l = R(lit[0], lit[1]);
      const pad = slab ? 3 : 4, rad = slab ? 4 : 14;
      tiled(W, H, x + w / 2, y + rh / 2, w, (X) => {
        const x0 = X - w / 2 + pad, y0 = y + pad, ww = w - pad * 2, hh = rh - pad * 2;
        g.save(); g.beginPath(); g.roundRect ? g.roundRect(x0, y0, ww, hh, rad) : g.rect(x0, y0, ww, hh); g.clip();
        const gr = g.createLinearGradient(x0, y0, x0 + ww * 0.3, y0 + hh);
        gr.addColorStop(0, hsl(R(hue[0], hue[1]), R(sat[0], sat[1]), l + 10)); gr.addColorStop(1, hsl(R(hue[0], hue[1]), R(sat[0], sat[1]), l - 10));
        g.fillStyle = gr; g.fillRect(x0, y0, ww, hh);
        for (let k = 0; k < 18; k++) blob(g, R(x0, x0 + ww), R(y0, y0 + hh), R(4, 16), hsl(R(20, 60), 12, R(20, 70), 0.18), 'rgba(0,0,0,0)');
        if (Math.random() < 0.35) { g.strokeStyle = 'rgba(20,16,10,.55)'; g.lineWidth = 1.4; g.beginPath(); let cx = R(x0, x0 + ww), cy = y0; g.moveTo(cx, cy); for (let s = 0; s < 5; s++) { cx += R(-10, 10); cy += hh / 5; g.lineTo(cx, cy); } g.stroke(); }
        g.restore();
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.roundRect ? g.roundRect(x0, y0, ww, hh, rad) : g.rect(x0, y0, ww, hh); g.stroke();
        rg.fillStyle = '#b0b0b0'; rg.fillRect(x0, y0, ww, hh);
      });
      x += w;
    }
  }
  for (let i = 0; i < 520 * moss; i++) {
    const x = R(0, W), y = Math.round(R(0, rows)) * rh + R(-4, 4);
    tiled(W, H, x, y, 12, (X, Y) => blob(g, X, Y, R(4, 12), hsl(R(80, 105), R(40, 60), R(22, 34), 0.75), 'rgba(40,80,20,0)'));
  }
  if (edge) grassEdges(g, W, H, false);
  return { map: tex(c, { repeat: true }), rough: tex(rc, { repeat: true, srgb: false }) };
}
function genPlanks() {
  const W = 512, H = 1024, [c, g] = mk(W, H), [rc, rg] = mk(W, H);
  g.fillStyle = '#1b1008'; g.fillRect(0, 0, W, H); rg.fillStyle = '#dcdcdc'; rg.fillRect(0, 0, W, H);
  const n = 22, ph = H / n;
  for (let i = 0; i < n; i++) {
    const y = i * ph + 3, hh = ph - 6, l = R(24, 36), hu = R(22, 32);
    const off = R(-10, 10);
    g.fillStyle = hsl(hu, R(38, 50), l); g.fillRect(off, y, W, hh);
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = hsl(hu, 40, l + R(-12, 8), 0.5); g.lineWidth = R(0.8, 2.2);
      g.beginPath(); const yy = y + R(2, hh - 2); g.moveTo(0, yy);
      for (let x = 0; x <= W; x += 32) g.lineTo(x, yy + Math.sin(x * 0.02 + k) * 1.6);
      g.stroke();
    }
    for (let k = 0; k < 2; k++) blob(g, R(0, W), y + hh / 2, R(5, 12), 'rgba(40,20,6,.6)', 'rgba(40,20,6,0)');
    for (const nx of [26, W / 2, W - 26]) { g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(nx + off * 0.2, y + hh * 0.3, 3, 0, PI * 2); g.arc(nx + off * 0.2, y + hh * 0.7, 3, 0, PI * 2); g.fill(); }
    const gr = g.createLinearGradient(0, y, 0, y + hh); gr.addColorStop(0, 'rgba(255,220,170,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = gr; g.fillRect(0, y, W, hh);
    if (Math.random() < 0.3) leafSpecks(g, W, 0, 0, 0, 0);
  }
  leafSpecks(g, W, H, 30, 60, 110);
  return { map: tex(c, { repeat: true }), rough: tex(rc, { repeat: true, srgb: false }) };
}
function genCaveFloor() {
  const W = 512, H = 1024, [c, g] = mk(W, H), [rc, rg] = mk(W, H);
  g.fillStyle = '#2c2723'; g.fillRect(0, 0, W, H); rg.fillStyle = '#d0d0d0'; rg.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { const x = R(0, W), y = R(0, H), r = R(10, 50); tiled(W, H, x, y, r, (X, Y) => blob(g, X, Y, r, hsl(R(15, 35), R(5, 18), R(12, 30), 0.5), 'rgba(0,0,0,0)')); }
  speckle(g, W, H, 3000, () => hsl(R(20, 220), R(5, 20), R(8, 40), 0.6));
  for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(8,6,5,.7)'; g.lineWidth = R(1, 2.5); g.beginPath(); let x = R(0, W), y = R(0, H); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += R(-18, 18); y += R(-18, 18); g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 9; i++) {
    const x = R(30, W - 30), y = R(0, H), rx = R(18, 45), ry = R(30, 80);
    tiled(W, H, x, y, ry, (X, Y) => {
      g.save(); g.translate(X, Y); g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, '#2d6f9c'); gr.addColorStop(1, '#10273a');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, PI * 2); g.fill(); g.restore();
      rg.save(); rg.translate(X, Y); rg.scale(1, ry / rx); rg.fillStyle = '#1a1a1a'; rg.beginPath(); rg.arc(0, 0, rx, 0, PI * 2); rg.fill(); rg.restore();
    });
  }
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(110,210,255,${R(0.3, 0.9)})`; g.beginPath(); g.arc(R(0, W), R(0, H), R(0.8, 2), 0, PI * 2); g.fill(); }
  return { map: tex(c, { repeat: true }), rough: tex(rc, { repeat: true, srgb: false }) };
}
function genGround(dark) {
  const W = 512, H = 512, [c, g] = mk(W, H);
  g.fillStyle = dark ? '#1a2410' : '#27361a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) { const x = R(0, W), y = R(0, H), r = R(15, 60); tiled(W, H, x, y, r, (X, Y) => blob(g, X, Y, r, hsl(R(30, 95), R(25, 45), R(12, 30), 0.45), 'rgba(0,0,0,0)')); }
  leafSpecks(g, W, H, 900, 20, 120);
  for (let i = 0; i < 700; i++) { const x = R(0, W), y = R(0, H); g.strokeStyle = hsl(R(80, 115), 50, R(18, 36), 0.8); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-4, 4), y - R(5, 12)); g.stroke(); }
  return tex(c, { repeat: true });
}
function genBark(rings) {
  const W = 256, H = 512, [c, g] = mk(W, H);
  g.fillStyle = rings ? '#6a5236' : '#4a3220'; g.fillRect(0, 0, W, H);
  if (rings) {
    for (let x = 0; x < W; x += R(10, 18)) { g.fillStyle = hsl(30, R(20, 35), R(18, 34), 0.8); g.fillRect(x, 0, R(3, 7), H); }
    speckle(g, W, H, 1500, () => hsl(30, 25, R(15, 50), 0.5));
  } else {
    for (let i = 0; i < 160; i++) { g.strokeStyle = hsl(R(20, 32), R(20, 40), R(10, 32), 0.8); g.lineWidth = R(1, 4); g.beginPath(); let x = R(0, W); g.moveTo(x, 0); for (let y = 0; y <= H; y += 32) { x += R(-4, 4); g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 40; i++) blob(g, R(0, W), R(0, H), R(8, 26), 'rgba(60,110,30,.5)', 'rgba(60,110,30,0)');
  }
  return tex(c, { repeat: true });
}
function genFrond(kind) {
  const W = 256, H = 512, [c, g] = mk(W, H);
  const cx = W / 2;
  const base = kind === 'fern' ? [95, 60, 30] : kind === 'banana' ? [100, 55, 32] : [92, 58, 28];
  if (kind === 'banana') {
    g.save(); g.beginPath(); g.moveTo(cx, H);
    g.bezierCurveTo(cx - W * 0.62, H * 0.75, cx - W * 0.5, H * 0.15, cx, 0);
    g.bezierCurveTo(cx + W * 0.5, H * 0.15, cx + W * 0.62, H * 0.75, cx, H); g.closePath(); g.clip();
    const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, hsl(98, 55, 22)); gr.addColorStop(0.5, hsl(96, 60, 36)); gr.addColorStop(1, hsl(100, 55, 24));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let y = 8; y < H; y += 7) { g.strokeStyle = 'rgba(10,40,5,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx - 60, y - 22, 0, y - 40); g.moveTo(cx, y); g.quadraticCurveTo(cx + 60, y - 22, W, y - 40); g.stroke(); }
    for (let i = 0; i < 5; i++) { const y = R(60, H - 60); g.clearRect(R(0, 30), y, R(50, 90), 2.5); g.clearRect(W - R(80, 120), y + 30, R(50, 120), 2.5); }
    g.restore();
    g.strokeStyle = hsl(80, 45, 55); g.lineWidth = 7; g.beginPath(); g.moveTo(cx, H); g.lineTo(cx, 6); g.stroke();
    return tex(c);
  }
  g.strokeStyle = hsl(70, 40, 30); g.lineWidth = kind === 'fern' ? 5 : 8; g.beginPath(); g.moveTo(cx, H); g.lineTo(cx, 4); g.stroke();
  const step = kind === 'fern' ? 9 : 11;
  for (let y = H - 10; y > 8; y -= step) {
    const t = 1 - y / H, len = (kind === 'fern' ? 112 : 120) * Math.sin(Math.min(1, (1 - t) * 1.15 + 0.05) * PI * 0.92) * (0.75 + 0.25 * (1 - t));
    for (const s of [-1, 1]) {
      const ang = (kind === 'fern' ? 0.55 : 0.75), x2 = cx + s * len, y2 = y - len * ang;
      const l = base[2] + R(-5, 9);
      g.fillStyle = hsl(base[0] + R(-8, 8), base[1], l);
      g.beginPath(); g.moveTo(cx, y);
      g.quadraticCurveTo(cx + s * len * 0.5, y - len * ang * 0.35 - (kind === 'fern' ? 5 : 8), x2, y2);
      g.quadraticCurveTo(cx + s * len * 0.5, y - len * ang * 0.35 + (kind === 'fern' ? 4 : 7), cx, y + 3);
      g.fill();
      g.strokeStyle = 'rgba(200,240,140,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, y); g.lineTo(x2, y2); g.stroke();
    }
  }
  return tex(c);
}
function genGrass() {
  const W = 256, H = 128, [c, g] = mk(W, H);
  for (let i = 0; i < 70; i++) {
    const x = R(10, W - 10), h = R(50, 125), lean = R(-30, 30);
    g.fillStyle = hsl(R(80, 110), R(45, 65), R(18, 40));
    g.beginPath(); g.moveTo(x - 3, H); g.quadraticCurveTo(x + lean * 0.3, H - h * 0.6, x + lean, H - h); g.quadraticCurveTo(x + lean * 0.3 + 2, H - h * 0.6, x + 3, H); g.fill();
  }
  return tex(c);
}
function genRock() {
  const W = 256, H = 256, [c, g] = mk(W, H);
  g.fillStyle = '#76736a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) { const x = R(0, W), y = R(0, H), r = R(4, 30); tiled(W, H, x, y, r, (X, Y) => blob(g, X, Y, r, hsl(R(30, 60), R(4, 12), R(25, 65), 0.35), 'rgba(0,0,0,0)')); }
  speckle(g, W, H, 2500, () => hsl(40, 8, R(15, 75), 0.6));
  for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(30,28,24,.6)'; g.lineWidth = 1.2; g.beginPath(); let x = R(0, W), y = R(0, H); g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += R(-15, 15); y += R(-15, 15); g.lineTo(x, y); } g.stroke(); }
  return tex(c, { repeat: true });
}
function genWaterfall() {
  const W = 128, H = 512, [c, g] = mk(W, H);
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(160,215,235,.15)'); gr.addColorStop(0.2, 'rgba(200,238,250,.75)'); gr.addColorStop(0.8, 'rgba(200,238,250,.75)'); gr.addColorStop(1, 'rgba(160,215,235,.15)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) { const x = R(4, W - 4), y = R(0, H), l = R(30, 140); g.strokeStyle = `rgba(255,255,255,${R(0.25, 0.85)})`; g.lineWidth = R(1, 4); g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-2, 2), y + l); g.stroke(); g.beginPath(); g.moveTo(x, y - H); g.lineTo(x, y - H + l); g.stroke(); }
  return tex(c, { repeat: true });
}
function genWater() {
  const W = 256, H = 256, [c, g] = mk(W, H);
  g.fillStyle = '#2f7f8f'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { const x = R(0, W), y = R(0, H), r = R(10, 40); tiled(W, H, x, y, r, (X, Y) => blob(g, X, Y, r, hsl(R(180, 195), 50, R(25, 45), 0.4), 'rgba(0,0,0,0)')); }
  for (let i = 0; i < 70; i++) { const x = R(0, W), y = R(0, H), w = R(10, 40); tiled(W, H, x, y, w, (X, Y) => { g.strokeStyle = `rgba(220,250,255,${R(0.15, 0.5)})`; g.lineWidth = R(1, 2.5); g.beginPath(); g.moveTo(X - w / 2, Y); g.quadraticCurveTo(X, Y - 4, X + w / 2, Y); g.stroke(); }); }
  return tex(c, { repeat: true });
}
function genCaveWall() {
  const W = 512, H = 256, [c, g] = mk(W, H);
  g.fillStyle = '#2a2a33'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) { const x = R(0, W), y = R(0, H), r = R(8, 40); tiled(W, H, x, y, r, (X, Y) => blob(g, X, Y, r, hsl(R(200, 260), R(5, 20), R(8, 32), 0.45), 'rgba(0,0,0,0)')); }
  for (let y = 0; y < H; y += R(6, 16)) { g.strokeStyle = `rgba(0,0,0,${R(0.2, 0.5)})`; g.lineWidth = R(1, 3); g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 32) g.lineTo(x, y + R(-3, 3)); g.stroke(); }
  speckle(g, W, H, 1500, () => (Math.random() < 0.1 ? 'rgba(90,190,255,.7)' : hsl(220, 10, R(10, 50), 0.5)));
  return tex(c, { repeat: true });
}
function genSkin(sk) {
  const W = 512, H = 512, [c, g] = mk(W, H), [bc, bg] = mk(W, H);
  g.fillStyle = sk.base; g.fillRect(0, 0, W, H);
  const bel = g.createLinearGradient(W * 0.03, 0, W * 0.47, 0);
  bel.addColorStop(0, 'rgba(0,0,0,0)'); bel.addColorStop(0.3, sk.belly); bel.addColorStop(0.7, sk.belly); bel.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = bel; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) { const x = R(0, W), y = R(0, H), r = R(5, 24); const near = Math.abs(x / W - 0.25) < 0.14; if (near && Math.random() < 0.8) continue; tiled(W, H, x, y, r, (X, Y) => blob(g, X, Y, r, Math.random() < 0.6 ? sk.dark : sk.light, 'rgba(0,0,0,0)')); }
  for (let k = 0; k < 13; k++) {
    const y = k * H / 13 + R(-6, 6), th = R(9, 15);
    g.fillStyle = sk.stripe; g.beginPath();
    g.moveTo(W * 0.55, y);
    for (let x = W * 0.55; x <= W * 0.95; x += 8) { const t = (x / W - 0.75) / 0.2; g.lineTo(x, y - th * (1 - t * t) + Math.sin(x * 0.2) * 1.5); }
    for (let x = W * 0.95; x >= W * 0.55; x -= 8) { const t = (x / W - 0.75) / 0.2; g.lineTo(x, y + th * (1 - t * t) * 0.6); }
    g.fill();
  }
  g.fillStyle = sk.spine; g.fillRect(W * 0.745, 0, W * 0.012, H);
  bg.fillStyle = '#808080'; bg.fillRect(0, 0, W, H);
  const cell = 14;
  for (let y = 0, row = 0; y < H + cell; y += cell * 0.86, row++) for (let x = (row % 2) * cell / 2; x < W + cell; x += cell) {
    blob(bg, x, y, cell * 0.62, 'rgba(255,255,255,.6)', 'rgba(40,40,40,.0)');
    g.strokeStyle = 'rgba(0,0,0,.035)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, cell * 0.48, 0, PI * 2); g.stroke();
  }
  return { map: tex(c, { repeat: true }), bump: tex(bc, { repeat: true, srgb: false }) };
}
function genLimb(sk) {
  const W = 256, H = 256, [c, g] = mk(W, H);
  g.fillStyle = sk.base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 110; i++) { const x = R(0, W), y = R(0, H), r = R(6, 20); tiled(W, H, x, y, r, (X, Y) => blob(g, X, Y, r, Math.random() < 0.6 ? sk.dark : sk.light, 'rgba(0,0,0,0)')); }
  const cell = 10;
  for (let y = 0, row = 0; y < H + cell; y += cell * 0.86, row++) for (let x = (row % 2) * cell / 2; x < W + cell; x += cell) { g.strokeStyle = 'rgba(0,0,0,.04)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, cell * 0.46, 0, PI * 2); g.stroke(); }
  return tex(c, { repeat: true });
}
function genCoinFace() {
  const W = 256, [c, g] = mk(W, W), m = W / 2;
  let gr = g.createRadialGradient(m * 0.8, m * 0.7, 10, m, m, m);
  gr.addColorStop(0, '#fff4a0'); gr.addColorStop(0.5, '#ffcc2a'); gr.addColorStop(1, '#c97a00');
  g.fillStyle = gr; g.fillRect(0, 0, W, W);
  g.strokeStyle = '#b06800'; g.lineWidth = 10; g.beginPath(); g.arc(m, m, m * 0.8, 0, PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,250,200,.8)'; g.lineWidth = 3; g.beginPath(); g.arc(m, m, m * 0.72, 0, PI * 2); g.stroke();
  g.fillStyle = '#a45f00'; g.save(); g.translate(m, m + 6);
  g.beginPath(); g.moveTo(-14, 34); g.lineTo(14, 34); g.lineTo(18, 6); g.lineTo(44, -30); g.lineTo(28, -34); g.lineTo(8, -6); g.lineTo(6, -46); g.lineTo(-6, -46); g.lineTo(-8, -6); g.lineTo(-28, -34); g.lineTo(-44, -30); g.lineTo(-18, 6); g.closePath(); g.fill();
  g.restore();
  return tex(c);
}
function genSpots() {
  const W = 256, H = 256, [c, g] = mk(W, H);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ffe36a'); gr.addColorStop(1, '#d99a12');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const x = R(0, W), y = R(0, H), r = R(6, 18); tiled(W, H, x, y, r, (X, Y) => { g.fillStyle = hsl(30, 60, R(18, 30), 0.9); g.beginPath(); g.ellipse(X, Y, r, r * R(0.6, 1), R(0, PI), 0, PI * 2); g.fill(); }); }
  return tex(c, { repeat: true });
}
function genGlow() {
  const [c, g] = mk(128, 128);
  blob(g, 64, 64, 64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  return tex(c);
}
function genMountains(layer) {
  const W = 2048, H = 512, [c, g] = mk(W, H);
  const pts = []; const n = 64; let y = H * (layer === 0 ? 0.35 : layer === 1 ? 0.5 : 0.62);
  for (let i = 0; i <= n; i++) { y += R(-1, 1) * H * (layer === 0 ? 0.09 : 0.06); y = clamp(y, H * 0.12, H * 0.8); pts.push(y); }
  pts[n] = pts[0];
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, H);
  for (let i = 0; i <= n; i++) g.lineTo(i * W / n, pts[i]);
  g.lineTo(W, H); g.closePath(); g.fill();
  if (layer === 0) {
    for (const px of [0.18, 0.62]) {
      const x = W * px, base = pts[Math.round(px * n)] + 12;
      for (let s = 0; s < 6; s++) { const w = 120 - s * 18, h = 22; g.fillRect(x - w / 2, base - (s + 1) * h, w, h + 1); }
      g.fillRect(x - 8, base - 6 * 22 - 26, 16, 28);
      g.fillStyle = 'rgba(255,255,255,.0)';
      g.fillStyle = '#fff';
    }
  }
  if (layer === 1) {
    for (let i = 0; i < 70; i++) { const x = R(0, W), yy = pts[Math.round(x / W * n)] + R(-6, 6), r = R(10, 26); g.beginPath(); g.arc(x, yy, r, 0, PI * 2); g.fill(); }
  }
  if (layer === 2) {
    for (let i = 0; i < 220; i++) { const x = R(0, W), yy = pts[Math.round(x / W * n)] + R(-4, 4), r = R(10, 30); g.beginPath(); g.arc(x, yy, r, 0, PI * 2); g.fill(); if (Math.random() < 0.25) { g.fillRect(x - 2, yy - r - 40, 4, 40); for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + Math.cos(k * 1.3) * 18, yy - r - 40, 22, 6, k * 1.3, 0, PI * 2); g.fill(); } } }
  }
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function genSign(lines, opts = {}) {
  const W = 512, H = 256, [c, g] = mk(W, H);
  g.fillStyle = '#5a3818'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) { const y = i * H / 4; g.fillStyle = hsl(28, 42, R(26, 34)); g.fillRect(0, y + 3, W, H / 4 - 6); for (let k = 0; k < 8; k++) { g.strokeStyle = 'rgba(30,15,4,.35)'; g.lineWidth = 1.2; g.beginPath(); const yy = y + R(6, H / 4 - 6); g.moveTo(0, yy); g.lineTo(W, yy + R(-3, 3)); g.stroke(); } }
  g.strokeStyle = '#2a1607'; g.lineWidth = 12; g.strokeRect(6, 6, W - 12, H - 12);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = opts.size || 70;
  lines.forEach((ln, i) => {
    g.font = `${i === 0 ? fs : fs * 0.72}px "Lilita One", "Arial Black", Impact, sans-serif`;
    const y = H / 2 + (i - (lines.length - 1) / 2) * fs * 0.95;
    g.fillStyle = '#1d0e03'; g.fillText(ln, W / 2 + 3, y + 4);
    g.fillStyle = opts.color || '#ffcf4a'; g.fillText(ln, W / 2, y);
  });
  return tex(c);
}
function genCrate() {
  const W = 256, [c, g] = mk(W, W);
  g.fillStyle = '#8a5a2c'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 6; i++) { g.fillStyle = hsl(28, 45, R(30, 40)); g.fillRect(0, i * W / 6 + 2, W, W / 6 - 4); }
  g.strokeStyle = '#4a2c10'; g.lineWidth = 26; g.strokeRect(13, 13, W - 26, W - 26);
  g.beginPath(); g.moveTo(20, 20); g.lineTo(W - 20, W - 20); g.stroke();
  g.strokeStyle = '#a06a35'; g.lineWidth = 18; g.strokeRect(13, 13, W - 26, W - 26); g.beginPath(); g.moveTo(20, 20); g.lineTo(W - 20, W - 20); g.stroke();
  for (const p of [[20, 20], [W - 20, 20], [20, W - 20], [W - 20, W - 20]]) { g.fillStyle = '#333'; g.beginPath(); g.arc(p[0], p[1], 5, 0, PI * 2); g.fill(); }
  return tex(c);
}
function genLogEnd() {
  const W = 128, [c, g] = mk(W, W), m = W / 2;
  g.fillStyle = '#c99a62'; g.fillRect(0, 0, W, W);
  for (let r = 4; r < m; r += R(3, 7)) { g.strokeStyle = hsl(30, 40, R(35, 50), 0.8); g.lineWidth = R(1, 2); g.beginPath(); g.arc(m + R(-1, 1), m + R(-1, 1), r, 0, PI * 2); g.stroke(); }
  g.strokeStyle = '#4a3020'; g.lineWidth = 10; g.beginPath(); g.arc(m, m, m - 4, 0, PI * 2); g.stroke();
  return tex(c);
}
function genBanner() {
  const W = 128, H = 256, [c, g] = mk(W, H);
  g.fillStyle = '#b3261e'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W / 2, H - 40); g.lineTo(0, H); g.fill();
  g.fillStyle = '#e8c070'; for (let i = 0; i < 3; i++) { g.save(); g.translate(W / 2 - 22 + i * 22, 90); g.rotate(0.3); g.fillRect(-4, -36, 8, 72); g.restore(); }
  g.strokeStyle = '#5a0f0a'; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, H - 60);
  return tex(c);
}

/* ------------------------------------------------------------ skins */
const SKINS = [
  { name: 'DIANO', desc: 'Brave and balanced. The jungle\'s favourite runner.', stats: [3, 3, 3], base: '#6d8f3e', dark: 'rgba(40,70,22,.55)', light: 'rgba(150,170,80,.35)', belly: '#e7d3a1', stripe: 'rgba(196,84,34,.9)', spine: '#d7682c', spike: 0xe0602a, limb: '#64853a', claw: 0x24180f },
  { name: 'RUSTY', desc: 'The fastest legs in the valley, but a shorter hop.', stats: [4, 2, 3], base: '#9a6b3f', dark: 'rgba(90,50,20,.55)', light: 'rgba(200,150,90,.3)', belly: '#ecd2a8', stripe: 'rgba(150,52,24,.85)', spine: '#c9521f', spike: 0xc9521f, limb: '#8f6239', claw: 0x241510 },
  { name: 'FROST', desc: 'Light as snow. Jumps highest, power-ups last longer.', stats: [2, 4, 4], base: '#cfd0c8', dark: 'rgba(110,110,105,.55)', light: 'rgba(255,255,250,.4)', belly: '#f4efe2', stripe: 'rgba(110,112,110,.75)', spine: '#b8653c', spike: 0xc0704a, limb: '#c2c3bb', claw: 0x2b2b2b }
];
const skinCache = {};
function skinTextures(i) {
  if (!skinCache[i]) { const s = genSkin(SKINS[i]); s.limb = genLimb({ ...SKINS[i], base: SKINS[i].limb }); skinCache[i] = s; }
  return skinCache[i];
}

/* ------------------------------------------------------------ materials */
const allMats = [];
function std(o) { const m = new THREE.MeshStandardMaterial(o); allMats.push(m); return m; }
const MAT = {}, TEX = {};
let roadMats = {};

function buildMaterials() {
  TEX.mud = genMud();
  TEX.cobble = genStones({ rowH: 60, wMin: 46, wMax: 80, lit: [36, 54], moss: 0.8 });
  TEX.slab = genStones({ rowH: 128, wMin: 110, wMax: 170, hue: [35, 48], sat: [10, 20], lit: [42, 60], moss: 1.1, mortar: '#3d3322', slab: true });
  TEX.plank = genPlanks();
  TEX.cave = genCaveFloor();
  TEX.ground = genGround(false);
  TEX.bark = genBark(false); TEX.palmBark = genBark(true);
  TEX.frond = genFrond('palm'); TEX.fern = genFrond('fern'); TEX.banana = genFrond('banana');
  TEX.grass = genGrass(); TEX.rock = genRock();
  TEX.waterfall = genWaterfall(); TEX.water = genWater();
  TEX.caveWall = genCaveWall(); TEX.coin = genCoinFace(); TEX.spots = genSpots(); TEX.glow = genGlow();
  TEX.crate = genCrate(); TEX.logEnd = genLogEnd(); TEX.banner = genBanner();
  TEX.blocks = genStones({ W: 256, H: 256, rowH: 64, wMin: 70, wMax: 110, hue: [35, 50], sat: [8, 16], lit: [40, 58], moss: 0.9, mortar: '#2f2a1f', edge: false, slab: true });

  const road = (t, o = {}) => { t.map.repeat.set(1, 2); t.rough.repeat.set(1, 2); return std({ map: t.map, roughnessMap: t.rough, roughness: 1, metalness: 0, ...o }); };
  roadMats = { jungle: road(TEX.mud), waterfall: road(TEX.cobble), ruins: road(TEX.slab), bridge: road(TEX.plank), cave: road(TEX.cave) };
  TEX.ground.repeat.set(10, 6);
  MAT.ground = std({ map: TEX.ground, roughness: 1 });
  TEX.bark.repeat.set(2, 2);
  MAT.bark = std({ map: TEX.bark, roughness: 0.95 });
  MAT.palmBark = std({ map: TEX.palmBark, roughness: 0.9 });
  MAT.frond = std({ map: TEX.frond, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
  MAT.fern = std({ map: TEX.fern, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
  MAT.banana = std({ map: TEX.banana, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6 });
  MAT.grass = std({ map: TEX.grass, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  MAT.canopy = [0x1d5414, 0x2c7019, 0x153f0f, 0x3a8420].map((c) => std({ color: c, roughness: 0.85, flatShading: true }));
  MAT.bush = std({ color: 0x24591a, roughness: 0.85, flatShading: true });
  MAT.flower = std({ color: 0xe8333a, roughness: 0.5, emissive: 0x400000 });
  MAT.rock = std({ map: TEX.rock, color: 0xb0aa9c, roughness: 0.92, flatShading: true });
  MAT.moss = std({ color: 0x4d7d26, roughness: 1, flatShading: true });
  MAT.wood = std({ color: 0x7a5230, map: TEX.bark, roughness: 0.9 });
  MAT.woodLight = std({ color: 0xb38152, roughness: 0.85 });
  MAT.rope = std({ color: 0xb49460, roughness: 1 });
  TEX.blocks.map.repeat.set(1, 1);
  MAT.stone = std({ map: TEX.blocks.map, roughness: 0.95 });
  MAT.statue = std({ map: TEX.rock, color: 0xa39c82, roughness: 0.95, flatShading: true });
  MAT.vine = std({ color: 0x3a6e1e, roughness: 0.9 });
  MAT.metal = std({ color: 0x8a8f96, roughness: 0.3, metalness: 0.85 });
  MAT.bone = std({ color: 0xe9dcc0, roughness: 0.6 });
  MAT.crate = std({ map: TEX.crate, roughness: 0.85 });
  MAT.logEnd = std({ map: TEX.logEnd, roughness: 0.9 });
  MAT.cliff = std({ map: TEX.rock, color: 0x8c8678, roughness: 0.95, flatShading: true });
  TEX.caveWall.repeat.set(4, 3);
  MAT.caveWall = std({ map: TEX.caveWall, roughness: 0.85, flatShading: true });
  MAT.crystal = std({ color: 0x2f9cff, emissive: 0x0a62ff, emissiveIntensity: 1.0, roughness: 0.15, metalness: 0.1, flatShading: true });
  MAT.banner = std({ map: TEX.banner, side: THREE.DoubleSide, roughness: 0.9 });
  MAT.hole = new THREE.MeshBasicMaterial({ color: 0x050302 });
  MAT.flame = new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  MAT.flameCore = new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  TEX.water.repeat.set(10, 3);
  MAT.water = std({ map: TEX.water, color: 0x9fe0ee, roughness: 0.08, metalness: 0.15 });
  TEX.waterfall.repeat.set(1, 1.5);
  MAT.waterfall = new THREE.MeshBasicMaterial({ map: TEX.waterfall, transparent: true, depthWrite: false, opacity: 0.95 });
  MAT.foam = new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.85 });
  MAT.glowSprite = (color) => new THREE.SpriteMaterial({ map: TEX.glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  MAT.coinFace = std({ map: TEX.coin, metalness: 0.85, roughness: 0.28, emissive: 0x3a2400, emissiveMap: TEX.coin, emissiveIntensity: 0.6 });
  MAT.coinEdge = std({ color: 0xe8a510, metalness: 0.9, roughness: 0.25, emissive: 0x3a2000 });
  MAT.signs = {};
  const signTxt = { jungle: ['JUNGLE PATH', 'RUN!'], waterfall: ['WATERFALL', 'AREA'], ruins: ['ANCIENT', 'RUINS'], bridge: ['WOODEN', 'BRIDGE'], cave: ['DANGER', 'CAVE AHEAD'] };
  for (const k in signTxt) MAT.signs[k] = std({ map: genSign(signTxt[k], { color: k === 'cave' ? '#ff5a3a' : '#ffcf4a' }), roughness: 0.85 });
}

/* ------------------------------------------------------------ geometry helpers */
const G = {};
function M(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); return m;
}
function jitter(geo, amt) {
  const p = geo.attributes.position, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let f = map.get(k); if (f === undefined) { f = 1 + R(-amt, amt); map.set(k, f); }
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  geo.computeVertexNormals(); return geo;
}
function bentLeaf(w, L, sw, sl, { lift = 0.45, droop = 0.85, fold = 0.25, taper = 0.15 } = {}) {
  const g = new THREE.PlaneGeometry(w, L, sw, sl); g.translate(0, L / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = y / L;
    p.setXYZ(i, x * (1 - t * taper), L * (lift * t - droop * t * t) - Math.abs(x) * fold, -L * t * 0.95);
  }
  g.computeVertexNormals(); return g;
}
function crossedPlanes(w, h, n = 3) {
  const out = [];
  for (let i = 0; i < n; i++) { const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0); g.rotateY(i * PI / n); out.push(g); }
  return mergeGeos(out);
}
function mergeGeos(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    pos.set(p.array, vo * 3); if (n) nor.set(n.array, vo * 3); if (u) uv.set(u.array, vo * 2);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; }
    else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
const _m4 = new THREE.Matrix4();
function bake(src) {
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
  const buckets = new Map(), keep = [];
  src.traverse((o) => {
    if (!o.isMesh && !o.isSprite) return;
    if (o.isSprite || o.userData.keep) { keep.push(o); return; }
    const g = o.geometry.clone(); g.applyMatrix4(_m4.multiplyMatrices(inv, o.matrixWorld));
    let b = buckets.get(o.material); if (!b) { b = { mat: o.material, list: [], cast: false }; buckets.set(o.material, b); }
    b.list.push(g); if (o.castShadow) b.cast = true;
  });
  const out = new THREE.Group();
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeGeos(b.list), b.mat); m.castShadow = b.cast; m.receiveShadow = true; out.add(m);
    b.list.forEach((g) => g.dispose());
  }
  for (const k of keep) { const w = new THREE.Vector3(); k.getWorldPosition(w); src.worldToLocal(w); k.parent.remove(k); k.position.copy(w); out.add(k); }
  return out;
}

function buildGeometries() {
  G.box = new THREE.BoxGeometry(1, 1, 1);
  G.cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  G.cylT = new THREE.CylinderGeometry(0.62, 1, 1, 9);
  G.cone = new THREE.ConeGeometry(1, 1, 8);
  G.ico0 = new THREE.IcosahedronGeometry(1, 0);
  G.ico1 = new THREE.IcosahedronGeometry(1, 1);
  G.sph = new THREE.SphereGeometry(1, 14, 10);
  G.rocks = [0, 1, 2, 3, 4].map(() => jitter(new THREE.IcosahedronGeometry(1, 1), 0.2));
  G.blobs = [0, 1, 2].map(() => jitter(new THREE.IcosahedronGeometry(1, 1), 0.14));
  G.frond = bentLeaf(1.0, 3.3, 2, 8, { lift: 0.5, droop: 0.95, fold: 0.28 });
  G.banana = bentLeaf(0.95, 2.3, 1, 6, { lift: 1.0, droop: 0.9, fold: 0.18, taper: 0 });
  G.fern = bentLeaf(0.55, 1.5, 1, 5, { lift: 0.8, droop: 0.7, fold: 0.1 });
  G.grass = crossedPlanes(1.2, 0.6, 3);
  G.plane = new THREE.PlaneGeometry(1, 1);
  G.road = new THREE.PlaneGeometry(7.2, 24).rotateX(-PI / 2).translate(0, 0, -12);
  G.side = new THREE.PlaneGeometry(40, 24).rotateX(-PI / 2).translate(0, 0, -12);
  G.torus = new THREE.TorusGeometry(0.6, 0.06, 6, 18, PI);
  G.octa = new THREE.OctahedronGeometry(1, 0);
  // cave half-tube with inward normals; seam rings are left un-jittered so chunks join seamlessly
  const tube = new THREE.CylinderGeometry(7.6, 7.6, 24, 22, 8, true, PI / 2, PI);
  tube.rotateX(PI / 2);
  const p = tube.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(Math.abs(z) - 12) < 0.01) continue;
    const f = 1 + R(-0.09, 0.09); p.setXYZ(i, x * f, Math.max(0, y * f), z);
  }
  const ix = tube.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; }
  tube.translate(0, 0, -12); tube.computeVertexNormals();
  G.caveTube = tube;
}

/* ------------------------------------------------------------ props */
function palm(g, x, z, h = R(6, 9)) {
  const lean = R(-1.4, 1.4) * Math.sign(-x || 1) * -1, lz = R(-0.6, 0.6);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.2, h * 0.35, lz * 0.2), new THREE.Vector3(lean * 0.6, h * 0.7, lz * 0.6), new THREE.Vector3(lean, h, lz)]);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.2, 7), MAT.palmBark);
  trunk.position.set(x, 0, z); trunk.castShadow = true; g.add(trunk);
  const top = new THREE.Vector3(x + lean, h, z + lz);
  const n = RI(8, 10);
  for (let i = 0; i < n; i++) { const f = M(G.frond, MAT.frond, top.x, top.y, top.z, R(0.85, 1.15), R(0.8, 1.1), R(0.85, 1.15), 0, i * PI * 2 / n + R(-0.2, 0.2), 0); f.rotation.order = 'YXZ'; f.rotation.x = R(-0.15, 0.25); f.castShadow = true; g.add(f); }
  for (let i = 0; i < 3; i++) g.add(M(G.sph, MAT.wood, top.x + R(-0.25, 0.25), top.y - 0.25, top.z + R(-0.25, 0.25), 0.16, 0.16, 0.16));
}
function bigTree(g, x, z, s = R(0.9, 1.4)) {
  const h = R(5.5, 8) * s;
  const t = M(G.cylT, MAT.bark, x, h / 2, z, 0.42 * s, h, 0.42 * s); t.castShadow = true; g.add(t);
  for (let i = 0; i < 5; i++) { const a = i * PI * 2 / 5 + R(-0.3, 0.3); g.add(M(G.cone, MAT.bark, x + Math.cos(a) * 0.5 * s, 0.6 * s, z + Math.sin(a) * 0.5 * s, 0.22 * s, 1.5 * s, 0.22 * s, Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55)); }
  const n = RI(5, 7);
  for (let i = 0; i < n; i++) {
    const a = R(0, PI * 2), d = R(0.6, 2.2) * s, r = R(1.5, 2.4) * s;
    const b = M(pick(G.blobs), pick(MAT.canopy), x + Math.cos(a) * d, h + R(-0.8, 1.6) * s, z + Math.sin(a) * d, r, r * R(0.65, 0.85), r);
    b.castShadow = true; g.add(b);
    for (let k = 0; k < 3; k++) { const f = M(G.frond, MAT.frond, b.position.x, b.position.y + r * 0.3, b.position.z, r * 0.55, r * 0.5, r * 0.55, 0, R(0, PI * 2), 0); f.rotation.order = 'YXZ'; f.rotation.x = R(-0.4, 0.1); g.add(f); }
  }
  for (let i = 0; i < RI(2, 5); i++) { const vx = x + R(-2, 2) * s, vz = z + R(-2, 2) * s, vl = R(2, 4.5); g.add(M(G.cyl, MAT.vine, vx, h - vl / 2, vz, 0.035, vl, 0.035)); }
}
function banana(g, x, z, s = R(0.8, 1.2)) {
  g.add(M(G.cylT, MAT.moss, x, 0.5 * s, z, 0.12 * s, 1.0 * s, 0.12 * s));
  const n = RI(5, 7);
  for (let i = 0; i < n; i++) { const f = M(G.banana, MAT.banana, x, 0.8 * s, z, s, s, s, 0, i * PI * 2 / n + R(-0.3, 0.3), 0); f.rotation.order = 'YXZ'; f.rotation.x = R(-0.1, 0.25); f.castShadow = true; g.add(f); }
}
function fern(g, x, z, s = R(0.7, 1.2)) {
  const n = RI(7, 10);
  for (let i = 0; i < n; i++) { const f = M(G.fern, MAT.fern, x, 0.02, z, s, s, s, 0, i * PI * 2 / n + R(-0.2, 0.2), 0); f.rotation.order = 'YXZ'; g.add(f); }
}
function bush(g, x, z, s = R(0.6, 1.1), flowers = Math.random() < 0.35) {
  for (let i = 0; i < 3; i++) g.add(M(G.ico0, MAT.bush, x + R(-0.6, 0.6) * s, 0.45 * s, z + R(-0.6, 0.6) * s, R(0.6, 0.9) * s, R(0.45, 0.7) * s, R(0.6, 0.9) * s, R(0, 3), R(0, 3), 0));
  if (flowers) for (let i = 0; i < 4; i++) g.add(M(G.ico0, MAT.flower, x + R(-0.7, 0.7) * s, R(0.6, 1.0) * s, z + R(-0.7, 0.7) * s, 0.1, 0.1, 0.1));
}
function grass(g, x, z, s = R(0.7, 1.3)) { g.add(M(G.grass, MAT.grass, x, 0, z, s, s, s, 0, R(0, PI), 0)); }
function rock(g, x, z, s = R(0.4, 1.2), y = 0) {
  const r = M(pick(G.rocks), MAT.rock, x, y + s * 0.35, z, s, s * R(0.6, 0.9), s * R(0.8, 1.1), R(0, 3), R(0, 3), 0); r.castShadow = true; g.add(r);
  if (Math.random() < 0.5) g.add(M(pick(G.rocks), MAT.moss, x, y + s * 0.75, z, s * 0.7, s * 0.22, s * 0.7, 0, R(0, 3), 0));
}
function torch(g, x, z, y = 0, flicker = true) {
  g.add(M(G.cyl, MAT.wood, x, y + 0.8, z, 0.06, 1.6, 0.06));
  g.add(M(G.cylT, MAT.metal, x, y + 1.68, z, 0.14, 0.2, 0.14, PI, 0, 0));
  g.add(M(G.cone, MAT.flame, x, y + 1.98, z, 0.16, 0.48, 0.16));
  g.add(M(G.cone, MAT.flameCore, x, y + 1.9, z, 0.08, 0.26, 0.08));
  if (flicker) { const s = new THREE.Sprite(MAT.glowTorch); s.position.set(x, y + 1.95, z); s.scale.set(1.8, 1.8, 1); g.add(s); }
}
function fence(g, side, z0 = 0, len = 24) {
  const x = side * 3.85;
  for (let z = z0 - 1.5; z > z0 - len; z -= 3) {
    g.add(M(G.box, MAT.wood, x + R(-0.05, 0.05), 0.55, z, 0.16, 1.1, 0.16, R(-0.05, 0.05), 0, R(-0.06, 0.06)));
    g.add(M(G.box, MAT.wood, x, 0.85 + R(-0.05, 0.05), z - 1.5, 0.08, 0.1, 3.05, R(-0.03, 0.03), 0, 0));
    g.add(M(G.box, MAT.wood, x, 0.45 + R(-0.05, 0.05), z - 1.5, 0.08, 0.1, 3.05, R(-0.03, 0.03), 0, 0));
  }
}
function vineArch(g, z) {
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-6, 7, z), new THREE.Vector3(-2.5, 5.6, z + R(-1, 1)), new THREE.Vector3(2.5, 5.8, z + R(-1, 1)), new THREE.Vector3(6, 7.5, z)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.22, 6), MAT.bark));
  for (let i = 0; i < 9; i++) { const p = curve.getPoint(i / 8 * 0.8 + 0.1), l = R(0.8, 2.6); g.add(M(G.cyl, MAT.vine, p.x, p.y - l / 2, p.z, 0.04, l, 0.04)); g.add(M(G.ico0, pick(MAT.canopy), p.x, p.y - l, p.z, 0.25, 0.3, 0.25)); }
  for (let i = 0; i < 6; i++) { const p = curve.getPoint(R(0, 1)); g.add(M(pick(G.blobs), pick(MAT.canopy), p.x, p.y + 0.3, p.z, R(0.6, 1.1), 0.5, R(0.6, 1.1))); }
}
function sign(g, x, z, mat, h = 2.2) {
  g.add(M(G.box, MAT.wood, x, h / 2, z, 0.16, h, 0.16));
  const b = M(G.box, mat, x, h + 0.2, z, 2.0, 1.0, 0.1, 0, x < 0 ? 0.5 : -0.5, 0.04);
  b.castShadow = true; g.add(b);
}
function pillar(g, x, z, h = R(3, 6), broken = Math.random() < 0.4) {
  const hh = broken ? h * R(0.35, 0.7) : h; let y = 0;
  while (y < hh) { const bh = Math.min(R(0.8, 1.2), hh - y); g.add(M(G.box, MAT.stone, x + R(-0.06, 0.06), y + bh / 2, z, 1.1, bh, 1.1, 0, R(-0.08, 0.08), 0)); y += bh; }
  if (!broken) g.add(M(G.box, MAT.stone, x, y + 0.2, z, 1.5, 0.4, 1.5));
  g.add(M(pick(G.rocks), MAT.moss, x, y + 0.1, z, 0.7, 0.18, 0.7));
  if (broken) for (let i = 0; i < 3; i++) g.add(M(G.box, MAT.stone, x + R(-1.4, 1.4), 0.3, z + R(-1.4, 1.4), R(0.5, 0.9), 0.5, R(0.5, 0.9), R(-0.3, 0.3), R(0, 3), R(-0.3, 0.3)));
  for (let i = 0; i < RI(0, 3); i++) { const l = R(1, hh * 0.8); g.add(M(G.cyl, MAT.vine, x + R(-0.56, 0.56), hh - l / 2, z + 0.57, 0.04, l, 0.04)); }
}
function statue(g, x, z) {
  const f = x < 0 ? 1 : -1;
  g.add(M(G.box, MAT.stone, x, 0.6, z, 1.8, 1.2, 1.8));
  g.add(M(pick(G.rocks), MAT.statue, x, 1.9, z, 0.75, 0.95, 0.7));
  g.add(M(pick(G.rocks), MAT.statue, x + f * 0.3, 3.05, z - 0.1, 0.55, 0.5, 0.6));
  g.add(M(G.box, MAT.statue, x + f * 0.65, 2.9, z - 0.1, 0.6, 0.32, 0.5));
  g.add(M(G.box, MAT.statue, x + f * 0.6, 2.6, z - 0.1, 0.5, 0.15, 0.42));
  for (const s of [-1, 1]) { g.add(M(G.sph, MAT.crystal, x + f * 0.55, 3.18, z - 0.1 + s * 0.22, 0.06, 0.06, 0.06)); g.add(M(G.box, MAT.statue, x - f * 0.1, 1.2, z + s * 0.42, 0.45, 0.9, 0.3)); }
  g.add(M(pick(G.rocks), MAT.moss, x, 3.35, z - 0.1, 0.4, 0.12, 0.4));
}
function cliff(g, x, z, h, w) { for (let i = 0; i < 3; i++) { const r = M(pick(G.rocks), MAT.cliff, x + R(-1, 1), h * R(0.35, 0.55), z + R(-4, 4), w * R(0.8, 1.2), h * R(0.5, 0.7), R(4, 7), 0, R(0, 3), 0); r.castShadow = false; g.add(r); } g.add(M(pick(G.blobs), pick(MAT.canopy), x, h * 0.95, z, w * 0.8, 1.2, 5)); }

/* ------------------------------------------------------------ zones */
const ZONES = ['jungle', 'waterfall', 'ruins', 'bridge', 'cave'];
const ZONE_NAMES = { jungle: 'JUNGLE PATH', waterfall: 'WATERFALL AREA', ruins: 'ANCIENT RUINS', bridge: 'WOODEN BRIDGE', cave: 'CAVE SECTION', night: 'NIGHT MODE' };
const ZONE_LEN = 480, CHUNK = 24;
const LIGHT = {
  jungle: { top: 0x2f86d8, hor: 0xbfe2c6, fog: 0x8fb88e, near: 22, far: 150, sun: 0xfff0d2, si: 2.7, hs: 0xcfe8ff, hg: 0x2e3e1a, hi: 0.55, env: 0.45, pl: 0, mt: 0x4f7f68, exp: 0.9, sd: [-0.45, 0.8, 0.35], star: 0 },
  waterfall: { top: 0x2a84e0, hor: 0xcfeaea, fog: 0x9fc6c6, near: 26, far: 165, sun: 0xfff6e2, si: 2.9, hs: 0xdff2ff, hg: 0x34462a, hi: 0.6, env: 0.5, pl: 0, mt: 0x5a8a88, exp: 0.92, sd: [0.4, 0.85, 0.3], star: 0 },
  ruins: { top: 0x3a4a8a, hor: 0xffa55a, fog: 0xc48a62, near: 20, far: 140, sun: 0xffb26e, si: 2.7, hs: 0xffd2a8, hg: 0x40301c, hi: 0.5, env: 0.4, pl: 0, mt: 0x86584a, exp: 0.92, sd: [-0.7, 0.35, -0.6], star: 0 },
  bridge: { top: 0x3486dc, hor: 0xd6eae4, fog: 0xa9c8bd, near: 18, far: 135, sun: 0xfff3dc, si: 2.8, hs: 0xe0f0ff, hg: 0x34442e, hi: 0.6, env: 0.5, pl: 0, mt: 0x6a9088, exp: 0.92, sd: [0.5, 0.8, 0.25], star: 0 },
  cave: { top: 0x04060c, hor: 0x0a1426, fog: 0x060b16, near: 6, far: 58, sun: 0x6a8cff, si: 0.25, hs: 0x4a6ab0, hg: 0x120c08, hi: 0.45, env: 0.18, pl: 2.6, mt: 0x10141c, exp: 1.15, sd: [0, 1, 0.2], star: 0 },
  night: { top: 0x040a1e, hor: 0x1b3050, fog: 0x0f1d2e, near: 14, far: 110, sun: 0xa3bcff, si: 0.9, hs: 0x5a78c0, hg: 0x10140c, hi: 0.45, env: 0.3, pl: 1.6, mt: 0x18263a, exp: 1.15, sd: [0.45, 0.75, -0.5], star: 1 }
};

function buildChunk(zone) {
  const g = new THREE.Group();
  if (zone === 'bridge') {
    const deck = M(new THREE.BoxGeometry(7.2, 0.4, 24), roadMats.bridge, 0, -0.2, -12); deck.receiveShadow = true; g.add(deck);
    g.add(M(G.plane, MAT.water, 0, -6, -12, 220, 24, 1, -PI / 2, 0, 0));
    for (const s of [-1, 1]) {
      for (let z = -2; z > -24; z -= 4) { g.add(M(G.box, MAT.wood, s * 3.75, 0.65, z, 0.18, 1.5, 0.18)); g.add(M(G.box, MAT.wood, s * 3.75, -2.8, z, 0.24, 5.6, 0.24)); }
      g.add(M(G.cyl, MAT.rope, s * 3.75, 1.25, -12, 0.045, 24, 0.045, PI / 2, 0, 0));
      g.add(M(G.cyl, MAT.rope, s * 3.75, 0.72, -12, 0.035, 24, 0.035, PI / 2, 0, 0));
      for (let i = 0; i < 2; i++) { const x = s * R(28, 46), z = -R(0, 24); cliff(g, x, z, R(8, 16), R(6, 10)); }
      if (Math.random() < 0.6) { const x = s * R(16, 24); for (let i = 0; i < 3; i++) rock(g, x + R(-3, 3), -R(2, 22), R(1, 2.5), -6.2); }
      if (Math.random() < 0.5) palm(g, s * R(30, 40), -R(3, 21), R(7, 10));
    }
    g.add(M(G.box, MAT.wood, 0, -0.65, -6, 7.4, 0.3, 0.3)); g.add(M(G.box, MAT.wood, 0, -0.65, -18, 7.4, 0.3, 0.3));
    return bake(g);
  }
  const road = new THREE.Mesh(G.road, roadMats[zone]); road.receiveShadow = true; g.add(road);
  if (zone === 'cave') {
    const tube = new THREE.Mesh(G.caveTube, MAT.caveWall); tube.receiveShadow = true; g.add(tube);
    for (const s of [-1, 1]) {
      g.add(M(G.plane, MAT.caveWall, s * 5.4, 0.01, -12, 4.4, 24, 1, -PI / 2, 0, 0));
      for (let i = 0; i < 4; i++) {
        const z = -R(1, 23), x = s * R(5.2, 6.4);
        for (let k = 0; k < RI(3, 6); k++) { const h = R(0.5, 1.6); g.add(M(G.octa, MAT.crystal, x + R(-0.4, 0.4), h * 0.6, z + R(-0.5, 0.5), R(0.15, 0.3), h, R(0.15, 0.3), R(-0.3, 0.3), R(0, 3), s * R(0.1, 0.5))); }
      }
      for (let i = 0; i < 5; i++) rock(g, s * R(4.1, 6), -R(0, 24), R(0.4, 1.0));
      torch(g, s * 4.4, -R(4, 20), 0, true);
    }
    for (let i = 0; i < 8; i++) { const x = R(-5, 5), z = -R(1, 23), l = R(0.6, 1.8), y = Math.sqrt(Math.max(0, 7.2 * 7.2 - x * x)); g.add(M(G.cone, MAT.caveWall, x, y - l / 2, z, R(0.18, 0.35), l, R(0.18, 0.35), PI, 0, 0)); }
    if (Math.random() < 0.5) for (let k = 0; k < 4; k++) g.add(M(G.octa, MAT.crystal, R(-3, 3), 6.6 + R(-0.3, 0.3), -R(2, 22), 0.2, 0.7, 0.2, PI, 0, 0));
    return bake(g);
  }
  for (const s of [-1, 1]) {
    const riverSide = zone === 'waterfall' && s < 0;
    if (riverSide) {
      g.add(M(G.plane, MAT.water, -11.6, -0.55, -12, 15.6, 24, 1, -PI / 2, 0, 0));
      g.add(M(G.plane, MAT.ground, -3.9, -0.27, -12, 0.6, 24, 1, -PI / 2 + 0.0, 0, 0));
      g.add(M(G.side, MAT.ground, -39.5, -0.02, 0));
      for (let i = 0; i < 6; i++) rock(g, -R(3.9, 5), -R(0, 24), R(0.4, 0.9), -0.3);
      for (let i = 0; i < 4; i++) rock(g, -R(7, 17), -R(0, 24), R(0.5, 1.4), -0.6);
      for (let z = -1.5; z > -24; z -= 3) g.add(M(G.box, MAT.wood, -3.8, 0.5, z, 0.16, 1.0, 0.16));
      g.add(M(G.box, MAT.wood, -3.8, 0.9, -12, 0.1, 0.1, 24)); g.add(M(G.box, MAT.wood, -3.8, 0.5, -12, 0.1, 0.1, 24));
      cliff(g, -26, -6, R(14, 20), 7); cliff(g, -27, -18, R(14, 20), 7);
      if (Math.random() < 0.65) {
        const wz = -R(6, 18), wh = R(12, 17);
        g.add(M(G.plane, MAT.waterfall, -20.2, wh / 2 - 0.6, wz, 6.5, wh, 1, 0, PI / 2, 0));
        g.add(M(G.plane, MAT.waterfall, -20.0, wh / 2 - 0.6, wz + 2.6, 2.6, wh * 0.9, 1, 0, PI / 2 - 0.2, 0));
        for (let k = 0; k < 7; k++) g.add(M(G.ico1, MAT.foam, -19.5 + R(-1, 1.5), -0.4, wz + R(-3.5, 3.5), R(0.8, 1.6), R(0.4, 0.7), R(0.8, 1.6)));
      }
      continue;
    }
    g.add(M(G.side, MAT.ground, s * 23.6, -0.02, 0));
    if (zone === 'jungle' || zone === 'waterfall') {
      if (Math.random() < 0.7) fence(g, s);
      for (let i = 0; i < 7; i++) { const x = s * R(4.3, 7), z = -R(0, 24); const r = Math.random(); r < 0.35 ? fern(g, x, z) : r < 0.6 ? grass(g, x, z) : r < 0.8 ? bush(g, x, z) : banana(g, x, z); }
      for (let i = 0; i < 6; i++) grass(g, s * R(3.9, 4.6), -R(0, 24), R(0.5, 0.9));
      for (let i = 0; i < 3; i++) { const x = s * R(7.5, 12), z = -R(0, 24); Math.random() < 0.5 ? palm(g, x, z) : bigTree(g, x, z); }
      for (let i = 0; i < 4; i++) { const x = s * R(13, 32), z = -R(0, 24); Math.random() < 0.35 ? palm(g, x, z, R(8, 11)) : bigTree(g, x, z, R(1.2, 1.8)); }
      for (let i = 0; i < 2; i++) banana(g, s * R(7, 11), -R(0, 24), R(1, 1.4));
      if (Math.random() < 0.6) rock(g, s * R(4.6, 9), -R(0, 24), R(0.5, 1.3));
      if (Math.random() < 0.25) torch(g, s * 4.3, -R(3, 21));
    } else if (zone === 'ruins') {
      pillar(g, s * 4.7, -4); pillar(g, s * 4.7, -16);
      if (Math.random() < 0.5) statue(g, s * 7.2, -R(4, 20));
      for (let i = 0; i < 3; i++) { const x = s * R(6, 10), z = -R(0, 24); g.add(M(G.box, MAT.stone, x, 0.4, z, R(1, 3), R(0.6, 1.6), R(0.8, 1.4), 0, R(-0.2, 0.2), 0)); }
      for (let i = 0; i < 5; i++) { const x = s * R(4.3, 8), z = -R(0, 24); Math.random() < 0.5 ? fern(g, x, z) : grass(g, x, z); }
      for (let i = 0; i < 4; i++) { const x = s * R(11, 30), z = -R(0, 24); Math.random() < 0.5 ? bigTree(g, x, z, R(1.1, 1.6)) : palm(g, x, z); }
      if (Math.random() < 0.6) { pillar(g, s * R(9, 14), -R(4, 20), R(6, 9)); }
      torch(g, s * 4.15, -10);
    }
  }
  if ((zone === 'jungle' || zone === 'waterfall') && Math.random() < 0.3) vineArch(g, -R(4, 20));
  if (zone === 'ruins' && Math.random() < 0.35) {
    const z = -12;
    for (const s of [-1, 1]) { g.add(M(G.box, MAT.stone, s * 4.7, 3.1, z, 1.2, 6.2, 1.2)); }
    g.add(M(G.box, MAT.stone, 0, 6.6, z, 11, 1.0, 1.4)); g.add(M(G.box, MAT.stone, 0, 7.3, z, 7, 0.6, 1.2));
    for (let i = 0; i < 8; i++) { const l = R(0.6, 2.4); g.add(M(G.cyl, MAT.vine, R(-4.5, 4.5), 6.1 - l / 2, z + 0.72, 0.04, l, 0.04)); }
  }
  return bake(g);
}

/* Zone gateways — placed once at each zone boundary */
function buildPortal(zone) {
  const g = new THREE.Group();
  if (zone === 'cave') {
    for (let a = 0; a <= PI + 0.001; a += PI / 9) rock(g, Math.cos(a) * 8.6, 0, R(2.2, 3), Math.sin(a) * 8.4 - 1.6);
    for (let x = -26; x <= 26; x += 4.5) for (let y = 0; y <= 18; y += 4) { if (Math.hypot(x, y) < 10.5) continue; const r = M(pick(G.rocks), MAT.cliff, x + R(-1, 1), y + R(-1, 1), R(-1.5, 0.5), R(3, 4.5), R(3, 4), R(2.5, 4), R(0, 3), R(0, 3), 0); g.add(r); }
    for (let i = 0; i < 12; i++) g.add(M(pick(G.blobs), pick(MAT.canopy), R(-24, 24), R(16, 20), R(-3, 1), R(2.5, 4), 1.4, 3));
    for (let i = 0; i < 10; i++) { const x = R(-8, 8), l = R(1, 3); g.add(M(G.cyl, MAT.vine, x, Math.sqrt(Math.max(1, 81 - x * x)) - l / 2, 0.8, 0.05, l, 0.05)); }
    torch(g, -4.6, 1.5); torch(g, 4.6, 1.5);
    sign(g, 5.3, 3.5, MAT.signs.cave);
  } else if (zone === 'ruins') {
    for (const s of [-1, 1]) {
      g.add(M(G.box, MAT.stone, s * 5.3, 4.6, 0, 1.8, 9.2, 1.8));
      g.add(M(G.box, MAT.stone, s * 11, 3, 0, 9, 6, 1.6));
      g.add(M(G.box, MAT.stone, s * 9, 6.4, 0, 3, 0.8, 1.8));
      torch(g, s * 4.1, 1.2);
      const b = M(G.plane, MAT.banner, s * 5.3, 6.2, 0.95, 1.3, 2.6, 1); g.add(b);
      for (let i = 0; i < 4; i++) { const l = R(1, 4); g.add(M(G.cyl, MAT.vine, s * R(4.6, 6), 9 - l / 2, 0.95, 0.05, l, 0.05)); }
    }
    g.add(M(G.box, MAT.stone, 0, 9.8, 0, 13.4, 1.6, 2.2));
    for (let i = 0; i < 4; i++) g.add(M(G.box, MAT.stone, 0, 11 + i * 0.8, 0, 10 - i * 2.4, 0.8, 1.9 - i * 0.2));
    const before = g.children.length; statue(g, 0.5, -0.1); g.children.slice(before).forEach((m) => { m.position.y += 13; m.position.x -= 0.5; });
    for (let i = 0; i < 10; i++) g.add(M(pick(G.blobs), pick(MAT.canopy), R(-14, 14), R(6, 9), R(-1, 1), R(1, 2.2), 0.8, 1.4));
  } else if (zone === 'bridge') {
    for (const s of [-1, 1]) { g.add(M(G.box, MAT.wood, s * 4.1, 2.4, 0, 0.45, 4.8, 0.45)); g.add(M(G.cone, MAT.wood, s * 4.1, 5.0, 0, 0.32, 0.5, 0.32)); torch(g, s * 4.1, 0.55, 2.6); }
    g.add(M(G.box, MAT.wood, 0, 4.4, 0, 8.8, 0.35, 0.35));
    const b = M(G.box, MAT.signs.bridge, 0, 3.75, 0.05, 3.0, 1.5, 0.12); b.castShadow = true; g.add(b);
  } else {
    sign(g, 5.2, -1, MAT.signs[zone]);
    torch(g, -4.3, 0); torch(g, 4.3, -2);
  }
  return bake(g);
}

/* ------------------------------------------------------------ obstacles */
const OBS = {
  log: { kind: 'jump', h: 0.95, w: 1.9, d: 0.95 },
  rock: { kind: 'block', w: 1.7, d: 1.5 },
  spikes: { kind: 'jump', h: 0.75, w: 1.8, d: 1.0 },
  wall: { kind: 'block', w: 1.9, d: 0.9 },
  cart: { kind: 'block', w: 1.8, d: 2.2 },
  gate: { kind: 'slide', w: 1.9, d: 0.6 },
  branch: { kind: 'slide', w: 1.9, d: 0.7 },
  boulder: { kind: 'block', w: 1.5, d: 1.5, roll: 7 },
  bones: { kind: 'jump', h: 0.95, w: 1.8, d: 1.4 },
  fire: { kind: 'jump', h: 0.85, w: 1.7, d: 1.1 },
  crate: { kind: 'block', w: 1.6, d: 1.5 },
  hole: { kind: 'jump', h: 0.2, w: 1.9, d: 1.8 },
  pillar: { kind: 'block', w: 1.4, d: 1.4 }
};
const OBSETS = {
  jungle: { jump: ['log', 'log', 'bones'], block: ['rock', 'cart', 'crate'], slide: ['branch'] },
  waterfall: { jump: ['log', 'spikes'], block: ['rock', 'boulder'], slide: ['branch'] },
  ruins: { jump: ['spikes', 'bones'], block: ['wall', 'pillar'], slide: ['gate'] },
  bridge: { jump: ['hole', 'log'], block: ['crate'], slide: ['gate'] },
  cave: { jump: ['spikes', 'fire'], block: ['rock', 'boulder', 'cart'], slide: ['gate'] }
};
const obTemplates = {};
function shadowAll(g) { g.traverse((o) => { if (o.isMesh && o.material !== MAT.flame && o.material !== MAT.flameCore && o.material !== MAT.hole) o.castShadow = true; }); return g; }
function buildObstacleTemplates() {
  let g;
  g = new THREE.Group();
  g.add(M(G.cyl, MAT.bark, 0, 0.45, 0, 0.45, 2.0, 0.45, 0, 0, PI / 2));
  g.add(M(G.cyl, MAT.logEnd, 1.005, 0.45, 0, 0.44, 0.02, 0.44, 0, 0, PI / 2)); g.add(M(G.cyl, MAT.logEnd, -1.005, 0.45, 0, 0.44, 0.02, 0.44, 0, 0, PI / 2));
  for (let i = 0; i < 4; i++) g.add(M(pick(G.rocks), MAT.moss, R(-0.8, 0.8), 0.85, R(-0.15, 0.15), 0.32, 0.12, 0.25));
  g.add(M(G.cyl, MAT.bark, 0.4, 0.75, -0.25, 0.08, 0.6, 0.08, 0.6, 0, 0.3));
  fern(g, 0.9, 0.3, 0.45);
  obTemplates.log = shadowAll(g);
  g = new THREE.Group(); g.add(M(G.rocks[0], MAT.rock, 0, 0.75, 0, 0.95, 0.9, 0.85)); g.add(M(G.rocks[1], MAT.moss, 0, 1.35, 0, 0.6, 0.25, 0.55)); g.add(M(G.rocks[2], MAT.rock, 0.65, 0.3, 0.4, 0.4, 0.35, 0.4)); obTemplates.rock = shadowAll(g);
  g = new THREE.Group(); g.add(M(G.box, MAT.wood, 0, 0.08, 0, 1.9, 0.16, 1.0));
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) g.add(M(G.cone, MAT.metal, -0.7 + i * 0.47, 0.5, -0.3 + k * 0.3, 0.09, 0.72, 0.09));
  obTemplates.spikes = shadowAll(g);
  g = new THREE.Group();
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) g.add(M(G.box, MAT.stone, -0.48 + c * 0.96 + (r % 2) * 0.12 - 0.06, 0.3 + r * 0.6, R(-0.04, 0.04), 0.94, 0.58, 0.9, 0, R(-0.04, 0.04), 0));
  g.add(M(G.rocks[3], MAT.moss, 0, 2.45, 0, 0.9, 0.15, 0.45));
  obTemplates.wall = shadowAll(g);
  g = new THREE.Group();
  g.add(M(G.box, MAT.woodLight, 0, 0.85, 0, 1.6, 0.12, 2.0)); g.add(M(G.box, MAT.wood, 0.78, 1.15, 0, 0.08, 0.6, 2.0)); g.add(M(G.box, MAT.wood, -0.78, 1.15, 0, 0.08, 0.6, 2.0)); g.add(M(G.box, MAT.wood, 0, 1.15, 0.98, 1.6, 0.6, 0.08));
  for (const s of [-1, 1]) for (const z of [-0.6, 0.6]) { const w = M(G.cyl, MAT.wood, s * 0.88, 0.45, z, 0.45, 0.1, 0.45, 0, 0, PI / 2); g.add(w); g.add(M(G.cyl, MAT.metal, s * 0.94, 0.45, z, 0.1, 0.06, 0.1, 0, 0, PI / 2)); }
  g.add(M(G.box, MAT.crate, 0.25, 1.35, 0.3, 0.6, 0.6, 0.6, 0, 0.4, 0)); g.rotation.z = 0.06;
  obTemplates.cart = shadowAll(g);
  g = new THREE.Group();
  for (const s of [-1, 1]) g.add(M(G.box, MAT.wood, s * 0.95, 1.6, 0, 0.2, 3.2, 0.2));
  g.add(M(G.box, MAT.wood, 0, 3.1, 0, 2.2, 0.2, 0.22));
  for (const s of [-1, 1]) g.add(M(G.cyl, MAT.rope, s * 0.6, 2.6, 0, 0.03, 1.0, 0.03));
  g.add(M(G.cyl, MAT.bark, 0, 1.95, 0, 0.26, 1.7, 0.26, 0, 0, PI / 2));
  for (let i = 0; i < 6; i++) g.add(M(G.cone, MAT.metal, -0.7 + i * 0.28, 1.55, 0, 0.07, 0.42, 0.07, PI, 0, 0));
  obTemplates.gate = shadowAll(g);
  g = new THREE.Group();
  g.add(M(G.cyl, MAT.bark, 0, 1.95, 0, 0.3, 2.6, 0.3, 0.1, 0, PI / 2 + 0.06));
  for (let i = 0; i < 6; i++) g.add(M(pick(G.blobs), pick(MAT.canopy), R(-1.1, 1.1), 2.2 + R(0, 0.3), R(-0.3, 0.3), R(0.3, 0.55), 0.35, 0.4));
  for (let i = 0; i < 5; i++) { const l = R(0.4, 1.0); g.add(M(G.cyl, MAT.vine, R(-1, 1), 1.8 - l / 2, R(-0.1, 0.1), 0.03, l, 0.03)); }
  for (const s of [-1, 1]) g.add(M(G.cyl, MAT.vine, s * 1.05, 4, 0, 0.05, 4.2, 0.05));
  obTemplates.branch = shadowAll(g);
  g = new THREE.Group(); const bm = M(G.rocks[4], MAT.rock, 0, 0, 0, 0.82, 0.82, 0.82); g.add(bm); g.add(M(G.rocks[1], MAT.moss, 0.2, 0.55, 0.2, 0.5, 0.3, 0.5));
  const bw = new THREE.Group(); bw.add(g); g.position.y = 0.8; bw.userData.spin = true; obTemplates.boulder = shadowAll(bw);
  g = new THREE.Group(); g.add(M(G.cyl, MAT.bone, 0, 0.18, 0, 0.09, 2.2, 0.09, PI / 2, 0, 0));
  for (let i = 0; i < 6; i++) { const t = M(G.torus, MAT.bone, 0, 0.12, -0.75 + i * 0.3, 0.85 - Math.abs(i - 2.5) * 0.08, 0.95 - Math.abs(i - 2.5) * 0.1, 1, 0, 0, 0); g.add(t); }
  g.add(M(G.sph, MAT.bone, 0, 0.4, -1.35, 0.32, 0.28, 0.45)); g.add(M(G.sph, MAT.hole, 0.17, 0.48, -1.5, 0.08, 0.08, 0.08)); g.add(M(G.sph, MAT.hole, -0.17, 0.48, -1.5, 0.08, 0.08, 0.08));
  obTemplates.bones = shadowAll(g);
  g = new THREE.Group();
  for (let i = 0; i < 4; i++) g.add(M(G.cyl, MAT.bark, 0, 0.2, 0, 0.14, 1.7, 0.14, PI / 2, i * PI / 4, 0));
  for (let i = 0; i < 6; i++) g.add(M(pick(G.rocks), MAT.rock, Math.cos(i) * 0.8, 0.12, Math.sin(i) * 0.5, 0.22, 0.18, 0.22));
  for (let i = 0; i < 5; i++) { g.add(M(G.cone, MAT.flame, R(-0.5, 0.5), 0.7, R(-0.3, 0.3), R(0.18, 0.3), R(0.8, 1.2), R(0.18, 0.3))); }
  g.add(M(G.cone, MAT.flameCore, 0, 0.55, 0, 0.3, 0.6, 0.3));
  const fs = new THREE.Sprite(MAT.glowFire); fs.position.y = 0.8; fs.scale.set(3.2, 3.2, 1); g.add(fs);
  obTemplates.fire = shadowAll(g);
  g = new THREE.Group(); g.add(M(G.box, MAT.crate, -0.25, 0.65, 0, 1.3, 1.3, 1.3, 0, 0.15, 0)); g.add(M(G.box, MAT.crate, 0.45, 0.4, 0.4, 0.8, 0.8, 0.8, 0, -0.3, 0));
  g.add(M(G.cyl, MAT.wood, 0.55, 0.5, -0.45, 0.35, 1.0, 0.35)); g.add(M(G.cyl, MAT.metal, 0.55, 0.8, -0.45, 0.36, 0.06, 0.36)); g.add(M(G.cyl, MAT.metal, 0.55, 0.2, -0.45, 0.36, 0.06, 0.36));
  obTemplates.crate = shadowAll(g);
  g = new THREE.Group(); g.add(M(G.plane, MAT.hole, 0, 0.02, 0, 1.9, 1.8, 1, -PI / 2, 0, 0));
  for (let i = 0; i < 5; i++) { g.add(M(G.box, MAT.woodLight, -0.8 + i * 0.4, 0.02, -0.95, 0.36, 0.08, R(0.1, 0.4), R(-0.3, 0.1), 0, 0)); g.add(M(G.box, MAT.woodLight, -0.8 + i * 0.4, 0.02, 0.95, 0.36, 0.08, R(0.1, 0.4), R(-0.1, 0.3), 0, 0)); }
  obTemplates.hole = g;
  g = new THREE.Group(); g.add(M(G.box, MAT.stone, 0, 0.6, 0, 1.25, 1.2, 1.25)); g.add(M(G.box, MAT.stone, 0.05, 1.7, 0, 1.15, 1.0, 1.15, 0, 0.2, 0.08)); g.add(M(G.box, MAT.stone, -0.1, 2.55, 0, 1.05, 0.7, 1.05, 0.1, -0.1, -0.1)); g.add(M(pick(G.rocks), MAT.moss, 0, 2.95, 0, 0.55, 0.15, 0.55));
  obTemplates.pillar = shadowAll(g);
}

/* ------------------------------------------------------------ power-ups */
const PW = ['magnet', 'boost', 'shield', 'life', 'egg'];
const PW_COLORS = { magnet: 0xff3a3a, boost: 0x36a8ff, shield: 0x36d65a, life: 0xff3050, egg: 0xffc531 };
const pwTemplates = {};
function extrudeShape(shape, depth, mat) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 12 });
  geo.center(); return new THREE.Mesh(geo, mat);
}
function buildPowerups() {
  const shiny = (c, e) => std({ color: c, emissive: e, emissiveIntensity: 0.55, roughness: 0.22, metalness: 0.3 });
  let g = new THREE.Group();
  const red = shiny(0xff2a2a, 0x7a0000);
  const tor = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 12, 28, PI), red); tor.rotation.z = PI; g.add(tor);
  for (const s of [-1, 1]) { g.add(M(G.cyl, red, s * 0.3, 0.12, 0, 0.11, 0.24, 0.11)); g.add(M(G.cyl, MAT.metal, s * 0.3, 0.32, 0, 0.115, 0.16, 0.115)); }
  pwTemplates.magnet = g;
  const bolt = new THREE.Shape(); bolt.moveTo(0.1, 0.55); bolt.lineTo(-0.3, -0.02); bolt.lineTo(-0.02, -0.02); bolt.lineTo(-0.12, -0.55); bolt.lineTo(0.3, 0.08); bolt.lineTo(0.02, 0.08); bolt.lineTo(0.1, 0.55);
  pwTemplates.boost = extrudeShape(bolt, 0.12, shiny(0x3cb0ff, 0x0a4aa0));
  const sh = new THREE.Shape(); sh.moveTo(0, 0.48); sh.quadraticCurveTo(0.22, 0.38, 0.4, 0.38); sh.quadraticCurveTo(0.42, -0.2, 0, -0.48); sh.quadraticCurveTo(-0.42, -0.2, -0.4, 0.38); sh.quadraticCurveTo(-0.22, 0.38, 0, 0.48);
  pwTemplates.shield = extrudeShape(sh, 0.14, shiny(0x30d65a, 0x0a5a1a));
  const ht = new THREE.Shape(); ht.moveTo(0, -0.42); ht.bezierCurveTo(-0.1, -0.3, -0.48, -0.05, -0.44, 0.18); ht.bezierCurveTo(-0.4, 0.42, -0.08, 0.46, 0, 0.24); ht.bezierCurveTo(0.08, 0.46, 0.4, 0.42, 0.44, 0.18); ht.bezierCurveTo(0.48, -0.05, 0.1, -0.3, 0, -0.42);
  pwTemplates.life = extrudeShape(ht, 0.16, shiny(0xff2a44, 0x6a0010));
  g = new THREE.Group(); g.add(M(G.sph, std({ map: TEX.spots, emissive: 0x6a4200, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.4 }), 0, 0, 0, 0.3, 0.4, 0.3));
  pwTemplates.egg = g;
  MAT.ring = {};
  for (const k of PW) MAT.ring[k] = new THREE.MeshBasicMaterial({ color: PW_COLORS[k], transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  G.ring = new THREE.RingGeometry(0.45, 0.62, 32).rotateX(-PI / 2);
}

/* ------------------------------------------------------------ the dino */
let dino; // {root, hips, neck, head, jaw, tail[], legs[], arms[], mats}
function buildDino() {
  const SPH = new THREE.SphereGeometry(1, 30, 20);
  const SPHZ = SPH.clone().rotateX(PI / 2);
  const tx = skinTextures(profile.skin);
  const sk = SKINS[profile.skin];
  const mats = {
    skin: new THREE.MeshStandardMaterial({ map: tx.map, bumpMap: tx.bump, bumpScale: 0.7, roughness: 0.6, metalness: 0.02 }),
    limb: new THREE.MeshStandardMaterial({ map: tx.limb, bumpMap: tx.bump, bumpScale: 0.6, roughness: 0.64 }),
    belly: new THREE.MeshStandardMaterial({ color: new THREE.Color(sk.belly), bumpMap: tx.bump, bumpScale: 0.8, roughness: 0.7 }),
    spike: new THREE.MeshStandardMaterial({ color: sk.spike, roughness: 0.55 }),
    claw: new THREE.MeshStandardMaterial({ color: sk.claw, roughness: 0.35, metalness: 0.1 }),
    tooth: new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.35 }),
    eye: new THREE.MeshStandardMaterial({ color: 0xffb21e, emissive: 0x5a3000, emissiveIntensity: 0.6, roughness: 0.08, metalness: 0.1 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x8a1c22, roughness: 0.45 })
  };
  mats.skin.envMapIntensity = mats.limb.envMapIntensity = 0.6;
  const E = (geo, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; return m; };
  const cone = new THREE.ConeGeometry(1, 1, 10);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.set(0, 1.25, 0); body.add(hips);
  hips.add(E(SPHZ, mats.skin, 0.42, 0.47, 0.92, 0, 0.02, 0, -0.08));
  hips.add(E(SPHZ, mats.skin, 0.37, 0.43, 0.52, 0, 0.13, -0.62, -0.22));
  const top = (z) => { const a = 0.02 + 0.47 * Math.sqrt(Math.max(0, 1 - (z / 0.92) ** 2)); const b = 0.13 + 0.43 * Math.sqrt(Math.max(0, 1 - ((z + 0.62) / 0.52) ** 2)); return Math.max(a, b); };
  for (let i = 0; i < 12; i++) { const z = -0.98 + i * 0.16, s = 0.75 + Math.sin(i / 11 * PI) * 0.5; hips.add(E(cone, mats.spike, 0.05 * s, 0.2 * s, 0.05 * s, 0, top(z) + 0.04 * s, z, 0.55)); }
  // neck + head
  const neck = new THREE.Group(); neck.position.set(0, 0.3, -0.86); neck.rotation.x = 0.55; hips.add(neck);
  neck.add(E(SPHZ, mats.skin, 0.2, 0.23, 0.42, 0, 0, -0.22));
  for (let i = 0; i < 4; i++) neck.add(E(cone, mats.spike, 0.04, 0.15, 0.04, 0, 0.21, -0.05 - i * 0.12, 0.6));
  const head = new THREE.Group(); head.position.set(0, 0.02, -0.58); head.rotation.x = -0.55; neck.add(head);
  head.add(E(SPHZ, mats.limb, 0.27, 0.26, 0.34, 0, 0.06, -0.04));
  head.add(E(SPHZ, mats.limb, 0.2, 0.165, 0.32, 0, 0.0, -0.36));
  head.add(E(SPHZ, mats.limb, 0.15, 0.12, 0.12, 0, -0.005, -0.62));
  head.add(E(SPHZ, mats.mouth, 0.17, 0.05, 0.34, 0, -0.09, -0.32));
  for (const s of [-1, 1]) {
    head.add(E(SPHZ, mats.spike, 0.075, 0.045, 0.15, s * 0.15, 0.2, -0.1, 0.25, s * 0.25));
    head.add(E(SPH, mats.eye, 0.075, 0.075, 0.075, s * 0.18, 0.12, -0.12));
    head.add(E(SPH, mats.pupil, 0.022, 0.058, 0.022, s * 0.245, 0.12, -0.155));
    head.add(E(SPH, mats.pupil, 0.022, 0.016, 0.02, s * 0.07, 0.06, -0.69));
    for (let i = 0; i < 7; i++) head.add(E(cone, mats.tooth, 0.02, 0.085, 0.02, s * (0.17 - i * 0.013), -0.115, -0.14 - i * 0.075, PI));
  }
  for (let i = 0; i < 4; i++) head.add(E(cone, mats.spike, 0.045, 0.14, 0.045, 0, 0.3 - i * 0.015, 0.16 - i * 0.11, 0.7));
  const jaw = new THREE.Group(); jaw.position.set(0, -0.08, -0.02); head.add(jaw);
  jaw.add(E(SPHZ, mats.belly, 0.18, 0.075, 0.36, 0, -0.06, -0.3));
  jaw.add(E(SPHZ, mats.mouth, 0.14, 0.035, 0.3, 0, -0.012, -0.28));
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) jaw.add(E(cone, mats.tooth, 0.018, 0.07, 0.018, s * (0.14 - i * 0.012), 0.0, -0.13 - i * 0.075));
  // tail chain
  const tail = []; let parent = hips; const radii = [0.36, 0.29, 0.23, 0.17, 0.12, 0.08, 0.05], lens = [0.5, 0.5, 0.46, 0.44, 0.4, 0.36, 0.32];
  for (let i = 0; i < radii.length; i++) {
    const seg = new THREE.Group(); seg.position.set(0, i === 0 ? 0.06 : 0, i === 0 ? 0.78 : lens[i - 1] * 0.82); parent.add(seg);
    const r = radii[i]; seg.add(E(SPHZ, mats.skin, r, r * 1.05, lens[i] * 0.62, 0, 0, lens[i] * 0.45));
    seg.add(E(cone, mats.spike, r * 0.25, r * 0.7, r * 0.25, 0, r * 1.0, lens[i] * 0.4, 0.9));
    tail.push(seg); parent = seg;
  }
  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(s * 0.28, -0.08, 0.2); hips.add(thigh);
    thigh.add(E(SPH, mats.skin, 0.21, 0.34, 0.3, s * 0.03, -0.18, -0.04));
    const knee = new THREE.Group(); knee.position.set(s * 0.03, -0.42, -0.1); thigh.add(knee);
    knee.add(E(SPH, mats.limb, 0.1, 0.27, 0.11, 0, -0.22, 0.08, -0.35));
    const ankle = new THREE.Group(); ankle.position.set(0, -0.44, 0.17); knee.add(ankle);
    ankle.add(E(SPH, mats.limb, 0.065, 0.19, 0.075, 0, -0.15, -0.04, 0.3));
    const foot = new THREE.Group(); foot.position.set(0, -0.31, -0.08); ankle.add(foot);
    for (let k = -1; k <= 1; k++) {
      foot.add(E(SPHZ, mats.limb, 0.048, 0.042, 0.15, k * 0.065, 0, -0.1, 0, k * 0.28));
      foot.add(E(cone, mats.claw, 0.026, 0.11, 0.026, k * 0.11, -0.02, -0.25, -PI / 2 - 0.35, 0, 0));
    }
    foot.add(E(cone, mats.claw, 0.03, 0.14, 0.03, s * 0.05, 0.06, -0.02, -PI / 2 + 0.9, 0, 0));
    legs.push({ thigh, knee, ankle, foot, s });
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.25, -0.02, -0.74); hips.add(arm);
    arm.add(E(SPH, mats.limb, 0.055, 0.14, 0.06, 0, -0.1, -0.03, -0.5));
    const fore = new THREE.Group(); fore.position.set(0, -0.2, -0.09); arm.add(fore);
    fore.add(E(SPH, mats.limb, 0.042, 0.11, 0.046, 0, -0.06, -0.06, -1.1));
    for (let k = 0; k < 2; k++) fore.add(E(cone, mats.claw, 0.016, 0.07, 0.016, (k - 0.5) * 0.04, -0.1, -0.15, -PI / 2 - 0.6, 0, 0));
    arms.push({ arm, fore });
  }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
  shadow.position.y = 0.03; shadow.renderOrder = 1;
  const scene_root = new THREE.Group(); scene_root.add(root); scene_root.add(shadow);
  root.scale.setScalar(0.85);
  // power-up auras
  const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 2), new THREE.MeshBasicMaterial({ color: 0x3aff6a, wireframe: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  const bubble2 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 16), new THREE.MeshBasicMaterial({ color: 0x2aff60, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
  bubble.add(bubble2); bubble.position.y = 1.1; bubble.visible = false; scene_root.add(bubble);
  const magRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.04, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  magRing.rotation.x = PI / 2; magRing.position.y = 0.6; magRing.visible = false; scene_root.add(magRing);
  scene.add(scene_root);
  dino = { group: scene_root, root, body, hips, neck, head, jaw, tail, legs, arms, mats, shadow, bubble, magRing, cur: null, skin: profile.skin };
  dino.cur = poseIdle(0);
}
function setSkin(i) {
  const tx = skinTextures(i), sk = SKINS[i], m = dino.mats;
  m.skin.map = tx.map; m.limb.map = tx.limb; m.skin.bumpMap = m.limb.bumpMap = m.belly.bumpMap = tx.bump;
  m.belly.color.set(sk.belly); m.spike.color.setHex(sk.spike); m.claw.color.setHex(sk.claw);
  for (const k in m) m[k].needsUpdate = true;
  dino.skin = i;
}

/* poses: plain objects of joint angles so we can blend smoothly */
function poseBase() { return { hy: 1.25, hrx: 0, hrz: 0, nrx: 0.55, hrx2: -0.55, hry: 0, jaw: 0.1, trx: [-0.08, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04], try_: [0, 0, 0, 0, 0, 0, 0], leg: [[0.25, -0.55, 0.45, -0.15], [0.25, -0.55, 0.45, -0.15]], arm: [0, 0] }; }
function poseIdle(t) {
  const p = poseBase();
  p.hy = 1.24 + Math.sin(t * 2) * 0.012; p.hrx = Math.sin(t * 2) * 0.01;
  p.leg = [[0.12, -0.4, 0.35, -0.05], [0.18, -0.45, 0.38, -0.05]];
  p.nrx = 0.6 + Math.sin(t * 0.7) * 0.05; p.hrx2 = -0.6 - Math.sin(t * 0.7) * 0.05; p.hry = Math.sin(t * 0.45) * 0.45;
  const roar = Math.max(0, Math.sin(t * 0.55) - 0.8) * 5;
  p.jaw = 0.08 + Math.sin(t * 2) * 0.02 + roar * 0.5;
  for (let i = 0; i < 7; i++) { p.trx[i] = (i === 0 ? -0.1 : 0.05) + Math.sin(t * 1.2 - i * 0.5) * 0.02; p.try_[i] = Math.sin(t * 0.9 - i * 0.6) * 0.07; }
  p.arm = [Math.sin(t * 1.3) * 0.1, Math.sin(t * 1.3 + 1) * 0.1];
  return p;
}
function poseRun(ph, t) {
  const p = poseBase();
  for (let i = 0; i < 2; i++) {
    const q = ph + i * PI, lift = Math.max(0, Math.cos(q));
    p.leg[i] = [0.2 + Math.sin(q) * 0.85, -0.5 - lift * 1.15, 0.4 + lift * 0.8 - Math.max(0, -Math.cos(q)) * 0.15, -0.15 + Math.sin(q) * 0.45];
  }
  p.hy = 1.2 + Math.abs(Math.cos(ph)) * 0.09; p.hrx = 0.05 + Math.sin(ph * 2) * 0.035; p.hrz = Math.sin(ph) * 0.05;
  p.nrx = 0.42 + Math.sin(ph * 2 + 0.6) * 0.06; p.hrx2 = -0.42 - Math.sin(ph * 2 + 0.6) * 0.06; p.jaw = 0.2 + Math.sin(ph) * 0.05;
  for (let i = 0; i < 7; i++) { p.trx[i] = (i === 0 ? -0.14 : 0.025) + Math.sin(ph * 2 - i * 0.55) * 0.04; p.try_[i] = Math.sin(ph - i * 0.6) * 0.1; }
  p.arm = [Math.sin(ph) * 0.35, Math.sin(ph + PI) * 0.35];
  return p;
}
function poseJump(vy) {
  const p = poseBase(); const k = clamp(vy / 12, -1, 1);
  p.leg = [[0.95, -1.5, 1.2, 0.35], [0.7, -1.25, 1.0, 0.25]];
  p.hy = 1.2; p.hrx = k * 0.2; p.nrx = 0.3; p.hrx2 = -0.2; p.jaw = 0.55;
  for (let i = 0; i < 7; i++) { p.trx[i] = (i === 0 ? -0.05 - k * 0.15 : 0.05 + k * 0.03); p.try_[i] = 0; }
  p.arm = [0.6, 0.6];
  return p;
}
function poseSlide(t) {
  const p = poseBase();
  p.hy = 0.62; p.hrx = -0.12; p.hrz = Math.sin(t * 30) * 0.015; p.nrx = 0.05; p.hrx2 = 0.05; p.jaw = 0.3;
  p.leg = [[-0.95, -1.4, 1.5, 0.2], [-0.4, -1.9, 1.7, 0.6]];
  for (let i = 0; i < 7; i++) { p.trx[i] = (i === 0 ? 0.08 : 0.0); p.try_[i] = Math.sin(t * 14 - i) * 0.05; }
  p.arm = [-0.5, -0.5];
  return p;
}
function poseDead(t) {
  const p = poseBase();
  p.hy = 0.5; p.hrz = 1.35; p.nrx = 0.1; p.hrx2 = 0.2; p.jaw = 0.6;
  p.leg = [[0.6, -1.0, 0.6, 0.2], [-0.2, -0.5, 0.4, 0.1]];
  for (let i = 0; i < 7; i++) { p.trx[i] = 0.05; p.try_[i] = 0.1; }
  return p;
}
function blendPose(cur, tgt, k) {
  cur.hy = lerp(cur.hy, tgt.hy, k); cur.hrx = lerp(cur.hrx, tgt.hrx, k); cur.hrz = lerp(cur.hrz, tgt.hrz, k);
  cur.nrx = lerp(cur.nrx, tgt.nrx, k); cur.hrx2 = lerp(cur.hrx2, tgt.hrx2, k); cur.hry = lerp(cur.hry, tgt.hry, k); cur.jaw = lerp(cur.jaw, tgt.jaw, k);
  for (let i = 0; i < 7; i++) { cur.trx[i] = lerp(cur.trx[i], tgt.trx[i], k); cur.try_[i] = lerp(cur.try_[i], tgt.try_[i], k); }
  for (let i = 0; i < 2; i++) { for (let j = 0; j < 4; j++) cur.leg[i][j] = lerp(cur.leg[i][j], tgt.leg[i][j], k); cur.arm[i] = lerp(cur.arm[i], tgt.arm[i], k); }
}
function applyPose(p) {
  const d = dino;
  d.hips.position.y = p.hy; d.hips.rotation.x = p.hrx; d.hips.rotation.z = p.hrz;
  d.neck.rotation.x = p.nrx; d.head.rotation.x = p.hrx2; d.head.rotation.y = p.hry; d.jaw.rotation.x = p.jaw;
  for (let i = 0; i < 7; i++) { d.tail[i].rotation.x = p.trx[i]; d.tail[i].rotation.y = p.try_[i]; }
  for (let i = 0; i < 2; i++) { const L = d.legs[i], v = p.leg[i]; L.thigh.rotation.x = v[0]; L.knee.rotation.x = v[1]; L.ankle.rotation.x = v[2]; L.foot.rotation.x = v[3]; d.arms[i].arm.rotation.x = p.arm[i]; }
}

/* ------------------------------------------------------------ sky & lights */
let sky, skyMat, mountains = [], stars, sun, hemi, playerLight, clouds;
function buildSky() {
  skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) }, sunAmt: { value: 1 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt; varying vec3 vD;
      void main(){ vec3 d=normalize(vD); float h=d.y; vec3 c=mix(hor, top, pow(clamp(h,0.,1.),0.55)); c=mix(c, hor*0.85, clamp(-h*3.,0.,1.));
      float s=max(dot(d,normalize(sunDir)),0.); c+=sunCol*(pow(s,900.)*6.+pow(s,24.)*0.35+pow(s,4.)*0.08)*sunAmt;
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat); sky.renderOrder = -10; scene.add(sky);
  const mtGeo = (w, h) => new THREE.PlaneGeometry(w, h);
  [[0, -420, 1500, 200, 55, 1.0], [1, -380, 1300, 140, 35, 1.6], [2, -330, 1100, 90, 24, 2.2]].forEach(([layer, z, w, h, y, rep]) => {
    const t = genMountains(layer); t.repeat.set(rep, 1);
    const m = new THREE.Mesh(mtGeo(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false, color: 0x6b9682 }));
    m.position.set(0, y, z); m.renderOrder = -9 + layer; scene.add(m); mountains.push(m);
  });
  const sp = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) { const a = R(0, PI * 2), e = R(0.08, 1.4), r = 480; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.renderOrder = -9.5; scene.add(stars);
  clouds = new THREE.Group();
  const cm = new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffffff, transparent: true, opacity: 0.55, fog: false, depthWrite: false });
  for (let i = 0; i < 14; i++) { const c = new THREE.Group(); const x = R(-260, 260), y = R(70, 140), z = R(-380, -250); for (let k = 0; k < 5; k++) { const s = new THREE.Sprite(cm); s.position.set(x + R(-25, 25), y + R(-5, 8), z); s.scale.set(R(40, 80), R(18, 30), 1); c.add(s); } clouds.add(c); }
  clouds.renderOrder = -8; scene.add(clouds); clouds.userData.mat = cm;

  hemi = new THREE.HemisphereLight(0xd5ecff, 0x3a4a22, 0.7); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d2, 3); sun.castShadow = settings.quality === 'high';
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -11; sc.right = 11; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  playerLight = new THREE.PointLight(0xffb070, 0, 22, 1.6); scene.add(playerLight);
  // environment for glossy reflections (puddles, coins, water)
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 vD; void main(){ float h=vD.y; vec3 c=mix(vec3(0.62,0.72,0.62), vec3(0.45,0.7,1.0), clamp(h,0.,1.)); c=mix(c, vec3(0.16,0.2,0.1), clamp(-h*2.,0.,1.)); c+=vec3(1.,.9,.7)*pow(max(dot(vD,normalize(vec3(-0.4,0.8,0.4))),0.),60.)*6.; gl_FragColor=vec4(c,1.); }'
  }));
  envScene.add(envSky);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  pm.dispose();
}
const light = {};
const tmpC = new THREE.Color(), tmpV = new THREE.Vector3();
function initLight(L) {
  light.top = new THREE.Color(L.top); light.hor = new THREE.Color(L.hor); light.fog = new THREE.Color(L.fog);
  light.sun = new THREE.Color(L.sun); light.hs = new THREE.Color(L.hs); light.hg = new THREE.Color(L.hg); light.mt = new THREE.Color(L.mt);
  light.near = L.near; light.far = L.far; light.si = L.si; light.hi = L.hi; light.env = L.env; light.pl = L.pl; light.exp = L.exp; light.star = L.star;
  light.sd = new THREE.Vector3(...L.sd).normalize();
}
function stepLight(L, k) {
  light.top.lerp(tmpC.setHex(L.top), k); light.hor.lerp(tmpC.setHex(L.hor), k); light.fog.lerp(tmpC.setHex(L.fog), k);
  light.sun.lerp(tmpC.setHex(L.sun), k); light.hs.lerp(tmpC.setHex(L.hs), k); light.hg.lerp(tmpC.setHex(L.hg), k); light.mt.lerp(tmpC.setHex(L.mt), k);
  light.near = lerp(light.near, L.near, k); light.far = lerp(light.far, L.far, k); light.si = lerp(light.si, L.si, k); light.hi = lerp(light.hi, L.hi, k);
  light.env = lerp(light.env, L.env, k); light.pl = lerp(light.pl, L.pl, k); light.exp = lerp(light.exp, L.exp, k); light.star = lerp(light.star, L.star, k);
  light.sd.lerp(tmpV.set(L.sd[0], L.sd[1], L.sd[2]).normalize(), k).normalize();
}
function applyLight() {
  skyMat.uniforms.top.value.copy(light.top).convertSRGBToLinear();
  skyMat.uniforms.hor.value.copy(light.hor).convertSRGBToLinear();
  skyMat.uniforms.sunDir.value.copy(light.sd);
  skyMat.uniforms.sunCol.value.copy(light.sun).convertSRGBToLinear();
  skyMat.uniforms.sunAmt.value = clamp(light.si / 3, 0, 1);
  scene.fog.color.copy(light.fog); scene.fog.near = light.near; scene.fog.far = light.far;
  sun.color.copy(light.sun); sun.intensity = light.si;
  hemi.color.copy(light.hs); hemi.groundColor.copy(light.hg); hemi.intensity = light.hi;
  playerLight.intensity = light.pl;
  renderer.toneMappingExposure = light.exp;
  for (const m of allMats) m.envMapIntensity = light.env;
  mountains.forEach((m, i) => m.material.color.copy(light.mt).lerp(light.fog, i * 0.28));
  stars.material.opacity = light.star;
  clouds.userData.mat.opacity = 0.55 * (1 - light.star) * clamp(light.si / 2, 0, 1);
  clouds.userData.mat.color.copy(light.hor).lerp(tmpC.setHex(0xffffff), 0.5);
}

/* ------------------------------------------------------------ particles */
let particles = null;
class Particles {
  constructor(n, additive) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.grav = new Float32Array(n); this.s0 = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 400 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; uniform float scale; varying vec3 vC; varying float vA; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*scale/max(-mv.z,0.1); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(vC, smoothstep(.5,.0,d)*vA); }'
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 5; scene.add(this.pts);
  }
  emit(x, y, z, vx, vy, vz, color, size, life, grav = 0) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    tmpC.setHex(color); this.col[i * 3] = tmpC.r; this.col[i * 3 + 1] = tmpC.g; this.col[i * 3 + 2] = tmpC.b;
    this.size[i] = this.s0[i] = size; this.life[i] = this.max[i] = life; this.grav[i] = grav; this.alpha[i] = 1;
  }
  update(dt, dz) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt; const t = this.life[i] / this.max[i];
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt + dz;
      this.alpha[i] = Math.max(0, t) * (t > 0.85 ? (1 - t) / 0.15 : 1);
      this.size[i] = this.s0[i] * (0.6 + 0.4 * t + (1 - t) * 0.6);
    }
    const a = this.pts.geometry.attributes; a.position.needsUpdate = a.alpha.needsUpdate = a.size.needsUpdate = a.color.needsUpdate = true;
  }
}
let fx, dust;
function burst(x, y, z, color, n = 14, spd = 5, size = 0.35, life = 0.6, grav = 6) {
  for (let i = 0; i < n; i++) { const a = R(0, PI * 2), e = R(-0.3, 1.2); fx.emit(x, y, z, Math.cos(a) * Math.cos(e) * spd * R(0.4, 1), Math.sin(e) * spd * R(0.4, 1), Math.sin(a) * Math.cos(e) * spd * R(0.4, 1), color, size * R(0.6, 1.2), life * R(0.6, 1.2), grav); }
}

/* speed lines */
let speedLines;
function buildSpeedLines() {
  const n = 40, pos = new Float32Array(n * 6);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  speedLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  speedLines.frustumCulled = false; speedLines.userData.items = [];
  for (let i = 0; i < n; i++) speedLines.userData.items.push({ x: 0, y: 0, z: 0 });
  speedLines.userData.items.forEach((it) => resetLine(it, true));
  scene.add(speedLines);
}
function resetLine(it, any) { const a = R(0, PI * 2), r = R(2.5, 6); it.x = Math.cos(a) * r; it.y = 1.6 + Math.sin(a) * r * 0.7; it.z = any ? R(-40, 5) : R(-45, -30); }

/* ------------------------------------------------------------ audio */
const audio = { ctx: null, master: null, music: null, sfx: null, next: 0, step: 0, timer: 0 };
function initAudio() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = new C(); audio.ctx = ctx;
    audio.master = ctx.createGain(); audio.master.gain.value = 0.7; audio.master.connect(ctx.destination);
    audio.music = ctx.createGain(); audio.music.gain.value = settings.music ? 0.32 : 0; audio.music.connect(audio.master);
    audio.sfx = ctx.createGain(); audio.sfx.gain.value = settings.sfx ? 0.8 : 0; audio.sfx.connect(audio.master);
    const len = ctx.sampleRate; const nb = ctx.createBuffer(1, len, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; audio.noise = nb;
    audio.next = ctx.currentTime + 0.1;
    audio.timer = setInterval(schedMusic, 30);
  } catch (e) { audio.ctx = null; }
}
function tone(type, f0, f1, t, dur, vol, dest = audio.sfx) {
  const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, vol, fType, f, dest = audio.sfx, q = 1) {
  const ctx = audio.ctx, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = audio.noise; fl.type = fType; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, R(0, 0.5)); s.stop(t + dur + 0.05);
}
function sfx(name) {
  if (!audio.ctx || !settings.sfx) return;
  const t = audio.ctx.currentTime;
  switch (name) {
    case 'coin': tone('sine', 1320, 1320, t, 0.08, 0.18); tone('sine', 1980, 1980, t + 0.05, 0.14, 0.14); break;
    case 'jump': tone('square', 220, 520, t, 0.16, 0.05); noise(t, 0.2, 0.25, 'bandpass', 1200, audio.sfx, 0.8); break;
    case 'slide': noise(t, 0.35, 0.35, 'lowpass', 900); break;
    case 'lane': noise(t, 0.12, 0.15, 'highpass', 2500); break;
    case 'land': tone('sine', 120, 50, t, 0.12, 0.3); break;
    case 'hit': tone('sine', 110, 35, t, 0.4, 0.8); noise(t, 0.45, 0.6, 'lowpass', 700); tone('sawtooth', 300, 80, t, 0.3, 0.08); break;
    case 'smash': noise(t, 0.4, 0.5, 'bandpass', 600, audio.sfx, 0.6); tone('triangle', 200, 60, t, 0.25, 0.3); break;
    case 'power': [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, t + i * 0.06, 0.22, 0.16)); break;
    case 'egg': [784, 988, 1175, 1568, 1976].forEach((f, i) => tone('sine', f, f, t + i * 0.07, 0.3, 0.16)); break;
    case 'click': tone('triangle', 660, 880, t, 0.06, 0.12); break;
    case 'roar': {
      const ctx = audio.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(95, t + 0.9); o2.frequency.setValueAtTime(71, t); o2.frequency.linearRampToValueAtTime(48, t + 0.9);
      lfo.frequency.value = 28; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.linearRampToValueAtTime(400, t + 0.9); f.Q.value = 3;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(audio.sfx); [o, o2, lfo].forEach((x) => { x.start(t); x.stop(t + 1.05); });
      noise(t, 0.9, 0.18, 'bandpass', 500, audio.sfx, 1.5);
      break;
    }
  }
}
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];
const MEL = [5, -1, 7, -1, 8, 7, 5, -1, 4, -1, 5, -1, 2, -1, -1, -1, 5, -1, 7, -1, 9, 8, 7, -1, 8, -1, 7, 5, 4, -1, 2, -1];
const BASS = [0, -1, -1, 0, -1, -1, 3, -1, 2, -1, -1, 2, -1, -1, 4, -1];
function schedMusic() {
  const ctx = audio.ctx; if (!ctx) return;
  const spb = 60 / 116 / 4;
  while (audio.next < ctx.currentTime + 0.12) {
    const t = audio.next, s = audio.step % 32, playing = state === 'playing';
    if (settings.music && ctx.state === 'running') {
      if (s % 8 === 0 || s % 16 === 6) tone('sine', 120, 42, t, 0.22, 0.55, audio.music);
      if (s % 8 === 4) { tone('sine', 230, 150, t, 0.12, 0.28, audio.music); }
      if (s % 2 === 0) noise(t, 0.04, s % 4 === 2 ? 0.14 : 0.07, 'highpass', 6500, audio.music);
      if (s % 16 === 10 || s % 16 === 13) tone('sine', 330, 220, t, 0.1, 0.18, audio.music);
      const b = BASS[s % 16]; if (b >= 0) tone('triangle', SCALE[b] / 2, SCALE[b] / 2, t, 0.3, 0.32, audio.music);
      const m = MEL[s]; if (m >= 0 && (playing || s < 16)) { tone('sine', SCALE[m], SCALE[m], t, 0.28, 0.14, audio.music); tone('sine', SCALE[m] * 4, SCALE[m] * 4, t, 0.05, 0.025, audio.music); }
    }
    audio.next += spb; audio.step++;
  }
}
function vibrate(ms) { if (!settings.vibe) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* not allowed */ } }

/* ------------------------------------------------------------ world state */
const LANES = [-2, 0, 2];
const GRAV = 34;
let state = 'loading', prevState = 'menu';
let distance = 0, speed = 0, lane = 1, px = 0, py = 0, vy = 0, air = false, slideT = 0, invuln = 0, dieT = 0;
let coinsRun = 0, eggsRun = 0, lives = 2, bonus = 0, startZone = 0, nightMode = false, laneFrom = 1, laneT = 0;
const powers = { magnet: 0, boost: 0, shield: 0 };
const powerMax = { magnet: 10, boost: 6, shield: 15 };
let runPhase = 0, t = 0, shake = 0, camMode = 'menu', camT = 0, menuCamFrom = new THREE.Vector3(), slowmo = 1;
const chunks = [], pools = {}, portalPools = {}, portals = [];
let nextChunk = -24, nextRow = 40;
const obstacles = [], obPool = {};
let coinMesh; const coins = []; const COIN_MAX = 180;
const items = [], itemPool = {};
let curZone = 'jungle', shownZone = '';

function zoneIndexAt(wd) { return (startZone + Math.floor(Math.max(0, wd) / ZONE_LEN)) % 5; }
function zoneAt(wd) { return ZONES[zoneIndexAt(wd)]; }
function lightFor(z) { return z === 'cave' ? LIGHT.cave : nightMode ? LIGHT.night : LIGHT[z]; }

function getChunk(zone) {
  const p = pools[zone] || (pools[zone] = []);
  let c = p.find((x) => !x.userData.used);
  if (!c) { c = buildChunk(zone); c.userData.zone = zone; p.push(c); }
  c.userData.used = true; c.visible = true; if (!c.parent) scene.add(c);
  return c;
}
function freeChunk(c) { c.userData.used = false; c.visible = false; }
function getPortal(zone) {
  const p = portalPools[zone] || (portalPools[zone] = []);
  let c = p.find((x) => !x.userData.used);
  if (!c) { c = buildPortal(zone); p.push(c); scene.add(c); }
  c.userData.used = true; c.visible = true; return c;
}
function ensureChunks() {
  while (nextChunk < distance + 200) {
    const z = zoneAt(nextChunk);
    const c = getChunk(z); c.userData.wd = nextChunk; c.position.z = distance - nextChunk; chunks.push(c);
    if (nextChunk > 0 && zoneAt(nextChunk - CHUNK) !== z) { const p = getPortal(z); p.userData.wd = nextChunk; portals.push(p); }
    nextChunk += CHUNK;
  }
  for (let i = chunks.length - 1; i >= 0; i--) { const c = chunks[i]; if (distance - c.userData.wd - CHUNK > 14) { freeChunk(c); chunks.splice(i, 1); } }
  for (let i = portals.length - 1; i >= 0; i--) { const p = portals[i]; if (distance - p.userData.wd > 14) { p.userData.used = false; p.visible = false; portals.splice(i, 1); } }
}
let warmQueue = [];
function warmPools(dt) {
  // keep enough pre-built chunks for the zone coming up so builds never land on a visible frame
  const nz = zoneAt(distance + ZONE_LEN * 0.5), cz = zoneAt(distance);
  for (const z of [cz, nz]) { const have = (pools[z] || []).length; if (have < 12 && warmQueue.indexOf(z) < 0) warmQueue.push(z); }
  if (warmQueue.length) { const z = warmQueue[0]; const p = pools[z] || (pools[z] = []); if (p.length < 12) { const c = buildChunk(z); c.userData.zone = z; c.visible = false; scene.add(c); p.push(c); } else warmQueue.shift(); }
}

function getObstacle(type) {
  const p = obPool[type] || (obPool[type] = []);
  let o = p.find((x) => !x.active);
  if (!o) { const mesh = obTemplates[type].clone(); scene.add(mesh); o = { type, mesh, active: false, ...OBS[type] }; o.spin = mesh.userData.spin ? mesh.children[0] : null; p.push(o); }
  o.active = true; o.hit = false; o.mesh.visible = true; return o;
}
function spawnObstacle(type, laneI, wd) {
  const o = getObstacle(type); o.x = LANES[laneI]; o.lane = laneI; o.wd = wd + (o.roll ? 30 : 0); o.mesh.position.set(o.x, 0, distance - o.wd);
  o.mesh.rotation.y = type === 'rock' || type === 'crate' ? R(-0.4, 0.4) : 0;
  obstacles.push(o); return o;
}
function spawnCoin(x, y, wd) {
  for (let i = 0; i < COIN_MAX; i++) { const c = coins[i]; if (!c.active) { c.active = true; c.x = x; c.y = y; c.wd = wd; c.ph = R(0, 1); return; } }
}
function spawnItem(type, laneI, wd) {
  const p = itemPool[type] || (itemPool[type] = []);
  let it = p.find((x) => !x.active);
  if (!it) {
    const g = new THREE.Group(); const m = pwTemplates[type].clone(); m.traverse((o) => { if (o.isMesh) o.castShadow = true; }); g.add(m);
    const ring = new THREE.Mesh(G.ring, MAT.ring[type]); ring.position.y = -1.0; g.add(ring);
    const glow = new THREE.Sprite(MAT.glowSprite(PW_COLORS[type])); glow.scale.set(2.2, 2.2, 1); g.add(glow);
    scene.add(g); it = { type, g, inner: m, active: false }; p.push(it);
  }
  it.active = true; it.g.visible = true; it.x = LANES[laneI]; it.wd = wd; it.y = 1.1; items.push(it);
}
function spawnRow(wd) {
  const zone = zoneAt(wd);
  // keep rows clear of zone gateways
  const into = ((wd % ZONE_LEN) + ZONE_LEN) % ZONE_LEN; if (into < 10 || into > ZONE_LEN - 6) return;
  const set = OBSETS[zone];
  const diff = clamp(distance / 1400, 0, 1);
  const r = Math.random();
  const n = r < 0.55 - diff * 0.3 ? 1 : r < 0.92 - diff * 0.12 ? 2 : 3;
  const lanesShuf = [0, 1, 2].sort(() => Math.random() - 0.5);
  const kinds = {};
  for (let i = 0; i < n; i++) {
    const l = lanesShuf[i];
    let kind = n === 3 ? (Math.random() < 0.6 ? 'jump' : 'slide') : pick(['jump', 'block', 'block', 'slide']);
    if (n === 3 && i > 0) kind = kinds[lanesShuf[0]];
    kinds[l] = kind;
    spawnObstacle(pick(set[kind]), l, wd);
  }
  // coins: a line in an open or jumpable lane
  if (Math.random() < 0.8) {
    const open = [0, 1, 2].filter((l) => !kinds[l]);
    const jumpy = [0, 1, 2].filter((l) => kinds[l] === 'jump');
    let cl, arc = false;
    if (jumpy.length && Math.random() < 0.4) { cl = pick(jumpy); arc = true; } else if (open.length) cl = pick(open); else if (jumpy.length) { cl = pick(jumpy); arc = true; }
    if (cl !== undefined) {
      const lowSlide = kinds[cl] === 'slide';
      for (let i = 0; i < 7; i++) {
        const dz = -7.2 + i * 2.4;
        const y = arc ? 1.0 + Math.max(0, 2.1 * (1 - (dz / 7.5) ** 2)) : lowSlide ? 0.55 : 1.0;
        spawnCoin(LANES[cl], y, wd + dz - (arc || lowSlide ? 0 : 9));
      }
    }
  }
  const free = [0, 1, 2].filter((l) => !kinds[l]);
  if (free.length && Math.random() < 0.085) {
    const w = Math.random(); const type = w < 0.32 ? 'magnet' : w < 0.55 ? 'boost' : w < 0.82 ? 'shield' : lives < 3 ? 'life' : 'shield';
    spawnItem(type, pick(free), wd + 11);
  } else if (free.length && Math.random() < 0.018 && eggsRun < 5) spawnItem('egg', pick(free), wd + 11);
}
function ensureRows() {
  while (nextRow < distance + 130) {
    spawnRow(nextRow);
    const gap = clamp(speed * 1.25, 18, 34) + R(0, 7);
    nextRow += gap;
  }
}

function resetWorld() {
  chunks.forEach(freeChunk); chunks.length = 0;
  portals.forEach((p) => { p.userData.used = false; p.visible = false; }); portals.length = 0;
  obstacles.forEach((o) => { o.active = false; o.mesh.visible = false; }); obstacles.length = 0;
  items.forEach((i) => { i.active = false; i.g.visible = false; }); items.length = 0;
  coins.forEach((c) => (c.active = false));
  distance = 0; speed = 0; nextChunk = -48; nextRow = 45; lane = 1; px = 0; py = 0; vy = 0; air = false; slideT = 0; invuln = 0;
  coinsRun = 0; eggsRun = 0; bonus = 0; lives = 2; powers.magnet = powers.boost = powers.shield = 0;
  curZone = zoneAt(0); shownZone = '';
  initLight(lightFor(curZone));
  ensureChunks();
}

/* ------------------------------------------------------------ game flow */
const screens = ['loading', 'menu', 'charSel', 'journey', 'how', 'scores', 'settings', 'pause', 'over'];
function show(id) { screens.forEach((s) => ($(s).hidden = s !== id)); }
function setState(s) { prevState = state; state = s; }
function startRun() {
  initAudio();
  startZone = profile.zone === 5 ? 0 : profile.zone; nightMode = profile.zone === 5;
  resetWorld();
  setState('playing'); show(null); $('hud').hidden = false;
  menuCamFrom.copy(camera.position); camMode = 'swoop'; camT = 0;
  speed = 4; runPhase = 0;
  sfx('roar');
  const stats = SKINS[profile.skin].stats;
  powerMax.magnet = 9 + stats[2]; powerMax.boost = 5 + stats[2] * 0.5; powerMax.shield = 12 + stats[2];
  updateHud(true);
  if (!profile.tutorial) { $('hint').hidden = false; $('hint').style.opacity = 1; setTimeout(() => { $('hint').style.opacity = 0; setTimeout(() => ($('hint').hidden = true), 700); }, 3800); profile.tutorial = true; saveProfile(); }
  toastZone(curZone, true);
}
function toastZone(z, force) {
  const name = nightMode && z !== 'cave' ? ZONE_NAMES[z] + ' · NIGHT' : ZONE_NAMES[z];
  if (!force && shownZone === name) return; shownZone = name;
  const el = $('zoneToast'); el.innerHTML = `<small>ENTERING</small>${name}`; el.classList.add('show');
  clearTimeout(toastZone.t); toastZone.t = setTimeout(() => el.classList.remove('show'), 2200);
}
function score() { return Math.floor(distance * 5 + coinsRun * 20 + eggsRun * 500 + bonus); }
function pauseGame() { if (state !== 'playing') return; setState('paused'); show('pause'); if (audio.ctx) audio.ctx.suspend(); }
function resumeGame() { setState('playing'); show(null); $('hud').hidden = false; if (audio.ctx) audio.ctx.resume(); clock.getDelta(); }
function goMenu() {
  setState('menu'); $('hud').hidden = true; show('menu'); camMode = 'menu';
  resetWorld(); refreshMenu();
  if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
}
function gameOver() {
  setState('over'); $('hud').hidden = true;
  const sc = score(), d = Math.floor(distance);
  const isBest = sc > profile.best;
  profile.best = Math.max(profile.best, sc); profile.bestDist = Math.max(profile.bestDist, d); profile.wallet += coinsRun;
  profile.runs.push({ s: sc, d, c: coinsRun, t: Date.now() }); profile.runs.sort((a, b) => b.s - a.s); profile.runs = profile.runs.slice(0, 10);
  saveProfile();
  $('oScore').textContent = sc.toLocaleString(); $('oBest').textContent = profile.best.toLocaleString();
  $('oCoins').textContent = coinsRun; $('oDist').textContent = d.toLocaleString() + ' m'; $('oEggs').textContent = eggsRun;
  $('newBest').hidden = !isBest;
  $('oQuote').textContent = pick(['"EVERY FALL MAKES YOU STRONGER!"', '"LIFE FINDS A WAY TO RUN!"', '"THE JUNGLE NEVER ENDS."', '"FASTER. STRONGER. WILDER."']);
  show('over');
}

/* ------------------------------------------------------------ input */
function act(a) {
  if (state !== 'playing') return;
  if (a === 'left' || a === 'right') {
    const nl = clamp(lane + (a === 'left' ? -1 : 1), 0, 2);
    if (nl !== lane) { laneFrom = lane; lane = nl; laneT = 0.25; sfx('lane'); }
  } else if (a === 'up') {
    if (!air) { air = true; vy = 12.4 * (0.9 + SKINS[profile.skin].stats[1] * 0.035); slideT = 0; sfx('jump'); for (let i = 0; i < 8; i++) dust.emit(px + R(-0.5, 0.5), 0.1, R(-0.3, 0.6), R(-1.5, 1.5), R(0.5, 2), R(1, 3), 0x8a6a48, 0.7, 0.6, 1); }
  } else if (a === 'down') {
    if (air) { vy = -26; slideT = 0.7; } else { if (slideT <= 0) sfx('slide'); slideT = 0.75; }
  }
}
let touch = null;
canvas.addEventListener('pointerdown', (e) => { touch = { x: e.clientX, y: e.clientY, done: false, id: e.pointerId }; });
window.addEventListener('pointermove', (e) => {
  if (!touch || touch.done || e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y, th = Math.min(40, window.innerWidth * 0.06);
  if (Math.abs(dx) > th || Math.abs(dy) > th) { touch.done = true; act(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')); }
});
window.addEventListener('pointerup', () => { touch = null; });
window.addEventListener('pointercancel', () => { touch = null; });
window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k) && state === 'playing') e.preventDefault();
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') act('left');
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') act('right');
  else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') act('up');
  else if (k === 'ArrowDown' || k === 's' || k === 'S') act('down');
  else if (k === 'Escape' || k === 'p' || k === 'P') { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); }
  else if (k === 'Enter' && state === 'menu') startRun();
});
let padPrev = {};
function pollPad() {
  let pads; try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return; }
  for (const p of pads) {
    if (!p) continue;
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed), ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const s = { left: b(14) || ax < -0.5, right: b(15) || ax > 0.5, up: b(12) || b(0) || ay < -0.6, down: b(13) || b(1) || ay > 0.6, start: b(9) };
    for (const k of ['left', 'right', 'up', 'down']) if (s[k] && !padPrev[k]) act(k);
    if (s.start && !padPrev.start) { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); else if (state === 'menu' || state === 'over') startRun(); }
    if (b(0) && !padPrev.a && (state === 'menu' || state === 'over')) startRun();
    s.a = b(0); padPrev = s; break;
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

/* ------------------------------------------------------------ update */
const clock = new THREE.Clock();
function hitObstacle(o) {
  const lateral = Math.abs(o.x - px) > 0.85 && laneT > 0;
  if (powers.boost > 0 || powers.shield > 0) {
    if (powers.boost <= 0) { powers.shield = 0; flashScreen(); }
    o.active = false; o.mesh.visible = false; bonus += 50;
    burst(o.x, 1, 0, 0xc8b090, 26, 8, 0.5, 0.8, 14); burst(o.x, 1.2, 0, powers.boost > 0 ? 0x5ac8ff : 0x5aff7a, 16, 6, 0.4, 0.5, 0);
    sfx('smash'); shake = 0.35; vibrate(30); return;
  }
  if (lateral) { lane = laneFrom; laneT = 0; shake = 0.25; sfx('land'); vibrate(20); return; }
  o.hit = true; lives--; shake = 0.7; sfx('hit'); vibrate([60, 40, 80]); flashScreen();
  burst(px, 1.2, -0.5, 0xffe9a0, 20, 7, 0.35, 0.5, 10);
  if (lives <= 0) { setState('dying'); dieT = 0; slowmo = 0.35; return; }
  invuln = 1.8; speed *= 0.55; o.active = false; o.mesh.visible = false;
  updateHud(true);
}
function flashScreen() { const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }

function update(dt) {
  const stats = SKINS[profile.skin].stats;
  const target = (13 + Math.min(17, distance * 0.0055)) * (0.92 + stats[0] * 0.035) * (powers.boost > 0 ? 1.55 : 1);
  speed = damp(speed, target, state === 'playing' ? 1.6 : 4, dt);
  distance += speed * dt;
  laneT = Math.max(0, laneT - dt);
  px = damp(px, LANES[lane], 13, dt);
  if (air) { vy -= GRAV * dt; py += vy * dt; if (py <= 0) { py = 0; air = false; vy = 0; sfx('land'); for (let i = 0; i < 10; i++) dust.emit(px + R(-0.6, 0.6), 0.1, R(-0.4, 0.6), R(-2, 2), R(0.3, 1.5), R(1, 3), 0x8a6a48, 0.8, 0.7, 1); } }
  if (slideT > 0) slideT -= dt;
  invuln = Math.max(0, invuln - dt);
  for (const k in powers) if (powers[k] > 0) powers[k] = Math.max(0, powers[k] - dt);

  const z = zoneAt(distance);
  if (z !== curZone) { curZone = z; toastZone(z); }
  ensureChunks(); ensureRows();

  // obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (!o.active) { obstacles.splice(i, 1); continue; }
    if (o.roll && distance - o.wd < 40) { o.wd -= o.roll * dt; if (o.spin) o.spin.rotation.x -= (speed + o.roll) * dt / 0.8; }
    const oz = distance - o.wd; o.mesh.position.z = oz;
    if (oz > 12) { o.active = false; o.mesh.visible = false; obstacles.splice(i, 1); continue; }
    if (o.hit || invuln > 0) continue;
    if (Math.abs(oz) < o.d / 2 + 0.45 && Math.abs(o.x - px) < o.w / 2 + 0.32) {
      let hit;
      if (o.kind === 'jump') hit = py < o.h;
      else if (o.kind === 'slide') hit = !(slideT > 0 && py < 0.35);
      else hit = true;
      if (hit) hitObstacle(o);
      if (state !== 'playing') return;
    }
  }
  // coins
  const mag = powers.magnet > 0;
  const k = 1 - Math.exp(-10 * dt);
  for (let i = 0; i < COIN_MAX; i++) {
    const c = coins[i]; if (!c.active) continue;
    let cz = distance - c.wd;
    if (mag && cz > -32 && cz < 3) { c.x = lerp(c.x, px, k); c.y = lerp(c.y, py + 1.1, k); c.wd = lerp(c.wd, distance, k * 0.9); cz = distance - c.wd; }
    if (cz > 10) { c.active = false; continue; }
    if (Math.abs(cz) < 0.85 && Math.abs(c.x - px) < 0.9 && c.y > py - 0.2 && c.y < py + (slideT > 0 ? 1.4 : 2.3)) {
      c.active = false; coinsRun++; sfx('coin');
      for (let j = 0; j < 6; j++) fx.emit(c.x, c.y, cz, R(-2, 2), R(0, 3), R(-1, 1), 0xffd24a, 0.32, 0.4, 3);
    }
  }
  // items
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]; const iz = distance - it.wd;
    if (iz > 10) { it.active = false; it.g.visible = false; items.splice(i, 1); continue; }
    if (Math.abs(iz) < 1.0 && Math.abs(it.x - px) < 1.0 && py < 2.2) {
      it.active = false; it.g.visible = false; items.splice(i, 1);
      if (it.type === 'life') { lives = Math.min(5, lives + 1); sfx('power'); }
      else if (it.type === 'egg') { eggsRun++; bonus += 0; sfx('egg'); }
      else { powers[it.type] = powerMax[it.type]; sfx('power'); }
      burst(it.x, 1.2, 0, PW_COLORS[it.type], 30, 6, 0.45, 0.7, 2); vibrate(25);
      updateHud(true);
    }
  }
  // running dust & boost trail
  if (!air && slideT <= 0 && Math.random() < dt * speed * 0.45 && curZone !== 'bridge') dust.emit(px + R(-0.35, 0.35), 0.08, 0.4, R(-0.8, 0.8), R(0.3, 1.2), R(1, 2), curZone === 'cave' ? 0x4a4a55 : 0x7a5a3a, R(0.4, 0.8), 0.6, 0.5);
  if (slideT > 0 && !air && Math.random() < dt * 40) dust.emit(px + R(-0.6, 0.6), 0.1, R(-0.4, 0.3), R(-2, 2), R(0.6, 2), R(2, 4), 0x8a6a48, 0.8, 0.5, 2);
  if (powers.boost > 0) for (let j = 0; j < 2; j++) fx.emit(px + R(-0.4, 0.4), py + R(0.5, 1.6), R(0.3, 1.2), 0, 0, R(3, 6), 0x48b8ff, 0.35, 0.35, 0);
  updateHud(false);
}
function updateDying(dt) {
  dieT += dt;
  speed = damp(speed, 0, 3, dt); distance += speed * dt;
  if (air) { vy -= GRAV * dt; py = Math.max(0, py + vy * dt); if (py === 0) air = false; }
  for (const o of obstacles) o.mesh.position.z = distance - o.wd;
  slowmo = damp(slowmo, 1, 2, dt);
  if (dieT > 1.6) gameOver();
}
function syncWorld() {
  for (const c of chunks) c.position.z = distance - c.userData.wd;
  for (const p of portals) p.position.z = distance - p.userData.wd;
  const m = coinMesh, dummy = syncWorld.d || (syncWorld.d = new THREE.Object3D());
  for (let i = 0; i < COIN_MAX; i++) {
    const c = coins[i];
    if (c.active) { dummy.position.set(c.x, c.y, distance - c.wd); dummy.rotation.set(0, t * 3.2 + c.ph * 6.28, 0); dummy.scale.setScalar(1); }
    else { dummy.position.set(0, -50, 0); dummy.scale.setScalar(0.0001); }
    dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
  }
  m.instanceMatrix.needsUpdate = true;
  for (const it of items) { it.g.position.set(it.x, it.y + Math.sin(t * 3 + it.wd) * 0.15, distance - it.wd); it.inner.rotation.y = t * 2.2; }
}
function animateDino(dt) {
  let tgt;
  if (state === 'playing' || state === 'paused') {
    if (state === 'playing') runPhase += dt * Math.max(speed, 6) * 0.72;
    tgt = air ? poseJump(vy) : slideT > 0 ? poseSlide(t) : poseRun(runPhase, t);
  } else if (state === 'dying' || (state === 'over')) tgt = poseDead(t);
  else tgt = poseIdle(t);
  if (state !== 'paused') blendPose(dino.cur, tgt, 1 - Math.exp(-(air || slideT > 0 ? 16 : 12) * dt));
  applyPose(dino.cur);
  const inGame = state === 'playing' || state === 'paused' || state === 'dying' || state === 'over';
  dino.group.position.set(inGame ? px : 0, inGame ? py : 0, 0);
  const lean = inGame ? (LANES[lane] - px) : 0;
  dino.root.rotation.z = damp(dino.root.rotation.z, -lean * 0.12, 10, dt);
  dino.root.rotation.y = damp(dino.root.rotation.y, inGame ? -lean * 0.18 : 0, state === 'charSel' ? 3 : 10, dt);
  if (state === 'dying' || state === 'over') dino.root.rotation.y = damp(dino.root.rotation.y, 0.4, 3, dt);
  dino.shadow.position.set(0, 0.03 - (inGame ? py : 0), -0.05);
  dino.shadow.material.opacity = 0.5 / (1 + (inGame ? py : 0) * 0.6);
  dino.root.visible = invuln <= 0 || Math.floor(t * 14) % 2 === 0;
  dino.bubble.visible = powers.shield > 0 && inGame; dino.bubble.rotation.y = t * 0.8; dino.bubble.scale.setScalar(1 + Math.sin(t * 6) * 0.03);
  dino.magRing.visible = powers.magnet > 0 && inGame; dino.magRing.rotation.z = t * 3; dino.magRing.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
  const boostGlow = powers.boost > 0 && inGame ? 0.5 + Math.sin(t * 20) * 0.15 : 0;
  dino.mats.skin.emissive.setRGB(boostGlow * 0.05, boostGlow * 0.25, boostGlow * 0.6);
}
const camTarget = new THREE.Vector3(), camLook = new THREE.Vector3(), lookCur = new THREE.Vector3(0, 1.2, 0);
function updateCamera(dt) {
  if (camMode === 'menu' || camMode === 'select') {
    const a = camMode === 'select' ? 0.5 + Math.sin(t * 0.3) * 0.12 : 0.55 + Math.sin(t * 0.18) * 0.35;
    const r = camMode === 'select' ? 4.6 : 5.0;
    camTarget.set(Math.sin(a) * r, camMode === 'select' ? 1.5 : 1.6, -Math.cos(a) * r);
    camLook.set(0, camMode === 'select' ? 0.75 : 0.55, 0);
    camera.position.lerp(camTarget, 1 - Math.exp(-3 * dt));
    lookCur.lerp(camLook, 1 - Math.exp(-4 * dt));
  } else {
    const chase = camTarget.set(px * 0.55, 3.9 + py * 0.4, 7.4);
    camLook.set(px * 0.75, 1.15 + py * 0.3, -9);
    if (camMode === 'swoop') {
      camT = Math.min(1, camT + dt / 1.1); const e = camT * camT * (3 - 2 * camT);
      camera.position.lerpVectors(menuCamFrom, chase, e);
      camera.position.x += Math.sin(e * PI) * 4.5; camera.position.y += Math.sin(e * PI) * 2.2;
      lookCur.lerp(camLook, e);
      if (camT >= 1) camMode = 'chase';
    } else {
      camera.position.x = damp(camera.position.x, chase.x, 6, dt);
      camera.position.y = damp(camera.position.y, chase.y, 5, dt);
      camera.position.z = damp(camera.position.z, chase.z, 6, dt);
      lookCur.lerp(camLook, 1 - Math.exp(-8 * dt));
    }
  }
  camera.lookAt(lookCur);
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); camera.position.x += R(-1, 1) * shake * 0.3; camera.position.y += R(-1, 1) * shake * 0.3; }
  const fovT = baseFov + (powers.boost > 0 && state === 'playing' ? 9 : 0) + Math.min(6, speed * 0.12);
  camera.fov = damp(camera.fov, fovT, 3, dt); camera.updateProjectionMatrix();
}
function updateEnvironment(dt, dz) {
  stepLight(lightFor(curZone), 1 - Math.exp(-1.4 * dt));
  applyLight();
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  mountains.forEach((m, i) => { m.position.x = camera.position.x * (0.9 - i * 0.05); });
  clouds.position.x = (clouds.position.x + dt * 1.5) % 120;
  sun.position.set(px + light.sd.x * 40, light.sd.y * 40, light.sd.z * 40 - 4);
  sun.target.position.set(px, 0, -5);
  playerLight.position.set(px, 3.2, -1.5);
  TEX.waterfall.offset.y = (TEX.waterfall.offset.y + dt * 1.4) % 1;
  TEX.water.offset.y = (TEX.water.offset.y - dt * 0.12) % 1; TEX.water.offset.x = (TEX.water.offset.x + dt * 0.03) % 1;
  MAT.flame.opacity = 0.75 + Math.sin(t * 23) * 0.12 + Math.sin(t * 37) * 0.08;
  MAT.glowTorch.opacity = 0.55 + Math.sin(t * 19) * 0.12;
  MAT.crystal.emissiveIntensity = 0.9 + Math.sin(t * 2) * 0.25;
  if ((curZone === 'cave' || nightMode) && Math.random() < dt * 14) fx.emit(R(-6, 6), R(0.5, 5), R(-30, 2), R(-0.3, 0.3), R(-0.2, 0.3), R(-0.3, 0.3), curZone === 'cave' ? 0x6fd0ff : 0xd8ff7a, 0.18, 2.5, 0);
  if (curZone === 'jungle' && !nightMode && Math.random() < dt * 3) fx.emit(R(-8, 8), R(4, 7), R(-30, 0), R(-0.6, 0.6), R(-0.6, -0.2), 0, 0xfff1b0, 0.12, 3, 0);
  fx.update(dt, dz); dust.update(dt, dz);
  // speed lines
  const sl = speedLines, on = powers.boost > 0 && state === 'playing';
  sl.material.opacity = damp(sl.material.opacity, on ? 0.55 : 0, 6, dt);
  if (sl.material.opacity > 0.01) {
    const p = sl.geometry.attributes.position.array;
    sl.userData.items.forEach((it, i) => { it.z += dt * 70; if (it.z > 6) resetLine(it, false); p[i * 6] = it.x + px; p[i * 6 + 1] = it.y; p[i * 6 + 2] = it.z; p[i * 6 + 3] = it.x + px; p[i * 6 + 4] = it.y; p[i * 6 + 5] = it.z - 4; });
    sl.geometry.attributes.position.needsUpdate = true;
  }
}

/* ------------------------------------------------------------ HUD */
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHud(force) {
  if (force) for (const k in hudCache) delete hudCache[k];
  setText('hScore', score().toLocaleString());
  setText('hCoins', String(coinsRun));
  setText('hDist', Math.floor(distance).toLocaleString() + ' m');
  setText('hLives', String(lives));
  setText('hEggs', eggsRun + '/5');
  for (const [k, id] of [['magnet', 'pwMagnet'], ['boost', 'pwBoost'], ['shield', 'pwShield']]) {
    const el = $(id), v = powers[k];
    const vis = v > 0; if (el.hidden === vis) el.hidden = !vis;
    if (vis) { el.style.setProperty('--p', (v / powerMax[k]).toFixed(3)); const s = '00:' + String(Math.ceil(v)).padStart(2, '0'); if (el.lastChild.textContent !== s) el.lastChild.textContent = s; }
  }
}

/* ------------------------------------------------------------ main loop */
function frame() {
  requestAnimationFrame(frame);
  let dt = Math.min(clock.getDelta(), 0.05);
  pollPad();
  if (state === 'loading') return;
  if (state === 'dying') dt *= slowmo;
  t += dt;
  const d0 = distance;
  if (state === 'playing') update(dt);
  else if (state === 'dying') updateDying(dt);
  if (state !== 'paused') warmPools(dt);
  syncWorld();
  animateDino(dt);
  updateCamera(dt);
  updateEnvironment(state === 'paused' ? 0 : dt, distance - d0);
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------ menus */
function refreshMenu() {
  $('walletCoins').textContent = profile.wallet.toLocaleString();
  $('menuBest').textContent = 'BEST ' + profile.best.toLocaleString() + (profile.bestDist ? ' · ' + profile.bestDist.toLocaleString() + ' m' : '');
}
let selIdx = 0;
function renderChar() {
  const sk = SKINS[selIdx];
  $('cName').textContent = sk.name; $('cDesc').textContent = sk.desc;
  $('cSpeed').style.width = sk.stats[0] * 20 + '%'; $('cJump').style.width = sk.stats[1] * 20 + '%'; $('cShield').style.width = sk.stats[2] * 20 + '%';
  [...$('cDots').children].forEach((d, i) => d.classList.toggle('on', i === selIdx));
  $('cSelect').textContent = selIdx === profile.skin ? 'SELECTED' : 'SELECT';
  setSkin(selIdx);
}
const JOURNEYS = [
  { name: 'JUNGLE PATH', need: 0 }, { name: 'WATERFALL', need: 0 }, { name: 'ANCIENT RUINS', need: 0 },
  { name: 'WOODEN BRIDGE', need: 400 }, { name: 'CAVE SECTION', need: 800 }, { name: 'NIGHT MODE', need: 1200 }
];
let thumbs = [];
function renderCards() {
  const wrap = $('cards'); wrap.innerHTML = '';
  JOURNEYS.forEach((j, i) => {
    const locked = profile.bestDist < j.need;
    const b = document.createElement('button'); b.className = 'card' + (profile.zone === i ? ' on' : '') + (locked ? ' locked' : '');
    if (thumbs[i]) b.style.backgroundImage = `url(${thumbs[i]})`;
    b.setAttribute('aria-label', j.name + (locked ? ', locked' : ''));
    b.innerHTML = `<span>${j.name}</span>` + (locked ? `<div class="lock"><svg><use href="#i-lock"/></svg></div><div class="req">RUN ${j.need} m</div>` : '');
    b.onclick = () => { if (locked) { sfx('land'); return; } profile.zone = i; saveProfile(); sfx('click'); renderCards(); };
    wrap.appendChild(b);
  });
}
function renderScores() {
  const rows = $('scoreRows'); rows.innerHTML = '';
  if (!profile.runs.length) { rows.innerHTML = '<tr><td colspan="4" class="empty">No runs yet. Your best ten runs will be listed here.</td></tr>'; return; }
  profile.runs.forEach((r, i) => {
    const tr = document.createElement('tr'); if (i === 0) tr.className = 'top';
    const d = new Date(r.t);
    tr.innerHTML = `<td>${i + 1}</td><td>${r.s.toLocaleString()}</td><td class="r">${r.d.toLocaleString()} m</td><td class="r" style="color:var(--muted);font-weight:700">${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>`;
    rows.appendChild(tr);
  });
}
function renderSettings() {
  $('tMusic').setAttribute('aria-checked', settings.music); $('tSfx').setAttribute('aria-checked', settings.sfx); $('tVibe').setAttribute('aria-checked', settings.vibe);
  [...$('tQuality').children].forEach((b) => b.setAttribute('aria-pressed', b.dataset.q === settings.quality));
}
function saveSettings() {
  store.set('settings', settings);
  if (audio.ctx) { audio.music.gain.value = settings.music ? 0.32 : 0; audio.sfx.gain.value = settings.sfx ? 0.8 : 0; }
}
let settingsReturn = 'menu';
function wireUI() {
  const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); initAudio(); sfx('click'); fn(); });
  click('mPlay', startRun);
  click('mHow', () => show('how'));
  click('hOk', () => show('menu'));
  click('mScores', () => { renderScores(); show('scores'); });
  click('sBack', () => show('menu'));
  const openSettings = () => { settingsReturn = state === 'paused' ? 'pause' : 'menu'; renderSettings(); show('settings'); };
  click('mSettings', openSettings); click('mSettings2', openSettings); click('pSettings', openSettings);
  click('setBack', () => show(settingsReturn));
  click('mDino', () => { selIdx = profile.skin; setState('charSel'); camMode = 'select'; renderChar(); show('charSel'); });
  click('cBack', () => { setSkin(profile.skin); setState('menu'); camMode = 'menu'; show('menu'); });
  click('cPrev', () => { selIdx = (selIdx + 2) % 3; renderChar(); dino.root.rotation.y += PI * 2; sfx('roar'); });
  click('cNext', () => { selIdx = (selIdx + 1) % 3; renderChar(); dino.root.rotation.y -= PI * 2; sfx('roar'); });
  click('cSelect', () => { profile.skin = selIdx; saveProfile(); renderChar(); setTimeout(() => { setState('menu'); camMode = 'menu'; show('menu'); }, 250); });
  click('mJourney', () => { renderCards(); show('journey'); });
  click('jBack', () => show('menu'));
  click('btnPause', pauseGame);
  click('pResume', resumeGame);
  click('pRestart', () => { if (audio.ctx) audio.ctx.resume(); startRun(); });
  click('pMenu', goMenu);
  click('oRetry', startRun);
  click('oHome', goMenu);
  const tog = (id, key) => click(id, () => { settings[key] = !settings[key]; renderSettings(); saveSettings(); if (key === 'vibe' && settings.vibe) vibrate(40); });
  tog('tMusic', 'music'); tog('tSfx', 'sfx'); tog('tVibe', 'vibe');
  [...$('tQuality').children].forEach((b) => b.addEventListener('click', () => { settings.quality = b.dataset.q; renderSettings(); saveSettings(); applyQuality(); }));
  document.querySelectorAll('.screen').forEach((s) => s.addEventListener('pointerdown', (e) => e.stopPropagation()));
}

/* ------------------------------------------------------------ boot */
const nextFrame = () => new Promise((r) => { let d = false; requestAnimationFrame(() => { if (!d) { d = true; r(); } }); setTimeout(() => { if (!d) { d = true; r(); } }, 60); });
function progress(p, sub) { $('loadFill').style.width = Math.round(p * 100) + '%'; if (sub) $('loadSub').textContent = sub; }
function makeThumbs() {
  const keepCam = camera.position.clone(), keepFov = camera.fov;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(1); renderer.setSize(240, 320, false); camera.aspect = 240 / 320; camera.fov = 62; camera.updateProjectionMatrix();
  dino.group.visible = false;
  const order = [0, 1, 2, 3, 4, 0];
  order.forEach((zi, i) => {
    startZone = zi; nightMode = i === 5; resetWorld();
    // sprinkle a few obstacles and coins so the card looks like a real run
    for (let r = 0; r < 3; r++) spawnRow(18 + r * 20);
    curZone = ZONES[zi]; initLight(lightFor(curZone)); applyLight();
    camera.position.set(0, 3.6, 7); camera.lookAt(0, 1.4, -14);
    sky.position.copy(camera.position);
    sun.position.set(light.sd.x * 40, light.sd.y * 40, light.sd.z * 40 - 4); sun.target.position.set(0, 0, -5);
    playerLight.position.set(0, 3.2, -1.5);
    syncWorld();
    renderer.render(scene, camera);
    try { thumbs[i] = renderer.domElement.toDataURL('image/jpeg', 0.78); } catch (e) { thumbs[i] = null; }
  });
  dino.group.visible = true;
  camera.position.copy(keepCam); camera.fov = keepFov;
  renderer.setSize(w, h, false); applyQuality();
}
async function boot() {
  try {
    show('loading');
    progress(0.04, 'Mixing the mud'); await nextFrame();
    if (document.fonts && document.fonts.load) { try { await Promise.race([document.fonts.load('40px "Lilita One"'), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* font optional */ } }
    buildMaterials(); progress(0.22, 'Growing the jungle'); await nextFrame();
    MAT.glowTorch = MAT.glowSprite(0xff9a40); MAT.glowFire = MAT.glowSprite(0xff7a20);
    buildGeometries(); buildSky(); progress(0.3, 'Hatching Diano'); await nextFrame();
    buildDino(); buildObstacleTemplates(); buildPowerups(); buildSpeedLines();
    particles = [fx = new Particles(500, true), dust = new Particles(260, false)];
    coinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.09, 30).rotateX(PI / 2), [MAT.coinEdge, MAT.coinFace, MAT.coinFace], COIN_MAX);
    coinMesh.castShadow = true; coinMesh.frustumCulled = false; scene.add(coinMesh);
    for (let i = 0; i < COIN_MAX; i++) coins.push({ active: false, x: 0, y: 0, wd: 0, ph: 0 });
    progress(0.38, 'Building the trails'); await nextFrame();
    const plan = [['jungle', 10], ['waterfall', 4], ['ruins', 4], ['bridge', 4], ['cave', 4]];
    const total = plan.reduce((a, b) => a + b[1], 0); let done = 0;
    for (const [z, n] of plan) {
      const p = pools[z] = pools[z] || [];
      for (let i = 0; i < n; i++) { const c = buildChunk(z); c.userData.zone = z; c.visible = false; scene.add(c); p.push(c); done++; if (done % 2 === 0) { progress(0.38 + 0.45 * done / total, 'Building ' + ZONE_NAMES[z].toLowerCase()); await nextFrame(); } }
    }
    for (const z of ZONES) { const p = buildPortal(z); p.visible = false; scene.add(p); (portalPools[z] = portalPools[z] || []).push(p); }
    progress(0.88, 'Lighting torches'); await nextFrame();
    resize(); applyQuality();
    makeThumbs();
    startZone = profile.zone === 5 ? 0 : profile.zone; nightMode = profile.zone === 5;
    resetWorld();
    renderer.compile(scene, camera);
    camera.position.set(3, 2.3, -5); lookCur.set(0, 1.5, 0);
    progress(1, 'Ready'); await nextFrame();
    wireUI(); refreshMenu(); renderSettings();
    setState('menu'); show('menu');
    clock.getDelta();
  } catch (err) {
    console.error(err);
    $('loadText').textContent = 'SOMETHING WENT WRONG';
    $('loadSub').textContent = String(err && err.message || err);
  }
}
requestAnimationFrame(frame);
boot();
window.__diano = { get state() { return state; }, act, startRun, get distance() { return distance; }, get powers() { return powers; }, setZone: (i) => { profile.zone = i; } };
})();
