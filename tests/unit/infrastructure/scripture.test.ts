import { describe, expect, it } from 'vitest';
import { STORED_PASSAGES, TRANSLATIONS } from '@/content/scripture/translations';
import { chapterSource } from '@/content';
import { formatScriptureRef } from '@/domain/scripture';
import { StaticScriptureProvider } from '@/infrastructure/scripture/scripture-provider';

const luke = { book: 'Luke' as const, chapter: 10, verseStart: 25, verseEnd: 37 };

describe('Scripture text provider', () => {
  it('shows the WEB text: approved for display by Zac Harlan on 2026-09-26', () => {
    const provider = new StaticScriptureProvider(TRANSLATIONS, STORED_PASSAGES);
    expect(TRANSLATIONS.find((t) => t.id === 'WEB')?.approvedForDisplay).toBe(true);
    const passage = provider.getPassage(luke);
    expect(passage.status).toBe('text');
    expect(passage.text).toMatch(/^25 Behold, a certain lawyer/);
  });

  it('has the text of every Scripture reference in every chapter, so none shows the placeholder', async () => {
    const provider = new StaticScriptureProvider(TRANSLATIONS, STORED_PASSAGES);
    for (const meta of chapterSource.list().filter((m) => m.available)) {
      const chapter = await chapterSource.load(meta.id);
      for (const record of chapter.records.filter((r) => r.kind === 'scripture'))
        for (const ref of record.scripture ?? [])
          expect(provider.getPassage(ref).status, `${meta.id} ${formatScriptureRef(ref)}`).toBe(
            'text',
          );
    }
  });

  it('shows the placeholder when no translation is approved', () => {
    const unapproved = TRANSLATIONS.map((t) => ({ ...t, approvedForDisplay: false }));
    const provider = new StaticScriptureProvider(unapproved, STORED_PASSAGES);
    expect(provider.getPassage(luke)).toEqual({
      status: 'placeholder',
      text: '[SCRIPTURE TEXT REQUIRES APPROVED TRANSLATION — Luke 10:25-37]',
      translation: null,
    });
  });

  it('shows stored text only once an editor approves a public-domain translation', () => {
    const approved = TRANSLATIONS.map((t) => ({ ...t, approvedForDisplay: true }));
    const provider = new StaticScriptureProvider(approved, STORED_PASSAGES);
    const passage = provider.getPassage(luke);
    expect(passage.status).toBe('text');
    expect(passage.translation?.id).toBe('WEB');
    expect(passage.text.split('\n')).toHaveLength(13);
    expect(passage.text).toMatch(/^25 Behold, a certain lawyer/);
  });

  it('never shows text from an unlicensed translation even if marked approved', () => {
    const provider = new StaticScriptureProvider(
      [
        {
          id: 'X',
          name: 'Unknown',
          license: 'unlicensed',
          licenseNote: 'n',
          approvedForDisplay: true,
        },
      ],
      [{ translationId: 'X', reference: 'Luke 10:25–37', text: 'copyrighted' }],
    );
    expect(provider.getPassage(luke).status).toBe('placeholder');
  });
});
