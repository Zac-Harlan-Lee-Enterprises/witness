import { WeatherSchema, type Weather } from '@/domain/world';

/**
 * Build-time configuration (public — never put secrets in VITE_* variables).
 */
export interface AppConfig {
  title: string;
  shortTitle: string;
  version: string;
  /** "preview": unreviewed educational content shows an "Awaiting editorial review" label. */
  contentMode: 'preview' | 'strict';
  basePath: string;
  isDev: boolean;
  /**
   * How close the world camera sits (see src/game/systems/camera.ts): "close"
   * in places whose art has the resolution for it (pre-rendered places),
   * "standard" elsewhere. VITE_CAMERA_FRAMING=standard keeps it standard everywhere.
   */
  cameraFraming: 'standard' | 'close';
  /** Pre-rendered places: pick the lighting from the story clock, or force one (for review builds). */
  artLighting: 'auto' | 'day' | 'late';
  /**
   * Review builds only: show this weather everywhere, whatever the story says
   * (VITE_FORCE_WEATHER=clear|wind|rain|storm). null follows the story.
   */
  forceWeather: Weather | null;
}

/** The default camera framing, chosen from side-by-side screenshots (docs/art/prototype-report.md §3). */
export const DEFAULT_FRAMING: AppConfig['cameraFraming'] = 'close';

export function readConfig(env: ImportMetaEnv = import.meta.env): AppConfig {
  return {
    title: env.VITE_GAME_TITLE || 'Witness: A Journey Through Scripture',
    shortTitle: env.VITE_GAME_SHORT_TITLE || 'Witness',
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
    contentMode: env.VITE_CONTENT_MODE === 'strict' ? 'strict' : 'preview',
    basePath: env.BASE_URL || '/',
    isDev: Boolean(env.DEV),
    cameraFraming:
      env.VITE_CAMERA_FRAMING === 'standard'
        ? 'standard'
        : env.VITE_CAMERA_FRAMING === 'close'
          ? 'close'
          : DEFAULT_FRAMING,
    artLighting:
      env.VITE_ART_LIGHTING === 'day' || env.VITE_ART_LIGHTING === 'late'
        ? env.VITE_ART_LIGHTING
        : 'auto',
    forceWeather: forcedWeather(env.VITE_FORCE_WEATHER),
  };
}

function forcedWeather(raw: string | undefined): Weather | null {
  const parsed = WeatherSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
