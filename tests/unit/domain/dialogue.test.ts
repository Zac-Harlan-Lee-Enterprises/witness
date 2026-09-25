import { describe, expect, it } from 'vitest';
import {
  continuationOf,
  danglingNodeRefs,
  DialogueError,
  DialogueSchema,
  entryNodeId,
  findNode,
  interpolate,
  visibleChoices,
} from '@/domain/dialogue';
import { makeState } from '../../support/state';

const dialogue = DialogueSchema.parse({
  id: 'd',
  entries: [{ when: { type: 'flag', flag: 'met' }, node: 'again' }],
  start: 'hello',
  nodes: [
    {
      id: 'hello',
      speaker: 'npc',
      text: 'Hello, {player}!',
      choices: [
        { id: 'ask', text: 'Ask', next: 'hello', once: true },
        { id: 'secret', text: 'Secret', when: { type: 'flag', flag: 'knows' } },
        {
          id: 'buy',
          text: 'Buy',
          requires: { type: 'hasItem', item: 'coins', min: 2 },
          unavailableText: 'You need 2 coins.',
        },
        { id: 'bye', text: 'Bye' },
      ],
    },
    {
      id: 'again',
      speaker: 'npc',
      text: 'Back again?',
      branches: [{ when: { type: 'flag', flag: 'vip' }, next: 'vip' }],
      next: 'hello',
    },
    { id: 'vip', speaker: 'npc', text: 'Welcome back!' },
  ],
});

describe('dialogue engine', () => {
  it('chooses the entry node from conditions', () => {
    expect(entryNodeId(dialogue, makeState())).toBe('hello');
    expect(entryNodeId(dialogue, makeState({ flags: { met: true } }))).toBe('again');
  });

  it('hides choices whose `when` fails and shows unavailable ones with a reason', () => {
    const node = findNode(dialogue, 'hello');
    const choices = visibleChoices(dialogue, node, makeState({ inventory: { coins: 1 } }));
    expect(choices.map((c) => c.id)).toEqual(['ask', 'buy', 'bye']);
    expect(choices.find((c) => c.id === 'buy')).toMatchObject({
      available: false,
      unavailableText: 'You need 2 coins.',
    });
  });

  it('hides `once` choices after they were picked', () => {
    const node = findNode(dialogue, 'hello');
    const state = makeState({
      dialogueLog: [{ dialogueId: 'd', nodeId: 'hello', choiceId: 'ask' }],
    });
    expect(visibleChoices(dialogue, node, state).map((c) => c.id)).not.toContain('ask');
  });

  it('follows conditional branches, else `next`, else ends', () => {
    const again = findNode(dialogue, 'again');
    expect(continuationOf(again, makeState({ flags: { vip: true } }))).toBe('vip');
    expect(continuationOf(again, makeState())).toBe('hello');
    expect(continuationOf(findNode(dialogue, 'vip'), makeState())).toBeNull();
  });

  it('reports missing nodes', () => {
    expect(() => findNode(dialogue, 'nope')).toThrow(DialogueError);
    const broken = DialogueSchema.parse({
      id: 'b',
      start: 'x',
      nodes: [{ id: 'y', speaker: 'npc', text: 't', next: 'z' }],
    });
    expect(danglingNodeRefs(broken).sort()).toEqual(['x', 'z']);
  });

  it('interpolates the player name and leaves unknown tokens', () => {
    expect(interpolate('Hi {player}, {unknown}', { player: 'Ari' })).toBe('Hi Ari, {unknown}');
  });
});
