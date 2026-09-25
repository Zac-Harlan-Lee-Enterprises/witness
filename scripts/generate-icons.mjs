/**
 * Rasterise public/icons/icon.svg into the PNG sizes PWAs and iOS need,
 * using Playwright's bundled Chromium (already a dev dependency). Run after
 * changing the SVG:  npm run icons
 */
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const targets = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0 },
  // Maskable icons need a safe zone: shrink the art to 80% on a full-bleed background.
  { file: 'icon-maskable-512.png', size: 512, padding: 0.1 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.padding * 2));
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:#6b3f22;display:grid;place-items:center;width:${t.size}px;height:${t.size}px">
       <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
     </body></html>`,
  );
  const png = await page.screenshot({ type: 'png', omitBackground: false });
  await writeFile(new URL(`../public/icons/${t.file}`, import.meta.url), png);
  console.log(`wrote public/icons/${t.file}`);
}
await browser.close();
