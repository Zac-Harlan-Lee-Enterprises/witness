/**
 * Export what the offline art build needs from every available chapter —
 * each scene's tile map, legend, mood and entities (with the poses and story
 * marks their looks can show), every character's appearance and where they
 * appear, the player looks and the marks the player can carry — as JSON that
 * Blender's Python can read (tools/art/data/chapter.json).
 *
 *   npx tsx scripts/export-art-data.ts        (npm run art:data)
 */
import { writeFileSync } from 'node:fs';
import { chapterSource } from '../src/content';
import type { Chapter } from '../src/domain/chapter';
import { PLAYER_APPEARANCES, type Appearance } from '../src/domain/characters';
import { rng } from '../src/game/art/paint';
import { appearanceKey } from '../src/game/prerendered/select';
import { crowdSize, passerBy } from '../src/game/systems/life';
import { naturalColor, naturalSkin } from '../src/shared/color';

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

const unique = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

const chapters: Chapter[] = [];
for (const meta of chapterSource.list().filter((m) => m.available))
  chapters.push(await chapterSource.load(meta.id));

type Scene = Chapter['scenes'][number];
type Entity = Scene['entities'][number];

function entityOut(e: Entity) {
  return {
    id: e.id,
    kind: e.kind,
    x: e.x,
    y: e.y,
    facing: e.facing,
    characterId: e.characterId ?? null,
    sprite: e.sprite ?? null,
    solid: e.solid,
    pose: e.pose,
    /** Shown only while a story condition holds: its shadow must not be baked into the ground. */
    conditional: e.visibleWhen !== undefined,
    /** Every pose and mark the entity's looks can show. */
    poses: unique([e.pose, ...e.looks.flatMap((l) => (l.pose ? [l.pose] : []))]),
    marks: unique(e.looks.flatMap((l) => l.marks)),
  };
}

const scenes = chapters.flatMap((c) =>
  c.scenes.map((s) => ({
    id: s.id,
    chapter: c.id,
    name: s.name,
    kind: s.kind,
    mood: s.mood ?? null,
    layout: s.layout,
    legend: s.legend,
    baseTile: s.baseTile,
    /** Passers-by walk here (see crowdSize), so their sheets are needed. */
    crowd: s.mood !== undefined && crowdSize(s.mood, false) > 0,
    entities: s.entities.map(entityOut),
    exits: s.exits.map((x) => ({ id: x.id, x: x.x, y: x.y, w: x.w, h: x.h, to: x.to.scene })),
    spawns: s.spawns,
  })),
);

const characters = chapters.flatMap((c) =>
  c.characters.map((ch) => ({
    id: ch.id,
    chapter: c.id,
    key: appearanceKey(ch.appearance),
    appearance: dyed(ch.appearance),
    /** Where they appear, and every pose and mark they can show there. */
    appears: c.scenes.flatMap((s) =>
      s.entities
        .filter((e) => e.characterId === ch.id)
        .map((e) => {
          const out = entityOut(e);
          return { scene: s.id, entity: e.id, poses: out.poses, marks: out.marks };
        }),
    ),
  })),
);

/** Passers-by for places with pre-rendered people: a fixed, seeded set. */
const crowdRandom = rng(1234);
const crowd = [0, 1, 2, 4].map((i, n) => {
  const a = passerBy(i, crowdRandom);
  return { id: `crowd-${n}`, key: appearanceKey(a), appearance: dyed(a) };
});

const data = {
  chapters: chapters.map((c) => ({
    id: c.id,
    scenes: c.scenes.map((s) => s.id),
    /** Marks the player can carry in this chapter (what they pack, what they give away). */
    playerMarks: unique(c.playerLooks.flatMap((l) => l.marks)),
  })),
  characters,
  players: Object.entries(PLAYER_APPEARANCES).map(([id, a]) => ({
    id,
    key: appearanceKey(a),
    appearance: dyed(a),
  })),
  crowd,
  scenes,
};
writeFileSync('tools/art/data/chapter.json', JSON.stringify(data, null, 2) + '\n');
console.log(
  `wrote tools/art/data/chapter.json (${chapters.length} chapters, ${scenes.length} scenes, ${characters.length} characters)`,
);
