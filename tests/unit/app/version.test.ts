import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../..');

describe('the game version', () => {
  it('is semantic, and the changelog’s latest entry is the version in package.json', () => {
    const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      version: string;
    };
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
    expect(changelog.match(/^## (\d+\.\d+\.\d+)/m)?.[1]).toBe(version);
  });
});
