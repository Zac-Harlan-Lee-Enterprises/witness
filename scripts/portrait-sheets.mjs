#!/usr/bin/env node
/**
 * Review sheets for the rendered portraits (docs/art/portraits/):
 *
 * - `contact-sheet-<chapter>.webp`: everyone who speaks in a chapter, with
 *   their name and part, at 256 px; `contact-sheet-players.webp`: the looks;
 * - `before-after-v1-v2.webp` (with --compare <commit>): each person the
 *   first pass rendered, as it was (left) and as it is now (right).
 *
 *   npm run art:portrait-sheets
 *   npm run art:portrait-sheets -- --compare 640002b
 *
 * The sheets are drawn on a canvas in headless Chromium (Playwright, already
 * a dev dependency) and encoded as WebP there, so nothing else is needed.
 */
/* global Image, document -- used inside page.evaluate, in the browser */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const DIR = join(ROOT, 'public', 'art', 'portraits');
const OUT = join(ROOT, 'docs', 'art', 'portraits');
const data = JSON.parse(
  readFileSync(join(ROOT, 'tools', 'art', 'data', 'portrait-people.json'), 'utf8'),
);
const compareAt = process.argv.includes('--compare')
  ? process.argv[process.argv.indexOf('--compare') + 1]
  : null;

const dataUrl = (buf) => `data:image/webp;base64,${buf.toString('base64')}`;
const now = (id, size = 256) => dataUrl(readFileSync(join(DIR, `${id}-${size}.webp`)));

function before(id, size = 256) {
  try {
    const buf = execFileSync(
      'git',
      ['show', `${compareAt}:public/art/portraits/${id}-${size}.webp`],
      {
        maxBuffer: 1 << 24,
        stdio: ['ignore', 'pipe', 'ignore'], // people new since then are expected
      },
    );
    return dataUrl(buf);
  } catch {
    return null;
  }
}

/** Draw a sheet in the page and return it as WebP bytes. */
async function sheet(page, { title, tiles, cols, tile = 256, pairs = false }) {
  const b64 = await page.evaluate(
    async ({ title, tiles, cols, tile, pairs }) => {
      const load = (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const gap = 12;
      const label = 46;
      const cellW = pairs ? tile * 2 + 4 : tile;
      const rows = Math.ceil(tiles.length / cols);
      const head = 52;
      const canvas = document.createElement('canvas');
      canvas.width = cols * cellW + (cols + 1) * gap;
      canvas.height = head + rows * (tile + label) + (rows + 1) * gap;
      const g = canvas.getContext('2d');
      g.fillStyle = '#f1e6cc';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = '#2a170b';
      g.font = '600 24px Georgia, serif';
      g.fillText(title, gap, 34);
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        const x = gap + (i % cols) * (cellW + gap);
        const y = head + gap + Math.floor(i / cols) * (tile + label + gap);
        const srcs = pairs ? [t.before, t.after] : [t.after];
        for (let k = 0; k < srcs.length; k++) {
          const src = srcs[k];
          const xx = x + k * (tile + 4);
          if (src) g.drawImage(await load(src), xx, y, tile, tile);
          else {
            g.fillStyle = '#d8c9a8';
            g.fillRect(xx, y, tile, tile);
            g.fillStyle = '#5a4630';
            g.font = '16px Georgia, serif';
            g.fillText('(new)', xx + tile / 2 - 22, y + tile / 2);
          }
        }
        g.fillStyle = '#2a170b';
        g.font = '600 17px Georgia, serif';
        g.fillText(t.name, x, y + tile + 20);
        g.fillStyle = '#5a4630';
        g.font = '14px Georgia, serif';
        g.fillText(t.role.length > 44 ? `${t.role.slice(0, 43)}…` : t.role, x, y + tile + 39);
      }
      return canvas.toDataURL('image/webp', 0.9).split(',')[1];
    },
    { title, tiles, cols, tile, pairs },
  );
  return Buffer.from(b64, 'base64');
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const written = [];
for (const ch of data.chapters) {
  const people = data.characters.filter((c) => c.chapter === ch.id);
  const tiles = people.map((c) => ({ name: c.name, role: c.role, after: now(c.id) }));
  const buf = await sheet(page, {
    title: `Chapter ${ch.number}: ${ch.title}`,
    tiles,
    cols: Math.min(4, tiles.length),
  });
  const file = join(OUT, `contact-sheet-${ch.id}.webp`);
  writeFileSync(file, buf);
  written.push(file);
}
{
  const tiles = data.players.map((p) => ({
    name: `Player: ${p.id}`,
    role: 'A child, neither boy nor girl',
    after: now(`player-${p.id}`),
  }));
  const file = join(OUT, 'contact-sheet-players.webp');
  writeFileSync(file, await sheet(page, { title: 'The player’s looks', tiles, cols: 4 }));
  written.push(file);
}
if (compareAt) {
  const firstPass = [
    ...data.characters.map((c) => ({ id: c.id, name: c.name, role: c.role })),
    ...data.players.map((p) => ({
      id: `player-${p.id}`,
      name: `Player: ${p.id}`,
      role: 'A child',
    })),
  ]
    .map((p) => ({ ...p, before: before(p.id) }))
    .filter((p) => p.before);
  const tiles = firstPass.map((p) => ({ ...p, after: now(p.id) }));
  const file = join(OUT, 'before-after-v1-v2.webp');
  writeFileSync(
    file,
    await sheet(page, {
      title: `First pass (left) and second pass (right)`,
      tiles,
      cols: 4,
      tile: 200,
      pairs: true,
    }),
  );
  written.push(file);
}
await browser.close();
for (const f of written) console.log(`wrote ${f.slice(ROOT.length + 1)}`);
