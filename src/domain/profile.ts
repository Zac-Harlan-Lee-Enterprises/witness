import { z } from 'zod';
import { PLAYER_LOOKS } from './characters';

/**
 * A player profile holds the minimum needed for a family or classroom to
 * share a device: a nickname and a look. No email, birthday, real name or
 * account — nothing personal is required (docs/security-privacy.md).
 */
export const PROFILE_NAME_MAX = 20;

export const PlayerProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().trim().min(1).max(PROFILE_NAME_MAX),
  look: z.enum(PLAYER_LOOKS),
  createdAt: z.string().datetime(),
  lastPlayedAt: z.string().datetime().nullable(),
  completedChapters: z.array(z.string()),
  /** Chapters whose teaser this profile has seen (played through or skipped). */
  seenTeasers: z.array(z.string()).default([]),
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

/** Validate a nickname. Letters, numbers, spaces and a little punctuation. */
export function checkDisplayName(raw: string): NameCheck {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0) return { ok: false, reason: 'Please enter a name.' };
  if (name.length > PROFILE_NAME_MAX)
    return { ok: false, reason: `Names can be up to ${PROFILE_NAME_MAX} characters.` };
  if (!/^[\p{L}\p{N} .'-]+$/u.test(name))
    return { ok: false, reason: 'Use letters, numbers, spaces, apostrophes, periods or hyphens.' };
  return { ok: true, name };
}
