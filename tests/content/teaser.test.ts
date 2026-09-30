import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { TEASER_RECORD_ID } from '@/content/chapters/road-to-jericho/teaser';
import { APPROVALS, TEASER_APPROVALS } from '@/content/shared/approvals';

const PUBLIC = join(__dirname, '../../public');
const chapter = parseChapter(ROAD_TO_JERICHO);
const teaser = chapter.teaser;
const record = chapter.records.find((r) => r.id === TEASER_RECORD_ID);
const words = (teaser?.cues ?? []).map((c) => c.text).join(' ');

describe('the Chapter 1 teaser', () => {
  it('is part of the chapter, with its words in a content record', () => {
    expect(teaser).toBeDefined();
    expect(record?.kind).toBe('fiction');
    for (const cue of teaser?.cues ?? []) expect(record?.body).toContain(cue.text);
  });

  it("is not covered by the chapters' approval of 2026-09-26", () => {
    // Its words were written after that approval: they need their own.
    expect(APPROVALS.every((a) => a.date !== '2026-09-27')).toBe(true);
    const status = record?.governance.status;
    if (status === 'approved') expect(record?.governance.reviewedAt).not.toBe(APPROVALS[0]?.date);
    else expect(['in-review', 'ai-draft', 'human-draft']).toContain(status);
  });

  it('is approved by the owner, on its own, for exactly the words he approved', () => {
    // Zac Harlan, 2026-09-27: "script is approved". Changing any of these words
    // needs his approval again (update TEASER_APPROVALS and this list together).
    expect(TEASER_APPROVALS).toEqual([
      expect.objectContaining({
        reviewer: 'Zac Harlan',
        date: '2026-09-27',
        chapters: ['road-to-jericho'],
      }),
    ]);
    expect(record?.governance.status).toBe('approved');
    expect(record?.governance.reviewer).toBe('Zac Harlan');
    expect(record?.governance.reviewedAt).toBe('2026-09-27');
    expect((teaser?.cues ?? []).map((c) => c.text)).toEqual([
      'Jerusalem. Before the heat of the day.',
      'In Jericho, a boy named Natan has a fever that won’t go away.',
      'Aunt Miriam has made a remedy. Now it’s in your hands.',
      'In the market, everyone has advice.',
      'Not all of it is good.',
      'Then the road down to Jericho:',
      'a long day’s walk, falling some 1,000 meters through the wilderness.',
      'Travelers say robbers watch this road when it’s empty.',
      'Below the bend, something has happened.',
      'What you do next is up to you.',
      'Witness',
      'Chapter 1: The Road to Jericho',
    ]);
  });

  it('keeps to the story: Natan, Miriam, the remedy, the market, the bend', () => {
    expect(words).toMatch(/Natan/);
    expect(words).toMatch(/fever/);
    expect(words).toMatch(/Aunt Miriam/);
    expect(words).toMatch(/remedy/);
    expect(words).toMatch(/Below the bend/);
    // Shimon: "They watch when the road is empty."
    expect(words).toMatch(/watch this road when it’s empty/);
  });

  it('keeps the cliffhanger: never who the man is, never what the player does', () => {
    expect(words).not.toMatch(/\b(Samaritan|Menashe|oil merchant|man|traveler)\b/i);
    expect(words).not.toMatch(/help|save|rescue|pass by/i);
  });

  it('makes only the one verified historical claim, hedged as the chapter does', () => {
    // docs/research/source-verification.md claim 1 (about 1,000 m) and claim 21.
    expect(words).toMatch(/some 1,000 meters/);
    expect(words).toMatch(/a long day’s walk/);
    expect(record?.sources).toEqual(
      expect.arrayContaining(['src-wiki-jerusalem', 'src-wiki-jericho']),
    );
    expect(words).not.toMatch(/Scripture|Luke|Jesus|verse/);
  });

  it('ends on the title, and is silent under "What you do next is up to you."', () => {
    const last = teaser?.cues.at(-1);
    expect(last?.style).toBe('subtitle');
    expect(teaser?.cues.find((c) => c.style === 'title')?.text).toBe('Witness');
    const line = teaser?.cues.find((c) => c.text === 'What you do next is up to you.');
    const silence = teaser?.music.find((m) => m.mood === 'silence');
    expect(silence && line && silence.at <= line.at).toBe(true);
    const after = teaser?.music.find((m) => silence && m.at > silence.at);
    expect(after && line && after.at >= line.until).toBe(true);
  });

  it('has its film, in both formats, and its poster', () => {
    for (const v of teaser?.video ?? []) expect(existsSync(join(PUBLIC, v.src)), v.src).toBe(true);
    expect(existsSync(join(PUBLIC, teaser?.poster ?? 'missing'))).toBe(true);
    expect(teaser?.video.map((v) => v.type).sort()).toEqual(['video/mp4', 'video/webm']);
  });

  it('keeps the MP4 (the format every browser plays) within 12 MB', () => {
    // edit_teaser.py encodes it again at a lower quality until it fits.
    const mp4 = teaser?.video.find((v) => v.type === 'video/mp4');
    expect(mp4).toBeDefined();
    expect(statSync(join(PUBLIC, mp4?.src ?? 'missing')).size).toBeLessThanOrEqual(12_000_000);
  });

  it('records the film in the asset manifest', () => {
    const manifest = readFileSync(join(__dirname, '../../docs/art/asset-manifest.json'), 'utf8');
    expect(manifest).toContain('"path": "public/art/teaser/chapter-1/*"');
  });
});
