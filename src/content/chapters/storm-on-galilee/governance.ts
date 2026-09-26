import type { Governance } from '@/domain/content-records';
import { aiDraft } from '../../shared/governance';

/**
 * Governance for Chapter 2's records: the shared AI-draft preset, dated and
 * described for this chapter. NOTHING here is approved — approval needs a
 * named human reviewer (docs/content-governance.md).
 */
const DRAFTED = '2026-09-25';

export function draft(options: Parameters<typeof aiDraft>[0]): Governance {
  const g = aiDraft(options);
  return {
    ...g,
    history: [
      {
        version: 1,
        date: DRAFTED,
        author: 'Claude (AI-assisted draft)',
        summary: options.sourced
          ? 'Drafted for Chapter 2; sources retrieved and checked by an AI research assistant. Needs human citation verification and review.'
          : 'Drafted for Chapter 2. Needs human review.',
      },
    ],
  };
}

/** Fictional narrative (not educational). */
export const STORY = draft({ confidence: 'not-applicable' });
