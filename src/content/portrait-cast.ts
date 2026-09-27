import type { Chapter } from '@/domain/chapter';
import type { Character } from '@/domain/characters';
import { EXPRESSIONS, type Expression } from '@/domain/dialogue';

/**
 * Who gets a rendered portrait (tools/art/build_portraits.py), and under
 * which portrait id.
 *
 * Everyone who speaks a line in a chapter's dialogue gets one, except
 * biblical figures: they are never shown in close-up. Characters who never
 * speak are left out (their portrait would never be shown).
 *
 * A character id is unique within a chapter but not across chapters (two
 * chapters may each have a Tamar). The earliest chapter keeps the plain id;
 * a later chapter's character with the same id gets `<id>.<chapter id>`.
 * The game finds either by the speaker's id and appearance
 * (src/features/portraits/portrait-art.ts).
 */
export interface PortraitSitter {
  /** The portrait's id: file names and the manifest key. */
  portraitId: string;
  characterId: string;
  chapterId: string;
  chapterNumber: number;
  /** Lines the character speaks in the chapter. */
  lines: number;
  /**
   * The expressions (other than neutral) their lines carry, in EXPRESSIONS
   * order, less those held back: each needs a portrait.
   */
  expressions: Expression[];
  character: Character;
}

export interface SkippedSitter {
  characterId: string;
  chapterId: string;
  reason: 'biblical figure' | 'never speaks';
}

/**
 * Expressions whose portraits are held back until they are reworked: the
 * first MakeHuman renders of them read as strained grins (glad) and
 * denture-like open mouths (surprised, afraid). Lines keep these
 * annotations, and their speakers show their neutral portrait meanwhile.
 */
export const HELD_BACK_EXPRESSIONS: ReadonlySet<Expression> = new Set([
  'glad',
  'surprised',
  'afraid',
]);

/** How many dialogue lines each speaker has in a chapter. */
export function speakerLines(chapter: Chapter): Map<string, number> {
  const lines = new Map<string, number>();
  for (const d of chapter.dialogues)
    for (const n of d.nodes) lines.set(n.speaker, (lines.get(n.speaker) ?? 0) + 1);
  return lines;
}

/** The expressions other than neutral each speaker's lines carry in a chapter. */
export function speakerExpressions(chapter: Chapter): Map<string, Expression[]> {
  const used = new Map<string, Set<Expression>>();
  for (const d of chapter.dialogues)
    for (const n of d.nodes) {
      if (n.expression === 'neutral') continue;
      const set = used.get(n.speaker) ?? new Set<Expression>();
      set.add(n.expression);
      used.set(n.speaker, set);
    }
  return new Map(
    [...used].map(([speaker, set]) => [speaker, EXPRESSIONS.filter((e) => set.has(e))]),
  );
}

export function portraitCast(chapters: readonly Chapter[]): {
  sitters: PortraitSitter[];
  skipped: SkippedSitter[];
} {
  const sitters: PortraitSitter[] = [];
  const skipped: SkippedSitter[] = [];
  const taken = new Set<string>();
  for (const chapter of [...chapters].sort((a, b) => a.number - b.number)) {
    const lines = speakerLines(chapter);
    const expressions = speakerExpressions(chapter);
    for (const character of chapter.characters) {
      const spoken = lines.get(character.id) ?? 0;
      if (character.biblicalFigure) {
        skipped.push({
          characterId: character.id,
          chapterId: chapter.id,
          reason: 'biblical figure',
        });
        continue;
      }
      if (spoken === 0) {
        skipped.push({ characterId: character.id, chapterId: chapter.id, reason: 'never speaks' });
        continue;
      }
      const portraitId = taken.has(character.id) ? `${character.id}.${chapter.id}` : character.id;
      taken.add(portraitId);
      sitters.push({
        portraitId,
        characterId: character.id,
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        lines: spoken,
        expressions: (expressions.get(character.id) ?? []).filter(
          (e) => !HELD_BACK_EXPRESSIONS.has(e),
        ),
        character,
      });
    }
  }
  return { sitters, skipped };
}
