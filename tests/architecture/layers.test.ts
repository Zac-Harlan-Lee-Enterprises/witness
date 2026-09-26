import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture tests: the layer rules in AGENTS.md, enforced mechanically.
 * Every failure says WHAT broke, WHY the rule exists, and HOW to fix it.
 *
 *   domain  ← application ← (infrastructure | game | features) ← app
 *   content → domain (data only)       shared ← everyone
 */
const ROOT = resolve(__dirname, '../..');
/** These tests read every source file; give them room on a busy machine as the game grows. */
const SCAN_TIMEOUT_MS = 30_000;
const SRC = join(ROOT, 'src');

type Layer =
  'app' | 'domain' | 'application' | 'game' | 'features' | 'content' | 'infrastructure' | 'shared';

interface ImportRef {
  file: string;
  spec: string;
  target: string | null;
  typeOnly: boolean;
  dynamic: boolean;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [full] : [];
  });
}

const FILES = walk(SRC);

function layerOf(file: string): Layer | null {
  const top = relative(SRC, file).split('/')[0];
  return (
    (
      [
        'app',
        'domain',
        'application',
        'game',
        'features',
        'content',
        'infrastructure',
        'shared',
      ] as const
    ).find((l) => l === top) ?? null
  );
}

function resolveSpec(file: string, spec: string): string | null {
  if (spec.startsWith('@/')) return join(SRC, spec.slice(2));
  if (spec.startsWith('.')) return resolve(dirname(file), spec);
  return null;
}

function importsOf(file: string): ImportRef[] {
  const text = readFileSync(file, 'utf8');
  const refs: ImportRef[] = [];
  const staticRe = /^\s*(import|export)\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm;
  const sideEffectRe = /^\s*import\s+['"]([^'"]+)['"]/gm;
  const dynamicRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of text.matchAll(staticRe)) {
    const spec = m[3] as string;
    refs.push({
      file,
      spec,
      target: resolveSpec(file, spec),
      typeOnly: Boolean(m[2]),
      dynamic: false,
    });
  }
  for (const m of text.matchAll(sideEffectRe)) {
    const spec = m[1] as string;
    refs.push({ file, spec, target: resolveSpec(file, spec), typeOnly: false, dynamic: false });
  }
  for (const m of text.matchAll(dynamicRe)) {
    const spec = m[1] as string;
    refs.push({ file, spec, target: resolveSpec(file, spec), typeOnly: false, dynamic: true });
  }
  return refs;
}

const ALL_IMPORTS = FILES.flatMap(importsOf);
const rel = (f: string) => relative(ROOT, f);

const ALLOWED: Record<Layer, Layer[]> = {
  domain: ['domain'],
  shared: ['shared'],
  application: ['application', 'domain', 'shared'],
  content: ['content', 'domain', 'shared'],
  infrastructure: ['infrastructure', 'application', 'domain', 'shared'],
  game: ['game', 'application', 'domain', 'shared'],
  features: ['features', 'application', 'domain', 'shared'],
  app: ['app', 'domain', 'application', 'game', 'features', 'content', 'infrastructure', 'shared'],
};

const WHY: Record<Layer, string> = {
  domain:
    'The domain is pure game rules. Keeping it free of every other layer is what makes quests, dialogue and saves unit-testable and reusable for future chapters.',
  shared:
    'shared/ holds tiny framework-free utilities that every layer may use; it must not depend on any of them.',
  application:
    'Application services depend on ports (interfaces), never on concrete infrastructure, UI or Phaser — dependency inversion.',
  content:
    'Chapter content is data validated by domain schemas. It must not reach into engines, UI or storage.',
  infrastructure:
    'Adapters implement application ports; they must not know about UI or the world renderer.',
  game: 'The Phaser world renders what the application tells it and reports events back. It must not talk to React or storage.',
  features:
    'React components talk to the application layer only. Phaser and IndexedDB stay behind ports so the UI never reaches into engine internals.',
  app: 'The composition root may import anything.',
};

function violationsFor(layer: Layer): string[] {
  return (
    ALL_IMPORTS.filter((i) => layerOf(i.file) === layer && i.target)
      .map((i) => ({ i, target: layerOf(i.target as string) }))
      .filter(({ target }) => target !== null && !ALLOWED[layer].includes(target))
      // content may reference application PORT TYPES (e.g. ChapterSource) — nothing else.
      .filter(
        ({ i, target }) =>
          !(
            layer === 'content' &&
            target === 'application' &&
            i.typeOnly &&
            i.spec.endsWith('/ports')
          ),
      )
      .map(
        ({ i, target }) =>
          `FAIL  ${rel(i.file)} imports ${i.spec} (${target} layer)\n` +
          `      Why: ${WHY[layer]}\n` +
          `      Fix: depend on an interface in src/application/ports.ts (or move the code into the ${target} layer) and wire the concrete implementation in src/app/services.ts.`,
      )
  );
}

describe('architecture: layer boundaries', { timeout: SCAN_TIMEOUT_MS }, () => {
  (Object.keys(ALLOWED) as Layer[]).forEach((layer) => {
    it(`${layer}/ only imports from: ${ALLOWED[layer].join(', ')}`, () => {
      expect(violationsFor(layer), violationsFor(layer).join('\n\n')).toEqual([]);
    });
  });
});

function packageViolations(pkg: RegExp, allowedDirs: string[], why: string, fix: string): string[] {
  return ALL_IMPORTS.filter((i) => !i.target && pkg.test(i.spec))
    .filter((i) => !allowedDirs.some((d) => rel(i.file).startsWith(d)))
    .map((i) => `FAIL  ${rel(i.file)} imports '${i.spec}'\n      Why: ${why}\n      Fix: ${fix}`);
}

describe('architecture: framework containment', { timeout: SCAN_TIMEOUT_MS }, () => {
  it('only src/game imports Phaser', () => {
    const v = packageViolations(
      /^phaser/,
      ['src/game/'],
      'Phaser is ~1 MB and owns only rendering, movement and collisions; containing it keeps the menu bundle small and the engine swappable.',
      'Talk to the world through the WorldPort interface (src/application/ports.ts).',
    );
    expect(v, v.join('\n\n')).toEqual([]);
  });

  it('only src/infrastructure/persistence touches IndexedDB', () => {
    const v = packageViolations(
      /^(idb|fake-indexeddb)/,
      ['src/infrastructure/persistence/'],
      'Storage is behind SaveRepository/ProfileRepository so it can be swapped (memory fallback, future cloud sync) and every read is validated.',
      'Use SaveService/ProfileService from the application layer.',
    );
    const globals = FILES.filter((f) => !rel(f).startsWith('src/infrastructure/persistence/'))
      .filter((f) =>
        /\bindexedDB\b|\blocalStorage\b|\bsessionStorage\b/.test(readFileSync(f, 'utf8')),
      )
      .map(
        (f) =>
          `FAIL  ${rel(f)} uses browser storage directly\n      Why: saves must go through the validated, migrated repositories.\n      Fix: use SaveService / SettingsService.`,
      );
    expect([...v, ...globals], [...v, ...globals].join('\n\n')).toEqual([]);
  });

  it('only src/features and src/app use React', () => {
    const v = packageViolations(
      /^react(-dom)?(\/|$)/,
      ['src/features/', 'src/app/'],
      'Domain, application, content and game code must run without React (tests, future engines, server-side validation).',
      'Expose state through a Store and subscribe to it from a component in src/features.',
    );
    expect(v, v.join('\n\n')).toEqual([]);
  });

  it('keeps Phaser out of the initial bundle (only dynamic imports of src/game from outside it)', () => {
    const v = ALL_IMPORTS.filter(
      (i) => i.target && layerOf(i.target) === 'game' && layerOf(i.file) !== 'game',
    )
      .filter((i) => !i.dynamic && !i.typeOnly)
      .map(
        (i) =>
          `FAIL  ${rel(i.file)} statically imports ${i.spec}\n      Why: a static import pulls Phaser into the first download.\n      Fix: use await import('${i.spec}') as src/app/game-runtime.ts does.`,
      );
    expect(v, v.join('\n\n')).toEqual([]);
  });

  it('keeps chapter content lazy (only dynamic imports of chapter folders outside src/content)', () => {
    const v = ALL_IMPORTS.filter(
      (i) =>
        i.target?.includes('/src/content/chapters/') &&
        layerOf(i.file) !== 'content' &&
        !i.dynamic &&
        !i.typeOnly,
    ).map(
      (i) =>
        `FAIL  ${rel(i.file)} statically imports ${i.spec}\n      Why: chapters download only when played.\n      Fix: load chapters through ChapterSource (src/content/index.ts).`,
    );
    expect(v, v.join('\n\n')).toEqual([]);
  });
});

/** Source without comments or string literals, so prose can't trip a code rule. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
}

describe('architecture: safety and privacy rules', { timeout: SCAN_TIMEOUT_MS }, () => {
  const offenders = (re: RegExp, allow: (file: string) => boolean = () => false) =>
    FILES.filter((f) => !allow(f))
      .filter((f) => re.test(codeOf(f)))
      .map(rel);

  it('makes no network requests from game code (local-first, no hidden tracking)', () => {
    expect(offenders(/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new WebSocket/)).toEqual(
      [],
    );
  });

  it('never executes strings as code (content is declarative)', () => {
    expect(offenders(/\beval\s*\(|new Function\s*\(/)).toEqual([]);
  });

  it('has no explicit `any` type', () => {
    expect(offenders(/:\s*any\s*(?:[;,)\]=|>]|$)|\bas any\b|<any>/m)).toEqual([]);
  });

  it('has no debug console.log calls', () => {
    expect(offenders(/console\.log\s*\(/)).toEqual([]);
  });

  it('never passes the reflection text to analytics, sync, AI or other infrastructure', () => {
    const suspicious = offenders(/\.reflection\b/).filter((f) =>
      /\/(infrastructure|analytics)|analytics\.ts$/.test(f),
    );
    expect(suspicious).toEqual([]);
  });
});
