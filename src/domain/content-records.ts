import { z } from 'zod';
import { ScriptureRefSchema } from './scripture';

/**
 * The content-integrity model.
 *
 * Every piece of educational or narrative text the player reads is (or
 * belongs to) a ContentRecord with an explicit KIND, so the UI can always
 * label it and the validator can enforce the rules for each kind:
 *
 *   scripture       — a Scripture reference; text only from an approved translation
 *   paraphrase      — a retelling of Scripture in our words; must cite the passage
 *   historical      — historical / cultural background; must cite sources
 *   reconstruction  — plausible historical reconstruction; must cite + state confidence
 *   interpretation  — interpretive commentary; must flag denominational sensitivity
 *   fiction         — the game's fictional narrative
 *   instruction     — gameplay instruction
 */
export const CONTENT_KINDS = [
  'scripture',
  'paraphrase',
  'historical',
  'reconstruction',
  'interpretation',
  'fiction',
  'instruction',
] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  scripture: 'Scripture',
  paraphrase: 'Scripture paraphrase',
  historical: 'Historical background',
  reconstruction: 'Historical reconstruction',
  interpretation: 'Interpretation',
  fiction: 'Story (fiction)',
  instruction: 'How to play',
};

/** Kinds that make claims about the real world and therefore need review. */
export const EDUCATIONAL_KINDS: readonly ContentKind[] = [
  'scripture',
  'paraphrase',
  'historical',
  'reconstruction',
  'interpretation',
];

/**
 * Editorial workflow (docs/content-governance.md):
 * AI Draft → Source Retrieval → Citation Verification → Automated Validation
 *   → Human Review → Approval → Versioned Publication
 */
export const REVIEW_STATUSES = [
  'ai-draft',
  'human-draft',
  'sources-attached',
  'citations-verified',
  'validated',
  'in-review',
  'approved',
  'published',
  'rejected',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const HISTORICAL_CONFIDENCE = [
  'established',
  'probable',
  'possible',
  'tradition',
  'uncertain',
  'not-applicable',
] as const;
export type HistoricalConfidence = (typeof HISTORICAL_CONFIDENCE)[number];

export const SourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['scripture', 'ancient-primary', 'reference-work', 'scholarly', 'web', 'museum']),
  author: z.string().optional(),
  url: z.string().url().optional(),
  locator: z.string().optional(),
  accessed: z.string().optional(),
  /** true only when someone actually retrieved the source and checked the claim against it. */
  verified: z.boolean(),
  note: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const VersionEntrySchema = z.object({
  version: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  author: z.string().min(1),
  summary: z.string().min(1),
});

export const GovernanceSchema = z.object({
  status: z.enum(REVIEW_STATUSES),
  provenance: z.enum(['ai-assisted', 'human', 'mixed']),
  reviewer: z.string().optional(),
  reviewedAt: z.string().optional(),
  ageLevel: z.enum(['all', '8+', '10+', '13+']),
  denominationalSensitivity: z.enum(['none', 'low', 'moderate', 'high']),
  sensitivityNote: z.string().optional(),
  historicalConfidence: z.enum(HISTORICAL_CONFIDENCE),
  editorialNotes: z.string().optional(),
  version: z.number().int().positive(),
  history: z.array(VersionEntrySchema).min(1),
});
export type Governance = z.infer<typeof GovernanceSchema>;

export const ContentRecordSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(CONTENT_KINDS),
  title: z.string().min(1),
  /** Body text. For kind 'scripture' this MUST be absent — text comes from the provider. */
  body: z.string().min(1).optional(),
  scripture: z.array(ScriptureRefSchema).optional(),
  /** Translation a paraphrase was checked against (metadata only). */
  checkedAgainstTranslation: z.string().optional(),
  sources: z.array(z.string()).default([]),
  governance: GovernanceSchema,
});
export type ContentRecord = z.infer<typeof ContentRecordSchema>;

export interface RecordIssue {
  recordId: string;
  message: string;
}

/**
 * Integrity rules per content kind. Returned as data so both the build-time
 * validator and unit tests can use them.
 */
export function checkRecordIntegrity(
  record: ContentRecord,
  knownSources: ReadonlySet<string>,
): RecordIssue[] {
  const issues: RecordIssue[] = [];
  const add = (message: string): void => {
    issues.push({ recordId: record.id, message });
  };
  const g = record.governance;

  record.sources.forEach((s) => {
    if (!knownSources.has(s)) add(`references unknown source '${s}'`);
  });

  switch (record.kind) {
    case 'scripture':
      if (record.body)
        add('scripture records must not embed verse text; use a ScriptureTextProvider');
      if (!record.scripture?.length) add('scripture records need at least one scripture reference');
      break;
    case 'paraphrase':
      if (!record.scripture?.length) add('paraphrases must cite the passage they paraphrase');
      if (!record.body) add('paraphrases need body text');
      break;
    case 'historical':
    case 'reconstruction':
      if (!record.body) add(`${record.kind} records need body text`);
      if (record.sources.length === 0 && !record.scripture?.length)
        add(`${record.kind} records must cite at least one source or scripture reference`);
      if (g.historicalConfidence === 'not-applicable')
        add(`${record.kind} records must state a historical-confidence level`);
      break;
    case 'interpretation':
      if (!record.body) add('interpretation records need body text');
      if (g.denominationalSensitivity !== 'none' && !g.sensitivityNote)
        add('interpretations flagged as sensitive must explain the sensitivity');
      break;
    case 'fiction':
    case 'instruction':
      if (record.scripture?.length && record.kind === 'fiction')
        add('fiction records must not carry scripture references (use a paraphrase record)');
      break;
  }

  if ((g.status === 'approved' || g.status === 'published') && !g.reviewer)
    add('approved/published records must name a human reviewer');
  if (g.history[g.history.length - 1]?.version !== g.version)
    add('governance.version must match the latest history entry');
  return issues;
}

/** True when the record may be shown without an "awaiting review" label. */
export function isPublishable(record: ContentRecord): boolean {
  if (!EDUCATIONAL_KINDS.includes(record.kind)) return true;
  return record.governance.status === 'approved' || record.governance.status === 'published';
}

const NEXT_STATUS: Partial<Record<ReviewStatus, readonly ReviewStatus[]>> = {
  'ai-draft': ['sources-attached', 'rejected'],
  'human-draft': ['sources-attached', 'rejected'],
  'sources-attached': ['citations-verified', 'rejected'],
  'citations-verified': ['validated', 'rejected'],
  validated: ['in-review', 'rejected'],
  'in-review': ['approved', 'rejected'],
  approved: ['published', 'rejected'],
  rejected: ['ai-draft', 'human-draft'],
};

export class GovernanceTransitionError extends Error {}

/**
 * Advance a record through the editorial workflow. AI-drafted content can
 * never jump straight to approval/publication — every step is required, and
 * approval requires a named human reviewer.
 */
export function transitionReview(
  governance: Governance,
  to: ReviewStatus,
  change: { date: string; author: string; reviewer?: string; summary: string },
): Governance {
  const allowed = NEXT_STATUS[governance.status] ?? [];
  if (!allowed.includes(to)) {
    throw new GovernanceTransitionError(
      `Cannot move from '${governance.status}' to '${to}'. Allowed: ${allowed.join(', ') || 'none'}`,
    );
  }
  if (to === 'approved' && !change.reviewer) {
    throw new GovernanceTransitionError('Approval requires a named human reviewer.');
  }
  const version = to === 'published' ? governance.version + 1 : governance.version;
  const history =
    to === 'published'
      ? [
          ...governance.history,
          { version, date: change.date, author: change.author, summary: change.summary },
        ]
      : governance.history;
  return {
    ...governance,
    status: to,
    reviewer: to === 'approved' ? change.reviewer : governance.reviewer,
    reviewedAt: to === 'approved' ? change.date : governance.reviewedAt,
    version,
    history,
  };
}
