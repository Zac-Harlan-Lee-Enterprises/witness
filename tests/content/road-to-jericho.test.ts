import { APPROVALS, draftedOn } from '@/content/shared/approvals';
import { LATER_RECORDS } from '@/content/chapters/road-to-jericho/records';
import { LONGER_CHAPTERS_DRAFTED } from '@/content/shared/governance';
import { checkPacking } from '@/domain/puzzles';
import { makeState } from '../support/state';
import { TEASER_RECORD_ID } from '@/content/chapters/road-to-jericho/teaser';
import { describe, expect, it } from 'vitest';
import { chapterSource, parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { contentReport, reachabilityIssues } from '@/content/validation';
import { validateChapterIntegrity } from '@/domain/chapter-integrity';

const chapter = parseChapter(ROAD_TO_JERICHO);
const allText = (): string[] => [
  ...chapter.dialogues.flatMap((d) =>
    d.nodes.flatMap((n) => [n.text, ...n.choices.map((c) => c.text)]),
  ),
  ...chapter.records.map((r) => r.body ?? ''),
  ...chapter.clues.map((c) => c.text),
  ...chapter.summary.consequences.map((c) => c.text),
  ...chapter.summary.recap.map((c) => c.text),
  ...chapter.scriptureConnection.comparisons.map((c) => c.text),
];

describe('Road to Jericho content', () => {
  it('passes schema and referential integrity validation', () => {
    expect(validateChapterIntegrity(chapter)).toEqual([]);
  });

  it('lets the player reach every interactive thing and exit from every spawn', () => {
    expect(reachabilityIssues(chapter)).toEqual([]);
  });

  it('loads through the lazy chapter registry', async () => {
    const loaded = await chapterSource.load('road-to-jericho');
    expect(loaded.id).toBe('road-to-jericho');
    // Chapters become playable one by one; an id with no content is never loadable.
    await expect(chapterSource.load('no-such-chapter')).rejects.toThrow(/not available/);
  });

  it('includes at least three distinct puzzle types', () => {
    expect(new Set(chapter.puzzles.map((p) => p.type)).size).toBeGreaterThanOrEqual(3);
  });

  it('has a main quest and at least one optional side quest with alternate outcomes', () => {
    expect(chapter.quests.find((q) => q.kind === 'main')?.id).toBe(chapter.mainQuest);
    const side = chapter.quests.filter((q) => q.kind === 'side');
    expect(side.length).toBeGreaterThanOrEqual(1);
    expect(side[0]?.outcomes.some((o) => o.kind !== 'success')).toBe(true);
  });

  it('never embeds verse text in Scripture records and labels every retelling as paraphrase', () => {
    chapter.records
      .filter((r) => r.kind === 'scripture')
      .forEach((r) => expect(r.body).toBeUndefined());
    const paraphraseLines = chapter.dialogues
      .flatMap((d) => d.nodes)
      .filter((n) => /Jesus|teacher told|Samaritan came/.test(n.text) && n.speaker === 'yair');
    paraphraseLines
      .filter((n) => n.id !== 'y6' && n.id !== 'y9' && n.id !== 'y1')
      .forEach((n) => expect(n.kind, `node ${n.id}`).toBe('paraphrase'));
  });

  it('keeps every character fictional and never makes Jesus a character', () => {
    expect(chapter.characters.every((c) => c.fictional && !c.biblicalFigure)).toBe(true);
    expect(chapter.characters.some((c) => /jesus/i.test(c.name))).toBe(false);
    chapter.dialogues
      .flatMap((d) => d.nodes)
      .forEach((n) => expect(n.speaker).not.toMatch(/jesus/i));
  });

  it('contains no faith/holiness/salvation scoring language', () => {
    const text = allText().join('\n');
    expect(text).not.toMatch(
      /\b(faith|holiness|salvation|righteousness) (score|points|meter|level)\b/i,
    );
    expect(text).not.toMatch(/\bgood Christian answer\b/i);
    expect(text).not.toMatch(/\byou (sinned|failed God)\b/i);
  });

  it('does not attribute a motive to the priest or the Levite', () => {
    const text = allText().join('\n').toLowerCase();
    expect(text).not.toMatch(
      /(priest|levite)[^.]{0,80}(because|so that|to avoid)[^.]{0,40}(unclean|purity|defile)/,
    );
  });

  it('is approved by a named human in the approvals log (never self-approved by an agent)', () => {
    const report = contentReport(chapter);
    expect(report.awaitingReview).toBe(0);
    expect(report.approved).toBe(report.educational);
    const reviewers = new Set(APPROVALS.map((a) => a.reviewer));
    // The teaser's words came later and need their own approval
    // (tests/content/teaser.test.ts): that approval doesn't cover them.
    const later = new Set(LATER_RECORDS.map((r) => r.id));
    for (const r of chapter.records.filter((x) => x.id !== TEASER_RECORD_ID && !later.has(x.id))) {
      expect(r.governance.status, r.id).toBe('approved');
      expect(reviewers.has(r.governance.reviewer ?? ''), r.id).toBe(true);
      expect(r.governance.reviewedAt, r.id).toBe('2026-09-26');
      // Approval doesn't rewrite where the content came from.
      expect(r.governance.provenance, r.id).toBe('ai-assisted');
    }
  });

  it('cites only sources that were actually retrieved', () => {
    expect(chapter.sources.every((s) => s.verified && s.url)).toBe(true);
  });

  it('offers a real choice at the injured traveler: at least three options, none a morality button', () => {
    const decide = chapter.dialogues
      .find((d) => d.id === 'd-menashe-road')
      ?.nodes.find((n) => n.id === 'decide');
    expect(decide?.choices.length).toBeGreaterThanOrEqual(3);
    decide?.choices.forEach((c) =>
      expect(c.text).not.toMatch(/\b(good|evil|right thing|wrong thing|sin)\b/i),
    );
  });

  it('keeps what was added after the approval (the longer chapter) awaiting review, never approved', () => {
    expect(LATER_RECORDS.length).toBeGreaterThanOrEqual(6);
    for (const r of LATER_RECORDS) {
      const loaded = chapter.records.find((x) => x.id === r.id);
      expect(loaded?.kind, r.id).toBe('fiction');
      expect(draftedOn(r), r.id).toBe(LONGER_CHAPTERS_DRAFTED);
      expect(loaded?.governance.status, r.id).toBe('ai-draft');
      expect(loaded?.governance.reviewer, r.id).toBeUndefined();
    }
    // Every new person, errand and discovery is labelled story.
    for (const id of ['rec-p-eli', 'rec-e-linen', 'rec-e-eli', 'rec-e-cloak', 'rec-e-natan'])
      expect(
        LATER_RECORDS.some((r) => r.id === id),
        id,
      ).toBe(true);
  });

  it('packs Rivka’s linen with the remedy: the satchel still has room to choose', () => {
    const satchel = chapter.puzzles.find((p) => p.id === 'p-satchel');
    if (satchel?.type !== 'packing') throw new Error('expected packing');
    const weight = (id: string) => chapter.items.find((i) => i.id === id)?.weight ?? 0;
    const known = makeState({ clues: ['clue-cistern'] });
    const load = { remedy: 1, 'linen-bundle': 1, 'water-skin': 1, bread: 1, lamp: 1 };
    expect(checkPacking(satchel, load, known, weight).valid).toBe(true);
    // Without knowing about the cistern, two water skins fill the satchel exactly.
    const cautious = { remedy: 1, 'linen-bundle': 1, 'water-skin': 2 };
    expect(checkPacking(satchel, cautious, makeState(), weight).valid).toBe(true);
    expect(chapter.items.find((i) => i.id === 'linen-bundle')?.essential).toBe(true);
  });

  it('lets the cloak be identified from the cloak itself, even by a player who skipped the road’s clues', () => {
    const cloak = chapter.puzzles.find((p) => p.id === 'p-cloak');
    if (cloak?.type !== 'deduction') throw new Error('expected deduction');
    const fromTheCloak = ['clue-cloak-hem', 'clue-cloak-oil'];
    const backing = cloak.evidence.filter(
      (e) =>
        fromTheCloak.includes(e.clueId) &&
        e.reliable &&
        e.bearsOn.some((b) => b.option === cloak.answer && b.stance === 'supports'),
    );
    expect(backing.length).toBeGreaterThanOrEqual(cloak.requiredEvidence);
    // Salome's shrug is marked for what it is.
    expect(cloak.evidence.find((e) => e.clueId === 'clue-blue-stripes')?.reliable).toBe(false);
    expect(chapter.clues.find((c) => c.id === 'clue-blue-stripes')?.reliability).toBe('unreliable');
  });

  it('keeps the new people fictional and gives each a story record', () => {
    const eli = chapter.characters.find((c) => c.id === 'eli');
    expect(eli?.fictional).toBe(true);
    expect(eli?.biblicalFigure).toBe(false);
    for (const c of chapter.characters.filter((x) => x.journalEntry))
      expect(chapter.records.find((r) => r.id === `rec-p-${c.id}`)?.kind, c.id).toBe('fiction');
  });

  it('makes the new choices real ones, never morality buttons', () => {
    const texts = chapter.dialogues
      .filter((d) => ['d-eli', 'd-menashe-road', 'd-natan'].includes(d.id))
      .flatMap((d) => d.nodes.flatMap((n) => n.choices.map((c) => c.text)));
    texts.forEach((t) => expect(t).not.toMatch(/\b(good|evil|right thing|wrong thing|sin)\b/i));
    for (const id of ['choice-eli', 'choice-bandage'])
      expect(chapter.choices.find((c) => c.id === id)?.options.length, id).toBe(2);
  });
});
