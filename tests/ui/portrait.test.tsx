import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { appearanceKey } from '@/domain/appearance-key';
import { PLAYER_APPEARANCES, type Appearance } from '@/domain/characters';
import { Portrait } from '@/features/common/Portrait';
import {
  portraitImage,
  preloadPortraits,
  type PortraitManifest,
} from '@/features/portraits/portrait-art';
import { expectNoAxeViolations } from './helpers';

// A fixed manifest, so these tests don't depend on which portraits have been rendered.
vi.mock('@/features/portraits/portrait-manifest.json', async () => {
  const { appearanceKey: key } = await import('@/domain/appearance-key');
  const { PLAYER_APPEARANCES: looks } = await import('@/domain/characters');
  return {
    default: {
      'player-look-1': { appearance: key(looks['look-1']), kind: 'player' },
    },
  };
});

const LOOK_1 = PLAYER_APPEARANCES['look-1'];
const UNRENDERED: Appearance = { ...LOOK_1, robe: '#123456' };

describe('Portrait', () => {
  it('shows the rendered portrait when one exists: decorative, fixed size, sized for the screen', async () => {
    const { container } = render(<Portrait appearance={LOOK_1} size={72} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    if (!img) return;
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('aria-hidden', 'true');
    // Width and height are set, so the layout never shifts while it loads.
    expect(img).toHaveAttribute('width', '72');
    expect(img).toHaveAttribute('height', '72');
    expect(img.getAttribute('src')).toBe('/art/portraits/player-look-1-256.webp');
    expect(img.getAttribute('srcset')).toBe(
      '/art/portraits/player-look-1-128.webp 128w, /art/portraits/player-look-1-256.webp 256w, /art/portraits/player-look-1-512.webp 512w',
    );
    expect(img).toHaveAttribute('sizes', '72px');
    expect(container.querySelector('svg')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('draws the portrait when there is no rendered one for how the person looks now', () => {
    const { container } = render(<Portrait appearance={UNRENDERED} size={56} />);
    expect(container.querySelector('img')).toBeNull();
    const svg = container.querySelector('svg.portrait');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '56');
  });

  it('falls back to the drawn portrait if the image cannot be loaded', () => {
    const { container } = render(<Portrait appearance={LOOK_1} size={64} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    if (img) fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg.portrait')).not.toBeNull();
  });

  it('keeps the scroll for the narrator', () => {
    const { container } = render(<Portrait appearance={null} />);
    expect(container.querySelector('svg.portrait--narrator')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('portraitImage', () => {
  const key = appearanceKey(LOOK_1);
  const twins: PortraitManifest = {
    ezer: { appearance: key, kind: 'character' },
    anna: { appearance: key, kind: 'character' },
  };

  it("prefers the speaker's own portrait when two people look alike", () => {
    expect(portraitImage(LOOK_1, 'ezer', 'neutral', twins)?.id).toBe('ezer');
    expect(portraitImage(LOOK_1, 'anna', 'neutral', twins)?.id).toBe('anna');
    // Anyone else who looks the same (e.g. the player) gets a stable choice.
    expect(portraitImage(LOOK_1, null, 'neutral', twins)?.id).toBe('anna');
  });

  it("does not use someone's portrait once their appearance has changed", () => {
    const stale: PortraitManifest = { ezer: { appearance: 'something-else', kind: 'character' } };
    expect(portraitImage(LOOK_1, 'ezer', 'neutral', stale)).toBeNull();
  });

  it('preloads the portraits of everyone who may speak, and skips people without one', () => {
    const created: HTMLImageElement[] = [];
    const Real = window.Image;
    class Spy extends Real {
      constructor() {
        super();
        created.push(this);
      }
    }
    vi.stubGlobal('Image', Spy);
    try {
      preloadPortraits([{ appearance: LOOK_1 }, { appearance: UNRENDERED, id: 'nobody' }], 104);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(created).toHaveLength(1);
    expect(created[0]?.getAttribute('src')).toBe('/art/portraits/player-look-1-256.webp');
    expect(created[0]?.getAttribute('sizes')).toBe('104px');
  });

  it('serves the images under the site base path (GitHub Pages)', () => {
    const art = portraitImage(LOOK_1, 'ezer', 'neutral', twins, '/witness/');
    expect(art?.src).toBe('/witness/art/portraits/ezer-256.webp');
    expect(art?.srcSet).toContain('/witness/art/portraits/ezer-128.webp 128w');
  });
});
