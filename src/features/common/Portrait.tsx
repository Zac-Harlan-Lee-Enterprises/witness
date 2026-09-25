import type { Appearance } from '@/domain/characters';

/**
 * Original SVG portrait generated from the same Appearance data as the world
 * sprite. Decorative: the speaker's name is always shown as text.
 */
export function Portrait({
  appearance,
  size = 72,
}: {
  appearance: Appearance | null;
  size?: number;
}) {
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
        <rect width="72" height="72" rx="12" fill="var(--portrait-bg)" />
        <path d="M20 22h32v30l-16-7-16 7z" fill="var(--color-accent)" opacity="0.85" />
        <path
          d="M26 30h20M26 36h20M26 42h12"
          stroke="var(--color-surface)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  const a = appearance;
  const child = a.build === 'child';
  const headR = child ? 12 : 11;
  const headY = child ? 34 : 31;
  const cover = a.headwear === 'scarf' || a.headwear === 'veil' || a.headwear === 'hood';
  return (
    <svg
      className="portrait"
      width={size}
      height={size}
      viewBox="0 0 72 72"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="72" height="72" rx="12" fill="var(--portrait-bg)" />
      {cover && (
        <path
          d={`M${36 - 17} 72 Q ${36 - 19} ${headY - 4} 36 ${headY - 16} Q ${36 + 19} ${headY - 4} ${36 + 17} 72 Z`}
          fill={a.headwear === 'hood' ? a.robe : a.headwearColor}
        />
      )}
      <path d="M12 72 Q 14 52 36 50 Q 58 52 60 72 Z" fill={a.robe} />
      <path d="M26 54 L36 64 L46 54" stroke={a.accent} strokeWidth="3" fill="none" />
      <circle cx="36" cy={headY} r={headR} fill={a.skin} />
      {(a.headwear === 'none' || a.headwear === 'band') && (
        <path
          d={`M${36 - headR} ${headY - 1} Q 36 ${headY - headR * 1.9} ${36 + headR} ${headY - 1} Q 36 ${headY - headR * 0.9} ${36 - headR} ${headY - 1} Z`}
          fill={a.build === 'elder' ? '#d8d0c0' : a.hair}
        />
      )}
      {a.headwear === 'band' && (
        <rect x={36 - headR} y={headY - 7} width={headR * 2} height="3.5" fill={a.headwearColor} />
      )}
      {a.headwear === 'wrap' && (
        <ellipse cx="36" cy={headY - 8} rx={headR + 2} ry="7" fill={a.headwearColor} />
      )}
      {cover && (
        <path
          d={`M${36 - headR - 2} ${headY + 2} Q 36 ${headY - headR * 2.1} ${36 + headR + 2} ${headY + 2} L ${36 + headR - 1} ${headY - 3} Q 36 ${headY - headR * 1.2} ${36 - headR + 1} ${headY - 3} Z`}
          fill={a.headwear === 'hood' ? a.robe : a.headwearColor}
        />
      )}
      <circle cx={31.5} cy={headY + 1} r="1.6" fill="#2a1a10" />
      <circle cx={40.5} cy={headY + 1} r="1.6" fill="#2a1a10" />
      <path
        d={`M32 ${headY + 6} Q 36 ${headY + 8} 40 ${headY + 6}`}
        stroke="#5a3522"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      {a.beard && (
        <path
          d={`M${36 - headR + 2} ${headY + 3} Q 36 ${headY + headR + 9} ${36 + headR - 2} ${headY + 3} Q 36 ${headY + 9} ${36 - headR + 2} ${headY + 3} Z`}
          fill={a.build === 'elder' ? '#d8d0c0' : a.hair}
        />
      )}
    </svg>
  );
}
