import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MUSIC_LICENSE, MUSIC_TRACK_IDS, MUSIC_TRACKS, musicOf } from '@/domain/music';
import type { GameState } from '@/domain/state/game-state';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { STORM_ON_GALILEE } from '@/content/chapters/storm-on-galilee';
import type { ChapterInput } from '@/domain/chapter';
import { loadChapter } from '../support/harness';

const PUBLIC = join(__dirname, '../../public');
const MUSIC_DIR = join(PUBLIC, 'audio/music');

interface Sources {
  license: string;
  licenseSummaryUrl: string;
  termsUrl: string;
  notes: string[];
  tracks: Array<{
    file: string;
    title: string;
    artist: string;
    source: string;
    bytes: number;
    sha256: string;
  }>;
}

const sources = JSON.parse(readFileSync(join(MUSIC_DIR, 'music-sources.json'), 'utf8')) as Sources;

describe('the recorded music and its provenance (public/audio/music/music-sources.json)', () => {
  it('has every file it lists, byte for byte as downloaded (size and SHA-256)', () => {
    expect(sources.tracks).toHaveLength(4);
    for (const t of sources.tracks) {
      const file = join(MUSIC_DIR, t.file);
      expect(statSync(file).size, t.file).toBe(t.bytes);
      const sha = createHash('sha256').update(readFileSync(file)).digest('hex');
      expect(sha, t.file).toBe(t.sha256);
    }
  });

  it('lists every music file there is (nothing unrecorded ships)', () => {
    const files = readdirSync(MUSIC_DIR).filter((f) => f !== 'music-sources.json');
    expect(files.sort()).toEqual(sources.tracks.map((t) => t.file).sort());
  });

  it('keeps its licence notes', () => {
    expect(sources.license).toBe(MUSIC_LICENSE.name);
    expect(sources.licenseSummaryUrl).toBe(MUSIC_LICENSE.summaryUrl);
    expect(sources.termsUrl).toBe(MUSIC_LICENSE.termsUrl);
    expect(sources.notes.join(' ')).toMatch(/Do not redistribute as standalone music/);
  });

  it("matches the game's catalogue and credits: file, title, artist, source and version", () => {
    for (const id of MUSIC_TRACK_IDS) {
      const track = MUSIC_TRACKS[id];
      const recorded = sources.tracks.find((t) => `audio/music/${t.file}` === track.file);
      expect(recorded, id).toBeDefined();
      expect(track.title).toBe(recorded?.title);
      expect(track.artist).toBe(recorded?.artist);
      expect(track.source).toBe(recorded?.source);
      expect(recorded?.sha256.startsWith(track.version), id).toBe(true);
    }
  });

  it('loops each track inside the file', () => {
    for (const id of MUSIC_TRACK_IDS) {
      const { loop } = MUSIC_TRACKS[id];
      expect(loop.start).toBeGreaterThanOrEqual(0);
      expect(loop.end - loop.start).toBeGreaterThan(60);
    }
  });
});

describe('music that follows the story', () => {
  const sceneOf = (input: ChapterInput, id: string) => {
    const scene = loadChapter(input).scenes.find((s) => s.id === id);
    if (!scene) throw new Error(`no ${id}`);
    return scene;
  };
  const at = (input: ChapterInput, flags: Record<string, boolean>, choice?: string): GameState =>
    ({
      ...structuredClone(loadChapter(input).initial),
      flags,
      choices: choice ? [{ choiceId: choice, optionId: 'any', sceneId: 'x', atMs: 0 }] : [],
    }) as unknown as GameState;

  it("Galilee: travelling music, tension when the wind rises, and silence before the calm's quiet music", () => {
    const lake = sceneOf(STORM_ON_GALILEE, 'open-lake');
    const id = STORM_ON_GALILEE;
    expect(musicOf(lake, at(id, {})).music).toBe('journey');
    expect(musicOf(lake, at(id, { 'wind-rising': true })).music).toBe('tension');
    expect(musicOf(lake, at(id, { 'wind-rising': true, 'storm-broke': true })).music).toBe(
      'tension',
    );
    const calm = musicOf(
      lake,
      at(id, { 'wind-rising': true, 'storm-broke': true, 'great-calm': true }),
    );
    expect(calm.music).toBe('reflection');
    expect(calm.silence).toBeGreaterThanOrEqual(3);
  });

  it('Jericho road: tension from finding the man until you have chosen what to do', () => {
    const road = sceneOf(ROAD_TO_JERICHO, 'jericho-road');
    const id = ROAD_TO_JERICHO;
    expect(musicOf(road, at(id, {})).music).toBe('journey');
    expect(musicOf(road, at(id, { 'incident-seen': true })).music).toBe('tension');
    expect(musicOf(road, at(id, { 'incident-seen': true }, 'choice-traveler')).music).toBe(
      'journey',
    );
  });
});
