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
}

export function readConfig(env: ImportMetaEnv = import.meta.env): AppConfig {
  return {
    title: env.VITE_GAME_TITLE || 'Witness: A Journey Through Scripture',
    shortTitle: env.VITE_GAME_SHORT_TITLE || 'Witness',
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
    contentMode: env.VITE_CONTENT_MODE === 'strict' ? 'strict' : 'preview',
    basePath: env.BASE_URL || '/',
    isDev: Boolean(env.DEV),
  };
}
