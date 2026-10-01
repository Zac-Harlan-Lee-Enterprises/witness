import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { MUSIC_LICENSE, MUSIC_TRACK_IDS, MUSIC_TRACKS } from '@/domain/music';
import { TitleScreen } from '@/features/menu/TitleScreen';
import { SettingsPanel } from '@/features/settings/SettingsPanel';
import { expectNoAxeViolations, makeServices, renderWithServices } from './helpers';

describe('Music credits', () => {
  it('lists every track with its artist, source and licence in About this game', async () => {
    const user = userEvent.setup();
    const { container } = await renderWithServices(
      <TitleScreen onPlay={vi.fn()} onSettings={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: 'About this game' }));
    const dialog = screen.getByRole('dialog', { name: 'About this game' });
    const credits = within(dialog).getByRole('region', { name: 'Music' });
    const items = within(credits).getAllByRole('listitem');
    expect(items).toHaveLength(MUSIC_TRACK_IDS.length);
    MUSIC_TRACK_IDS.forEach((id, i) => {
      const track = MUSIC_TRACKS[id];
      const item = items[i] as HTMLElement;
      expect(item).toHaveTextContent(track.title);
      expect(item).toHaveTextContent(`by ${track.artist}`);
      expect(within(item).getByRole('link', { name: /Pixabay/ })).toHaveAttribute(
        'href',
        track.source,
      );
    });
    const licence = within(credits).getByRole('link', { name: new RegExp(MUSIC_LICENSE.name) });
    expect(licence).toHaveAttribute('href', MUSIC_LICENSE.summaryUrl);
    expect(licence).toHaveAttribute('rel', 'noopener noreferrer');
    await expectNoAxeViolations(container);
  });
});

describe('Music controls', () => {
  it('passes mute, the music volume and captions to the audio at once', async () => {
    const user = userEvent.setup();
    const services = await makeServices();
    const apply = vi.spyOn(services.audio, 'applySettings');
    await renderWithServices(<SettingsPanel onClose={vi.fn()} />, services);
    fireEvent.change(screen.getByRole('slider', { name: /^Music volume/ }), {
      target: { value: '0.2' },
    });
    await vi.waitFor(() =>
      expect(apply).toHaveBeenLastCalledWith(
        expect.objectContaining({ volume: expect.objectContaining({ music: 0.2 }) }),
      ),
    );
    await user.click(screen.getByRole('checkbox', { name: /Mute all sound/ }));
    await vi.waitFor(() =>
      expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ muted: true })),
    );
    await user.click(screen.getByRole('checkbox', { name: /Sound captions/ }));
    await vi.waitFor(() =>
      expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ captions: false })),
    );
  });
});

describe('App: music in the menus', () => {
  it('asks for the home music in the menus and unlocks audio on any gesture', async () => {
    const services = await makeServices();
    const setMusic = vi.spyOn(services.audio, 'setMusic');
    const unlock = vi.spyOn(services.audio, 'unlock');
    const suspend = vi.spyOn(services.audio, 'suspend');
    const dispose = vi.spyOn(services.audio, 'dispose');
    const { unmount } = await renderWithServices(<App services={services} />, services);
    expect(setMusic).toHaveBeenCalledWith('home');
    expect(unlock).not.toHaveBeenCalled();
    fireEvent.pointerDown(window);
    fireEvent.keyDown(window, { key: 'a' });
    expect(unlock).toHaveBeenCalledTimes(2);
    // Moving between menus keeps the same music (no new request).
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    });
    expect(setMusic).toHaveBeenCalledTimes(1);
    // A hidden page is silent until shown again.
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    fireEvent(document, new Event('visibilitychange'));
    expect(suspend).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    fireEvent(document, new Event('visibilitychange'));
    expect(unlock).toHaveBeenCalledTimes(3);
    unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it('shows sound captions over the menus', async () => {
    const services = await makeServices();
    await renderWithServices(<App services={services} />, services);
    act(() =>
      services.notices.setState((n) => ({
        ...n,
        captions: [{ id: 1, text: MUSIC_TRACKS['cinematic-oud-and-qanun'].caption }],
      })),
    );
    expect(document.querySelector('.captions--fixed')).toHaveTextContent('oud and qanun');
  });
});
