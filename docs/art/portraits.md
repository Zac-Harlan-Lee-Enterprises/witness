# Portraits: rendered heads and shoulders

The dialogue box, the profile look picker and chapter select show a portrait of whoever is speaking or playing. Each is a **rendered photograph**: a lit head and shoulders of everyone who speaks in any chapter and of every player look. Blender makes them offline from each person's appearance data and a casting table.

The portraits now show a face for each line: every speaker has a neutral portrait, plus one for each expression their lines carry (glad, worried, sad, angry, surprised, afraid).

**The fourth pass (the MakeHuman pass, §8)** replaced the heads, which had been sculpted in code as signed distance fields (§12). Three passes of those still read as CG mannequins: waxy skin, lifeless eyes, and every man with the same face. The heads are now MakeHuman's anatomical human model:

- CC0 data, used with the owner's approval of 2026-09-26 ([ADR-0016](../adr/0016-makehuman-base-for-portraits.md));
- geometry and morph targets only;
- moved to each person's own face and to the expression of the line.

The skin, eyes, teeth, hair, clothes, light and expressions are all made here.

- **Where they come from:**
  - [`tools/art/build_portraits.py`](../../tools/art/build_portraits.py) and `tools/art/lib/portrait_*.py`, with [`makehuman.py`](../../tools/art/lib/makehuman.py) reading MakeHuman's data;
  - they read [`tools/art/data/portrait-people.json`](../../tools/art/data/portrait-people.json) (`npm run art:portrait-data`).
  - Run `npm run art:fetch-makehuman` once (it downloads the pinned CC0 files into a gitignored cache), then `npm run art:portraits`.
  - Blender 5.2+ is required. On an M3 Pro a person takes about 20 s to build and about a minute to render at 1024 px and 160 samples, reduced to 512. Two or three people render at once.
- **Who gets one:** [`src/content/portrait-cast.ts`](../../src/content/portrait-cast.ts).
  - Every character who speaks a line, in every chapter, in every expression their lines carry.
  - Biblical figures never get one: they are never shown in close-up. Characters who never speak don't need one.
  - A later chapter's character who shares an id with an earlier one (Tamar, Kallias) is rendered as `<id>.<chapter id>`.
- **What ships:**
  - `public/art/portraits/<id>-512.webp` (the master), `-256.webp` and `-128.webp` for the neutral portrait;
  - `public/art/portraits/<expression>/<id>-<size>.webp` for each expression;
  - the manifest [`src/features/portraits/portrait-manifest.json`](../../src/features/portraits/portrait-manifest.json): `id` → the appearance key it was rendered from, and the expressions rendered.
- **What the game does:** [`Portrait`](../../src/features/common/Portrait.tsx) shows the rendered image for the line's expression, or the neutral one if that expression wasn't rendered. It falls back to the original SVG drawing if there is no portrait for how the person looks now.
- **What each render checks of itself:** [`tools/art/data/portrait-checks.json`](../../tools/art/data/portrait-checks.json) records, and a content test enforces:
  - the face's skin colour against the person's colour in the game;
  - that both eyes look at one point, with each pupil in its opening.
- **Provenance:**
  - The MakeHuman files are pinned by commit and SHA-256 in [`makehuman-files.json`](../../tools/art/data/makehuman-files.json) and recorded in the [asset manifest](asset-manifest.json) (`thirdPartySources`).
  - Everything else is made by code in this repository. No image, texture, other model, HDRI or photograph was downloaded, and no image-generation model was used.
  - With thanks to the MakeHuman project and its contributors for releasing their model into the public domain.

**Pictures** (in [`portraits/`](portraits/)):

- **The MakeHuman pass, by chapter:** [Chapter 1](portraits/contact-sheet-road-to-jericho.webp), [Chapter 2](portraits/contact-sheet-storm-on-galilee.webp), [Chapter 3](portraits/contact-sheet-journey-to-bethlehem.webp), [Chapter 4](portraits/contact-sheet-letter-from-paul.webp), and [the player looks](portraits/contact-sheet-players.webp), each with names and parts.
- **Every expression rendered, by chapter:** [Chapter 1](portraits/expressions-road-to-jericho.webp), [Chapter 2](portraits/expressions-storm-on-galilee.webp), [Chapter 3](portraits/expressions-journey-to-bethlehem.webp), [Chapter 4](portraits/expressions-letter-from-paul.webp). Each row is one person, neutral first.
- [before-after-v2-v4.webp](portraits/before-after-v2-v4.webp): every person, the signed-distance heads (left; the second pass, which shipped) against the MakeHuman pass (right). [before-after-v2-v4-detail.webp](portraits/before-after-v2-v4-detail.webp): the same faces up close, from the masters.
- Earlier passes (§12): [before-after-v1-v2.webp](portraits/before-after-v1-v2.webp), [before-after-v2-game.webp](portraits/before-after-v2-game.webp), [before-after.webp](portraits/before-after.webp), [before-after-phone.webp](portraits/before-after-phone.webp), [contact-sheet.webp](portraits/contact-sheet.webp) (the first pass), and the finish comparisons [finish-comparison.webp](portraits/finish-comparison.webp), [finish-comparison-full.webp](portraits/finish-comparison-full.webp) and [finish-comparison-v2.webp](portraits/finish-comparison-v2.webp) (§12.3).

Recreate the sheets with:

- `npm run art:portrait-sheets` for the chapter and expression sheets;
- `npm run art:portrait-sheets -- --compare 38d090f --pass v2-v4` for the before and after;
- `-- --tile 104` or `-- --tile 160 --out <dir>` to see them at the sizes the game shows.

## 1. How a portrait is made

One Blender run per person and expression ([`portrait_person.build`](../../tools/art/lib/portrait_person.py)). Every step is deterministic: the same id, appearance and expression always give the same picture.

| Step | Module | What it does |
|---|---|---|
| Who | [`portrait_params.py`](../../tools/art/lib/portrait_params.py) | The casting table: age, sex, sun, a resting mood, scars, and the person's face, nose, eye and lip types (§3). Then the skin's history (sun, oil, freckles, moles, stubble), hair and head covering, and how they sit. Seeded from the id. |
| Face | [`portrait_face.py`](../../tools/art/lib/portrait_face.py) | The person's MakeHuman target weights (§2, §3): macro key shapes for sex, age, muscle, weight and ancestry, then every region of the face, and small asymmetries. The expression's weights (§4). |
| Head | [`portrait_mhhead.py`](../../tools/art/lib/portrait_mhhead.py), [`makehuman.py`](../../tools/art/lib/makehuman.py) | The base mesh moved by those weights, twice: the **rest** shape (no expression) and the **posed** shape. Landmarks are found from MakeHuman's own targets and vertices: the lips, brows, nose, cheeks, ears, the lid margins and the mouth line. The eyes are fitted to the lid margins. The skin is also kept as a signed distance field (OpenVDB), which the hair and clothes rest on. |
| Skin | [`portrait_mhskin.py`](../../tools/art/lib/portrait_mhskin.py), [`portrait_materials.py`](../../tools/art/lib/portrait_materials.py) | Regional maps on the rest shape (§5), so they stay on the skin in every expression. Wrinkles deepen where the expression bunches the skin. Random-walk subsurface scattering. The colour is calibrated to the person's colour in the game (§6). |
| Eyes | [`portrait_eyes.py`](../../tools/art/lib/portrait_eyes.py) | An eyeball fitted to the lid margins: a recessed iris with radial fibres, crypts and a limbal ring, a warm sclera, a clear refracting cornea for a crisp catchlight, and a wet tear line. Both eyes aim at one point (§5). |
| Teeth | [`portrait_teeth.py`](../../tools/art/lib/portrait_teeth.py) | Crowns shaped tooth by tooth (chisel-edged incisors, pointed canines, cusped premolars and molars), each a little different in size, height and turn. They are set along the dental arch MakeHuman's helper traces, with gums over their necks. The lower arch moves rigidly with the jaw. MakeHuman's helper tongue. |
| Clothes | [`portrait_cloth.py`](../../tools/art/lib/portrait_cloth.py) | Cloth shells over the body's distance field: a tunic with a hemmed neckline and woven stripes, elders' mantles, veils and scarves falling from the crown in a few broad folds, men's head cloths with a cord, the wound wrap (§9), the band. |
| Hair | [`portrait_hair.py`](../../tools/art/lib/portrait_hair.py) | Blender hair curves with the Principled Hair BSDF (§9). Where hair grows is decided on the rest shape; roots follow the posed skin. |
| Light and lens | [`portrait_scene.py`](../../tools/art/lib/portrait_scene.py) | An 85 mm lens at f/3.2, focused on the near eye; short lighting (§12.3). |
| Finish | [`portrait_finish.py`](../../tools/art/lib/portrait_finish.py) | Rendered at twice the size and reduced (Lanczos) to 512, with a gentle lens vignette. Then reduced to 256 and 128 px, with a light sharpen on the small sizes. |

## 2. The MakeHuman base

MakeHuman's hm08 model is a full human body of 13,380 skin vertices in quads, of which about 4,300 are in the head. It comes with morph targets that move its vertices, and helper geometry that the targets move with it.

**What is used** (and only this: [ADR-0016](../adr/0016-makehuman-base-for-portraits.md)):

- **The base mesh** ([`3dobjs/base.obj`](https://github.com/makehumancommunity/makehuman/blob/1f508f6083b2f823dab15de924b3bde72e08d77c/makehuman/data/3dobjs/base.obj)). The portrait keeps the skin above the chest and subdivides it twice (Catmull-Clark) at render time. Of the helpers it uses:
  - the eye spheres, to find the sockets;
  - the lash strips, to find the lid margins;
  - the dental blocks, to find the arches;
  - the tongue.
- **The macro key shapes** (`targets/macrodetails/`): sex × age band (baby, child, young, old) × muscle × weight (`universal-*`), and sex × age band × ancestry (`african-*`, `asian-*`, `caucasian-*`).
  - A person's weights are products of linear interpolations between the named keys, written here ([`makehuman.macro_weights`](../../tools/art/lib/makehuman.py)).
  - The age bands stand for 1, 10, 25 and 90 years.
  - MakeHuman's key shapes age gently, so a person "looks" older than their years in proportion to a life in the sun.
- **Face and neck modifiers** (`targets/head`, `forehead`, `eyebrows`, `eyes`, `nose`, `mouth`, `cheek`, `chin`, `ears`, `neck`): two-sided (`-decr`/`-incr`, `-down`/`-up`…) or one-sided (the head shapes).
- **Asymmetries** (`targets/asym`).
- **Expression units** (`targets/expression/units/<ancestry>/`): single muscle actions, blended by the person's ancestry like the macros. Examples:
  - the corners of the mouth pulled up;
  - the inner brows raised;
  - the lids narrowed;
  - the nostrils flared;
  - the lower lip depressed;
  - the jaw dropped (which moves the lower dental block).

**Not used:** MakeHuman's textures and skins, its eye, eyebrow, eyelash, teeth, hair and clothing proxies, its skeleton and poses, and all of its code.

**Getting the data:**

- `npm run art:fetch-makehuman` ([`scripts/fetch-makehuman.mjs`](../../scripts/fetch-makehuman.mjs)) downloads the 499 files the portrait and people builds read (26.5 MB; the skeleton and its weights are for the world figures, ADR-0017) into `tools/art/.cache/makehuman/`:
  - from `raw.githubusercontent.com/makehumancommunity/makehuman` at commit `1f508f6083b2f823dab15de924b3bde72e08d77c` (tag v1.3.0);
  - over plain HTTPS, with no account, token or identifying header.
- Each file's SHA-256 must match [`tools/art/data/makehuman-files.json`](../../tools/art/data/makehuman-files.json), or it is refused.
- The build verifies the cache again before it renders (`makehuman.verify`).
- The list names every target the build can read, including both ends of every two-sided modifier, and the CC0 legal code (`LICENSE.ASSETS.md`).

**Licence:**

- `makehuman/license.txt` §C at that commit: "the base mesh and proxies, targets and modifiers, textures, clothes, poses and expressions … have been released under CC0 1.0 Universal".
- §D: the project claims nothing in renderings made from them.
- `base.obj`'s own header: "explicitly released as CC0 in september 2020".
- MakeHuman's code (AGPL-3.0) and MPFB2's (GPL-3.0) are not used or copied. The two file formats are read directly: OBJ, and targets as lines of `vertex dx dy dz`.

**Regions from targets.** A target moves exactly the vertices of the part it shapes. So how far a vertex moves under a target says how much of it belongs to that part:

| Region | Target |
|---|---|
| Upper lip | `mouth-upperlip-volume-incr` |
| Lower lip | `mouth-lowerlip-volume-incr` |
| Brows | the brow expression units |
| Ears | `ears/*-scale-incr` |
| Cheeks, under-eye bags, chin, forehead, nose | their own targets |

The same trick finds landmarks:

- the corners of the mouth;
- the wings of the nose;
- the midline profile (the root and tip of the nose, the mouth line, the chin).

Every one of these is the same vertex for everyone, so the maps are consistent from person to person.

**Eyes.** MakeHuman's eye socket sphere is larger than an eye (15 mm radius) and sits above the opening between the lids.

- The lid margins are found on the skin itself: the vertices where the lid turns in against the eyeball.
- Each eye is a 12.6 mm sphere fitted to touch both margins all along.
- So the eye fills the opening as a real eye does, and a pupil looking straight ahead sits in the middle of it.

## 3. Who they are

**Casting** (`CASTING` in [`portrait_params.py`](../../tools/art/lib/portrait_params.py)) gives what the story implies and the appearance data can't:

- an age, and a sex where the data would guess wrong;
- how much of a life is spent in the sun;
- sometimes an old scar;
- a resting mood;
- **a type** for the face (oval, long, square, heart, round, diamond), the nose (straight, aquiline, convex, broad, strong-bridged, snub, bulbous), the eyes (almond, round, hooded, deep-set, downturned) and the lips (thin to very full).

Types are cast so that no two people read alike. Family share a nose: Rivka and her brother Yair; Shifra and her brother Oded. Some examples:

- **Aunt Miriam** says her "knees can't manage that road anymore": 54, long face, aquiline nose.
- **Menashe** speaks most of his lines robbed and hurt on the road.
- **Old Hanina** has read the lake for sixty years: 76, weathered.
- **Hagit** has lived in Bethlehem "seventy years".
- **The player's four looks** are children of about ten, drawn to be neither boy nor girl.

Each type sets a starting point for its region's modifiers. [`portrait_face.identity`](../../tools/art/lib/portrait_face.py) then moves every modifier continuously from the person's own seed, about 170 target weights per person. Faces differ in:

- skull and face shape;
- forehead slope;
- brow ridge;
- eye size, spacing, depth, opening, tilt, hooding and bags;
- the nose's length, width, projection, hump, curve, tip and wings;
- the lips' fullness, bow, height and projection;
- cheekbones and cheek fat;
- jaw width, chin and cleft;
- the ears' size, angle and shape;
- the neck.

Asymmetries are small, and smaller for children.

**Ancestry.** The people are first-century Judeans and Galileans, a Nabataean trader, and Greeks and Phrygians in Colossae: Eastern Mediterranean people. MakeHuman's three ancestry key shapes are broad averages (African, East Asian, European), so a face here is a blend:

- mostly the West Eurasian shape;
- an African share of 0.12 to 0.40 that grows with the depth of the person's skin colour;
- an East Asian share of about 0.1;
- a little less of each in Colossae.

The person's own features are then moved from there: often a longer or higher-bridged nose, fuller lips, deeper-set eyes, heavier brows. No feature is pushed toward a type, and no face is left at a default.

**Age.**

- **Adults** get the folds from nose to mouth, a little hollowing under the eyes, and less of a child's fat. Women keep more soft tissue in the face than men.
- **Age** adds MakeHuman's `head-age` shape, bags, hooded lids, a longer nose and larger ears, thinner lips, deeper folds, grey hair and wrinkles (§5).
- **Children** are MakeHuman's child key shapes, with smaller features and small, smooth teeth.

## 4. Expressions

A dialogue line may carry an `expression` ([`src/domain/dialogue.ts`](../../src/domain/dialogue.ts)): `neutral` (the default), `glad`, `worried`, `sad`, `angry`, `surprised` or `afraid`. It is presentation only: which portrait is shown. It never changes the words, the story's rules, Scripture text or any approval.

**Held back, then reworked (2026-09-27).** The first renders of `glad`, `surprised` and `afraid` read badly at dialogue size and were held back (`HELD_BACK_EXPRESSIONS` in [`portrait-cast.ts`](../../src/content/portrait-cast.ts)), their lines showing the neutral portrait, until they were reworked (§8, steps 15-19). All seven now ship. The set is kept, empty, for any expression that needs rework later: list it, run `npm run art:portrait-data`, and its lines show neutral; take it out again and render with `node scripts/art-build.mjs portraits --missing`.

**Annotation.** 205 lines across the four chapters carry one, marked only where the feeling is clear from the words and the scene:

| Expression | Lines |
|---|---|
| glad | 107 |
| worried | 43 |
| surprised | 26 |
| sad | 17 |
| afraid | 9 |
| angry | 5 |

For example:

- Ezer's "Cheated! I paid for four measures of oil…" is angry.
- Menashe's lines on the road, robbed and injured, are worried or afraid.
- The crew in the storm are afraid.
- The homecoming is glad.

Scripture and paraphrase lines stay neutral unless the speaker's own feeling is plain.

**Which portraits are rendered.** The portrait data ([`scripts/export-portrait-data.ts`](../../scripts/export-portrait-data.ts)) lists each speaker's expressions. `npm run art:portraits` renders their neutral portrait and those expressions only: 84 expression portraits for 39 people.

**Authored mixes.** Each expression is a mix of MakeHuman's expression units and, where a muscle action alone looked wrong, its modelling targets (the corners of the mouth, the cheeks, the lips), authored here (`EXPRESSION_UNITS` and `CHILD_MIXES` in [`portrait_face.py`](../../tools/art/lib/portrait_face.py)). Each was judged at the 104 and 160 px the game shows, next to the same person's neutral portrait:

- **glad:** a warm, closed-lip smile. The cheeks rise and push the lower lids up into a slight squint, with crow's feet; the corners of the mouth lift up (MakeHuman's `mouth-angles-up`) more than they are pulled sideways; the folds from nose to mouth deepen. A child's mouth widens a little more, the cheeks fill only a little, and the full lower lip is thinned, with its outer ends raised to meet the corners (§8, step 19). How far a smile narrows the eyes is a person's own trait (`smile_squint` in `CASTING`, 1 by default): Elazar's hooded eyes (0.45) and Kallias's (0.4) closed to a slit that hid the iris, which the gaze check caught.
- **worried:** the inner brows raised and drawn together, the lips pressed, the corners down a little.
- **sad:** the inner brows raised, the lids heavy, the corners of the mouth pulled down, the chin raised a little; the eyes look down.
- **angry:** the brows hard down and knit, the lids narrowed with the lower lids tense, the nostrils flared and the nose wrinkled, the upper lip raised off the teeth, the mouth open, the neck tight. (A child's is a frown and a pout.)
- **surprised:** the brows high with lines across the forehead, the upper lids only a little raised, the jaw dropped a little, and a longer, relaxed upper lip in a soft oval that hides most of the teeth.
- **afraid:** carried by the brows and eyes (a beard hides the mouth): the inner brows pulled up hard and drawn together, the middle of the forehead bunched, a sliver of white above the iris, the lower lids tense, the lips stretched sideways and barely apart, the neck taut. A child's is closer to tears: the brows drawn up harder, and the mouth's corners pulled down with the lips a little apart.

Each person's expression is a little asymmetric: one side at most 4% stronger (less for children).

**Neutral** is a relaxed face, not a smile. The casting table's resting mood only tints it: a warm person's mouth corners a shade up, a stern person's brows a shade down, a tired person's lids a little heavy.

**What stays and what moves.** Everything that must not change from one expression to another is made on the person's rest shape:

- the skin maps and freckles;
- where hairs grow;
- the clothes;
- the skin-colour correction.

The posed shape carries the skin and everything rooted in it: brows, lashes, beard, lids, lips, teeth and tongue.

Where the expression compresses the skin (measured edge by edge against the rest shape), the wrinkles of that region deepen: the forehead in surprise, between the brows in anger, crow's feet in a smile.

## 5. Skin, eyes and teeth

**Skin.** [`portrait_mhskin.py`](../../tools/art/lib/portrait_mhskin.py) writes regional maps per vertex; the shader adds what is too fine for vertices. Every pattern is drawn on the rest position, so it stays on the skin in every expression.

- **Colour:**
  - the person's colour, warmer where blood is near the surface (cheeks, nose, ears, chin, inner corners);
  - a little violet and darker under the eyes, pinker on the lids;
  - the lips darker at the border;
  - a grey-blue beard shadow or a shaved beard's dots;
  - sun-darkening and redness on the planes that face the sun, freckles and sun spots for outdoor workers;
  - moles and old scars;
  - the inside of the mouth, the nostrils and ear canals dark (found by occlusion);
  - mottling in brightness and hue at three scales (redder and more olive patches).
- **Relief (as bump):**
  - pores at two scales, deeper on the nose and cheeks;
  - the criss-cross grain of skin and fine lines;
  - lip lines;
  - stubble and scars;
  - four families of wrinkles (forehead, between the brows, crow's feet, under the eyes), as deep as age and sun allow and the expression bunches the skin.
- **Finish:**
  - an oily coat on the T-zone whose sheen is broken up by pores and noise, drier cheeks;
  - lips a little smoother, the inside of the mouth wet;
  - a faint vellus sheen.
- **Scattering:**
  - random-walk subsurface with skin's measured mean free paths (red about three times green, five times blue);
  - shorter in darker skin, where melanin absorbs near the surface;
  - weaker in thin tissue (the lid rims, nostrils, mouth) so it doesn't glow.

**Eyes.** The eyeball is fitted to the lid margins (§2).

- The iris is sized to the opening, recessed under a clear refracting cornea with a smooth surface, so each eye carries a crisp catchlight from the key light.
- The sclera is warm and a little greyer toward the corners, with faint vessels.
- A wet meniscus runs along the lower lid.
- The pink inner corner is the skin's own geometry.
- **Both eyes aim at one point** (the camera, or a few degrees from it for sadness or worry), so they converge. One shared tilt sets the pupils a little above the middle of the openings, as in a relaxed gaze.

**Teeth.** [`portrait_teeth.py`](../../tools/art/lib/portrait_teeth.py) builds each crown:

- chisel-edged incisors, pointed canines, cusped premolars and molars;
- each a few percent wider or narrower, longer or shorter, turned and set a fraction differently;
- ivory enamel, a shade different tooth to tooth and more yellow with age, a little translucent;
- the gums over their necks.

They follow the arch MakeHuman's dental block traces, and the lower arch moves rigidly (the best-fitting rotation of its block) with the jaw.

**The mouth's lining** is the skin that can't be seen from outside the head at rest (found by occlusion with a long reach): the insides of the lips, cheeks and palate. It is coloured and finished as the inside of a mouth: dark, red, wet.

**Nothing pokes through.** Expressions move the lips and cheeks but not the upper teeth, so a fear or a wide smile can draw the corners of the mouth in past the back teeth and gums. Every point of the teeth, gums and tongue that is out of the flesh and nearest to the outer skin (not the lining) is drawn back under the skin. A front tooth seen between parted lips stays where it is.

## 6. What every render checks

Every render measures itself. The measurements go into [`tools/art/data/portrait-checks.json`](../../tools/art/data/portrait-checks.json), and [`tests/content/portraits.test.ts`](../../tests/content/portraits.test.ts) enforces them for every portrait and expression.

- **Skin colour.**
  - Before the final render, a quick one (192 px) measures the face's skin: a holdout mask keeps only the visible skin between the brows and the chin, and the middle and lit tones (the 40th to 80th percentiles of brightness) are averaged.
  - The skin's albedo is scaled in linear light until that colour matches the person's `Appearance.skin` (as the game shows it).
  - The final render is measured again. The test requires a CIE76 ΔE under 4 (under about 2 is hard to see).
  - Every expression reuses its neutral portrait's correction, so a person's skin never changes between lines.
- **Gaze.** For each eye:
  - how far its line of sight passes beside the camera (`yaw`);
  - how far apart the two lines of sight pass (`miss`, under 5 mm);
  - where the pupil sits across the opening and down it.

  The test requires the eyes to converge, and each pupil in its opening: not pressed into a corner, not hidden under a lid.

## 7. Light, lens and finish

Portraits use **short lighting**, as painted portraits do:

- The camera stands 24° round to the person's right, so they face screen right (toward the dialogue text). Each person sits a little differently: a few degrees more or less round, a little higher or lower, the head tilted a degree or two.
- The head turns half of that toward the camera on the neck (the shoulders stay three-quarter on, the neck eases between), so the eyes meet the camera without straining to the side.
- A soft, warm key light comes from the side they turn toward, about 42° round and 30° up. The near cheek falls into soft shadow, with a triangle of light under the eye.
- A dim, cooler fill, like light from the open sky, comes from the camera's side. Warm key and cool fill give shadows the colour they have in daylight.
- A warm rim light from behind the shadow side separates hair and shoulders from the background.
- The lens is 85 mm at f/3.2, focused on the near eye.
- The background is an out-of-focus limestone wall, a little dimmer than in earlier passes, with a gentle lens vignette. After the headwear, the face is the brightest thing in the picture at the sizes the game shows it.

**Photographic, not painterly** (§12.3): an anisotropic Kuwahara pass was judged twice on the earlier heads and rejected both times. At game sizes it only smeared hair and softened the eyes. The MakeHuman pass keeps the photographic finish; the painterly option was retired.

## 8. The MakeHuman pass: iteration log

What was tried, what it looked like, and what changed. Each step was judged at 512 px and at the sizes the game shows (104 and 160 px), and the reviewer's notes after each checkpoint were folded in.

1. **The model, bare.** A clay render of the base mesh with a few macro weights already read as a real head: skull, lids, ears, lips. This was never achieved by the signed-distance heads.
2. **Expression units.** Each unit rendered alone in clay showed that they work on the current base mesh: a smile (corner-puller), an open jaw that also moves the lower dental block, brows down, inner brows up, lower lip down, lids closed or widened. They became the vocabulary of the expressions.
3. **Checkpoint 1** (Ezer, Ezer angry, the Chapter 3 Tamar, Old Shimon, a player look, Hadassah).
   - A clear step up for the men.
   - The women too alike, too young and pale, with the same closed-mouth smile; brows like fuzzy strips set high.
   - Ezer's anger read as talking at 104 px.
   - Tamar's eyes looked to the side.
   - Skin a little orange and waxy.
4. **Skin colour.** Measured against each person's colour in the game, the women rendered paler and pinker. The calibration render (§6) now lands every face within ΔE 2 of the game's colour, darker skins included.
5. **Casting by type.** The random spread alone let two women share a face. Faces, noses, eyes and lips are now cast by type for everyone, and the spread within each type is wider. Adults got folds, hollows and less fat. Women first came out gaunt and severe (a long face and a strong jaw at full strength read as a man's), so women keep more soft tissue and their types act more softly.
6. **Neutral is relaxed.** A resting smile read as uncanny, so the mood only tints neutral now.
7. **The eyes, three times.**
   - MakeHuman's socket sphere is larger than an eye and sits high. An eyeball there put the pupils high and off to the side.
   - A lid margin taken from the lash helper was wrong at the inner corner.
   - Finding the margins on the skin and fitting the eyeball to them fixed both.
   - Each eye aimed through the middle of its own opening left the lines of sight 5° apart. Both now aim at one point, and a test checks it.
8. **The head turns to the camera** on the neck, part of the way: the eyes had strained sideways at a three-quarter view.
9. **Brows.**
   - The brow skin moves with expressions, and its middle sat too high, so the brows looked surprised. The brow line is now drawn from the upper lid: a soft arch, level at the inner end (a brow rising toward the nose read as worry), dropping a little at the tail.
   - The hairs lie flat, with fuller density.
   - The brow angle modifier's "down" end scowled; the resting angle is kept level.
10. **Anger that reads at 104 px:**
    - brows fully down and knit;
    - lids narrowed and tense;
    - nostrils flared;
    - the upper lip raised off the teeth;
    - the jaw open;
    - the neck tight;
    - teeth ivory and uneven.
11. **Separation at small sizes.** The faces receded against a bright wall. The wall is dimmer and vignetted, the rim light brighter, and the cornea smoother for a crisp catchlight.
12. **A beard's edge** had been a hard line on the cheek (a pasted patch at 104 px). It now wanders and thins out over a centimetre and a half.
13. **Teeth through the corners of the mouth.** In the full render, fear and wide smiles showed red blobs at the corners of the mouth: the gums and back teeth poking through stretched skin. Found by measuring, for every person and expression, how many points of the teeth lie outside the face.
    - A first test (anything out of the flesh, or anything half-enclosed) caught every visible front tooth.
    - The second decides by the nearest skin: the outer skin or the mouth's lining.
    - Those points are now tucked under the skin, and the mouth's lining is coloured as a mouth.
14. **The neck and cloth.** The tunic had wrapped the underside of the jaw (a dark band); it now stops at the neckline. Veils fell in many even pleats, like a lampshade; they now have a few broad folds and irregular bunching where they rest on the head.
15. **Glad, surprised and afraid held back.** Reviewed in the game at 104 and 160 px, most smiles were a strained, crooked grin (a thin strip of upper teeth in a tight lip line, corners pulled sideways, cold eyes); Aunt Miriam's greeting, the first face a player sees, looked leering. The open mouths of surprise and fear looked like dentures, and eyes wide with white all round read as manic. They were held back while worried, sad and angry shipped.
16. **A real smile.** The expression units only pull the corners of the mouth sideways and part the lips. The smile now lifts the corners with MakeHuman's own mouth-corner modelling target, raises and fills the cheeks, and narrows the eyes from below (the cheeks pushing the lower lids up), with the lips closed. Every lip-parting variant tried still showed a strip of teeth at 104 px, so none ships.
17. **The dentures.** Two causes: MakeHuman's dental block sits 4-5 mm behind the lips, so the teeth stood in a dark cave; and the lower teeth stood tall in an open mouth. The arch is now brought forward until the front teeth rest against the inside of the lips, the lower teeth sit 2 mm lower (a relaxed lower lip covers them), and the enamel is a shade darker. Surprise drops the jaw less, with a longer, relaxed upper lip; fear barely parts the lips.
18. **Fear through the eyes.** Under a beard, the first reworked fear read only as anxious. The inner brows now pull up harder and together, the upper lids show a sliver of white, and the lower lids tense.
19. **Children, three-quarter on.** The children's smiles (Natan, Ami) read as a crooked smirk although the mix is symmetric to within 2%: rendered from the front the smile was even. Seen three-quarter on, the outer end of a child's full lower lip hung below the corner nearer the camera and made a downward hook, while the far corner's lift showed against the cheek. Tilting the mouth to compensate did nothing visible. Thinning the lower lip, lowering its height and raising its outer ends to meet the corners (MakeHuman's lower-lip `ext-down` target, which raises them, not `ext-up`, which lowers them), with less cheek fill (fuller, the cheeks puffed out), took most of the hook away. A frightened child with the grown-ups' lips stretched sideways looked like the same crooked grin, so a child's fear pulls the corners down instead.

## 9. Hair and cloth

**Hair** grows in locks.

- A few thousand guide strands carry the wave or curl, and every other strand follows its nearest guide, drawn toward it at the tip.
- Strands follow a direction field (away from the crown and down; down the face for beards; outward along the brow), bend under gravity, and are kept on the skin by its distance field.
- Where hair grows is decided on the rest shape:
  - the hairline, in angles round the skull, less what a head covering hides;
  - the brow line (§8.9);
  - the beard's region: cheeks below a wandering line from the sideburn to the corner of the mouth, the jaw, chin, upper lip and throat.
- Strands never pass through cloth, and scalp hair never falls over the eyes.
- Beards are longest at the chin. Elders have long grey beards; grey hair is a mix of white and pigmented strands.
- Lashes leave the front edge of each lid margin and curl.

**Cloth** is a set of shells laid over the body's distance field, with folds and real, hemmed edges:

- The tunic has a hemmed neckline just above the notch between the collarbones, and woven stripes.
- Elders wear an undyed mantle.
- Veils and scarves fall from the crown in a few broad folds, over the head with its ears laid flat.
- Men's head cloths are held on by a twisted cord.
- The **wrap** is wound in seven overlapping turns, each lying on the ones before it, with pleats along it and a rolled edge. Its end hangs from behind one ear onto the shoulder, and its weave follows the turns.

## 10. In the game

- **Lookup.** [`portraitImage(appearance, characterId, expression)`](../../src/features/portraits/portrait-art.ts) computes the appearance key and returns, in order of preference:
  1. the speaker's own portrait, if it was rendered from this appearance;
  2. otherwise any portrait rendered from the same appearance (that is how players are found);
  3. otherwise nothing.

  It gives the expression asked for if that expression was rendered for the person, and the neutral portrait otherwise. A portrait is never shown for an appearance it wasn't rendered from.
- **A change of face.** When the same person's next line carries a different expression, the dialogue box lays the previous face over the new one and fades it out (220 ms). With reduced motion the new face simply replaces the old.
- **Loading.** The image has a fixed `width` and `height` and a warm limestone background, so the layout never shifts. If it fails to load, the drawing is shown.
- **Preloading.** When a chapter starts, everyone's neutral portrait is loaded and decoded. When a conversation opens, every face its lines will need is loaded too.
- **Accessibility.** Portraits are decorative (`alt=""`, `aria-hidden`); names are always text. The cross-fade image is also hidden from assistive technology.
- **Sizes.** `srcset` offers 128, 256 and 512 px. The dialogue portrait is:
  - **152 px** on wide, tall screens (at least 1100 × 720);
  - 104 px otherwise;
  - 72 px with large text;
  - 60 px on phones.

  `sizes` tells the browser which it is, so a 152 px portrait at 2× or 3× density fetches the 512 px file. The look picker shows 72 px, profile cards 64 px and chapter select 56 px. URLs start at `import.meta.env.BASE_URL`, so a sub-path deployment (GitHub Pages `/witness/`) works.
- **Offline.** Neutral portraits are precached with the rest of the art: 43 people, 129 files, 2.03 MB. That is 128 px about 4.2 KB each, 256 px about 11.2 KB, and 512 px about 30.8 KB (the largest 46 KB). The 84 expression portraits (252 files, 3.97 MB) live in one folder per expression and are cached the first time a conversation that needs them opens ([`src/app/art-cache.ts`](../../src/app/art-cache.ts), [`vite.config.ts`](../../vite.config.ts)); offline before that, the neutral portrait stands in for them. WebP quality is 92 for the 512 px master (lower smoothed away pores and skin grain).
- **Why the manifest is bundled.** Code in `src/` makes no network requests (an architecture rule), and Vite does not let code import JSON from `public/`, so the manifest lives next to the code that reads it.

## 11. Adding people and expressions

1. Give the new character an `appearance` in the chapter content, and a casting entry (age, sex if needed, sun, mood, face, nose, eye and lip types) in `CASTING`.
2. Mark lines where the feeling is clear: `say('id', 'speaker', 'text', { expression: 'glad' })`. Never change the words for it.
3. `npm run art:portrait-data`: exports everyone who speaks, their expressions and the player looks to `tools/art/data/portrait-people.json`.
4. `npm run art:fetch-makehuman`, once per machine.
5. Render:
   - `npm run art:portraits -- --missing` renders only what is missing or out of date: every person in every expression they need, two at a time (`--jobs 3` for three).
   - `--who <id> --expression angry` renders just one.
   - A Blender that crashes (Metal can, now and then) is run again.
6. `npm run art:portrait-sheets` redraws the review sheets.
7. `npx vitest run tests/content/portraits.test.ts` checks:
   - that the portrait data is in step with every chapter;
   - that everyone has a portrait of how they look now, and every expression their lines use, in every size;
   - that nothing stray ships and every file has provenance;
   - that every face matches the person's colour, and the eyes converge;
   - that sizes stay within budget.

**Review options for `build_portraits.py`:**

- `--size 384 --samples 48 --review <dir> --no-manifest` renders quickly and writes PNGs, a contact sheet, and close-ups of the eyes and mouth to `<dir>`, without touching what ships.
- `--clay` renders grey clay to judge shape.
- `--turn 0` renders from the front.
- `--aim X Y Z --frame CM` frames a close-up.
- `--device cpu` renders on the CPU.
- `PORTRAIT_SKIP=hair,clothes` leaves out hair or clothes.
- `PORTRAIT_MASK=beard|brow|scalp|lips|cav|mouth` paints a mask on the skin.

## 12. Earlier passes: heads sculpted in code

Before the MakeHuman pass, three passes built the heads in code as signed distance fields: a relief of anatomical cross-sections, solid features and lid shells, meshed with OpenVDB. The first two shipped; the third was stopped (branch `fix/portraits-v3`; its hair, beard, veil and wrap work was carried into the MakeHuman pass). Their logs are kept here as history. The modules they describe (`portrait_head.py`, `portrait_skin.py`) were removed; they are in git history before this pass.

### 12.1 The head, as it was built

A head is sculpted in three layers:

1. **A relief round a vertical axis.** Each height has a cross-section taken from anatomical tables: the depth of the midline (the forehead, glabella, nasion, the base under the nose, lips, the groove above the chin, the chin), the half-width, how square the front is, and how far back the skull goes. The tables are adult averages (head height about 23 cm, pupils 6.3 cm apart, the cornea about 1 cm behind the bridge of the nose), moved by the person's parameters. They are smoothed so the skin shows no banding. On top, soft bumps and dents give:
   - the brow ridge, eye sockets and the fold above each lid crease;
   - cheekbones and the hollow under them, temples, cheeks and jowls;
   - the lips (profiles that roll out from the mouth line and carry on as the skin up to the nose);
   - the philtrum, the mouth line and its corners, the folds from nose to mouth, and the chin.

   A plane through the chin and the angles of the jaw cuts a clean jawline. An ellipsoid closes the dome of the skull.
2. **Solid features.** The bridge of the nose is part of the relief (second pass): a ridge from the root of the nose to above the tip, with a rounded or flat top and sloping sides that ease into the cheeks, leaning a little for some people. The tip lobule and columella, and wings that join the face with a crease, are solids blended onto it. The nostrils open underneath. Noses come in broad types (straight, aquiline with a hump and a drooping tip, convex, broad with wide wings, snub, bulbous) and then vary continuously in length, bridge height and width, hump, tip rotation and width, and the width and flare of the wings. The ears have a helix, antihelix, concha, tragus and lobe; the neck has sternocleidomastoids and, for men, a larynx.
3. **Lids.** A shell of skin over each eyeball, blended into the socket, with the opening between the lids carved out along anatomical lid curves (the upper lid highest toward the nose, the lower lowest toward the temple). A fine crease runs above the upper lid, and the relief adds the soft fold of skin above it, heavier toward the temple for hooded eyes, with age and with weariness.

**Expression.** Every face carries a small expression for its part (§4), built into the same relief:

- a smile lifts the corners of the mouth and draws them back, rounds and lifts the cheeks above deeper folds, and (in the eyes) pushes the lower lids up with a soft roll beneath them and crow's feet; a smile can be lopsided;
- worry or pain lifts the inner ends of the brows (and the inner upper lids), with lines across the middle of the forehead; a frown draws them down, with lines between them;
- lids can hang heavy (weariness) or squint from below (sun, suspicion); lips can press together, with the chin bunching below; corners can turn down; the eyes can look a few degrees away.

**Asymmetry.** Each side has its own small offsets: eye height and opening, brow height, the corner of the mouth, the cheek, the jaw, the ears. The nose can lean a little. The offsets are kept small (a millimetre or so), and a child's face is nearly symmetric: more reads as a deformity, not as natural variation.

### 12.2 First pass: iteration log

What was tried, what it looked like, and what changed. Review renders were judged at full size and at the sizes the game shows (128–256 px).

1. **Heads from blended primitives** (ellipsoids and capsules, smooth union). The first clay renders read as a head, but:
   - the eye sockets were carved deep, so the eyes looked like a skull's;
   - the muzzle was a blob and the lips a ledge;
   - the chin was too far back, as if the upper jaw overhung it.

   Tuning the blobs helped less each time.
2. **Switched the face to a relief of anatomical cross-sections** (§2). The profile, lips and chin became human at once. The smooth profile curves first showed faint banding, fixed by smoothing the tables so their curvature is continuous. The top of the head closed badly (a spike, then, when offset for cloth, a flat shelf above covered heads), fixed by closing the skull with an ellipsoid dome.
3. **Meshing.**
   - Vertex projection diverged at the edge of the sampled box, throwing vertices kilometres away and dragging long streaks across the frame. Steps are now clamped, and vertices without a usable gradient are skipped.
   - Folds steepened the cloth's field until thin shells were missed between samples (holes in veils and tunics). The sampled band is now wider, shells are thicker, and garments are meshed finer.
4. **First lit render.**
   - The eyes (iris, cornea, catchlight) already read as real.
   - Skin came out pale, pink and then orange. Measured against the data colour (#9c714e), the lit cheek sampled #bf6f35. Exposure was too high, a warm wall and key compounded, and a red-heavy subsurface radius made it worse. Lights and radius were neutralised, and the albedo is slightly desaturated so subsurface scattering lands on the data colour.
5. **Hair.**
   - Hair changed the read from mannequin to person more than anything else. The first grooms were steel wool (tight large curls), then spiky fur (strong tip clumping with little curl).
   - Moderate waves with light clumping read as hair.
   - Beards started under the eyes (the cheek line was fixed), then were a uniform block with a straight hem (now longest at the chin, shorter up the cheeks and at the sides).
   - Long hair under a veil fell over the face. It now sweeps back under the cloth, strands end where they would pass into cloth, and nothing crosses the face below the brows.
6. **Everyone looked like the same person.** The random spread was widened. Women got their own bone structure (nose, jaw, chin, brow, lips, cheeks), and age got shape as well as wrinkles: hooding, bags, hollows, jowls.
7. **Eyes, close up.**
   - The upper lid covered half the iris (sleepy); it now covers 1–2 mm.
   - The lashes fanned up like brushes; they now leave the lid edge nearly level and curl.
   - The eye had no definition at small sizes, fixed by darkening the lash line in the skin.
   - Two attempts to confine the lid skin to the lids (a windowed shell, then draping the relief over the eyeball) made goggles and exposed the eyeball at the outer corner. Both were reverted in favour of the blended lid shell with a stronger crease.
8. **Lighting.** Broad lighting (key on the camera's side) flattened faces, and people faced away from the dialogue text. Short lighting from the side they turn toward (§1) carved the forms and made Aunt Miriam, at 54, read as a real older woman.
9. **Head coverings.**
   - The first veils were stiff hoods. A scarf wound under the chin looked like a balaclava. The first turban looked like a pleated lampshade.
   - Now veils and scarves fall from the crown to the shoulders, with the face opening cut as an angle round the head so the hem follows the cloth. They rest on the head without its ears (a boxy bump where the ears poked through). The wrap is wound turns over a domed crown with a rolled hem.
10. **Colour of darker skin.** Darker faces came out too dark and saturated (Malik's lit forehead sampled (94, 48, 21) against the data colour (118, 75, 50)), and their shadow side went black. Subsurface scattering is now weaker, and the albedo a little greyer, the darker the skin (melanin absorbs near the surface). The fill light is stronger and the exposure a little higher.
11. **Everyone stared.** Bright whites, light irises and a wide aperture made every face wide-eyed. The sclera and iris highlights are darker, the lids a little lower, and the wall behind dimmer, so the faces carry the picture.
12. **Children.**
    - They wore helmets of hair (long curls cut straight at the brow) on long necks, and read as shrunken adults.
    - Their hair is now shorter and closer, swept back and aside at the front, with no hard parting.
    - Their necks and bodies are shorter, and they are framed a little closer.
    - The nose is shortened once, not twice. The double shortening had put the mid-face rows out of order and drawn a ridge across the cheeks, like face paint.
13. **Casting.** Aunt Miriam was drawn at 29, but her knees "can't manage that road anymore": a small casting table now gives the few ages the story implies.
14. **The mouth, and a bug hiding in plain sight.**
    - Mouths kept reading as a slit with a pale ledge, and close-ups showed a thin fin along the mouth line.
    - Tracing the field through the mouth showed the lips 1.5 cm behind where the tables put them: the ellipsoid that closes the top of the skull (step 2) was also trimming the whole lower face. It now acts only above the forehead.
    - The lips also now meet already full, with a common thickness where they touch, so only a soft crease runs between them. Every mouth and chin became fuller and more natural at once.
15. **Finish.** Photographic chosen over painterly (§5).

### 12.3 Photoreal or painterly

**Chosen: photographic** (in both passes). The brief allowed a painterly finish if photographic faces still looked uncanny or plastic. Both were judged side by side on the same renders: [finish comparison](portraits/finish-comparison.webp) (top row photographic; below, Blender's anisotropic Kuwahara filter at sizes 3 and 6).

- At the sizes the game shows (104 px and smaller at 2× density), the painterly pass changes very little. What it does change is for the worse: hair strands smear into streaks, and the catchlights and lash lines that make the eyes read soften.
- At full size it reads as airbrushed digital painting rather than oil. It hides some CG smoothness in the skin, but it also removes the pores, stubble and fibre detail that make the photographic version read as real.
- With short lighting, a dim, warm, out-of-focus wall and subsurface skin, the photographic render already has the warmth and restraint of a painted portrait. It sits well on the parchment interface.

The painterly pass stays in the pipeline as an option (`--finish paint`) for art direction to revisit.

**Second pass, judged again.** The second pass was allowed a painterly finish if it now helped. It was tried on the final renders of Hadassah and Malik ([finish-comparison-v2.webp](portraits/finish-comparison-v2.webp): photographic, then Kuwahara sizes 3 and 6). Size 3 barely changes anything at the sizes the game shows; size 6 smooths the new pores, skin grain, stubble and lip lines, the very things that stopped the faces reading as plastic, and turns beard curls into streaks. The photographic finish stays.

### 12.4 Second pass: from sculpture to person

The first pass read as a set of well-lit CG sculptures: hair, beards and light were good, but faces shared one nose, one thin mouth, one jaw and one stare; skin was plastic; eyes were glassy; faces were blank; turbans were puffy caps; children had adult faces. The second pass took each point in turn, judging probes by eye at 512, 256 and 128 px (and at the game's 104 px), in clay from the front for shape, and in close-ups of the eyes and mouth.

What changed, by the critique's points:

1. **Sameness.** Casting for everyone (§4), broad face, nose, eye and lip types moved continuously, and per-side asymmetry (§2). Wider noses and wings are common; some are aquiline with a hump, some snub, some bulbous; lips run from thin to very full with a Cupid's bow; jaws, chins (some cleft), cheekbones, brow ridges, eye depth, hooding and ear size all vary.
2. **Skin.** Pores and skin grain are rendered at 1024 px and reduced, so they survive as texture at 512 and 256 px; the oily T-zone has a broken-up sheen and the cheeks are drier; sun darkens, reddens and spots outdoor workers and deepens their lines; under-eye shadow and bags come with age; clean-shaven men have stubble dots and shadow; moles and old scars on some people; lips are smoother, wetter and darker at the edge; noses, ears and cheeks are warmer (§1).
3. **Eyes.** Longer, lower openings with the upper lid over the top of the iris and a lower lid line; wet pink-grey rims; a warm sclera; dark-brown irises with crypts (a few hazel or amber); smaller pupils; a softer catchlight; the caruncle; denser, finer lashes.
4. **Expression.** A mood for every part (§4), from Hadassah's warm smile and crow's feet to Menashe's pained brows and heavy lids, built into the face (§2).
5. **Head coverings.** Wound wraps (§2a); veils with deep folds and a soft turned hem; men's head cloths with a cord; children's scarves draped like adults'.
6. **Children.** Child proportions throughout (§2), baby hair, smooth skin.
7. **Neck and shoulders.** Collarbones and the notch between them, a hemmed neckline with a slit, the tail of a wrap on the neck.

#### Second-pass log

1. **Clay first.** Clay renders from the portrait angle and from the front showed the shape problems the lighting had hidden: faces were flat masks (the cross-sections were nearly square at eye and cheek height, so eyes sat in a plane); the bridge of the nose was a narrow tube whose steep sides cast a hard line down each cheek; the eye openings were too short, with the inner corners too far apart, so eyes looked round and staring.
2. **The nose as relief.** Building the bridge into the relief, with sloping sides that ease into the cheeks, removed the hard line at once and let broad, low and humped bridges look natural.
3. **The upper lip faced up.** Its most forward point was mid-way up the red, so the top of the lip faced the light and read as a pale ledge. The forward point is now near the border and the red faces down; the lower lip still catches the light.
4. **A fold of skin made of spheres.** Hooding built from a chain of spheres read as a caterpillar, and a single ellipsoid as a sausage stuck on the lid. The fold is now a soft bump in the relief itself.
5. **Stronger expressions.** The first smiles, brow lifts and lid droops were too small to read at 104 px; the amounts were roughly doubled, still within a quiet, dignified range.
6. **Lighting that looks photographed.** A smaller warm key and a cooler, dimmer fill (and surroundings cool above, warm below) turned waxy faces into photographed ones more than any skin change did; the fill was raised again a little so the eye sockets don't fall into shadow.
7. **Lumps.** Random surface irregularity made faces look like clay with fingerprints; it is now a fraction of a millimetre, and structure comes from anatomy (fat pads, folds, wrinkles) instead.
8. **The wrap.** Turns as a stack of cloth, each lying on the ones before, read as wound cloth immediately. Thin edges read as string; edges are now rolled and stand proud. The tail first hung free and, seen edge-on, read as a stick; it now lies on the neck and shoulder.
9. **Men in veils.** A male shepherd in a woman's veil read as a woman; hence the head cloth with a cord. A child's scarf was tried as a kerchief tied at the nape, but read as a fitted cap with a seam; it drapes like an adult's instead (step 15).
10. **Children's foreheads were sliced.** The relief tables were in centimetres while the dome of the skull scaled with the head, so on a child's smaller head the dome cut the forehead flat. The tables now scale too.
11. **Children's lips looked made up** (a light rim over a dark edge); both are nearly gone on children.
12. **Women looked like men in veils.** Heavy straight brows, long noses and faces, gaunt temples and a veil that hid the cheeks. Finer brows, shorter and smaller noses, shorter lower faces, softer jaws, fuller cheeks, a wider face opening in the veil, and hair showing at the front.
13. **Holes in veils again.** Deeper folds steepened the field until the shell fell between samples; the shell is thicker and meshed finer.
15. **Lead review.** Natan's asymmetry was overdone (a skewed nose and a lopsided mouth read as a deformity): offsets are halved for adults and nearly gone for children. Player look-2's kerchief read as a bonnet: it now drapes. Eyes still read a little glassy: the upper lid sits about 2° lower, over the top of the iris, and the cornea is a little rougher and the key a little larger, so the catchlight is soft. Skin still read a little plastic at 256 px: roughness varies more (two scales), pores and grain are deeper, and darker skin scatters less far, so its form reads from shading rather than glow.
14. **A shared GPU.** Another agent rendered places at the same time; the GPU ran out of memory mid-render (and once returned a black picture). The build now retries, then renders on the CPU, and checks for black pictures.

<!-- ITERATION-LOG -->
