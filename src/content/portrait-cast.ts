import type { Chapter } from '@/domain/chapter';
import type { Character } from '@/domain/characters';

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
  character: Character;
}

export interface SkippedSitter {
  characterId: string;
  chapterId: string;
  reason: 'biblical figure' | 'never speaks';
}

/** How many dialogue lines each speaker has in a chapter. */
export function speakerLines(chapter: Chapter): Map<string, number> {
  const lines = new Map<string, number>();
  for (const d of chapter.dialogues)
    for (const n of d.nodes) lines.set(n.speaker, (lines.get(n.speaker) ?? 0) + 1);
  return lines;
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
        character,
      });
    }
  }
  return { sitters, skipped };
}
