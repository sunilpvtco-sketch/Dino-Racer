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
renderer.shadowMap.type = THREE.PCFShadowMap;
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
scene.fog = new THREE.Fog(0xb3cfb0, 25, 150);

function applyQuality() {
  const hi = settings.quality === 'high';
  initPerf();
  renderer.setPixelRatio(perf.pr);
  sun && (sun.castShadow = hi); perf.shadowsOff = false;
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
    gr.addColorStop(0, dark ? 'rgba(20,40,14,.7)' : 'rgba(52,70,28,.65)'); gr.addColorStop(1, 'rgba(52,70,28,0)');
    g.fillStyle = gr; g.fillRect(side ? W - 46 : 0, 0, 46, H);
    for (let i = 0; i < 140; i++) {
      const y = R(0, H), x0 = side ? W - R(0, 10) : R(0, 10), len = R(6, 20);
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
  // grassy soil seen from above: patchy greens and dry straw over dark earth, then thousands of short blades
  const W = 1024, H = 1024, [c, g] = mk(W, H);
  g.fillStyle = dark ? '#1c2412' : '#2b3518'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const x = R(0, W), y = R(0, H), r = R(30, 120), k = Math.random();
    const col = k < 0.45 ? hsl(R(78, 100), R(35, 55), R(18, 30), 0.45) : k < 0.7 ? hsl(R(45, 60), R(30, 45), R(26, 38), 0.35) : hsl(R(25, 35), R(25, 40), R(14, 22), 0.4);
    tiled(W, H, x, y, r, (X, Y) => blob(g, X, Y, r, col, 'rgba(0,0,0,0)'));
  }
  g.lineCap = 'round';
  for (let i = 0; i < 42000; i++) {
    const x = R(0, W), y = R(0, H), len = R(3, 11), a = R(-PI, PI), k = Math.random();
    g.strokeStyle = k < 0.72 ? hsl(R(75, 110), R(35, 65), R(16, 42), R(0.55, 0.95)) : k < 0.9 ? hsl(R(48, 62), R(35, 55), R(35, 55), 0.7) : hsl(R(25, 35), R(20, 35), R(12, 20), 0.6);
    g.lineWidth = R(0.8, 1.8);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  leafSpecks(g, W, H, 160, 20, 60);
  for (let i = 0; i < 60; i++) { const x = R(0, W), y = R(0, H), r = R(2, 5); g.fillStyle = hsl(30, 10, R(35, 55), 0.8); g.beginPath(); g.ellipse(x, y, r, r * 0.7, R(0, 3), 0, PI * 2); g.fill(); }
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
function mixHex(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
/* Realistic hide: countershading (dark back, pale belly), irregular scale cells, broken stripes, belly plates.
   UV layout matches an ellipsoid whose pole points along the body (u=.75 spine, u=.25 belly). */
function genSkin(sk) {
  const W = 1024, H = 1024, [c, g] = mk(W, H), [bc, bg] = mk(W, H);
  const dors = (u) => (1 - Math.cos((u - 0.25) * PI * 2)) / 2;
  for (let x = 0; x < W; x++) {
    const d = dors(x / W), s = clamp((d - 0.15) / 0.5, 0, 1);
    g.fillStyle = mixHex(sk.belly, sk.base, s * s * (3 - 2 * s)); g.fillRect(x, 0, 1, H);
    if (d > 0.5) { g.globalAlpha = (d - 0.5) / 0.5 * 0.8; g.fillStyle = sk.dorsal; g.fillRect(x, 0, 1, H); g.globalAlpha = 1; }
  }
  for (let i = 0; i < 700; i++) {
    const u = R(0.38, 1.12) % 1, x = u * W, y = R(0, H), r = R(8, 34);
    tiled(W, H, x, y, r, (X, Y) => blob(g, X, Y, r, Math.random() < 0.65 ? sk.dark : sk.light, 'rgba(0,0,0,0)'));
  }
  g.fillStyle = sk.stripe;
  for (let k = 0; k < 14; k++) {
    const y0 = k * H / 14 + R(-10, 10), th = R(12, 20);
    for (let x = W * 0.56; x <= W * 0.94; x += 5) {
      const tt = (x / W - 0.75) / 0.19, r = th * (1 - tt * tt) * R(0.55, 1.15);
      if (r < 1.5 || Math.random() < 0.08) continue;
      tiled(W, H, x, y0 + Math.sin(x * 0.03 + k) * 6, r, (X, Y) => { g.beginPath(); g.ellipse(X, Y, r * 0.7, r, 0, 0, PI * 2); g.fill(); });
    }
  }
  g.fillStyle = sk.spine; g.globalAlpha = 0.7; g.fillRect(W * 0.744, 0, W * 0.012, H); g.globalAlpha = 1;
  bg.fillStyle = '#6a6a6a'; bg.fillRect(0, 0, W, H);
  const cs = 20;
  for (let row = 0, y = 0; y < H + cs; y += cs * 0.82, row++) {
    for (let x = (row % 2) * cs / 2; x < W + cs; x += cs) {
      const d = dors(x / W), belly = d < 0.22;
      const cx = x + R(-2, 2), cy = y + R(-2, 2), rx = cs * (belly ? 1.05 : 0.56), ry = cs * (belly ? 0.42 : 0.52);
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = k * PI / 3 + R(-0.2, 0.2), rr = R(0.85, 1.1); g.lineTo(cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr); }
      g.closePath();
      g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,230,${R(0.01, 0.035)})` : `rgba(0,0,0,${R(0.02, 0.06)})`; g.fill();
      g.strokeStyle = 'rgba(0,0,0,.06)'; g.lineWidth = 1; g.stroke();
      const gr = bg.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, Math.max(rx, ry));
      gr.addColorStop(0, 'rgba(200,200,200,.5)'); gr.addColorStop(0.75, 'rgba(130,130,130,.25)'); gr.addColorStop(1, 'rgba(60,60,60,.45)');
      bg.fillStyle = gr; bg.beginPath(); bg.ellipse(cx, cy, rx, ry, 0, 0, PI * 2); bg.fill();
    }
  }
  for (let i = 0; i < 90; i++) { const x = R(0, W), y = R(0, H), r = R(2, 5); g.fillStyle = 'rgba(0,0,0,.1)'; g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill(); bg.fillStyle = 'rgba(255,255,255,.9)'; bg.beginPath(); bg.arc(x, y, r, 0, PI * 2); bg.fill(); }
  const map = tex(c, { repeat: true }), part = map.clone(); part.needsUpdate = true; part.repeat.set(1, 0.32);
  return { map, part, bump: tex(bc, { repeat: true, srgb: false }) };
}
function genLimb(sk) {
  const W = 512, H = 512, [c, g] = mk(W, H), [bc, bg] = mk(W, H);
  g.fillStyle = mixHex(sk.base, sk.dorsal, 0.35); g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) { const x = R(0, W), y = R(0, H), r = R(6, 22); tiled(W, H, x, y, r, (X, Y) => blob(g, X, Y, r, Math.random() < 0.6 ? sk.dark : sk.light, 'rgba(0,0,0,0)')); }
  bg.fillStyle = '#6a6a6a'; bg.fillRect(0, 0, W, H);
  const cs = 12;
  for (let row = 0, y = 0; y < H + cs; y += cs * 0.82, row++) for (let x = (row % 2) * cs / 2; x < W + cs; x += cs) {
    const cx = x + R(-1, 1), cy = y + R(-1, 1);
    g.strokeStyle = 'rgba(0,0,0,.05)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, cs * 0.5, 0, PI * 2); g.stroke();
    const gr = bg.createRadialGradient(cx, cy, 0, cx, cy, cs * 0.55); gr.addColorStop(0, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(30,30,30,.5)');
    bg.fillStyle = gr; bg.fillRect(cx - cs, cy - cs, cs * 2, cs * 2);
  }
  return { map: tex(c, { repeat: true }), bump: tex(bc, { repeat: true, srgb: false }) };
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
  { name: 'DIANO', desc: 'Brave and balanced. The jungle\'s favourite runner.', stats: [3, 3, 3], base: '#6b8a3c', dorsal: '#33491c', dark: 'rgba(30,52,16,.45)', light: 'rgba(160,175,90,.25)', belly: '#e3cf9c', stripe: 'rgba(178,72,30,.75)', spine: '#c95a24', spike: 0xd9602a, claw: 0x1e140c, eye: 0xd99a1a },
  { name: 'RUSTY', desc: 'The fastest legs in the valley, but a shorter hop.', stats: [4, 2, 3], base: '#9a6a3c', dorsal: '#5a3518', dark: 'rgba(70,38,14,.45)', light: 'rgba(210,160,100,.25)', belly: '#ead0a4', stripe: 'rgba(120,40,18,.75)', spine: '#b84a1c', spike: 0xc2501e, claw: 0x20120c, eye: 0xe0a428 },
  { name: 'FROST', desc: 'Light as snow. Jumps highest, power-ups last longer.', stats: [2, 4, 4], base: '#c9cbc2', dorsal: '#8c8e88', dark: 'rgba(95,95,92,.4)', light: 'rgba(255,255,250,.35)', belly: '#f3eee0', stripe: 'rgba(90,92,92,.6)', spine: '#a85a36', spike: 0xb86a44, claw: 0x262626, eye: 0x7ec8e8 }
];
SKINS[0].model = 'reptile'; SKINS[0].pal = { tint: 0xffffff, eye: 0xffb020 };
SKINS[0].desc = 'Brave and balanced. A real jungle reptile with a scaly hide.';
SKINS[1].model = 'raptor'; SKINS[1].pal = { body: 0x9a5426, dark: 0x2c170a, belly: 0xe2b27c, eye: 0xffc030 };
SKINS[2].model = 'raptor'; SKINS[2].pal = { body: 0xd6d6ce, dark: 0x5e605c, belly: 0xf4efe2, eye: 0x58c8ff };
SKINS.push(
  { ...SKINS[0], name: 'TRIKE', desc: 'A three-horned tank. Slow, but shields and boosts last ages.', stats: [2, 2, 5], model: 'trike', pal: { body: 0x8a4a22, dark: 0x5e6e34, belly: 0xd8c8a0 } },
  { ...SKINS[0], name: 'REX', desc: 'A young T-Rex. The fastest runner in the jungle.', stats: [5, 2, 3], model: 'trex', pal: { body: 0x3f6a2a, dark: 0x22361a, belly: 0xd8c48e, eye: 0xffb020, claw: 0x1a140e, mouth: 0x8a1c1c } }
);
const VILLAIN = { base: '#3b342c', dorsal: '#1a1512', dark: 'rgba(18,14,10,.55)', light: 'rgba(130,110,85,.22)', belly: '#a39074', stripe: 'rgba(105,24,16,.8)', spine: '#4a140c', spike: 0x2a211b, claw: 0x0e0b09, eye: 0xff3214 };
const SKIN_PRICE = [0, 5000, 5000, 5000, 5000];
const skinCache = {};
function skinTextures(key, pal) {
  if (typeof key === 'number' && key > 2) key = 0, pal = SKINS[0];
  if (!skinCache[key]) { const s = genSkin(pal), l = genLimb(pal); skinCache[key] = { map: s.map, part: s.part, bump: s.bump, limb: l.map, limbBump: l.bump }; }
  return skinCache[key];
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
  TEX.ground.repeat.set(6, 3.6);
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
  MAT.wood = MAT.bark;
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
  MAT.laneMark = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.34, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  MAT.edgeLine = MAT.laneMark;
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
  signTxt.turn = ['<  TURN  >', 'LEFT OR RIGHT'];
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
  const hasCol = list.some((g) => g.attributes.color), col = hasCol ? new Float32Array(nv * 3).fill(1) : null;
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    pos.set(p.array, vo * 3); if (n) nor.set(n.array, vo * 3); if (u) uv.set(u.array, vo * 2);
    if (hasCol && g.attributes.color) col.set(g.attributes.color.array, vo * 3);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; }
    else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (hasCol) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
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
    let mat = o.material;
    const plain = mat.isMeshStandardMaterial && !mat.map && !mat.transparent && !(mat.alphaTest > 0) && mat.emissive.getHex() === 0 && mat.metalness < 0.5;
    if (plain) {
      const n = g.attributes.position.count, cc = new Float32Array(n * 3), c = mat.color;
      for (let i = 0; i < n; i++) { cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      mat = MAT.vcol || (MAT.vcol = std({ vertexColors: true, roughness: 0.85, metalness: 0 }));
    }
    let b = buckets.get(mat); if (!b) { b = { mat, list: [], cast: false }; buckets.set(mat, b); }
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
  for (let i = 0; i < n; i++) { const f = M(G.frond, MAT.frond, top.x, top.y, top.z, R(0.85, 1.15), R(0.8, 1.1), R(0.85, 1.15), 0, i * PI * 2 / n + R(-0.2, 0.2), 0); f.rotation.order = 'YXZ'; f.rotation.x = R(-0.15, 0.25); g.add(f); }
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
  for (let i = 0; i < n; i++) { const f = M(G.banana, MAT.banana, x, 0.8 * s, z, s, s, s, 0, i * PI * 2 / n + R(-0.3, 0.3), 0); f.rotation.order = 'YXZ'; f.rotation.x = R(-0.1, 0.25); g.add(f); }
}
function fern(g, x, z, s = R(0.7, 1.2)) {
  const n = RI(7, 10);
  for (let i = 0; i < n; i++) { const f = M(G.fern, MAT.fern, x, 0.02, z, s, s, s, 0, i * PI * 2 / n + R(-0.2, 0.2), 0); f.rotation.order = 'YXZ'; g.add(f); }
}
function bush(g, x, z, s = R(0.6, 1.1)) {
  // a leafy shrub made of textured leaf cards instead of a low-poly blob
  fern(g, x, z, s * 1.25); fern(g, x + R(-0.5, 0.5), z + R(-0.5, 0.5), s * 0.9);
  if (Math.random() < 0.5) banana(g, x + R(-0.6, 0.6), z + R(-0.6, 0.6), s * 0.7);
}
function grass() { /* replaced by instanced 3D grass blades */ }
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
  for (let i = 0; i < 9; i++) { const p = curve.getPoint(i / 8 * 0.8 + 0.1), l = R(0.8, 2.6); g.add(M(G.cyl, MAT.vine, p.x, p.y - l / 2, p.z, 0.035, l, 0.035)); }
  for (let i = 0; i < 14; i++) { const p = curve.getPoint(R(0.05, 0.95)); const f = M(G.fern, MAT.fern, p.x, p.y - 0.1, p.z, R(0.8, 1.3), -R(0.8, 1.2), R(0.8, 1.3), 0, R(0, PI * 2), 0); g.add(f); }
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
function cliff(g, x, z, h, w) { for (let i = 0; i < 3; i++) { const r = M(pick(G.rocks), MAT.cliff, x + R(-1, 1), h * R(0.35, 0.55), z + R(-4, 4), w * R(0.8, 1.2), h * R(0.5, 0.7), R(4, 7), 0, R(0, 3), 0); r.castShadow = false; g.add(r); } g.add(M(pick(G.blobs), pick(MAT.canopy), x, h * 0.95, z, w * 0.8, 1.2, 5)); if (TREES.pine) for (let i = 0; i < 2; i++) placeParts(g, TREES.pine, x + R(-3, 3), h * 0.9, z + R(-4, 4), R(6, 9), R(0, 6), false); }

/* ------------------------------------------------------------ zones */
const ZONES = ['jungle', 'waterfall', 'ruins', 'bridge', 'cave'];
const ZONE_NAMES = { jungle: 'JUNGLE PATH', waterfall: 'WATERFALL AREA', ruins: 'ANCIENT RUINS', bridge: 'WOODEN BRIDGE', cave: 'CAVE SECTION', night: 'NIGHT MODE' };
const ZONE_LEN = 480, CHUNK = 24;
const LIGHT = {
  jungle: { top: 0x2f86d8, hor: 0xbfe2c6, fog: 0x8fb88e, near: 20, far: 132, sun: 0xfff0d2, si: 2.7, hs: 0xcfe8ff, hg: 0x2e3e1a, hi: 0.55, env: 0.45, pl: 0, mt: 0x4f7f68, exp: 0.9, sd: [-0.45, 0.8, 0.35], star: 0 },
  waterfall: { top: 0x2a84e0, hor: 0xcfeaea, fog: 0x9fc6c6, near: 24, far: 138, sun: 0xfff6e2, si: 2.9, hs: 0xdff2ff, hg: 0x34462a, hi: 0.6, env: 0.5, pl: 0, mt: 0x5a8a88, exp: 0.92, sd: [0.4, 0.85, 0.3], star: 0 },
  ruins: { top: 0x3a4a8a, hor: 0xffa55a, fog: 0xc48a62, near: 18, far: 128, sun: 0xffb26e, si: 2.7, hs: 0xffd2a8, hg: 0x40301c, hi: 0.5, env: 0.4, pl: 0, mt: 0x86584a, exp: 0.92, sd: [-0.7, 0.35, -0.6], star: 0 },
  bridge: { top: 0x3486dc, hor: 0xd6eae4, fog: 0xa9c8bd, near: 18, far: 128, sun: 0xfff3dc, si: 2.8, hs: 0xe0f0ff, hg: 0x34442e, hi: 0.6, env: 0.5, pl: 0, mt: 0x6a9088, exp: 0.92, sd: [0.5, 0.8, 0.25], star: 0 },
  cave: { top: 0x04060c, hor: 0x0a1426, fog: 0x060b16, near: 6, far: 58, sun: 0x6a8cff, si: 0.25, hs: 0x4a6ab0, hg: 0x120c08, hi: 0.45, env: 0.18, pl: 2.6, mt: 0x10141c, exp: 1.15, sd: [0, 1, 0.2], star: 0 },
  night: { top: 0x040a1e, hor: 0x1b3050, fog: 0x0f1d2e, near: 14, far: 110, sun: 0xa3bcff, si: 0.9, hs: 0x5a78c0, hg: 0x10140c, hi: 0.45, env: 0.3, pl: 1.6, mt: 0x18263a, exp: 1.15, sd: [0.45, 0.75, -0.5], star: 1 }
};

function roadEdges(g, zone) {
  const y = 0.012;
  for (const lx of [-1, 1]) for (let z = -1.2; z > -24; z -= 3) g.add(M(G.plane, MAT.laneMark, lx, y, z, 0.11, 1.5, 1, -PI / 2, 0, 0));
  for (const s of [-1, 1]) {
    const x = s * 3.66;
    g.add(M(G.plane, MAT.edgeLine, s * 3.35, y, -12, 0.09, 24, 1, -PI / 2, 0, 0));
    if (zone === 'jungle') {
      g.add(M(G.cyl, MAT.bark, x, 0.15, -12, 0.17, 24.05, 0.17, PI / 2, 0, 0));
      for (let z = -2; z > -24; z -= R(3, 6)) g.add(M(pick(G.rocks), MAT.moss, x, 0.3, z, 0.25, 0.08, 0.35));
    } else if (zone === 'waterfall' || zone === 'ruins') {
      const big = zone === 'ruins';
      for (let z = -0.6; z > -24; z -= 1.2) g.add(M(G.box, MAT.stone, x + R(-0.03, 0.03), big ? 0.17 : 0.12, z, big ? 0.42 : 0.32, big ? 0.34 : 0.24, 1.14, 0, R(-0.03, 0.03), R(-0.03, 0.03)));
      for (let z = -3; z > -24; z -= R(5, 9)) g.add(M(pick(G.rocks), MAT.moss, x, big ? 0.36 : 0.26, z, 0.3, 0.07, 0.4));
    } else if (zone === 'cave') {
      for (let z = -0.8; z > -24; z -= 1.6) g.add(M(pick(G.rocks), MAT.caveWall, x + R(-0.08, 0.08), 0.12, z, R(0.3, 0.42), R(0.18, 0.28), R(0.6, 0.85), 0, R(0, 3), 0));
      for (let z = -3; z > -24; z -= 6) g.add(M(G.octa, MAT.crystal, x, 0.35, z, 0.09, 0.28, 0.09));
    } else if (zone === 'bridge') {
      g.add(M(G.box, MAT.wood, x, 0.1, -12, 0.2, 0.2, 24));
    }
  }
}
function buildChunk(zone) {
  const g = new THREE.Group();
  roadEdges(g, zone);
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
      if (Math.random() < 0.6) prop(g, 'crystal_rock', s * R(5, 6.5), -R(2, 22), R(1.2, 2));
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
      for (let i = 0; i < 3; i++) { const x = s * R(7, 11), z = -R(0, 24); Math.random() < 0.4 ? palm(g, x, z) : tree(g, x, z, R(0.8, 1.05)); }
      for (let i = 0; i < 2; i++) { const x = s * R(13, 30), z = -R(0, 24); Math.random() < 0.3 ? palm(g, x, z, R(8, 11)) : tree(g, x, z, R(1.0, 1.4)); }
      for (let i = 0; i < 2; i++) bush(g, s * R(5.5, 9), -R(0, 24), R(0.9, 1.4));
      if (Math.random() < 0.5) prop(g, pick(['stump', 'log', 'rock_large']), s * R(4.6, 7), -R(1, 23), R(0.5, 0.9));
      for (let i = 0; i < 2; i++) banana(g, s * R(7, 11), -R(0, 24), R(1, 1.4));
      if (Math.random() < 0.6) rock(g, s * R(4.6, 9), -R(0, 24), R(0.5, 1.3));
      if (Math.random() < 0.25) torch(g, s * 4.3, -R(3, 21));
    } else if (zone === 'ruins') {
      pillar(g, s * 4.7, -4); pillar(g, s * 4.7, -16);
      if (Math.random() < 0.5) statue(g, s * 7.2, -R(4, 20));
      for (let i = 0; i < 3; i++) { const x = s * R(6, 10), z = -R(0, 24); g.add(M(G.box, MAT.stone, x, 0.4, z, R(1, 3), R(0.6, 1.6), R(0.8, 1.4), 0, R(-0.2, 0.2), 0)); }
      for (let i = 0; i < 5; i++) { const x = s * R(4.3, 8), z = -R(0, 24); Math.random() < 0.5 ? fern(g, x, z) : grass(g, x, z); }
      for (let i = 0; i < 4; i++) { const x = s * R(11, 30), z = -R(0, 24); Math.random() < 0.65 ? tree(g, x, z, R(1.0, 1.4)) : palm(g, x, z); }
      if (Math.random() < 0.6) prop(g, pick(['column', 'column_broken']), s * R(6, 9), -R(2, 22), R(2.5, 4));
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
  // merge each obstacle into a handful of meshes (one per material) to keep draw calls low
  for (const k in obTemplates) {
    if (k === 'boulder') { const bw = obTemplates[k], inner = bw.children[0], baked = bake(inner); baked.position.copy(inner.position); bw.remove(inner); bw.add(baked); baked.traverse((o) => { if (o.isMesh) o.castShadow = true; }); continue; }
    const baked = bake(obTemplates[k]); baked.traverse((o) => { if (o.isMesh) { o.castShadow = o.material !== MAT.hole && o.material !== MAT.flame && o.material !== MAT.flameCore; o.receiveShadow = false; } });
    obTemplates[k] = baked;
  }
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

/* ------------------------------------------------------------ dinosaurs (hero + villain share one rig) */
const TAILN = 9;
let dino, villain;
function makeRig(pal, key, opts = {}) {
  const T = !!opts.trex;
  const SPH = G.dSph || (G.dSph = new THREE.SphereGeometry(1, 32, 22));
  const SPHZ = G.dSphZ || (G.dSphZ = G.dSph.clone().rotateX(PI / 2));
  const cone = G.dCone || (G.dCone = new THREE.ConeGeometry(1, 1, 10));
  const tx = skinTextures(key, pal);
  const phys = (o) => new THREE.MeshPhysicalMaterial(Object.assign({ roughness: 0.72, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.6, envMapIntensity: 0.3 }, o));
  const mats = {
    skin: phys({ map: tx.map, bumpMap: tx.bump, bumpScale: 0.07 }),
    part: phys({ map: tx.part, bumpMap: tx.bump, bumpScale: 0.05 }),
    limb: phys({ map: tx.limb, bumpMap: tx.limbBump, bumpScale: 0.06 }),
    belly: phys({ color: new THREE.Color(pal.belly), bumpMap: tx.limbBump, bumpScale: 0.3, clearcoat: 0.15 }),
    spike: phys({ color: pal.spike, roughness: 0.5, clearcoat: 0.1 }),
    claw: phys({ color: pal.claw, roughness: 0.3, clearcoat: 0.6 }),
    tooth: phys({ color: T ? 0xe6dcc0 : 0xf2ead4, roughness: 0.3, clearcoat: 0.5 }),
    eye: new THREE.MeshPhysicalMaterial({ color: pal.eye, emissive: pal.eye, emissiveIntensity: T ? 0.9 : 0.12, roughness: 0.05, clearcoat: 1 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 }),
    mouth: phys({ color: T ? 0x5a1014 : 0x8a1c22, roughness: 0.4, clearcoat: 0.6 })
  };
  const E = (geo, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; return m; };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.set(0, 1.25, 0); body.add(hips);
  const bk = T ? 1.15 : 1;
  hips.add(E(SPHZ, mats.skin, 0.42 * bk, 0.47 * bk, 0.92, 0, 0.02, 0, -0.08));
  hips.add(E(SPHZ, mats.skin, 0.38 * bk, 0.44 * bk, 0.52, 0, 0.13, -0.62, -0.22));
  hips.add(E(SPHZ, mats.skin, 0.3 * bk, 0.33 * bk, 0.42, 0, 0.24, -0.92, -0.5));
  hips.add(E(SPHZ, mats.skin, 0.36 * bk, 0.38 * bk, 0.4, 0, 0.06, 0.62, 0.05));
  const top = (z) => { const a = 0.02 + 0.47 * bk * Math.sqrt(Math.max(0, 1 - (z / 0.92) ** 2)); const b = 0.13 + 0.44 * bk * Math.sqrt(Math.max(0, 1 - ((z + 0.62) / 0.52) ** 2)); return Math.max(a, b); };
  for (let i = 0; i < 16; i++) { const z = -1.0 + i * 0.12, s = (0.55 + Math.sin(i / 15 * PI) * 0.45) * (T ? 0.6 : 0.85); hips.add(E(cone, mats.spike, 0.045 * s, 0.2 * s, 0.045 * s, 0, top(z) + 0.03, z, 0.6)); }
  // neck + head
  const neck = new THREE.Group(); neck.position.set(0, 0.3, -0.86); hips.add(neck);
  neck.add(E(SPHZ, mats.part, 0.21 * bk, 0.24 * bk, T ? 0.34 : 0.44, 0, 0, -0.22));
  for (let i = 0; i < 5; i++) neck.add(E(cone, mats.spike, 0.032, 0.12 * (T ? 0.6 : 1), 0.032, 0, 0.215 * bk, -0.02 - i * 0.1, 0.6));
  const head = new THREE.Group(); head.position.set(0, 0.02, T ? -0.46 : -0.58); neck.add(head);
  head.add(E(SPHZ, mats.part, 0.26, 0.25, 0.34, 0, 0.06, -0.04));
  head.add(E(SPHZ, mats.part, 0.19, 0.16, 0.33, 0, 0.0, -0.37));
  head.add(E(SPHZ, mats.part, 0.145, 0.115, 0.12, 0, -0.005, -0.63));
  head.add(E(SPHZ, mats.mouth, 0.165, 0.05, 0.34, 0, -0.09, -0.32));
  for (const s of [-1, 1]) {
    head.add(E(SPHZ, mats.part, 0.075, 0.06, 0.18, s * 0.16, 0.17, -0.1, 0.2, s * 0.2));
    head.add(E(SPHZ, mats.part, 0.12, 0.14, 0.17, s * 0.16, -0.03, 0.04));
    head.add(E(cone, mats.spike, 0.03, 0.09, 0.03, s * 0.17, 0.22, -0.02, 0.5, 0, s * 0.3));
    head.add(E(SPH, mats.eye, 0.058, 0.058, 0.058, s * 0.175, 0.115, -0.12));
    head.add(E(SPH, mats.pupil, 0.016, 0.047, 0.016, s * 0.228, 0.115, -0.145));
    head.add(E(SPHZ, mats.part, 0.07, 0.03, 0.09, s * 0.18, 0.165, -0.12, -0.15));
    head.add(E(SPH, mats.pupil, 0.022, 0.014, 0.02, s * 0.068, 0.055, -0.7));
    for (let i = 0; i < 8; i++) head.add(E(cone, mats.tooth, 0.018 + (i < 3 ? 0.005 : 0), 0.08 + (i < 3 ? 0.02 : 0), 0.018, s * (0.168 - i * 0.012), -0.115, -0.12 - i * 0.068, PI));
  }
  for (let i = 0; i < 4; i++) head.add(E(cone, mats.spike, 0.035, 0.1, 0.035, 0, 0.29 - i * 0.01, 0.14 - i * 0.1, 0.7));
  const jaw = new THREE.Group(); jaw.position.set(0, -0.08, -0.02); head.add(jaw);
  jaw.add(E(SPHZ, mats.belly, 0.175, 0.075, 0.36, 0, -0.06, -0.3));
  jaw.add(E(SPHZ, mats.mouth, 0.14, 0.035, 0.3, 0, -0.012, -0.28));
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) jaw.add(E(cone, mats.tooth, 0.017, 0.07, 0.017, s * (0.14 - i * 0.011), 0.0, -0.12 - i * 0.068));
  if (T) head.scale.setScalar(1.6);
  // tail: long, smoothly tapering chain
  const tail = []; let parent = hips;
  const radii = [0.34, 0.29, 0.245, 0.2, 0.165, 0.13, 0.1, 0.07, 0.045], lens = [0.46, 0.45, 0.43, 0.41, 0.39, 0.37, 0.34, 0.31, 0.28];
  for (let i = 0; i < TAILN; i++) {
    const seg = new THREE.Group(); seg.position.set(0, i === 0 ? 0.07 : 0, i === 0 ? 0.8 : lens[i - 1] * 0.8); parent.add(seg);
    const r = radii[i] * bk; seg.add(E(SPHZ, mats.part, r, r * 1.06, lens[i] * 0.9, 0, 0, lens[i] * 0.38));
    if (i < TAILN - 1) seg.add(E(cone, mats.spike, r * 0.2, r * (T ? 0.35 : 0.6), r * 0.2, 0, r * 1.04, lens[i] * 0.4, 0.9));
    tail.push(seg); parent = seg;
  }
  // legs with muscled thighs
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(s * 0.28 * bk, -0.08, 0.2); hips.add(thigh);
    thigh.add(E(SPH, mats.skin, 0.22 * bk, 0.35, 0.31 * bk, s * 0.03, -0.17, -0.03));
    thigh.add(E(SPH, mats.limb, 0.14 * bk, 0.22, 0.18, s * 0.05, -0.32, 0.06, 0.3));
    const knee = new THREE.Group(); knee.position.set(s * 0.03, -0.42, -0.1); thigh.add(knee);
    knee.add(E(SPH, mats.limb, 0.105, 0.27, 0.12, 0, -0.22, 0.08, -0.35));
    const ankle = new THREE.Group(); ankle.position.set(0, -0.44, 0.17); knee.add(ankle);
    ankle.add(E(SPH, mats.limb, 0.062, 0.19, 0.072, 0, -0.15, -0.04, 0.3));
    const foot = new THREE.Group(); foot.position.set(0, -0.31, -0.08); ankle.add(foot);
    for (let k = -1; k <= 1; k++) {
      foot.add(E(SPHZ, mats.limb, 0.045, 0.04, 0.15, k * 0.065, 0, -0.1, 0, k * 0.28));
      foot.add(E(cone, mats.claw, 0.024, 0.11, 0.024, k * 0.11, -0.02, -0.25, -PI / 2 - 0.35, 0, 0));
    }
    foot.add(E(cone, mats.claw, 0.03, 0.15, 0.03, s * 0.05, 0.06, -0.02, -PI / 2 + 0.9, 0, 0));
    legs.push({ thigh, knee, ankle, foot, s });
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.25 * bk, -0.02, -0.74); hips.add(arm);
    arm.add(E(SPH, mats.limb, 0.055, 0.14, 0.06, 0, -0.1, -0.03, -0.5));
    const fore = new THREE.Group(); fore.position.set(0, -0.2, -0.09); arm.add(fore);
    fore.add(E(SPH, mats.limb, 0.042, 0.11, 0.046, 0, -0.06, -0.06, -1.1));
    for (let k = 0; k < 2; k++) fore.add(E(cone, mats.claw, 0.016, 0.07, 0.016, (k - 0.5) * 0.04, -0.1, -0.15, -PI / 2 - 0.6, 0, 0));
    if (T) arm.scale.setScalar(0.5);
    arms.push({ arm, fore });
  }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.8).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
  shadow.position.y = 0.03; shadow.renderOrder = 1;
  const group = new THREE.Group(); group.add(root); group.add(shadow);
  root.scale.setScalar(T ? 1.12 : 0.85); shadow.scale.setScalar(T ? 1.35 : 1);
  scene.add(group);
  const rig = { group, root, body, hips, neck, head, jaw, tail, legs, arms, mats, shadow, trex: T };
  rig.cur = poseIdle(0, T);
  return rig;
}
function buildDino() {
  dino = makeRig(SKINS[profile.skin], profile.skin, {});
  dino.skin = profile.skin;
  const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 2), new THREE.MeshBasicMaterial({ color: 0x3aff6a, wireframe: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  bubble.add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 16), new THREE.MeshBasicMaterial({ color: 0x2aff60, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })));
  bubble.position.y = 1.1; bubble.visible = false; dino.group.add(bubble); dino.bubble = bubble;
  const magRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.04, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  magRing.rotation.x = PI / 2; magRing.position.y = 0.6; magRing.visible = false; dino.group.add(magRing); dino.magRing = magRing;
  villain = makeRig(VILLAIN, 'villain', { trex: true });
  villain.group.visible = false; villain.side = 1; villain.phase = 0; villain.lastStep = 0;
}
function setSkin(i) {
  const tx = skinTextures(i, SKINS[i]), sk = SKINS[i], m = dino.mats;
  m.skin.map = tx.map; m.part.map = tx.part; m.limb.map = tx.limb;
  m.skin.bumpMap = m.part.bumpMap = tx.bump; m.limb.bumpMap = m.belly.bumpMap = tx.limbBump;
  m.belly.color.set(sk.belly); m.spike.color.setHex(sk.spike); m.claw.color.setHex(sk.claw); m.eye.color.setHex(sk.eye); m.eye.emissive.setHex(sk.eye);
  for (const k in m) m[k].needsUpdate = true;
  dino.skin = i;
  setModelSkin(i);
}


/* ------------------------------------------------------------ rigged glTF dinosaurs (Quaternius, public domain) */
// per model: file, which material plays which role, and the height we want in metres
const DINO_MODELS = {
  reptile: { url: 'models/reptile.json', keep: true, h: 1.75 },
  raptor: { url: 'models/velociraptor.json', roles: { Brown: 'body', Black: 'dark', LightBrown: 'belly', Eyes: 'eye' }, h: 1.9 },
  trex: { url: 'models/trex.json', roles: { Green: 'body', LightGreen: 'dark', LightYellow: 'belly', Black: 'claw', Red: 'mouth' }, h: 2.5 },
  trike: { url: 'models/triceratops.json', roles: { Brown: 'body', Purple: 'dark', LightBrown: 'belly' }, h: 1.9 }
};
const VILLAIN_PAL = { body: 0x34291f, dark: 0x6b1a10, belly: 0x8a6e52, eye: 0xff2a10, claw: 0x0b0908, mouth: 0x8a0c0c };
// Models ship as glTF JSON with base64 buffers. Some hosts (the web preview) block fetching data: URLs,
// so decode the buffer here and hand the loader an in-memory GLB instead.
function jsonToGlb(j) {
  const enc = new TextEncoder();
  let bin = new Uint8Array(0);
  if (j.buffers && j.buffers[0] && /^data:/.test(j.buffers[0].uri || '')) {
    const b64 = j.buffers[0].uri.split(',')[1], raw = atob(b64); bin = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
    j.buffers[0] = { byteLength: bin.length };
  }
  let jsonBytes = enc.encode(JSON.stringify(j));
  const jPad = (4 - (jsonBytes.length % 4)) % 4, bPad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + jsonBytes.length + jPad + (bin.length ? 8 + bin.length + bPad : 0);
  const out = new ArrayBuffer(total), dv = new DataView(out), u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length + jPad, true); dv.setUint32(16, 0x4e4f534a, true);
  u8.set(jsonBytes, 20); u8.fill(0x20, 20 + jsonBytes.length, 20 + jsonBytes.length + jPad);
  if (bin.length) { const o = 20 + jsonBytes.length + jPad; dv.setUint32(o, bin.length + bPad, true); dv.setUint32(o + 4, 0x004e4942, true); u8.set(bin, o + 8); }
  return out;
}
function loadGLTF(url) {
  return fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); })
    .then((j) => new Promise((res, rej) => new THREE.GLTFLoader().parse(jsonToGlb(j), '', res, rej)));
}
const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
function makeInstance(gltf, key, pal, height, rootScale, emissiveEyes) {
  const spec = DINO_MODELS[key], m = gltf.scene;
  const mk2 = (c, r = 0.62) => { const x = new THREE.MeshStandardMaterial({ color: lin(c), roughness: r, metalness: 0 }); x.envMapIntensity = 0.35; return x; };
  const mats = { body: mk2(pal.body), dark: mk2(pal.dark, 0.55), belly: mk2(pal.belly, 0.7), eye: mk2(pal.eye, 0.15), claw: mk2(pal.claw || 0x151210, 0.35), mouth: mk2(pal.mouth || 0x7a1a1a, 0.4) };
  mats.eye.emissive = lin(pal.eye || 0x222222); mats.eye.emissiveIntensity = emissiveEyes ? 1.2 : 0.3;
  if (spec.keep) {
    // textured, realistic model: keep its own painted skin, just tune the material
    m.traverse((o) => { if (o.isMesh) { o.material.envMapIntensity = 0.45; o.material.roughness = 0.68; mats.body = o.material; o.castShadow = true; o.frustumCulled = false; } });
  } else m.traverse((o) => { if (o.isMesh) { o.material = mats[spec.roles[o.material.name] || 'body']; o.castShadow = true; o.frustumCulled = false; } });
  // face -z and stand on the ground at the wanted height, whatever the source orientation was
  m.updateMatrixWorld(true);
  // measure the skeleton: glTF ignores a skinned mesh's own node transform, so mesh bounds can be off by 100x
  const box = new THREE.Box3(), v = new THREE.Vector3();
  m.traverse((o) => { if (o.isBone) box.expandByPoint(o.getWorldPosition(v)); });
  const c = box.getCenter(new THREE.Vector3());
  const head = m.getObjectByName('Head'); const hp = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0, 1);
  const dx = hp.x - c.x, dz = hp.z - c.z;
  const pivot = new THREE.Group(); pivot.add(m);
  pivot.rotation.y = PI - Math.atan2(dx, dz);
  const s = height / ((box.max.y - box.min.y) * 1.08 * rootScale);   // bones sit ~8% inside the skin
  pivot.scale.setScalar(s);
  m.position.set(-c.x, -box.min.y, -c.z);
  const inst = { model: pivot, inner: m, mats, mixer: new THREE.AnimationMixer(m), actions: {}, anim: null, key, baseScale: s, keep: !!spec.keep };
  for (const clip of gltf.animations) inst.actions[clip.name.replace(/^.*[_|]/, '')] = inst.mixer.clipAction(clip);
  for (const k of ['Jump', 'Death', 'Attack']) if (inst.actions[k]) { inst.actions[k].setLoop(THREE.LoopOnce, 1); inst.actions[k].clampWhenFinished = true; }
  return inst;
}
function useInstance(rig, inst) {
  if (rig.model && rig.model !== inst.model) rig.model.visible = false;
  if (!inst.model.parent) rig.root.add(inst.model);
  inst.model.visible = true;
  rig.body.visible = false;
  Object.assign(rig, { model: inst.model, mmats: inst.mats, mixer: inst.mixer, actions: inst.actions, anim: null, baseScale: inst.baseScale });
  inst.mixer.stopAllAction(); playAnim(rig, 'Idle', 0);
}
function playAnim(rig, name, fade = 0.2) {
  if (!rig.actions || rig.anim === name || !rig.actions[name]) return;
  const next = rig.actions[name];
  next.reset().setEffectiveWeight(1).play();
  if (rig.anim && rig.actions[rig.anim]) rig.actions[rig.anim].crossFadeTo(next, fade, false);
  rig.anim = name;
}
const GLTF_CACHE = {};
const heroInst = {};
function paintInstance(inst, pal) {
  const m = inst.mats;
  if (inst.keep) { m.body.color.setHex(pal.tint || 0xffffff); return; }
  for (const k of ['body', 'dark', 'belly', 'eye', 'claw', 'mouth']) if (pal[k] !== undefined) m[k].color.copy(lin(pal[k]));
  m.eye.emissive.copy(lin(pal.eye));
}
async function heroFor(i) {
  const sk = SKINS[i], key = sk.model;
  if (!heroInst[key]) heroInst[key] = makeInstance(await loadGLTF(DINO_MODELS[key].url), key, sk.pal, DINO_MODELS[key].h, 0.85, false);
  paintInstance(heroInst[key], sk.pal);
  return heroInst[key];
}
function setModelSkin(i) {
  if (!dino || !dino.mixer) return;
  heroFor(i).then((inst) => { if (dino.skin === i) useInstance(dino, inst); }).catch(() => {});
}
/* realistic trees (ez-tree, MIT) with photo bark (Poly Haven / TextureCan, CC0) and low-poly props (Quaternius / Kenney, CC0) */
const TREES = {}, PROPS = {};
const texLoader = new THREE.TextureLoader();
function loadTex(url, srgb = true, rep) {
  return new Promise((res) => texLoader.load(url, (t) => { if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = ANISO; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } res(t); }, undefined, () => res(null)));
}
async function loadScenery() {
  const bark = {}, leaves = {};
  await Promise.all(['oak', 'birch', 'pine'].map(async (b) => {
    const [map, nrm] = await Promise.all([loadTex(`textures/bark_${b}_color.jpg`, true, [1, 4]), loadTex(`textures/bark_${b}_normal.jpg`, false, [1, 4])]);
    bark[b] = std({ map, normalMap: nrm, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.95, color: 0xd8cfc0 });
  }));
  await Promise.all(['oak', 'ash', 'aspen', 'pine'].map(async (l) => {
    const map = await loadTex(`textures/leaves_${l}.png`);
    leaves[l] = std({ map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, color: 0xc8dcb0 });
  }));
  await Promise.all(['oak_a', 'oak_b', 'ash', 'aspen', 'pine', 'bush'].map(async (n) => {
    try {
      const g = await loadGLTF(`models/trees/${n}.json`); const parts = [];
      let maxY = 0; g.scene.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); maxY = Math.max(maxY, o.geometry.boundingBox.max.y); } });
      g.scene.traverse((o) => { if (o.isMesh) { const geo = o.geometry.clone(); geo.scale(1 / maxY, 1 / maxY, 1 / maxY); const [kind, type] = o.material.name.split('_'); parts.push({ geo, mat: kind === 'bark' ? (bark[type] || bark.oak) : (type === 'aspen' || type === 'pine' ? leaves[type] : leaves.oak) || leaves.oak }); } });
      TREES[n] = parts;
    } catch (e) { /* fall back to built-in trees */ }
  }));
  const PROP_COL = { grass: 0x4c7d2c, dirt: 0x6e5238, woodBark: 0x5a3e28, woodBarkDark: 0x3e2a1c, woodInner: 0xc9a06a, colorRed: 0xc8302a, stone: 0x9a968a, stoneDark: 0x6f6b62, rock: 0x6f6a62, rockTrack: 0x5a564f, crystal: 0x3aa8ff, _defaultMat: 0xe8e0d0, leafsGreen: 0x3f7a2a, leafsDark: 0x2c5a22 };
  await Promise.all(['rock_large', 'rock_tall', 'stump', 'log', 'flower_red', 'mushroom_red', 'bush_large', 'crystal_rock', 'column', 'column_broken'].map(async (n) => {
    try {
      const g = await loadGLTF(`models/${n}.json`); g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene), h = box.max.y - box.min.y, c = box.getCenter(new THREE.Vector3()); const parts = [];
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        // quantized attributes (int8/int16) must become floats before any transform is applied
        const geo = new THREE.BufferGeometry(); if (o.geometry.index) geo.setIndex(o.geometry.index.clone());
        const getters = ['getX', 'getY', 'getZ', 'getW'];
        for (const a of ['position', 'normal']) {
          const src = o.geometry.attributes[a]; if (!src) continue;
          const n = Math.min(3, src.itemSize), out = new Float32Array(src.count * 3);
          for (let i = 0; i < src.count; i++) for (let k = 0; k < n; k++) out[i * 3 + k] = src[getters[k]](i);
          geo.setAttribute(a, new THREE.BufferAttribute(out, 3));
        }
        if (!geo.attributes.normal) geo.computeVertexNormals();
        geo.applyMatrix4(o.matrixWorld); geo.translate(-c.x, -box.min.y, -c.z); geo.scale(1 / h, 1 / h, 1 / h);
        geo.attributes.normal && geo.attributes.normal.array.length && geo.normalizeNormals();
        const nm = o.material.name, key = 'prop_' + nm;
        MAT[key] = MAT[key] || std({ color: PROP_COL[nm] !== undefined ? PROP_COL[nm] : 0x888070, roughness: nm === 'crystal' ? 0.2 : 0.85, flatShading: true, emissive: nm === 'crystal' ? 0x0a4aa0 : 0x000000 });
        parts.push({ geo, mat: MAT[key] });
      });
      PROPS[n] = parts;
    } catch (e) { /* optional */ }
  }));
}
function placeParts(g, parts, x, y, z, s, ry = R(0, PI * 2), shadow = true) {
  for (const p of parts) { const m = M(p.geo, p.mat, x, y, z, s, s, s, 0, ry, 0); m.castShadow = shadow && !(p.mat.alphaTest > 0); g.add(m); }
}
function tree(g, x, z, s = 1, kinds) {
  // far trees use the lighter aspen and cast no shadow (only near trees reach the shadow camera anyway)
  const far = Math.abs(x) > 12.5;
  const list = (kinds || (far ? ['aspen', 'aspen', 'oak_a'] : ['oak_a', 'oak_b', 'ash', 'aspen'])).filter((k) => TREES[k]);
  if (!list.length) { bigTree(g, x, z, s); return; }
  const k = pick(list);
  placeParts(g, TREES[k], x, 0, z, (k === 'aspen' ? 11 : 9.5) * s * R(0.85, 1.15), R(0, PI * 2), !far);
}
function prop(g, name, x, z, h, y = 0) { if (PROPS[name]) placeParts(g, PROPS[name], x, y, z, h); else if (name.startsWith('rock')) rock(g, x, z, h * 0.6, y); }
async function loadModels() {
  try {
    const sk = SKINS[profile.skin];
    const [hero, vg] = await Promise.all([heroFor(profile.skin), loadGLTF(DINO_MODELS.trex.url)]);
    dino.mixer = true; useInstance(dino, hero);
    const vi = makeInstance(vg, 'trex', VILLAIN_PAL, 3.3, 1.12, true);
    useInstance(villain, vi);
  } catch (e) { console.warn('Rigged models unavailable, using built-in dinos', e); dino.mixer = null; }
  await loadScenery();
  await initWildlife();
}
let roarT = 4;
function animateModel(rig, dt, want, ts) {
  if (want === 'Jump' && rig.anim !== 'Jump') { playAnim(rig, 'Jump', 0.1); }
  else if (want !== 'Jump') playAnim(rig, want, want === 'Death' ? 0.15 : 0.25);
  const a = rig.actions[rig.anim]; if (a) a.timeScale = ts;
  rig.mixer.update(dt);
}
/* wild dinosaurs grazing and wandering beside the road */
const wild = [];
async function initWildlife() {
  const plan = [['trike', { body: 0x7a6a4a, dark: 0x5a3a2a, belly: 0xc8b48a }], ['trike', { body: 0x5e6a48, dark: 0x8a4a2a, belly: 0xbfae86 }], ['raptor', { body: 0x8a6a3a, dark: 0x2a2018, belly: 0xd8c09a, eye: 0xffb020 }], ['trex', { body: 0x4e5a34, dark: 0x2a3220, belly: 0xb8a878, eye: 0xffa020 }]];
  for (const [key, pal] of plan) {
    try {
      const g = await loadGLTF(DINO_MODELS[key].url);
      const inst = makeInstance(g, key, { eye: 0x222222, ...pal }, key === 'trex' ? 4.2 : key === 'trike' ? 2.6 : 1.9, 1, false);
      const holder = new THREE.Group(); holder.add(inst.model); holder.visible = false; scene.add(holder);
      const w = { inst, holder, wd: 0, x: 0, mode: 'Idle', heading: 0, sp: 0, anim: null, actions: inst.actions, mixer: inst.mixer };
      wild.push(w); respawnWild(w, true);
    } catch (e) { /* optional */ }
  }
}
function respawnWild(w, first) {
  const side = Math.random() < 0.5 ? -1 : 1;
  w.wd = distance + (first ? R(30, 160) : R(110, 190)); w.x = side * R(10, 17);
  w.mode = Math.random() < 0.55 ? 'Walk' : 'Idle';
  w.heading = w.mode === 'Walk' ? (Math.random() < 0.5 ? PI : side > 0 ? -PI / 2 - 0.3 : PI / 2 + 0.3) : R(0, PI * 2);
  w.sp = w.mode === 'Walk' ? R(1.2, 2.2) : 0;
  w.anim = null; w.inst.mixer.stopAllAction();
}
function updateWild(dt) {
  for (const w of wild) {
    const z = zoneAt(w.wd), ok = z === 'jungle' || z === 'waterfall' || z === 'ruins';
    let wz = distance - w.wd;
    if (wz > 18 || wz < -220) { respawnWild(w, false); wz = distance - w.wd; }
    w.holder.visible = ok && (state !== 'loading');
    if (!w.holder.visible) continue;
    if (w.sp) { const fx = -Math.sin(w.heading), fz = -Math.cos(w.heading); w.x += fx * w.sp * dt; w.wd -= fz * w.sp * dt; if (Math.abs(w.x) < 8) { w.heading = -w.heading; w.x = Math.sign(w.x) * 8; } }
    w.holder.position.set(w.x, 0, distance - w.wd); w.holder.rotation.y = w.heading;
    playAnim(w, w.mode, 0.3); w.inst.mixer.update(dt);
  }
}

/* poses: plain objects of joint angles so we can blend smoothly */
const arr = (v) => new Array(TAILN).fill(v);
function poseBase() { return { hy: 1.25, hrx: 0, hrz: 0, nrx: 0.55, hrx2: -0.55, hry: 0, jaw: 0.1, trx: arr(0.04), try_: arr(0), leg: [[0.25, -0.55, 0.45, -0.15], [0.25, -0.55, 0.45, -0.15]], arm: [0, 0] }; }
function poseIdle(t, T) {
  const p = poseBase();
  const br = Math.sin(t * 1.8);
  p.hy = 1.24 + br * 0.012; p.hrx = br * 0.01;
  p.leg = [[0.12, -0.4, 0.35, -0.05], [0.18, -0.45, 0.38, -0.05]];
  p.nrx = (T ? 0.35 : 0.6) + Math.sin(t * 0.7) * 0.05; p.hrx2 = -p.nrx; p.hry = Math.sin(t * 0.45) * 0.45 + Math.sin(t * 2.7) * 0.03;
  const roar = Math.max(0, Math.sin(t * 0.55) - 0.8) * 5;
  p.jaw = 0.06 + br * 0.02 + roar * 0.5;
  for (let i = 0; i < TAILN; i++) { p.trx[i] = (i === 0 ? -0.1 : 0.04) + Math.sin(t * 1.2 - i * 0.45) * 0.02; p.try_[i] = Math.sin(t * 0.9 - i * 0.5) * 0.06; }
  p.arm = [Math.sin(t * 1.3) * 0.1, Math.sin(t * 1.3 + 1) * 0.1];
  return p;
}
function poseRun(ph, t, T) {
  const p = poseBase();
  for (let i = 0; i < 2; i++) {
    const q = ph + i * PI, lift = Math.max(0, Math.cos(q));
    p.leg[i] = [0.2 + Math.sin(q) * 0.85, -0.5 - lift * 1.15, 0.4 + lift * 0.8 - Math.max(0, -Math.cos(q)) * 0.15, -0.15 + Math.sin(q) * 0.45];
  }
  p.hy = 1.2 + Math.abs(Math.cos(ph)) * 0.09; p.hrx = 0.05 + Math.sin(ph * 2) * 0.035; p.hrz = Math.sin(ph) * 0.05;
  // head stays steady while the body bobs, like a real predator
  p.nrx = (T ? 0.18 : 0.42) + Math.sin(ph * 2 + 0.6) * 0.05; p.hrx2 = -p.nrx - p.hrx;
  p.jaw = T ? 0.3 + Math.max(0, Math.sin(ph * 0.5)) * 0.5 : 0.16 + Math.sin(ph) * 0.04;
  for (let i = 0; i < TAILN; i++) { p.trx[i] = (i === 0 ? -0.14 : 0.02) + Math.sin(ph * 2 - i * 0.5) * 0.035; p.try_[i] = Math.sin(ph - i * 0.55) * 0.08; }
  p.arm = [Math.sin(ph) * 0.35, Math.sin(ph + PI) * 0.35];
  return p;
}
function poseJump(vy) {
  const p = poseBase(); const k = clamp(vy / 12, -1, 1);
  p.leg = [[0.95, -1.5, 1.2, 0.35], [0.7, -1.25, 1.0, 0.25]];
  p.hy = 1.2; p.hrx = k * 0.2; p.nrx = 0.3; p.hrx2 = -0.3 - k * 0.2; p.jaw = 0.45;
  for (let i = 0; i < TAILN; i++) { p.trx[i] = (i === 0 ? -0.05 - k * 0.15 : 0.04 + k * 0.025); p.try_[i] = 0; }
  p.arm = [0.6, 0.6];
  return p;
}
function poseSlide(t) {
  const p = poseBase();
  p.hy = 0.62; p.hrx = -0.12; p.hrz = Math.sin(t * 30) * 0.015; p.nrx = 0.05; p.hrx2 = 0.05; p.jaw = 0.3;
  p.leg = [[-0.95, -1.4, 1.5, 0.2], [-0.4, -1.9, 1.7, 0.6]];
  for (let i = 0; i < TAILN; i++) { p.trx[i] = (i === 0 ? 0.08 : 0.0); p.try_[i] = Math.sin(t * 14 - i) * 0.04; }
  p.arm = [-0.5, -0.5];
  return p;
}
function poseDead() {
  const p = poseBase();
  p.hy = 0.5; p.hrz = 1.35; p.nrx = 0.1; p.hrx2 = 0.2; p.jaw = 0.6;
  p.leg = [[0.6, -1.0, 0.6, 0.2], [-0.2, -0.5, 0.4, 0.1]];
  for (let i = 0; i < TAILN; i++) { p.trx[i] = 0.04; p.try_[i] = 0.08; }
  return p;
}
function poseChomp(t) {
  const p = poseIdle(t, true);
  p.hrx = -0.15; p.nrx = 0.05; p.hrx2 = 0.15; p.jaw = 0.55 + Math.abs(Math.sin(t * 9)) * 0.6; p.hy = 1.3;
  p.leg = [[0.5, -0.8, 0.6, 0], [-0.1, -0.5, 0.4, -0.1]];
  return p;
}
function blendPose(cur, tgt, k) {
  cur.hy = lerp(cur.hy, tgt.hy, k); cur.hrx = lerp(cur.hrx, tgt.hrx, k); cur.hrz = lerp(cur.hrz, tgt.hrz, k);
  cur.nrx = lerp(cur.nrx, tgt.nrx, k); cur.hrx2 = lerp(cur.hrx2, tgt.hrx2, k); cur.hry = lerp(cur.hry, tgt.hry, k); cur.jaw = lerp(cur.jaw, tgt.jaw, k);
  for (let i = 0; i < TAILN; i++) { cur.trx[i] = lerp(cur.trx[i], tgt.trx[i], k); cur.try_[i] = lerp(cur.try_[i], tgt.try_[i], k); }
  for (let i = 0; i < 2; i++) { for (let j = 0; j < 4; j++) cur.leg[i][j] = lerp(cur.leg[i][j], tgt.leg[i][j], k); cur.arm[i] = lerp(cur.arm[i], tgt.arm[i], k); }
}
function applyPose(d, p) {
  d.hips.position.y = p.hy; d.hips.rotation.x = p.hrx; d.hips.rotation.z = p.hrz;
  d.neck.rotation.x = p.nrx; d.head.rotation.x = p.hrx2; d.head.rotation.y = p.hry; d.jaw.rotation.x = p.jaw;
  for (let i = 0; i < TAILN; i++) { d.tail[i].rotation.x = p.trx[i]; d.tail[i].rotation.y = p.try_[i]; }
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
  for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(cm); s.position.set(R(-280, 280), R(70, 140), R(-380, -250)); s.scale.set(R(90, 150), R(26, 40), 1); clouds.add(s); }
  clouds.renderOrder = -8; scene.add(clouds); clouds.userData.mat = cm;

  hemi = new THREE.HemisphereLight(0xd5ecff, 0x3a4a22, 0.7); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d2, 3); sun.castShadow = settings.quality === 'high';
  sun.shadow.mapSize.set(1024, 1024);
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
function sfx(name, v = 1) {
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
    case 'buy': [880, 1320].forEach((f, i) => tone('square', f, f, t + i * 0.07, 0.12, 0.06)); tone('sine', 1760, 1760, t + 0.14, 0.25, 0.12); break;
    case 'award': [523, 784, 1047].forEach((f, i) => tone('triangle', f, f, t + i * 0.09, 0.3, 0.13)); break;
    case 'stomp': tone('sine', 75, 32, t, 0.3, Math.max(0.0002, 0.55 * v)); noise(t, 0.2, Math.max(0.0002, 0.25 * v), 'lowpass', 250); break;
    case 'trexroar': {
      const ctx = audio.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(55, t + 1.3); o2.frequency.setValueAtTime(46, t); o2.frequency.linearRampToValueAtTime(30, t + 1.3);
      lfo.frequency.value = 17; lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(260, t + 1.3); f.Q.value = 4;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(audio.sfx); [o, o2, lfo].forEach((x) => { x.start(t); x.stop(t + 1.45); });
      noise(t, 1.2, 0.25, 'bandpass', 320, audio.sfx, 1.2);
      break;
    }
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
let curZone = 'jungle', shownZone = '', progT = 0;

function zoneIndexAt(wd) { return (startZone + Math.floor(Math.max(0, wd) / ZONE_LEN)) % 5; }
function zoneAt(wd) { return ZONES[zoneIndexAt(wd)]; }
function lightFor(z) { return z === 'cave' ? LIGHT.cave : nightMode ? LIGHT.night : LIGHT[z]; }

/* ------------------------------------------------------------ living grass: thousands of instanced blades swaying in the wind */
const GU = { time: { value: 0 }, scroll: { value: 0 }, cut: { value: -999 }, left: { value: 1 }, right: { value: 1 } };
const GRASS_L = 86;
let grassMesh = null;
function buildGrass() {
  const hi = settings.quality === 'high';
  const N = hi ? 11000 : 5500;
  const segs = 3, pos = [], col = [], nor = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const tt = i / segs, w = 0.05 * (1 - tt * 0.9), bend = tt * tt * 0.22, c = 0.22 + 0.78 * Math.pow(tt, 0.8);
    pos.push(-w, tt, bend, w, tt, bend); col.push(c, c, c, c, c, c); nor.push(0, 0.55, 0.83, 0, 0.55, 0.83);
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: GU.time, uScroll: GU.scroll, uCut: GU.cut, uLeft: GU.left, uRight: GU.right });
    sh.vertexShader = 'uniform float uTime; uniform float uScroll; uniform float uCut; uniform float uLeft; uniform float uRight;\n' +
      sh.vertexShader.replace('#include <project_vertex>', `
        vec4 ip = instanceMatrix * vec4(transformed, 1.0);
        vec3 org = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float zz = mod(org.z + uScroll, ${GRASS_L.toFixed(1)}) - ${(GRASS_L - 14).toFixed(1)};
        float h = position.y;
        float gust = sin(uTime * 1.7 + org.x * 0.31 + zz * 0.23) * 0.55 + sin(uTime * 3.3 + org.z * 0.9) * 0.18;
        ip.x += gust * h * h * 0.2; ip.z += (zz - org.z) + gust * h * h * 0.08;
        float on = (org.x < 0.0 ? uLeft : uRight) * step(uCut, zz);
        ip.y -= (1.0 - on) * 2.5;
        vec4 mvPosition = modelViewMatrix * ip;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  const m = new THREE.InstancedMesh(geo, mat, N);
  const d = new THREE.Object3D(), c = new THREE.Color();
  const greens = [[0.32, 0.56, 0.16], [0.42, 0.62, 0.2], [0.24, 0.44, 0.13], [0.55, 0.6, 0.24], [0.36, 0.52, 0.18], [0.62, 0.58, 0.3]];
  let i = 0;
  while (i < N) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const off = 0.25 + Math.pow(Math.random(), 1.8) * 15;          // dense along the road, thinner further out
    const cx = side * (3.95 + off), cz = R(0, GRASS_L);
    const base = pick(greens), n = RI(10, 26), tall = 0.45 + Math.min(off, 8) * 0.06;
    for (let k = 0; k < n && i < N; k++, i++) {
      const r = Math.sqrt(Math.random()) * 0.55, a = R(0, PI * 2);
      const x = cx + Math.cos(a) * r; if (Math.abs(x) < 3.9) { k--; i--; continue; }
      d.position.set(x, 0, cz + Math.sin(a) * r);
      d.rotation.set(R(-0.15, 0.15), R(0, PI * 2), R(-0.15, 0.15));
      d.scale.set(R(0.8, 1.4), tall * R(0.65, 1.35), 1);
      d.updateMatrix(); m.setMatrixAt(i, d.matrix);
      const v = R(0.82, 1.12); c.setRGB(base[0] * v, base[1] * v, base[2] * v).convertSRGBToLinear(); m.setColorAt(i, c);
    }
  }
  m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
  scene.add(m); grassMesh = m;
}
function grassZone(z, dt) {
  const tl = z === 'cave' || z === 'bridge' ? 0 : z === 'waterfall' ? 0 : 1, tr = z === 'cave' || z === 'bridge' ? 0 : 1;
  const k = dt === undefined ? 1 : 1 - Math.exp(-2.5 * dt);
  GU.left.value = lerp(GU.left.value, tl, k); GU.right.value = lerp(GU.right.value, tr, k);
}
function updateGrass(dt) {
  if (!grassMesh) return;
  GU.time.value = t; GU.scroll.value = distance % GRASS_L;
  GU.cut.value = junction ? -(junction.wdC - distance) + JCT.half + 0.3 : -999;
  grassZone(curZone, dt);
}
/* adaptive resolution: keep the frame rate up on slower phones */
const perf = { acc: 0, frames: 0, pr: 1, maxPr: 1, minPr: 0.6, shadowsOff: false };
function initPerf() {
  perf.maxPr = Math.min(window.devicePixelRatio || 1, settings.quality === 'high' ? 1.5 : 1);
  perf.minPr = settings.quality === 'high' ? 0.7 : 0.55;
  perf.pr = perf.maxPr; perf.acc = 0; perf.frames = 0;
}
function tunePerf(rawDt) {
  if (state !== 'playing' && state !== 'menu') { perf.acc = 0; perf.frames = 0; return; }
  perf.acc += rawDt; perf.frames++;
  if (perf.acc < 2) return;
  const fps = perf.frames / perf.acc; perf.acc = 0; perf.frames = 0;
  let pr = perf.pr;
  if (fps < 48 && pr > perf.minPr) pr = Math.max(perf.minPr, pr - 0.15);
  else if (fps > 58 && pr < perf.maxPr) pr = Math.min(perf.maxPr, pr + 0.1);
  else if (fps < 38 && pr <= perf.minPr && !perf.shadowsOff && sun.castShadow) { perf.shadowsOff = true; sun.castShadow = false; }
  if (pr !== perf.pr) { perf.pr = pr; renderer.setPixelRatio(pr); resize(); }
}

/* ------------------------------------------------------------ junctions: the road ends and splits left / right */
const JCT = { approach: 16, half: 3.6, branch: 46 };
const UP = new THREE.Vector3(0, 1, 0);
let junction = null, nextJunctionAt = 300, turnYaw = 0;
const legacy = [];
function stripRoad(g, zone, len) {
  const geo = new THREE.PlaneGeometry(7.2, len).rotateX(-PI / 2).translate(0, 0, -len / 2);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len / 24);
  const road = new THREE.Mesh(geo, roadMats[zone]); road.receiveShadow = true; g.add(road);
  for (const lx of [-1, 1]) for (let z = -1.2; z > -len; z -= 3) g.add(M(G.plane, MAT.laneMark, lx, 0.012, z, 0.11, 1.5, 1, -PI / 2, 0, 0));
  for (const s of [-1, 1]) {
    g.add(M(G.plane, MAT.edgeLine, s * 3.35, 0.012, -len / 2, 0.09, len, 1, -PI / 2, 0, 0));
    if (zone === 'ruins' || zone === 'waterfall') for (let z = -0.6; z > -len; z -= 1.2) g.add(M(G.box, MAT.stone, s * 3.66, 0.14, z, 0.36, 0.28, 1.14));
    else g.add(M(G.cyl, MAT.bark, s * 3.66, 0.15, -len / 2, 0.17, len, 0.17, PI / 2, 0, 0));
  }
}
function stripDecor(g, zone, len) {
  for (const s of [-1, 1]) {
    g.add(M(new THREE.PlaneGeometry(40, len).rotateX(-PI / 2).translate(0, 0, -len / 2), MAT.ground, s * 23.6, -0.02, 0));
    for (let i = 0; i < len / 4; i++) { const x = s * R(4.4, 7), z = -R(0, len); Math.random() < 0.5 ? fern(g, x, z) : grass(g, x, z); }
    for (let i = 0; i < len / 13; i++) { const x = s * R(7, 12), z = -R(0, len); zone !== 'ruins' && Math.random() < 0.45 ? palm(g, x, z) : tree(g, x, z, R(0.8, 1.1)); }
    for (let i = 0; i < len / 20; i++) tree(g, s * R(14, 28), -R(0, len), R(1, 1.4), ['aspen']);
    if (zone === 'ruins') pillar(g, s * 4.7, -R(4, len - 4));
  }
}
function buildJunction(zone) {
  const g = new THREE.Group();
  const A = JCT.approach, H = JCT.half, cz = -(A + H);
  const ap = new THREE.Group(); stripRoad(ap, zone, A); stripDecor(ap, zone, A); g.add(ap);
  const cr = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2).rotateX(-PI / 2), roadMats[zone]); cr.position.set(0, 0, cz); cr.receiveShadow = true; g.add(cr);
  for (const dir of [-1, 1]) {
    const b = new THREE.Group(); stripRoad(b, zone, JCT.branch); stripDecor(b, zone, JCT.branch);
    b.rotation.y = dir > 0 ? -PI / 2 : PI / 2; b.position.set(dir * H, 0, cz); g.add(b);
  }
  // the dead end: ground, a wall of boulders and jungle, and an arrow sign
  g.add(M(new THREE.PlaneGeometry(8, 46).rotateX(-PI / 2).translate(0, 0, -23), MAT.ground, 0, -0.02, cz - H));
  for (let x = -4.6; x <= 4.6; x += 1.5) rock(g, x + R(-0.3, 0.3), cz - H - R(0.8, 1.6), R(1.1, 1.7));
  for (let i = 0; i < 4; i++) tree(g, R(-6, 6), cz - H - R(4, 12), R(1, 1.4));
  for (let i = 0; i < 6; i++) bush(g, R(-6, 6), cz - H - R(2.5, 5), R(1, 1.6));
  sign(g, 0, cz - H - 0.4, MAT.signs.turn, 1.7);
  if (zone === 'ruins') { g.add(M(G.box, MAT.stone, 0, 2.4, cz - H - 2.6, 12, 4.8, 1.4)); }
  return bake(g);
}
let forceJ = false;
function canJunction(wd) {
  if (forceJ) return true;
  const z = zoneAt(wd); if (!(z === 'jungle' || z === 'waterfall' || z === 'ruins')) return false;
  const into = ((wd % ZONE_LEN) + ZONE_LEN) % ZONE_LEN; return into > 40 && into < ZONE_LEN - 90;
}
function getJunctionPiece(zone) {
  const key = 'J_' + zone, p = pools[key] || (pools[key] = []);
  let c = p.find((x) => !x.userData.used);
  if (!c) { c = buildJunction(zone); c.userData.zone = zone; p.push(c); scene.add(c); }
  c.userData.used = true; c.visible = true; c.rotation.y = 0; return c;
}
function clearAhead() {
  chunks.forEach(freeChunk); chunks.length = 0;
  portals.forEach((p) => { p.userData.used = false; p.visible = false; }); portals.length = 0;
  obstacles.forEach((o) => { o.active = false; o.mesh.visible = false; }); obstacles.length = 0;
  items.forEach((it) => { it.active = false; it.g.visible = false; }); items.length = 0;
  coins.forEach((c) => (c.active = false));
}
function doTurn(dir) {
  const J = junction.J, th = dir * PI / 2;
  const i = chunks.indexOf(J); if (i >= 0) chunks.splice(i, 1);
  clearAhead();
  J.rotation.y = th;
  const c = new THREE.Vector3(0, 0, -(JCT.approach + JCT.half)).applyAxisAngle(UP, th);
  legacy.push({ obj: J, x0: -c.x, z0: -c.z, d0: distance });
  J.position.set(-c.x, 0, -c.z);
  nextChunk = distance + JCT.half + JCT.branch - 1;
  nextRow = distance + 22;
  nextJunctionAt = distance + R(380, 600);
  lane = 1; laneFrom = 1; px = 0; laneT = 0;
  turnYaw = th;
  junction = null; setTurnHint(false);
  wild.forEach((w) => respawnWild(w, false));
  run.turns = (run.turns || 0) + 1;
  sfx('lane'); vibrate(15);
}
function missTurn() {
  shake = 0.8; sfx('hit'); vibrate([60, 40, 80]); flashScreen(); run.lastHit = distance;
  burst(px, 1.2, -1, 0xffe9a0, 24, 7, 0.4, 0.5, 10);
  lives--; addChase(0.5);
  if (chase >= 1) { caught = true; deathBy = 'trex'; }
  if (lives <= 0 || caught) { speed = 0; setState('dying'); dieT = 0; slowmo = 0.45; setTurnHint(false); return; }
  invuln = 1.8; speed *= 0.5; updateHud(true);
  doTurn(Math.random() < 0.5 ? -1 : 1);
}
function updateJunction() {
  if (!junction) return;
  const d2c = junction.wdC - distance;
  setTurnHint(d2c < 26 && d2c > -3, junction.dir);
  if (d2c <= (junction.dir ? 0 : -2.2)) { if (junction.dir) doTurn(junction.dir); else missTurn(); }
}
let hintShown = null;
function setTurnHint(on, dir = 0) {
  const el = $('turnHint'); if (!el) return;
  const key = on + ':' + dir; if (hintShown === key) return; hintShown = key;
  el.hidden = !on; el.dataset.dir = dir;
}
function syncLegacy() {
  for (let i = legacy.length - 1; i >= 0; i--) {
    const L = legacy[i];
    L.obj.position.set(L.x0, 0, L.z0 + (distance - L.d0));
    if (distance - L.d0 > 70) { L.obj.userData.used = false; L.obj.visible = false; L.obj.rotation.y = 0; legacy.splice(i, 1); }
  }
}

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
  while (nextChunk < distance + 156 && !junction) {
    const z = zoneAt(nextChunk);
    if (state === 'playing' && nextChunk >= nextJunctionAt && canJunction(nextChunk) && canJunction(nextChunk + CHUNK)) {
      const J = getJunctionPiece(z); J.userData.wd = nextChunk; J.position.set(0, 0, distance - nextChunk); chunks.push(J);
      junction = { J, wdStart: nextChunk, wdC: nextChunk + JCT.approach + JCT.half, dir: 0 };
      nextChunk += CHUNK; break;
    }
    const c = getChunk(z); c.userData.wd = nextChunk; c.position.z = distance - nextChunk; chunks.push(c);
    if (nextChunk > 0 && zoneAt(nextChunk - CHUNK) !== z) { const p = getPortal(z); p.userData.wd = nextChunk; portals.push(p); }
    nextChunk += CHUNK;
  }
  for (let i = chunks.length - 1; i >= 0; i--) { const c = chunks[i]; if (distance - c.userData.wd - CHUNK > 14) { freeChunk(c); chunks.splice(i, 1); } }
  for (let i = portals.length - 1; i >= 0; i--) { const p = portals[i]; if (distance - p.userData.wd > 14) { p.userData.used = false; p.visible = false; portals.splice(i, 1); } }
}
let warmQueue = [];
let warmT = 0;
function warmPools(dt) {
  warmT -= dt; if (state === 'playing' && warmT > 0) return; warmT = 0.6;
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
  while (nextRow < Math.min(distance + 130, junction ? junction.wdStart + 4 : 1e9)) {
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
  legacy.forEach((L) => { L.obj.userData.used = false; L.obj.visible = false; L.obj.rotation.y = 0; }); legacy.length = 0;
  if (junction) { junction.J.userData.used = false; junction.J.visible = false; junction = null; } setTurnHint(false); nextJunctionAt = R(260, 380); turnYaw = 0;
  distance = 0; speed = 0; nextChunk = -48; nextRow = 45; lane = 1; px = 0; py = 0; vy = 0; air = false; slideT = 0; invuln = 0;
  coinsRun = 0; eggsRun = 0; bonus = 0; lives = 2; powers.magnet = powers.boost = powers.shield = 0; chase = 0; caught = false; runActive = false;
  curZone = zoneAt(0); shownZone = '';
  initLight(lightFor(curZone));
  ensureChunks();
}

/* ------------------------------------------------------------ progression: shop, achievements, goals */
const ROAD_PRICE = [0, 10000, 12500, 15000, 17500, 20000];
const UPG = {
  life: { name: 'EXTRA LIFE', desc: 'Start every run with one more heart', max: 2, cost: (l) => [700, 1000][l], icon: 'i-heart' },
  shield: { name: 'PROTECTION', desc: 'Shield lasts 3 s longer per level', max: 5, cost: (l) => 400 + l * 150, icon: 'i-shield' },
  boost: { name: 'SPEED UP', desc: 'Speed Boost lasts 1.5 s longer per level', max: 5, cost: (l) => 400 + l * 150, icon: 'i-bolt' },
  magnet: { name: 'MAGNET', desc: 'Magnet lasts 2.5 s longer per level', max: 5, cost: (l) => 400 + l * 150, icon: 'i-magnet' }
};
const BOOSTERS = {
  shield: { name: 'START SHIELD', desc: 'Begin your next run protected', cost: 400, icon: 'i-shield' },
  boost: { name: 'HEAD START', desc: 'Begin your next run with a Speed Boost', cost: 500, icon: 'i-bolt' },
  life: { name: 'BONUS HEART', desc: '+1 heart for your next run', cost: 600, icon: 'i-heart' }
};
// migrate older saves
profile.owned = profile.owned || { skins: [0], roads: [0] };
profile.upg = Object.assign({ life: 0, shield: 0, boost: 0, magnet: 0 }, profile.upg);
profile.boosters = Object.assign({ shield: 0, boost: 0, life: 0 }, profile.boosters);
profile.ach = profile.ach || {};
profile.stats = Object.assign({ runs: 0, jumps: 0, slides: 0, smashes: 0, escapes: 0, eggs: 0, coins: 0 }, profile.stats);
profile.goalLevel = profile.goalLevel || 0;
if (!profile.owned.skins.includes(profile.skin)) profile.skin = 0;
if (!profile.owned.roads.includes(profile.zone)) profile.zone = 0;

let run = newRunStats(), runActive = false;
function newRunStats() { return { coins: 0, dist: 0, jumps: 0, slides: 0, powers: 0, smashes: 0, escapes: 0, eggs: 0, zones: new Set(), clean: 0, lastHit: 0, newAch: [], goalsDone: [] }; }
const tot = (k) => profile.stats[k] + (runActive ? run[k] : 0);
const ACH = [
  { id: 'first', name: 'First Steps', desc: 'Finish your first run', r: 50, t: () => profile.stats.runs >= 1 },
  { id: 'd500', name: 'Warming Up', desc: 'Run 500 m in one run', r: 100, t: () => run.dist >= 500, p: () => [run.dist, 500] },
  { id: 'd1500', name: 'Marathon Raptor', desc: 'Run 1,500 m in one run', r: 300, t: () => run.dist >= 1500 },
  { id: 'd3000', name: 'Jungle Never Ends', desc: 'Run 3,000 m in one run', r: 800, t: () => run.dist >= 3000 },
  { id: 'c100', name: 'Coin Snatcher', desc: 'Grab 100 coins in one run', r: 150, t: () => run.coins >= 100 },
  { id: 'c2000', name: 'Treasure Hoarder', desc: 'Collect 2,000 coins in total', r: 400, t: () => tot('coins') >= 2000, p: () => [tot('coins'), 2000] },
  { id: 'egg', name: 'Egg Hunter', desc: 'Find a Golden Egg', r: 200, t: () => run.eggs >= 1 },
  { id: 'egg5', name: 'Full Nest', desc: 'Find 5 Golden Eggs in one run', r: 1000, t: () => run.eggs >= 5 },
  { id: 'j100', name: 'Hop Hop', desc: 'Jump 100 times', r: 150, t: () => tot('jumps') >= 100, p: () => [tot('jumps'), 100] },
  { id: 's100', name: 'Low Rider', desc: 'Slide 100 times', r: 150, t: () => tot('slides') >= 100, p: () => [tot('slides'), 100] },
  { id: 'smash', name: 'Wrecking Raptor', desc: 'Smash 25 obstacles with Shield or Boost', r: 300, t: () => tot('smashes') >= 25, p: () => [tot('smashes'), 25] },
  { id: 'escape', name: 'Close Call', desc: 'Escape the T-Rex 5 times', r: 300, t: () => tot('escapes') >= 5, p: () => [tot('escapes'), 5] },
  { id: 'zones', name: 'Explorer', desc: 'Pass through all five areas in one run', r: 500, t: () => run.zones.size >= 5 },
  { id: 'clean', name: 'Untouchable', desc: 'Run 1,000 m without a hit', r: 500, t: () => run.clean >= 1000 },
  { id: 'dinos', name: 'Collector', desc: 'Unlock all five dinos', r: 1500, t: () => profile.owned.skins.length >= SKINS.length, p: () => [profile.owned.skins.length, SKINS.length] },
  { id: 'roads', name: 'Pathfinder', desc: 'Unlock every road', r: 800, t: () => profile.owned.roads.length >= 6, p: () => [profile.owned.roads.length, 6] }
];
const GOAL_T = {
  coins: { txt: (n) => `Collect ${n} coins in one run`, n: (L) => 60 + L * 30 },
  dist: { txt: (n) => `Run ${n.toLocaleString()} m in one run`, n: (L) => 500 + L * 250 },
  jumps: { txt: (n) => `Jump ${n} times in one run`, n: (L) => 12 + L * 4 },
  slides: { txt: (n) => `Slide ${n} times in one run`, n: (L) => 8 + L * 3 },
  powers: { txt: (n) => `Pick up ${n} power-ups in one run`, n: (L) => 2 + Math.floor(L / 2) },
  smashes: { txt: (n) => `Smash ${n} obstacles in one run`, n: (L) => 2 + L },
  escapes: { txt: (n) => `Escape the T-Rex ${n} time${n > 1 ? 's' : ''} in one run`, n: (L) => 1 + Math.floor(L / 3) },
  eggs: { txt: (n) => `Find ${n} Golden Egg${n > 1 ? 's' : ''} in one run`, n: (L) => 1 + Math.floor(L / 5) }
};
function newGoal(exclude) {
  const keys = Object.keys(GOAL_T).filter((k) => !exclude.includes(k));
  const k = pick(keys), L = profile.goalLevel;
  return { k, n: GOAL_T[k].n(L), r: 100 + L * 40, done: false };
}
if (!profile.goals) { profile.goals = []; for (let i = 0; i < 3; i++) profile.goals.push(newGoal(profile.goals.map((g) => g.k))); }

const toastQ = []; let toastBusy = false;
function toast(title, sub) { toastQ.push([title, sub]); if (!toastBusy) nextToast(); }
function nextToast() {
  const it = toastQ.shift(); const el = $('achToast');
  if (!it) { toastBusy = false; return; }
  toastBusy = true; el.innerHTML = `<b>${it[0]}</b><span>${it[1]}</span>`; el.classList.add('show'); sfx('award');
  setTimeout(() => { el.classList.remove('show'); setTimeout(nextToast, 380); }, 2300);
}
function checkProgress(inRun) {
  run.coins = coinsRun; run.dist = Math.floor(distance); run.eggs = eggsRun;
  run.clean = Math.max(run.clean, distance - run.lastHit);
  let changed = false;
  for (const a of ACH) if (!profile.ach[a.id] && a.t()) {
    profile.ach[a.id] = 1; changed = true; run.newAch.push(a.name);
    if (inRun) toast('ACHIEVEMENT', `${a.name} · +${a.r}`);
  }
  if (inRun) for (const g of profile.goals) if (!g.done && run[g.k] >= g.n) {
    g.done = true; changed = true; run.goalsDone.push(g); toast('GOAL COMPLETE', `${GOAL_T[g.k].txt(g.n)} · +${g.r}`);
  }
  if (changed) { saveProfile(); updateBadge(); }
}
function spend(n) {
  if (profile.wallet < n) { sfx('land'); return false; }
  profile.wallet -= n; saveProfile(); sfx('buy'); refreshWallets(); return true;
}
function refreshWallets() { document.querySelectorAll('.wallet-n').forEach((e) => (e.textContent = profile.wallet.toLocaleString())); updateBadge(); }
function updateBadge() { const any = ACH.some((a) => profile.ach[a.id] === 1); const b = $('awardBadge'); if (b) b.hidden = !any; }
const coinTxt = (n) => `<i class="coin-ic"></i>${n.toLocaleString()}`;
let shopTab = 'upg', awardTab = 'goals';
function renderShop() {
  document.querySelectorAll('#shopTabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === shopTab));
  const L = $('shopList'); let h = '';
  if (shopTab === 'upg') for (const k in UPG) {
    const u = UPG[k], lvl = profile.upg[k], max = lvl >= u.max, c = max ? 0 : u.cost(lvl);
    h += `<div class="row"><svg class="ic"><use href="#${u.icon}"/></svg><div><b>${u.name}</b><small>${u.desc}</small><div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>` +
      (max ? '<span class="tag-done">MAX</span>' : `<button class="buy" data-upg="${k}" ${profile.wallet < c ? 'disabled' : ''}>${coinTxt(c)}</button>`) + '</div>';
  } else for (const k in BOOSTERS) {
    const b = BOOSTERS[k], n = profile.boosters[k];
    h += `<div class="row"><svg class="ic"><use href="#${b.icon}"/></svg><div><b>${b.name}</b><small>${b.desc}</small><small class="ready">Ready for next runs: ${n}/3</small></div>` +
      (n >= 3 ? '<span class="tag-done">FULL</span>' : `<button class="buy" data-bst="${k}" ${profile.wallet < b.cost ? 'disabled' : ''}>${coinTxt(b.cost)}</button>`) + '</div>';
  }
  L.innerHTML = h;
}
function renderAwards() {
  document.querySelectorAll('#awardTabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === awardTab));
  const L = $('awardList'); let h = '';
  if (awardTab === 'goals') {
    h += '<div class="note" style="text-align:left">Complete goals during a run. Rewards are paid when the run ends, then a new, harder goal replaces it.</div>';
    for (const g of profile.goals) h += `<div class="row"><svg class="ic"><use href="#i-target"/></svg><div><b>${GOAL_T[g.k].txt(g.n)}</b><small>Reward ${g.r} coins</small></div><span class="tag-done">${g.done ? 'DONE' : ''}</span></div>`;
    h += `<div class="note">Goal level ${profile.goalLevel + 1}</div>`;
  } else for (const a of ACH) {
    const st = profile.ach[a.id] || 0, p = !st && a.p ? a.p() : null;
    h += `<div class="row${st === 2 ? ' claimed' : ''}"><svg class="ic"><use href="#i-trophy" fill="${st ? '#ffc531' : '#6a5a48'}" style="color:${st ? '#ffc531' : '#6a5a48'}"/></svg><div><b>${a.name}</b><small>${a.desc}</small>` +
      (p ? `<div class="prog"><i style="width:${Math.min(100, p[0] / p[1] * 100)}%"></i></div>` : '') + '</div>' +
      (st === 1 ? `<button class="buy claim" data-claim="${a.id}">CLAIM ${coinTxt(a.r)}</button>` : st === 2 ? '<span class="tag-done">DONE</span>' : `<span class="reward">${coinTxt(a.r)}</span>`) + '</div>';
  }
  L.innerHTML = h;
}
function wireProgression() {
  $('shopList').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.upg) { const k = b.dataset.upg; if (spend(UPG[k].cost(profile.upg[k]))) { profile.upg[k]++; saveProfile(); } }
    if (b.dataset.bst) { const k = b.dataset.bst; if (spend(BOOSTERS[k].cost)) { profile.boosters[k]++; saveProfile(); } }
    renderShop();
  });
  $('awardList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-claim]'); if (!b) return;
    const a = ACH.find((x) => x.id === b.dataset.claim); profile.ach[a.id] = 2; profile.wallet += a.r; saveProfile(); sfx('egg'); refreshWallets(); renderAwards();
  });
  document.querySelectorAll('#shopTabs button').forEach((b) => b.addEventListener('click', () => { shopTab = b.dataset.tab; sfx('click'); renderShop(); }));
  document.querySelectorAll('#awardTabs button').forEach((b) => b.addEventListener('click', () => { awardTab = b.dataset.tab; sfx('click'); renderAwards(); }));
}

/* ------------------------------------------------------------ villain T-Rex */
let debugV = false, chase = 0, chasePeak = 0, caught = false, chaseView = 0, deathBy = 'crash';
function addChase(v) { chase = Math.min(1, chase + v); chasePeak = Math.max(chasePeak, chase); sfx('trexroar'); }
function updateVillain(dt) {
  const v = villain;
  const inGame = state === 'playing' || state === 'dying' || state === 'paused';
  if (debugV && state === 'menu') { v.group.visible = true; dino.group.visible = false; v.group.position.set(0, 0, 0); v.phase += dt * 6; if (v.mixer) animateModel(v, dt, 'Run', 1); else { blendPose(v.cur, poseRun(v.phase, t, true), 0.3); applyPose(v, v.cur); } v.root.rotation.y = PI / 2; return; }
  if (!inGame) { v.group.visible = false; return; }
  const camZ = camera.position.z;
  let z;
  if (chase < 0.45) { const s = clamp((chase - 0.22) / 0.23, 0, 1), e = s * s * (3 - 2 * s); z = lerp(camZ + 4, 5.4, e); }
  else z = lerp(5.4, 1.8, (chase - 0.45) / 0.55);
  if (caught) z = Math.max(0.9, v.group.position.z - dt * 6);
  v.group.visible = z < camZ - 0.5;
  if (px > 0.5) v.side = -1; else if (px < -0.5) v.side = 1;
  const tx = px + v.side * (caught ? 0.7 : 2.7);
  v.group.position.x = damp(v.group.position.x, tx, 3.5, dt); v.group.position.z = z;
  if (state !== 'paused') v.phase += dt * Math.max(speed, 7) * 0.48;
  const tgt = caught ? poseChomp(t) : poseRun(v.phase, t, true);
  if (v.mixer && caught && v.anim === 'Attack' && v.actions.Attack.time >= v.actions.Attack.getClip().duration - 0.01) v.actions.Attack.reset().play();
  if (v.mixer) animateModel(v, state === 'paused' ? 0 : dt, caught ? 'Attack' : 'Run', caught ? 1.4 : clamp(speed / 16, 0.7, 1.5));
  else { if (state !== 'paused') blendPose(v.cur, tgt, 1 - Math.exp(-10 * dt)); applyPose(v, v.cur); }
  v.root.rotation.y = damp(v.root.rotation.y, v.side * (caught ? 0.55 : 0.22), 4, dt);
  if (v.group.visible && state === 'playing') {
    const step = Math.floor(v.phase / PI);
    if (step !== v.lastStep) {
      v.lastStep = step; const near = clamp((7 - z) / 5, 0, 1);
      sfx('stomp', near); shake = Math.max(shake, 0.1 * near);
      for (let i = 0; i < 6; i++) dust.emit(v.group.position.x + R(-0.6, 0.6), 0.1, z + R(-0.5, 0.5), R(-2, 2), R(0.5, 2), R(0, 2), 0x6a5038, 1.1, 0.8, 1);
    }
  }
  const showD = chase > 0.03 && (state === 'playing' || state === 'paused');
  if ($('danger').hidden === showD) $('danger').hidden = !showD;
  $('dFill').style.width = (chase * 100).toFixed(1) + '%';
  $('vig').style.opacity = state === 'playing' || state === 'dying' ? clamp((chase - 0.45) * 1.8, 0, 1) * (0.75 + Math.sin(t * 8) * 0.25) : 0;
}

/* ------------------------------------------------------------ game flow */
const screens = ['loading', 'menu', 'charSel', 'journey', 'how', 'scores', 'settings', 'pause', 'over', 'shop', 'awards'];
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
  const stats = SKINS[profile.skin].stats, U = profile.upg, Bo = profile.boosters;
  powerMax.magnet = 9 + stats[2] + U.magnet * 2.5; powerMax.boost = 5 + stats[2] * 0.5 + U.boost * 1.5; powerMax.shield = 12 + stats[2] + U.shield * 3;
  lives = 2 + U.life;
  const used = [];
  if (Bo.life > 0) { lives++; Bo.life--; used.push('BONUS HEART'); }
  if (Bo.shield > 0) { powers.shield = powerMax.shield; Bo.shield--; used.push('START SHIELD'); }
  if (Bo.boost > 0) { powers.boost = powerMax.boost; Bo.boost--; used.push('HEAD START'); }
  run = newRunStats(); runActive = true; run.zones.add(curZone);
  chase = 0.62; chasePeak = 0; caught = false; deathBy = 'crash';
  villain.group.position.set(px + 2, 0, camera.position.z + 4); villain.cur = poseRun(0, 0, true);
  if (dino.mixer) { dino.anim = null; dino.mixer.stopAllAction(); playAnim(dino, 'Run', 0); }
  if (villain.mixer) { villain.anim = null; villain.mixer.stopAllAction(); playAnim(villain, 'Run', 0); }
  setTimeout(() => sfx('trexroar'), 450);
  saveProfile();
  updateHud(true);
  if (used.length) setTimeout(() => toast('BOOSTER ACTIVE', used.join(' · ')), 1200);
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
  checkProgress(true);
  const sc = score(), d = Math.floor(distance);
  for (const k of ['jumps', 'slides', 'smashes', 'escapes', 'eggs', 'coins']) profile.stats[k] += run[k];
  profile.stats.runs++; runActive = false;
  checkProgress(false);
  let goalCoins = 0;
  const goalHtml = profile.goals.map((g) => `<div class="row small${g.done ? ' ok' : ''}"><svg class="ic"><use href="#i-target"/></svg><div><b>${GOAL_T[g.k].txt(g.n)}</b></div><span class="tag-done">${g.done ? '+' + g.r : ''}</span></div>`).join('');
  profile.goals = profile.goals.map((g) => { if (!g.done) return g; goalCoins += g.r; profile.goalLevel++; return null; });
  profile.goals = profile.goals.map((g, i, a) => g || newGoal(a.filter(Boolean).map((x) => x.k)));
  profile.wallet += goalCoins;
  $('oGoals').innerHTML = goalHtml + (run.newAch.length ? `<div class="note">Achievements unlocked: ${run.newAch.join(', ')}. Claim them in AWARDS.</div>` : '');
  $('oReason').textContent = deathBy === 'trex' ? 'THE T-REX CAUGHT YOU!' : 'YOU CRASHED!';
  $('oEarned').innerHTML = coinTxt(coinsRun + goalCoins) + ' earned';
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
  if ((a === 'left' || a === 'right') && junction && junction.wdC - distance < 26 && junction.wdC - distance > -3) {
    junction.dir = a === 'left' ? -1 : 1; sfx('lane'); setTurnHint(true, junction.dir); return;
  }
  if (a === 'left' || a === 'right') {
    const nl = clamp(lane + (a === 'left' ? -1 : 1), 0, 2);
    if (nl !== lane) { laneFrom = lane; lane = nl; laneT = 0.25; sfx('lane'); }
  } else if (a === 'up') {
    if (!air) { run.jumps++; air = true; vy = 12.4 * (0.9 + SKINS[profile.skin].stats[1] * 0.035); slideT = 0; sfx('jump'); for (let i = 0; i < 8; i++) dust.emit(px + R(-0.5, 0.5), 0.1, R(-0.3, 0.6), R(-1.5, 1.5), R(0.5, 2), R(1, 3), 0x8a6a48, 0.7, 0.6, 1); }
  } else if (a === 'down') {
    if (air) { vy = -26; slideT = 0.7; run.slides++; } else { if (slideT <= 0) { sfx('slide'); run.slides++; } slideT = 0.75; }
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
    run.smashes++; sfx('smash'); shake = 0.35; vibrate(30); return;
  }
  if (lateral) { lane = laneFrom; laneT = 0; shake = 0.25; sfx('land'); vibrate(20); invuln = 0.4; addChase(0.34); if (chase >= 1) { caught = true; deathBy = 'trex'; setState('dying'); dieT = 0; slowmo = 0.5; } return; }
  o.hit = true; lives--; shake = 0.7; sfx('hit'); vibrate([60, 40, 80]); flashScreen(); run.lastHit = distance;
  burst(px, 1.2, -0.5, 0xffe9a0, 20, 7, 0.35, 0.5, 10);
  addChase(0.5);
  if (chase >= 1) { caught = true; deathBy = 'trex'; }
  if (lives <= 0 || caught) { setState('dying'); dieT = 0; slowmo = 0.45; return; }
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

  chase = Math.max(0, chase - dt * (0.05 + (powers.boost > 0 ? 0.2 : 0)));
  if (chasePeak >= 0.6 && chase <= 0.02) { chasePeak = 0; run.escapes++; toast('ESCAPED!', 'You shook off the T-Rex'); }
  const z = zoneAt(distance);
  if (z !== curZone) { curZone = z; run.zones.add(z); toastZone(z); }
  progT -= dt; if (progT <= 0) { progT = 0.5; checkProgress(true); }
  updateJunction(); if (state !== 'playing') return;
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
      if (it.type !== 'egg') run.powers++;
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
  syncLegacy();
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
    tgt = air ? poseJump(vy) : slideT > 0 ? poseSlide(t) : poseRun(runPhase, t, false);
  } else if ((state === 'dying' || state === 'over') && deathBy === 'crash') tgt = poseDead();
  else if (state === 'dying' || state === 'over') tgt = poseDead();
  else tgt = poseIdle(t, false);
  if (dino.mixer) {
    let want = 'Idle', ts = 1;
    if (state === 'playing' || state === 'paused') { want = air ? 'Jump' : 'Run'; ts = air ? 1.55 : clamp(speed / 14, 0.75, 1.7); }
    else if (state === 'dying' || state === 'over') want = 'Death';
    else { roarT -= dt; if (roarT <= 0 && dino.anim === 'Idle') { roarT = R(5, 8); playAnim(dino, 'Attack', 0.2); } if (dino.anim === 'Attack' && dino.actions.Attack.time >= dino.actions.Attack.getClip().duration - 0.01) playAnim(dino, 'Idle', 0.3); want = dino.anim === 'Attack' ? 'Attack' : 'Idle'; }
    animateModel(dino, state === 'paused' ? 0 : dt, want, ts);
    const sl = slideT > 0 && !air && state === 'playing';
    dino.model.scale.y = damp(dino.model.scale.y, dino.baseScale * (sl ? 0.55 : 1), 18, dt);
    dino.model.rotation.x = damp(dino.model.rotation.x, sl ? 0.12 : 0, 14, dt);
  } else {
    if (state !== 'paused') blendPose(dino.cur, tgt, 1 - Math.exp(-(air || slideT > 0 ? 16 : 12) * dt));
    applyPose(dino, dino.cur);
  }
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
  if (dino.mmats) dino.mmats.body.emissive.setRGB(boostGlow * 0.04, boostGlow * 0.2, boostGlow * 0.5);
}
const camTarget = new THREE.Vector3(), camLook = new THREE.Vector3(), lookCur = new THREE.Vector3(0, 1.2, 0);
const camBase = new THREE.Vector3(3, 2.3, -5), lookOut = new THREE.Vector3(), pivot = new THREE.Vector3();
function updateCamera(dt) {
  camera.position.copy(camBase);
  if (camMode === 'menu' || camMode === 'select') {
    const a = camMode === 'select' ? 0.5 + Math.sin(t * 0.3) * 0.12 : 0.55 + Math.sin(t * 0.18) * 0.35;
    const r = camMode === 'select' ? 4.6 : 5.0;
    camTarget.set(Math.sin(a) * r, camMode === 'select' ? 1.5 : 1.6, -Math.cos(a) * r);
    camLook.set(0, camMode === 'select' ? 0.75 : 0.55, 0);
    camera.position.lerp(camTarget, 1 - Math.exp(-3 * dt));
    lookCur.lerp(camLook, 1 - Math.exp(-4 * dt));
  } else {
    chaseView = damp(chaseView, state === 'playing' || state === 'dying' ? chase : 0, 2, dt);
    const chaseCam = camTarget.set(px * 0.42, 3.9 + py * 0.4 + chaseView * 1.3, 7.4 + chaseView * 1.4);
    camLook.set(px * 0.6, 1.15 + py * 0.3, -9);
    if (camMode === 'swoop') {
      camT = Math.min(1, camT + dt / 1.1); const e = camT * camT * (3 - 2 * camT);
      camera.position.lerpVectors(menuCamFrom, chaseCam, e);
      camera.position.x += Math.sin(e * PI) * 4.5; camera.position.y += Math.sin(e * PI) * 2.2;
      lookCur.lerp(camLook, e);
      if (camT >= 1) camMode = 'chase';
    } else {
      camera.position.x = damp(camera.position.x, chaseCam.x, 6, dt);
      camera.position.y = damp(camera.position.y, chaseCam.y, 5, dt);
      camera.position.z = damp(camera.position.z, chaseCam.z, 6, dt);
      lookCur.lerp(camLook, 1 - Math.exp(-8 * dt));
    }
  }
  camBase.copy(camera.position); lookOut.copy(lookCur);
  if (Math.abs(turnYaw) > 1e-4) {
    pivot.set(px, 0, 0);
    camera.position.sub(pivot).applyAxisAngle(UP, turnYaw).add(pivot);
    lookOut.sub(pivot).applyAxisAngle(UP, turnYaw).add(pivot);
    turnYaw = damp(turnYaw, 0, 5.5, dt);
  }
  camera.lookAt(lookOut);
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
  const rawDt = clock.getDelta(); let dt = Math.min(rawDt, 0.05);
  pollPad();
  if (state === 'loading') return;
  if (state === 'dying') dt *= slowmo;
  t += dt;
  const d0 = distance;
  if (state === 'playing') update(dt);
  else if (state === 'dying') updateDying(dt);
  if (state !== 'paused') { warmPools(dt); updateWild(dt); }
  updateGrass(dt); tunePerf(rawDt);
  syncWorld();
  animateDino(dt);
  updateCamera(dt);
  updateVillain(dt);
  updateEnvironment(state === 'paused' ? 0 : dt, distance - d0);
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------ menus */
function refreshMenu() {
  refreshWallets();
  $('menuBest').textContent = 'BEST ' + profile.best.toLocaleString() + (profile.bestDist ? ' · ' + profile.bestDist.toLocaleString() + ' m' : '');
}
let selIdx = 0;
function renderChar() {
  const sk = SKINS[selIdx];
  $('cName').textContent = sk.name; $('cDesc').textContent = sk.desc;
  $('cSpeed').style.width = sk.stats[0] * 20 + '%'; $('cJump').style.width = sk.stats[1] * 20 + '%'; $('cShield').style.width = sk.stats[2] * 20 + '%';
  $('cDots').innerHTML = SKINS.map((_, i) => `<i class="${i === selIdx ? 'on' : ''}"></i>`).join('');
  const owned = profile.owned.skins.includes(selIdx), price = SKIN_PRICE[selIdx];
  const btn = $('cSelect');
  btn.classList.toggle('btn-locked', !owned);
  btn.innerHTML = owned ? (selIdx === profile.skin ? 'SELECTED' : 'SELECT') : (profile.wallet >= price ? 'UNLOCK ' : 'NEED ') + coinTxt(price);
  $('cLock').hidden = owned;
  setSkin(selIdx);
}
const JOURNEYS = [{ name: 'JUNGLE PATH' }, { name: 'WATERFALL' }, { name: 'ANCIENT RUINS' }, { name: 'WOODEN BRIDGE' }, { name: 'CAVE SECTION' }, { name: 'NIGHT MODE' }];
let thumbs = [];
function renderCards() {
  const wrap = $('cards'); wrap.innerHTML = '';
  JOURNEYS.forEach((j, i) => {
    const locked = !profile.owned.roads.includes(i), price = ROAD_PRICE[i];
    const b = document.createElement('button'); b.className = 'card' + (profile.zone === i ? ' on' : '') + (locked ? ' locked' : '');
    if (thumbs[i]) b.style.backgroundImage = `url(${thumbs[i]})`;
    b.setAttribute('aria-label', j.name + (locked ? ', locked' : ''));
    b.innerHTML = `<span>${j.name}</span>` + (locked ? `<div class="lock"><svg><use href="#i-lock"/></svg></div><div class="req">${coinTxt(price)}</div>` : '');
    b.onclick = () => {
      if (locked) { if (!spend(price)) return; profile.owned.roads.push(i); checkProgress(false); }
      else sfx('click');
      profile.zone = i; saveProfile(); renderCards();
    };
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
  click('mSettings', openSettings); click('pSettings', openSettings);
  wireProgression();
  click('setBack', () => show(settingsReturn));
  click('mDino', () => { selIdx = profile.skin; setState('charSel'); camMode = 'select'; renderChar(); show('charSel'); });
  click('cBack', () => { setSkin(profile.skin); setState('menu'); camMode = 'menu'; show('menu'); });
  click('cPrev', () => { selIdx = (selIdx + SKINS.length - 1) % SKINS.length; renderChar(); dino.root.rotation.y += PI * 2; sfx('roar'); });
  click('cNext', () => { selIdx = (selIdx + 1) % SKINS.length; renderChar(); dino.root.rotation.y -= PI * 2; sfx('roar'); });
  click('cSelect', () => {
    if (!profile.owned.skins.includes(selIdx)) {
      if (!spend(SKIN_PRICE[selIdx])) return;
      profile.owned.skins.push(selIdx); checkProgress(false); saveProfile(); renderChar(); sfx('roar'); return;
    }
    profile.skin = selIdx; saveProfile(); renderChar(); setTimeout(() => { setState('menu'); camMode = 'menu'; show('menu'); }, 250);
  });
  click('mShop', () => { renderShop(); refreshWallets(); show('shop'); });
  click('shopBack', () => { refreshMenu(); show('menu'); });
  click('mAwards', () => { renderAwards(); refreshWallets(); show('awards'); });
  click('awBack', () => { refreshMenu(); show('menu'); });
  click('oShop', () => { goMenu(); renderShop(); show('shop'); });
  click('mJourney', () => { renderCards(); refreshWallets(); show('journey'); });
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
    curZone = ZONES[zi]; initLight(lightFor(curZone)); applyLight(); grassZone(curZone); GU.cut.value = -999;
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
    buildDino(); progress(0.33, 'Waking the raptors'); await loadModels(); buildObstacleTemplates(); buildPowerups(); buildSpeedLines();
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
    for (const z of ['jungle', 'waterfall', 'ruins']) { const j = buildJunction(z); j.userData.zone = z; j.visible = false; scene.add(j); (pools['J_' + z] = pools['J_' + z] || []).push(j); }
    buildGrass();
    for (const z of ZONES) { const p = buildPortal(z); p.visible = false; scene.add(p); (portalPools[z] = portalPools[z] || []).push(p); }
    progress(0.88, 'Lighting torches'); await nextFrame();
    resize(); applyQuality();
    makeThumbs();
    startZone = profile.zone === 5 ? 0 : profile.zone; nightMode = profile.zone === 5;
    resetWorld();
    renderer.compile(scene, camera);
    camera.position.set(3, 2.3, -5); camBase.copy(camera.position); lookCur.set(0, 1.5, 0);
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
window.__diano = { get state() { return state; }, act, startRun, get distance() { return distance; }, get powers() { return powers; }, setZone: (i) => { profile.zone = i; }, chase: (v) => addChase(v), catchMe: () => { addChase(1); caught = true; deathBy = 'trex'; setState('dying'); dieT = 0; slowmo = 0.5; }, peekTrex: () => { debugV = true; }, bench: () => { const o = {}; for (const z of ['jungle', 'ruins', 'cave']) { const t0 = performance.now(); buildChunk(z); o[z] = Math.round(performance.now() - t0); } let t0 = performance.now(); buildJunction('jungle'); o.junction = Math.round(performance.now() - t0); o.pools = Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length])); return o; }, info: () => ({ tris: renderer.info.render.triangles, calls: renderer.info.render.calls, geos: renderer.info.memory.geometries, chunks: chunks.length, perChunk: chunks.map((c) => c.children.length), cast: chunks.map((c) => c.children.filter((m) => m.castShadow).length), mats: chunks[2] && chunks[2].children.map((m) => (m.material.name || (m.material.map && m.material.map.image && m.material.map.image.src ? m.material.map.image.src.split('/').pop() : '') || m.material.type) + ':' + m.geometry.index.count / 3) }), jct: () => { for (let i = chunks.length - 1; i >= 0; i--) if (chunks[i].userData.wd > distance + 4) { freeChunk(chunks[i]); chunks.splice(i, 1); } obstacles.forEach((o) => { o.active = false; o.mesh.visible = false; }); nextChunk = Math.max(...chunks.map((c) => c.userData.wd)) + CHUNK; nextJunctionAt = 0; forceJ = true; ensureChunks(); forceJ = false; }, toJunction: () => { if (junction) distance = junction.wdC - 12; }, get junction() { return !!junction; }, gift: (n) => { profile.wallet += n; saveProfile(); refreshWallets(); } };
})();
