import type { PlayerLook } from '@/domain/characters';
import { checkDisplayName, PlayerProfileSchema, type PlayerProfile } from '@/domain/profile';
import { createId } from '@/shared/ids';
import type { Logger } from '@/shared/logger';
import type { Clock, ProfileRepository, SaveRepository } from './ports';

export type ProfileResult = { ok: true; profile: PlayerProfile } | { ok: false; reason: string };

export const MAX_PROFILES = 8;

/** Multiple local profiles for families and classrooms sharing a device. */
export class ProfileService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly saves: SaveRepository,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async list(): Promise<PlayerProfile[]> {
    const raws = await this.profiles.listRaw();
    const valid: PlayerProfile[] = [];
    for (const raw of raws) {
      const parsed = PlayerProfileSchema.safeParse(raw);
      if (parsed.success) valid.push(parsed.data);
      else this.logger.warn('Skipping invalid stored profile');
    }
    return valid.sort((a, b) =>
      (b.lastPlayedAt ?? b.createdAt).localeCompare(a.lastPlayedAt ?? a.createdAt),
    );
  }

  async create(rawName: string, look: PlayerLook): Promise<ProfileResult> {
    const name = checkDisplayName(rawName);
    if (!name.ok) return name;
    const existing = await this.list();
    if (existing.length >= MAX_PROFILES)
      return {
        ok: false,
        reason: `This device already has ${MAX_PROFILES} profiles. Remove one first.`,
      };
    if (existing.some((p) => p.displayName.toLowerCase() === name.name.toLowerCase()))
      return { ok: false, reason: 'A profile with that name already exists.' };
    const profile: PlayerProfile = {
      id: createId('profile'),
      displayName: name.name,
      look,
      createdAt: new Date(this.clock.now()).toISOString(),
      lastPlayedAt: null,
      completedChapters: [],
      seenTeasers: [],
    };
    await this.profiles.put(profile);
    return { ok: true, profile };
  }

  async rename(profile: PlayerProfile, rawName: string): Promise<ProfileResult> {
    const name = checkDisplayName(rawName);
    if (!name.ok) return name;
    const updated = { ...profile, displayName: name.name };
    await this.profiles.put(updated);
    return { ok: true, profile: updated };
  }

  async touch(profile: PlayerProfile): Promise<PlayerProfile> {
    const updated = { ...profile, lastPlayedAt: new Date(this.clock.now()).toISOString() };
    await this.profiles.put(updated);
    return updated;
  }

  async markChapterComplete(profile: PlayerProfile, chapterId: string): Promise<PlayerProfile> {
    if (profile.completedChapters.includes(chapterId)) return profile;
    const updated = { ...profile, completedChapters: [...profile.completedChapters, chapterId] };
    await this.profiles.put(updated);
    return updated;
  }

  /** Remember that this profile has seen a chapter's teaser (watched or skipped). */
  async markTeaserSeen(profile: PlayerProfile, chapterId: string): Promise<PlayerProfile> {
    if (profile.seenTeasers.includes(chapterId)) return profile;
    const updated = { ...profile, seenTeasers: [...profile.seenTeasers, chapterId] };
    await this.profiles.put(updated);
    return updated;
  }

  /** Deletes the profile AND all of its saves. */
  async remove(profileId: string): Promise<void> {
    await this.saves.deleteForProfile(profileId);
    await this.profiles.delete(profileId);
  }
}
