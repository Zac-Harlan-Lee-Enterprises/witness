/**
 * Content validation (run at build time and in CI):
 *
 *   npm run content:validate          schema + integrity + reachability (must pass)
 *   npm run content:publish-check     governance readiness report; exits 1 if any
 *                                     educational record is not human-approved
 *
 * Also enforced by tests/content/*.test.ts.
 */
import { loadEnv } from 'vite';
import { chapterSource, ChapterLoadError } from '../src/content';
import { contentReport, reachabilityIssues } from '../src/content/validation';

// A "strict" content build (VITE_CONTENT_MODE=strict in the environment or a
// .env file) refuses to build until every educational record is approved.
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const strictBuild = env.VITE_CONTENT_MODE === 'strict';
const publishCheck = process.argv.includes('--publish-check') || strictBuild;
if (strictBuild)
  console.log('VITE_CONTENT_MODE=strict: unapproved educational content will fail the build.');

async function main(): Promise<number> {
  let failed = false;
  for (const meta of chapterSource.list().filter((m) => m.available)) {
    try {
      const chapter = await chapterSource.load(meta.id);
      const reach = reachabilityIssues(chapter);
      if (reach.length > 0) {
        failed = true;
        console.error(`✗ ${meta.id}: ${reach.length} reachability issue(s)`);
        reach.forEach((r) => console.error(`    - ${r}`));
      }
      const report = contentReport(chapter);
      console.log(`✓ ${meta.id}: schema + integrity OK`);
      console.log(
        `    records: ${report.total} (${report.educational} educational, ${report.approved} approved, ${report.awaitingReview} awaiting human review)`,
      );
      console.log(
        `    by kind: ${Object.entries(report.byKind)
          .map(([k, n]) => `${k}=${n}`)
          .join(', ')}`,
      );
      console.log(`    sources: ${report.sources} (${report.verifiedSources} retrieved & checked)`);
      if (publishCheck && report.awaitingReview > 0) {
        failed = true;
        console.error(
          `✗ publish-check: ${report.awaitingReview} educational record(s) are not approved by a human reviewer:`,
        );
        report.unapproved.forEach((r) => console.error(`    - ${r}`));
      }
    } catch (error) {
      failed = true;
      if (error instanceof ChapterLoadError) {
        console.error(`✗ ${meta.id}: ${error.message}`);
        error.issues.forEach((i) => console.error(`    - ${i}`));
      } else {
        console.error(`✗ ${meta.id}:`, error);
      }
    }
  }
  return failed ? 1 : 0;
}

main().then((code) => process.exit(code));
