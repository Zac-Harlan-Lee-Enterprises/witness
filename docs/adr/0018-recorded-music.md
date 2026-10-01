# ADR-0018: Recorded background music from Pixabay, in place of the synthesised music

- **Status:** Accepted. Decided by the owner, Zac Harlan, on 2026-10-01. Supersedes the music part of [ADR-0004](0004-ascii-maps-procedural-art-audio.md); effects, footsteps and ambience stay procedural.
- **Related:** [music guide and credits](../music.md), [`public/audio/music/music-sources.json`](../../public/audio/music/music-sources.json), [`src/domain/music.ts`](../../src/domain/music.ts), [`src/application/music.ts`](../../src/application/music.ts), [`src/infrastructure/audio/recorded-music.ts`](../../src/infrastructure/audio/recorded-music.ts), [`media-deck.ts`](../../src/infrastructure/audio/media-deck.ts), [`music-cache.ts`](../../src/infrastructure/audio/music-cache.ts), [`tests/content/music.test.ts`](../../tests/content/music.test.ts), [content governance §9](../content-governance.md#9-third-party-assets), [ADR-0016](0016-makehuman-base-for-portraits.md)

## Context

The background music was synthesised at runtime: short modal phrases plucked over a drone ([ADR-0004](0004-ascii-maps-procedural-art-audio.md)). It was original and free of licensing questions, but it sounded like placeholder music, and the teaser film's synthesised score had the same limits. The project's rule was that every asset is original, made by code in this repository, with one approved exception (MakeHuman's CC0 model for the portraits, [ADR-0016](0016-makehuman-base-for-portraits.md)).

## Decision

On 2026-10-01 the owner chose four recorded tracks, downloaded from Pixabay on that date through each track's official page and download control, to replace the synthesised background music. This is a **scoped exception** to the original-assets rule: it covers these four music files only.

| Track | Artist | Plays for |
|---|---|---|
| Cinematic Oud and Qanun | vjgalaxy | home, the markets and the menus |
| Sacred Sands Arabic Background Music with Ancient Desert Vibes | DesiFreeMusic | the journey and exploring |
| Middle Eastern Cinematic Mystery | Sonican | danger and the storm's tension |
| Meditative Middle Eastern Flute | Ashot_Danielyan | reflection, Scripture, Paul's letter and the chapter endings |

The limits:

1. **Licence.** The tracks are used under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Attribution isn't required, but the game credits every track anyway: in *About this game* on the title screen ([`MusicCredits.tsx`](../../src/features/menu/MusicCredits.tsx)) and in [docs/music.md](../music.md).
2. **Provenance is pinned and checked.** [`music-sources.json`](../../public/audio/music/music-sources.json), written when the files were downloaded, records each file's source page, artist, size and SHA-256, the licence and terms URLs, and notes on Content ID. The file is kept as written. [`tests/content/music.test.ts`](../../tests/content/music.test.ts) fails if a listed file is missing, differs by a byte, or isn't listed, or if the game's catalogue ([`src/domain/music.ts`](../../src/domain/music.ts)) disagrees with it.
3. **The files are used as downloaded.** No editing, loudness changes or re-encoding. Looping and level matching happen at playback: each track has a measured level and loop points in the catalogue.
4. **No standalone redistribution.** The files ship only inside the game, as its background music. They are never offered as a download, a soundtrack or a stream. The Pixabay licence and the flute track's creator both forbid redistributing them as standalone music.
5. **Sound effects, footsteps and ambience stay original and synthesised** ([`soundscape.ts`](../../src/infrastructure/audio/soundscape.ts)). Any further downloaded asset still needs the owner's approval and its own ADR.

How the music is wired:

- **Choosing the track is pure application logic** ([`src/application/music.ts`](../../src/application/music.ts)). It maps each mood (`home`, `journey`, `tension`, `reflection`) to a track, and maps a teaser's cue sheet to a sequence of tracks (`filmMusicPlan`). The ending's panels call for reflective music. Dialogue and reading (the journal, Scripture Connection, the reflection) lower it.
- **Music follows the story inside a place.** Scenes gain `musicChanges` (the music counterpart of `weatherChanges`). On the open lake the music is for travelling, turns tense when the wind rises, and when the wind stops all at once it falls silent for five seconds before the flute returns. On the Jericho road it is tense from finding the injured man until you choose what to do. `GameController.syncMusic` tells the `AudioPort` only about real changes.
- **Playing it is infrastructure, behind `AudioPort`.** `RecordedMusic` holds the rules: no restart for the same track, cross-fades of 2.5 s, the latest request wins, at most two tracks at once and only while one fades into the other, a silence before a gentle return, loops that cross-fade into the next pass (the files fade out at their ends), ducking to about −8 dB, and a pause while muted or hidden. A track starts only after a user gesture. A blocked play waits for the next gesture, and a file that won't load is logged once and left silent. Each copy of a track is an `<audio>` element routed through WebAudio into the music channel ([`media-deck.ts`](../../src/infrastructure/audio/media-deck.ts)). Streaming means a four-minute track is never decoded into memory whole, and the WebAudio gain works on iOS, where an element's own volume can't be set.
- **Offline.** The service worker serves the music from its own cache, with range-request support. The `<audio>` element asks for byte ranges, and partial (206) responses can't be cached whole. So the page stores each whole file the first time music plays: the playing track first, then the other three ([`music-cache.ts`](../../src/infrastructure/audio/music-cache.ts)). This is Workbox's documented recipe for cached media. It runs only when a service worker controls the page, and never on a connection that asks to save data. URLs carry a `?v=` from each file's SHA-256, so a replaced file is never served from an old cache.
- The synthesised music and the teaser's synthesised film score are removed (`film-score.ts`, the `MUSIC` phrase tables).

## Consequences

- The game sounds like a finished game. The teaser film plays the same tracks, cued to its sections.
- About 19 MB of music ships in `public/audio/music/`. It isn't precached. It is stored the first time music plays: the playing track, then the others in the background. This doesn't happen when the connection asks to save data. Offline before a track has been stored, the game plays on in silence.
- The game now depends on a third-party licence. `music-sources.json` and the test keep the provenance honest. If Pixabay's terms change, or a Content ID claim affects gameplay videos (the mystery and flute tracks are registered, and the flute is also registered with a P.R.O.), this ADR is where to reconsider.
- Replacing a track means: add the new file and its provenance to `music-sources.json`, update the catalogue (title, artist, source, version, level, loop points), and record the owner's approval here or in a new ADR.

## Alternatives considered

- **Keep the synthesised music.** Original and free of licences, but it never stopped sounding like a placeholder.
- **Commissioned music.** The best option for a full release, but it isn't available now. The `AudioPort` seam and the track catalogue mean a commissioned score could replace these files without touching game code.
- **Precaching all the music.** It would be simpler, but Workbox's precache answers a range request with the whole file (a 200, not a 206), which Safari won't play. Every first install would also download 19 MB, even on a connection that asks to save data.
- **Decoding the tracks into WebAudio buffers.** This would give sample-accurate loops, but a decoded track takes about 10 MB per minute of memory. That is too much for phones.
