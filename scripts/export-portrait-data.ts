/**
 * Export who needs a rendered portrait, from every available chapter, for the
 * offline portrait build (tools/art/build_portraits.py reads
 * tools/art/data/portrait-people.json):
 *
 * - every character who speaks in a chapter (src/content/portrait-cast.ts;
 *   biblical figures never get a close-up), with their name, role and how
 *   many lines they speak, so the build can cast them;
 * - every player look.
 *
 *   npm run art:portrait-data
 */
import { writeFileSync } from 'node:fs';
import { chapterSource } from '../src/content';
import { portraitCast } from '../src/content/portrait-cast';
import { appearanceKey } from '../src/domain/appearance-key';
import { PLAYER_APPEARANCES, type Appearance } from '../src/domain/characters';
import { naturalColor, naturalSkin } from '../src/shared/color';

const OUT = 'tools/art/data/portrait-people.json';

/** Colours as the world shows them: authored colours softened toward natural dyes. */
function dyed(a: Appearance): Appearance {
  return {
    ...a,
    skin: naturalSkin(a.skin),
    robe: naturalColor(a.robe),
    accent: naturalColor(a.accent),
    headwearColor: naturalColor(a.headwearColor),
  };
}

const chapters = await Promise.all(
  chapterSource
    .list()
    .filter((m) => m.available)
    .map((m) => chapterSource.load(m.id)),
);
const { sitters, skipped } = portraitCast(chapters);

const data = {
  chapters: chapters
    .map((c) => ({ id: c.id, number: c.number, title: c.title }))
    .sort((a, b) => a.number - b.number),
  characters: sitters.map((s) => ({
    id: s.portraitId,
    character: s.characterId,
    chapter: s.chapterId,
    name: s.character.name,
    role: s.character.role,
    lines: s.lines,
    key: appearanceKey(s.character.appearance),
    appearance: dyed(s.character.appearance),
  })),
  players: Object.entries(PLAYER_APPEARANCES).map(([id, a]) => ({
    id,
    key: appearanceKey(a),
    appearance: dyed(a),
  })),
  skipped: skipped.map((s) => ({
    character: s.characterId,
    chapter: s.chapterId,
    reason: s.reason,
  })),
};
writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
console.log(
  `wrote ${OUT}: ${data.characters.length} characters in ${data.chapters.length} chapters, ` +
    `${data.players.length} player looks (${skipped.length} characters without a portrait)`,
);
