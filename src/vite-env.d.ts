/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GAME_TITLE?: string;
  readonly VITE_GAME_SHORT_TITLE?: string;
  readonly VITE_CONTENT_MODE?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_CAMERA_FRAMING?: string;
  readonly VITE_ART_LIGHTING?: string;
}

declare const __APP_VERSION__: string;
