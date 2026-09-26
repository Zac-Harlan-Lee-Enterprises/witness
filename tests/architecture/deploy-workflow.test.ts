import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Pages deploy runs by itself when CI passes on main. These checks keep
 * that automation from silently stopping (CI renamed) or silently widening
 * (a failed run, another branch, or a fork's pull request publishing).
 * Every failure says WHAT broke, WHY it matters, and HOW to fix it.
 */
const ROOT = resolve(__dirname, '../..');
const read = (name: string): string => readFileSync(join(ROOT, '.github/workflows', name), 'utf8');
const deploy = read('deploy-pages.yml');
const ci = read('ci.yml');
/** The job's `if:` block (a folded scalar), with whitespace collapsed. */
const jobIf = (/^ {4}if: >-\n((?: {6}.*\n)+)/m.exec(deploy)?.[1] ?? '').replace(/\s+/g, ' ');

describe('automatic deploy to GitHub Pages', () => {
  it('follows the CI workflow by its exact name', () => {
    const ciName = /^name: (.+)$/m.exec(ci)?.[1];
    expect(
      deploy,
      `deploy-pages.yml must trigger on \`workflow_run\` of "${ciName}" (ci.yml's name), completed, on main. ` +
        'WHY: workflow_run matches workflows by name; if CI is renamed, merges stop deploying and nothing fails. ' +
        'HOW: keep `workflows: [<ci.yml name>]` in deploy-pages.yml in step with ci.yml.',
    ).toMatch(
      new RegExp(
        `workflow_run:\\n\\s+workflows: \\[${ciName}\\]\\n\\s+types: \\[completed\\]\\n\\s+branches: \\[main\\]`,
      ),
    );
  });

  it('deploys only a successful CI run of a push to main in this repository', () => {
    const guards = [
      "github.ref == 'refs/heads/main'",
      "github.event.workflow_run.conclusion == 'success'",
      "github.event.workflow_run.event == 'push'",
      "github.event.workflow_run.head_branch == 'main'",
      'github.event.workflow_run.head_repository.full_name == github.repository',
    ];
    for (const guard of guards) {
      expect(
        jobIf,
        `The deploy job's \`if:\` lost the guard \`${guard}\`. ` +
          'WHY: workflow_run jobs run with this repo’s Pages permissions; without every guard a failed CI run, ' +
          'another branch, or a fork’s pull request from a branch named "main" could publish. ' +
          'HOW: restore the guard in .github/workflows/deploy-pages.yml.',
      ).toContain(guard);
    }
  });

  it('publishes the commit CI tested, built for the repository sub-path', () => {
    expect(
      deploy,
      'The deploy must check out `github.event.workflow_run.head_sha`. ' +
        'WHY: main may have moved on since CI started; deploy what was tested. ' +
        'HOW: `ref: ${{ github.event.workflow_run.head_sha || github.sha }}` on actions/checkout.',
    ).toContain('ref: ${{ github.event.workflow_run.head_sha || github.sha }}');
    expect(
      deploy,
      'The build must set VITE_BASE_PATH to /<repo>/. ' +
        'WHY: Pages serves project sites under a sub-path; without it assets and the service worker 404. ' +
        'HOW: keep `VITE_BASE_PATH: /${{ github.event.repository.name }}/` on the build step.',
    ).toContain('VITE_BASE_PATH: /${{ github.event.repository.name }}/');
  });
});
