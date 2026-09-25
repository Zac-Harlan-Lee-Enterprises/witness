import type { PassageText, ScriptureTextProvider } from '@/application/ports';
import {
  formatScriptureRef,
  scripturePlaceholder,
  type ScriptureRef,
  type StoredPassage,
  type Translation,
} from '@/domain/scripture';

/**
 * Scripture text provider.
 *
 * Verse text is shown ONLY from a translation that is (a) public-domain or
 * properly licensed AND (b) marked `approvedForDisplay` after an editor has
 * proofread the stored text against its source. Otherwise the explicit
 * placeholder is returned. Nothing here generates or paraphrases Scripture.
 */
export class StaticScriptureProvider implements ScriptureTextProvider {
  constructor(
    private readonly available: readonly Translation[],
    private readonly passages: readonly StoredPassage[],
  ) {}

  translations(): readonly Translation[] {
    return this.available;
  }

  getPassage(ref: ScriptureRef): PassageText {
    const key = formatScriptureRef(ref);
    for (const translation of this.available) {
      if (!translation.approvedForDisplay || translation.license === 'unlicensed') continue;
      const passage = this.passages.find(
        (p) => p.translationId === translation.id && p.reference === key,
      );
      if (passage) return { status: 'text', text: passage.text, translation };
    }
    return { status: 'placeholder', text: scripturePlaceholder(ref), translation: null };
  }
}
