import type Phaser from 'phaser';
import type { Logger } from '@/shared/logger';
import {
  LIGHTING_VARIANTS,
  parsePeopleArt,
  parsePlaceArt,
  type LightingVariant,
  type PeopleArt,
  type PersonSheet,
  type PlaceArt,
} from './manifest';
import { PEOPLE_ART, variantFor, wantsLowResolution, type ShadeMask } from './select';

/**
 * Loads pre-rendered art through Phaser's loader (static files under the
 * site base, precached by the service worker). Any failure resolves to
 * null and the world falls back to painting the place itself.
 */
export interface PlaceTextures {
  art: PlaceArt;
  variant: LightingVariant;
  /** Pixels per game unit of the loaded ground texture. */
  groundPpu: number;
  ground: string;
  pages: string[];
  shade: ShadeMask | null;
}

const BASE = import.meta.env.BASE_URL;

function run(scene: Phaser.Scene, queue: () => void): Promise<string[]> {
  return new Promise((resolve) => {
    const failed: string[] = [];
    const onError = (file: Phaser.Loader.File): void => {
      failed.push(file.key);
    };
    scene.load.on('loaderror', onError);
    scene.load.once('complete', () => {
      scene.load.off('loaderror', onError);
      resolve(failed);
    });
    queue();
    scene.load.start();
  });
}

async function json(scene: Phaser.Scene, key: string, url: string): Promise<unknown> {
  if (!scene.cache.json.exists(key)) {
    const failed = await run(scene, () => scene.load.json(key, url));
    if (failed.length > 0) return null;
  }
  return scene.cache.json.get(key) as unknown;
}

async function images(scene: Phaser.Scene, files: Array<[string, string]>): Promise<boolean> {
  const todo = files.filter(([key]) => !scene.textures.exists(key));
  if (todo.length === 0) return true;
  const failed = await run(scene, () => todo.forEach(([key, url]) => scene.load.image(key, url)));
  return failed.length === 0;
}

function readShade(scene: Phaser.Scene, key: string): ShadeMask | null {
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0) return null;
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return { width: canvas.width, height: canvas.height, data };
}

export async function loadPlace(
  scene: Phaser.Scene,
  sceneId: string,
  path: string,
  options: { hour: number | null; zoom: number; lowPower: boolean },
  logger: Logger,
): Promise<PlaceTextures | null> {
  const raw = await json(scene, `art:${sceneId}:manifest`, `${BASE}${path}manifest.json`);
  if (raw === null) {
    logger.warn(`No pre-rendered art for ${sceneId}; painting it instead`);
    return null;
  }
  const { art, error } = parsePlaceArt(raw);
  if (!art) {
    logger.warn(
      `Pre-rendered art for ${sceneId} is invalid (${error ?? 'unknown'}); painting it instead`,
    );
    return null;
  }
  const available = LIGHTING_VARIANTS.filter((v) => art.variants[v] !== undefined);
  const variant = variantFor(options.hour, available);
  const v = art.variants[variant] ?? art.variants.day;
  const low = wantsLowResolution(options.zoom, art.ppu, options.lowPower);
  const prefix = `art:${sceneId}:${variant}`;
  const ground = `${prefix}:ground${low ? '-low' : ''}`;
  const shadeKey = `${prefix}:shade`;
  const pages = v.pages.map((_, i) => `${prefix}:page${i}`);
  const ok = await images(scene, [
    [ground, `${BASE}${path}${low ? v.groundLow : v.ground}`],
    [shadeKey, `${BASE}${path}${v.shade}`],
    ...v.pages.map((file, i): [string, string] => [pages[i] as string, `${BASE}${path}${file}`]),
  ]);
  if (!ok) {
    logger.warn(`Pre-rendered art for ${sceneId} failed to load; painting it instead`);
    return null;
  }
  return {
    art,
    variant,
    groundPpu: low ? art.ppu / 2 : art.ppu,
    ground,
    pages,
    shade: readShade(scene, shadeKey),
  };
}

let people: PeopleArt | null | undefined;

/** The people manifest (loaded once per session; null if there is none). */
export async function loadPeople(scene: Phaser.Scene, logger: Logger): Promise<PeopleArt | null> {
  if (people !== undefined) return people;
  const raw = await json(scene, 'art:people', `${BASE}${PEOPLE_ART}people.json`);
  const parsed = raw === null ? { people: null, error: 'missing' } : parsePeopleArt(raw);
  if (!parsed.people) logger.warn(`Pre-rendered people unavailable (${parsed.error ?? 'unknown'})`);
  people = parsed.people;
  return people;
}

/** Load (once) a person's sheet and shadow sheet for a lighting variant, with frames named. */
export async function loadPerson(
  scene: Phaser.Scene,
  art: PeopleArt,
  id: string,
  variant: LightingVariant,
): Promise<{ key: string; shadow: string } | null> {
  const sheet = art[id];
  if (!sheet) return null;
  const v = sheet.sheets[variant] ? variant : 'day';
  const file = sheet.sheets[v];
  const shadow = sheet.shadows[v] ?? sheet.shadows.day;
  if (!file) return null;
  const key = `person:${id}:${v}`;
  const shadowKey = `person:${id}:${v}:shadow`;
  const ok = await images(scene, [
    [key, `${BASE}${PEOPLE_ART}${file}`],
    [shadowKey, `${BASE}${PEOPLE_ART}${shadow.sheet}`],
  ]);
  if (!ok) return null;
  frames(scene.textures.get(key), sheet, sheet.atlas[file], sheet.frameWidth, sheet.frameHeight);
  frames(
    scene.textures.get(shadowKey),
    sheet,
    sheet.atlas[shadow.sheet],
    shadow.frameWidth,
    shadow.frameHeight,
  );
  return { key, shadow: shadowKey };
}

/** Name a sheet's frames: trimmed frames from its atlas table, or a plain grid. */
function frames(
  tex: Phaser.Textures.Texture,
  sheet: PersonSheet,
  packed: PersonSheet['atlas'][string] | undefined,
  fw: number,
  fh: number,
): void {
  if (!packed) {
    nameFrames(tex, sheet.rows, sheet.columns.length, sheet.turns, fw, fh);
    return;
  }
  for (const [name, [x, y, w, h, ox, oy]] of Object.entries(packed)) {
    if (tex.has(name)) continue;
    // Restored to the full frame size, so origins and positions are unchanged.
    tex.add(name, 0, x, y, w, h)?.setTrim(fw, fh, ox, oy, w, h);
  }
}

function nameFrames(
  tex: Phaser.Textures.Texture,
  rows: readonly string[],
  columns: number,
  turns: readonly string[],
  fw: number,
  fh: number,
): void {
  if (tex.has(`${rows[0] ?? 'down'}-0`)) return;
  rows.forEach((row, r) => {
    for (let c = 0; c < columns; c++) tex.add(`${row}-${c}`, 0, c * fw, r * fh, fw, fh);
  });
  turns.forEach((turn, c) => tex.add(`turn-${turn}`, 0, c * fw, rows.length * fh, fw, fh));
}
