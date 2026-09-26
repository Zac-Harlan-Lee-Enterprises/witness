import Phaser from 'phaser';
import type { TileGrid } from '@/domain/world';
import { waterRegions, type WaterLook } from '../systems/water';

/**
 * Live water (WebGL only): a shader drawn over each body of water tiles and
 * each painted well and trough. Waves are a few travelling swells plus fine
 * ripples; their normals catch the sky (brighter at grazing angles) and the
 * sun (glints between you and it); rain pocks the surface with rings; a
 * storm raises choppy, foam-streaked water. The art underneath still shows
 * through, so the water keeps the place's own colour.
 *
 * Canvas renderer: not drawn (the painted water stands as it is).
 */
const TILE = 32;
/** Mask resolution: texels per tile (sampled smoothly for soft shores). */
const MASK_PPT = 8;

const FRAG = `
#define SHADER_NAME WITNESS_WATER
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uTime;
uniform vec2 resolution;
uniform sampler2D iChannel0;
uniform vec2 uOrigin;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform float uWaves;
uniform float uGlints;
uniform float uRain;
uniform float uFoam;
uniform float uGloom;
uniform float uOpacity;
uniform vec2 uMaskTexel;
varying vec2 fragCoord;

float hash21 (vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise (vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Height of the surface and its slope, from a few travelling swells.
vec3 waves (vec2 p, float t) {
  float h = 0.0;
  vec2 g = vec2(0.0);
  float a = uWaves;
  vec2 d1 = normalize(vec2(0.9, 0.35));
  vec2 d2 = normalize(vec2(0.55, -0.8));
  vec2 d3 = normalize(vec2(-0.3, 0.95));
  vec2 d4 = normalize(vec2(0.97, -0.12));
  float f1 = 0.11; float f2 = 0.19; float f3 = 0.31; float f4 = 0.53;
  float s1 = 1.1 + 1.6 * uWaves; float s2 = 1.5 + 2.0 * uWaves;
  float s3 = 2.2 + 2.2 * uWaves; float s4 = 3.1 + 3.0 * uWaves;
  float p1 = dot(d1, p) * f1 - t * s1;
  float p2 = dot(d2, p) * f2 - t * s2;
  float p3 = dot(d3, p) * f3 - t * s3;
  float p4 = dot(d4, p) * f4 - t * s4;
  h += a * (sin(p1) * 1.0 + sin(p2) * 0.6 + sin(p3) * 0.35 + sin(p4) * 0.2);
  g += a * (d1 * f1 * cos(p1) * 1.0 + d2 * f2 * cos(p2) * 0.6
          + d3 * f3 * cos(p3) * 0.35 + d4 * f4 * cos(p4) * 0.2);
  // Fine ripples: short, quick wavelets from other directions (smooth, no grid).
  vec2 d5 = normalize(vec2(0.2, 1.0));
  vec2 d6 = normalize(vec2(-0.8, 0.45));
  vec2 d7 = normalize(vec2(0.7, 0.7));
  float r = 0.3 + uWaves;
  // A slow warp so the wavelets never line up into a regular pattern.
  vec2 q = p + 6.0 * vec2(noise(p * 0.045 + t * 0.04), noise(p * 0.045 + 17.0 - t * 0.03));
  float p5 = dot(d5, q) * 0.93 - t * 4.1;
  float p6 = dot(d6, q) * 1.31 - t * 5.3;
  float p7 = dot(d7, q) * 1.77 - t * 6.2;
  // Patches of calmer and livelier water drift across the surface.
  float patchy = 0.55 + 0.9 * noise(p * 0.035 + vec2(t * 0.05, t * 0.03));
  g += r * patchy * (d5 * 0.93 * cos(p5) * 0.1 + d6 * 1.31 * cos(p6) * 0.07 + d7 * 1.77 * cos(p7) * 0.045);
  return vec3(g, h);
}

// Rings where raindrops land: one chance per cell, staggered in time.
float rings (vec2 p, float t) {
  float total = 0.0;
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    vec2 cell = floor(p / 9.0 + fl * 0.5);
    vec2 local = p / 9.0 + fl * 0.5 - cell;
    float rnd = hash21(cell + fl * 17.0);
    vec2 centre = vec2(0.25) + 0.5 * vec2(hash21(cell + 3.1), hash21(cell + 7.7));
    float phase = fract(t * (0.9 + rnd * 0.6) + rnd * 13.0);
    float r = phase * 0.45;
    float dist = length((local - centre) * vec2(1.0, 1.15));
    float ring = smoothstep(0.035, 0.0, abs(dist - r)) * (1.0 - phase) * (1.0 - phase);
    total += ring * step(rnd, uRain * 0.85 + 0.1);
  }
  return total * uRain;
}

void main () {
  vec2 local = vec2(fragCoord.x, resolution.y - fragCoord.y);
  vec2 uv = local / resolution;
  // Soft shores: a few taps of the tile mask.
  float m = texture2D(iChannel0, uv).r * 0.4;
  m += texture2D(iChannel0, uv + vec2(uMaskTexel.x, 0.0)).r * 0.15;
  m += texture2D(iChannel0, uv - vec2(uMaskTexel.x, 0.0)).r * 0.15;
  m += texture2D(iChannel0, uv + vec2(0.0, uMaskTexel.y)).r * 0.15;
  m += texture2D(iChannel0, uv - vec2(0.0, uMaskTexel.y)).r * 0.15;
  float edge = smoothstep(0.35, 0.95, m);
  if (edge <= 0.0) { gl_FragColor = vec4(0.0); return; }

  vec2 p = uOrigin + local;
  float t = uTime;
  vec3 w = waves(p, t);
  vec3 n = normalize(vec3(-w.xy * 2.2, 1.0));
  // The viewer looks north and down at 45 degrees.
  vec3 v = normalize(vec3(0.0, 1.0, 1.0));
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 sky = mix(vec3(0.78, 0.88, 0.95), vec3(0.42, 0.47, 0.54), uGloom);
  vec3 deep = mix(vec3(0.05, 0.16, 0.22), vec3(0.04, 0.08, 0.11), uGloom);
  float facing = dot(n.xy, vec2(-0.45, -0.7));
  vec3 over = mix(deep, sky, clamp(fres * 1.6 + facing * 0.9 + 0.18, 0.0, 1.0));
  float overA = uOpacity * (0.3 + 0.25 * clamp(fres * 2.0, 0.0, 1.0));

  // Sun glints: tiny, sharp sparkles on the faces of the waves that tilt
  // toward the sun, twinkling as the water moves.
  vec2 sunDir = normalize(uSun.xy + vec2(0.0001, 0.0));
  float tilt = dot(-w.xy * 2.2, sunDir);
  float faces = smoothstep(0.08, 0.4, tilt + 0.12 * (1.0 - uSun.z));
  float s1 = sin(p.x * 2.9 + t * 4.7 + sin(p.y * 1.3 + t)) * sin(p.y * 3.3 - t * 3.9 + sin(p.x * 1.1 - t * 0.7));
  float sparkle = smoothstep(0.8, 0.97, s1);
  vec3 add = uSunColor * faces * sparkle * uGlints * 1.8;
  // Foam on the crests in a storm.
  float crest = smoothstep(0.55, 1.0, w.z / max(uWaves * 1.9, 0.01));
  float foam = crest * smoothstep(0.45, 0.85, noise(p * 0.11 + vec2(t * 0.6, 0.0))) * uFoam;
  over = mix(over, vec3(0.9, 0.93, 0.95), foam);
  overA = max(overA, foam * 0.85);
  add += vec3(0.8, 0.88, 0.95) * rings(p, t) * 0.42;

  float a = overA * edge;
  gl_FragColor = vec4(over * a + add * edge, a);
}
`;

interface Surface {
  shader: Phaser.GameObjects.Shader;
  maskKey: string;
}

export interface WaterSurfaceDeps {
  scene: Phaser.Scene;
  grid: TileGrid;
  /** Just above the ground layer. */
  depth: number;
  /** Painted places: wells and troughs have water too (pre-rendered ones show none). */
  painted: boolean;
}

let generation = 0;

export class WaterSurface {
  private readonly surfaces: Surface[] = [];
  private readonly base: Phaser.Display.BaseShader;

  constructor(private readonly d: WaterSurfaceDeps) {
    this.base = new Phaser.Display.BaseShader(`witness-water-${++generation}`, FRAG, undefined, {
      uOrigin: { type: '2f', value: { x: 0, y: 0 } },
      uMaskTexel: { type: '2f', value: { x: 0.01, y: 0.01 } },
      uSun: { type: '3f', value: { x: 0.5, y: 0.3, z: 0.8 } },
      uSunColor: { type: '3f', value: { x: 1, y: 0.96, z: 0.86 } },
      uWaves: { type: '1f', value: 0.25 },
      uGlints: { type: '1f', value: 1 },
      uRain: { type: '1f', value: 0 },
      uFoam: { type: '1f', value: 0 },
      uGloom: { type: '1f', value: 0 },
      uOpacity: { type: '1f', value: 1 },
      uTime: { type: '1f', value: 0 },
    });
    for (const region of waterRegions(d.grid)) {
      const canvas = document.createElement('canvas');
      canvas.width = region.w * MASK_PPT;
      canvas.height = region.h * MASK_PPT;
      const c = canvas.getContext('2d');
      if (!c) continue;
      c.fillStyle = '#fff';
      region.mask.forEach((water, i) => {
        if (!water) return;
        const x = i % region.w;
        const y = Math.floor(i / region.w);
        // Pull the edge in a little from open ground; keep it flush between water tiles.
        c.fillRect(x * MASK_PPT + 1, y * MASK_PPT + 1, MASK_PPT - 2, MASK_PPT - 2);
        if (region.mask[i + 1] && x + 1 < region.w)
          c.fillRect(x * MASK_PPT + MASK_PPT - 1, y * MASK_PPT + 1, 2, MASK_PPT - 2);
        if (region.mask[i + region.w])
          c.fillRect(x * MASK_PPT + 1, y * MASK_PPT + MASK_PPT - 1, MASK_PPT - 2, 2);
        if (region.mask[i + 1] && region.mask[i + region.w] && region.mask[i + region.w + 1])
          c.fillRect(x * MASK_PPT + MASK_PPT - 1, y * MASK_PPT + MASK_PPT - 1, 2, 2);
      });
      this.add(canvas, region.x * TILE, region.y * TILE, region.w * TILE, region.h * TILE);
    }
    if (d.painted) this.addFurnishings();
  }

  /** Painted wells and troughs: a small patch of live water where their water is drawn. */
  private addFurnishings(): void {
    const { grid } = this.d;
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const kind = grid.tiles[y]?.[x];
        if (kind !== 'well' && kind !== 'trough') continue;
        const canvas = document.createElement('canvas');
        const c = canvas.getContext('2d');
        if (!c) continue;
        if (kind === 'well') {
          // Matches the painted well's opening (art/furnishings.ts): centre (16, 19), 8 × 5.5.
          canvas.width = 32;
          canvas.height = 24;
          c.fillStyle = '#fff';
          c.beginPath();
          c.ellipse(16, 12, 12, 8, 0, 0, Math.PI * 2);
          c.fill();
          this.add(canvas, x * TILE + 8, y * TILE + 13.5, 16, 11);
        } else {
          // The trough's water: (3, 14.5) to (29, 20.5).
          canvas.width = 52;
          canvas.height = 12;
          c.fillStyle = '#fff';
          c.fillRect(2, 2, 48, 8);
          this.add(canvas, x * TILE + 3, y * TILE + 14.5, 26, 6);
        }
      }
    }
  }

  private add(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number): void {
    const s = this.d.scene;
    const maskKey = `water-mask-${this.base.key}-${this.surfaces.length}`;
    const mask = s.textures.addCanvas(maskKey, canvas);
    const shader = s.add.shader(this.base, x, y, w, h).setOrigin(0, 0).setDepth(this.d.depth);
    shader.setSampler2D('iChannel0', maskKey, 0, { repeat: false });
    // Phaser re-creates a sampler's texture blank when it is given a size: upload the mask again.
    mask?.refresh();
    shader.setUniform('uOrigin.value', { x, y });
    shader.setUniform('uMaskTexel.value', { x: 1 / canvas.width, y: 1 / canvas.height });
    this.surfaces.push({ shader, maskKey });
  }

  get count(): number {
    return this.surfaces.length;
  }

  /**
   * Update the look (cheap: a few uniforms per surface). `time` is in
   * seconds; it stands still with reduced motion, and so does the water.
   */
  setLook(
    look: WaterLook,
    sun: { x: number; y: number; height: number },
    warm: boolean,
    opacity: number,
    time: number,
  ): void {
    const elevation = 0.15 + sun.height * 1.1;
    const c = Math.cos(elevation);
    const sx = sun.x * c;
    const sy = sun.y * c;
    const sz = Math.sin(elevation);
    for (const { shader } of this.surfaces) {
      shader.setUniform('uSun.value', { x: sx, y: sy, z: sz });
      shader.setUniform(
        'uSunColor.value',
        warm ? { x: 1, y: 0.78, z: 0.52 } : { x: 1, y: 0.96, z: 0.86 },
      );
      shader.setUniform('uWaves.value', look.waves);
      shader.setUniform('uGlints.value', look.glints);
      shader.setUniform('uRain.value', look.rain);
      shader.setUniform('uFoam.value', look.foam);
      shader.setUniform('uGloom.value', look.gloom);
      shader.setUniform('uOpacity.value', opacity);
      shader.setUniform('uTime.value', time);
    }
  }

  destroy(): void {
    for (const { shader, maskKey } of this.surfaces) {
      shader.destroy();
      if (this.d.scene.textures.exists(maskKey)) this.d.scene.textures.remove(maskKey);
    }
    this.surfaces.length = 0;
  }
}
