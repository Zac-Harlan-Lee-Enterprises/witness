import { useEffect, useMemo, useRef, useState } from 'react';
import { ChapterLoadError } from '@/content';
import type { GameSettings } from '@/domain/settings';
import type { Chapter } from '@/domain/chapter';
import type { PlayerProfile } from '@/domain/profile';
import { shouldPlayTeaser } from '@/domain/teaser';
import { useStore } from '@/features/common/hooks';
import { GameScreen } from '@/features/game/GameScreen';
import { prefersReducedMotionSetting, useSystemReducedMotion } from '@/features/game/motion';
import { ChapterSelect } from '@/features/menu/ChapterSelect';
import { TitleScreen } from '@/features/menu/TitleScreen';
import { ProfileScreen } from '@/features/profiles/ProfileScreen';
import { SettingsPanel } from '@/features/settings/SettingsPanel';
import { TeaserPlayer } from '@/features/teaser/TeaserPlayer';
import { attachGamepadNavigation } from '@/infrastructure/input/gamepad-navigation';
import { attachGamepad } from '@/infrastructure/input/gamepad-source';
import { attachKeyboard } from '@/infrastructure/input/keyboard-source';
import { ErrorBoundary } from './ErrorBoundary';
import { GameRuntime } from './game-runtime';
import type { AppServices } from './services';
import { updatesAtOnce } from './update-policy';

type Screen =
  | { name: 'title' }
  | { name: 'profiles' }
  | { name: 'chapters'; profile: PlayerProfile }
  | { name: 'loading' }
  | { name: 'game'; runtime: GameRuntime }
  | { name: 'teaser'; chapter: Chapter; profile: PlayerProfile; then: 'chapter' | 'chapters' }
  | { name: 'error'; message: string; details: string[] };

/** Apply accessibility settings to the document root (CSS reads these). */
export function applySettingsToDocument(
  settings: GameSettings,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
  root.dataset.font = settings.font;
  root.dataset.motion = prefersReducedMotionSetting(settings.reducedMotion) ? 'reduce' : 'full';
  root.style.setProperty('--text-scale', String(settings.textScale));
  // CSS can't compare a custom property, so large text gets its own flag.
  root.dataset.text = settings.textScale >= 1.5 ? 'large' : 'normal';
}

function createKeyboardAttacher(services: AppServices) {
  return (isWorldFocused: () => boolean) =>
    attachKeyboard(services.input, () => services.settings.current.keyBindings, isWorldFocused);
}

export function App({ services }: { services: AppServices }) {
  const [screen, setScreen] = useState<Screen>({ name: 'title' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsOpenRef = useRef(settingsOpen);
  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);
  const settings = useStore(services.settings.store);

  // Re-apply when the device's reduced-motion preference changes, too.
  const systemReducedMotion = useSystemReducedMotion();
  useEffect(() => {
    applySettingsToDocument(settings);
  }, [settings, systemReducedMotion]);

  // A waiting new version is swapped in at once outside a chapter (in one, the
  // pause menu offers it): see update-policy.ts.
  const updateWaiting = useStore(services.notices).updateAvailable;
  useEffect(() => {
    if (updateWaiting && services.applyUpdate && updatesAtOnce(screen.name))
      void services.applyUpdate();
  }, [updateWaiting, screen.name, services]);

  // The gamepad drives menus and dialogue whenever the world isn't taking movement.
  const screenRef = useRef(screen);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  useEffect(() => {
    document.title = services.config.title;
    const detachPad = attachGamepad(services.input);
    const detachNav = attachGamepadNavigation(
      services.input,
      () => {
        const s = screenRef.current;
        return s.name === 'game' && s.runtime.ui.explorationAllowed && !settingsOpenRef.current;
      },
      () => screenRef.current.name === 'game' && !settingsOpenRef.current,
    );
    return () => {
      detachNav();
      detachPad();
    };
  }, [services]);

  const keyboard = useMemo(() => createKeyboardAttacher(services), [services]);

  const launch = async (
    profile: PlayerProfile,
    chapter: Chapter,
    restored: ConstructorParameters<typeof GameRuntime>[3],
  ) => {
    const current = await services.profiles.touch(profile);
    const runtime = new GameRuntime(services, chapter, current, restored, (id) => {
      void services.profiles.markChapterComplete(current, id);
    });
    setScreen({ name: 'game', runtime });
  };

  const failed = (error: unknown) => {
    services.logger.error('Chapter failed to start', error);
    setScreen({
      name: 'error',
      message: 'This chapter could not be loaded. Please try again.',
      details: error instanceof ChapterLoadError && services.config.isDev ? error.issues : [],
    });
  };

  const startChapter = async (profile: PlayerProfile, chapterId: string, saveId: string | null) => {
    setScreen({ name: 'loading' });
    try {
      const chapter = await services.chapters.load(chapterId);
      let restored = null;
      if (saveId) {
        const result = await services.saves.load(saveId);
        if (!result.ok) {
          setScreen({ name: 'error', message: result.message, details: [] });
          return;
        }
        restored = { save: result.save, fromVersion: result.fromVersion };
      }
      // A new game opens with the chapter's teaser, the first time only.
      if (shouldPlayTeaser(chapter, profile, restored !== null)) {
        setScreen({ name: 'teaser', chapter, profile, then: 'chapter' });
        return;
      }
      await launch(profile, chapter, restored);
    } catch (error) {
      failed(error);
    }
  };

  const watchTeaser = async (profile: PlayerProfile, chapterId: string) => {
    setScreen({ name: 'loading' });
    try {
      const chapter = await services.chapters.load(chapterId);
      if (!chapter.teaser) {
        setScreen({ name: 'chapters', profile });
        return;
      }
      setScreen({ name: 'teaser', chapter, profile, then: 'chapters' });
    } catch (error) {
      failed(error);
    }
  };

  const teaserDone = async (s: Extract<Screen, { name: 'teaser' }>) => {
    try {
      // Watched or skipped, it isn't played again on its own.
      const profile = await services.profiles.markTeaserSeen(s.profile, s.chapter.id);
      if (s.then === 'chapters') {
        setScreen({ name: 'chapters', profile });
        return;
      }
      await launch(profile, s.chapter, null);
    } catch (error) {
      failed(error);
    }
  };

  const quitGame = async () => {
    if (screen.name !== 'game') return;
    const { runtime } = screen;
    runtime.dispose();
    const profiles = await services.profiles.list();
    const profile = profiles.find((p) => p.id === runtime.profile.id) ?? runtime.profile;
    setScreen({ name: 'chapters', profile });
  };

  return (
    <ErrorBoundary logger={services.logger} onReset={() => setScreen({ name: 'title' })}>
      {screen.name === 'title' && (
        <TitleScreen
          onPlay={() => setScreen({ name: 'profiles' })}
          onSettings={() => setSettingsOpen(true)}
        />
      )}
      {screen.name === 'profiles' && (
        <ProfileScreen
          onSelect={(profile) => setScreen({ name: 'chapters', profile })}
          onBack={() => setScreen({ name: 'title' })}
        />
      )}
      {screen.name === 'chapters' && (
        <ChapterSelect
          profile={screen.profile}
          onStart={(chapterId, saveId) => void startChapter(screen.profile, chapterId, saveId)}
          onWatchTeaser={(chapterId) => void watchTeaser(screen.profile, chapterId)}
          onBack={() => setScreen({ name: 'profiles' })}
        />
      )}
      {screen.name === 'loading' && (
        <main className="screen" aria-busy="true">
          <p role="status">Loading…</p>
        </main>
      )}
      {screen.name === 'error' && (
        <main className="screen error-screen">
          <h1>Couldn’t start</h1>
          <p role="alert">{screen.message}</p>
          {screen.details.length > 0 && (
            <ul className="dev-details">
              {screen.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="button button--primary"
            onClick={() => setScreen({ name: 'title' })}
          >
            Back to title
          </button>
        </main>
      )}
      {screen.name === 'teaser' && screen.chapter.teaser && (
        <TeaserPlayer
          teaser={screen.chapter.teaser}
          record={screen.chapter.records.find((r) => r.id === screen.chapter.teaser?.recordId)}
          label={`Chapter ${screen.chapter.number} teaser: ${screen.chapter.title}`}
          onDone={() => void teaserDone(screen)}
        />
      )}
      {screen.name === 'game' && (
        <GameScreen
          runtime={screen.runtime}
          attachKeyboard={keyboard}
          onOpenSettings={() => setSettingsOpen(true)}
          onQuit={() => void quitGame()}
        />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </ErrorBoundary>
  );
}
