import { useEffect, useMemo, useState } from 'react';
import { ChapterLoadError } from '@/content';
import type { GameSettings } from '@/domain/settings';
import type { PlayerProfile } from '@/domain/profile';
import { useStore } from '@/features/common/hooks';
import { GameScreen } from '@/features/game/GameScreen';
import { prefersReducedMotionSetting } from '@/features/game/motion';
import { ChapterSelect } from '@/features/menu/ChapterSelect';
import { TitleScreen } from '@/features/menu/TitleScreen';
import { ProfileScreen } from '@/features/profiles/ProfileScreen';
import { SettingsPanel } from '@/features/settings/SettingsPanel';
import { attachGamepad } from '@/infrastructure/input/gamepad-source';
import { attachKeyboard } from '@/infrastructure/input/keyboard-source';
import { ErrorBoundary } from './ErrorBoundary';
import { GameRuntime } from './game-runtime';
import type { AppServices } from './services';

type Screen =
  | { name: 'title' }
  | { name: 'profiles' }
  | { name: 'chapters'; profile: PlayerProfile }
  | { name: 'loading' }
  | { name: 'game'; runtime: GameRuntime }
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
}

function createKeyboardAttacher(services: AppServices) {
  return (isWorldFocused: () => boolean) =>
    attachKeyboard(services.input, () => services.settings.current.keyBindings, isWorldFocused);
}

export function App({ services }: { services: AppServices }) {
  const [screen, setScreen] = useState<Screen>({ name: 'title' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useStore(services.settings.store);

  useEffect(() => {
    applySettingsToDocument(settings);
  }, [settings]);

  useEffect(() => {
    document.title = services.config.title;
    return attachGamepad(services.input);
  }, [services]);

  const keyboard = useMemo(() => createKeyboardAttacher(services), [services]);

  const startChapter = async (profile: PlayerProfile, chapterId: string, saveId: string | null) => {
    setScreen({ name: 'loading' });
    try {
      const chapter = await services.chapters.load(chapterId);
      let save = null;
      if (saveId) {
        const result = await services.saves.load(saveId);
        if (!result.ok) {
          setScreen({ name: 'error', message: result.message, details: [] });
          return;
        }
        save = result.save;
      }
      const current = await services.profiles.touch(profile);
      const runtime = new GameRuntime(services, chapter, current, save, (id) => {
        void services.profiles.markChapterComplete(current, id);
      });
      setScreen({ name: 'game', runtime });
    } catch (error) {
      services.logger.error('Chapter failed to start', error);
      setScreen({
        name: 'error',
        message: 'This chapter could not be loaded. Please try again.',
        details: error instanceof ChapterLoadError && services.config.isDev ? error.issues : [],
      });
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
