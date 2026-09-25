import type { AnalyticsEvent, AnalyticsProvider } from '@/application/ports';
import type { Logger } from '@/shared/logger';

/** Default: analytics go nowhere. The game is fully functional without a provider. */
export class NoopAnalytics implements AnalyticsProvider {
  readonly name = 'none';
  track(): void {}
}

/**
 * Development provider: writes the (already sanitised) events to the
 * diagnostics log so developers can see exactly what WOULD be sent.
 */
export class LogAnalytics implements AnalyticsProvider {
  readonly name = 'log';
  readonly sent: AnalyticsEvent[] = [];
  constructor(private readonly logger: Logger) {}
  track(event: AnalyticsEvent): void {
    this.sent.push(event);
    this.logger.info(`analytics: ${event.name}`, event.props);
  }
}
