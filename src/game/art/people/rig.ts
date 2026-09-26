import type { Direction } from '@/domain/state/game-state';

/**
 * The skeleton behind every painted person: where the feet, knees, hips,
 * shoulders, hands and head are in each animation frame. Pure numbers, no
 * canvas, so the motion rules (the feet alternate, the body is lowest at
 * contact, the arms swing against the legs) are unit-tested.
 *
 * Local units: x to the right, y DOWN (canvas), origin on the ground between
 * the feet. A tile is 32 units. Index 0 of each pair is the far/screen-left
 * limb, index 1 the near/screen-right limb (see `limbOrder`).
 */
export type Build = 'child' | 'adult' | 'elder';

export interface BuildSpec {
  /** Standing height, sole to crown. */
  height: number;
  /** Head height (crown to chin). */
  head: number;
  shoulder: number;
  hip: number;
  /** Height of the hip joint above the ground. */
  hipY: number;
  kneeY: number;
  shoulderY: number;
  /** Where the tunic ends above the ground. */
  hemY: number;
  /** Forward lean of the upper body in profile (units at the shoulder). */
  stoop: number;
  /** Half the distance the foot travels in one step. */
  stride: number;
}

/** About 7 heads tall for adults, 6 for children; the head is drawn a little large to read at play size. */
export const BUILDS: Record<Build, BuildSpec> = {
  adult: {
    height: 54,
    head: 8.4,
    shoulder: 14.6,
    hip: 10.6,
    hipY: 26.5,
    kneeY: 14.5,
    shoulderY: 44,
    hemY: 5.2,
    stoop: 0,
    stride: 5.4,
  },
  child: {
    height: 44,
    head: 7.9,
    shoulder: 11.2,
    hip: 8.6,
    hipY: 20.6,
    kneeY: 11.2,
    shoulderY: 34.4,
    hemY: 10.4,
    stoop: 0,
    stride: 4.6,
  },
  elder: {
    height: 52,
    head: 8.4,
    shoulder: 14,
    hip: 10.6,
    hipY: 25.6,
    kneeY: 14,
    shoulderY: 41.8,
    hemY: 4.2,
    stoop: 2.2,
    stride: 4.2,
  },
};

export const WALK_FRAMES = 8;
/** Column of each frame in a standing sheet. */
export const FRAME = {
  idle: 0,
  breath: 1,
  blink: 2,
  talk: 3,
  talk2: 4,
  walk: 5,
} as const;
export const FRAMES_PER_DIRECTION = FRAME.walk + WALK_FRAMES;

export interface Pt {
  x: number;
  y: number;
}

export interface Rig {
  dir: Direction;
  build: BuildSpec;
  /** Vertical body offset (negative = up). */
  bob: number;
  /** Sideways weight shift. */
  sway: number;
  /** Chest rise when breathing. */
  breath: number;
  hips: [Pt, Pt];
  knees: [Pt, Pt];
  /** Ankles; `lift` > 0 when the foot is off the ground. */
  feet: [Pt & { lift: number }, Pt & { lift: number }];
  shoulders: [Pt, Pt];
  elbows: [Pt, Pt];
  hands: [Pt, Pt];
  neck: Pt;
  /** Centre of the head. */
  head: Pt;
  eyesClosed: boolean;
  /** 0 closed, 1 open. */
  mouth: number;
  /** Which hand is gesturing (talk frames), if any. */
  gesture: 0 | 1 | null;
  /** How far each leg pushes the hem forward (−1…1). */
  legSwing: [number, number];
}

/** Forward position and lift of a foot at phase `q` of the walk cycle. */
export function footPhase(q: number, stride: number, lift: number): { u: number; lift: number } {
  const t = ((q % 1) + 1) % 1;
  if (t < 0.5) {
    // Stance: planted, travelling back under the body.
    return { u: stride * (1 - 4 * t), lift: 0 };
  }
  // Swing: lifted, travelling forward.
  const s = (t - 0.5) / 0.5;
  const eased = s * s * (3 - 2 * s);
  return { u: stride * (-1 + 2 * eased), lift: lift * Math.sin(Math.PI * s) };
}

/** Upward body offset at walk phase `p`: lowest at contact, highest when passing. */
export function walkBob(p: number, amount: number): number {
  return -amount * Math.sin(2 * Math.PI * p) ** 2;
}

/** Two-bone leg: the knee for a hip and ankle, bending toward `forward` (+1 or −1). */
export function solveKnee(hip: Pt, ankle: Pt, thigh: number, shin: number, forward: number): Pt {
  const dx = ankle.x - hip.x;
  const dy = ankle.y - hip.y;
  const d = Math.min(Math.hypot(dx, dy), thigh + shin - 0.001);
  const a = (thigh * thigh - shin * shin + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, thigh * thigh - a * a));
  const ux = dx / (d || 1);
  const uy = dy / (d || 1);
  const mx = hip.x + ux * a;
  const my = hip.y + uy * a;
  // Perpendicular, chosen so the knee points forward.
  const px = -uy;
  const py = ux;
  const sign = px * forward >= 0 ? 1 : -1;
  return { x: mx + px * h * sign, y: my + py * h * sign };
}

const DEPTH = 0.28;

export interface FrameSpec {
  /** Walk phase 0…1, or null when standing. */
  walk: number | null;
  breath: boolean;
  blink: boolean;
  talk: 0 | 1 | 2;
}

export function frameSpec(column: number): FrameSpec {
  if (column >= FRAME.walk)
    return { walk: (column - FRAME.walk) / WALK_FRAMES, breath: false, blink: false, talk: 0 };
  return {
    walk: null,
    breath: column === FRAME.breath,
    blink: column === FRAME.blink,
    talk: column === FRAME.talk ? 1 : column === FRAME.talk2 ? 2 : 0,
  };
}

/** The skeleton for a standing or walking figure in one frame. */
export function rigFor(buildName: Build, dir: Direction, spec: FrameSpec): Rig {
  const b = BUILDS[buildName];
  const side = dir === 'left' || dir === 'right';
  const flip = dir === 'left' ? -1 : 1;
  const away = dir === 'up' ? -1 : 1;
  const p = spec.walk;
  const walking = p !== null;
  const bob = walking ? walkBob(p, 0.9) + 0.45 : 0;
  const sway = walking && !side ? Math.sin(2 * Math.PI * p) * 0.55 : spec.breath ? 0.25 : 0;
  const breath = spec.breath ? 0.45 : 0;
  const stoop = side ? b.stoop * flip : 0;

  // Legs: phase 0 for leg 0, half a cycle later for leg 1.
  const liftMax = b.height * 0.07;
  const phases: [number, number] = walking ? [p, p + 0.5] : [0.25, 0.75];
  const steps = phases.map((q) =>
    walking ? footPhase(q, b.stride, liftMax) : { u: 0, lift: 0 },
  ) as [{ u: number; lift: number }, { u: number; lift: number }];

  const hipHalf = side ? 0.9 : b.hip * 0.26;
  const hipY = -b.hipY + bob;
  const hips: [Pt, Pt] = side
    ? [
        { x: stoop * 0.2 - flip * hipHalf, y: hipY },
        { x: stoop * 0.2 + flip * hipHalf, y: hipY },
      ]
    : [
        { x: -hipHalf + sway, y: hipY },
        { x: hipHalf + sway, y: hipY },
      ];
  const ankleH = b.height * 0.035;
  const feet = steps.map((s, i) => {
    const hip = hips[i] as Pt;
    if (side) return { x: hip.x + s.u * flip, y: -ankleH - s.lift, lift: s.lift };
    // Seen from the front, a step forward comes toward the camera (down the screen).
    const baseX = (i === 0 ? -1 : 1) * b.hip * 0.2;
    return { x: baseX, y: -ankleH - s.lift + s.u * DEPTH * away, lift: s.lift };
  }) as Rig['feet'];
  const thigh = b.hipY - b.kneeY;
  const shin = b.kneeY - ankleH;
  const knees = feet.map((f, i) => {
    const hip = hips[i] as Pt;
    if (side) return solveKnee(hip, f, thigh, shin, flip);
    // Front and back: the knee sits over the foot, rising as the foot lifts.
    const t = 0.55;
    return { x: hip.x + (f.x - hip.x) * t, y: hip.y + (f.y - hip.y) * t - f.lift * 0.3 };
  }) as [Pt, Pt];

  // Upper body.
  const shoulderY = -b.shoulderY + bob - breath;
  const sh = b.shoulder / 2;
  const shoulders: [Pt, Pt] = side
    ? [
        { x: stoop - flip * 1.4, y: shoulderY + 0.4 },
        { x: stoop + flip * 1.2, y: shoulderY },
      ]
    : [
        { x: -sh + sway * 0.6, y: shoulderY },
        { x: sh + sway * 0.6, y: shoulderY },
      ];
  const upper = b.height * 0.19;
  const fore = b.height * 0.17;
  const arm = (i: 0 | 1): { elbow: Pt; hand: Pt } => {
    const s = shoulders[i];
    // Arms swing against the leg on the same side.
    const swing = walking ? -(steps[i].u / b.stride) : 0;
    const gesturing = spec.talk > 0 && gestureHand(dir) === i;
    if (gesturing) {
      const raise = spec.talk === 1 ? 1 : 0.7;
      if (side) {
        return {
          elbow: { x: s.x + flip * 1.4, y: s.y + upper * 0.95 },
          hand: {
            x: s.x + flip * (fore * 0.55 * raise + 1.8),
            y: s.y + upper * 0.95 - fore * 0.55 * raise,
          },
        };
      }
      const out = i === 0 ? -1 : 1;
      return {
        elbow: { x: s.x + out * 1.8, y: s.y + upper * 0.95 },
        hand: {
          x: s.x + out * 0.4 - out * 2.4 * raise,
          y: s.y + upper * 0.95 + fore * (0.2 - 0.55 * raise),
        },
      };
    }
    if (side) {
      const a = swing * 0.36;
      const elbow = { x: s.x + Math.sin(a) * upper * flip, y: s.y + Math.cos(a) * upper };
      const b2 = a + (swing > 0 ? 0.35 * swing : 0.12 * swing);
      return {
        elbow,
        hand: { x: elbow.x + Math.sin(b2) * fore * flip, y: elbow.y + Math.cos(b2) * fore },
      };
    }
    const out = i === 0 ? -1 : 1;
    // Relaxed arms hang a little away from the body, the forearm angled
    // slightly forward (so it looks a touch shorter from the camera).
    const elbow = { x: s.x + out * 1.5, y: s.y + upper * 0.97 + swing * DEPTH * 2 * away };
    return {
      elbow,
      hand: {
        x: elbow.x - out * 0.2 - out * Math.abs(swing) * 0.4,
        y: elbow.y + fore * 0.92 + swing * DEPTH * 4.5 * away - Math.max(0, swing * away) * 1.2,
      },
    };
  };
  const a0 = arm(0);
  const a1 = arm(1);

  const neck = { x: side ? stoop + flip * 0.6 : sway * 0.6, y: shoulderY - b.head * 0.18 };
  const head = {
    x: side ? stoop * 1.25 + flip * 1.1 : sway * 0.6,
    y: shoulderY - b.head * 0.62 + (b.stoop > 0 ? 0.8 : 0),
  };
  return {
    dir,
    build: b,
    bob,
    sway,
    breath,
    hips,
    knees,
    feet,
    shoulders,
    elbows: [a0.elbow, a1.elbow],
    hands: [a0.hand, a1.hand],
    neck,
    head,
    eyesClosed: spec.blink,
    mouth: spec.talk === 1 ? 1 : spec.talk === 2 ? 0.45 : 0,
    gesture: spec.talk > 0 ? gestureHand(dir) : null,
    legSwing: [steps[0].u / b.stride, steps[1].u / b.stride],
  };
}

/** The hand that gestures while talking: the near (or screen-right) hand. */
export function gestureHand(_dir: Direction): 0 | 1 {
  return 1;
}

/**
 * Which limbs are near the camera. In profile the near side is index 1.
 * Facing right, a person's RIGHT side faces the camera; facing left, their LEFT.
 * Facing down, their right hand is on screen-left (index 0).
 */
export function rightHandIndex(dir: Direction): 0 | 1 {
  if (dir === 'down') return 0;
  if (dir === 'up') return 1;
  return dir === 'right' ? 1 : 0;
}

/** Distance (in tiles) covered by one full walk cycle (two steps). */
export const WALK_CYCLE_TILES = { player: 1.5, crowd: 0.9 } as const;

/** The sheet column for someone who has walked `distance` tiles. */
export function walkColumn(distance: number, cycleTiles: number): number {
  const phase = (((distance / cycleTiles) % 1) + 1) % 1;
  return FRAME.walk + (Math.floor(phase * WALK_FRAMES) % WALK_FRAMES);
}

/** A foot touches down on these walk frames (contact positions). */
export function isFootfall(column: number): boolean {
  const f = column - FRAME.walk;
  return f === 0 || f === WALK_FRAMES / 2;
}

/** How far a seated figure is lowered from standing: the hips come down almost to the ground. */
export function seatDrop(b: BuildSpec): number {
  return b.hipY - 2.5;
}

/** A wound head cloth rises to about 0.78 head-heights above the head's centre. */
const COVERED_HEAD_TOP = 0.8;

/**
 * The top of someone's head, head covering included, above the ground they
 * stand or sit on (world units). Marks drawn over a person must clear it.
 */
export function headTop(buildName: Build, seated: boolean): number {
  const r = rigFor(buildName, 'down', frameSpec(FRAME.idle));
  const top = -r.head.y + r.build.head * COVERED_HEAD_TOP;
  return seated ? top - seatDrop(r.build) : top;
}
