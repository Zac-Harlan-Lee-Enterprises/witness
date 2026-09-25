import type { DomainEvent } from '@/domain/events';
import type { SaveSlot } from '@/domain/save';
import { debounce, type Debounced } from '@/shared/debounce';
import type { TypedEventBus } from '@/shared/event-bus';
import type { GameSession } from './game-session';
import type { SaveService } from './save-service';

/**
 * Autosave: listens for SaveRequested (scene changes, quest progress, solved
 * puzzles, chapter completion) and writes the 'auto' slot, debounced so a
 * burst of events produces one write. `flush()` is called on pagehide.
 */
export class Autosaver {
  private readonly debounced: Debounced;
  private readonly unsubscribe: () => void;
  private writing: Promise<unknown> = Promise.resolve();
  lastSavedAt: number | null = null;

  constructor(
    private readonly session: GameSession,
    private readonly saves: SaveService,
    private readonly profileId: string,
    bus: TypedEventBus<DomainEvent>,
    private readonly onResult: (ok: boolean) => void = () => {},
    delayMs = 600,
  ) {
    this.debounced = debounce(() => {
      void this.write('auto');
    }, delayMs);
    this.unsubscribe = bus.on('SaveRequested', (event) => {
      if (event.reason === 'chapter-complete') {
        this.debounced.cancel();
        void this.write('auto');
      } else if (event.reason !== 'manual') {
        this.debounced();
      }
    });
  }

  async write(slot: SaveSlot): Promise<boolean> {
    const run = this.writing.then(() =>
      this.saves.save(this.profileId, slot, this.session.chapter, this.session.state),
    );
    this.writing = run.catch(() => false);
    const ok = await run;
    if (ok) this.lastSavedAt = Date.now();
    this.onResult(ok);
    return ok;
  }

  flush(): void {
    this.debounced.flush();
  }

  dispose(): void {
    this.debounced.flush();
    this.unsubscribe();
  }
}
