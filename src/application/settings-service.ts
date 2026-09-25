import { DEFAULT_SETTINGS, parseSettings, type GameSettings } from '@/domain/settings';
import type { Logger } from '@/shared/logger';
import { Store } from '@/shared/store';
import type { SettingsRepository } from './ports';

/** Loads, validates, stores and publishes device settings. */
export class SettingsService {
  readonly store = new Store<GameSettings>(DEFAULT_SETTINGS);

  constructor(
    private readonly repo: SettingsRepository,
    private readonly logger: Logger,
    private readonly onFeatureEnabled: (feature: string) => void = () => {},
  ) {}

  get current(): GameSettings {
    return this.store.getState();
  }

  async load(): Promise<GameSettings> {
    try {
      const raw = await this.repo.loadRaw();
      const settings = raw === null ? DEFAULT_SETTINGS : parseSettings(raw);
      this.store.setState(settings);
    } catch (error) {
      this.logger.warn('Settings could not be loaded; using defaults', error);
    }
    return this.current;
  }

  async update(patch: Partial<GameSettings>): Promise<void> {
    const before = this.current;
    const next = parseSettings({ ...before, ...patch });
    this.store.setState(next);
    this.reportAccessibility(before, next);
    try {
      await this.repo.save(next);
    } catch (error) {
      this.logger.warn('Settings could not be saved', error);
    }
  }

  async reset(): Promise<void> {
    await this.update(DEFAULT_SETTINGS);
  }

  private reportAccessibility(before: GameSettings, after: GameSettings): void {
    if (!before.highContrast && after.highContrast) this.onFeatureEnabled('high-contrast');
    if (before.font !== after.font && after.font !== 'standard')
      this.onFeatureEnabled(`font-${after.font}`);
    if (before.reducedMotion !== 'on' && after.reducedMotion === 'on')
      this.onFeatureEnabled('reduced-motion');
    if (before.textScale < after.textScale && after.textScale > 1)
      this.onFeatureEnabled('text-scale');
    if (!before.instantTravel && after.instantTravel) this.onFeatureEnabled('instant-travel');
    if (before.dialogueSpeed !== after.dialogueSpeed && after.dialogueSpeed === 'instant')
      this.onFeatureEnabled('instant-text');
  }
}
