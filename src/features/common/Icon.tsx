import type { ReactElement } from 'react';

/**
 * A small hand-drawn icon set in the game's ink-line style (24×24, drawn in
 * `currentColor` so it follows the theme and high contrast). Icons are
 * always decorative: every place they appear also has a text label.
 */
export type IconName =
  | 'goto'
  | 'journal'
  | 'satchel'
  | 'quests'
  | 'menu'
  | 'star'
  | 'lens'
  | 'info'
  | 'warning'
  | 'sun'
  | 'moon'
  | 'dusk'
  | 'home'
  | 'city'
  | 'hills'
  | 'palm'
  | 'lock'
  | 'check'
  | 'flag'
  | 'jar'
  | 'letter'
  | 'coins'
  | 'water'
  | 'bread'
  | 'olives'
  | 'thread'
  | 'lamp'
  | 'cloak'
  | 'map';

const PATHS: Record<IconName, ReactElement> = {
  goto: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  journal: (
    <>
      <path d="M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h10.5M9 8h6M9 11h4" />
    </>
  ),
  satchel: (
    <>
      <path d="M4.5 9.5h15v8a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M8 9.5V8a4 4 0 0 1 8 0v1.5M4.5 13h15M12 13v2.5" />
    </>
  ),
  quests: (
    <>
      <path d="M7 4h11a2 2 0 0 1 0 4H7" />
      <path d="M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8M9.5 12h5M9.5 15.5h5" />
    </>
  ),
  menu: <path d="M5 7h14M5 12h14M5 17h14" />,
  star: (
    <path d="M12 3.5c.8 5 2.9 7.2 8.5 8.5-5.6 1.3-7.7 3.5-8.5 8.5-.8-5-2.9-7.2-8.5-8.5 5.6-1.3 7.7-3.5 8.5-8.5z" />
  ),
  lens: (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M14.5 14.5l5 5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.6v.2" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4l9 15.5H3z" />
      <path d="M12 10v4.5M12 17.2v.2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z" />,
  dusk: (
    <>
      <path d="M7 16a5 5 0 0 1 10 0M3 16h18M5 19.5h14M12 5v3M6 8.5l1.6 1.6M18 8.5l-1.6 1.6" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.5L12 5l8 6.5M6 10v9.5h12V10" />
      <path d="M10 19.5v-5h4v5" />
    </>
  ),
  city: (
    <>
      <path d="M3.5 20.5V11h4V8h3v3h3V6h3v5h4v9.5z" />
      <path d="M10.5 20.5v-4a1.5 1.5 0 0 1 3 0v4" />
    </>
  ),
  hills: (
    <>
      <path d="M2.5 19l6-9 4 5 3-4 6 8z" />
      <path d="M16.5 6.5h.2" />
    </>
  ),
  palm: (
    <>
      <path d="M12 21c.5-4 .3-8-.5-11" />
      <path d="M11.5 10C9 7 5.5 7 3.5 9M11.5 10c2.5-3 6-3 8-1M11.5 10C10 6 7.5 4.5 5 4.5M11.5 10c1-4 3.5-5.5 6-5.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h11l-2.5 3.5L17 11.5H6" />
    </>
  ),
  jar: (
    <>
      <path d="M9 3.5h6M9.5 3.5v2.5C6 7.5 5.5 10 5.5 13c0 4.5 3 7.5 6.5 7.5s6.5-3 6.5-7.5c0-3-.5-5.5-4-7V3.5" />
      <path d="M7 12h10" />
    </>
  ),
  letter: (
    <>
      <path d="M6 4h9l3 3v13H6z" />
      <path d="M15 4v3h3M9 11h6M9 14h6M9 17h3.5" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9.5" cy="9" rx="5.5" ry="3" />
      <path d="M4 9v4c0 1.7 2.5 3 5.5 3M15 9v1.5" />
      <ellipse cx="14.5" cy="15" rx="5.5" ry="3" />
      <path d="M9 15v3c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-3" />
    </>
  ),
  water: (
    <>
      <path d="M8 5h8M9 5c-3 1.5-4.5 5-4.5 8.5 0 4 3 7 7.5 7s7.5-3 7.5-7c0-3.5-1.5-7-4.5-8.5" />
      <path d="M9 13c.3 1.8 1.4 3 3 3.3" />
    </>
  ),
  bread: (
    <>
      <path d="M4 14c0-3.5 3.6-6.5 8-6.5s8 3 8 6.5-3.6 5-8 5-8-1.5-8-5z" />
      <path d="M8.5 10.5l1.5 2.5M12 9.8v3M15.5 10.5L14 13" />
    </>
  ),
  olives: (
    <>
      <ellipse cx="8.5" cy="15" rx="3.5" ry="4.5" />
      <ellipse cx="15.5" cy="14" rx="3.5" ry="4.5" />
      <path d="M12 5c-1.5 1.5-2.5 3.5-3 5.5M12 5c1.5 1 2.6 2.8 3 4.5M12 5c2-1 4.5-.8 6 .5" />
    </>
  ),
  thread: (
    <>
      <path d="M7 5h10M7 19h10M8.5 5v14M15.5 5v14" />
      <path d="M8.5 8l7 2M8.5 11l7 2M8.5 14l7 2" />
    </>
  ),
  lamp: (
    <>
      <path d="M3.5 14c3 2 12 2 15.5-.5l1.5-2.5h-4c-3 1.5-9 1.5-13 3z" />
      <path d="M20 11c.5-2.5-.5-4.5-2-5.5.3 2-.6 3.3-1.5 4.5M8 17.5h7" />
    </>
  ),
  cloak: (
    <>
      <path d="M9 4h6l1 3c2.5 1 4 3.5 4 6.5V20H4v-6.5C4 10.5 5.5 8 8 7z" />
      <path d="M12 7v13M9 4c.5 2 1.5 3 3 3s2.5-1 3-3" />
    </>
  ),
  map: (
    <>
      <path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/** Items name their icon with an emoji in content; draw it in the game's own style. */
const ITEM_ICONS: Record<string, IconName> = {
  '🏺': 'jar',
  '✉️': 'letter',
  '🪙': 'coins',
  '💧': 'water',
  '🍞': 'bread',
  '🫒': 'olives',
  '🧵': 'thread',
  '🪔': 'lamp',
  '🧣': 'cloak',
  '🗺️': 'map',
};

export function ItemIcon({ icon }: { icon: string }) {
  const name = ITEM_ICONS[icon];
  if (name) return <Icon name={name} className="item-icon" />;
  return (
    <span className="item-icon item-icon--emoji" aria-hidden="true">
      {icon}
    </span>
  );
}
