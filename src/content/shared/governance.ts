import type { Governance, HistoricalConfidence } from '@/domain/content-records';

/**
 * Governance presets for content drafted in this vertical slice.
 *
 * Everything educational here was drafted with AI assistance. Records whose
 * claims were checked against retrieved sources are marked
 * 'sources-attached'; NOTHING is marked approved, because approval requires
 * a named human reviewer (docs/content-governance.md). In "preview" content
 * mode the UI labels these "Awaiting editorial review".
 */
export const DRAFT_DATE = '2026-09-24';

interface DraftOptions {
  confidence: HistoricalConfidence;
  sensitivity?: Governance['denominationalSensitivity'];
  sensitivityNote?: string;
  ageLevel?: Governance['ageLevel'];
  notes?: string;
  sourced?: boolean;
}

export function aiDraft(options: DraftOptions): Governance {
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
        date: DRAFT_DATE,
        author: 'Claude (AI-assisted draft)',
        summary: options.sourced
          ? 'Drafted for the vertical slice; sources retrieved and checked by an AI research assistant. Needs human citation verification and review.'
          : 'Drafted for the vertical slice. Needs human review.',
      },
    ],
  };
  if (options.sensitivityNote) g.sensitivityNote = options.sensitivityNote;
  if (options.notes) g.editorialNotes = options.notes;
  return g;
}

/** Fictional narrative (not educational; publishable without theological review). */
export const FICTION = aiDraft({ confidence: 'not-applicable', ageLevel: '10+' });
