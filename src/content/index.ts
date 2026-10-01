import type { ChapterSource } from '@/application/ports';
import { ChapterSchema, type Chapter, type ChapterInput, type ChapterMeta } from '@/domain/chapter';
import { validateChapterIntegrity } from '@/domain/chapter-integrity';

/**
 * A chapter's key art: pre-rendered stills in public/art/key-art/ (rendered
 * by tools/art/build_key_art.py; tests/content/key-art.test.ts checks they
 * exist at these sizes).
 */
function keyArt(id: string, alt: string): NonNullable<ChapterMeta['keyArt']> {
  return {
    src: `art/key-art/${id}.webp`,
    srcSmall: `art/key-art/${id}-800.webp`,
    width: 1600,
    height: 600,
    alt,
  };
}

/**
 * Chapter registry. Each available chapter is a lazy import, so its content
 * (and nothing else) downloads when the player starts it. Future chapters
 * are listed so the menu can show what's coming — they are NOT implemented.
 */
interface RegistryEntry {
  meta: ChapterMeta;
  load?: () => Promise<ChapterInput>;
}

const REGISTRY: RegistryEntry[] = [
  {
    meta: {
      id: 'road-to-jericho',
      number: 1,
      title: 'The Road to Jericho',
      subtitle: 'A journey down from Jerusalem',
      available: true,
      estimatedMinutes: { min: 20, max: 30 },
      keyArt: keyArt(
        'road-to-jericho',
        'A young traveller with a satchel walks alone down the steep road through the Judean wilderness, the gorge falling away beside the road and a bend ahead.',
      ),
      hasTeaser: true,
    },
    load: () => import('./chapters/road-to-jericho').then((m) => m.ROAD_TO_JERICHO),
  },
  {
    meta: {
      id: 'storm-on-galilee',
      number: 2,
      title: 'A Storm on Galilee',
      subtitle: 'One of the other boats',
      available: true,
      estimatedMinutes: { min: 20, max: 30 },
      keyArt: keyArt(
        'storm-on-galilee',
        'Fishing boats on the Sea of Galilee at dusk as a dark squall rolls in over the hills; the crew of the nearest boat shorten sail.',
      ),
    },
    load: () => import('./chapters/storm-on-galilee').then((m) => m.STORM_ON_GALILEE),
  },
  {
    meta: {
      id: 'journey-to-bethlehem',
      number: 3,
      title: 'A Journey to Bethlehem',
      subtitle: 'A crowded night in David’s town',
      available: true,
      estimatedMinutes: { min: 20, max: 30 },
      keyArt: keyArt(
        'journey-to-bethlehem',
        'Inside a crowded Bethlehem house at night: relatives sit among their bundles by lamplight, the animals at the lower end, and a late stranger stands at the door with a lamp.',
      ),
    },
    load: () => import('./chapters/journey-to-bethlehem').then((m) => m.JOURNEY_TO_BETHLEHEM),
  },
  {
    meta: {
      id: 'letter-from-paul',
      number: 4,
      title: 'A Letter from Paul',
      subtitle: 'Carried by hand, read aloud in Colossae',
      available: true,
      estimatedMinutes: { min: 20, max: 30 },
      keyArt: keyArt(
        'letter-from-paul',
        'Lamp-lighting in Philemon’s house at Colossae: people gather round a sealed letter, about to hear it read aloud.',
      ),
    },
    load: () => import('./chapters/letter-from-paul').then((m) => m.LETTER_FROM_PAUL),
  },
];

export class ChapterLoadError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(message);
  }
}

/** Parse + integrity-check raw chapter content. Throws ChapterLoadError with every issue. */
export function parseChapter(input: unknown): Chapter {
  const parsed = ChapterSchema.safeParse(input);
  if (!parsed.success) {
    throw new ChapterLoadError(
      'Chapter content failed schema validation',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    );
  }
  const issues = validateChapterIntegrity(parsed.data);
  if (issues.length > 0) {
    throw new ChapterLoadError(
      'Chapter content failed integrity validation',
      issues.map((i) => `${i.where}: ${i.message}`),
    );
  }
  return parsed.data;
}

export const chapterSource: ChapterSource = {
  list: () => REGISTRY.map((r) => r.meta),
  async load(id: string): Promise<Chapter> {
    const entry = REGISTRY.find((r) => r.meta.id === id);
    if (!entry?.load) throw new ChapterLoadError(`Chapter '${id}' is not available`, []);
    return parseChapter(await entry.load());
  },
};
