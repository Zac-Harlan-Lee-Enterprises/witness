import { useEffect, useRef, useState } from 'react';
import type { DialogueView } from '@/application/ui-store';
import { findNode, interpolate } from '@/domain/dialogue';
import { formatScriptureRef } from '@/domain/scripture';
import { DIALOGUE_SPEEDS } from '@/domain/settings';
import { ContentKindBadge } from '../common/ContentBlock';
import { useSettings, useStore } from '../common/hooks';
import { Modal } from '../common/Modal';
import { Portrait, type PortraitSource } from '../common/Portrait';
import { portraitImage, preloadPortraits } from '../portraits/portrait-art';
import type { GameRuntimeLike } from '../game/types';
import { prefersReducedMotionSetting } from '../game/motion';

interface Shown {
  speaker: string;
  picture: PortraitSource;
}

/**
 * The speaker's portrait (CSS px): 104, larger on wide screens so faces can
 * be read, smaller on phones and with large text (see app.css, which sets
 * the displayed size; `sizes` tells the browser which file to fetch).
 */
const PORTRAIT_SIZE = 104;
const PORTRAIT_SIZE_LARGE_TEXT = 72;
const PORTRAIT_SIZES =
  '(max-width: 640px) 60px, (min-width: 1100px) and (min-height: 720px) 152px, 104px';
const PORTRAIT_SIZES_LARGE_TEXT = '(max-width: 640px) 60px, 72px';

/**
 * The conversation box. Text reveals at the chosen speed (or instantly), but
 * the complete line is always available to screen readers immediately.
 * Choices are real buttons; unavailable choices stay visible with the reason.
 *
 * Each line is announced through ONE permanently mounted live region. (The
 * box itself is re-created for every line, and a live region that appears
 * already holding text is not reliably announced.)
 */
export function DialogueOverlay({ runtime }: { runtime: GameRuntimeLike }) {
  const ui = useStore(runtime.ui);
  const view = ui.dialogue;
  const { chapter } = runtime;
  useEffect(() => {
    // Everyone who may speak in this chapter, so their portraits show at once.
    preloadPortraits(chapter.characters, PORTRAIT_SIZE);
  }, [chapter]);
  const dialogueId = view?.dialogueId ?? null;
  useEffect(() => {
    // When a conversation opens, the faces its lines will need.
    const dialogue = dialogueId ? chapter.dialogues.find((d) => d.id === dialogueId) : undefined;
    if (!dialogue) return;
    const faces = dialogue.nodes.flatMap((n) => {
      if (n.expression === 'neutral') return [];
      const c = chapter.characters.find((x) => x.id === n.speaker);
      return c ? [{ appearance: c.appearance, id: c.id, expression: n.expression }] : [];
    });
    preloadPortraits(faces, PORTRAIT_SIZE);
  }, [chapter, dialogueId]);
  // The picture the last line showed, so a change of face on the same
  // speaker cross-fades (the box itself is re-created for every line).
  // Kept in state and updated when the line changes, as React allows
  // (remembering a value from the previous render).
  const art =
    view?.speaker.appearance && view.speaker.kind === 'character'
      ? portraitImage(view.speaker.appearance, view.speaker.id, view.expression)
      : null;
  const line = view ? `${view.dialogueId}/${view.nodeId}` : null;
  const now: Shown | null =
    view && art
      ? { speaker: view.speaker.id, picture: { src: art.src, srcSet: art.srcSet } }
      : null;
  const [track, setTrack] = useState<{
    line: string | null;
    now: Shown | null;
    before: Shown | null;
  }>({ line: null, now: null, before: null });
  if (track.line !== line) setTrack({ line, now, before: track.now });
  const before = track.line === line ? track.before : track.now;
  const fadeFrom =
    now && before?.speaker === now.speaker && before.picture.src !== now.picture.src
      ? before.picture
      : null;
  const spoken = view ? `${speakerLabel(view) ? `${speakerLabel(view)}: ` : ''}${view.text}` : '';
  return (
    <>
      <p className="visually-hidden" aria-live="polite" data-testid="dialogue-announcer">
        {spoken}
      </p>
      {view && (
        <DialogueBox
          key={`${view.dialogueId}/${view.nodeId}`}
          view={view}
          runtime={runtime}
          fadeFrom={fadeFrom}
        />
      )}
    </>
  );
}

function speakerLabel(view: DialogueView): string | null {
  return view.speaker.kind === 'narrator' ? null : view.speaker.name;
}

function useTypewriter(text: string): { shown: string; done: boolean; skip: () => void } {
  const settings = useSettings();
  const instant =
    settings.dialogueSpeed === 'instant' || prefersReducedMotionSetting(settings.reducedMotion);
  const msPerChar = DIALOGUE_SPEEDS[settings.dialogueSpeed];
  const [count, setCount] = useState(instant ? text.length : 0);
  useEffect(() => {
    if (instant || count >= text.length) return;
    const t = setTimeout(() => setCount((c) => Math.min(text.length, c + 2)), msPerChar * 2);
    return () => clearTimeout(t);
  }, [count, instant, msPerChar, text.length]);
  return {
    shown: text.slice(0, count),
    done: count >= text.length,
    skip: () => setCount(text.length),
  };
}

function DialogueBox({
  view,
  runtime,
  fadeFrom,
}: {
  view: DialogueView;
  runtime: GameRuntimeLike;
  fadeFrom: PortraitSource | null;
}) {
  const { shown, done, skip } = useTypewriter(view.text);
  const firstAction = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLElement>(null);
  const settings = useSettings();

  useEffect(() => {
    firstAction.current?.focus();
  }, [view.nodeId, done]);

  useEffect(() => {
    // Number keys pick a choice — only while focus is inside the conversation,
    // so they never fire from elsewhere on the page (WCAG 2.1.4).
    const onKey = (event: KeyboardEvent) => {
      if (!/^Digit[1-9]$/.test(event.code) || !done) return;
      if (!(event.target instanceof Node) || !box.current?.contains(event.target)) return;
      const choice = view.choices[Number(event.code.slice(5)) - 1];
      if (choice?.available) runtime.dialogue.choose(choice.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, done, runtime.dialogue]);

  const speakerName = speakerLabel(view);
  const refs = view.record?.scripture?.map(formatScriptureRef).join('; ');

  return (
    <section
      ref={box}
      className={`dialogue dialogue--${view.speaker.kind}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="dialogue-speaker"
    >
      <div
        className={`dialogue__portrait${settings.textScale > 1.4 ? '' : ' dialogue__portrait--grow'}`}
      >
        <Portrait
          appearance={view.speaker.appearance}
          characterId={view.speaker.kind === 'character' ? view.speaker.id : null}
          expression={view.speaker.kind === 'character' ? view.expression : 'neutral'}
          size={settings.textScale > 1.4 ? PORTRAIT_SIZE_LARGE_TEXT : PORTRAIT_SIZE}
          sizes={settings.textScale > 1.4 ? PORTRAIT_SIZES_LARGE_TEXT : PORTRAIT_SIZES}
          fadeFrom={fadeFrom}
        />
      </div>
      <div className="dialogue__main">
        <div className="dialogue__header">
          <h2 id="dialogue-speaker" className="dialogue__speaker">
            {speakerName ?? 'Narration'}
            {view.speaker.role && <span className="dialogue__role"> · {view.speaker.role}</span>}
          </h2>
          {view.kind !== 'fiction' && <ContentKindBadge kind={view.kind} />}
        </div>
        {view.kind === 'paraphrase' && (
          <p className="dialogue__note">
            {view.speaker.kind === 'character'
              ? `${view.speaker.name} is retelling Scripture in their own words`
              : 'A retelling in our own words'}
            {refs ? ` (${refs})` : ''} — not a direct quotation.
          </p>
        )}
        <p className="dialogue__text" aria-hidden="true">
          {shown}
          {!done && <span className="dialogue__caret">▍</span>}
        </p>
        <p id="dialogue-text-full" className="visually-hidden">
          {speakerName ? `${speakerName}: ` : ''}
          {view.text}
        </p>
        <div className="dialogue__actions">
          {!done ? (
            <button ref={firstAction} type="button" className="button" onClick={skip}>
              Show all text
            </button>
          ) : view.choices.length > 0 ? (
            <ol className="dialogue__choices">
              {view.choices.map((c, i) => (
                <li key={c.id}>
                  <button
                    ref={i === 0 ? firstAction : undefined}
                    type="button"
                    className={`choice ${c.available ? '' : 'choice--unavailable'}`}
                    aria-disabled={c.available ? undefined : true}
                    aria-describedby={c.available ? undefined : `why-${c.id}`}
                    onClick={() => c.available && runtime.dialogue.choose(c.id)}
                  >
                    <span className="choice__number" aria-hidden="true">
                      {i + 1}
                    </span>
                    {c.text}
                  </button>
                  {!c.available && (
                    <p id={`why-${c.id}`} className="choice__why">
                      <span aria-hidden="true">✗ </span>
                      {c.unavailableText}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <button
              ref={firstAction}
              type="button"
              className="button button--primary"
              onClick={() => runtime.dialogue.advance()}
            >
              {view.isLast ? 'End conversation' : 'Continue'}
            </button>
          )}
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => runtime.ui.openOverlay('history')}
          >
            Conversation history
          </button>
        </div>
      </div>
    </section>
  );
}

/** Everything said so far in this chapter, reconstructed from the dialogue log. */
export function DialogueHistory({ runtime }: { runtime: GameRuntimeLike }) {
  const state = useStore(runtime.session.store);
  const { chapter, profile } = runtime;
  const lines = state.dialogueLog.slice(-120).flatMap((entry, index) => {
    const dialogue = chapter.dialogues.find((d) => d.id === entry.dialogueId);
    if (!dialogue) return [];
    try {
      const node = findNode(dialogue, entry.nodeId);
      if (entry.choiceId) {
        const choice = node.choices.find((c) => c.id === entry.choiceId);
        return choice
          ? [{ key: index, who: profile.displayName, text: choice.text, kind: 'choice' }]
          : [];
      }
      const who =
        node.speaker === 'narrator'
          ? 'Narration'
          : node.speaker === 'player'
            ? profile.displayName
            : (chapter.characters.find((c) => c.id === node.speaker)?.name ?? node.speaker);
      return [
        {
          key: index,
          who,
          text: interpolate(node.text, { player: profile.displayName }),
          kind: node.kind,
        },
      ];
    } catch {
      return [];
    }
  });
  return (
    <Modal
      title="Conversation history"
      onClose={() => runtime.ui.closeOverlay()}
      className="modal--wide"
    >
      {lines.length === 0 ? (
        <p>No conversations yet.</p>
      ) : (
        <ol className="history">
          {lines.map((l) => (
            <li key={l.key} className={`history__line history__line--${l.kind}`}>
              <strong>{l.who}:</strong> {l.text}
              {l.kind === 'paraphrase' && (
                <span className="meta-note"> (paraphrase of Scripture)</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
