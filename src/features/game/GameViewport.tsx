import { useEffect, useRef, useState } from 'react';
import type { GameRuntimeLike } from './types';

/**
 * Hosts the world canvas. It only hands a DOM element to the runtime — it
 * knows nothing about Phaser (which is lazy-loaded behind that call).
 */
export function GameViewport({ runtime }: { runtime: GameRuntimeLike }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    runtime
      .mountWorld(el)
      .then(() => alive && setStatus('ready'))
      .catch(() => {
        if (!alive) return;
        setStatus('error');
        runtime.ui.setFatalError(
          'The game world could not start on this device (graphics may be unavailable). Your progress is saved.',
        );
      });
    return () => {
      alive = false;
    };
  }, [runtime]);

  return (
    <div className="viewport" ref={ref} data-status={status}>
      {status === 'loading' && (
        <p className="viewport__loading" role="status">
          Loading the world…
        </p>
      )}
    </div>
  );
}
