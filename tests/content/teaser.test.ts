import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { TEASER_RECORD_ID } from '@/content/chapters/road-to-jericho/teaser';
import { APPROVALS } from '@/content/shared/approvals';

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

  it('records the film in the asset manifest', () => {
    const manifest = readFileSync(join(__dirname, '../../docs/art/asset-manifest.json'), 'utf8');
    expect(manifest).toContain('"path": "public/art/teaser/chapter-1/*"');
  });
});
