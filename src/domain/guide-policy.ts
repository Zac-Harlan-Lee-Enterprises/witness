/**
 * Policy for a FUTURE retrieval-augmented study guide (not implemented in the
 * vertical slice — see docs/content-governance.md §6 "AI governance"). The policy is defined now so any
 * future implementation is held to it by tests from day one.
 *
 * A guide answer is acceptable only if it:
 *  - cites at least one source, and only APPROVED sources;
 *  - states its uncertainty;
 *  - labels whether it is Scripture, history or interpretation;
 *  - never speaks as God, Jesus, a prophet or a spiritual authority;
 *  - refuses rather than guessing when sources are insufficient.
 */
export type GuideAnswer =
  | {
      kind: 'answer';
      text: string;
      category: 'scripture' | 'historical' | 'interpretation';
      citations: Array<{ sourceId: string; locator?: string }>;
      uncertainty: 'low' | 'medium' | 'high';
      /** When interpretation: note that Christian traditions may differ. */
      traditionsDiffer: boolean;
    }
  | { kind: 'refusal'; reason: 'insufficient-sources' | 'out-of-scope' | 'unavailable' };

const FORBIDDEN_PERSONA =
  /\b(I am (God|Jesus|the Lord|a prophet|the Holy Spirit)|thus says the Lord|God (told|tells) me|I speak for God)\b/i;

export interface GuidePolicyViolation {
  rule: string;
  detail: string;
}

export function checkGuideAnswer(
  answer: GuideAnswer,
  approvedSourceIds: ReadonlySet<string>,
): GuidePolicyViolation[] {
  if (answer.kind === 'refusal') return [];
  const violations: GuidePolicyViolation[] = [];
  if (answer.citations.length === 0) {
    violations.push({
      rule: 'must-cite',
      detail: 'Answers must cite at least one approved source.',
    });
  }
  answer.citations
    .filter((c) => !approvedSourceIds.has(c.sourceId))
    .forEach((c) =>
      violations.push({
        rule: 'approved-sources-only',
        detail: `Source '${c.sourceId}' is not approved.`,
      }),
    );
  if (FORBIDDEN_PERSONA.test(answer.text)) {
    violations.push({
      rule: 'no-divine-persona',
      detail: 'The guide must never speak as God, Jesus, a prophet or a spiritual authority.',
    });
  }
  if (answer.category === 'interpretation' && !answer.traditionsDiffer) {
    violations.push({
      rule: 'mark-interpretation',
      detail: 'Interpretive answers must acknowledge that Christian traditions may differ.',
    });
  }
  return violations;
}
