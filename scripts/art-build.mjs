#!/usr/bin/env node
/**
 * Rebuild pre-rendered art with Blender (an authoring tool only; players
 * never need it). Set BLENDER to its executable if it isn't in the usual place.
 *
 *   npm run art:data      # export characters and maps for Blender
 *   npm run art:market    # render public/art/jerusalem-market (≈ 6 min on an M3 Pro)
 *   npm run art:people    # render public/art/people (≈ 30 min)
 *   npm run art:portrait-data  # export everyone who speaks, in every chapter
 *   npm run art:portraits # render public/art/portraits (≈ 2 min a person)
 *   npm run art:portraits -- --who miriam player:look-1   # just some people
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const CANDIDATES = [
  process.env.BLENDER,
  '/Applications/Blender.app/Contents/MacOS/Blender',
  '/usr/bin/blender',
  '/snap/bin/blender',
  'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe',
].filter(Boolean);

const PEOPLE = [
  'player:look-1',
  'player:look-2',
  'player:look-3',
  'player:look-4',
  'hadassah',
  'ezer',
  'menashe',
  'hanan',
  'malik',
  'shimon',
  'tobiah',
  'crowd:crowd-0',
  'crowd:crowd-1',
  'crowd:crowd-2',
  'crowd:crowd-3',
];

const what = process.argv[2];
const blender = CANDIDATES.find((c) => existsSync(c));
if (!blender) {
  console.error('Blender not found. Install Blender 5.2+ or set BLENDER=/path/to/blender.');
  process.exit(1);
}
const jobs = {
  market: [
    'tools/art/build_market.py',
    '--out',
    'public/art/jerusalem-market',
    '--ppu',
    '3',
    '--samples',
    '96',
  ],
  people: [
    'tools/art/build_people.py',
    '--out',
    'public/art/people',
    '--ppu',
    '3',
    '--samples',
    '48',
    '--who',
    ...PEOPLE,
  ],
  // Everyone in tools/art/data/portrait-people.json (every character who
  // speaks in any chapter, and the player looks) unless --who is given; the
  // manifest is bundled by src/features/portraits.
  portraits: [
    'tools/art/build_portraits.py',
    '--out',
    'public/art/portraits',
    '--manifest',
    'src/features/portraits/portrait-manifest.json',
  ],
};
const job = jobs[what];
if (!job) {
  console.error(`Usage: node scripts/art-build.mjs ${Object.keys(jobs).join('|')}`);
  process.exit(1);
}
const [script, ...args] = job;
// Anything after the job name goes to the build script (e.g. --who miriam).
args.push(...process.argv.slice(3));
const r = spawnSync(blender, ['-b', '--factory-startup', '-P', script, '--', ...args], {
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
