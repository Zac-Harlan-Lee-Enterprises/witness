import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSystemReducedMotion } from '@/features/game/motion';

function Probe() {
  return <p>{useSystemReducedMotion() ? 'reduce' : 'full'}</p>;
}

describe('device reduced-motion preference', () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  it('follows changes made in the operating system during play', () => {
    const listeners = new Set<() => void>();
    let matches = false;
    window.matchMedia = vi.fn().mockImplementation(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    }));
    render(<Probe />);
    expect(screen.getByText('full')).toBeInTheDocument();
    act(() => {
      matches = true;
      listeners.forEach((l) => l());
    });
    expect(screen.getByText('reduce')).toBeInTheDocument();
  });
});
