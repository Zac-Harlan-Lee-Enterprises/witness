import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DialogueView } from '@/application/ui-store';
import { appearanceKey } from '@/domain/appearance-key';
import type { Appearance } from '@/domain/characters';
import { Portrait } from '@/features/common/Portrait';
import { DialogueOverlay } from '@/features/dialogue/DialogueOverlay';
import { portraitImage, type PortraitManifest } from '@/features/portraits/portrait-art';
import { expectNoAxeViolations, makeRuntime, makeServices, renderWithServices } from './helpers';

/**
 * Expressions (tools/art/build_portraits.py renders a portrait for every
 * expression a person's lines carry): the right face is shown for a line,
 * neutral stands in for any expression that wasn't rendered, and a change
 * of face cross-fades (or cuts at once with reduced motion).
 */
const MIRIAM: Appearance = {
  skin: '#966b49',
  hair: '#4a3a30',
  robe: '#7b5648',
  accent: '#c9a86a',
  headwear: 'veil',
  headwearColor: '#e8dcc4',
  beard: false,
  build: 'adult',
  carry: 'none',
};

vi.mock('@/features/portraits/portrait-manifest.json', async () => {
  const { appearanceKey: key } = await import('@/domain/appearance-key');
  const { chapterSource } = await import('@/content');
  const chapter = await chapterSource.load('road-to-jericho');
  const miriam = chapter.characters.find((c) => c.id === 'miriam');
  return {
    default: {
      miriam: {
        appearance: miriam ? key(miriam.appearance) : '',
        kind: 'character',
        expressions: ['glad', 'worried'],
      },
    },
  };
});

const manifest: PortraitManifest = {
  miriam: { appearance: appearanceKey(MIRIAM), kind: 'character', expressions: ['worried'] },
};

afterEach(() => {
  delete document.documentElement.dataset.motion;
});

describe('portraitImage with an expression', () => {
  it('shows the face for the line when it was rendered, from its own folder', () => {
    const art = portraitImage(MIRIAM, 'miriam', 'worried', manifest, '/');
    expect(art?.expression).toBe('worried');
    expect(art?.src).toBe('/art/portraits/worried/miriam-256.webp');
    expect(art?.srcSet).toContain('/art/portraits/worried/miriam-512.webp 512w');
  });

  it('falls back to the neutral portrait for an expression that was not rendered', () => {
    const art = portraitImage(MIRIAM, 'miriam', 'angry', manifest, '/');
    expect(art?.expression).toBe('neutral');
    expect(art?.src).toBe('/art/portraits/miriam-256.webp');
    expect(portraitImage(MIRIAM, 'miriam', 'neutral', manifest, '/')?.src).toBe(
      '/art/portraits/miriam-256.webp',
    );
  });
});

/** A line of Aunt Miriam's, as the dialogue controller would show it. */
function line(nodeId: string, expression: DialogueView['expression'], appearance: Appearance) {
  const view: DialogueView = {
    dialogueId: 'd-test',
    nodeId,
    speaker: { id: 'miriam', name: 'Aunt Miriam', role: 'Healer', appearance, kind: 'character' },
    text: '…',
    expression,
    kind: 'fiction',
    record: null,
    choices: [],
    canContinue: true,
    isLast: false,
  };
  return view;
}

describe('the dialogue box shows the face for each line', () => {
  async function open() {
    const { runtime } = await makeRuntime();
    const miriam = runtime.chapter.characters.find((c) => c.id === 'miriam');
    if (!miriam) throw new Error('no Miriam');
    const services = await makeServices();
    await services.settings.update({ dialogueSpeed: 'instant' });
    act(() => runtime.ui.setDialogue(line('a', 'neutral', miriam.appearance)));
    const result = await renderWithServices(<DialogueOverlay runtime={runtime} />, services);
    const say = (id: string, e: DialogueView['expression']) =>
      act(() => runtime.ui.setDialogue(line(id, e, miriam.appearance)));
    return { ...result, say };
  }

  const portrait = () =>
    document.querySelector<HTMLImageElement>('.dialogue__portrait img.portrait');

  it('switches to the expression the line carries, cross-fading from the last face', async () => {
    const { container, say } = await open();
    expect(portrait()?.dataset.expression).toBe('neutral');
    say('b', 'worried');
    expect(portrait()?.dataset.expression).toBe('worried');
    expect(portrait()?.getAttribute('src')).toContain('/worried/miriam-256.webp');
    // The previous face is laid over the new one and fades out.
    const leaving = container.querySelector<HTMLImageElement>('img.portrait-leaving');
    expect(leaving?.getAttribute('src')).toContain('/art/portraits/miriam-256.webp');
    expect(leaving).toHaveAttribute('aria-hidden', 'true');
    await expectNoAxeViolations(container);
  });

  it('shows neutral for an expression that was not rendered, and does not fade to the same face', async () => {
    const { container, say } = await open();
    say('b', 'angry');
    expect(portrait()?.dataset.expression).toBe('neutral');
    expect(container.querySelector('img.portrait-leaving')).toBeNull();
  });

  it('cuts to the new face at once with reduced motion', async () => {
    document.documentElement.dataset.motion = 'reduce';
    const { container, say } = await open();
    say('b', 'glad');
    expect(portrait()?.dataset.expression).toBe('glad');
    expect(container.querySelector('img.portrait-leaving')).toBeNull();
  });

  it('offers the browser a larger file for the larger portrait on wide screens', async () => {
    await open();
    expect(portrait()?.getAttribute('sizes')).toContain('152px');
    expect(screen.getByRole('dialog', { name: /Aunt Miriam/ })).toBeInTheDocument();
  });
});

describe('Portrait', () => {
  it('takes an expression, falling back to neutral when it was not rendered', async () => {
    const { chapterSource } = await import('@/content');
    const chapter = await chapterSource.load('road-to-jericho');
    const miriam = chapter.characters.find((c) => c.id === 'miriam');
    if (!miriam) throw new Error('no Miriam');
    const { container, rerender } = render(
      <Portrait appearance={miriam.appearance} characterId="miriam" expression="glad" size={104} />,
    );
    expect(container.querySelector('img')?.dataset.expression).toBe('glad');
    rerender(
      <Portrait appearance={miriam.appearance} characterId="miriam" expression="sad" size={104} />,
    );
    expect(container.querySelector('img')?.dataset.expression).toBe('neutral');
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/art/portraits/miriam-256.webp',
    );
  });

  it('shows the neutral portrait when an expression cannot load (offline, never cached), then the drawing', async () => {
    const { chapterSource } = await import('@/content');
    const chapter = await chapterSource.load('road-to-jericho');
    const miriam = chapter.characters.find((c) => c.id === 'miriam');
    if (!miriam) throw new Error('no Miriam');
    const { container } = render(
      <Portrait appearance={miriam.appearance} characterId="miriam" expression="worried" />,
    );
    const first = container.querySelector('img');
    expect(first?.dataset.expression).toBe('worried');
    if (first) fireEvent.error(first);
    const second = container.querySelector('img');
    expect(second?.dataset.expression).toBe('neutral');
    expect(second?.getAttribute('src')).toBe('/art/portraits/miriam-256.webp');
    if (second) fireEvent.error(second);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg.portrait')).not.toBeNull();
  });
});
