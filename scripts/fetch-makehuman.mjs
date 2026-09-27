#!/usr/bin/env node
/**
 * Download MakeHuman's CC0 model data (the hm08 base mesh and the morph
 * targets the portraits use) into a local, gitignored cache for the portrait
 * build (tools/art/build_portraits.py). Players and CI never need it: the
 * rendered portraits are committed.
 *
 *   npm run art:fetch-makehuman            # download what is missing, check every file
 *   npm run art:fetch-makehuman -- --check # only check the cache
 *
 * Every file is pinned in tools/art/data/makehuman-files.json: its path in
 * MakeHuman's repository at one commit, its size and its SHA-256. A file
 * whose checksum differs is refused. Only data is downloaded, never code
 * (MakeHuman's code is AGPL; its assets are CC0: see
 * docs/adr/0016-makehuman-base-for-portraits.md and docs/art/portraits.md).
 *
 * Plain HTTPS downloads from raw.githubusercontent.com: no account, token
 * or identifying header is sent. MAKEHUMAN_CACHE overrides where files go.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const pinned = JSON.parse(
  readFileSync(join(ROOT, 'tools', 'art', 'data', 'makehuman-files.json'), 'utf8'),
);
const CACHE = process.env.MAKEHUMAN_CACHE ?? join(ROOT, 'tools', 'art', '.cache', 'makehuman');
const checkOnly = process.argv.includes('--check');
const base = `https://raw.githubusercontent.com/${pinned.source.repository}/${pinned.source.commit}/`;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function one(file) {
  const dest = join(CACHE, file.path);
  if (existsSync(dest) && sha256(readFileSync(dest)) === file.sha256) return 'ok';
  if (checkOnly) return 'missing';
  const res = await fetch(base + file.path, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${file.path}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (got !== file.sha256)
    throw new Error(`${file.path}: SHA-256 ${got}, expected ${file.sha256} (refused)`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  return 'downloaded';
}

const counts = { ok: 0, downloaded: 0, missing: 0 };
const queue = [...pinned.files];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) counts[await one(f)] += 1;
  }),
);
console.log(
  `MakeHuman data (${pinned.source.repository}@${pinned.source.commit.slice(0, 7)}, ${pinned.source.license}) in ${CACHE}: ` +
    `${counts.ok} present, ${counts.downloaded} downloaded, ${counts.missing} missing`,
);
if (counts.missing > 0) process.exit(1);
