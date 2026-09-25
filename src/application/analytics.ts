import type { DomainEvent } from '@/domain/events';
import type { AnalyticsEvent, AnalyticsProvider } from './ports';

/**
 * Consent-gated, provider-independent analytics.
 *
 * - Off unless the player (or parent/teacher) opts in under Settings.
 * - Only the whitelisted events and properties below can ever leave the
 *   service; identifiers must be short slugs, so free text such as
 *   reflections, names or journal notes cannot be smuggled through.
 * - Works with no provider at all (NoopAnalytics).
 */
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

const ALLOWED_PROPS: Record<AnalyticsEvent['name'], Record<string, 'slug' | 'int'>> = {
  ChapterStarted: { chapterId: 'slug' },
  ChapterCompleted: { chapterId: 'slug', minutesBucket: 'slug' },
  PuzzleAttempted: { puzzleId: 'slug', attempt: 'int' },
  PuzzleCompleted: { puzzleId: 'slug', attempts: 'int', hintsUsed: 'int' },
  HintRequested: { puzzleId: 'slug', tier: 'int' },
  AccessibilityFeatureEnabled: { feature: 'slug' },
  SaveRestored: { fromSchemaVersion: 'int' },
  OptionalQuestCompleted: { questId: 'slug' },
};

/** Returns a clean copy or null if anything is out of policy. */
export function sanitizeAnalyticsEvent(event: AnalyticsEvent): AnalyticsEvent | null {
  const allowed = ALLOWED_PROPS[event.name] as Record<string, 'slug' | 'int'> | undefined;
  if (!allowed) return null;
  const props: Record<string, string | number> = {};
  for (const [key, kind] of Object.entries(allowed)) {
    const value = (event.props as Record<string, unknown>)[key];
    if (kind === 'slug') {
      if (typeof value !== 'string' || !SLUG.test(value)) return null;
      props[key] = value;
    } else {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10_000)
        return null;
      props[key] = value;
    }
  }
  return { name: event.name, props } as AnalyticsEvent;
}

export function minutesBucket(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 15) return 'under-15';
  if (minutes < 25) return '15-25';
  if (minutes < 35) return '25-35';
  if (minutes < 50) return '35-50';
  return 'over-50';
}

export class AnalyticsService {
  constructor(
    private readonly provider: AnalyticsProvider,
    private readonly consent: () => boolean,
  ) {}

  track(event: AnalyticsEvent): void {
    if (!this.consent()) return;
    const clean = sanitizeAnalyticsEvent(event);
    if (clean) this.provider.track(clean);
  }

  /** Map domain events to the anonymous analytics vocabulary. */
  fromDomainEvent(
    event: DomainEvent,
    context: { playTimeMs: number; isSideQuest: (id: string) => boolean },
  ): void {
    switch (event.type) {
      case 'ChapterStarted':
        this.track({ name: 'ChapterStarted', props: { chapterId: event.chapterId } });
        break;
      case 'ChapterCompleted':
        this.track({
          name: 'ChapterCompleted',
          props: { chapterId: event.chapterId, minutesBucket: minutesBucket(context.playTimeMs) },
        });
        break;
      case 'PuzzleAttempted':
        this.track({
          name: 'PuzzleAttempted',
          props: { puzzleId: event.puzzleId, attempt: event.attempt },
        });
        break;
      case 'PuzzleCompleted':
        this.track({
          name: 'PuzzleCompleted',
          props: { puzzleId: event.puzzleId, attempts: event.attempts, hintsUsed: event.hintsUsed },
        });
        break;
      case 'HintRequested':
        this.track({
          name: 'HintRequested',
          props: { puzzleId: event.puzzleId, tier: event.tier },
        });
        break;
      case 'SaveRestored':
        this.track({ name: 'SaveRestored', props: { fromSchemaVersion: event.fromSchemaVersion } });
        break;
      case 'QuestCompleted':
        if (context.isSideQuest(event.questId))
          this.track({ name: 'OptionalQuestCompleted', props: { questId: event.questId } });
        break;
      default:
        break;
    }
  }
}
