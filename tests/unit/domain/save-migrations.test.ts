import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_SAVE_VERSION,
  describeLoadError,
  migrateSave,
  MIGRATIONS,
  SaveGameSchema,
} from '@/domain/save';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../fixtures/saves/${name}`, import.meta.url), 'utf8'));

describe('save migrations', () => {
  it('has a migration for every version below the current one', () => {
    for (let v = 1; v < CURRENT_SAVE_VERSION; v++)
      expect(MIGRATIONS[v], `missing migration from v${v}`).toBeTypeOf('function');
  });

  it('migrates a representative v1 save to the current schema', () => {
    const result = migrateSave(fixture('v1-market.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fromVersion).toBe(1);
    expect(result.save.schemaVersion).toBe(CURRENT_SAVE_VERSION);
    expect(result.save.state.inventory).toEqual({
      remedy: 1,
      letter: 1,
      coins: 3,
      'water-skin': 2,
    });
    expect(result.save.state.player).toEqual({ x: 5, y: 5, facing: 'down' });
    expect(result.save.state.flags['chapter:opened']).toBe(true);
    expect(result.save.savedAt).toBe(new Date(1780000000000).toISOString());
    expect(SaveGameSchema.safeParse(result.save).success).toBe(true);
  });

  it('is idempotent for current-version saves', () => {
    const first = migrateSave(fixture('v1-market.json'));
    if (!first.ok) throw new Error('fixture should migrate');
    const again = migrateSave(first.save);
    expect(again).toEqual({ ok: true, save: first.save, fromVersion: CURRENT_SAVE_VERSION });
  });

  it('reports a v1 save with bad data as a failed migration, not a crash', () => {
    const result = migrateSave(fixture('v1-corrupt-inventory.json'));
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'migration-failed', fromVersion: 1 },
    });
  });

  it('reports the unrelated-JSON fixture as corrupt', () => {
    expect(migrateSave(fixture('garbage.json'))).toMatchObject({
      ok: false,
      error: { kind: 'corrupt' },
    });
  });

  it('refuses saves from a newer version with a helpful message', () => {
    const result = migrateSave(fixture('future-v99.json'));
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'unsupported-version', version: 99 },
    });
    if (!result.ok) expect(describeLoadError(result.error)).toMatch(/newer version/);
  });

  it.each([null, 'text', 42, [], { hello: 'world' }, { schemaVersion: 0 }, { schemaVersion: 1.5 }])(
    'treats %j as corrupt',
    (raw) => {
      const result = migrateSave(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(describeLoadError(result.error)).not.toMatch(/undefined|Error|zod/i);
    },
  );

  it('rejects a current-version save whose state was tampered with', () => {
    const good = migrateSave(fixture('v1-market.json'));
    if (!good.ok) throw new Error('fixture should migrate');
    const tampered = structuredClone(good.save) as unknown as {
      state: { inventory: Record<string, unknown> };
    };
    tampered.state.inventory.coins = -5;
    expect(migrateSave(tampered)).toMatchObject({ ok: false, error: { kind: 'corrupt' } });
  });
});
