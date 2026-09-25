import { z } from 'zod';

/**
 * Zod 4 can compile validators with `new Function` for speed. We validate
 * small amounts of data, and a strict Content-Security-Policy (no
 * 'unsafe-eval', see docs/security-privacy.md) must not see eval attempts,
 * so the interpreter is used everywhere. Imported first by main.tsx.
 */
z.config({ jitless: true });
