/**
 * Shared painting utilities for the procedural art.
 *
 * Everything is drawn in WORLD units (a tile is 32 units) onto canvases that
 * are ART_SCALE times larger, so the art stays crisp when the camera zooms in
 * (typically 2× on desktop). Phaser displays the textures at 1/ART_SCALE.
 * All randomness is seeded per tile, so a map looks identical on every load.
 */
export const TILE = 32;
export const ART_SCALE = 2;

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(
  width: number,
  height: number,
  doc: Document = document,
): { canvas: HTMLCanvasElement; ctx: Ctx | null } {
  const canvas = doc.createElement('canvas');
  canvas.width = Math.ceil(width * ART_SCALE);
  canvas.height = Math.ceil(height * ART_SCALE);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(ART_SCALE, ART_SCALE);
    ctx.imageSmoothingEnabled = true;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }
  return { canvas, ctx };
}

export function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/** Lighten (amount > 0) or darken (amount < 0) a colour. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  if (amount >= 0)
    return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
  return toHex(r * (1 + amount), g * (1 + amount), b * (1 + amount));
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ellipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  rotation = 0,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, 0, Math.PI * 2);
  ctx.fill();
}

/** A soft, feathered shadow (radial gradient ellipse). */
export function softShadow(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.3,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
  g.addColorStop(0, `rgba(45,28,12,${alpha})`);
  g.addColorStop(1, 'rgba(45,28,12,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Irregular organic blob (for patches, clumps, foliage). */
export function lumpy(
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  r: () => number,
  fill: string,
  points = 9,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rad = radius * (0.72 + r() * 0.42);
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad * 0.85;
    if (i === 0) ctx.moveTo(x, y);
    else
      ctx.quadraticCurveTo(
        cx + Math.cos(a - 0.3) * rad * 1.1,
        cy + Math.sin(a - 0.3) * rad * 0.95,
        x,
        y,
      );
  }
  ctx.closePath();
  ctx.fill();
}

export function speckle(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: () => number,
  colors: readonly string[],
  count: number,
  size = 1.2,
): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)] ?? colors[0] ?? '#000';
    const s = size * (0.6 + r() * 0.8);
    ctx.fillRect(x + r() * (w - s), y + r() * (h - s), s, s);
  }
}

/** Smooth, deterministic value noise in [0, 1]. */
export function noise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const h = (a: number, b: number): number => (hash(a, b, seed) & 0xffff) / 0xffff;
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Two octaves of noise: broad shapes with a little finer breakup. */
export function fbm(x: number, y: number, seed = 0): number {
  return noise(x, y, seed) * 0.7 + noise(x * 2.3, y * 2.3, seed + 7) * 0.3;
}

/**
 * Draw something with a thin dark outline around its silhouette (the
 * "ink line" of the art style). `paint` draws in local units into a scratch
 * canvas `w`×`h`; the result is stamped at (x, y) on `ctx`.
 */
export function withOutline(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  outline: string,
  paint: (c: Ctx) => void,
  doc: Document = document,
  width = 0.7,
): void {
  const fig = makeCanvas(w, h, doc);
  const sil = makeCanvas(w, h, doc);
  if (!fig.ctx || !sil.ctx) return;
  paint(fig.ctx);
  sil.ctx.setTransform(1, 0, 0, 1, 0, 0);
  sil.ctx.drawImage(fig.canvas, 0, 0);
  sil.ctx.globalCompositeOperation = 'source-in';
  sil.ctx.fillStyle = outline;
  sil.ctx.fillRect(0, 0, sil.canvas.width, sil.canvas.height);
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    ctx.drawImage(sil.canvas, x + dx * width, y + dy * width, w, h);
  }
  ctx.drawImage(fig.canvas, x, y, w, h);
}

/** Materials shared by every place (wood, fired clay, field stone). */
export const MATERIAL = {
  wood: '#8a623c',
  woodDark: '#573b22',
  clay: '#bc7248',
  clayDark: '#8c5231',
  rock: '#aa9474',
} as const;
