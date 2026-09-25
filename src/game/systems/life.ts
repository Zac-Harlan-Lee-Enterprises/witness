import type { Appearance } from '@/domain/characters';
import type { Direction } from '@/domain/state/game-state';
import type { Mood } from '../art/direction';

/**
 * Small rules that make people and places feel alive, as pure functions:
 * who turns to look at you, when people blink, how talking animates, how
 * many passers-by a place has, and when pigeons take off.
 */
export interface Tile {
  x: number;
  y: number;
}

/** People notice you when you come close, and turn to face you. */
export const NOTICE_RADIUS = 2.6;

export function noticesPlayer(npc: Tile, player: { x: number; y: number }): boolean {
  return Math.hypot(npc.x + 0.5 - player.x, npc.y + 0.5 - player.y) <= NOTICE_RADIUS;
}

export function faceToward(from: Tile, to: { x: number; y: number }): Direction {
  const dx = to.x - (from.x + 0.5);
  const dy = to.y - (from.y + 0.5);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** Milliseconds until the next blink (people don't blink in unison). */
export function nextBlinkDelay(r: () => number): number {
  return 2200 + r() * 3600;
}
export const BLINK_MS = 130;

/**
 * Speaking animation: the mouth opens and closes in an uneven rhythm,
 * like syllables, with short pauses. Returns true when the mouth is open.
 */
export function mouthOpen(elapsedMs: number): boolean {
  const beat = Math.floor(elapsedMs / 110);
  const pattern = [1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0];
  return pattern[beat % pattern.length] === 1;
}

/** Passers-by per place (fewer when the device is struggling). */
export function crowdSize(mood: Mood, lowPower: boolean): number {
  const base = mood === 'city' ? 7 : mood === 'oasis' ? 3 : 0;
  return lowPower ? Math.ceil(base / 2) : base;
}

/** An unnamed passer-by: varied but in the same world as the named people. */
export function passerBy(i: number, r: () => number): Appearance {
  const skins = ['#a8734a', '#8d5a3a', '#c08a5e', '#6e4630', '#b98559'];
  const robes = [
    '#8a6a4a',
    '#c9b48a',
    '#6b5a7a',
    '#7a4a32',
    '#e2d4b4',
    '#5f7a4a',
    '#9a5a3a',
    '#4f6a7a',
  ];
  const accents = ['#d9b25f', '#a8322a', '#2f4f86', '#e8dcc0', '#7a3f6e'];
  const headwear = ['wrap', 'scarf', 'veil', 'band', 'none', 'hood'] as const;
  const carries = ['none', 'basket', 'jar', 'bundle', 'none', 'none'] as const;
  const pick = <T>(list: readonly T[], fallback: T): T =>
    list[Math.floor(r() * list.length)] ?? fallback;
  const hw = pick(headwear, 'wrap');
  return {
    skin: pick(skins, '#a8734a'),
    hair: r() > 0.3 ? '#2b1d14' : '#4a3222',
    robe: pick(robes, '#8a6a4a'),
    accent: pick(accents, '#d9b25f'),
    headwear: hw,
    headwearColor: pick(
      ['#e8dcc0', '#c96f3b', '#6b5a7a', '#d8c49a', '#3f6f8f'] as const,
      '#e8dcc0',
    ),
    beard: hw !== 'veil' && hw !== 'scarf' && r() > 0.45,
    build: i % 5 === 3 ? 'child' : i % 7 === 5 ? 'elder' : 'adult',
    carry: pick(carries, 'none'),
  };
}

/**
 * Tiles where passers-by may stand and walk: open ground away from the
 * people you can talk to, things you can examine, exits and spawn points,
 * so they never get in the way of the story.
 */
export function crowdSpots(
  open: (x: number, y: number) => boolean,
  width: number,
  height: number,
  keepClear: readonly Tile[],
  r: () => number,
  count: number,
): Tile[] {
  const candidates: Tile[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (!open(x, y)) continue;
      if (keepClear.some((k) => Math.abs(k.x - x) <= 1 && Math.abs(k.y - y) <= 1)) continue;
      candidates.push({ x, y });
    }
  }
  const spots: Tile[] = [];
  // Spread out: prefer candidates far from the spots already chosen.
  for (let i = 0; i < count * 3 && candidates.length > 0; i++) {
    let best: Tile | null = null;
    let bestScore = -1;
    for (let tries = 0; tries < 12; tries++) {
      const c = candidates[Math.floor(r() * candidates.length)];
      if (!c) continue;
      const d =
        spots.length === 0
          ? 99
          : Math.min(...spots.map((s) => Math.abs(s.x - c.x) + Math.abs(s.y - c.y)));
      if (d > bestScore) {
        best = c;
        bestScore = d;
      }
    }
    if (best && !spots.some((s) => s.x === best.x && s.y === best.y)) spots.push(best);
  }
  return spots;
}

/** Pigeons take off when you walk right up to them. */
export function startles(
  flock: { x: number; y: number },
  player: { x: number; y: number },
): boolean {
  return Math.hypot(flock.x - player.x, flock.y - player.y) < 1.7;
}

/** Which people on screen are no longer in the scene (e.g. someone who left with you). */
export function departed(
  shown: readonly string[],
  present: ReadonlyArray<{ id: string }>,
): string[] {
  const here = new Set(present.map((e) => e.id));
  return shown.filter((id) => !here.has(id));
}
