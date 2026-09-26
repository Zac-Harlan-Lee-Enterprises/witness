/**
 * Export what the offline art build needs from the chapter — every
 * character's appearance, the player looks, and the market map — as JSON
 * that Blender's Python can read (tools/art/data/chapter.json).
 *
 *   npx tsx scripts/export-art-data.ts
 */
import { writeFileSync } from 'node:fs';
import { parseChapter } from '../src/content';
import { ROAD_TO_JERICHO } from '../src/content/chapters/road-to-jericho';
import { PLAYER_APPEARANCES } from '../src/domain/characters';
import { rng } from '../src/game/art/paint';
import { appearanceKey } from '../src/game/prerendered/select';
import { passerBy } from '../src/game/systems/life';
import { naturalColor, naturalSkin } from '../src/shared/color';

const chapter = parseChapter(ROAD_TO_JERICHO);

/** Colours as the world shows them: authored colours softened toward natural dyes. */
function dyed(a: (typeof chapter.characters)[number]['appearance']) {
  return {
    ...a,
    skin: naturalSkin(a.skin),
    robe: naturalColor(a.robe),
    accent: naturalColor(a.accent),
    headwearColor: naturalColor(a.headwearColor),
  };
}

const scenes = chapter.scenes
  .filter((s) => s.id === 'jerusalem-market')
  .map((s) => ({
    id: s.id,
    layout: s.layout,
    legend: s.legend,
    baseTile: s.baseTile,
    entities: s.entities.map((e) => ({
      id: e.id,
      kind: e.kind,
      x: e.x,
      y: e.y,
      facing: e.facing,
      characterId: e.characterId ?? null,
      sprite: e.sprite ?? null,
      solid: e.solid,
    })),
  }));

/** Passers-by for places with pre-rendered people: a fixed, seeded set. */
const crowdRandom = rng(1234);
const crowd = [0, 1, 2, 4].map((i, n) => {
  const a = passerBy(i, crowdRandom);
  return { id: `crowd-${n}`, key: appearanceKey(a), appearance: dyed(a) };
});

const data = {
  characters: chapter.characters.map((c) => ({
    id: c.id,
    key: appearanceKey(c.appearance),
    appearance: dyed(c.appearance),
  })),
  players: Object.entries(PLAYER_APPEARANCES).map(([id, a]) => ({
    id,
    key: appearanceKey(a),
    appearance: dyed(a),
  })),
  crowd,
  scenes,
};
writeFileSync('tools/art/data/chapter.json', JSON.stringify(data, null, 2) + '\n');
console.log(`wrote tools/art/data/chapter.json (${data.characters.length} characters)`);
