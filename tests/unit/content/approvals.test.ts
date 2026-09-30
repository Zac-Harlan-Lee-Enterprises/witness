import { describe, expect, it } from 'vitest';
import { APPROVALS, draftedOn, withApprovals, type Approval } from '@/content/shared/approvals';
import { aiDraft, draftOn, LONGER_CHAPTERS_DRAFTED } from '@/content/shared/governance';
import type { ChapterInput } from '@/domain/chapter';

type RecordInput = ChapterInput['records'][number];

const record = (id: string, date: string, status?: 'rejected'): RecordInput => {
  const g = draftOn(date, 'Drafted for a test.', { confidence: 'not-applicable' });
  return {
    id,
    kind: 'fiction',
    title: id,
    body: 'A story.',
    sources: [],
    governance: status ? { ...g, status } : g,
  };
};

const approval: Approval = {
  reviewer: 'A. Reviewer',
  date: '2026-09-26',
  chapters: ['a-chapter'],
  note: 'Test approval.',
};

describe('editorial approvals', () => {
  it('approve what was drafted on or before the approval’s date, naming the reviewer', () => {
    const [before, same] = withApprovals(
      'a-chapter',
      [record('before', '2026-09-24'), record('same', '2026-09-26')],
      [approval],
    );
    for (const r of [before, same]) {
      expect(r?.governance.status, r?.id).toBe('approved');
      expect(r?.governance.reviewer).toBe('A. Reviewer');
      expect(r?.governance.reviewedAt).toBe('2026-09-26');
      expect(r?.governance.provenance).toBe('ai-assisted');
    }
  });

  it('never approve content drafted after the approval: it stays an AI draft awaiting review', () => {
    const later = record('later', '2026-09-30');
    const [r] = withApprovals('a-chapter', [later], [approval]);
    expect(r).toBe(later);
    expect(r?.governance.status).toBe('ai-draft');
    expect(r?.governance.reviewer).toBeUndefined();
  });

  it('leave rejected records and other chapters alone', () => {
    const rejected = record('rejected', '2026-09-24', 'rejected');
    expect(withApprovals('a-chapter', [rejected], [approval])[0]).toBe(rejected);
    const elsewhere = record('elsewhere', '2026-09-24');
    expect(withApprovals('another-chapter', [elsewhere], [approval])[0]).toBe(elsewhere);
  });

  it('dates new drafts by their first history entry', () => {
    expect(draftedOn(record('x', '2026-09-30'))).toBe('2026-09-30');
    const g = aiDraft({ confidence: 'not-applicable' });
    expect(g.history[0]?.date).toBe('2026-09-24');
  });

  it('the longer chapters were drafted after every approval that names them', () => {
    for (const a of APPROVALS.filter((x) =>
      x.chapters.some((c) => c === 'road-to-jericho' || c === 'storm-on-galilee'),
    ))
      expect(LONGER_CHAPTERS_DRAFTED > a.date, a.date).toBe(true);
  });
});
