import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { applySettingsToDocument } from '@/app/App';
import { chapterSource } from '@/content';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import { ChapterSelect } from '@/features/menu/ChapterSelect';
import { TITLE_ART } from '@/features/menu/key-art';
import { TitleScreen } from '@/features/menu/TitleScreen';
import { ProfileScreen } from '@/features/profiles/ProfileScreen';
import { SettingsPanel } from '@/features/settings/SettingsPanel';
import { expectNoAxeViolations, makeServices, renderWithServices, TEST_PROFILE } from './helpers';

describe('Title screen', () => {
  it('shows the configurable title and main menu, and an accessible About dialog', async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn();
    const { container } = await renderWithServices(
      <TitleScreen onPlay={onPlay} onSettings={vi.fn()} />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Witness: A Journey Through Scripture' }),
    ).toBeInTheDocument();
    // All four chapters, not just the first.
    expect(screen.getByText(/Jericho, Galilee, Bethlehem, Colossae/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(onPlay).toHaveBeenCalled();
    const about = screen.getByRole('button', { name: 'About this game' });
    await user.click(about);
    const dialog = screen.getByRole('dialog', { name: 'About this game' });
    expect(within(dialog).getByText(/no faith or holiness scores/i)).toBeInTheDocument();
    await expectNoAxeViolations(container);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(about).toHaveFocus(); // focus returns to the opener
  });

  it('tells the player about storage problems and offers a waiting update', async () => {
    const user = userEvent.setup();
    const services = await makeServices();
    const applyUpdate = vi.fn().mockResolvedValue(undefined);
    services.applyUpdate = applyUpdate;
    services.notices.setState((n) => ({
      ...n,
      updateAvailable: true,
      storageWarning: 'Progress can’t be kept on this device (private browsing).',
    }));
    await renderWithServices(<TitleScreen onPlay={vi.fn()} onSettings={vi.fn()} />, services);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/private browsing/);
    expect(status).toHaveTextContent('A new version of the game is ready.');
    await user.click(screen.getByRole('button', { name: 'Update now' }));
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('Profiles', () => {
  it('creates a profile with a nickname and a look, validating input', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = await renderWithServices(
      <ProfileScreen onSelect={onSelect} onBack={vi.fn()} />,
    );
    const name = await screen.findByLabelText('Nickname');
    expect(screen.getByText(/no real names needed/)).toBeInTheDocument();
    await user.type(name, '<bad>');
    await user.click(screen.getByRole('button', { name: 'Create and continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/letters, numbers/);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    await user.clear(name);
    await user.type(name, 'Ari');
    await user.click(screen.getByRole('radio', { name: /Look 3/ }));
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Create and continue' }));
    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Ari', look: 'look-3' }),
      ),
    );
  });

  it('lists and removes profiles after confirmation', async () => {
    const user = userEvent.setup();
    const services = await makeServices();
    await services.profiles.create('Sam', 'look-2');
    await renderWithServices(<ProfileScreen onSelect={vi.fn()} onBack={vi.fn()} />, services);
    expect(await screen.findByRole('button', { name: /^Sam/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove profile Sam' }));
    const confirm = screen.getByRole('dialog', { name: 'Remove Sam?' });
    expect(confirm).toHaveTextContent(/can’t be undone/);
    await user.click(within(confirm).getByRole('button', { name: 'Remove profile' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Sam/ })).not.toBeInTheDocument(),
    );
    expect(await services.profiles.list()).toEqual([]);
  });
});

describe('Chapter select', () => {
  it('lists every chapter: playable ones can be started, the rest say they are not available yet', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    const { container } = await renderWithServices(
      <ChapterSelect profile={TEST_PROFILE} onStart={onStart} onBack={vi.fn()} />,
    );
    expect(await screen.findByRole('heading', { name: /The Road to Jericho/ })).toBeInTheDocument();
    for (const meta of chapterSource.list()) {
      const card = screen.getByRole('listitem', { name: new RegExp(meta.title) });
      if (meta.available) {
        expect(within(card).getByRole('button', { name: 'New game' })).toBeInTheDocument();
      } else {
        expect(within(card).getByText('Not available yet')).toBeInTheDocument();
      }
    }
    const jericho = screen.getByRole('listitem', { name: /The Road to Jericho/ });
    await user.click(within(jericho).getByRole('button', { name: 'New game' }));
    expect(onStart).toHaveBeenCalledWith('road-to-jericho', null);
    await expectNoAxeViolations(container);
  });
});

describe('Key art', () => {
  it('shows the title over the rendered hero image, with a text alternative and both sizes', async () => {
    const { container } = await renderWithServices(
      <TitleScreen onPlay={vi.fn()} onSettings={vi.fn()} />,
    );
    const hero = screen.getByRole('img', { name: TITLE_ART.alt });
    expect(hero.tagName).toBe('IMG');
    expect(hero).toHaveAttribute('src', '/art/key-art/title.webp');
    expect(hero.getAttribute('srcset')).toBe(
      '/art/key-art/title-960.webp 960w, /art/key-art/title.webp 1920w',
    );
    // Its size is reserved, so the menu doesn't jump when it loads.
    expect(hero).toHaveAttribute('width', '1920');
    expect(hero).toHaveAttribute('height', '960');
    expect(hero).toHaveAttribute('loading', 'eager');
    // The title is a real heading over the image, not part of it.
    const heading = screen.getByRole('heading', { level: 1 });
    expect(hero.closest('.title-screen__hero')).toContainElement(heading);
    await expectNoAxeViolations(container);
  });

  it('keeps a painted stand-in, still named, if the hero image fails to load', async () => {
    const { container } = await renderWithServices(
      <TitleScreen onPlay={vi.fn()} onSettings={vi.fn()} />,
    );
    fireEvent.error(screen.getByRole('img', { name: TITLE_ART.alt }));
    const fallback = screen.getByRole('img', { name: TITLE_ART.alt });
    expect(fallback.tagName).toBe('DIV');
    expect(fallback).toHaveClass('title-screen__art', 'key-art--fallback');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("gives every chapter card its chapter's own key art, and a stand-in if it fails", async () => {
    const { container } = await renderWithServices(
      <ChapterSelect profile={TEST_PROFILE} onStart={vi.fn()} onBack={vi.fn()} />,
    );
    await screen.findByRole('heading', { name: /The Road to Jericho/ });
    const chapters = chapterSource.list().filter((c) => c.available);
    expect(chapters).toHaveLength(4);
    const alts = new Set<string>();
    for (const meta of chapters) {
      const card = screen.getByRole('listitem', { name: new RegExp(meta.title) });
      expect(meta.keyArt, meta.id).toBeDefined();
      const alt = meta.keyArt?.alt ?? '';
      alts.add(alt);
      const img = within(card).getByRole('img', { name: alt });
      expect(img).toHaveAttribute('src', `/art/key-art/${meta.id}.webp`);
      expect(img.getAttribute('srcset')).toBe(
        `/art/key-art/${meta.id}-800.webp 800w, /art/key-art/${meta.id}.webp 1600w`,
      );
      expect(img).toHaveAttribute('width', '1600');
      expect(img).toHaveAttribute('height', '600');
      expect(img).toHaveAttribute('loading', 'lazy');
    }
    // Each chapter says what its own picture shows.
    expect(alts.size).toBe(chapters.length);
    await expectNoAxeViolations(container);
    const storm = screen.getByRole('listitem', { name: /A Storm on Galilee/ });
    const alt = chapters.find((c) => c.id === 'storm-on-galilee')?.keyArt?.alt ?? '';
    fireEvent.error(within(storm).getByRole('img', { name: alt }));
    const fallback = within(storm).getByRole('img', { name: alt });
    expect(fallback.tagName).toBe('DIV');
    expect(fallback).toHaveClass('chapter-card__art', 'key-art--fallback');
    // The card still works.
    expect(within(storm).getByRole('button', { name: 'New game' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('Settings', () => {
  it('applies accessibility settings immediately and persists them', async () => {
    const user = userEvent.setup();
    const { services, container } = await renderWithServices(<SettingsPanel onClose={vi.fn()} />);
    await user.click(screen.getByLabelText('High contrast'));
    await user.selectOptions(screen.getByLabelText('Font'), 'dyslexic');
    await user.selectOptions(screen.getByLabelText('Reduce motion'), 'on');
    await user.selectOptions(screen.getByLabelText('Dialogue text speed'), 'instant');
    await user.click(screen.getByLabelText('Simpler visual effects (lighter on battery)'));
    await waitFor(() =>
      expect(services.settings.current).toMatchObject({
        highContrast: true,
        font: 'dyslexic',
        reducedMotion: 'on',
        dialogueSpeed: 'instant',
        simpleEffects: true,
      }),
    );
    const root = document.createElement('div');
    applySettingsToDocument(services.settings.current, root);
    expect(root.dataset).toMatchObject({ contrast: 'high', font: 'dyslexic', motion: 'reduce' });
    await expectNoAxeViolations(container);
  });

  it('remaps a key by pressing it', async () => {
    const user = userEvent.setup();
    const { services } = await renderWithServices(<SettingsPanel onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Change key for Open journal' }));
    expect(
      screen.getByRole('button', { name: 'Press a key for Open journal' }),
    ).toBeInTheDocument();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', bubbles: true }));
    });
    await waitFor(() => expect(services.settings.current.keyBindings.journal[0]).toBe('KeyK'));
    expect(screen.getByRole('row', { name: /Open journal/ })).toHaveTextContent('K');
  });

  it('keeps anonymous statistics off by default and explains them', async () => {
    await renderWithServices(<SettingsPanel onClose={vi.fn()} />);
    const toggle = screen.getByLabelText('Share anonymous gameplay statistics');
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/never names, reflections or journal text/)).toBeInTheDocument();
  });

  it('copies diagnostics for a bug report, or shows them to copy by hand', async () => {
    const user = userEvent.setup();
    const { services } = await renderWithServices(<SettingsPanel onClose={vi.fn()} />);
    services.logger.error('Scene failed to load', new Error('boom'));
    await user.click(screen.getByRole('button', { name: 'Copy diagnostics' }));
    expect(await screen.findByText('Copied.')).toBeInTheDocument();
    const copied = await navigator.clipboard.readText();
    expect(copied).toContain(services.config.version);
    expect(copied).toContain('ERROR Scene failed to load');

    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    await user.click(screen.getByRole('button', { name: 'Copy diagnostics' }));
    const box = await screen.findByLabelText<HTMLTextAreaElement>(
      'Diagnostics (select all and copy)',
    );
    expect(box.value).toContain('Scene failed to load');
  });

  it('applies text scale through a CSS variable', () => {
    const root = document.createElement('div');
    applySettingsToDocument({ ...DEFAULT_SETTINGS, textScale: 1.5 }, root);
    expect(root.style.getPropertyValue('--text-scale')).toBe('1.5');
  });
});
