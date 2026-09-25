import { z } from 'zod';

/**
 * Scripture REFERENCES are stored independently of displayed verse text.
 * Text comes from a ScriptureTextProvider (application port) which, by
 * default, returns an explicit placeholder — the game never embeds a
 * copyrighted translation and never invents verse text.
 */
export const BIBLE_BOOKS = [
  'Genesis',
  'Exodus',
  'Leviticus',
  'Numbers',
  'Deuteronomy',
  'Joshua',
  'Judges',
  'Ruth',
  '1 Samuel',
  '2 Samuel',
  '1 Kings',
  '2 Kings',
  '1 Chronicles',
  '2 Chronicles',
  'Ezra',
  'Nehemiah',
  'Esther',
  'Job',
  'Psalms',
  'Proverbs',
  'Ecclesiastes',
  'Song of Songs',
  'Isaiah',
  'Jeremiah',
  'Lamentations',
  'Ezekiel',
  'Daniel',
  'Hosea',
  'Joel',
  'Amos',
  'Obadiah',
  'Jonah',
  'Micah',
  'Nahum',
  'Habakkuk',
  'Zephaniah',
  'Haggai',
  'Zechariah',
  'Malachi',
  'Matthew',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'Romans',
  '1 Corinthians',
  '2 Corinthians',
  'Galatians',
  'Ephesians',
  'Philippians',
  'Colossians',
  '1 Thessalonians',
  '2 Thessalonians',
  '1 Timothy',
  '2 Timothy',
  'Titus',
  'Philemon',
  'Hebrews',
  'James',
  '1 Peter',
  '2 Peter',
  '1 John',
  '2 John',
  '3 John',
  'Jude',
  'Revelation',
] as const;
/** @public Domain-model type (chapter-authoring API). */
export type BibleBook = (typeof BIBLE_BOOKS)[number];

export const ScriptureRefSchema = z
  .object({
    book: z.enum(BIBLE_BOOKS),
    chapter: z.number().int().positive(),
    verseStart: z.number().int().positive(),
    verseEnd: z.number().int().positive().optional(),
  })
  .refine((r) => r.verseEnd === undefined || r.verseEnd >= r.verseStart, {
    message: 'verseEnd must be >= verseStart',
  });
export type ScriptureRef = z.infer<typeof ScriptureRefSchema>;

export function formatScriptureRef(ref: ScriptureRef): string {
  const verses =
    ref.verseEnd !== undefined && ref.verseEnd !== ref.verseStart
      ? `${ref.verseStart}–${ref.verseEnd}`
      : `${ref.verseStart}`;
  return `${ref.book} ${ref.chapter}:${verses}`;
}

/** Parse "Luke 10:25-37" / "1 John 4:7" style strings. Returns null when invalid. */
export function parseScriptureRef(input: string): ScriptureRef | null {
  const match = /^(.+?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(input.trim());
  if (!match) return null;
  const [, bookRaw, ch, vs, ve] = match;
  const book = BIBLE_BOOKS.find((b) => b.toLowerCase() === (bookRaw ?? '').toLowerCase());
  if (!book) return null;
  const parsed = ScriptureRefSchema.safeParse({
    book,
    chapter: Number(ch),
    verseStart: Number(vs),
    verseEnd: ve === undefined ? undefined : Number(ve),
  });
  return parsed.success ? parsed.data : null;
}

/** The exact placeholder shown wherever approved verse text is unavailable. */
export function scripturePlaceholder(ref: ScriptureRef): string {
  const verses =
    ref.verseEnd !== undefined && ref.verseEnd !== ref.verseStart
      ? `${ref.verseStart}-${ref.verseEnd}`
      : `${ref.verseStart}`;
  return `[SCRIPTURE TEXT REQUIRES APPROVED TRANSLATION — ${ref.book} ${ref.chapter}:${verses}]`;
}

export const TranslationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  license: z.enum(['public-domain', 'licensed', 'unlicensed']),
  licenseNote: z.string().min(1),
  /** Editorial sign-off that stored text was proofread against the source. */
  approvedForDisplay: z.boolean(),
});
export type Translation = z.infer<typeof TranslationSchema>;

/** Verse text stored for a translation, keyed by formatScriptureRef output. */
export interface StoredPassage {
  translationId: string;
  reference: string;
  text: string;
}
