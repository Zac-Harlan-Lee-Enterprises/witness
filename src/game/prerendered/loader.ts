import type Phaser from 'phaser';
import type { Logger } from '@/shared/logger';
import {
  LIGHTING_VARIANTS,
  parsePeopleArt,
  parsePlaceArt,
  type LightingVariant,
  type PeopleArt,
  type PeopleLight,
  type PersonSheet,
  type PlaceArt,
} from './manifest';
import {
  pagesFor,
  PEOPLE_ART,
  peopleLightFor,
  tileOrigin,
  variantFor,
  wantsLowResolution,
  type ShadeMask,
} from './select';

/**
 * Loads pre-rendered art through Phaser's loader (static files under the
 * site base, cached by the service worker). Any failure resolves to null
 * and the world falls back to painting the place itself.
 *
 * Textures of places and people left behind are released as soon as nothing
 * on screen draws them any more, so memory holds one place at a time.
 */
export interface PlaceTextures {
  art: PlaceArt;
  variant: LightingVariant;
  /** How people are lit here (their sheets' variant). */
  peopleLight: PeopleLight;
  /** Pixels per game unit of the loaded ground textures. */
  groundPpu: number;
  /** The ground's tiles: texture keys and where each goes (game units, top-left). */
  ground: ReadonlyArray<{ key: string; x: number; y: number }>;
  pages: string[];
  /** Scale of the loaded pages' pixels against the manifest's (0.5: half-resolution pages). */
  spriteScale: number;
  shade: ShadeMask | null;
}

const BASE = import.meta.env.BASE_URL;
const PLACE_PREFIX = 'art:';
const PERSON_PREFIX = 'person:';

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

async function images(scene: Phaser.Scene, files: Array<[string, string]>): Promise<string[]> {
  files.forEach(([key]) => keep(key));
  const todo = files.filter(([key]) => !scene.textures.exists(key));
  if (todo.length === 0) return [];
  return run(scene, () => todo.forEach(([key, url]) => scene.load.image(key, url)));
}

// ── releasing textures ──────────────────────────────────────────────────────
/** Textures from before the current place, waiting until nothing draws them. */
const stale = new Set<string>();
let watching: Phaser.Scene | null = null;

function keep(key: string): void {
  stale.delete(key);
}

/**
 * Mark every pre-rendered texture as stale; the next place's loads keep the
 * ones it uses again. The rest are removed on the first frame nothing
 * draws them (the old place is cleared only when the new one is built).
 */
export function beginPlace(scene: Phaser.Scene): void {
  for (const key of scene.textures.getTextureKeys())
    if (key.startsWith(PLACE_PREFIX) || key.startsWith(PERSON_PREFIX)) stale.add(key);
  if (watching === scene) return;
  watching = scene;
  scene.events.on('postupdate', () => release(scene));
}

function release(scene: Phaser.Scene): void {
  if (stale.size === 0) return;
  const drawn = new Set<string>();
  for (const obj of scene.children.list) {
    const tex = (obj as Partial<Phaser.GameObjects.Image>).texture;
    if (tex) drawn.add(tex.key);
  }
  let removed = false;
  for (const key of [...stale]) {
    if (drawn.has(key)) continue;
    stale.delete(key);
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
      removed = true;
    }
  }
  // Keep the texture memory the canvas reports (data-texture-mb) true after a release.
  if (removed) scene.game.canvas.dataset.textureMb = textureMegabytes(scene).toFixed(1);
}

/** Approximate GPU memory of every loaded texture (RGBA, uncompressed), in MB. */
function textureMegabytes(scene: Phaser.Scene): number {
  let bytes = 0;
  for (const key of scene.textures.getTextureKeys())
    for (const src of scene.textures.get(key).source) bytes += src.width * src.height * 4;
  return bytes / (1024 * 1024);
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
  const wanted = variantFor(options.hour, available);
  const low = wantsLowResolution(options.zoom, art.ppu, options.lowPower);
  const groundPpu = low ? art.ppu / 2 : art.ppu;
  // The later-day set is cached the first time it is used; offline before
  // then, the morning set stands in for it rather than painting the place.
  for (const variant of wanted === 'day' ? (['day'] as const) : ([wanted, 'day'] as const)) {
    const v = art.variants[variant] ?? art.variants.day;
    const prefix = `art:${sceneId}:${variant}`;
    const tiles = low ? v.groundLow : v.ground;
    const ground = tiles.map((tile, i) => ({
      key: `${prefix}:ground${low ? '-low' : ''}${i}`,
      ...tileOrigin(tile, groundPpu),
    }));
    const shadeKey = `${prefix}:shade`;
    const sheets = pagesFor(v, low);
    const suffix = sheets.scale < 1 ? '-low' : '';
    const pages = sheets.files.map((_, i) => `${prefix}:page${i}${suffix}`);
    const failed = await images(scene, [
      ...tiles.map((tile, i): [string, string] => [
        ground[i]?.key ?? '',
        `${BASE}${path}${tile.file}`,
      ]),
      [shadeKey, `${BASE}${path}${v.shade}`],
      ...sheets.files.map((file, i): [string, string] => [
        pages[i] as string,
        `${BASE}${path}${file}`,
      ]),
    ]);
    if (failed.length > 0) {
      logger.warn(`Pre-rendered ${variant} art for ${sceneId} failed to load`);
      continue;
    }
    return {
      art,
      variant,
      peopleLight: peopleLightFor(variant, art.peopleLight),
      groundPpu,
      ground,
      pages,
      spriteScale: sheets.scale,
      shade: readShade(scene, shadeKey),
    };
  }
  logger.warn(`Pre-rendered art for ${sceneId} failed to load; painting it instead`);
  return null;
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

/**
 * A sheet in a light: the light asked for, else the nearest there is (a
 * room's for lamp-lighting), else the morning's (or any there is).
 */
function pick<T>(byLight: Partial<Record<PeopleLight, T>>, light: PeopleLight): T | undefined {
  return (
    byLight[light] ??
    (light === 'lamp' ? byLight.indoor : undefined) ??
    byLight.day ??
    byLight.late ??
    byLight.indoor ??
    byLight.overcast ??
    byLight.lamp
  );
}

export interface PersonTextures {
  key: string;
  /** The cast-shadow sheet (overlays have none). */
  shadow: string | null;
  light: PeopleLight;
}

/**
 * Load (once) several people's sheets and shadow sheets for a light, in one
 * pass through the loader, with their frames named. A sheet whose light
 * cannot be loaded (a later-day sheet not cached yet, offline) falls back
 * to the morning's; sheets that still fail are left out (those people are
 * painted instead).
 */
export async function loadPersons(
  scene: Phaser.Scene,
  art: PeopleArt,
  ids: readonly string[],
  light: PeopleLight,
): Promise<Map<string, PersonTextures>> {
  const out = await attemptPersons(scene, art, ids, light);
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length > 0 && light !== 'day')
    for (const [id, tex] of await attemptPersons(scene, art, missing, 'day')) out.set(id, tex);
  return out;
}

async function attemptPersons(
  scene: Phaser.Scene,
  art: PeopleArt,
  ids: readonly string[],
  light: PeopleLight,
): Promise<Map<string, PersonTextures>> {
  const plan: Array<{ id: string; sheet: PersonSheet; file: string; shadow: string | null }> = [];
  const files: Array<[string, string]> = [];
  for (const id of ids) {
    const sheet = art[id];
    if (!sheet) continue;
    const file = pick(sheet.sheets, light);
    if (!file) continue;
    const shadow = pick(sheet.shadows, light)?.sheet ?? null;
    plan.push({ id, sheet, file, shadow });
    files.push([`person:${file}`, `${BASE}${PEOPLE_ART}${file}`]);
    if (shadow) files.push([`person:${shadow}`, `${BASE}${PEOPLE_ART}${shadow}`]);
  }
  const failed = new Set(await images(scene, files));
  const out = new Map<string, PersonTextures>();
  for (const { id, sheet, file, shadow } of plan) {
    const key = `person:${file}`;
    const shadowKey = shadow ? `person:${shadow}` : null;
    if (failed.has(key) || (shadowKey && failed.has(shadowKey))) continue;
    frames(scene.textures.get(key), sheet, sheet.atlas[file], sheet.frameWidth, sheet.frameHeight);
    const s = pick(sheet.shadows, light);
    if (shadowKey && s)
      frames(
        scene.textures.get(shadowKey),
        sheet,
        sheet.atlas[s.sheet],
        s.frameWidth,
        s.frameHeight,
      );
    const used = (Object.keys(sheet.sheets) as PeopleLight[]).find((l) => sheet.sheets[l] === file);
    out.set(id, { key, shadow: shadowKey, light: used ?? light });
  }
  return out;
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
