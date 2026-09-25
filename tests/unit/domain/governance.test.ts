import { describe, expect, it } from 'vitest';
import {
  checkRecordIntegrity,
  ContentRecordSchema,
  GovernanceTransitionError,
  isPublishable,
  transitionReview,
  type ContentRecord,
  type Governance,
} from '@/domain/content-records';
import { formatScriptureRef, parseScriptureRef, scripturePlaceholder } from '@/domain/scripture';

const governance = (patch: Partial<Governance> = {}): Governance => ({
  status: 'ai-draft',
  provenance: 'ai-assisted',
  ageLevel: '10+',
  denominationalSensitivity: 'none',
  historicalConfidence: 'established',
  version: 1,
  history: [{ version: 1, date: '2026-09-24', author: 'test', summary: 'draft' }],
  ...patch,
});

const record = (patch: Partial<ContentRecord>): ContentRecord =>
  ContentRecordSchema.parse({
    id: 'r',
    kind: 'historical',
    title: 't',
    body: 'b',
    sources: ['s'],
    governance: governance(),
    ...patch,
  });

describe('content integrity rules', () => {
  const sources = new Set(['s']);

  it('forbids embedding verse text in scripture records', () => {
    const r = record({
      kind: 'scripture',
      body: 'In the beginning…',
      scripture: [{ book: 'Genesis', chapter: 1, verseStart: 1 }],
    });
    expect(checkRecordIntegrity(r, sources).map((i) => i.message)).toContain(
      'scripture records must not embed verse text; use a ScriptureTextProvider',
    );
  });

  it('requires paraphrases to cite the passage', () => {
    const r = record({ kind: 'paraphrase', scripture: undefined });
    expect(
      checkRecordIntegrity(r, sources).some((i) => i.message.includes('must cite the passage')),
    ).toBe(true);
  });

  it('requires historical claims to cite sources and state confidence', () => {
    const r = record({
      sources: [],
      scripture: undefined,
      governance: governance({ historicalConfidence: 'not-applicable' }),
    });
    const messages = checkRecordIntegrity(r, sources).map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'historical records must cite at least one source or scripture reference',
        'historical records must state a historical-confidence level',
      ]),
    );
  });

  it('requires sensitive interpretations to explain themselves', () => {
    const r = record({
      kind: 'interpretation',
      governance: governance({ denominationalSensitivity: 'moderate' }),
    });
    expect(
      checkRecordIntegrity(r, sources).some((i) => i.message.includes('explain the sensitivity')),
    ).toBe(true);
  });

  it('flags unknown sources and approvals without a reviewer', () => {
    const r = record({ sources: ['missing'], governance: governance({ status: 'approved' }) });
    const messages = checkRecordIntegrity(r, sources).map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "references unknown source 'missing'",
        'approved/published records must name a human reviewer',
      ]),
    );
  });

  it('only treats educational content as publishable after human approval', () => {
    expect(isPublishable(record({}))).toBe(false);
    expect(
      isPublishable(record({ governance: governance({ status: 'approved', reviewer: 'Editor' }) })),
    ).toBe(true);
    expect(isPublishable(record({ kind: 'fiction', sources: [] }))).toBe(true);
  });
});

describe('editorial workflow', () => {
  const step = (g: Governance, to: Governance['status'], reviewer?: string) =>
    transitionReview(g, to, {
      date: '2026-09-25',
      author: 'editor',
      summary: to,
      ...(reviewer ? { reviewer } : {}),
    });

  it('never lets an AI draft jump straight to approval or publication', () => {
    expect(() => step(governance(), 'approved', 'Editor')).toThrow(GovernanceTransitionError);
    expect(() => step(governance(), 'published')).toThrow(GovernanceTransitionError);
  });

  it('walks the full pipeline and versions on publication', () => {
    let g = governance();
    g = step(g, 'sources-attached');
    g = step(g, 'citations-verified');
    g = step(g, 'validated');
    g = step(g, 'in-review');
    expect(() => step(g, 'approved')).toThrow(/named human reviewer/);
    g = step(g, 'approved', 'Rev. Example');
    expect(g).toMatchObject({ status: 'approved', reviewer: 'Rev. Example' });
    g = step(g, 'published');
    expect(g.version).toBe(2);
    expect(g.history.at(-1)?.version).toBe(2);
  });
});

describe('scripture references', () => {
  it('formats and parses references', () => {
    const ref = parseScriptureRef('Luke 10:25-37');
    expect(ref).toEqual({ book: 'Luke', chapter: 10, verseStart: 25, verseEnd: 37 });
    if (!ref) throw new Error('reference should parse');
    expect(formatScriptureRef(ref)).toBe('Luke 10:25–37');
    expect(parseScriptureRef('1 john 4:7')).toEqual({ book: '1 John', chapter: 4, verseStart: 7 });
    expect(parseScriptureRef('Hezekiah 3:16')).toBeNull();
    expect(parseScriptureRef('Luke 10:37-25')).toBeNull();
  });

  it('produces the exact placeholder required when no approved translation exists', () => {
    expect(scripturePlaceholder({ book: 'Luke', chapter: 10, verseStart: 25, verseEnd: 37 })).toBe(
      '[SCRIPTURE TEXT REQUIRES APPROVED TRANSLATION — Luke 10:25-37]',
    );
  });
});
