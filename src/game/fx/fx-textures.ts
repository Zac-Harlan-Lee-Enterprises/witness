import type Phaser from 'phaser';
import { rng } from '../art/paint';

/**
 * Small procedural textures for weather and water effects, painted once per
 * game. They are painted at `FX_PPU` pixels per world unit so they stay
 * crisp at the closest zoom on high-DPI screens; sprites and particles show
 * them at 1 / FX_PPU.
 */
export const FX_PPU = 6;

export const FX = {
  streak: 'wx-streak',
  splash: 'wx-splash',
  ripple: 'wx-ripple',
  dust: 'wx-dust',
  grit: 'wx-grit',
  leaf: 'wx-leaf',
  cloud: 'wx-cloud',
  sheet: 'wx-sheet',
  puddle: 'wx-puddle',
  pool: 'wx-pool',
} as const;

type Paint = (c: CanvasRenderingContext2D, w: number, h: number) => void;

function add(
  textures: Phaser.Textures.TextureManager,
  key: string,
  w: number,
  h: number,
  paint: Paint,
): void {
  if (textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (c) paint(c, w, h);
  textures.addCanvas(key, canvas);
}

/** Tileable value noise in 0–1 (wraps at `size`), a few octaves. */
function noiseField(size: number, cells: number[], seed: number): Float32Array {
  const out = new Float32Array(size * size);
  const r = rng(seed);
  let total = 0;
  cells.forEach((n, octave) => {
    const grid = Array.from({ length: n * n }, () => r());
    const amp = 1 / (octave + 1);
    total += amp;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * n;
        const gy = (y / size) * n;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const tx = gx - x0;
        const ty = gy - y0;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const at = (i: number, j: number): number =>
          grid[((j % n) * n + (i % n)) % grid.length] ?? 0;
        const a = at(x0, y0);
        const b = at(x0 + 1, y0);
        const c = at(x0, y0 + 1);
        const d = at(x0 + 1, y0 + 1);
        const v = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
        out[y * size + x] = (out[y * size + x] ?? 0) + v * amp;
      }
    }
  });
  for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) / total;
  return out;
}

export function makeFxTextures(textures: Phaser.Textures.TextureManager): void {
  // A raindrop's streak (motion-blurred), brightest at its leading end.
  add(textures, FX.streak, 4, 90, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(215,228,240,0)');
    g.addColorStop(0.7, 'rgba(215,228,240,0.55)');
    g.addColorStop(1, 'rgba(240,248,255,0.95)');
    c.fillStyle = g;
    c.fillRect(1, 0, w - 2, h);
    c.fillStyle = 'rgba(215,228,240,0.25)';
    c.fillRect(0, h * 0.5, w, h * 0.5);
  });
  // A splash: a small crown of droplets thrown up from the ground.
  add(textures, FX.splash, 36, 20, (c) => {
    c.strokeStyle = 'rgba(225,236,246,0.8)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.ellipse(18, 14, 12, 4.5, 0, Math.PI, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(235,244,252,0.9)';
    for (const [x, y] of [
      [7, 7],
      [13, 4],
      [18, 3],
      [24, 4],
      [29, 7],
    ] as const) {
      c.beginPath();
      c.arc(x, y, 1.4, 0, Math.PI * 2);
      c.fill();
    }
  });
  // A ripple ring (drawn as an ellipse: the ground is seen at an angle).
  add(textures, FX.ripple, 96, 48, (c) => {
    c.strokeStyle = 'rgba(230,242,250,0.85)';
    c.lineWidth = 2.2;
    c.beginPath();
    c.ellipse(48, 24, 44, 20, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = 'rgba(40,60,80,0.35)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.ellipse(48, 26, 42, 19, 0, 0.15, Math.PI - 0.15);
    c.stroke();
  });
  // A wisp of blown dust: soft, long, warm.
  // A streamer of blown dust: long, thin and uneven, fading at both ends.
  add(textures, FX.dust, 256, 24, (c, w, h) => {
    const r = rng(29);
    for (let i = 0; i < 5; i++) {
      const y = h * (0.3 + r() * 0.4);
      const thick = 2 + r() * 5;
      const g = c.createLinearGradient(0, 0, w, 0);
      const a = 0.22 + r() * 0.22;
      g.addColorStop(0, 'rgba(226,202,158,0)');
      g.addColorStop(0.25 + r() * 0.2, `rgba(226,202,158,${a.toFixed(2)})`);
      g.addColorStop(0.6 + r() * 0.2, `rgba(218,192,146,${(a * 0.7).toFixed(2)})`);
      g.addColorStop(1, 'rgba(210,184,140,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(w / 2 + (r() - 0.5) * 40, y, w * (0.38 + r() * 0.12), thick, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
  // A grain of sand or grit, whipped along by the wind.
  add(textures, FX.grit, 6, 6, (c) => {
    c.fillStyle = 'rgba(214,190,146,0.95)';
    c.beginPath();
    c.arc(3, 3, 1.6, 0, Math.PI * 2);
    c.fill();
  });
  // A dry leaf or scrap of chaff.
  add(textures, FX.leaf, 20, 12, (c) => {
    c.fillStyle = '#8a7a3a';
    c.beginPath();
    c.ellipse(10, 6, 8.5, 3.8, 0.2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#5f5226';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(2.5, 5.2);
    c.lineTo(17.5, 7);
    c.stroke();
  });
  // Cloud shadow: large soft patches of shade (tileable), white = sunlit.
  add(textures, FX.cloud, 256, 256, (c, w, h) => {
    const n = noiseField(w, [3, 6, 12], 71);
    const img = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = n[i] ?? 0;
      // Soft-edged clouds covering a little under half the sky.
      const t = Math.min(1, Math.max(0, (v - 0.47) / 0.16));
      const s = t * t * (3 - 2 * t);
      img.data[i * 4] = Math.round(255 - s * 120);
      img.data[i * 4 + 1] = Math.round(255 - s * 112);
      img.data[i * 4 + 2] = Math.round(255 - s * 92);
      img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  });
  // Sheets of rain: faint slanting streaks (tileable), added over the view.
  // (512 texels, shown at about two texels per world unit: fine hairlines.)
  add(textures, FX.sheet, 512, 512, (c, w, h) => {
    const r = rng(19);
    const band = noiseField(w, [2, 5], 23);
    for (let i = 0; i < 1600; i++) {
      const x = r() * w;
      const y = r() * h;
      const len = 30 + r() * 70;
      const k = band[Math.floor(y) * w + Math.floor(x)] ?? 0.5;
      const a = 0.05 + 0.22 * Math.max(0, k - 0.35);
      c.strokeStyle = `rgba(210,222,235,${a.toFixed(3)})`;
      c.lineWidth = 1 + r() * 0.8;
      // Wrap streaks that cross the top or left edge so the texture tiles.
      const dxs = x - len * 0.36 < 0 ? [0, w] : [0];
      const dys = y - len < 0 ? [0, h] : [0];
      for (const dx of dxs) {
        for (const dy of dys) {
          c.beginPath();
          c.moveTo(x + dx, y + dy);
          c.lineTo(x + dx - len * 0.36, y + dy - len);
          c.stroke();
        }
      }
    }
  });
  // A puddle: a soft, irregular patch (alpha only; tinted when drawn).
  add(textures, FX.puddle, 128, 72, (c, w, h) => {
    const r = rng(5);
    for (let i = 0; i < 7; i++) {
      const cx = w * (0.3 + r() * 0.4);
      const cy = h * (0.36 + r() * 0.28);
      const rx = w * (0.13 + r() * 0.15);
      const ry = h * (0.15 + r() * 0.13);
      c.save();
      c.translate(cx, cy);
      c.scale(1, ry / rx);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, rx, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  });
  // A warm pool of lamplight on the ground and walls at night.
  add(textures, FX.pool, 256, 256, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,196,120,0.9)');
    g.addColorStop(0.25, 'rgba(255,170,90,0.5)');
    g.addColorStop(0.6, 'rgba(240,140,70,0.16)');
    g.addColorStop(1, 'rgba(220,120,60,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}
