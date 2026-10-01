import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chapterSource } from '@/content';
import type { Chapter } from '@/domain/chapter';

/**
 * Every chapter has a design document that is true to its content. The owner
 * (2026-10-01): "I'll want to add more chapters so the documentation needs
 * to be accurate." This can't check every sentence, but it keeps the shape
 * of the documents the same, makes a new chapter's document a requirement,
 * and catches a puzzle or a place that the document doesn't know about.
 *
 * Every failure says WHAT is wrong, WHY the rule exists, and HOW to fix it.
 */

const DOCS = join(process.cwd(), 'docs', 'chapters');
const README = join(DOCS, 'README.md');
const GUIDE = 'docs/chapter-authoring-guide.md §15 and the template in docs/chapters/README.md';

/** The template's sections, in order (docs/chapters/README.md). */
const CHAPTER_DOC_SECTIONS = [
  '1. The idea and the passage',
  '2. Acts',
  '3. Places',
  '4. People',
  '5. Quests and stages',
  '6. Puzzles',
  '7. Choices and consequences',
  '8. Time, weather and light',
  '9. Scripture Connection and summary',
  '10. Art',
  '11. How long it plays',
  '12. Content and approval status',
  '13. Sources and verification',
  '14. Known gaps',
] as const;

const metas = chapterSource.list().filter((m) => m.available);
const chapters: Chapter[] = await Promise.all(metas.map((m) => chapterSource.load(m.id)));

const docPath = (id: string): string => join(DOCS, `${id}.md`);
const readDoc = (id: string): string =>
  existsSync(docPath(id)) ? readFileSync(docPath(id), 'utf8') : '';

/** The text of one `## ` section (empty if the heading is missing). */
function section(doc: string, heading: string): string {
  const lines = doc.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

const fail = (what: string, why: string, how: string): string =>
  `FAIL  ${what}\n      Why: ${why}\n      Fix: ${how}`;

describe('chapter design documents', () => {
  it('registers at least one chapter (so the checks below check something)', () => {
    expect(chapters.length).toBeGreaterThan(0);
  });

  it('gives every registered chapter its own docs/chapters/<id>.md', () => {
    const problems = metas
      .filter((m) => !existsSync(docPath(m.id)))
      .map((m) =>
        fail(
          `Chapter ${m.number} '${m.id}' has no docs/chapters/${m.id}.md`,
          'Every chapter needs a design document describing it as built: the owner adds chapters, and the documentation has to keep up.',
          `Write docs/chapters/${m.id}.md (see ${GUIDE}).`,
        ),
      );
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('lists every chapter in docs/chapters/README.md', () => {
    const readme = readFileSync(README, 'utf8');
    const problems = metas
      .filter((m) => !readme.includes(`(${m.id}.md)`))
      .map((m) =>
        fail(
          `docs/chapters/README.md does not link ${m.id}.md`,
          'The README is the index of the chapter documents; a chapter missing from it is hard to find.',
          `Add a row for Chapter ${m.number} with a link [${m.id}.md](${m.id}.md) to the table in docs/chapters/README.md.`,
        ),
      );
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('lists only registered chapters in docs/chapters/README.md', () => {
    const readme = readFileSync(README, 'utf8');
    const ids = new Set(metas.map((m) => m.id));
    const linked = [...readme.matchAll(/\]\(([a-z0-9-]+)\.md\)/g)].map((m) => m[1] ?? '');
    const problems = linked
      .filter((id) => !ids.has(id))
      .map((id) =>
        fail(
          `docs/chapters/README.md links ${id}.md, which is not an available chapter`,
          'The list must match the game, so nobody reads about a chapter that does not exist.',
          `Remove the row, or register '${id}' in src/content/index.ts.`,
        ),
      );
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('shows the template in docs/chapters/README.md with every section', () => {
    const readme = readFileSync(README, 'utf8');
    const problems = CHAPTER_DOC_SECTIONS.filter((h) => !readme.includes(`## ${h}`)).map((h) =>
      fail(
        `The template in docs/chapters/README.md has no "## ${h}"`,
        'The template is what a new chapter document is copied from; it must match the sections this test requires.',
        `Add "## ${h}" to the template, or change CHAPTER_DOC_SECTIONS in tests/content/chapter-docs.test.ts together with every chapter document.`,
      ),
    );
    expect(problems, problems.join('\n')).toEqual([]);
  });

  for (const meta of metas) {
    describe(`docs/chapters/${meta.id}.md`, () => {
      const chapter = chapters.find((c) => c.id === meta.id);
      const doc = readDoc(meta.id);

      it('has the template’s sections, in order', () => {
        const headings = doc
          .split('\n')
          .filter((l) => l.startsWith('## '))
          .map((l) => l.slice(3).trim());
        const problems = [];
        if (headings.join('\n') !== CHAPTER_DOC_SECTIONS.join('\n'))
          problems.push(
            fail(
              `Its "## " headings are:\n        ${headings.join('\n        ') || '(none)'}`,
              'Every chapter document has the same fourteen sections, so readers (and agents) find the same things in the same place in each.',
              `Use exactly these "## " headings, in this order (### subsections are free):\n        ${CHAPTER_DOC_SECTIONS.join('\n        ')}`,
            ),
          );
        if (!doc.startsWith(`# Chapter ${meta.number}: `))
          problems.push(
            fail(
              `It does not start with "# Chapter ${meta.number}: "`,
              'The title says which chapter this is, by its number in the registry.',
              `Make the first line "# Chapter ${meta.number}: *${meta.title}*".`,
            ),
          );
        expect(problems, problems.join('\n')).toEqual([]);
      });

      it('names every puzzle by id and type in §6', () => {
        const rows = section(doc, '6. Puzzles').split('\n');
        const problems = (chapter?.puzzles ?? [])
          .filter(
            (p) => !rows.some((r) => r.includes(`\`${p.id}\``) && r.includes(`\`${p.type}\``)),
          )
          .map((p) =>
            fail(
              `§6 has no line naming \`${p.id}\` with its type \`${p.type}\``,
              'The puzzles change most (types were replaced, puzzles added); a document that misses one is out of date.',
              `Add a row to the table at the top of §6: | \`${p.id}\` ${p.title} | \`${p.type}\` | where | solution |`,
            ),
          );
        expect(problems, problems.join('\n')).toEqual([]);
      });

      it('names every place by its scene id in §3', () => {
        const places = section(doc, '3. Places');
        const problems = (chapter?.scenes ?? [])
          .filter((s) => !places.includes(`\`${s.id}\``) && !places.includes(` ${s.id} `))
          .map((s) =>
            fail(
              `§3 never names the scene \`${s.id}\``,
              'Every place the player can go is described in §3, so a new or renamed scene must be documented.',
              `Describe \`${s.id}\` (size, mood, weather, what is there, its exits) in §3.`,
            ),
          );
        expect(problems, problems.join('\n')).toEqual([]);
      });
    });
  }
});
