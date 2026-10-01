import type { Harness } from './harness';

/**
 * A play-time meter for headless playthroughs: it watches what a player is
 * shown (every dialogue line and choice, every message, every puzzle and the
 * ending's panels) and turns it into an estimate of real play for someone
 * playing the chapter for the first time (docs/game-design.md §11, "How long a
 * chapter plays"). Lines seen again, like a conversation's list of questions, are
 * counted once.
 *
 * Two readers, because play time depends most on reading:
 * - STEADY: a first-time player who reads every line (230 words a minute,
 *   a confident young reader), takes a first attempt at each puzzle, walks
 *   (4.5 tiles a second) and looks around each place;
 * - BRISK: an adult who reads fast (320 words a minute), solves puzzles
 *   quickly and skims the Scripture Connection — how the chapters felt to
 *   the owner when he said they were "playing pretty quick".
 */
export interface PlayTimeProfile {
  wordsPerMinute: number;
  secondsPerChoice: number;
  /** Walking to, and finding, each thing the player goes to. */
  secondsPerInteraction: number;
  /** Taking in each new place. */
  secondsPerPlace: number;
  /** A first solve of each puzzle type, in seconds. */
  puzzleSeconds: Record<string, number>;
  /** How much of the Scripture Connection is read. */
  scriptureConnectionShare: number;
  reflectionSeconds: number;
  summarySeconds: number;
}

const FIRST_SOLVE: Record<string, number> = {
  packing: 75,
  measuring: 120,
  deduction: 90,
  sequence: 75,
  trim: 150,
  netting: 120,
  floorplan: 150,
  logicGrid: 150,
  dyeing: 100,
  map: 100,
};

export const STEADY: PlayTimeProfile = {
  wordsPerMinute: 230,
  secondsPerChoice: 3,
  secondsPerInteraction: 6,
  secondsPerPlace: 20,
  puzzleSeconds: FIRST_SOLVE,
  scriptureConnectionShare: 1 / 3,
  reflectionSeconds: 45,
  summarySeconds: 45,
};

export const BRISK: PlayTimeProfile = {
  wordsPerMinute: 320,
  secondsPerChoice: 2,
  secondsPerInteraction: 4,
  secondsPerPlace: 12,
  puzzleSeconds: Object.fromEntries(
    Object.entries(FIRST_SOLVE).map(([type, s]) => [type, Math.round(s * 0.6)]),
  ),
  scriptureConnectionShare: 0.2,
  reflectionSeconds: 30,
  summarySeconds: 30,
};

export interface PlayTime {
  minutes: number;
  words: number;
  lines: number;
  choices: number;
  interactions: number;
  places: number;
  puzzles: string[];
  breakdown: Record<string, number>;
}

const words = (text: string): number => text.split(/\s+/).filter(Boolean).length;
const minutes = (seconds: number): number => Math.round((seconds / 60) * 10) / 10;

export class PlayMeter {
  private readonly lines = new Set<string>();
  private readonly toasts = new Set<number>();
  private readonly puzzles = new Set<string>();
  private readonly places = new Set<string>();
  private readonly panels = new Set<string>();
  private words = 0;
  private choiceSets = 0;
  private interactions = 0;

  constructor(private readonly h: Harness) {
    h.ui.subscribe(() => {
      this.observe();
    });
    const interact = h.controller.interact.bind(h.controller);
    h.controller.interact = (entityId: string) => {
      this.interactions++;
      interact(entityId);
    };
    this.observe();
  }

  private observe(): void {
    const s = this.h.ui.getState();
    const d = s.dialogue;
    if (d) {
      const key = `${d.dialogueId}/${d.nodeId}`;
      if (!this.lines.has(key)) {
        this.lines.add(key);
        this.words += words(d.text) + d.choices.reduce((n, c) => n + words(c.text), 0);
        if (d.choices.length > 1) this.choiceSets++;
      }
    }
    for (const t of s.toasts)
      if (!this.toasts.has(t.id)) {
        this.toasts.add(t.id);
        this.words += words(t.text);
      }
    if (s.puzzleId) this.puzzles.add(s.puzzleId);
    if (s.panel) this.panels.add(s.panel);
    this.places.add(this.h.session.state.sceneId);
  }

  estimate(profile: PlayTimeProfile = STEADY): PlayTime {
    const m = profile;
    const chapter = this.h.chapter;
    const puzzles = [...this.puzzles];
    const opened = puzzles.map((id) => chapter.puzzles.find((p) => p.id === id));
    const puzzleSeconds = opened.reduce((n, p) => n + (m.puzzleSeconds[p?.type ?? ''] ?? 90), 0);
    const puzzleWords = opened.reduce(
      (n, p) => n + (p ? words(p.intro) + words(p.explanation) : 0),
      0,
    );
    const connection = chapter.scriptureConnection;
    const connectionWords = this.panels.has('scripture-connection')
      ? words(connection.intro) +
        connection.sections
          .flatMap((s) => s.recordIds)
          .map((id) => chapter.records.find((r) => r.id === id)?.body ?? '')
          .reduce((n, body) => n + words(body), 0)
      : 0;
    const breakdown = {
      reading: ((this.words + puzzleWords) / m.wordsPerMinute) * 60,
      choosing: this.choiceSets * m.secondsPerChoice,
      walking: this.interactions * m.secondsPerInteraction + this.places.size * m.secondsPerPlace,
      puzzles: puzzleSeconds,
      ending:
        ((connectionWords * m.scriptureConnectionShare) / m.wordsPerMinute) * 60 +
        (this.panels.has('reflection') ? m.reflectionSeconds : 0) +
        (this.panels.has('summary') ? m.summarySeconds : 0),
    };
    return {
      minutes: minutes(Object.values(breakdown).reduce((a, b) => a + b, 0)),
      words: this.words + puzzleWords,
      lines: this.lines.size,
      choices: this.choiceSets,
      interactions: this.interactions,
      places: this.places.size,
      puzzles,
      breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, minutes(v)])),
    };
  }
}
