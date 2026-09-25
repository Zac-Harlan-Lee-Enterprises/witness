import { describe, expect, it } from 'vitest';
import { trustLabel } from '@/domain/characters';
import { ALL_EVENT_TYPES, EVENT_OWNERS } from '@/domain/events';
import { checkGuideAnswer } from '@/domain/guide-policy';
import {
  autoUnlockJournal,
  JournalEntrySchema,
  unlockedByCategory,
  unseenCount,
} from '@/domain/journal';
import { approachTiles, facingToward, findPath } from '@/domain/navigation';
import { checkDisplayName } from '@/domain/profile';
import {
  ariaKeyName,
  DEFAULT_SETTINGS,
  keyLabel,
  parseSettings,
  rebindKey,
} from '@/domain/settings';
import { makeState } from '../../support/state';

describe('events', () => {
  it('gives every event type at least one owner in the domain or application layer', () => {
    expect(ALL_EVENT_TYPES.length).toBeGreaterThan(20);
    ALL_EVENT_TYPES.forEach((t) => {
      expect(EVENT_OWNERS[t].length).toBeGreaterThan(0);
      EVENT_OWNERS[t].forEach((owner) => expect(owner).toMatch(/^(domain|application)\//));
    });
  });
});

describe('journal', () => {
  const entries = [
    JournalEntrySchema.parse({
      id: 'a',
      category: 'places',
      title: 'A',
      summary: 's',
      recordIds: ['r'],
      unlockWhen: { type: 'visited', scene: 'x' },
    }),
    JournalEntrySchema.parse({
      id: 'b',
      category: 'people',
      title: 'B',
      summary: 's',
      recordIds: ['r'],
    }),
  ];
  it('auto-unlocks entries when their condition holds', () => {
    const r = autoUnlockJournal(makeState({ visitedScenes: ['x'] }), entries);
    expect(r.state.journal.unlocked).toEqual(['a']);
    expect(r.events).toEqual([{ type: 'JournalEntryUnlocked', entryId: 'a' }]);
    expect(autoUnlockJournal(r.state, entries).events).toEqual([]);
  });
  it('groups unlocked entries and counts unseen ones', () => {
    const s = makeState({ journal: { unlocked: ['a', 'b'], seen: ['b'] } });
    expect(unlockedByCategory(s, entries).places.map((e) => e.id)).toEqual(['a']);
    expect(unseenCount(s)).toBe(1);
  });
});

describe('trust wording', () => {
  it('describes relationships in words, never numbers', () => {
    [-5, -2, -1, 0, 1, 2, 3, 9].forEach((v) => expect(trustLabel(v)).not.toMatch(/\d/));
    expect(trustLabel(2)).toBe('Trusts you');
  });
});

describe('profiles', () => {
  it('accepts nicknames and rejects empty, long or odd names', () => {
    expect(checkDisplayName('  Ari   B ')).toEqual({ ok: true, name: 'Ari B' });
    expect(checkDisplayName('Zoë-María')).toMatchObject({ ok: true });
    expect(checkDisplayName('   ')).toMatchObject({ ok: false });
    expect(checkDisplayName('x'.repeat(21))).toMatchObject({ ok: false });
    expect(checkDisplayName('<script>')).toMatchObject({ ok: false });
  });
});

describe('settings', () => {
  it('falls back field-by-field on corrupt stored settings', () => {
    const parsed = parseSettings({
      ...DEFAULT_SETTINGS,
      textScale: 99,
      highContrast: true,
      font: 'comic-sans',
    });
    expect(parsed.textScale).toBe(DEFAULT_SETTINGS.textScale);
    expect(parsed.font).toBe(DEFAULT_SETTINGS.font);
    expect(parsed.highContrast).toBe(true);
    expect(parseSettings('garbage')).toEqual(DEFAULT_SETTINGS);
  });
  it('rebinding moves a key to exactly one action', () => {
    const b = rebindKey(DEFAULT_SETTINGS.keyBindings, 'journal', 'KeyE');
    expect(b.journal[0]).toBe('KeyE');
    expect(b.interact).not.toContain('KeyE');
    expect(keyLabel('KeyJ')).toBe('J');
    expect(keyLabel('ArrowUp')).toBe('↑');
    // aria-keyshortcuts needs key names, not the on-screen symbols.
    expect(ariaKeyName('ArrowUp')).toBe('ArrowUp');
    expect(ariaKeyName('Escape')).toBe('Escape');
    expect(ariaKeyName('KeyJ')).toBe('J');
    expect(ariaKeyName('Digit2')).toBe('2');
  });
  it('defaults to anonymous analytics OFF', () => {
    expect(DEFAULT_SETTINGS.analyticsConsent).toBe(false);
  });
});

describe('navigation', () => {
  const walls = new Set(['1,0', '1,1']);
  const blocked = (x: number, y: number) =>
    x < 0 || y < 0 || x > 3 || y > 3 || walls.has(`${x},${y}`);
  it('finds the shortest path around walls', () => {
    expect(findPath({ x: 0, y: 0 }, [{ x: 2, y: 0 }], blocked)).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]);
    expect(findPath({ x: 0, y: 0 }, [{ x: 0, y: 0 }], blocked)).toEqual([]);
    expect(findPath({ x: 0, y: 0 }, [{ x: 1, y: 0 }], blocked)).toBeNull();
  });
  it('approaches solid targets from a neighbouring tile', () => {
    expect(approachTiles({ x: 1, y: 1 }, true, blocked)).toEqual(
      expect.arrayContaining([
        { x: 1, y: 2 },
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ]),
    );
    expect(approachTiles({ x: 1, y: 1 }, true, blocked)).toHaveLength(3);
    expect(facingToward({ x: 0, y: 1 }, { x: 1, y: 1 })).toBe('right');
  });
});

describe('future study-guide policy', () => {
  const approved = new Set(['src-web-luk10']);
  it('rejects uncited, unapproved or persona-claiming answers', () => {
    const bad = checkGuideAnswer(
      {
        kind: 'answer',
        text: 'I am Jesus, and I say…',
        category: 'interpretation',
        citations: [{ sourceId: 'blog' }],
        uncertainty: 'low',
        traditionsDiffer: false,
      },
      approved,
    );
    expect(bad.map((v) => v.rule).sort()).toEqual([
      'approved-sources-only',
      'mark-interpretation',
      'no-divine-persona',
    ]);
  });
  it('accepts a cited, labelled answer and any refusal', () => {
    expect(
      checkGuideAnswer(
        {
          kind: 'answer',
          text: 'Luke 10 describes…',
          category: 'scripture',
          citations: [{ sourceId: 'src-web-luk10' }],
          uncertainty: 'low',
          traditionsDiffer: false,
        },
        approved,
      ),
    ).toEqual([]);
    expect(checkGuideAnswer({ kind: 'refusal', reason: 'insufficient-sources' }, approved)).toEqual(
      [],
    );
  });
});
