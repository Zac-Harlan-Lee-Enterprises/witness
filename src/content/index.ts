import type { ChapterSource } from '@/application/ports';
import { ChapterSchema, type Chapter, type ChapterInput, type ChapterMeta } from '@/domain/chapter';
import { validateChapterIntegrity } from '@/domain/chapter-integrity';

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
    },
    load: () => import('./chapters/road-to-jericho').then((m) => m.ROAD_TO_JERICHO),
  },
  {
    meta: {
      id: 'storm-on-galilee',
      number: 2,
      title: 'A Storm on Galilee',
      subtitle: 'Coming later',
      available: false,
      estimatedMinutes: null,
    },
  },
  {
    meta: {
      id: 'journey-to-bethlehem',
      number: 3,
      title: 'A Journey to Bethlehem',
      subtitle: 'Coming later',
      available: false,
      estimatedMinutes: null,
    },
  },
  {
    meta: {
      id: 'letter-from-paul',
      number: 4,
      title: 'A Letter from Paul',
      subtitle: 'Coming later',
      available: false,
      estimatedMinutes: null,
    },
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
