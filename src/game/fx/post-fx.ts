import Phaser from 'phaser';
import { NEUTRAL_GRADE, type Grade } from '../systems/grade';

/**
 * The world camera's post-processing (WebGL only): one grade pass with a
 * soft bloom, a lightning flash and, in the midday wilderness, a faint heat
 * shimmer. Bloom is computed at half resolution (bright pass, then a
 * two-step separable blur), so the whole effect costs one full-screen pass
 * plus a few cheap ones. See docs/adr/0015-world-rendering-effects.md.
 */
const BRIGHT = `
#define SHADER_NAME WITNESS_BRIGHT
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 outTexCoord;
void main () {
  vec3 c = texture2D(uMainSampler, outTexCoord + uTexel * vec2(-0.5, -0.5)).rgb;
  c += texture2D(uMainSampler, outTexCoord + uTexel * vec2(0.5, -0.5)).rgb;
  c += texture2D(uMainSampler, outTexCoord + uTexel * vec2(-0.5, 0.5)).rgb;
  c += texture2D(uMainSampler, outTexCoord + uTexel * vec2(0.5, 0.5)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float knee = 0.18;
  float soft = clamp(l - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 0.0001);
  float amount = max(soft, l - uThreshold) / max(l, 0.0001);
  gl_FragColor = vec4(c * amount, 1.0);
}
`;

const BLUR = `
#define SHADER_NAME WITNESS_BLUR
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uDir;
varying vec2 outTexCoord;
void main () {
  vec3 c = texture2D(uMainSampler, outTexCoord).rgb * 0.2270270;
  c += texture2D(uMainSampler, outTexCoord + uDir * 1.3846154).rgb * 0.3162162;
  c += texture2D(uMainSampler, outTexCoord - uDir * 1.3846154).rgb * 0.3162162;
  c += texture2D(uMainSampler, outTexCoord + uDir * 3.2307692).rgb * 0.0702703;
  c += texture2D(uMainSampler, outTexCoord - uDir * 3.2307692).rgb * 0.0702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

const COMPOSITE = `
#define SHADER_NAME WITNESS_GRADE
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uGain;
uniform vec3 uLift;
uniform float uFlash;
uniform float uHaze;
varying vec2 outTexCoord;

float hash (vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main () {
  vec2 uv = outTexCoord;
  if (uHaze > 0.0) {
    // Heat shimmer: a slow, fine ripple, a pixel or so at most.
    float w = sin(uv.y * 170.0 - uTime * 2.6) * sin(uv.x * 37.0 + uTime * 0.9 + uv.y * 11.0);
    uv += vec2(w, 0.35 * w) * uHaze / uResolution;
  }
  vec3 c = texture2D(uMainSampler, uv).rgb;
  c += texture2D(uBloom, uv).rgb * uBloomStrength;
  c *= uExposure * uGain;
  // Contrast as a gentle S around mid-grey that never clips the ends.
  vec3 s = c * c * (3.0 - 2.0 * c);
  c = mix(c, s, clamp(uContrast - 1.0, -1.0, 1.0) * 2.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c += uLift * (1.0 - c);
  // Lightning lights the scene (more where it is already lit), cool-white.
  c = c * (1.0 + 1.25 * uFlash) + uFlash * vec3(0.06, 0.07, 0.09);
  // Dither: breaks up banding in dark, graded skies and shadows.
  c += (hash(gl_FragCoord.xy + fract(uTime * 7.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export const POST_FX_KEY = 'WitnessWorldPostFX';

export class WorldPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private grade: Grade = NEUTRAL_GRADE;
  private flash = 0;
  /** Device pixels per CSS pixel (blur and shimmer are sized in CSS pixels). */
  private resolution = 1;
  private bloomA: Phaser.Renderer.WebGL.RenderTarget | null = null;
  private bloomB: Phaser.Renderer.WebGL.RenderTarget | null = null;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: POST_FX_KEY,
      shaders: [
        { name: 'bright', fragShader: BRIGHT },
        { name: 'blur', fragShader: BLUR },
        { name: 'grade', fragShader: COMPOSITE },
      ],
    });
  }

  /** Called every frame by the world before it renders. */
  setLook(grade: Grade, flash: number, resolution: number): void {
    this.grade = grade;
    this.flash = flash;
    this.resolution = resolution;
  }

  override onBoot(): void {
    const r = this.renderer;
    this.bloomA = new Phaser.Renderer.WebGL.RenderTarget(r, 2, 2, 1, 0, true, false);
    this.bloomB = new Phaser.Renderer.WebGL.RenderTarget(r, 2, 2, 1, 0, true, false);
  }

  override onDraw(target: Phaser.Renderer.WebGL.RenderTarget): void {
    const [bright, blur, grade] = this.shaders;
    const a = this.bloomA;
    const b = this.bloomB;
    if (!bright || !blur || !grade || !a || !b) {
      this.bindAndDraw(target);
      return;
    }
    const g = this.grade;
    const bloom = g.bloom > 0.01;
    if (bloom) {
      // Bloom is soft: work at half the CSS resolution, whatever the screen.
      const scale = 2 * Math.max(1, this.resolution);
      const w = Math.max(2, Math.round(target.width / scale));
      const h = Math.max(2, Math.round(target.height / scale));
      if (fit(a, w, h) || fit(b, w, h)) {
        // Creating a framebuffer forgets the bound one (the camera's): restore it.
        fit(b, w, h);
        this.renderer.restoreFramebuffer(false, false);
      }
      this.set2f('uTexel', 1 / target.width, 1 / target.height, bright);
      this.set1f('uThreshold', g.threshold, bright);
      this.bindAndDraw(target, a, true, true, bright);
      // Two blur passes, the second twice as wide: a soft, broad glow.
      const step = 0.75;
      for (const spread of [1, 2]) {
        this.set2f('uDir', (step * spread) / w, 0, blur);
        this.bindAndDraw(a, b, true, true, blur);
        this.set2f('uDir', 0, (step * spread) / h, blur);
        this.bindAndDraw(b, a, true, true, blur);
      }
    }
    const gl = this.gl;
    this.set1i('uBloom', 1, grade);
    this.set2f('uResolution', target.width, target.height, grade);
    this.set1f('uTime', this.game.loop.time / 1000, grade);
    this.set1f('uBloomStrength', bloom ? g.bloom : 0, grade);
    this.set1f('uExposure', g.exposure, grade);
    this.set1f('uContrast', g.contrast, grade);
    this.set1f('uSaturation', g.saturation, grade);
    this.set3f('uGain', g.gain[0], g.gain[1], g.gain[2], grade);
    this.set3f('uLift', g.lift[0], g.lift[1], g.lift[2], grade);
    this.set1f('uFlash', this.flash, grade);
    this.set1f('uHaze', g.haze * this.resolution, grade);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, a.texture.webGLTexture);
    gl.activeTexture(gl.TEXTURE0);
    this.bindAndDraw(target, undefined, true, true, grade);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
  }

  override destroy(): this {
    this.bloomA?.destroy();
    this.bloomB?.destroy();
    this.bloomA = null;
    this.bloomB = null;
    return super.destroy();
  }
}

/**
 * Size a render target we manage ourselves (Phaser's auto-resize ignores
 * scale). Returns whether it was recreated.
 */
function fit(rt: Phaser.Renderer.WebGL.RenderTarget, w: number, h: number): boolean {
  if (rt.width === w && rt.height === h) return false;
  rt.setAutoResize(true);
  rt.resize(w, h);
  rt.setAutoResize(false);
  return true;
}
