import { describe, expect, it } from 'vitest';
import { portraitCast, speakerLines } from '@/content/portrait-cast';
import type { Chapter } from '@/domain/chapter';
import type { Appearance, Character } from '@/domain/characters';

const LOOK: Appearance = {
  skin: '#9a6a45',
  hair: '#2a1a10',
  robe: '#556b3a',
  accent: '#e8d49a',
  headwear: 'veil',
  headwearColor: '#efe3c8',
  beard: false,
  build: 'adult',
  carry: 'none',
};

function person(id: string, extra: Partial<Character> = {}): Character {
  return {
    id,
    name: id,
    role: 'someone',
    appearance: LOOK,
    fictional: true,
    biblicalFigure: false,
    ...extra,
  };
}

/** Just what the cast reads: the chapter's id and number, people, and who speaks. */
function chapter(id: string, number: number, people: Character[], speakers: string[]): Chapter {
  return {
    id,
    number,
    characters: people,
    dialogues: [
      {
        id: `${id}-d`,
        nodes: speakers.map((speaker, i) => ({ id: `n${i}`, speaker, text: '…' })),
      },
    ],
  } as unknown as Chapter;
}

describe('portrait cast (who gets a rendered portrait)', () => {
  it('counts the lines each speaker has', () => {
    const lines = speakerLines(chapter('a', 1, [], ['miriam', 'narrator', 'miriam']));
    expect(lines.get('miriam')).toBe(2);
    expect(lines.get('narrator')).toBe(1);
  });

  it('casts everyone who speaks, and leaves out those who never do', () => {
    const { sitters, skipped } = portraitCast([
      chapter('a', 1, [person('miriam'), person('listener')], ['miriam']),
    ]);
    expect(sitters.map((s) => s.portraitId)).toEqual(['miriam']);
    expect(skipped).toEqual([{ characterId: 'listener', chapterId: 'a', reason: 'never speaks' }]);
  });

  it('never casts a biblical figure, even one given lines', () => {
    const { sitters, skipped } = portraitCast([
      chapter('a', 1, [person('philemon', { biblicalFigure: true })], ['philemon']),
    ]);
    expect(sitters).toEqual([]);
    expect(skipped[0]?.reason).toBe('biblical figure');
  });

  it('gives a later chapter’s namesake its own id, keeping the earlier chapter’s', () => {
    const { sitters } = portraitCast([
      // Given out of order: chapters are cast by number.
      chapter('bethlehem', 3, [person('tamar')], ['tamar']),
      chapter('storm', 2, [person('tamar')], ['tamar']),
    ]);
    expect(sitters.map((s) => [s.chapterId, s.characterId, s.portraitId])).toEqual([
      ['storm', 'tamar', 'tamar'],
      ['bethlehem', 'tamar', 'tamar.bethlehem'],
    ]);
  });
});
