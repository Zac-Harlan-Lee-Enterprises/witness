import { AnalyticsService } from '@/application/analytics';
import type { AppNotice } from '@/application/app-notices';
import { VirtualInput } from '@/application/input';
import type {
  AuthProvider,
  AudioPort,
  ChapterSource,
  Clock,
  ScriptureTextProvider,
  StudyGuide,
  SyncProvider,
} from '@/application/ports';
import { ProfileService } from '@/application/profile-service';
import { SaveService } from '@/application/save-service';
import { SettingsService } from '@/application/settings-service';
import { chapterSource } from '@/content';
import { STORED_PASSAGES, TRANSLATIONS } from '@/content/scripture/translations';
import { DisabledStudyGuide } from '@/infrastructure/ai/disabled-study-guide';
import { LogAnalytics, NoopAnalytics } from '@/infrastructure/analytics/providers';
import { SilentAudio, SynthAudio, type MusicReport } from '@/infrastructure/audio/synth-audio';
import { createRepositories, type Repositories } from '@/infrastructure/persistence/indexeddb';
import { StaticScriptureProvider } from '@/infrastructure/scripture/scripture-provider';
import { LocalOnlyAuth, LocalOnlySync } from '@/infrastructure/sync/local-only';
import { createLogger, type Logger } from '@/shared/logger';
import { Store } from '@/shared/store';
import { readConfig, type AppConfig } from './config';

/**
 * Composition root: the ONLY place that knows which concrete implementation
 * backs each port. Swap IndexedDB for cloud sync, the synth for recorded
 * audio, or the disabled guide for an approved study guide here — nowhere else.
 */
export interface AppServices {
  config: AppConfig;
  logger: Logger;
  clock: Clock;
  repositories: Repositories;
  saves: SaveService;
  profiles: ProfileService;
  settings: SettingsService;
  analytics: AnalyticsService;
  audio: AudioPort;
  input: VirtualInput;
  chapters: ChapterSource;
  scripture: ScriptureTextProvider;
  guide: StudyGuide;
  sync: SyncProvider;
  /** Local-only today; the seam for future Cognito sign-in (docs/future-aws.md). */
  auth: AuthProvider;
  notices: Store<AppNotice>;
  applyUpdate: (() => Promise<void>) | null;
}

/**
 * What the music is doing, on the document element (data-music: the track
 * or "none"; data-music-playing; data-music-volume), so end-to-end tests
 * and bug reports can see it without listening.
 */
function showMusicStatus(report: MusicReport): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.dataset;
  root.music = report.track ?? 'none';
  root.musicPlaying = String(report.playing);
  root.musicVolume = String(report.volume);
}

export async function createAppServices(
  overrides: Partial<AppServices> = {},
): Promise<AppServices> {
  const config = overrides.config ?? readConfig();
  const logger =
    overrides.logger ??
    createLogger({ level: config.isDev ? 'debug' : 'warn', echo: config.isDev });
  const clock: Clock = overrides.clock ?? { now: () => Date.now() };
  const repositories = overrides.repositories ?? (await createRepositories());
  const notices = new Store<AppNotice>({
    captions: [],
    updateAvailable: false,
    offlineReady: false,
    storageWarning: repositories.status.persistent ? null : repositories.status.reason,
  });
  let captionId = 0;
  const pushCaption = (text: string): void => {
    const id = ++captionId;
    notices.setState((n) => ({ ...n, captions: [...n.captions, { id, text }].slice(-2) }));
    setTimeout(
      () => notices.setState((n) => ({ ...n, captions: n.captions.filter((c) => c.id !== id) })),
      4500,
    );
  };

  const settingsHolder: { service: SettingsService | null } = { service: null };
  const analytics =
    overrides.analytics ??
    new AnalyticsService(config.isDev ? new LogAnalytics(logger) : new NoopAnalytics(), () =>
      Boolean(settingsHolder.service?.current.analyticsConsent),
    );
  const settings =
    overrides.settings ??
    new SettingsService(repositories.settings, logger, (feature) =>
      analytics.track({ name: 'AccessibilityFeatureEnabled', props: { feature } }),
    );
  settingsHolder.service = settings;
  await settings.load();

  const audio =
    overrides.audio ??
    (typeof window !== 'undefined' && 'AudioContext' in window
      ? new SynthAudio(logger, pushCaption, undefined, undefined, {
          base: config.basePath,
          onMusicStatus: showMusicStatus,
        })
      : new SilentAudio());
  audio.applySettings(settings.current);
  settings.store.subscribe(() => audio.applySettings(settings.current));

  return {
    config,
    logger,
    clock,
    repositories,
    saves: overrides.saves ?? new SaveService(repositories.saves, clock, logger),
    profiles:
      overrides.profiles ??
      new ProfileService(repositories.profiles, repositories.saves, clock, logger),
    settings,
    analytics,
    audio,
    input: overrides.input ?? new VirtualInput(),
    chapters: overrides.chapters ?? chapterSource,
    scripture: overrides.scripture ?? new StaticScriptureProvider(TRANSLATIONS, STORED_PASSAGES),
    guide: overrides.guide ?? new DisabledStudyGuide(),
    sync: overrides.sync ?? new LocalOnlySync(),
    auth: overrides.auth ?? new LocalOnlyAuth(),
    notices,
    applyUpdate: null,
  };
}
