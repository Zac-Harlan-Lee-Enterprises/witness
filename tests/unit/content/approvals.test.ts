import { describe, expect, it } from 'vitest';
import type { ChapterInput } from '@/domain/chapter';
import { aiDraft } from '@/content/shared/governance';
import { coveredBy, withApprovals, type Approval } from '@/content/shared/approvals';

type RecordInput = ChapterInput['records'][number];

const APPROVAL: Approval = {
  reviewer: 'A. Reviewer',
  date: '2026-09-26',
  chapters: ['some-chapter'],
  note: 'test',
};

function drafted(id: string, ...dates: string[]): RecordInput {
  const g = aiDraft({ confidence: 'not-applicable' });
  return {
    id,
    kind: 'fiction',
    title: id,
    body: 'A story.',
    sources: [],
    governance: {
      ...g,
      version: dates.length,
      history: dates.map((date, i) => ({
        version: i + 1,
        date,
        author: 'Claude (AI-assisted draft)',
        summary: 'Drafted.',
      })),
    },
  };
}

describe('an approval covers only what existed when it was given', () => {
  it('approves records drafted on or before its date', () => {
    const [before, same] = withApprovals(
      'some-chapter',
      [drafted('before', '2026-09-25'), drafted('same', '2026-09-26')],
      [APPROVAL],
    );
    expect(before?.governance).toMatchObject({
      status: 'approved',
      reviewer: 'A. Reviewer',
      reviewedAt: '2026-09-26',
    });
    expect(same?.governance.status).toBe('approved');
  });

  it('leaves text drafted after it in review, never self-approved', () => {
    const later = drafted('later', '2026-09-30');
    expect(coveredBy(APPROVAL, later)).toBe(false);
    const [kept] = withApprovals('some-chapter', [later], [APPROVAL]);
    expect(kept?.governance.status).toBe('ai-draft');
    expect(kept?.governance.reviewer).toBeUndefined();
    expect(kept?.governance.reviewedAt).toBeUndefined();
  });

  it('leaves a record revised after it in review, even if first drafted before', () => {
    const revised = drafted('revised', '2026-09-25', '2026-09-30');
    expect(coveredBy(APPROVAL, revised)).toBe(false);
    expect(withApprovals('some-chapter', [revised], [APPROVAL])[0]?.governance.status).toBe(
      'ai-draft',
    );
  });

  it('only covers the chapters it names', () => {
    const [other] = withApprovals('other-chapter', [drafted('x', '2026-09-25')], [APPROVAL]);
    expect(other?.governance.status).toBe('ai-draft');
  });
});
