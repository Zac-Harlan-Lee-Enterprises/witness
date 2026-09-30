import type { ChapterInput } from '@/domain/chapter';

/**
 * Editorial approvals by named humans (mirrored in the approval log in
 * docs/content-governance.md). An approval covers every record of the
 * chapters it names that is still awaiting review AND was drafted, and last
 * changed, on or before the approval's date (every entry in the record's
 * history): each becomes `approved`, naming its reviewer and date. A record
 * drafted or revised later (new content added to an approved chapter) is not
 * covered: it stays awaiting review until a named person approves it.
 * Provenance is unchanged (the content stays recorded as AI-assisted).
 * Rejected records stay rejected.
 *
 * Only a named person adds an entry here; an agent never approves content.
 */
export interface Approval {
  reviewer: string;
  date: string;
  chapters: readonly string[];
  note: string;
}

export const APPROVALS: readonly Approval[] = [
  {
    reviewer: 'Zac Harlan',
    date: '2026-09-26',
    chapters: ['road-to-jericho', 'storm-on-galilee', 'journey-to-bethlehem', 'letter-from-paul'],
    note: 'The owner approved the AI-drafted content of all four chapters.',
  },
];

/**
 * Approvals of a chapter's teaser words, given on their own. The approval of
 * 2026-09-26 above came before the teasers were written and does not cover
 * them: a teaser's record stays in review until a named person approves it
 * here (and in the approval log). Only a named person adds an entry.
 */
export const TEASER_APPROVALS: readonly Approval[] = [
  {
    reviewer: 'Zac Harlan',
    date: '2026-09-27',
    chapters: ['road-to-jericho'],
    note: 'The owner approved the Chapter 1 teaser script ("script is approved"): exactly the words pinned in tests/content/teaser.test.ts. A change to them needs his approval again.',
  },
];

type Records = ChapterInput['records'];
type ContentRecordInput = Records[number];

/** A teaser's record, approved only if TEASER_APPROVALS names its chapter. */
export function withTeaserApproval(
  chapterId: string,
  record: ContentRecordInput,
  approvals: readonly Approval[] = TEASER_APPROVALS,
): ContentRecordInput {
  const approval = approvals.find((a) => a.chapters.includes(chapterId));
  if (!approval || record.governance.status === 'rejected') return record;
  return {
    ...record,
    governance: {
      ...record.governance,
      status: 'approved',
      reviewer: approval.reviewer,
      reviewedAt: approval.date,
    },
  };
}

/** When a record was first drafted: the date of its first history entry. */
export function draftedOn(record: ContentRecordInput): string {
  return record.governance.history[0]?.date ?? '';
}

/**
 * Whether an approval can cover a record: only if the record was drafted, and
 * last changed, on or before the day of the approval. Text written or revised
 * after it (the longer chapters, for example) waits for a new approval.
 */
export function coveredBy(approval: Approval, record: ContentRecordInput): boolean {
  return record.governance.history.every((h) => h.date <= approval.date);
}

export function withApprovals(
  chapterId: string,
  records: Records,
  approvals: readonly Approval[] = APPROVALS,
): Records {
  const approval = approvals.find((a) => a.chapters.includes(chapterId));
  if (!approval) return records;
  return records.map((r) => {
    const status = r.governance.status;
    if (status === 'approved' || status === 'published' || status === 'rejected') return r;
    if (!coveredBy(approval, r)) return r;
    return {
      ...r,
      governance: {
        ...r.governance,
        status: 'approved',
        reviewer: approval.reviewer,
        reviewedAt: approval.date,
      },
    };
  });
}
