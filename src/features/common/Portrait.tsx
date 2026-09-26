import { useState } from 'react';
import type { Appearance } from '@/domain/characters';
import { portraitImage } from '../portraits/portrait-art';

/**
 * A person's portrait. Decorative: the speaker's name is always shown as text.
 *
 * A pre-rendered portrait (tools/art/build_portraits.py) is shown when one
 * exists for how the person looks now. It has a fixed size and a matching
 * background while it loads, so nothing moves. Otherwise (or if the image
 * cannot load) an original SVG drawn from the same Appearance data is shown.
 */
const INK = '#2a170b';

export function Portrait({
  appearance,
  size = 72,
  characterId = null,
}: {
  appearance: Appearance | null;
  size?: number;
  /** Whose portrait this is, when two people could look alike. */
  characterId?: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const art = appearance ? portraitImage(appearance, characterId) : null;
  if (art && failed !== art.src) {
    return (
      <img
        className="portrait portrait--rendered"
        src={art.src}
        srcSet={art.srcSet}
        sizes={`${size}px`}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        draggable={false}
        data-portrait={art.id}
        onError={() => setFailed(art.src)}
      />
    );
  }
  return <DrawnPortrait appearance={appearance} size={size} />;
}

/** The original drawn (SVG) portrait, and the narrator's scroll. */
function DrawnPortrait({ appearance, size }: { appearance: Appearance | null; size: number }) {
  if (!appearance) {
    return (
      <svg
        className="portrait portrait--narrator"
        width={size}
        height={size}
        viewBox="0 0 72 72"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="72" height="72" rx="14" fill="var(--portrait-bg)" />
        {/* An open scroll: the narrator's voice. */}
        <path
          d="M16 22c0-3 2-5 5-5h28c3 0 5 2 5 5v28c0 3-2 5-5 5H21c-3 0-5-2-5-5z"
          fill="var(--color-surface)"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
        />
        <path
          d="M24 29h24M24 36h24M24 43h15"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  const a = appearance;
  const child = a.build === 'child';
  const elder = a.build === 'elder';
  const headR = child ? 13 : 12;
  const headY = child ? 33 : 30;
  const hair = elder ? '#dcd5c8' : a.hair;
  const cover = a.headwear === 'scarf' || a.headwear === 'veil' || a.headwear === 'hood';
  const clothColor = a.headwear === 'hood' ? a.robe : a.headwearColor;
  const eyeY = headY + 1.5;
  return (
    <svg
      className="portrait"
      width={size}
      height={size}
      viewBox="0 0 72 72"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`pbg-${a.skin.slice(1)}`} cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor="var(--color-surface)" />
          <stop offset="1" stopColor="var(--portrait-bg)" />
        </radialGradient>
      </defs>
      <rect width="72" height="72" rx="14" fill={`url(#pbg-${a.skin.slice(1)})`} />
      {cover && (
        <path
          d={`M${36 - 19} 72 Q ${36 - 21} ${headY - 4} 36 ${headY - 18} Q ${36 + 21} ${headY - 4} ${36 + 19} 72 Z`}
          fill={clothColor}
          stroke={INK}
          strokeWidth="1.4"
        />
      )}
      <path d="M11 72 Q 13 50 36 48 Q 59 50 61 72 Z" fill={a.robe} stroke={INK} strokeWidth="1.4" />
      <path d="M29 52 V72 M43 52 V72" stroke={a.accent} strokeWidth="3" />
      <circle cx="36" cy={headY} r={headR} fill={a.skin} stroke={INK} strokeWidth="1.4" />
      {!cover && a.headwear !== 'wrap' && (
        <path
          d={`M${36 - headR} ${headY - 1} Q 36 ${headY - headR * 2} ${36 + headR} ${headY - 1} Q 36 ${headY - headR * 0.8} ${36 - headR} ${headY - 1} Z`}
          fill={hair}
          stroke={INK}
          strokeWidth="1.2"
        />
      )}
      {a.headwear === 'band' && (
        <rect
          x={36 - headR}
          y={headY - 8}
          width={headR * 2}
          height="4"
          fill={a.headwearColor}
          stroke={INK}
          strokeWidth="1"
        />
      )}
      {a.headwear === 'wrap' && (
        <ellipse
          cx="36"
          cy={headY - 8}
          rx={headR + 2.5}
          ry="7.5"
          fill={a.headwearColor}
          stroke={INK}
          strokeWidth="1.3"
        />
      )}
      {cover && (
        <path
          d={`M${36 - headR - 3} ${headY + 3} Q 36 ${headY - headR * 2.2} ${36 + headR + 3} ${headY + 3} L ${36 + headR - 1} ${headY - 3} Q 36 ${headY - headR * 1.25} ${36 - headR + 1} ${headY - 3} Z`}
          fill={clothColor}
          stroke={INK}
          strokeWidth="1.2"
        />
      )}
      {/* Eyes with a highlight, brows, cheeks and a small smile. */}
      <ellipse cx="31" cy={eyeY} rx="2.4" ry="2.8" fill="#fdf6ea" />
      <ellipse cx="41" cy={eyeY} rx="2.4" ry="2.8" fill="#fdf6ea" />
      <circle cx="31.2" cy={eyeY + 0.4} r="1.8" fill={INK} />
      <circle cx="41.2" cy={eyeY + 0.4} r="1.8" fill={INK} />
      <circle cx="31.9" cy={eyeY - 0.4} r="0.6" fill="#fff" />
      <circle cx="41.9" cy={eyeY - 0.4} r="0.6" fill="#fff" />
      <path
        d={`M28 ${eyeY - 4.2} L33.5 ${eyeY - 5} M38.5 ${eyeY - 5} L44 ${eyeY - 4.2}`}
        stroke={elder ? '#9a8f7c' : hair}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <ellipse cx="27.5" cy={headY + 5} rx="2.5" ry="1.4" fill="#d0674f" opacity="0.25" />
      <ellipse cx="44.5" cy={headY + 5} rx="2.5" ry="1.4" fill="#d0674f" opacity="0.25" />
      {a.beard ? (
        <path
          d={`M${36 - headR + 1.5} ${headY + 3} Q 36 ${headY + headR + 10} ${36 + headR - 1.5} ${headY + 3} Q 38 ${headY + 7} 36 ${headY + 7} Q 34 ${headY + 7} ${36 - headR + 1.5} ${headY + 3} Z`}
          fill={hair}
          stroke={INK}
          strokeWidth="1"
        />
      ) : (
        <path
          d={`M33 ${headY + 7} Q 36 ${headY + 9} 39 ${headY + 7}`}
          stroke="#5a2c1a"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
