import { describe, expect, it, vi } from 'vitest';
import { AnalyticsService, minutesBucket, sanitizeAnalyticsEvent } from '@/application/analytics';
import { Autosaver } from '@/application/autosaver';
import type { AnalyticsEvent } from '@/application/ports';
import { MAX_PROFILES, ProfileService } from '@/application/profile-service';
import { SaveService, saveId } from '@/application/save-service';
import { SettingsService } from '@/application/settings-service';
import { UiStore } from '@/application/ui-store';
import { VirtualInput } from '@/application/input';
import { timeOfDayLabel } from '@/application/time-of-day';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import {
  MemoryProfileRepository,
  MemorySaveRepository,
  MemorySettingsRepository,
} from '@/infrastructure/persistence/memory-repositories';
import { createLogger } from '@/shared/logger';
import { TypedEventBus } from '@/shared/event-bus';
import { readFileSync } from 'node:fs';
import { createHarness, flush } from '../../support/harness';

const logger = createLogger({ level: 'error', echo: false });
const clock = { now: () => Date.parse('2026-09-24T12:00:00Z') };

describe('SaveService', () => {
  it('round-trips a save and lists it with a label', async () => {
    const h = await createHarness();
    const repo = new MemorySaveRepository();
    const saves = new SaveService(repo, clock, logger);
    expect(await saves.save('p1', 'manual-1', h.chapter, h.session.state)).toBe(true);
    const { saves: list } = await saves.list('p1');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: saveId('p1', 'manual-1'),
      sceneName: 'Aunt Miriam’s house',
    });
    const loaded = await saves.load(saveId('p1', 'manual-1'));
    expect(loaded.ok && loaded.save.state).toEqual(h.session.state);
  });

  it('migrates old saves on load and writes back the upgraded form', async () => {
    const repo = new MemorySaveRepository();
    const v1 = JSON.parse(
      readFileSync(new URL('../../fixtures/saves/v1-market.json', import.meta.url), 'utf8'),
    );
    repo.records.set(v1.id, v1);
    const saves = new SaveService(repo, clock, logger);
    const result = await saves.load(v1.id);
    expect(result).toMatchObject({ ok: true, fromVersion: 1 });
    expect((repo.records.get(v1.id) as { schemaVersion: number }).schemaVersion).toBe(2);
  });

  it('keeps listing readable saves when one is corrupt', async () => {
    const h = await createHarness();
    const repo = new MemorySaveRepository();
    const saves = new SaveService(repo, clock, logger);
    await saves.save('p1', 'auto', h.chapter, h.session.state);
    repo.records.set('p1:manual-2', {
      id: 'p1:manual-2',
      profileId: 'p1',
      schemaVersion: 2,
      garbage: true,
    });
    const { saves: ok, unreadable } = await saves.list('p1');
    expect(ok).toHaveLength(1);
    expect(unreadable).toEqual([
      { id: 'p1:manual-2', message: expect.stringMatching(/could not be read/) },
    ]);
  });

  it('reports storage failures without throwing', async () => {
    const repo = new MemorySaveRepository();
    repo.put = () => Promise.reject(new Error('QuotaExceededError'));
    repo.getRaw = () => Promise.reject(new Error('InvalidStateError'));
    const h = await createHarness();
    const saves = new SaveService(repo, clock, logger);
    expect(await saves.save('p1', 'auto', h.chapter, h.session.state)).toBe(false);
    expect(await saves.load('x')).toMatchObject({ ok: false });
  });
});

describe('Autosaver', () => {
  it('debounces bursts of SaveRequested into one write and saves immediately on chapter completion', async () => {
    vi.useFakeTimers();
    const h = await createHarness();
    const repo = new MemorySaveRepository();
    const put = vi.spyOn(repo, 'put');
    const bus = h.bus;
    const autosaver = new Autosaver(
      h.session,
      new SaveService(repo, clock, logger),
      'p1',
      bus,
      () => undefined,
      500,
    );
    bus.emit({ type: 'SaveRequested', reason: 'scene-change' });
    bus.emit({ type: 'SaveRequested', reason: 'quest-progress' });
    bus.emit({ type: 'SaveRequested', reason: 'puzzle' });
    expect(put).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(put).toHaveBeenCalledTimes(1);
    bus.emit({ type: 'SaveRequested', reason: 'chapter-complete' });
    await vi.advanceTimersByTimeAsync(0);
    expect(put).toHaveBeenCalledTimes(2);
    autosaver.dispose();
    vi.useRealTimers();
  });
});

describe('ProfileService', () => {
  const make = () => {
    const saves = new MemorySaveRepository();
    return {
      saves,
      service: new ProfileService(new MemoryProfileRepository(), saves, clock, logger),
    };
  };
  it('creates, lists, renames and removes profiles (with their saves)', async () => {
    const { service, saves } = make();
    const created = await service.create('Ari', 'look-2');
    if (!created.ok) throw new Error(created.reason);
    expect((await service.list()).map((p) => p.displayName)).toEqual(['Ari']);
    expect(await service.create('ari', 'look-1')).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/already exists/),
    });
    const renamed = await service.rename(created.profile, 'Ari B');
    expect(renamed).toMatchObject({ ok: true });
    saves.records.set(`${created.profile.id}:auto`, { profileId: created.profile.id });
    await service.remove(created.profile.id);
    expect(await service.list()).toEqual([]);
    expect(saves.records.size).toBe(0);
  });
  it('caps the number of profiles on one device', async () => {
    const { service } = make();
    for (let i = 0; i < MAX_PROFILES; i++) await service.create(`Kid ${i}`, 'look-1');
    expect(await service.create('One more', 'look-1')).toMatchObject({ ok: false });
  });
  it('marks chapters complete once', async () => {
    const { service } = make();
    const r = await service.create('Sam', 'look-3');
    if (!r.ok) throw new Error('create failed');
    const p1 = await service.markChapterComplete(r.profile, 'road-to-jericho');
    const p2 = await service.markChapterComplete(p1, 'road-to-jericho');
    expect(p2.completedChapters).toEqual(['road-to-jericho']);
  });
});

describe('SettingsService', () => {
  it('loads defaults, persists updates and reports accessibility features used', async () => {
    const repo = new MemorySettingsRepository();
    const features: string[] = [];
    const service = new SettingsService(repo, logger, (f) => features.push(f));
    await service.load();
    expect(service.current).toEqual(DEFAULT_SETTINGS);
    await service.update({ highContrast: true, font: 'dyslexic', reducedMotion: 'on' });
    expect(repo.value).toMatchObject({ highContrast: true, font: 'dyslexic' });
    expect(features).toEqual(['high-contrast', 'font-dyslexic', 'reduced-motion']);
  });
  it('recovers from corrupt stored settings', async () => {
    const repo = new MemorySettingsRepository();
    repo.value = { textScale: 'huge', captions: false };
    const service = new SettingsService(repo, logger);
    await service.load();
    expect(service.current.textScale).toBe(1);
    expect(service.current.captions).toBe(false);
  });
});

describe('Analytics', () => {
  it('sends nothing without consent', () => {
    const sent: AnalyticsEvent[] = [];
    const service = new AnalyticsService({ name: 't', track: (e) => sent.push(e) }, () => false);
    service.track({ name: 'ChapterStarted', props: { chapterId: 'road-to-jericho' } });
    expect(sent).toEqual([]);
  });
  it('strips anything outside the whitelist and blocks free text', () => {
    expect(
      sanitizeAnalyticsEvent({
        name: 'PuzzleCompleted',
        props: { puzzleId: 'p-route', attempts: 2, hintsUsed: 1, reflection: 'my secret' },
      } as unknown as AnalyticsEvent),
    ).toEqual({
      name: 'PuzzleCompleted',
      props: { puzzleId: 'p-route', attempts: 2, hintsUsed: 1 },
    });
    expect(
      sanitizeAnalyticsEvent({
        name: 'ChapterStarted',
        props: { chapterId: 'I felt scared on the road' },
      }),
    ).toBeNull();
    expect(minutesBucket(22 * 60_000)).toBe('15-25');
  });
  it('never includes the reflection text even when the whole chapter is played with consent', async () => {
    const h = await createHarness({ analyticsConsent: true });
    h.session.setReflection('A very private thought');
    h.session.dispatch([{ type: 'completeChapter' }]);
    await flush();
    expect(JSON.stringify(h.analytics)).not.toMatch(/private thought/);
    expect(h.analytics.some((e) => e.name === 'ChapterCompleted')).toBe(true);
  });
});

describe('UiStore and input', () => {
  it('only allows exploration when nothing modal is open', () => {
    const ui = new UiStore();
    expect(ui.explorationAllowed).toBe(true);
    ui.openOverlay('journal');
    expect(ui.explorationAllowed).toBe(false);
    ui.closeOverlay();
    ui.setPuzzle('p');
    expect(ui.explorationAllowed).toBe(false);
  });
  it('keeps at most a few toasts', () => {
    const ui = new UiStore();
    for (let i = 0; i < 10; i++) ui.pushToast(`t${i}`, 'info', 'x');
    expect(ui.getState().toasts.map((t) => t.text)).toEqual(['t6', 't7', 't8', 't9']);
  });
  it('merges devices and fires edge actions once', () => {
    const input = new VirtualInput();
    const actions: string[] = [];
    input.onAction((a) => actions.push(a));
    input.press('keyboard', 'right');
    input.press('touch', 'right');
    input.press('gamepad', 'up');
    expect(input.direction()).toEqual({ dx: 1, dy: -1 });
    expect(actions).toEqual(['right', 'up']);
    input.releaseAll('keyboard');
    expect(input.isActive('right')).toBe(true);
  });
  it('labels time of day in words', () => {
    expect([6, 10, 12, 14, 17, 18, 21].map(timeOfDayLabel)).toEqual([
      'Early morning',
      'Morning',
      'Midday',
      'Afternoon',
      'Late afternoon',
      'Sunset',
      'Night',
    ]);
  });
});

describe('TypedEventBus', () => {
  it('isolates a throwing handler from the others', () => {
    const errors: unknown[] = [];
    const bus = new TypedEventBus<{ type: 'A' } | { type: 'B'; n: number }>((e) => errors.push(e));
    const seen: string[] = [];
    bus.on('A', () => {
      throw new Error('boom');
    });
    bus.on('A', () => seen.push('a'));
    const off = bus.on('B', (e) => seen.push(`b${e.n}`));
    bus.emit({ type: 'A' });
    bus.emit({ type: 'B', n: 1 });
    off();
    bus.emit({ type: 'B', n: 2 });
    expect(seen).toEqual(['a', 'b1']);
    expect(errors).toHaveLength(1);
  });
});
