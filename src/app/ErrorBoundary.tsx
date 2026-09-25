import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { Logger } from '@/shared/logger';

/**
 * Last line of defence: any render error shows a recoverable screen instead
 * of a blank page. Saved progress is untouched.
 */
interface Props {
  logger: Logger;
  children: ReactNode;
  onReset?: () => void;
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.logger.error('UI crashed', {
      message: error.message,
      stack: info.componentStack?.slice(0, 400),
    });
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen error-screen" role="alert">
        <h1>Something went wrong</h1>
        <p>The game hit an unexpected problem. Your saved progress is safe on this device.</p>
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            this.setState({ failed: false });
            this.props.onReset?.();
          }}
        >
          Back to the title screen
        </button>{' '}
        <button type="button" className="button" onClick={() => window.location.reload()}>
          Reload the game
        </button>
      </main>
    );
  }
}
