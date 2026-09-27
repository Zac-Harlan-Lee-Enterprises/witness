import { describe, expect, it } from 'vitest';
import {
  HELD_BACK_EXPRESSIONS,
  portraitCast,
  speakerExpressions,
  speakerLines,
} from '@/content/portrait-cast';
import type { Chapter } from '@/domain/chapter';
import type { Appearance, Character } from '@/domain/characters';
import type { Expression } from '@/domain/dialogue';

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

/** Just what the cast reads: the chapter's id and number, people, who speaks, and their faces. */
function chapter(
  id: string,
  number: number,
  people: Character[],
  speakers: Array<string | [string, Expression]>,
): Chapter {
  return {
    id,
    number,
    characters: people,
    dialogues: [
      {
        id: `${id}-d`,
        nodes: speakers.map((line, i) => {
          const [speaker, expression] = typeof line === 'string' ? [line, 'neutral'] : line;
          return { id: `n${i}`, speaker, text: '…', expression };
        }),
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

  it('lists the expressions each speaker’s lines carry, in a fixed order, without neutral', () => {
    const ch = chapter(
      'a',
      1,
      [],
      [['ezer', 'angry'], 'ezer', ['ezer', 'glad'], ['ezer', 'angry'], ['miriam', 'neutral']],
    );
    expect(speakerExpressions(ch).get('ezer')).toEqual(['glad', 'angry']);
    expect(speakerExpressions(ch).has('miriam')).toBe(false);
    const { sitters } = portraitCast([
      chapter('a', 1, [person('ezer')], [['ezer', 'sad'], 'ezer']),
    ]);
    expect(sitters[0]?.expressions).toEqual(['sad']);
  });

  it('renders no portrait for a held-back expression; the line keeps its annotation', () => {
    const ch = chapter(
      'a',
      1,
      [person('ezer')],
      [
        ['ezer', 'glad'],
        ['ezer', 'angry'],
        ['ezer', 'surprised'],
        ['ezer', 'afraid'],
      ],
    );
    expect(speakerExpressions(ch).get('ezer')).toEqual(['glad', 'angry', 'surprised', 'afraid']);
    expect(portraitCast([ch]).sitters[0]?.expressions).toEqual(['angry']);
    expect([...HELD_BACK_EXPRESSIONS].sort()).toEqual(['afraid', 'glad', 'surprised']);
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
