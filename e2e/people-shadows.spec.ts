import { expect, test } from '@playwright/test';
import { openApp } from './support';

/**
 * People's cast shadows are multiplied onto the ground, one frame per pose,
 * each rendered in its light's shadow box. A frame that ends while the shadow
 * is still grey prints its edge on the floor as a faint rectangle round the
 * person (soft indoor, lamp and overcast light throw shadows wider than their
 * boxes), so wherever a frame's pixels reach the edge of the frame they must
 * be white (tools/art/lib/shadow_edges.py). Decoded by the browser, as
 * players get them.
 */
test('no cast shadow is cut off at the edge of its frame', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'decodes WebP on Chromium');
  await openApp(page);
  const faults = await page.evaluate(async () => {
    type Frame = [number, number, number, number, number, number];
    interface Shadow {
      sheet: string;
      frameWidth: number;
      frameHeight: number;
    }
    interface Entry {
      shadows?: Record<string, Shadow>;
      atlas?: Record<string, Record<string, Frame>>;
    }
    // Multiplied at 0.9, 248 darkens the floor by under 3%: not a visible edge.
    const WHITE = 248;
    const base = document.baseURI;
    const people = (await (await fetch(new URL('art/people/people.json', base))).json()) as Record<
      string,
      Entry
    >;
    const sheets = new Map<string, { fw: number; fh: number; frames: Record<string, Frame> }>();
    for (const e of Object.values(people))
      for (const s of Object.values(e.shadows ?? {})) {
        const frames = e.atlas?.[s.sheet];
        if (frames) sheets.set(s.sheet, { fw: s.frameWidth, fh: s.frameHeight, frames });
      }
    const out: string[] = [];
    for (const [file, { fw, fh, frames }] of sheets) {
      const blob = await (await fetch(new URL(`art/people/${file}`, base))).blob();
      const bmp = await createImageBitmap(blob, {
        colorSpaceConversion: 'none',
        premultiplyAlpha: 'none',
      });
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(bmp, 0, 0);
      const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
      const at = (x: number, y: number): number => {
        const i = (y * bmp.width + x) * 4;
        return Math.min(px[i] ?? 255, px[i + 1] ?? 255, px[i + 2] ?? 255);
      };
      for (const [name, [x, y, w, h, ox, oy]] of Object.entries(frames)) {
        // Trimmed frames: only the sides of the trimmed pixels that lie on the
        // frame's own edges (elsewhere the shadow ended inside the frame).
        let darkest = 255;
        const row = (j: number): void => {
          for (let i = 0; i < w; i++) darkest = Math.min(darkest, at(x + i, y + j));
        };
        const column = (i: number): void => {
          for (let j = 0; j < h; j++) darkest = Math.min(darkest, at(x + i, y + j));
        };
        if (oy === 0) row(0);
        if (oy + h === fh) row(h - 1);
        if (ox === 0) column(0);
        if (ox + w === fw) column(w - 1);
        if (darkest < WHITE) out.push(`${file} ${name}: edge ${darkest}`);
      }
    }
    return { checked: sheets.size, out };
  });
  expect(faults.checked).toBeGreaterThan(100);
  expect(faults.out, faults.out.slice(0, 20).join('\n')).toEqual([]);
});
