/**
 * Colour helpers shared by the world painter and the interface, so a person's
 * clothes look the same on the road and in their portrait.
 *
 * `naturalColor` pulls authored colours toward the dyes and undyed fibres of
 * the period (madder, indigo, weld and saffron, walnut, undyed wool and
 * linen): saturation is capped and extreme lightness is compressed. Hue is
 * kept, so everyone stays recognisable, just less candy-coloured.
 */
type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(hue + 1 / 3) * 255, channel(hue) * 255, channel(hue - 1 / 3) * 255];
}

/** Maximum saturation of a naturally dyed or undyed cloth. */
export const NATURAL_MAX_SATURATION = 0.42;

export function naturalColor(hex: string): string {
  const [h, s, l] = rgbToHsl(parseHex(hex));
  // Dyes fade toward warm: nudge hue a little toward ochre (≈ 35°).
  const toward = 35;
  const delta = ((toward - h + 540) % 360) - 180;
  const hue = h + delta * 0.08 * s;
  const sat = Math.min(s * 0.74, NATURAL_MAX_SATURATION);
  const light = 0.1 + l * 0.8;
  return toHex(hslToRgb(hue, sat, light));
}

/** Skin keeps its tone; only very saturated values are softened. */
export function naturalSkin(hex: string): string {
  const [h, s, l] = rgbToHsl(parseHex(hex));
  return toHex(hslToRgb(h, Math.min(s * 0.9, 0.5), l));
}
