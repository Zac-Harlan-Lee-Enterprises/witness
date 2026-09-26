import type Phaser from 'phaser';
import type { WorldSceneModel } from '@/application/ports';
import type { Appearance } from '@/domain/characters';
import type { LookMark, Pose } from '@/domain/world';
import type { Logger } from '@/shared/logger';
import type { RenderedFigure } from '../scenes/actors';
import { crowdSize } from '../systems/life';
import { beginPlace, loadPeople, loadPersons, loadPlace, type PersonTextures } from './loader';
import type { PeopleArt, PersonSheet } from './manifest';
import { artPathFor, pickSheets, sheetsToLoad } from './select';
import type { PlaceTextures } from './loader';

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

  static async load(
    scene: Phaser.Scene,
    people: PeopleArt,
    model: WorldSceneModel,
    light: PersonTextures['light'],
  ): Promise<FigureBook> {
    const appearances: Appearance[] = [model.player.appearance];
    for (const e of model.entities) if (e.appearance) appearances.push(e.appearance);
    const crowd = crowdSize(model.mood, false) > 0;
    const ids = sheetsToLoad(people, appearances, crowd, model.player.appearance.robe);
    return FigureBook.from(people, await loadPersons(scene, people, ids, light));
  }

  /** A book over sheets already loaded (their texture keys by sheet id). */
  static from(people: PeopleArt, textures: ReadonlyMap<string, PersonTextures>): FigureBook {
    return new FigureBook(people, textures);
  }

  /** The figure for someone as they look now, or null to paint them. */
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
    const layers: string[] = [];
    for (const id of pick.overlays) {
      const tex = this.textures.get(id);
      if (!tex) return null;
      layers.push(tex.key);
    }
    return layers.length > 0 ? { ...base, layers } : base;
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
  const shadow = sheet.shadows[tex.light] ?? sheet.shadows.day ?? sheet.shadows.late;
  if (!shadow || !tex.shadow) return null;
  return {
    key: tex.key,
    shadowKey: tex.shadow,
    ppu: sheet.ppu,
    originX: sheet.originX,
    originY: sheet.originY,
    frameWidth: sheet.frameWidth,
    frameHeight: sheet.frameHeight,
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
 * the time of day and the resolution the view needs, and its people. Both
 * are null for a place without art (it is painted). Textures of the place
 * before are released once nothing draws them.
 */
export async function prepareArt(
  scene: Phaser.Scene,
  model: WorldSceneModel,
  options: { hour: number | null; zoom: number; lowPower: boolean },
  logger: Logger,
): Promise<{ place: PlaceTextures | null; book: FigureBook | null }> {
  beginPlace(scene);
  const path = artPathFor(model.sceneId);
  if (!path) return { place: null, book: null };
  const place = await loadPlace(scene, model.sceneId, path, options, logger);
  if (!place) return { place: null, book: null };
  const people = await loadPeople(scene, logger);
  const book = people ? await FigureBook.load(scene, people, model, place.peopleLight) : null;
  return { place, book };
}
