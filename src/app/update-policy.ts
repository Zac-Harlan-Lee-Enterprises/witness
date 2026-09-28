/**
 * When a waiting new version is swapped in by itself (ADR-0006). Outside a
 * chapter (the title, profiles, chapter select, an error) nothing can be
 * interrupted, so it happens at once: players who never pressed "Update now"
 * kept an old version for days. Inside a chapter, or while a teaser or a
 * chapter is loading, it still waits for the player's "Save and update".
 */
const SAFE_SCREENS: ReadonlySet<string> = new Set(['title', 'profiles', 'chapters', 'error']);

export function updatesAtOnce(screen: string): boolean {
  return SAFE_SCREENS.has(screen);
}
