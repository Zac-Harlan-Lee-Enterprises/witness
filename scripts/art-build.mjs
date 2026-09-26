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
 *   npm run art:portraits                          # render public/art/portraits (≈ 2 min a person)
 *   npm run art:portraits -- --who miriam player:look-1   # just some people
 *   node scripts/art-build.mjs probe <scene-id> x0 y0 x1 y1 [ppu]   # a quick beauty render for review
 *
 * Extra arguments after the job are passed to the Blender script
 * (for example --variants day, --samples 32, --only menashe~sit, --who miriam).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

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
  // Bring older renders up to date (tiled grounds, half-resolution pages) without rendering.
  upgrade: () => [
    [
      'tools/art/upgrade_place.py',
      ...(rest.length ? rest : PLACES).map((id) => `public/art/${id}`),
    ],
  ],
  // Everyone in tools/art/data/portrait-people.json (every character who
  // speaks in any chapter, and the player looks) unless --who is given; the
  // manifest is bundled by src/features/portraits.
  portraits: () => [
    [
      'tools/art/build_portraits.py',
      '--out',
      'public/art/portraits',
      '--manifest',
      'src/features/portraits/portrait-manifest.json',
      ...rest,
    ],
  ],
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

const job = jobs[what];
if (!job) {
  console.error(`Usage: node scripts/art-build.mjs ${Object.keys(jobs).join('|')} [args]`);
  process.exit(1);
}
for (const args of job()) {
  const status = blend(args);
  if (status !== 0) process.exit(status);
}
