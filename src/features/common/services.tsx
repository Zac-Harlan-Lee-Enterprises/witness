import { createContext, useContext, type ReactNode } from 'react';
import type { AnalyticsService } from '@/application/analytics';
import type { AppNotice } from '@/application/app-notices';
import type { VirtualInput } from '@/application/input';
import type { AudioPort, ChapterSource, ScriptureTextProvider } from '@/application/ports';
import type { ProfileService } from '@/application/profile-service';
import type { SaveService } from '@/application/save-service';
import type { SettingsService } from '@/application/settings-service';
import type { Logger } from '@/shared/logger';
import type { Store } from '@/shared/store';

/**
 * What the React UI may use. Only application-layer services and ports —
 * never IndexedDB, Phaser or other infrastructure (enforced by
 * tests/architecture). The composition root provides a value that satisfies it.
 */
export interface UiServices {
  config: { title: string; shortTitle: string; version: string; contentMode: 'preview' | 'strict' };
  logger: Logger;
  saves: SaveService;
  profiles: ProfileService;
  settings: SettingsService;
  analytics: AnalyticsService;
  audio: AudioPort;
  input: VirtualInput;
  chapters: ChapterSource;
  scripture: ScriptureTextProvider;
  notices: Store<AppNotice>;
  applyUpdate: (() => Promise<void>) | null;
}

const ServicesContext = createContext<UiServices | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: UiServices;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): UiServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}
