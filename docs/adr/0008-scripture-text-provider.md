# ADR-0008: Scripture text only via a provider. Placeholders by default. Stored public-domain text disabled until human proofreading.

- **Status:** Accepted
- **Related:** [src/domain/scripture.ts](../../src/domain/scripture.ts), [src/domain/content-records.ts](../../src/domain/content-records.ts) (`checkRecordIntegrity`), [src/application/ports.ts](../../src/application/ports.ts) (`ScriptureTextProvider`), [src/infrastructure/scripture/scripture-provider.ts](../../src/infrastructure/scripture/scripture-provider.ts), [src/content/scripture/translations.ts](../../src/content/scripture/translations.ts) (sensitive path), [src/features/common/ContentBlock.tsx](../../src/features/common/ContentBlock.tsx), [tests/unit/infrastructure/scripture.test.ts](../../tests/unit/infrastructure/scripture.test.ts), [content-governance.md](../content-governance.md)

## Context

The game retells and connects to the Bible. Presenting invented or altered verse text as Scripture, or showing a copyrighted translation without a licence, would be a serious failure of trust. Players also need to tell apart Scripture, paraphrase, historical background, interpretation and fiction. Even public-domain text copied into the codebase may contain transcription errors unless a human proofreads it against the source.

## Decision

- **References are separate from text.** Content stores `ScriptureRef` values (`book`, `chapter`, `verseStart`, `verseEnd?`), validated against the list of 66 book names. A `ContentRecord` of kind `scripture` **must not** have a `body`, and must carry at least one reference (`checkRecordIntegrity`). A retelling is kind `paraphrase` and must cite its passage. A dialogue line that retells Scripture must be kind `paraphrase` and link such a record through `recordId` (integrity check). The dialogue overlay then says the speaker "is retelling Scripture in their own words", gives the reference, and adds "not a direct quotation". Paraphrase records in the journal and the Scripture Connection are marked "In our own words — not a quotation".
- **Text comes only from a `ScriptureTextProvider`.** The implementation, `StaticScriptureProvider`, returns stored text **only** for a translation that is not `unlicensed` **and** is marked `approvedForDisplay`. Otherwise it returns exactly the placeholder from `scripturePlaceholder()`:
  `[SCRIPTURE TEXT REQUIRES APPROVED TRANSLATION — Luke 10:25-37]`
  and `ContentBlock` invites the player to read the passage in their own Bible.
- **The stored text is present but disabled.** [translations.ts](../../src/content/scripture/translations.ts) registers the World English Bible (`license: 'public-domain'`, with a note that the name is a trademark and altered text must not use it) with `approvedForDisplay: false`, plus the stored passage for Luke 10:25–37. The file's header records that the text was copied from eBible.org. Turning it on is an **editorial decision**: a named reviewer proofreads the stored verses, sets `approvedForDisplay: true`, and records their name in [content-governance.md](../content-governance.md).
- Enabling `src/content/scripture/translations.ts` for display is an editorial decision a named human makes ([content-governance.md](../content-governance.md)). It was originally also a sensitive path needing a `SECURITY-REVIEW` trailer; that approval gate was removed on 2026-09-25.

## Consequences

- The shipped slice shows placeholders plus clearly labelled paraphrases. No verse text appears until a human signs off.
- Tests pin the behaviour: the placeholder by default, stored text once a public-domain translation is approved, and never text from an `unlicensed` translation even if it is marked approved.
- Adding a licensed translation later means adding a registry entry and passages, or a different provider behind the same port (for example a licensed API, which would have to respect the no-network architecture rule and go through a reviewed infrastructure adapter). No content changes are needed, because content stores only references.
- The build and CI cannot enable Scripture text by accident, since that needs a reviewed change to a guarded file.

## Alternatives considered

- **Embedding verse text directly in content records.** Simpler, but it mixes text with references, invites unreviewed edits, and makes licensing per-record and invisible.
- **Showing the stored public-domain text immediately.** The licence permits it, but it skips the proofreading step the governance rules require. A single transcription error would be presented as Scripture.
- **Generating or paraphrasing text on the fly** (for example with AI). Rejected outright: the game must never invent Scripture.
