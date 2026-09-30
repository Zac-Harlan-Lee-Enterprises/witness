import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { JOURNEY_TO_BETHLEHEM } from '@/content/chapters/journey-to-bethlehem';
import { LETTER_FROM_PAUL } from '@/content/chapters/letter-from-paul';
import { STORM_ON_GALILEE } from '@/content/chapters/storm-on-galilee';
import type { ChapterInput } from '@/domain/chapter';
import type { Effect } from '@/domain/effects';
import { shapeCells, type FloorplanPuzzle } from '@/domain/puzzle-floorplan';
import { PuzzleHost } from '@/features/puzzles/PuzzleHost';
import type { GameRuntimeLike } from '@/features/game/types';
import { createHarness, flush, loadChapter } from '../support/harness';
import { expectNoAxeViolations, renderWithServices, TEST_PROFILE } from './helpers';

/** Open one puzzle of a chapter, with the opening conversation out of the way. */
async function openPuzzle(chapter: ChapterInput, puzzleId: string, setup: Effect[] = []) {
  const harness = await createHarness({ chapter: loadChapter(chapter) });
  harness.dialogue.end();
  await flush();
  if (setup.length > 0) harness.session.dispatch(setup);
  harness.puzzles.open(puzzleId);
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
  const rendered = await renderWithServices(<PuzzleHost runtime={runtime} />);
  return { harness, ...rendered };
}

const live = (container: HTMLElement) =>
  [...container.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent).join(' ');

describe('Trim puzzle (Chapter 2: load the boat)', () => {
  const gear: Effect[] = [
    { type: 'giveItem', item: 'bailer' },
    { type: 'giveItem', item: 'fish-jar', quantity: 6 },
    { type: 'giveItem', item: 'rope' },
    { type: 'giveItem', item: 'spare-oar' },
    { type: 'giveItem', item: 'lamp' },
    { type: 'giveItem', item: 'cloak' },
  ];

  it('picks up and puts down from the keyboard, announcing each move and the balance in words', async () => {
    const user = userEvent.setup();
    const { container, harness } = await openPuzzle(STORM_ON_GALILEE, 'p-load', gear);
    const jars = screen.getByRole('button', { name: /Jar of salted fish/ });
    jars.focus();
    await user.keyboard(' ');
    expect(jars).toHaveAttribute('aria-pressed', 'true');
    expect(live(container)).toMatch(/Holding Jar of salted fish/);
    const bow = screen.getByRole('button', { name: 'Put the Jar of salted fish in the bow' });
    bow.focus();
    await user.keyboard('{Enter}');
    expect(live(container)).toMatch(/Moved one Jar of salted fish from the jetty to the bow/);
    // The arrow keys move between the places.
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /in the port side/ })).toHaveFocus();
    // The balance is written out, not only shown.
    expect(
      screen.getByText(/Bow and stern about the same: Bow 3, Stern 3: level/),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
    // Load the worked example from the last hint and finish.
    const put = async (item: RegExp, place: string, times = 1) => {
      for (let i = 0; i < times; i++) {
        const jetty = within(container.querySelector('.trim__jetty') as HTMLElement);
        const pick = jetty.getByRole('button', { name: item });
        // Pressing what you already hold would put it down again.
        if (pick.getAttribute('aria-pressed') !== 'true') await user.click(pick);
        await user.click(screen.getByRole('button', { name: new RegExp(`in the ${place}$`) }));
      }
    };
    await put(/Jar of salted fish/, 'bow', 3);
    await put(/Bailing scoop/, 'stern');
    await put(/Clay lamp/, 'stern');
    await put(/Spare oar/, 'port side');
    await put(/Coil of rope/, 'starboard side');
    await put(/Your cloak/, 'starboard side');
    await user.click(screen.getByRole('button', { name: 'Finish loading' }));
    expect(await screen.findByText('Solved!')).toBeInTheDocument();
    expect(harness.state().inventory.net).toBeUndefined();
  });

  it('explains why a lopsided load fails', async () => {
    const user = userEvent.setup();
    await openPuzzle(STORM_ON_GALILEE, 'p-load', gear);
    await user.click(screen.getByRole('button', { name: /Bailing scoop/ }));
    await user.click(screen.getByRole('button', { name: /in the stern$/ }));
    await user.click(screen.getByRole('button', { name: 'Finish loading' }));
    expect(await screen.findByText(/Uncle Elazar sits in the stern to steer/)).toBeInTheDocument();
    expect(screen.getByText(/at least four jars/)).toBeInTheDocument();
  });
});

describe('Netting puzzle (Chapter 2: mend the jar net)', () => {
  it('ties knots with Space, moves with the arrows, and reads out each row and column', async () => {
    const user = userEvent.setup();
    const { container, harness } = await openPuzzle(STORM_ON_GALILEE, 'p-brine');
    const cell = (r: number, c: number) =>
      screen.getByRole('button', { name: new RegExp(`^Row ${r}, column ${c}:`) });
    // The first torn cell is the one in the Tab order.
    expect(cell(1, 2)).toHaveAttribute('tabindex', '0');
    cell(1, 2).focus();
    await user.keyboard('{ArrowRight}');
    expect(cell(1, 3)).toHaveFocus();
    await user.keyboard(' ');
    expect(cell(1, 3)).toHaveAccessibleName('Row 1, column 3: knot tied');
    expect(live(container)).toMatch(/Row 1, column 3: knot tied\. Row 1: needs 3 1, now 1 1/);
    await user.keyboard(' ');
    expect(cell(1, 3)).toHaveAccessibleName('Row 1, column 3: left open');
    await user.keyboard(' ');
    expect(cell(1, 3)).toHaveAccessibleName('Row 1, column 3: torn, not yet mended');
    // Intact cells don't change.
    await user.click(cell(1, 1));
    expect(live(container)).toMatch(/is not torn/);
    await expectNoAxeViolations(container);
    const knots: Array<[number, number]> = [
      [1, 3], [1, 4], [1, 5],
      [2, 2], [2, 4], [2, 5],
      [3, 2], [3, 3], [3, 4], [3, 5],
      [4, 2], [4, 3], [4, 4], [4, 5],
      [5, 3], [5, 4], [5, 5],
    ]; // prettier-ignore
    for (const [r, c] of knots) await user.click(cell(r, c));
    expect(await screen.findByText('Solved!')).toBeInTheDocument();
    expect(harness.state().flags['brine-measured']).toBe(true);
  });
});

describe('Floor plan puzzle (Chapter 3: the guest room)', () => {
  it('chooses, turns with R and places from the keyboard, and says why a piece will not fit', async () => {
    const user = userEvent.setup();
    const { container, harness } = await openPuzzle(JOURNEY_TO_BETHLEHEM, 'p-room');
    const puzzle = harness.puzzles.find('p-room') as FloorplanPuzzle;
    const cell = (r: number, c: number) =>
      screen.getByRole('button', { name: new RegExp(`^Row ${r}, column ${c}:`) });
    expect(cell(2, 2)).toHaveAccessibleName('Row 2, column 2: the roof post');
    // Uncle Asa's bedding is chosen first; try it across the post.
    cell(1, 1).focus();
    await user.keyboard('{ArrowDown}');
    expect(cell(2, 1)).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(live(container)).toMatch(/won’t go there: it would cover the roof post/);
    // Choose the barley, turn it until it hugs the post, and place it.
    await user.click(screen.getByRole('button', { name: /Jars of barley/ }));
    const want = JSON.stringify([
      [0, 0],
      [0, 1],
      [1, 1],
    ]);
    const grain = puzzle.pieces.find((p) => p.item === 'grain');
    const turns = [0, 1, 2, 3].find(
      (t) => JSON.stringify(shapeCells(grain?.shape ?? [], t)) === want,
    );
    cell(1, 2).focus();
    for (let i = 0; i < (turns ?? 0); i++) await user.keyboard('r');
    await user.keyboard(' ');
    expect(live(container)).toMatch(
      /Jars of barley placed on row 1 column 2, row 1 column 3, row 2 column 3/,
    );
    expect(cell(1, 2)).toHaveAccessibleName('Row 1, column 2: Jars of barley');
    await expectNoAxeViolations(container);
    // The beds, then the room is ready.
    await user.click(screen.getByRole('button', { name: /Aunt Peninah and Dodi’s bedding/ }));
    await user.click(cell(1, 4));
    await user.click(screen.getByRole('button', { name: /Uncle Asa’s bedding/ }));
    await user.click(cell(3, 3));
    await user.click(screen.getByRole('button', { name: 'The room is ready' }));
    expect(await screen.findByText('Solved!')).toBeInTheDocument();
    expect(harness.state().choices.find((c) => c.choiceId === 'choice-room')?.optionId).toBe(
      'kept-grain',
    );
  });
});

describe('Logic grid puzzle (Chapter 3: places for supper)', () => {
  it('marks cells from the keyboard, rules out the rest of a row and column, and names a broken clue', async () => {
    const user = userEvent.setup();
    const { container } = await openPuzzle(JOURNEY_TO_BETHLEHEM, 'p-bread');
    const cell = (who: string, place: string) =>
      screen.getByRole('button', {
        name: new RegExp(`^${who.replace(/[()]/g, '\\$&')}, ${place}:`),
      });
    cell('Saba Amram', 'Nearest the fire').focus();
    await user.keyboard(' ');
    expect(cell('Saba Amram', 'Nearest the fire')).toHaveAccessibleName(
      'Saba Amram, Nearest the fire: ruled out',
    );
    await user.keyboard(' ');
    expect(live(container)).toMatch(
      /Saba Amram, Nearest the fire: chosen\. The rest of that row and column are ruled out/,
    );
    expect(cell('Uncle Asa', 'Nearest the fire')).toHaveAccessibleName(
      'Uncle Asa, Nearest the fire: ruled out',
    );
    await user.keyboard('{ArrowDown}');
    expect(cell('Uncle Asa', 'Nearest the fire')).toHaveFocus();
    await user.keyboard('{ArrowRight}{Enter}{Enter}');
    // A wrong seating: Peninah by the door, Tamar third.
    await user.click(cell('Aunt Peninah (with Dodi)', 'Nearest the door'));
    await user.click(cell('Aunt Peninah (with Dodi)', 'Nearest the door'));
    await user.click(cell('Tamar', 'Third place'));
    await user.click(cell('Tamar', 'Third place'));
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));
    expect(
      await screen.findByText(/Look again at this one: “Tamar will be up and down/),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Clear the grid' }));
    for (const [who, place] of [
      ['Saba Amram', 'Nearest the fire'],
      ['Uncle Asa', 'Second place'],
      ['Aunt Peninah (with Dodi)', 'Third place'],
      ['Tamar', 'Nearest the door'],
    ] as const) {
      await user.click(cell(who, place));
      await user.click(cell(who, place));
    }
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));
    expect(await screen.findByText('Solved!')).toBeInTheDocument();
  });
});

describe('Dyeing puzzle (Chapter 4: the buyer’s shade)', () => {
  it('names every shade in words and numbers, runs out of dips, and starts again', async () => {
    const user = userEvent.setup();
    const { container } = await openPuzzle(LETTER_FROM_PAUL, 'p-alum');
    expect(screen.getByText(/The sample:/).parentElement).toHaveTextContent(
      'mulberry (red 3, blue 2)',
    );
    const dip = (bath: string) => screen.getByRole('button', { name: `Dip in ${bath}` });
    await user.click(dip('the madder vat'));
    expect(screen.getByText(/Your skein:/).parentElement).toHaveTextContent('rose (red 2, blue 0)');
    expect(screen.getByRole('list', { name: 'What you’ve done' })).toHaveTextContent(
      'Dipped in the madder vat → rose (red 2, blue 0). 3 dips left.',
    );
    await user.click(dip('the madder vat'));
    await user.click(dip('the blue vat'));
    await user.click(dip('the blue vat'));
    expect(screen.getByText(/No dips left/)).toBeInTheDocument();
    expect(dip('the madder vat')).toBeDisabled();
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Start with a fresh skein' }));
    dip('the madder vat').focus();
    await user.keyboard('{Enter}');
    await user.click(dip('the rinsing trough'));
    await user.click(dip('the madder vat'));
    await user.click(dip('the blue vat'));
    expect(await screen.findByText('Solved!')).toBeInTheDocument();
  });
});

describe('Map puzzle (Chapter 4: the way to the bridge)', () => {
  it('walks with the arrow keys, always says where you are, and explains a wrong stop', async () => {
    const user = userEvent.setup();
    const { container, harness } = await openPuzzle(LETTER_FROM_PAUL, 'p-pack');
    expect(
      screen.getByText(/You are at the west gate of Colossae, facing west/),
    ).toBeInTheDocument();
    const west = screen.getByRole('button', { name: /Walk west/ });
    expect(screen.getByRole('button', { name: /Walk north/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    west.focus();
    for (let i = 0; i < 4; i++) await user.keyboard('{ArrowLeft}');
    expect(
      screen.getByText(
        /You are on the road, facing west. The road goes north, east, south and west/,
      ),
    ).toBeInTheDocument();
    // The walk button keeps focus as the roads change.
    expect(west).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(screen.getByText(/You are at a dye works by a footbridge/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'This is the place' }));
    expect(await screen.findByText(/before the fourth milestone/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Back to the start' }));
    west.focus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    await user.keyboard('{ArrowDown}{ArrowLeft}{ArrowLeft}');
    expect(screen.getByText(/You are at a dye works by a stone bridge/)).toBeInTheDocument();
    expect(live(container)).toMatch(/dye works by a stone bridge/);
    await user.click(screen.getByRole('button', { name: 'This is the place' }));
    expect(await screen.findByText('Solved!')).toBeInTheDocument();
    expect(harness.state().flags['knows-the-way']).toBe(true);
  });
});
