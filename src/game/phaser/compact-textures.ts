import Phaser from 'phaser';

/**
 * Store some pre-rendered art in smaller GPU formats than Phaser's default
 * RGBA (4 bytes a pixel), converted by the browser as it uploads — no pixel
 * work in JavaScript:
 *
 * - **Shadow sheets → LUMINANCE (1 byte).** They are opaque, near-grey tints
 *   on white, drawn with multiply blending, so one channel carries them
 *   (the faint blue of the umbra is lost: under 3% of a channel).
 * - **Opaque ground layers → RGB 5-6-5 (2 bytes).** No alpha to keep; the
 *   ground is textured enough that 5–6 bits a channel don't band.
 *
 * WebGL only; the Canvas renderer keeps the images as they are. The format
 * is recorded on Phaser's texture wrapper so a restored WebGL context
 * re-uploads the same way.
 */
export type CompactFormat = 'luminance' | 'rgb565';

const done = new WeakSet<WebGLTexture>();

export function compactTexture(
  game: Phaser.Game,
  textures: Phaser.Textures.TextureManager,
  key: string,
  format: CompactFormat,
): boolean {
  const renderer = game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return false;
  if (!textures.exists(key)) return false;
  const source = textures.get(key).source[0];
  const wrapper = source?.glTexture;
  const image = source?.image;
  const tex = wrapper?.webGLTexture;
  if (
    !wrapper ||
    !tex ||
    !(image instanceof HTMLImageElement || image instanceof HTMLCanvasElement)
  )
    return false;
  if (done.has(tex)) return true;
  const gl = renderer.gl;
  gl.activeTexture(gl.TEXTURE0);
  const previous = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  if (format === 'luminance') {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, image);
    wrapper.format = gl.LUMINANCE;
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_SHORT_5_6_5, image);
    wrapper.format = gl.RGB;
  }
  gl.bindTexture(gl.TEXTURE_2D, previous);
  done.add(tex);
  return true;
}

/** Bytes a pixel of a texture on the GPU (as uploaded here or by Phaser). */
export function bytesPerPixel(source: Phaser.Textures.TextureSource): number {
  const wrapper = source.glTexture;
  if (!wrapper) return 4;
  const gl = wrapper.gl;
  if (wrapper.format === gl.LUMINANCE || wrapper.format === gl.ALPHA) return 1;
  // RGB is only ever uploaded here, as 5-6-5.
  if (wrapper.format === gl.RGB) return 2;
  return 4;
}
