#!/usr/bin/env node
/**
 * Review sheets for the rendered portraits (docs/art/portraits/):
 *
 * - `contact-sheet-<chapter>.webp`: everyone who speaks in a chapter, with
 *   their name and part, at 256 px; `contact-sheet-players.webp`: the looks;
 * - `before-after-<pass>.webp` (with --compare <commit>): each person
 *   rendered at that commit, as they were (left) and as they are now (right).
 *   `--pass` names the pair (default v1-v2: the first pass against the second);
 * - `before-after-<pass>-detail.webp` (with --compare): the faces of a few
 *   people from the 512 px masters, before and after, where the nose, lips,
 *   eyes, skin and beards can be compared (`--detail id,id,…` chooses them);
 * - `expressions-<chapter>.webp`: each person with expressions, neutral
 *   first, then every expression their lines carry.
 *
 * `--out DIR` writes the sheets there instead, and `--tile N` draws the
 * portraits N px across (e.g. 104 or 160, the sizes the game shows them).
 *
 *   npm run art:portrait-sheets
 *   npm run art:portrait-sheets -- --compare 640002b
 *   npm run art:portrait-sheets -- --compare d37dac5 --pass v2-v3
 *   npm run art:portrait-sheets -- --compare 38d090f --pass v2-v4
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
const arg = (name) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null;
const OUT = arg('--out') ?? join(ROOT, 'docs', 'art', 'portraits');
/** Portrait size on the sheets (px): 256 by default; 104 or 160 to see them as the game does. */
const TILE = Number(arg('--tile') ?? 256);
const data = JSON.parse(
  readFileSync(join(ROOT, 'tools', 'art', 'data', 'portrait-people.json'), 'utf8'),
);
const compareAt = arg('--compare');
const pass = arg('--pass') ?? 'v1-v2';
const PASSES = {
  v1: 'First pass',
  v2: 'Second pass',
  v3: 'Third pass',
  v4: 'MakeHuman pass',
};
const [passBefore, passAfter] = pass.split('-').map((p) => PASSES[p] ?? p);
/** Lower-case the first letter only ("MakeHuman pass" → "makeHuman" would be wrong). */
const lower = (t) => (t.startsWith('MakeHuman') ? t : t[0].toLowerCase() + t.slice(1));

const dataUrl = (buf) => `data:image/webp;base64,${buf.toString('base64')}`;
const now = (id, size = 256, expression = 'neutral') =>
  dataUrl(
    readFileSync(
      join(DIR, ...(expression === 'neutral' ? [] : [expression]), `${id}-${size}.webp`),
    ),
  );
/** The file size to draw a tile from (the next one up). */
const fileFor = (tile) => (tile <= 128 ? 128 : tile <= 256 ? 256 : 512);

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
async function sheet(page, { title, tiles, cols, tile = 256, pairs = false, crop = null }) {
  const b64 = await page.evaluate(
    async ({ title, tiles, cols, tile, pairs, crop }) => {
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
          if (t.blank) continue;
          if (src && crop) {
            // A square from the source (fractions of its size), drawn at tile size.
            const img = await load(src);
            const [sx, sy, sw] = [crop.x * img.width, crop.y * img.height, crop.w * img.width];
            g.drawImage(img, sx, sy, sw, sw, xx, y, tile, tile);
          } else if (src) g.drawImage(await load(src), xx, y, tile, tile);
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
    { title, tiles, cols, tile, pairs, crop },
  );
  return Buffer.from(b64, 'base64');
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const written = [];
for (const ch of data.chapters) {
  const people = data.characters.filter((c) => c.chapter === ch.id);
  const tiles = people.map((c) => ({
    name: c.name,
    role: c.role,
    after: now(c.id, fileFor(TILE)),
  }));
  const buf = await sheet(page, {
    title: `Chapter ${ch.number}: ${ch.title}`,
    tiles,
    cols: Math.min(TILE < 200 ? 6 : 4, tiles.length),
    tile: TILE,
  });
  const file = join(OUT, `contact-sheet-${ch.id}.webp`);
  writeFileSync(file, buf);
  written.push(file);
}
{
  const tiles = data.players.map((p) => ({
    name: `Player: ${p.id}`,
    role: 'A child, neither boy nor girl',
    after: now(`player-${p.id}`, fileFor(TILE)),
  }));
  const file = join(OUT, 'contact-sheet-players.webp');
  writeFileSync(
    file,
    await sheet(page, { title: 'The player’s looks', tiles, cols: 4, tile: TILE }),
  );
  written.push(file);
}
// Every expression rendered, per chapter: a row per person, neutral first.
for (const ch of data.chapters) {
  const people = data.characters.filter((c) => c.chapter === ch.id && c.expressions.length > 0);
  if (people.length === 0) continue;
  const width = Math.max(...people.map((c) => c.expressions.length)) + 1;
  const tiles = people.flatMap((c) => {
    const row = ['neutral', ...c.expressions].map((e) => ({
      name: e === 'neutral' ? c.name : '',
      role: e,
      after: now(c.id, fileFor(TILE), e),
    }));
    while (row.length < width) row.push({ name: '', role: '', after: null, blank: true });
    return row;
  });
  const file = join(OUT, `expressions-${ch.id}.webp`);
  writeFileSync(
    file,
    await sheet(page, {
      title: `Chapter ${ch.number}: every face their lines carry`,
      tiles,
      cols: width,
      tile: Math.min(TILE, 200),
    }),
  );
  written.push(file);
}
if (compareAt) {
  const earlier = [
    ...data.characters.map((c) => ({ id: c.id, name: c.name, role: c.role })),
    ...data.players.map((p) => ({
      id: `player-${p.id}`,
      name: `Player: ${p.id}`,
      role: 'A child',
    })),
  ]
    .map((p) => ({ ...p, before: before(p.id, fileFor(TILE)) }))
    .filter((p) => p.before);
  const tiles = earlier.map((p) => ({ ...p, after: now(p.id, fileFor(TILE)) }));
  const file = join(OUT, `before-after-${pass}.webp`);
  writeFileSync(
    file,
    await sheet(page, {
      title: `${passBefore} (left) and ${lower(passAfter)} (right)`,
      tiles,
      cols: 4,
      tile: Math.min(TILE, 200),
      pairs: true,
    }),
  );
  written.push(file);
  // The faces up close, from the masters.
  const who = (arg('--detail') ?? 'hadassah,salome,malik,shimon,hanan,kallias,natan,hagit').split(
    ',',
  );
  const detail = who
    .map((id) => earlier.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => ({ ...p, before: before(p.id, 512), after: now(p.id, 512) }));
  const detailFile = join(OUT, `before-after-${pass}-detail.webp`);
  writeFileSync(
    detailFile,
    await sheet(page, {
      title: `Faces up close: ${lower(passBefore)} (left) and ${lower(passAfter)} (right)`,
      tiles: detail,
      cols: 2,
      tile: 320,
      pairs: true,
      crop: { x: 0.25, y: 0.2, w: 0.5 },
    }),
  );
  written.push(detailFile);
}
await browser.close();
for (const f of written) console.log(`wrote ${f.slice(ROOT.length + 1)}`);
