/** Resolve the reduced-motion setting against the device preference. */
export function prefersReducedMotionSetting(setting: 'system' | 'on' | 'off'): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return (
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );
}
