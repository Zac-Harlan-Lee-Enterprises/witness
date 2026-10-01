#!/usr/bin/env node
/**
 * Rebuild pre-rendered art with Blender (an authoring tool only; players
 * never need it). Set BLENDER to its executable if it isn't in the usual place.
 *
 *   npm run art:data                               # export chapters (maps, characters) for Blender
 *   node scripts/art-build.mjs place <scene-id>    # render public/art/<scene-id>
 *   node scripts/art-build.mjs places              # render every place in PLACES (below)
 *   npm run art:market                             # = place jerusalem-market (≈ 6 min on an M3 Pro)
 *   npm run art:people                             # every person those places need (only what is missing)
 *   npm run art:portrait-data                      # export everyone who speaks, in every chapter
 *   npm run art:fetch-makehuman                    # MakeHuman's CC0 model data, for the portraits
 *   npm run art:portraits                          # every portrait and expression (≈ 80 s each; two Blenders at once)
 *   npm run art:portraits -- --who miriam player:look-1 --expression neutral   # just some
 *   npm run art:portraits -- --missing --jobs 3     # only what is missing or out of date
 *   node scripts/art-build.mjs probe <scene-id> x0 y0 x1 y1 [ppu]   # a quick beauty render for review
 *   node scripts/art-build.mjs teaser [--shots 6] [--quality preview]   # the teaser film before Chapter 1
 *   node scripts/art-build.mjs teaser-edit          # cut and encode it from frames already rendered
 *   node scripts/art-build.mjs key-art [--shots title] [--quality preview]   # the menus' key art
 *
 * Extra arguments after the job are passed to the Blender script
 * (for example --variants day, --samples 32, --only menashe~sit, --who miriam).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CANDIDATES = [
  process.env.BLENDER,
  '/Applications/Blender.app/Contents/MacOS/Blender',
  '/usr/bin/blender',
  '/snap/bin/blender',
  'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe',
].filter(Boolean);

/** Places with pre-rendered art (keep in step with PLACES_WITH_ART in src/game/prerendered/select.ts). */
const PLACES = [
  'miriam-house',
  'jerusalem-market',
  'jericho-road',
  'jericho',
  // Chapter 2: A Storm on Galilee
  'shelomit-house',
  'capernaum-shore',
  'open-lake',
  // Chapter 3: A Journey to Bethlehem
  'tamar-house',
  'bethlehem-lanes',
  'shepherds-fields',
  // Chapter 4: A Letter from Paul
  'ammia-workshop',
  'colossae-street',
  'lycus-road',
  'philemon-house',
];

/** The menus' key art, by shot (tools/art/lib/key_art_shots.py): the title screen's, then each chapter's. */
const KEY_ART = [
  'title',
  'road-to-jericho',
  'storm-on-galilee',
  'journey-to-bethlehem',
  'letter-from-paul',
];

/**
 * Samples per place: rooms need more (their light is mostly bounced), and so
 * do the fields at night (a moon, a fire, and a great deal of grass). The
 * lights each place is rendered in are its light plan (PLACE_LIGHTS in
 * tools/art/lib/lighting.py).
 */
const SAMPLES = {
  'miriam-house': '512',
  'tamar-house': '512',
  'shepherds-fields': '160',
  'shelomit-house': '512',
  'ammia-workshop': '512',
  'philemon-house': '640',
};

/**
 * Portraits: one Blender per person and expression (a person's neutral
 * portrait first, then their expressions, which reuse its skin
 * calibration), several people at once. A Blender that crashes (Metal can,
 * now and then, when it compiles its kernels) is run again.
 */
async function portraits(args) {
  const take = (flag, many = false) => {
    const i = args.indexOf(flag);
    if (i < 0) return null;
    const vals = [];
    let j = i + 1;
    for (; j < args.length && !args[j].startsWith('--'); j++) vals.push(args[j]);
    args.splice(i, many ? j - i : Math.min(2, j - i));
    return many ? vals : (vals[0] ?? true);
  };
  const jobsN = Number(take('--jobs') ?? 2);
  const who = take('--who', true);
  const expression = take('--expression') ?? 'all';
  const missing = take('--missing') === true;
  const data = JSON.parse(readFileSync('tools/art/data/portrait-people.json', 'utf8'));
  const OUT = 'public/art/portraits';
  const MANIFEST = 'src/features/portraits/portrait-manifest.json';
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  const people = [
    ...data.characters.map((c) => ({ who: c.id, pid: c.id, key: c.key, exprs: c.expressions })),
    ...data.players.map((p) => ({
      who: `player:${p.id}`,
      pid: `player-${p.id}`,
      key: p.key,
      exprs: [],
    })),
  ].filter((p) => !who || who.includes(p.who));
  const done = (p, e) => {
    const entry = manifest[p.pid];
    if (!entry || entry.appearance !== p.key) return false;
    if (e !== 'neutral' && !(entry.expressions ?? []).includes(e)) return false;
    const dir = e === 'neutral' ? OUT : join(OUT, e);
    return existsSync(join(dir, `${p.pid}-512.webp`));
  };
  const chains = people
    .map((p) => {
      const exprs = expression === 'all' ? ['neutral', ...p.exprs] : expression.split(',');
      return { p, tasks: exprs.filter((e) => !(missing && done(p, e))) };
    })
    .filter((c) => c.tasks.length > 0);
  const total = chains.reduce((n, c) => n + c.tasks.length, 0);
  let finished = 0;
  let failed = 0;
  const one = (p, e) =>
    new Promise((resolve) => {
      const child = spawn(
        blender,
        [
          '-b',
          '--factory-startup',
          '-P',
          'tools/art/build_portraits.py',
          '--',
          '--out',
          OUT,
          '--manifest',
          MANIFEST,
          '--who',
          p.who,
          '--expression',
          e,
          ...args,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let log = '';
      child.stdout.on('data', (d) => (log += d));
      child.stderr.on('data', (d) => (log += d));
      child.on('close', (code) => {
        // Each Blender's own log, for when something goes wrong.
        mkdirSync('.logs/portraits', { recursive: true });
        writeFileSync(join('.logs/portraits', `${p.pid}~${e}.log`), log);
        resolve({ code, log });
      });
    });
  const run = async (chain) => {
    for (const e of chain.tasks) {
      let result = { code: 1, log: '' };
      for (let attempt = 1; attempt <= 3 && result.code !== 0; attempt++) {
        result = await one(chain.p, e);
        if (result.code !== 0)
          console.log(`  ${chain.p.pid} ${e}: attempt ${attempt} failed (${result.code})`);
      }
      finished++;
      const check = result.log.split('\n').find((l) => l.includes('[portrait] CHECK'));
      if (result.code !== 0) {
        failed++;
        console.log(
          `[${finished}/${total}] FAILED ${chain.p.pid} ${e}\n${result.log.split('\n').slice(-15).join('\n')}`,
        );
      } else
        console.log(
          `[${finished}/${total}] ${chain.p.pid} ${e}${check ? `  ${check.slice(check.indexOf('{'))}` : ''}`,
        );
    }
  };
  const queue = [...chains];
  await Promise.all(
    Array.from({ length: Math.max(1, jobsN) }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) await run(c);
    }),
  );
  console.log(`portraits: ${total - failed} rendered, ${failed} failed`);
  return failed ? 1 : 0;
}

const [what, ...rest] = process.argv.slice(2);
const blender = CANDIDATES.find((c) => existsSync(c));
if (!blender) {
  console.error('Blender not found. Install Blender 5.2+ or set BLENDER=/path/to/blender.');
  process.exit(1);
}

function place(id, extra = []) {
  return [
    'tools/art/build_place.py',
    '--scene',
    id,
    '--out',
    `public/art/${id}`,
    '--ppu',
    '3',
    '--samples',
    SAMPLES[id] ?? '96',
    ...extra,
  ];
}

function blend(args) {
  const [script, ...scriptArgs] = args;
  const r = spawnSync(blender, ['-b', '--factory-startup', '-P', script, '--', ...scriptArgs], {
    stdio: 'inherit',
  });
  return r.status ?? 1;
}

const jobs = {
  place: () => {
    const [id, ...extra] = rest;
    if (!id) throw new Error('Usage: node scripts/art-build.mjs place <scene-id> [args]');
    return [place(id, extra)];
  },
  places: () => PLACES.map((id) => place(id, rest)),
  market: () => [place('jerusalem-market', rest)],
  people: () => [
    [
      'tools/art/build_people.py',
      '--out',
      'public/art/people',
      '--ppu',
      '3',
      '--samples',
      '48',
      '--scenes',
      ...PLACES,
      ...rest,
    ],
  ],
  // The teaser film before Chapter 1: every shot's frames (skipping frames
  // already rendered; `--quality preview` for a quick animatic, `--shots 6`
  // for some), then the edit and encode into public/art/teaser/chapter-1.
  // About 5 hours at final quality on an M3 Pro.
  teaser: () => [
    ['tools/art/build_teaser.py', '--quality', 'final', ...rest],
    ['tools/art/edit_teaser.py', '--quality', 'final', '--out', 'public/art/teaser/chapter-1'],
  ],
  // The menus' key art (tools/art/lib/key_art_shots.py): the title screen's
  // hero and each chapter's picture, into public/art/key-art (<id>.webp and
  // a half-width copy). One Blender per shot; `--shots title` for some,
  // `--quality preview` for a quick look (written under tools/art/.cache).
  // About 25 minutes for all five on an M3 Pro.
  'key-art': () => {
    const args = [...rest];
    const i = args.indexOf('--shots');
    let shots = KEY_ART;
    if (i >= 0) {
      let j = i + 1;
      while (j < args.length && !args[j].startsWith('--')) j++;
      shots = args.slice(i + 1, j);
      args.splice(i, j - i);
    }
    return shots.map((id) => ['tools/art/build_key_art.py', '--shots', id, ...args]);
  },
  // Only the edit and encode, from frames already rendered.
  'teaser-edit': () => [
    [
      'tools/art/edit_teaser.py',
      '--quality',
      'final',
      '--out',
      'public/art/teaser/chapter-1',
      ...rest,
    ],
  ],
  // Bring older renders up to date (tiled grounds, half-resolution pages) without rendering.
  upgrade: () => [
    [
      'tools/art/upgrade_place.py',
      ...(rest.length ? rest : PLACES).map((id) => `public/art/${id}`),
    ],
  ],
  // Everyone in tools/art/data/portrait-people.json (every character who
  // speaks in any chapter, and the player looks) unless --who is given; the
  // manifest is bundled by src/features/portraits. Everyone is rendered in a
  // Blender of their own: a displaced head is millions of micro-polygons, and
  // over a run of 43 in one process memory piled up until meshing a head
  // took 17 minutes instead of 20 seconds.
  probe: () => {
    const [id, x0, y0, x1, y1, ppu = '1.5', ...extra] = rest;
    mkdirSync('test-results/art-probes', { recursive: true });
    return [
      [
        'tools/art/build_place.py',
        '--scene',
        id,
        '--probe',
        x0,
        y0,
        x1,
        y1,
        '--ppu',
        ppu,
        '--samples',
        '32',
        '--out',
        `test-results/art-probes/${id}-${x0}-${y0}-${x1}-${y1}.png`,
        ...extra,
      ],
    ];
  },
};

if (what === 'portraits') process.exit(await portraits([...rest]));
const job = jobs[what];
if (!job) {
  console.error(
    `Usage: node scripts/art-build.mjs ${[...Object.keys(jobs), 'portraits'].join('|')} [args]`,
  );
  process.exit(1);
}
for (const args of job()) {
  const status = blend(args);
  if (status !== 0) process.exit(status);
}
