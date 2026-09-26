import type { Governance, HistoricalConfidence } from '@/domain/content-records';

/**
 * Governance presets for Chapter 4. Everything educational was drafted with
 * AI assistance. Records whose claims were checked against retrieved sources
 * are 'sources-attached'; NOTHING is approved — approval needs a named human
 * reviewer (docs/content-governance.md).
 */
const DRAFTED = '2026-09-25';

interface DraftOptions {
  confidence: HistoricalConfidence;
  sensitivity?: Governance['denominationalSensitivity'];
  sensitivityNote?: string;
  ageLevel?: Governance['ageLevel'];
  notes?: string;
  sourced?: boolean;
}

export function draft(options: DraftOptions): Governance {
  const g: Governance = {
    status: options.sourced ? 'sources-attached' : 'ai-draft',
    provenance: 'ai-assisted',
    ageLevel: options.ageLevel ?? '10+',
    denominationalSensitivity: options.sensitivity ?? 'none',
    historicalConfidence: options.confidence,
    version: 1,
    history: [
      {
        version: 1,
        date: DRAFTED,
        author: 'Claude (AI-assisted draft)',
        summary: options.sourced
          ? 'Drafted for Chapter 4; sources retrieved and checked by an AI research assistant (docs/research/letter-from-paul-sources.md). Needs human citation verification and review.'
          : 'Drafted for Chapter 4. Needs human review.',
      },
    ],
  };
  if (options.sensitivityNote) g.sensitivityNote = options.sensitivityNote;
  if (options.notes) g.editorialNotes = options.notes;
  return g;
}

/** The chapter's own fictional story (not educational). */
export const STORY = draft({ confidence: 'not-applicable' });
