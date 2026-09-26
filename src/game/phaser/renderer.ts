import Phaser from 'phaser';
import { POST_FX_KEY, WorldPostFX } from '../fx/post-fx';

/**
 * What the renderer can do, and setting it up for the world:
 *
 * - WebGL or the Canvas fallback (effects that need shaders are off on Canvas);
 * - a software GL implementation (SwiftShader, llvmpipe…), where there is no
 *   GPU and full-screen post-processing costs far more than it adds;
 * - registering the world's post-processing pipeline;
 * - releasing render targets Phaser allocates at full screen size for
 *   features this game never uses (bitmap masks, captures, built-in FX),
 *   which on a high-DPI screen would otherwise hold tens of MB of GPU memory;
 * - on the Canvas renderer, the blend modes the light layer relies on.
 */
export interface RendererInfo {
  webgl: boolean;
  software: boolean;
}

const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i;

export function rendererInfo(game: Phaser.Game): RendererInfo {
  const renderer = game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer))
    return { webgl: false, software: true };
  const gl = renderer.gl;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  return { webgl: true, software: SOFTWARE_GL.test(name) };
}

/** Make the world's post-processing available to cameras (WebGL only). */
export function registerPostFx(game: Phaser.Game): boolean {
  const renderer = game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return false;
  renderer.pipelines.addPostPipeline(POST_FX_KEY, WorldPostFX);
  return true;
}

/**
 * Shrink the full-screen render targets nothing in the world uses to 1×1
 * and stop them following the canvas size. (Phaser's own FX and bitmap
 * masks would need them; the world uses neither — see ADR-0015.)
 */
export function releaseUnusedTargets(game: Phaser.Game): void {
  const renderer = game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  const p = renderer.pipelines;
  const unused = [
    renderer.renderTarget,
    renderer.maskTarget,
    renderer.maskSource,
    p.fullFrame1,
    p.fullFrame2,
    p.halfFrame1,
    p.halfFrame2,
  ];
  for (const target of unused) {
    if (!target) continue;
    target.setAutoResize(true);
    target.resize(1, 1);
    target.setAutoResize(false);
  }
}

/**
 * Canvas renderer: Phaser tests for the newer blend modes with an image that
 * loads asynchronously, and builds its blend table before the test finishes,
 * so MULTIPLY silently became a plain draw and the light layer covered the
 * world. Every browser that runs this game supports them: set them directly.
 */
export function fixCanvasBlendModes(game: Phaser.Game): void {
  const renderer = game.renderer;
  if (!(renderer instanceof Phaser.Renderer.Canvas.CanvasRenderer)) return;
  const modes = renderer.blendModes as string[];
  modes[Phaser.BlendModes.MULTIPLY] = 'multiply';
  modes[Phaser.BlendModes.SCREEN] = 'screen';
}
