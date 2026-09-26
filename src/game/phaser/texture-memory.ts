import type Phaser from 'phaser';

/*
 * How much GPU memory textures take. Type-only use of Phaser, so pure code
 * (and its Node tests) can import this without a browser.
 */

/** Approximate GPU memory of every loaded texture (level 0, in its GPU format), in MB. */
export function textureMegabytes(textures: Phaser.Textures.TextureManager): number {
  let bytes = 0;
  for (const key of textures.getTextureKeys())
    for (const src of textures.get(key).source)
      bytes += src.width * src.height * bytesPerPixel(src);
  return bytes / (1024 * 1024);
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
