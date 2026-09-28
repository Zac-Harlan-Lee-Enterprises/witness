import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContentRecord } from '@/domain/content-records';
import { cuesAt, teaserSteps, type Teaser, type TeaserCue } from '@/domain/teaser';
import { useSettings } from '../common/hooks';
import { useServices } from '../common/services';
import { prefersReducedMotionSetting, useSystemReducedMotion } from '../game/motion';

/** How the teaser ended: watched to the end, or skipped. */
export type TeaserOutcome = 'ended' | 'skipped';

/** A film that hasn't started playing by then is treated as unavailable. */
export const TEASER_LOAD_TIMEOUT_MS = 8000;

/**
 * A chapter's teaser film, full screen, before the chapter begins.
 *
 * - The film is muted; its score comes from the game's synthesiser, cued to
 *   the film's time, and follows the player's music volume and mute.
 * - The words are real text over the film, cued to its time, announced
 *   politely, readable at every text size.
 * - Skip is always there (the button, Escape, Enter or Space); the film can
 *   be paused and played.
 * - Under reduced motion the film never plays: the poster is shown with the
 *   words, stepped through with Next. The same stills are shown when the
 *   film can't be played (offline, unsupported), so it never blocks the
 *   chapter.
 */
export function TeaserPlayer({
  teaser,
  record,
  label,
  onDone,
  base = import.meta.env.BASE_URL,
  loadTimeoutMs = TEASER_LOAD_TIMEOUT_MS,
}: {
  teaser: Teaser;
  /** The record holding the teaser's words (for the review label). */
  record: ContentRecord | undefined;
  /** Accessible name, e.g. "Chapter 1 teaser". */
  label: string;
  onDone: (outcome: TeaserOutcome) => void;
  base?: string;
  loadTimeoutMs?: number;
}) {
  const { audio, config } = useServices();
  const settings = useSettings();
  // (Subscribing re-renders when the device preference changes.)
  useSystemReducedMotion();
  const reduced = prefersReducedMotionSetting(settings.reducedMotion);
  const [mode, setMode] = useState<'film' | 'stills'>(reduced ? 'stills' : 'film');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(false);
  const url = (path: string): string => `${base}${path}`;
  const steps = teaserSteps(teaser.cues);
  // The teaser's words are the game's own pitch to the player: until an
  // editor approves them, preview builds say so (discreetly), fiction or not.
  const status = record?.governance.status;
  const showReview =
    config.contentMode === 'preview' && status !== 'approved' && status !== 'published';

  const finish = useCallback(
    (outcome: TeaserOutcome) => {
      if (doneRef.current) return;
      doneRef.current = true;
      audio.stopFilmScore();
      videoRef.current?.pause();
      onDone(outcome);
    },
    [audio, onDone],
  );

  // The Skip button has focus from the start.
  useEffect(() => {
    skipRef.current?.focus();
    void audio.unlock();
    return () => audio.stopFilmScore();
  }, [audio]);

  // A film that never starts (offline, a missing file) falls back to the stills.
  useEffect(() => {
    if (mode !== 'film') return;
    const timer = setTimeout(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) setMode('stills');
    }, loadTimeoutMs);
    return () => clearTimeout(timer);
  }, [mode, loadTimeoutMs]);

  useEffect(() => {
    if (mode === 'stills') audio.stopFilmScore();
  }, [mode, audio]);

  // Escape skips from anywhere; Enter or Space too, unless a button has
  // focus (then they press that button: Skip, Pause or Next).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const onButton = (event.target as HTMLElement | null)?.tagName === 'BUTTON';
      if (event.key === 'Escape' || (!onButton && (event.key === 'Enter' || event.key === ' '))) {
        event.preventDefault();
        finish('skipped');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finish]);

  const togglePlay = (): void => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => setMode('stills'));
    else v.pause();
  };

  const shown: TeaserCue[] = mode === 'film' ? cuesAt(teaser.cues, time) : (steps[step] ?? []);
  const lastStep = step >= steps.length - 1;

  return (
    <div className={`teaser teaser--${mode}`} role="dialog" aria-modal="true" aria-label={label}>
      {mode === 'film' ? (
        <video
          ref={videoRef}
          className="teaser__film"
          poster={url(teaser.poster)}
          muted
          playsInline
          autoPlay
          preload="auto"
          aria-label={teaser.description}
          onPlay={(e) => {
            setPlaying(true);
            audio.playFilmScore(teaser.music, teaser.duration, e.currentTarget.currentTime);
          }}
          onPause={() => {
            setPlaying(false);
            audio.stopFilmScore();
          }}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onEnded={() => finish('ended')}
          onError={() => setMode('stills')}
        >
          {teaser.video.map((v) => (
            <source
              key={v.src}
              src={url(v.src)}
              type={v.type}
              onError={(e) => {
                // Only when the last source fails has the film failed.
                const sources = e.currentTarget.parentElement?.querySelectorAll('source');
                if (sources && e.currentTarget === sources[sources.length - 1]) setMode('stills');
              }}
            />
          ))}
        </video>
      ) : (
        <img
          className="teaser__film"
          src={url(teaser.poster)}
          alt=""
          onError={(e) => (e.currentTarget.hidden = true)}
        />
      )}
      <div className="teaser__shade" aria-hidden="true" />
      <div className="teaser__words" aria-live="polite" aria-atomic="true">
        {shown.map((c) => (
          <p key={`${c.at}-${c.text}`} className={`teaser__cue teaser__cue--${c.style}`}>
            {c.text}
          </p>
        ))}
      </div>
      {mode === 'stills' && <p className="visually-hidden">{teaser.description}</p>}
      <div className="teaser__controls">
        {showReview && <span className="teaser__review">Awaiting editorial review</span>}
        {mode === 'film' ? (
          <button
            type="button"
            className="button button--small teaser__toggle"
            onClick={togglePlay}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        ) : (
          <button
            type="button"
            className="button button--small"
            onClick={() => (lastStep ? finish('ended') : setStep((s) => s + 1))}
          >
            {lastStep ? 'Begin' : 'Next'}
          </button>
        )}
        <button
          ref={skipRef}
          type="button"
          className="button button--small teaser__skip"
          onClick={() => finish('skipped')}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
