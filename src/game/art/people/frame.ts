import type { Dress } from './dress';
import type { Rig } from './rig';

/** Key heights and widths of the tunic for a rig: shoulders, waist and hem. */
export interface TorsoFrame {
  cx: number;
  top: number;
  waist: number;
  hem: number;
  shoulder: number;
  waistHalf: number;
  hemHalf: number;
}

export function torsoFrame(d: Dress, r: Rig): TorsoFrame {
  const b = r.build;
  const top = r.shoulders[0].y + 0.4;
  const hipY = r.hips[0].y;
  return {
    cx: (r.shoulders[0].x + r.shoulders[1].x) / 2,
    top,
    waist: hipY + (top - hipY) * 0.33,
    hem: -b.hemY + r.bob * 0.4,
    shoulder: b.shoulder / 2,
    waistHalf: b.hip * 0.5 + (d.build === 'child' ? 0.3 : 0.7),
    hemHalf: b.hip * 0.62 + (d.build === 'child' ? 1.1 : 1.6),
  };
}
