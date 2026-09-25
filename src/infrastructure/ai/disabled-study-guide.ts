import type { StudyGuide } from '@/application/ports';
import type { GuideAnswer } from '@/domain/guide-policy';

/**
 * The vertical slice ships WITHOUT an AI guide or chatbot. This stub is the
 * extension point a future retrieval-augmented guide will replace; any real
 * implementation must pass `checkGuideAnswer` (domain/guide-policy.ts) and
 * must never receive journal or reflection text without explicit permission.
 */
export class DisabledStudyGuide implements StudyGuide {
  readonly available = false;
  async ask(): Promise<GuideAnswer> {
    return { kind: 'refusal', reason: 'unavailable' };
  }
}
