import type { FilmMood, FilmSection } from '@/domain/teaser';
import type { Tone } from './soundscape';

/**
 * A film's score, composed for the game's own synthesiser: each section of
 * the cue sheet (a teaser's `music`) is written out as timed notes, so the
 * music follows the film exactly and can start from any point (a resumed
 * or scrubbed film).
 *
 * The teaser's arc: a quiet dawn (a low drone and a few high bells), the
 * warmth of home and the market (lyre phrases in D dorian), the open road
 * (a walking pulse on a frame drum), unease (the phrase thins out over a
 * darker drone), tension at the bend (a low heartbeat and a rubbed
 * semitone), silence on "What you do next is up to you", and a resolving
 * phrase under the title that comes to rest on D.
 *
 * Deterministic: the same cue sheet always gives the same notes.
 */
export interface ScoreNote extends Tone {
  /** Seconds from the start of the film (`at` of Tone is unused: 0). */
  time: number;
}

/** A sustained note (a drone or pad): a sine with slow attack and release. */
export interface ScorePad {
  time: number;
  dur: number;
  freq: number;
  gain: number;
}

export interface Score {
  notes: ScoreNote[];
  pads: ScorePad[];
  duration: number;
}

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

const D_DORIAN = [62, 64, 65, 67, 69, 71, 72, 74, 76];

function pluck(time: number, midi: number, dur: number, gain = 0.28): ScoreNote {
  return { kind: 'pluck', freq: hz(midi), at: 0, dur, gain, time };
}
function bell(time: number, midi: number, dur: number, gain = 0.12): ScoreNote {
  return { kind: 'bell', freq: hz(midi), at: 0, dur, gain, time };
}
function drum(time: number, gain: number): ScoreNote {
  return { kind: 'knock', freq: 70, at: 0, dur: 0.35, gain, time };
}
function breath(time: number, freq: number, dur: number, gain: number): ScoreNote {
  return { kind: 'breath', freq, at: 0, dur, gain, time };
}

/** A phrase as scale degrees (−1 a rest) at a beat length, from `start`. */
function phrase(
  start: number,
  beat: number,
  degrees: readonly number[],
  until: number,
  gain = 0.26,
) {
  const out: ScoreNote[] = [];
  degrees.forEach((d, i) => {
    const t = start + i * beat;
    const note = D_DORIAN[d];
    if (d >= 0 && note !== undefined && t < until) out.push(pluck(t, note, beat * 2.6, gain));
  });
  return out;
}

type Writer = (from: number, to: number) => { notes: ScoreNote[]; pads: ScorePad[] };

const MOODS: Record<FilmMood, Writer> = {
  // A low open fifth swelling in, and a few high bells, far apart.
  dawn: (from, to) => ({
    pads: [
      { time: from, dur: to - from + 1.5, freq: hz(38), gain: 0.07 },
      { time: from + 0.8, dur: to - from + 0.7, freq: hz(45), gain: 0.05 },
    ],
    notes: [2.2, 4.4, 5.9]
      .filter((t) => from + t < to)
      .map((t, i) => bell(from + t, [81, 79, 76][i] ?? 76, 2.4, 0.07)),
  }),
  // Home: a warm, slow lyre phrase over the drone.
  home: (from, to) => ({
    pads: [{ time: from, dur: to - from + 1, freq: hz(38), gain: 0.06 }],
    notes: phrase(from + 0.3, 0.5, [0, 2, 4, 3, 2, -1, 1, 0, -1, 2, 4, 5], to, 0.24),
  }),
  // The market: the phrase quickens and brightens, a soft drum on the bar.
  market: (from, to) => {
    const notes = [
      ...phrase(
        from,
        0.34,
        [4, 5, 4, 2, 3, -1, 2, 0, 2, 4, 7, 6, 4, -1, 3, 2, 4, 5, 4, 2, 1, -1, 0],
        to,
        0.24,
      ),
    ];
    for (let t = from; t < to; t += 1.36) notes.push(drum(t, 0.1));
    return { pads: [{ time: from, dur: to - from + 0.5, freq: hz(38), gain: 0.05 }], notes };
  },
  // The open road: a walking pulse and a long rising line.
  road: (from, to) => {
    const notes = phrase(
      from + 0.4,
      0.42,
      [0, 3, 4, -1, 5, 4, 3, -1, 1, 3, 5, 6, -1, 7, 5, 4, 3],
      to,
      0.24,
    );
    for (let t = from; t < to; t += 0.84) notes.push(drum(t, t === from ? 0.14 : 0.09));
    return {
      pads: [
        { time: from, dur: to - from + 0.8, freq: hz(38), gain: 0.06 },
        { time: from, dur: to - from + 0.8, freq: hz(45), gain: 0.04 },
      ],
      notes,
    };
  },
  // Unease: the pulse stops; a few notes over a darker drone, a flattened sixth.
  unease: (from, to) => ({
    pads: [
      { time: from, dur: to - from + 1, freq: hz(38), gain: 0.07 },
      { time: from + 1, dur: to - from, freq: hz(46), gain: 0.035 },
    ],
    notes: [
      pluck(from + 0.5, 69, 1.6, 0.2),
      pluck(from + 1.7, 70, 2.2, 0.2),
      pluck(from + 3.4, 65, 1.8, 0.16),
      breath(from + 2.5, 900, 2.6, 0.03),
      pluck(from + 5.0, 62, 2.4, 0.16),
    ].filter((n) => n.time < to),
  }),
  // Tension: a low heartbeat and two notes a semitone apart, rubbing.
  tension: (from, to) => {
    const notes: ScoreNote[] = [];
    for (let t = from; t < to - 0.3; t += 1.1) {
      notes.push(drum(t, 0.12), drum(t + 0.22, 0.07));
    }
    notes.push(bell(from + 1.2, 74, 3.5, 0.06), bell(from + 3.0, 75, 3.5, 0.05));
    return {
      pads: [
        { time: from, dur: to - from + 0.4, freq: hz(38), gain: 0.08 },
        { time: from + 0.5, dur: to - from - 0.1, freq: hz(39), gain: 0.04 },
      ],
      notes: notes.filter((n) => n.time < to),
    };
  },
  silence: () => ({ notes: [], pads: [] }),
  // Under the title: the home phrase returns, slower, and comes to rest on D.
  resolve: (from, to) => ({
    pads: [
      { time: from, dur: to - from, freq: hz(38), gain: 0.07 },
      { time: from + 0.6, dur: to - from - 0.6, freq: hz(50), gain: 0.04 },
    ],
    notes: [
      ...phrase(from + 0.4, 0.62, [0, 2, 4, -1, 3, 2, 1, -1, 0], to, 0.26),
      bell(from + 5.6, 74, 3, 0.08),
    ],
  }),
};

/** Write out a cue sheet as notes and pads, section by section. */
export function composeScore(sections: readonly FilmSection[], duration: number): Score {
  const notes: ScoreNote[] = [];
  const pads: ScorePad[] = [];
  sections.forEach((s, i) => {
    const to = sections[i + 1]?.at ?? duration;
    const part = MOODS[s.mood](s.at, to);
    notes.push(...part.notes);
    pads.push(...part.pads);
  });
  notes.sort((a, b) => a.time - b.time);
  return { notes, pads, duration };
}

/** What still sounds, or is still to come, from `from` seconds on. */
export function scoreFrom(score: Score, from: number): Score {
  return {
    duration: score.duration,
    notes: score.notes.filter((n) => n.time >= from),
    pads: score.pads
      .filter((p) => p.time + p.dur > from)
      .map((p) => (p.time >= from ? p : { ...p, dur: p.time + p.dur - from, time: from })),
  };
}
