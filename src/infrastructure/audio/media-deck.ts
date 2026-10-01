import type { MusicTrack } from '@/domain/music';
import type { MusicDeck, MusicDeckFactory } from './recorded-music';

/**
 * Plays a music track with an <audio> element (streamed, so a long track
 * never has to be decoded into memory whole) routed through WebAudio: a
 * gain node per copy for its fades, into the game's music channel, which
 * applies the volume settings and mute. (An element's own `volume` can't be
 * set on iOS, so it is never used.)
 */
export function mediaDeckFactory(
  ctx: AudioContext,
  out: AudioNode,
  urlOf: (track: MusicTrack) => string,
  onPlaying: (url: string) => void = () => {},
  createElement: () => HTMLAudioElement = () => new Audio(),
): MusicDeckFactory {
  return (track) => {
    const url = urlOf(track);
    const el = createElement();
    el.preload = 'auto';
    el.src = url;
    const source = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(out);
    let ended = false;
    let disposed = false;
    const onEnded = (): void => {
      ended = true;
    };
    el.addEventListener('ended', onEnded);

    const deck: MusicDeck = {
      async play(offset) {
        if (disposed) throw new Error('disposed');
        if (offset !== undefined && offset > 0) el.currentTime = offset;
        await el.play();
        onPlaying(url);
      },
      pause() {
        el.pause();
      },
      fade(level, seconds) {
        const now = ctx.currentTime;
        const g = gain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        if (seconds <= 0) g.setValueAtTime(level, now);
        else g.linearRampToValueAtTime(level, now + seconds);
      },
      get time() {
        return Number.isFinite(el.currentTime) ? el.currentTime : 0;
      },
      get ended() {
        return ended;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        el.removeEventListener('ended', onEnded);
        el.pause();
        // Release the download and the decoder.
        el.removeAttribute('src');
        el.load();
        source.disconnect();
        gain.disconnect();
      },
    };
    return deck;
  };
}
