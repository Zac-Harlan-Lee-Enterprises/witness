import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function systemPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(QUERY).matches);
}

/** Resolve the reduced-motion setting against the device preference. */
export function prefersReducedMotionSetting(setting: 'system' | 'on' | 'off'): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return systemPrefersReducedMotion();
}

function subscribe(onChange: () => void): () => void {
  const media = typeof window !== 'undefined' ? window.matchMedia?.(QUERY) : undefined;
  if (!media) return () => undefined;
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * The device's reduced-motion preference, live: components re-render when
 * the player changes it in their operating system during play.
 */
export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, systemPrefersReducedMotion, () => false);
}
