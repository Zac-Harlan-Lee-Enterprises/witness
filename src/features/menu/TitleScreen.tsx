import { useState } from 'react';
import { useStore } from '../common/hooks';
import { Modal } from '../common/Modal';
import { useServices } from '../common/services';
import { JourneyArt } from './JourneyArt';

export function TitleScreen({
  onPlay,
  onSettings,
}: {
  onPlay: () => void;
  onSettings: () => void;
}) {
  const { config } = useServices();
  const [about, setAbout] = useState(false);
  return (
    <main className="screen title-screen" aria-labelledby="game-title">
      <div className="title-screen__art" aria-hidden="true">
        <JourneyArt className="title-screen__svg" />
      </div>
      <h1 id="game-title" className="title-screen__title">
        {config.title}
      </h1>
      <p className="title-screen__subtitle">Chapter 1 · The Road to Jericho</p>
      <nav className="menu" aria-label="Main menu">
        <button type="button" className="button button--primary button--large" onClick={onPlay}>
          Play
        </button>
        <button type="button" className="button" onClick={onSettings}>
          Settings
        </button>
        <button type="button" className="button" onClick={() => setAbout(true)}>
          About this game
        </button>
      </nav>
      <Notices />
      <p className="title-screen__version">Version {config.version}</p>
      {about && <AboutDialog onClose={() => setAbout(false)} />}
    </main>
  );
}

function Notices() {
  const { notices, applyUpdate } = useServices();
  const n = useStore(notices);
  return (
    <div className="notices" role="status">
      {n.storageWarning && <p className="notice notice--warning">{n.storageWarning}</p>}
      {n.updateAvailable && (
        <p className="notice">
          A new version of the game is ready.{' '}
          {applyUpdate && (
            <button
              type="button"
              className="button button--small"
              onClick={() => void applyUpdate()}
            >
              Update now
            </button>
          )}
        </p>
      )}
      {n.offlineReady && <p className="notice">The game is ready to play offline.</p>}
    </div>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  const { config } = useServices();
  return (
    <Modal title="About this game" onClose={onClose}>
      <p>
        {config.title} is a story-driven adventure. You play a fictional young person living near
        events told in the Bible. You explore, talk with people, solve puzzles and make choices —
        and learn about Scripture and its world along the way.
      </p>
      <h3>How to tell what’s what</h3>
      <p>Everything you read is labeled:</p>
      <ul>
        <li>
          <strong>Scripture</strong> — a Bible reference (verse text appears only from an approved
          translation).
        </li>
        <li>
          <strong>Scripture paraphrase</strong> — a retelling in our own words, never presented as a
          quotation.
        </li>
        <li>
          <strong>Historical background</strong> and <strong>Historical reconstruction</strong> —
          with sources and how confident we are.
        </li>
        <li>
          <strong>Interpretation</strong> — how Christians have understood a passage. Traditions
          sometimes differ.
        </li>
        <li>
          <strong>Story (fiction)</strong> — the characters and events of the game itself.
        </li>
      </ul>
      <p>
        Your choices change your own story — who you help, what you carry, who trusts you. They
        never change Scripture, and there are no faith or holiness scores.
      </p>
      <h3>Privacy</h3>
      <p>
        No account, no ads, no chat. Progress is saved only on this device. Anonymous gameplay
        statistics are off unless you turn them on in Settings, and your reflections are never sent
        anywhere.
      </p>
      <h3>Content status</h3>
      <p>
        This is an early version. Educational notes were drafted with AI assistance and checked
        against sources, and they are labeled “Awaiting editorial review” until a human editor
        approves them.
      </p>
    </Modal>
  );
}
