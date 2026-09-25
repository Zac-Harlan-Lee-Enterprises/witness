/**
 * Bundle size report (run after `npm run build`): raw and gzip sizes of every
 * JS/CSS asset, grouped into what the first visit downloads vs. what loads
 * lazily when a chapter starts.  Usage: npm run perf:bundle
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dir = new URL('../dist/assets/', import.meta.url);
const files = readdirSync(dir).filter((f) => /\.(js|css)$/.test(f));
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const rows = files.map((f) => {
  const buf = readFileSync(new URL(f, dir));
  const lazy = /^(mount-world|road-to-jericho|virtual_pwa|workbox)/.test(f);
  return { file: f, raw: buf.length, gzip: gzipSync(buf).length, lazy };
});
const sum = (list, key) => list.reduce((s, r) => s + r[key], 0);
console.log('asset'.padEnd(46), 'raw'.padStart(10), 'gzip'.padStart(10), ' loading');
for (const r of rows.sort((a, b) => b.gzip - a.gzip)) {
  console.log(
    r.file.padEnd(46),
    kb(r.raw).padStart(10),
    kb(r.gzip).padStart(10),
    r.lazy ? ' lazy' : ' initial',
  );
}
const initial = rows.filter((r) => !r.lazy);
const lazy = rows.filter((r) => r.lazy);
console.log(`\nInitial JS+CSS: ${kb(sum(initial, 'gzip'))} gzip (${kb(sum(initial, 'raw'))} raw)`);
console.log(`Lazy (world engine + chapter + PWA helper): ${kb(sum(lazy, 'gzip'))} gzip`);
const total = readdirSync(new URL('../dist/', import.meta.url), { recursive: true })
  .map((f) => new URL(`../dist/${f}`, import.meta.url))
  .filter((u) => statSync(u).isFile() && !u.pathname.endsWith('.map'))
  .reduce((s, u) => s + statSync(u).size, 0);
console.log(`Whole deployable site (excluding source maps): ${kb(total)}`);
