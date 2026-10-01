import { useState } from 'react';
import type { KeyArt } from '@/domain/chapter';

/**
 * A piece of key art (pre-rendered in Blender from the game's own places,
 * people and light: tools/art/build_key_art.py). Phones get the half-size
 * image (`srcSet`); the width and height reserve its space so nothing jumps
 * when it loads. If the image can't load, a painted panel of the same
 * shape takes its place, still named for screen readers.
 */
export function KeyArtImage({
  art,
  className,
  sizes,
  eager = false,
  base = import.meta.env.BASE_URL,
}: {
  art: KeyArt;
  className: string;
  /** How wide the image is drawn (the `sizes` attribute). */
  sizes: string;
  /** Load at once (the title screen's hero) rather than when scrolled near. */
  eager?: boolean;
  base?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div
        className={`${className} key-art--fallback`}
        role="img"
        aria-label={art.alt}
        style={{ aspectRatio: `${art.width} / ${art.height}` }}
      />
    );
  return (
    <img
      className={className}
      src={`${base}${art.src}`}
      srcSet={`${base}${art.srcSmall} ${art.width / 2}w, ${base}${art.src} ${art.width}w`}
      sizes={sizes}
      width={art.width}
      height={art.height}
      alt={art.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
