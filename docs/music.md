# Music: credits, licence and how it plays

The game's background music is four recorded tracks from Pixabay. The owner chose them on 2026-10-01 ([ADR-0018](adr/0018-recorded-music.md)). Sound effects, footsteps and ambient sounds are still the game's own, synthesised at runtime ([`soundscape.ts`](../src/infrastructure/audio/soundscape.ts)).

## Credits

| Track | Artist | Source | Plays for |
|---|---|---|---|
| Cinematic Oud and Qanun | vjgalaxy | [Pixabay](https://pixabay.com/music/arabic-cinematic-oud-and-qanun-588125/) | home, the markets and the menus |
| Sacred Sands Arabic Background Music with Ancient Desert Vibes | DesiFreeMusic | [Pixabay](https://pixabay.com/music/world-sacred-sands-arabic-background-music-with-ancient-desert-vibes-504051/) | the journey and exploring |
| Middle Eastern Cinematic Mystery | Sonican | [Pixabay](https://pixabay.com/music/world-middle-eastern-cinematic-mystery-532031/) | danger and the storm's tension |
| Meditative Middle Eastern Flute | Ashot_Danielyan | [Pixabay](https://pixabay.com/music/meditationspiritual-meditative-middle-eastern-flute-113656/) | reflection, Scripture, Paul's letter and the chapter endings |

All four are used under the [Pixabay Content License](https://pixabay.com/service/license-summary/) ([terms](https://pixabay.com/service/terms/)). Attribution isn't required, but the game gives it: the same list appears in **About this game** on the title screen.

## Provenance and licence notes

[`public/audio/music/music-sources.json`](../public/audio/music/music-sources.json) was written when the files were downloaded (2026-10-01). It records, for each track:

- the source page and the artist;
- the file's size and SHA-256;
- whether Pixabay labelled the track AI-generated or registered with Content ID;
- any P.R.O. registration.

It also holds the licence notes. Keep it as it is. [`tests/content/music.test.ts`](../tests/content/music.test.ts) checks it on every run:

- every listed file exists, byte for byte (size and SHA-256);
- no unlisted music file ships;
- the licence notes are still there;
- the game's catalogue ([`src/domain/music.ts`](../src/domain/music.ts)) and its credits agree with it.

Points to keep in mind, from those notes:

- **No standalone redistribution.** The files ship only inside the game. Never offer them as a download, a soundtrack or a stream. The flute track's creator also prohibits distributing it to music streaming services.
- **Content ID.** The mystery and flute tracks are registered with Content ID, and the flute is also registered with a P.R.O. (BMI / IPI 00855552512). Gameplay videos that include them may get claims. The absence of a badge on the other two is no guarantee.
- **No licence certificates** were obtained (nobody was signed in). The manifest documents provenance; it is not a Pixabay certificate.
- The files are **used as downloaded**: no editing, re-encoding or loudness changes. Level matching and looping happen at playback.

## Which music plays when

[`src/application/music.ts`](../src/application/music.ts) maps moods to tracks, and each scene names its mood (`music`). A scene can change its music with the story through `musicChanges`, the music counterpart of `weatherChanges`:

| Moment | Music |
|---|---|
| Title, profiles, chapter list | the oud and qanun (`home`) |
| Homes, markets, towns | `home` |
| Roads, fields, the lake as the boat puts out | the sands (`journey`) |
| The Jericho road, from finding the injured man until you choose what to do | the mystery (`tension`) |
| The open lake once the wind rises, through the storm | `tension` |
| The sudden calm on the lake | 5 s of silence, then the flute (`reflection`) |
| Philemon's house (Paul's letter); Scripture Connection, the reflection and the chapter summary | the flute (`reflection`) |
| A teaser film | its sections in turn: oud for dawn, home and the market, sands for the road, the mystery for unease and tension, silence, then the flute under the title |

The music is **lowered** (about −8 dB) under dialogue and while reading: the journal, Scripture Connection and the reflection.

## How it plays

`AudioPort.setMusic(mood)` is the only way in. Behind it, [`RecordedMusic`](../src/infrastructure/audio/recorded-music.ts) handles playback:

- **No needless restarts.** Asking for the track already playing, or already on its way, changes nothing. Moving between places with the same music never restarts it.
- **Cross-fades** of 2.5 s (1.5 s in a film). The latest request always wins. A change in the middle of another cuts the older fade short, so at most two tracks are ever heard together, and only while one fades into the other.
- **Silence, then a gentle return.** A music change can ask for silence first (the calm on the lake). The new track then fades in over 4 s.
- **Loops.** The tracks fade out at their ends rather than looping cleanly. Each pass cross-fades into the next over 3 s, a little before the track's fade begins. The next pass starts past the quiet opening half-second (`loop` in the catalogue).
- **Levels.** Each track has a measured level that evens out loudness (whole-track RMS about −15, −15, −12 and −16.5 dBFS). The music channel sits at 45 % of the music volume, under the story rather than over it.
- **Volume and mute.** The music volume and mute settings apply through the WebAudio music channel. Muted, or at zero volume, the music is paused; it resumes where it was.
- **Autoplay.** Nothing plays before the player's first click, tap or key press. Every gesture calls `AudioPort.unlock()`, so music the browser blocked starts on the next one. A hidden page (another tab, a phone's home screen) is silent until it is shown again.
- **Failures.** A file that won't load is logged once and left silent. The game never waits for music.
- **Captions.** When a track starts (not on a loop or a resume), a sound caption describes it, for example "[Quiet flute music]", provided captions are on and sound isn't muted. Captions also show over the menus.
- **Cleanup.** Leaving a chapter stops its ambience and the ducking; the menus then ask for their own music. Closing the app releases every audio element.

For tests and bug reports, the page shows the music's state on the `<html>` element: `data-music` (the track, or `none`), `data-music-playing` and `data-music-volume`.

## Offline

The files are fetched from the site itself, under the base path (for example `/witness/audio/music/…` on GitHub Pages), with a `?v=` taken from each file's SHA-256. They work offline like this:

1. The service worker ([`vite.config.ts`](../vite.config.ts)) serves `audio/music/*.mp3` from the `witness-music` cache, with Workbox's range-request support. The `<audio>` element asks for byte ranges, and each range is cut from the whole cached file.
2. The first time music plays, [`music-cache.ts`](../src/infrastructure/audio/music-cache.ts) stores the whole file in that cache, then the other three, one after another. Partial (206) responses are never cached.
3. It does nothing without a service worker, or on a connection that asks to save data. Entries from an older `?v=` are removed.

Offline before a track has been stored, the music is silent and the game plays on. [`e2e/pwa.spec.ts`](../e2e/pwa.spec.ts) plays the music once online, then plays it again with the network off.
