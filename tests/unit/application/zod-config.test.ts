import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import '@/app/zod-config';
import { parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';

describe('schema validation without eval', () => {
  it('turns off Zod code generation, and the chapter still validates', () => {
    expect(z.config().jitless).toBe(true);
    expect(parseChapter(ROAD_TO_JERICHO).id).toBe('road-to-jericho');
  });
});
