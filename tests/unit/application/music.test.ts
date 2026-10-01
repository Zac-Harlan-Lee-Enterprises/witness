import { describe, expect, it } from 'vitest';
import {
  FILM_MOOD_MUSIC,
  filmMusicPlan,
  musicDucked,
  musicWithPanel,
  TRACK_FOR_MUSIC,
  trackFor,
} from '@/application/music';
import { INITIAL_UI_STATE } from '@/application/ui-store';
import { validateChapterIntegrity } from '@/domain/chapter-integrity';
import { MUSIC_TRACK_IDS, musicOf } from '@/domain/music';
import { FILM_MOODS } from '@/domain/teaser';
import { TEASER } from '@/content/chapters/road-to-jericho/teaser';
import { createHarness, flush, loadJericho, Player } from '../../support/harness';

const flag = (name: string) => ({ type: 'flag' as const, flag: name });

describe('which recorded track plays for each mood', () => {
  it("follows the owner's choice for home, journey, tension and reflection", () => {
    expect(TRACK_FOR_MUSIC).toEqual({
      home: 'cinematic-oud-and-qanun',
      journey: 'sacred-sands',
      tension: 'middle-eastern-cinematic-mystery',
      reflection: 'meditative-middle-eastern-flute',
    });
    expect(trackFor('none')).toBeNull();
    expect(new Set(Object.values(TRACK_FOR_MUSIC))).toEqual(new Set(MUSIC_TRACK_IDS));
  });

  it('gives every film mood a track, and silence its silence', () => {
    for (const mood of FILM_MOODS) expect(FILM_MOOD_MUSIC[mood]).toBeDefined();
    expect(FILM_MOOD_MUSIC.silence).toBe('none');
    expect(FILM_MOOD_MUSIC.resolve).toBe('reflection');
  });

  it("cues Chapter 1's teaser: one track per stretch, joined where the track stays the same", () => {
    expect(filmMusicPlan(TEASER.music, TEASER.duration, 0)).toEqual([
      { at: 0, track: 'cinematic-oud-and-qanun', offset: 0 },
      { at: 22, track: 'sacred-sands', offset: 0 },
      { at: 30, track: 'middle-eastern-cinematic-mystery', offset: 0 },
      { at: 44.4, track: null, offset: 0 },
      { at: 50, track: 'meditative-middle-eastern-flute', offset: 0 },
    ]);
  });

  it('picks up part-way into a track when the film resumes in the middle', () => {
    const plan = filmMusicPlan(TEASER.music, TEASER.duration, 25);
    expect(plan[0]).toEqual({ at: 25, track: 'sacred-sands', offset: 3 });
    expect(plan.map((c) => c.at)).toEqual([25, 30, 44.4, 50]);
    expect(filmMusicPlan(TEASER.music, TEASER.duration, 57)).toEqual([]);
  });

  it('plays reflective music under the ending panels and lowers it under dialogue and reading', () => {
    expect(musicWithPanel('journey', null)).toBe('journey');
    expect(musicWithPanel('home', 'scripture-connection')).toBe('reflection');
    expect(musicWithPanel('none', 'summary')).toBe('reflection');
    const ui = { dialogue: null, overlay: null, panel: null };
    expect(musicDucked(ui)).toBe(false);
    expect(musicDucked({ ...ui, overlay: 'journal' })).toBe(true);
    expect(musicDucked({ ...ui, overlay: 'satchel' })).toBe(false);
    expect(musicDucked({ ...ui, panel: 'scripture-connection' })).toBe(true);
    expect(musicDucked({ ...ui, panel: 'reflection' })).toBe(true);
    expect(musicDucked({ ...ui, panel: 'summary' })).toBe(false);
    expect(musicDucked({ ...INITIAL_UI_STATE, dialogue: {} as never })).toBe(true);
  });
});

describe('music driven by the story within a place', () => {
  const scene = {
    music: 'journey' as const,
    musicChanges: [
      { when: flag('wind'), music: 'tension' as const },
      { when: flag('calm'), music: 'reflection' as const, silence: 5 },
    ],
  };
  const state = (flags: Record<string, boolean>) =>
    ({ ...structuredClone(loadJericho().initial), flags }) as unknown as Parameters<
      typeof musicOf
    >[1];

  it('uses the base music until a change applies; the last matching change wins', () => {
    expect(musicOf(scene, state({}))).toEqual({ music: 'journey', silence: 0 });
    expect(musicOf(scene, state({ wind: true }))).toEqual({ music: 'tension', silence: 0 });
    expect(musicOf(scene, state({ wind: true, calm: true }))).toEqual({
      music: 'reflection',
      silence: 5,
    });
  });

  it('rejects a music change that refers to something that does not exist', () => {
    const chapter = structuredClone(loadJericho());
    const house = chapter.scenes.find((s) => s.id === 'miriam-house');
    if (!house) throw new Error('no house');
    house.musicChanges = [{ when: { type: 'hasItem', item: 'no-such-item' }, music: 'tension' }];
    const issues = validateChapterIntegrity(chapter);
    expect(issues.some((i) => i.where.includes('music change 0'))).toBe(true);
  });
});

/** Through the chapter's opening conversation. */
async function endOpening(h: Awaited<ReturnType<typeof createHarness>>): Promise<void> {
  const p = new Player(h);
  await p.choose('c-yes');
  await p.choose('c-go');
  await p.finish();
}

describe('GameController: music', () => {
  type Changes = ReturnType<typeof loadJericho>['scenes'][number]['musicChanges'];
  const withHouseMusic = (changes: Changes) => {
    const chapter = structuredClone(loadJericho());
    const house = chapter.scenes.find((s) => s.id === 'miriam-house');
    if (!house) throw new Error('no house');
    house.musicChanges = changes;
    return chapter;
  };

  it("plays the place's music once on arrival and never asks again for the same", async () => {
    const h = await createHarness();
    expect(h.audio.music).toEqual(['home']);
    expect(h.audio.ambience).toEqual(['indoor']);
    h.session.dispatch([{ type: 'setFlag', flag: 'unrelated', value: true }]);
    h.controller.handleWorldEvent({ type: 'playerMoved', x: 3, y: 5, facing: 'down' });
    await flush();
    expect(h.audio.music).toEqual(['home']);
  });

  it('lowers the music under dialogue and raises it again after', async () => {
    const h = await createHarness();
    // The chapter opens with a conversation.
    expect(h.audio.ducks).toEqual([true]);
    await endOpening(h);
    expect(h.audio.ducks).toEqual([true, false]);
    h.ui.openOverlay('journal');
    h.ui.closeOverlay();
    expect(h.audio.ducks).toEqual([true, false, true, false]);
  });

  it('stops tension when the story changes within the place, after a moment of silence if asked', async () => {
    const h = await createHarness({
      chapter: withHouseMusic([
        { when: flag('storm'), music: 'tension' },
        { when: flag('calm'), music: 'home', silence: 4 },
      ]),
    });
    h.session.dispatch([{ type: 'setFlag', flag: 'storm', value: true }]);
    await flush();
    expect(h.audio.music).toEqual(['home', 'tension']);
    h.session.dispatch([{ type: 'setFlag', flag: 'calm', value: true }]);
    await flush();
    expect(h.audio.music).toEqual(['home', 'tension', ['home', { silence: 4 }]]);
  });

  it("never waits in silence on arrival: a new place's music starts at once", async () => {
    const chapter = structuredClone(loadJericho());
    const market = chapter.scenes.find((s) => s.id === 'jerusalem-market');
    if (!market) throw new Error('no market');
    market.musicChanges = [{ when: flag('uneasy'), music: 'tension', silence: 4 }];
    const h = await createHarness({ chapter });
    h.session.dispatch([{ type: 'setFlag', flag: 'uneasy', value: true }]);
    await flush();
    await endOpening(h);
    await new Player(h).exit('house-door');
    expect(h.world.currentScene).toBe('jerusalem-market');
    expect(h.audio.music).toEqual(['home', 'tension']);
  });

  it("plays reflective music for the ending's panels", async () => {
    const h = await createHarness();
    await endOpening(h);
    h.ui.setPanel('scripture-connection');
    expect(h.audio.music.at(-1)).toBe('reflection');
    expect(h.audio.ducks.at(-1)).toBe(true);
    h.ui.setPanel('summary');
    expect(h.audio.ducks.at(-1)).toBe(false);
    expect(h.audio.music.filter((m) => m === 'reflection')).toHaveLength(1);
  });

  it("stops the place's sounds when the chapter is left", async () => {
    const h = await createHarness();
    h.controller.dispose();
    expect(h.audio.ambience.at(-1)).toBe('none');
    expect(h.audio.ducks.at(-1)).toBe(false);
    h.session.dispatch([{ type: 'setFlag', flag: 'later', value: true }]);
    expect(h.audio.music).toEqual(['home']);
  });
});
