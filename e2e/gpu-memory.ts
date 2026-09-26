import type { Page } from '@playwright/test';

/**
 * Measurement helper (perf specs only): tallies every WebGL texture the page
 * has uploaded and not deleted — images, canvases, render targets and
 * compressed textures — so reports show real GPU texture memory, not just
 * what Phaser's texture manager knows about (`data-texture-mb`).
 *
 * Install before the page loads: `await trackGpuTextures(page)`, then read
 * `await gpuTextures(page)`.
 */
export async function trackGpuTextures(page: Page): Promise<void> {
  await page.addInitScript(() => {
    interface Entry {
      bytes: number;
      dim: string;
    }
    const sizes = new Map<WebGLTexture, Entry>();
    const bound = new WeakMap<object, WebGLTexture | null>();
    const bytesPerPixel = (gl: WebGLRenderingContext, format: number, type: number): number => {
      if (type === gl.UNSIGNED_SHORT_5_6_5 || type === gl.UNSIGNED_SHORT_4_4_4_4) return 2;
      if (type === gl.UNSIGNED_SHORT_5_5_5_1) return 2;
      if (format === gl.ALPHA || format === gl.LUMINANCE) return 1;
      if (format === gl.LUMINANCE_ALPHA) return 2;
      if (type === gl.FLOAT) return 16;
      return 4;
    };
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const bind = proto.bindTexture;
      proto.bindTexture = function (target: number, tex: WebGLTexture | null) {
        bound.set(this, tex);
        return bind.call(this, target, tex);
      };
      const del = proto.deleteTexture;
      proto.deleteTexture = function (tex: WebGLTexture | null) {
        if (tex) sizes.delete(tex);
        return del.call(this, tex);
      };
      const upload = proto.texImage2D as unknown as (...a: unknown[]) => void;
      (proto as unknown as { texImage2D: unknown }).texImage2D = function (
        this: WebGLRenderingContext,
        ...a: unknown[]
      ) {
        const tex = bound.get(this);
        let w = 0;
        let h = 0;
        let format = a[2] as number;
        let type: number = this.UNSIGNED_BYTE;
        if (a.length >= 8) {
          w = a[3] as number;
          h = a[4] as number;
          format = a[6] as number;
          type = a[7] as number;
        } else {
          const src = a[5] as { width?: number; height?: number } | undefined;
          w = src?.width ?? 0;
          h = src?.height ?? 0;
          format = a[3] as number;
          type = a[4] as number;
        }
        if (tex && (a[1] as number) === 0)
          sizes.set(tex, { bytes: w * h * bytesPerPixel(this, format, type), dim: `${w}x${h}` });
        return upload.apply(this, a);
      };
      const compressed = proto.compressedTexImage2D as unknown as (...a: unknown[]) => void;
      (proto as unknown as { compressedTexImage2D: unknown }).compressedTexImage2D = function (
        this: WebGLRenderingContext,
        ...a: unknown[]
      ) {
        const tex = bound.get(this);
        const data = a[6] as ArrayBufferView | undefined;
        if (tex && (a[1] as number) === 0)
          sizes.set(tex, { bytes: data?.byteLength ?? 0, dim: `${String(a[3])}x${String(a[4])}` });
        return compressed.apply(this, a);
      };
    }
    (window as unknown as { __gpuTextures: () => unknown }).__gpuTextures = () => {
      let total = 0;
      const byDim = new Map<string, { count: number; bytes: number }>();
      for (const e of sizes.values()) {
        total += e.bytes;
        const d = byDim.get(e.dim) ?? { count: 0, bytes: 0 };
        byDim.set(e.dim, { count: d.count + 1, bytes: d.bytes + e.bytes });
      }
      const mb = (b: number): number => Math.round((b / 1048576) * 10) / 10;
      return {
        mb: mb(total),
        count: sizes.size,
        largest: [...byDim.entries()]
          .sort((a, b) => b[1].bytes - a[1].bytes)
          .slice(0, 12)
          .map(([dim, d]) => `${dim}×${d.count}=${mb(d.bytes)}`),
      };
    };
  });
}

export interface GpuTextures {
  mb: number;
  count: number;
  largest: string[];
}

export async function gpuTextures(page: Page): Promise<GpuTextures | null> {
  return page.evaluate(() => {
    const read = (window as unknown as { __gpuTextures?: () => GpuTextures }).__gpuTextures;
    return read ? read() : null;
  });
}

/** The WebGL renderer the page gets (e.g. SwiftShader in headless Chromium, the GPU otherwise). */
export async function glRenderer(page: Page): Promise<string> {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
}
