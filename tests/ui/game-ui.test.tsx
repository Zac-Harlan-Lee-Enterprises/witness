import { ContentBlock } from '@/features/common/ContentBlock';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChapterSummary, ScriptureConnection } from '@/features/chapter/ChapterEnding';
import { DialogueOverlay } from '@/features/dialogue/DialogueOverlay';
import { Hud, InteractionPrompt, PlaceBanner, Toasts } from '@/features/hud/Hud';
import { GameScreen } from '@/features/game/GameScreen';
import { MessageLog } from '@/features/hud/MessageLog';
import { SatchelOverlay } from '@/features/inventory/SatchelOverlay';
import { JournalOverlay } from '@/features/journal/JournalOverlay';
import { GoToList } from '@/features/navigation/GoToList';
import { PuzzleHost } from '@/features/puzzles/PuzzleHost';
import { QuestLog } from '@/features/quests/QuestLog';
import { flush, Player } from '../support/harness';
import { expectNoAxeViolations, makeRuntime, makeServices, renderWithServices } from './helpers';

async function instantText() {
  const services = await makeServices();
  await services.settings.update({ dialogueSpeed: 'instant' });
  return services;
}

describe('Dialogue overlay', () => {
  it('renders the speaker, text and real choice buttons, and advances by keyboard', async () => {
    const user = userEvent.setup();
    const { runtime } = await makeRuntime();
    const { container } = await renderWithServices(
      <DialogueOverlay runtime={runtime} />,
      await instantText(),
    );
    expect(screen.getByRole('dialog', { name: 'Narration' })).toBeInTheDocument();
    expect(
      screen.getByText(/Jerusalem, early morning/, { selector: '#dialogue-text-full' }),
    ).toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Continue' });
    expect(next).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /Aunt Miriam/ })).toBeInTheDocument(),
    );
    await expectNoAxeViolations(container);
    // Advance to the first choice and pick it with the number key.
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Me\? All the way/ })).toHaveLength(1),
    );
    await user.keyboard('2');
    await waitFor(() =>
      expect(
        screen.getByText(/That’s my brave one/, { selector: '#dialogue-text-full' }),
      ).toBeInTheDocument(),
    );
  });

  it('moves between choices with the up and down arrows (wrapping) and picks one with Space', async () => {
    const user = userEvent.setup();
    const { runtime } = await makeRuntime();
    const { container } = await renderWithServices(
      <DialogueOverlay runtime={runtime} />,
      await instantText(),
    );
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(container.querySelectorAll('.choice').length).toBeGreaterThan(1));
    const choices = [...container.querySelectorAll<HTMLButtonElement>('.choice')];
    expect(choices.length).toBeGreaterThan(1);
    const [first, second] = choices;
    const last = choices[choices.length - 1];
    expect(first).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(first).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(last).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(first).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();
    await user.keyboard(' ');
    await waitFor(() =>
      expect(
        screen.getByText(/That’s my brave one/, { selector: '#dialogue-text-full' }),
      ).toBeInTheDocument(),
    );
  });

  it('announces every line through one lasting live region; number keys work only from inside the conversation', async () => {
    const user = userEvent.setup();
    const { runtime } = await makeRuntime();
    await renderWithServices(
      <>
        <button type="button">Outside</button>
        <DialogueOverlay runtime={runtime} />
      </>,
      await instantText(),
    );
    const announcer = screen.getByTestId('dialogue-announcer');
    expect(announcer).toHaveAttribute('aria-live', 'polite');
    expect(announcer).toHaveTextContent(/Jerusalem, early morning/);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Me\? All the way/ })).toHaveLength(1),
    );
    // Same element, new words: screen readers hear each line.
    expect(screen.getByTestId('dialogue-announcer')).toBe(announcer);
    expect(announcer).toHaveTextContent(/^Aunt Miriam:/);

    screen.getByRole('button', { name: 'Outside' }).focus();
    await user.keyboard('2');
    expect(screen.getAllByRole('button', { name: /Me\? All the way/ })).toHaveLength(1);
  });

  it('shows impossible options with the reason instead of hiding them', async () => {
    const { runtime, harness } = await makeRuntime();
    const p = new Player(harness);
    await p.choose('c-yes');
    await p.choose('c-go');
    await p.finish();
    await p.exit('house-door');
    harness.session.dispatch([{ type: 'takeItem', item: 'coins', quantity: 5 }]);
    await p.interact('malik');
    await p.choose('sell');
    await renderWithServices(<DialogueOverlay runtime={runtime} />, await instantText());
    const buy = screen.getByRole('button', { name: /I’ll buy the map/ });
    expect(buy).toHaveAttribute('aria-disabled', 'true');
    expect(buy).toHaveAccessibleDescription(/You need 2 coins/);
  });

  it('labels a character retelling Scripture as a paraphrase with its reference', async () => {
    const { runtime, harness } = await makeRuntime();
    harness.dialogue.end();
    await flush();
    harness.session.dispatch([
      { type: 'setFlag', flag: 'remedy-delivered', value: true },
      { type: 'setFlag', flag: 'sat-with-natan', value: true },
    ]);
    harness.dialogue.start('d-yair');
    harness.dialogue.advance();
    await flush();
    await renderWithServices(<DialogueOverlay runtime={runtime} />, await instantText());
    expect(screen.getByText('Scripture paraphrase')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Yair is retelling Scripture in their own words \(Luke 10:29–37\) — not a direct quotation/,
      ),
    ).toBeInTheDocument();
  });
});

describe('HUD and navigation', () => {
  it('shows place, next objective and time of day as text, with labelled buttons', async () => {
    const { runtime, harness } = await makeRuntime();
    harness.dialogue.end();
    await flush();
    await renderWithServices(
      <>
        <Hud runtime={runtime} />
        <InteractionPrompt runtime={runtime} />
      </>,
    );
    expect(screen.getByText('Aunt Miriam’s house')).toBeInTheDocument();
    expect(screen.getByText('Early morning')).toBeInTheDocument();
    ['Go to…', 'Journal', 'Satchel', 'Quests', 'Menu'].forEach((name) =>
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^Menu/ })).toHaveAttribute(
      'aria-keyshortcuts',
      'Escape',
    );
    act(() => harness.ui.setFocus({ entityId: 'miriam', label: 'Aunt Miriam', verb: 'Talk to' }));
    expect(screen.getByRole('button', { name: /Talk to Aunt Miriam/ })).toHaveAttribute(
      'aria-keyshortcuts',
      'E',
    );
  });

  it('lists every person, object and exit in the “Go to…” list', async () => {
    const { runtime, harness } = await makeRuntime();
    harness.dialogue.end();
    await flush();
    const { container } = await renderWithServices(<GoToList runtime={runtime} />);
    expect(screen.getByRole('button', { name: 'Talk to Aunt Miriam' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use Travel satchel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to the market' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('Editorial review label', () => {
  it('still labels educational content that no editor has approved (preview mode)', async () => {
    const record = {
      id: 'rec-unapproved',
      kind: 'historical' as const,
      title: 'An unreviewed note',
      body: 'Draft text.',
      sources: [],
      governance: {
        status: 'sources-attached' as const,
        provenance: 'ai-assisted' as const,
        ageLevel: 'all' as const,
        denominationalSensitivity: 'none' as const,
        historicalConfidence: 'probable' as const,
        version: 1,
        history: [{ version: 1, date: '2026-09-26', author: 'AI draft', summary: 'Drafted' }],
      },
    };
    await renderWithServices(<ContentBlock record={record} sources={[]} />);
    expect(screen.getByText('Awaiting editorial review')).toBeInTheDocument();
  });
});

describe('Journal, quests and satchel', () => {
  it('journal uses tabs and labels every block by content kind', async () => {
    const user = userEvent.setup();
    const { runtime, harness } = await makeRuntime();
    const p = new Player(harness);
    await p.choose('c-yes');
    await p.choose('c-go');
    await p.finish();
    await p.exit('house-door');
    await p.interact('menashe');
    await p.finish().catch(() => undefined);
    const { container } = await renderWithServices(<JournalOverlay runtime={runtime} />);
    expect(screen.getByRole('tablist', { name: 'Journal sections' })).toBeInTheDocument();
    const people = screen.getByRole('tab', { name: /People/ });
    expect(people).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /Menashe/ }));
    expect(screen.getByRole('article', { name: /Story \(fiction\): Menashe/ })).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: /Historical background: Jews and Samaritans/ }),
    ).toBeInTheDocument();
    // Approved by a named editor (src/content/shared/approvals.ts): no review label.
    expect(screen.queryAllByText('Awaiting editorial review')).toHaveLength(0);
    await user.click(people);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Places/ })).toHaveAttribute('aria-selected', 'true');
    await expectNoAxeViolations(container);
  });

  it('quest log states objective status in text, not colour alone', async () => {
    const { runtime } = await makeRuntime();
    const p = new Player((await makeRuntime()).harness);
    expect(p).toBeDefined();
    runtime.session.dispatch([{ type: 'startQuest', quest: 'q-remedy' }]);
    await renderWithServices(<QuestLog runtime={runtime} />);
    const dialog = screen.getByRole('dialog', { name: 'Quests' });
    expect(within(dialog).getByText('Rivka’s Remedy')).toBeInTheDocument();
    expect(within(dialog).getAllByText(/— to do/).length).toBeGreaterThan(0);
  });

  it('satchel lists items with names and descriptions', async () => {
    const { runtime } = await makeRuntime();
    await renderWithServices(<SatchelOverlay runtime={runtime} />);
    expect(screen.getByText('Bronze coins ×5')).toBeInTheDocument();
    expect(screen.getByText(/haven’t packed for the road yet/)).toBeInTheDocument();
  });
});

describe('Puzzles', () => {
  it('packing puzzle: steppers update the load meter and the text checklist', async () => {
    const user = userEvent.setup();
    const { runtime, harness } = await makeRuntime();
    harness.dialogue.end();
    await flush();
    harness.session.dispatch([
      { type: 'giveItem', item: 'remedy' },
      { type: 'giveItem', item: 'linen-bundle' },
    ]);
    harness.puzzles.open('p-satchel');
    const { container } = await renderWithServices(<PuzzleHost runtime={runtime} />);
    expect(screen.getByLabelText(/Load:/)).toBeInTheDocument();
    // The remedy and Rivka's linen must go, so they start packed.
    expect(screen.getByText(/Load:/)).toHaveTextContent('Load: 2 of 6');
    await user.click(screen.getByRole('button', { name: 'Pack one Water skin' }));
    await user.click(screen.getByRole('button', { name: 'Pack one Water skin' }));
    expect(screen.getByText(/Load:/)).toHaveTextContent('Load: 6 of 6');
    expect(screen.getByText('Carry enough water for the descent')).toHaveTextContent('done');
    await user.click(screen.getByRole('button', { name: 'Pack one Spare cloak' }));
    expect(screen.getByText(/Load:/)).toHaveTextContent('too heavy');
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Take out one Spare cloak' }));
    await user.click(screen.getByRole('button', { name: 'Finish packing' }));
    expect(await screen.findByText('Solved!')).toBeInTheDocument();
  });

  it('hints come in tiers and the last one is labelled as the full explanation', async () => {
    const user = userEvent.setup();
    const { runtime, harness } = await makeRuntime();
    harness.dialogue.end();
    await flush();
    harness.puzzles.open('p-measure');
    await renderWithServices(<PuzzleHost runtime={runtime} />);
    await user.click(screen.getByRole('button', { name: 'Get a hint' }));
    await user.click(screen.getByRole('button', { name: 'Get a hint' }));
    expect(screen.getByRole('button', { name: 'Show the full explanation' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show the full explanation' }));
    expect(screen.getByText(/Full explanation:/)).toBeInTheDocument();
  });

  it('measuring puzzle: every action is a button and progress is announced in text', async () => {
    const user = userEvent.setup();
    const { runtime, harness } = await makeRuntime();
    harness.dialogue.end();
    await flush();
    harness.puzzles.open('p-measure');
    await renderWithServices(<PuzzleHost runtime={runtime} />);
    const crock = screen.getByRole('region', { name: 'Big crock' });
    const pitcher = screen.getByRole('region', { name: 'Pitcher' });
    // It is water from the trough, and what you tip out goes back into it:
    // nobody pours precious oil on the ground to measure a jar.
    expect(screen.getByText(/back into the trough/)).toBeInTheDocument();
    await user.click(within(crock).getByRole('button', { name: 'Fill from the water trough' }));
    await user.click(within(crock).getByRole('button', { name: 'Pour into pitcher' }));
    await user.click(
      within(pitcher).getByRole('button', { name: 'Pour back into the water trough' }),
    );
    await user.click(within(crock).getByRole('button', { name: 'Pour into pitcher' }));
    await user.click(within(crock).getByRole('button', { name: 'Fill from the water trough' }));
    const log = screen.getByRole('list', { name: 'What you’ve done' });
    expect(log).toHaveTextContent('Filled the big crock from the water trough');
    expect(log).toHaveTextContent('Poured the pitcher back into the water trough');
    await user.click(within(crock).getByRole('button', { name: 'Pour into pitcher' }));
    expect(await screen.findByText('Solved!')).toBeInTheDocument();
    expect(harness.state().puzzles['p-measure']?.status).toBe('solved');
  });
});

describe('Chapter ending', () => {
  it('Scripture Connection separates Scripture, paraphrase, history and interpretation', async () => {
    const { runtime, harness } = await makeRuntime();
    harness.dialogue.end();
    await flush();
    const { container } = await renderWithServices(<ScriptureConnection runtime={runtime} />);
    // The approved World English Bible text itself, not the placeholder.
    expect(
      screen.getByText(/Behold, a certain lawyer stood up and tested him/),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Scripture').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Scripture paraphrase').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Historical background').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Interpretation').length).toBeGreaterThan(0);
    expect(screen.getByText(/no right or wrong scores/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('summary lists consequences and Scripture references, and never grades the player', async () => {
    const { runtime, harness } = await makeRuntime();
    harness.dialogue.end();
    await flush();
    harness.session.dispatch([
      { type: 'recordChoice', choice: 'choice-traveler', option: 'hurry-on' },
      { type: 'setFlag', flag: 'remedy-on-time', value: true },
      { type: 'completeChapter' },
    ]);
    const { container } = await renderWithServices(
      <ChapterSummary runtime={runtime} onReturnToTitle={() => undefined} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Chapter complete: The Road to Jericho' });
    expect(
      within(dialog).getByRole('heading', { name: 'Scripture references' }),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Shepherds found Menashe near sunset');
    expect(dialog.textContent).not.toMatch(/score|grade|points|holiness|faith level/i);
    // The same screen ends every chapter: it must not name one chapter's place
    // (it said "Keep exploring Jericho" at the end of the Galilee chapter).
    expect(within(dialog).getByRole('button', { name: 'Keep exploring' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('Place banner', () => {
  it('shows the new place name visually (hidden from screen readers, which hear the announcement)', async () => {
    const { runtime } = await makeRuntime();
    await renderWithServices(<PlaceBanner ui={runtime.ui} />);
    const banner = await screen.findByTestId('place-banner');
    expect(banner).toHaveTextContent('Aunt Miriam’s house');
    expect(banner).toHaveAttribute('aria-hidden', 'true');
    act(() => runtime.ui.showPlace('The lower market, Jerusalem'));
    await waitFor(() =>
      expect(screen.getByTestId('place-banner')).toHaveTextContent('The lower market'),
    );
  });
});

describe('Recent messages', () => {
  it('keeps notices after they fade, newest first', async () => {
    const { runtime } = await makeRuntime();
    act(() => {
      runtime.ui.pushToast('The gate is shut for the night.', 'info', 'Not yet');
      runtime.ui.pushToast('Bread and dates', 'success', 'Received');
      runtime.ui.dismissToast(runtime.ui.getState().toasts[0]?.id ?? -1);
    });
    const { container } = await renderWithServices(<MessageLog runtime={runtime} />);
    const items = within(screen.getByRole('dialog', { name: 'Recent messages' })).getAllByRole(
      'listitem',
    );
    expect(items[0]).toHaveTextContent('Received: Bread and dates');
    expect(items.at(-1)).toHaveTextContent('Not yet: The gate is shut for the night.');
    await expectNoAxeViolations(container);
  });
});

describe('Toasts', () => {
  it('gives each notice its own few seconds, even when more keep arriving', async () => {
    const { runtime } = await makeRuntime();
    act(() => runtime.ui.getState().toasts.forEach((t) => runtime.ui.dismissToast(t.id)));
    await renderWithServices(<Toasts ui={runtime.ui} />);
    vi.useFakeTimers();
    try {
      act(() => void runtime.ui.pushToast('First', 'info', 'Note'));
      act(() => vi.advanceTimersByTime(3000));
      act(() => void runtime.ui.pushToast('Second', 'info', 'Note'));
      act(() => vi.advanceTimersByTime(1600));
      expect(screen.queryByText('First')).not.toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(3000));
      expect(screen.queryByText('Second')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Game screen', () => {
  it('warns during play when progress cannot be saved on this device', async () => {
    const { runtime, harness } = await makeRuntime();
    await renderWithServices(
      <GameScreen
        runtime={runtime}
        attachKeyboard={() => () => undefined}
        onOpenSettings={vi.fn()}
        onQuit={vi.fn()}
      />,
    );
    act(() => harness.ui.setStorageWarning('Saving is turned off in this browser.'));
    expect(
      screen.getAllByRole('status').some((el) => /Saving is turned off/.test(el.textContent ?? '')),
    ).toBe(true);
  });
});
