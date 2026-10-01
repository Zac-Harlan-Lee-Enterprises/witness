import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { TEASER_RECORD } from '@/content/chapters/road-to-jericho/teaser';
import { ContentRecordSchema } from '@/domain/content-records';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import { TeaserSchema } from '@/domain/teaser';
import { ChapterSelect } from '@/features/menu/ChapterSelect';
import { TeaserPlayer } from '@/features/teaser/TeaserPlayer';
import { expectNoAxeViolations, makeServices, renderWithServices, TEST_PROFILE } from './helpers';

const teaser = TeaserSchema.parse(ROAD_TO_JERICHO.teaser);
const record = ContentRecordSchema.parse(TEASER_RECORD);

async function setup(reducedMotion: 'on' | 'off' = 'off', loadTimeoutMs = 60_000) {
  const services = await makeServices();
  await services.settings.update({ ...DEFAULT_SETTINGS, reducedMotion });
  const onDone = vi.fn();
  const play = vi.spyOn(services.audio, 'playFilmScore');
  const stop = vi.spyOn(services.audio, 'stopFilmScore');
  const r = await renderWithServices(
    <TeaserPlayer
      teaser={teaser}
      record={record}
      label="Chapter 1 teaser: The Road to Jericho"
      onDone={onDone}
      base="/"
      loadTimeoutMs={loadTimeoutMs}
    />,
    services,
  );
  return { ...r, onDone, play, stop };
}

const film = () => document.querySelector('video') as HTMLVideoElement;
const at = (t: number) => {
  Object.defineProperty(film(), 'currentTime', { value: t, configurable: true });
  fireEvent.timeUpdate(film());
};

describe('TeaserPlayer', () => {
  it('plays the muted film full screen, Skip focused, with no accessibility violations', async () => {
    const { container } = await setup();
    const dialog = screen.getByRole('dialog', { name: 'Chapter 1 teaser: The Road to Jericho' });
    expect(dialog).toBeInTheDocument();
    expect(film().muted).toBe(true);
    expect(film().getAttribute('poster')).toBe('/art/teaser/chapter-1/poster.webp');
    const sources = [...film().querySelectorAll('source')].map((s) => s.getAttribute('src'));
    expect(sources).toEqual([
      '/art/teaser/chapter-1/teaser.webm',
      '/art/teaser/chapter-1/teaser.mp4',
    ]);
    expect(screen.getByRole('button', { name: 'Skip' })).toHaveFocus();
    await expectNoAxeViolations(container);
  }, 30_000);

  it('shows the words as text cued to the film, announced politely', async () => {
    await setup();
    const words = document.querySelector('.teaser__words');
    expect(words).toHaveAttribute('aria-live', 'polite');
    at(2);
    expect(words).toHaveTextContent('Jerusalem. Before the heat of the day.');
    at(7.0);
    expect(words).toHaveTextContent('');
    at(46);
    expect(words).toHaveTextContent('What you do next is up to you.');
    at(53);
    expect(words).toHaveTextContent('Witness');
    expect(words).toHaveTextContent('Chapter 1: The Road to Jericho');
  });

  it('plays its score with the film, from where the film is, and stops it on pause', async () => {
    const { play, stop } = await setup();
    at(12);
    fireEvent.play(film());
    expect(play).toHaveBeenCalledWith(teaser.music, teaser.duration, 12);
    fireEvent.pause(film());
    expect(stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('is skipped by the button, Escape, Enter or Space, stopping the music', async () => {
    const user = userEvent.setup();
    for (const how of ['button', '{Escape}', '{Enter}', ' '] as const) {
      const { onDone, stop, unmount } = await setup();
      if (how === 'button') await user.click(screen.getByRole('button', { name: 'Skip' }));
      else {
        // Focus away from the buttons (Enter and Space on a button press it).
        (document.activeElement as HTMLElement | null)?.blur();
        await user.keyboard(how);
      }
      expect(onDone, how).toHaveBeenCalledWith('skipped');
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(stop).toHaveBeenCalled();
      unmount();
    }
  });

  it('carries on to the chapter when the film ends', async () => {
    const { onDone } = await setup();
    fireEvent.ended(film());
    expect(onDone).toHaveBeenCalledWith('ended');
  });

  it('under reduced motion shows the poster and steps through the words with Next', async () => {
    const user = userEvent.setup();
    const { onDone, container, play } = await setup('on');
    expect(film()).toBeNull();
    expect(container.querySelector('img.teaser__film')).toHaveAttribute(
      'src',
      '/art/teaser/chapter-1/poster.webp',
    );
    const words = document.querySelector('.teaser__words');
    expect(words).toHaveTextContent('Jerusalem. Before the heat of the day.');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(words).toHaveTextContent('In Jericho, a boy named Natan has a fever');
    for (let i = 0; i < 20 && screen.queryByRole('button', { name: 'Next' }); i++)
      await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(words).toHaveTextContent('Witness');
    await user.click(screen.getByRole('button', { name: 'Begin' }));
    expect(onDone).toHaveBeenCalledWith('ended');
    expect(play).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  }, 30_000);

  it('falls back to the poster and words when the film cannot play', async () => {
    await setup();
    const sources = film().querySelectorAll('source');
    fireEvent.error(sources[sources.length - 1] as Element);
    await waitFor(() => expect(film()).toBeNull());
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('falls back when the film never starts (offline)', async () => {
    vi.useFakeTimers();
    try {
      await setup('off', 500);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(film()).toBeNull();
      expect(document.querySelector('img.teaser__film')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the film while it is still downloading, however slowly', async () => {
    vi.useFakeTimers();
    try {
      await setup('off', 500);
      // Progress keeps arriving, each time before the stall limit.
      for (let i = 0; i < 5; i++)
        act(() => {
          vi.advanceTimersByTime(400);
          fireEvent.progress(film());
        });
      expect(film()).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers the film from the stills (reduced motion too), and plays it', async () => {
    const user = userEvent.setup();
    await setup('on');
    expect(film()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Play the film' }));
    expect(film()).not.toBeNull();
  });

  it('labels words still awaiting review, discreetly, in preview builds', async () => {
    await setup();
    const approved = record.governance.status === 'approved';
    expect(screen.queryByText('Awaiting editorial review') !== null).toBe(!approved);
  });
});

describe('Chapter select', () => {
  it('offers to watch the teaser again', async () => {
    const user = userEvent.setup();
    const onWatchTeaser = vi.fn();
    await renderWithServices(
      <ChapterSelect
        profile={TEST_PROFILE}
        onStart={vi.fn()}
        onWatchTeaser={onWatchTeaser}
        onBack={vi.fn()}
      />,
    );
    const buttons = await screen.findAllByRole('button', { name: 'Watch the teaser' });
    expect(buttons).toHaveLength(1); // only Chapter 1 has one
    await user.click(buttons[0] as HTMLElement);
    expect(onWatchTeaser).toHaveBeenCalledWith('road-to-jericho');
  });
});
