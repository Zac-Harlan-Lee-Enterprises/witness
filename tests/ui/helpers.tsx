import { render, type RenderResult } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { expect } from 'vitest';
import { createAppServices, type AppServices } from '@/app/services';
import type { PlayerProfile } from '@/domain/profile';
import { ServicesProvider } from '@/features/common/services';
import type { GameRuntimeLike } from '@/features/game/types';
import { SilentAudio } from '@/infrastructure/audio/synth-audio';
import {
  MemoryProfileRepository,
  MemorySaveRepository,
  MemorySettingsRepository,
} from '@/infrastructure/persistence/memory-repositories';
import { createHarness, type Harness } from '../support/harness';

export async function makeServices(): Promise<AppServices> {
  return createAppServices({
    repositories: {
      saves: new MemorySaveRepository(),
      profiles: new MemoryProfileRepository(),
      settings: new MemorySettingsRepository(),
      status: { persistent: true, reason: null },
    },
    audio: new SilentAudio(),
  });
}

export async function renderWithServices(
  ui: ReactElement,
  services?: AppServices,
): Promise<RenderResult & { services: AppServices }> {
  const s = services ?? (await makeServices());
  const result = render(<ServicesProvider services={s}>{ui}</ServicesProvider>);
  return { ...result, services: s };
}

export const TEST_PROFILE: PlayerProfile = {
  id: 'profile_test',
  displayName: 'Ari',
  look: 'look-1',
  createdAt: new Date(0).toISOString(),
  lastPlayedAt: null,
  completedChapters: [],
};

export async function makeRuntime(): Promise<{ runtime: GameRuntimeLike; harness: Harness }> {
  const harness = await createHarness();
  const runtime: GameRuntimeLike = {
    chapter: harness.chapter,
    profile: TEST_PROFILE,
    session: harness.session,
    ui: harness.ui,
    dialogue: harness.dialogue,
    puzzles: harness.puzzles,
    controller: harness.controller,
    autosaver: { flush: () => undefined },
    mountWorld: async () => undefined,
    releaseWorld: () => undefined,
    saveTo: async () => true,
  };
  return { runtime, harness };
}

/** Automated accessibility check (colour contrast needs a real browser — covered in e2e). */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
  expect(summary, summary.join('\n')).toEqual([]);
}
