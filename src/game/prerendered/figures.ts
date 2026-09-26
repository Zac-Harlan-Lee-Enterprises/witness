import type Phaser from 'phaser';
import type { WorldSceneModel } from '@/application/ports';
import type { Appearance } from '@/domain/characters';
import type { LookMark, Pose } from '@/domain/world';
import type { Logger } from '@/shared/logger';
import type { RenderedFigure } from '../scenes/actors';
import { crowdSize } from '../systems/life';
import {
  beginPlace,
  endPlace,
  loadPeople,
  loadPersons,
  loadPlace,
  type PersonTextures,
} from './loader';
import type { PeopleArt, PersonSheet } from './manifest';
import { artPathFor, pickSheets, sheetSet, sheetsToLoad } from './select';
import type { ArtOptions, PlaceTextures } from './loader';

/**
 * The pre-rendered people of a place: every sheet the people present may
 * need (standing, at rest, overlays for story marks) is loaded before the
 * place is shown, so when the story changes how someone looks (a bandage,
 * the spare cloak, sitting up) the right figure is ready at once.
 */
export class FigureBook {
  private constructor(
    private readonly people: PeopleArt,
    private readonly textures: ReadonlyMap<string, PersonTextures>,
  ) {}

  /**
   * Load the sheets of everyone who may be seen in a place, in its people
   * light: the low-resolution sheets when `low` (phones and low-memory
   * devices, as the place's art: `wantsLowResolution`).
   */
  static async load(
    scene: Phaser.Scene,
    people: PeopleArt,
    model: WorldSceneModel,
    light: PersonTextures['light'],
    low = false,
  ): Promise<FigureBook> {
    const appearances: Appearance[] = [model.player.appearance];
    for (const e of model.entities) if (e.appearance) appearances.push(e.appearance);
    const crowd = crowdSize(model.mood, false) > 0;
    const ids = sheetsToLoad(people, appearances, crowd, model.player.appearance.robe);
    return FigureBook.from(people, await loadPersons(scene, people, ids, light, low));
  }

  /** A book over sheets already loaded (their texture keys by sheet id). */
  static from(people: PeopleArt, textures: ReadonlyMap<string, PersonTextures>): FigureBook {
    return new FigureBook(people, textures);
  }

  /**
   * The figure for someone as they look now, or null to paint them. Overlays
   * are drawn at their sheet's scale, so they must have loaded at its
   * resolution (a low sheet that failed and fell back to the full one would
   * not line up).
   */
  figure(
    appearance: Appearance,
    marks: readonly LookMark[],
    pose: Pose,
    rag: string | null,
  ): RenderedFigure | null {
    const pick = pickSheets(this.people, appearance, marks, pose, rag);
    if (!pick) return null;
    const base = this.of(pick.base);
    if (!base) return null;
    const low = this.textures.get(pick.base)?.low === true;
    const layers: string[] = [];
    for (const id of pick.overlays) {
      const tex = this.textures.get(id);
      if (!tex || (tex.low === true) !== low) return null;
      layers.push(tex.key);
    }
    return layers.length > 0 ? { ...base, layers } : base;
  }

  /** Every loaded cast-shadow sheet (for compacting to one channel on the GPU). */
  shadowKeys(): string[] {
    return [...this.textures.values()].map((t) => t.shadow).filter((k): k is string => k !== null);
  }

  /**
   * Pixels per game unit of the people sheets loaded, lowest first (one
   * value unless some fell back to another resolution); for diagnostics.
   */
  resolutions(): number[] {
    const ppus = new Set<number>();
    for (const [id, tex] of this.textures) {
      const sheet = this.people[id];
      if (sheet) ppus.add(sheetSet(sheet, tex.low === true).ppu);
    }
    return [...ppus].sort((a, b) => a - b);
  }

  /** Passers-by (crowd sheets loaded for this place). */
  crowd(): RenderedFigure[] {
    return [...this.textures.keys()]
      .filter((id) => id.startsWith('crowd-'))
      .map((id) => this.of(id))
      .filter((f): f is RenderedFigure => f !== null);
  }

  private of(id: string): RenderedFigure | null {
    const sheet = this.people[id];
    const tex = this.textures.get(id);
    if (!sheet || !tex?.shadow) return null;
    return figureOf(sheet, tex);
  }
}

function figureOf(sheet: PersonSheet, tex: PersonTextures): RenderedFigure | null {
  // Frame metrics are those of the resolution loaded (full, or the low sheets).
  const set = sheetSet(sheet, tex.low === true);
  // The shadow's frame metrics must match the shadow sheet actually loaded.
  const shadow =
    (tex.shadowLight ? set.shadows[tex.shadowLight] : undefined) ??
    set.shadows[tex.light] ??
    set.shadows.day ??
    set.shadows.late;
  if (!shadow || !tex.shadow) return null;
  return {
    key: tex.key,
    shadowKey: tex.shadow,
    ppu: set.ppu,
    originX: set.originX,
    originY: set.originY,
    frameWidth: set.frameWidth,
    frameHeight: set.frameHeight,
    turns: sheet.turns,
    shadow: {
      ppu: shadow.ppu,
      originX: shadow.originX,
      originY: shadow.originY,
      frameWidth: shadow.frameWidth,
      frameHeight: shadow.frameHeight,
    },
  };
}

/**
 * Everything pre-rendered a place needs, before it is built: its layers for
 * the time of day and the resolution the view and device need, and its
 * people, at the same resolution. Both are null for a place without art (it
 * is painted). Textures of the place before are released once nothing draws
 * them.
 */
export async function prepareArt(
  scene: Phaser.Scene,
  model: WorldSceneModel,
  options: ArtOptions,
  logger: Logger,
): Promise<{ place: PlaceTextures | null; book: FigureBook | null }> {
  beginPlace(scene);
  try {
    const path = artPathFor(model.sceneId);
    if (!path) return { place: null, book: null };
    const place = await loadPlace(scene, model.sceneId, path, options, logger);
    if (!place) return { place: null, book: null };
    const people = await loadPeople(scene, logger);
    const book = people
      ? await FigureBook.load(scene, people, model, place.peopleLight, place.low)
      : null;
    return { place, book };
  } finally {
    endPlace();
  }
}
