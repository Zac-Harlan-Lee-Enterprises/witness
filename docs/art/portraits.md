# Portraits: rendered heads and shoulders

The dialogue box, the profile look picker and chapter select show a portrait of whoever is speaking or playing. They used to be small SVG drawings (a round head, dot eyes, an ink outline), which read as cartoons next to the pre-rendered world. They are now **rendered portraits**: realistic, lit heads and shoulders of everyone who speaks in any chapter and of every player look, made offline by Blender from each person's appearance data and a casting table.

The **second pass** (§9) set out to make them read as people rather than CG sculptures: much more varied anatomy and small asymmetries, skin with pores, grain, oil, sun damage, marks and stubble, less glassy eyes, a quiet expression that fits each part, wound turbans, child faces for children, and Chapters 2–4.

- **Where they come from:** [`tools/art/build_portraits.py`](../../tools/art/build_portraits.py) and `tools/art/lib/portrait_*.py`, reading [`tools/art/data/portrait-people.json`](../../tools/art/data/portrait-people.json) (`npm run art:portrait-data`). Run `npm run art:portraits` (Blender 5.2+; about two minutes a person on an M3 Pro: roughly a minute to build the person, then Cycles at 1024 px and 160 samples, denoised and reduced to 512).
- **Who gets one:** [`src/content/portrait-cast.ts`](../../src/content/portrait-cast.ts): every character who speaks a line, in every chapter. Biblical figures never get one (they are never shown in close-up), and characters who never speak don't need one. A later chapter's character who shares an id with an earlier one (Tamar, Kallias) is rendered as `<id>.<chapter id>`.
- **What ships:** `public/art/portraits/<id>-512.webp` (the master), `-256.webp` and `-128.webp`, and the manifest [`src/features/portraits/portrait-manifest.json`](../../src/features/portraits/portrait-manifest.json) (`id` → the appearance key it was rendered from).
- **What the game does:** [`Portrait`](../../src/features/common/Portrait.tsx) shows the rendered image when there is one for how the person looks now, and the original SVG drawing otherwise.
- **Honesty about tools:** everything is made by code in this repository. No image, texture, model, HDRI or photograph was downloaded, and no image-generation model was used. Provenance is in the [asset manifest](asset-manifest.json).

**Pictures** (in [`portraits/`](portraits/)):

- [before-after.webp](portraits/before-after.webp) — the game before (left, the drawn portraits) and after (right): Aunt Miriam and Hadassah in conversation, and the look picker. [before-after-phone.webp](portraits/before-after-phone.webp) — the same conversation on a phone.
- [contact-sheet.webp](portraits/contact-sheet.webp) — everyone, as rendered: Chapter 1's twelve characters, then the four player looks.
- [finish-comparison.webp](portraits/finish-comparison.webp) and [finish-comparison-full.webp](portraits/finish-comparison-full.webp) — photographic against painterly (§5).

Recreate the chapter sheets with `npm run art:portrait-sheets` (and the first-pass comparison with `-- --compare 640002b`). Recreate the in-game pair with `E2E_SHOTS=1 npx playwright test e2e/portrait-art.spec.ts --project=desktop-chromium` (the `before` set blocks the portrait images, so the game falls back to the drawings).

## 1. How a portrait is made

One Blender run per person ([`portrait_person.build`](../../tools/art/lib/portrait_person.py)). Every step is deterministic: the same id and appearance always give the same picture.

| Step | Module | What it does |
|---|---|---|
| Who | [`portrait_params.py`](../../tools/art/lib/portrait_params.py) | The casting table (age, sex, sun, mood, scars; §4), then a face: broad types for the face, nose, eyes and lips moved continuously, small per-side asymmetries, the skin's history (sun, oil, freckles, moles, stubble) and a quiet expression. Seeded from the id, within ordinary anatomy. |
| Head | [`portrait_head.py`](../../tools/art/lib/portrait_head.py) | A signed distance field, in centimetres. See §2. |
| Mesh | [`portrait_sdf.py`](../../tools/art/lib/portrait_sdf.py) | The field is sampled finely only near the surface, meshed with OpenVDB (0.75–1 mm voxels), and every vertex is moved onto the exact surface and given its exact normal, so the skin is as smooth as the maths. |
| Skin | [`portrait_skin.py`](../../tools/art/lib/portrait_skin.py), [`portrait_materials.py`](../../tools/art/lib/portrait_materials.py) | Per-vertex maps from the appearance's skin colour: warmer cheeks, nose, ears and inner eye corners; a little violet under the eyes; lips darker at the edge and pinker in the middle; wet pink-grey lid rims; a man's beard shadow or stubble; sun-darkening and redness on the planes that face the sun; moles and scars; where freckles and age spots may be; an oily T-zone; the depth of pores and fine lines. The shader adds mottling in brightness and hue at three scales, freckles, the dots of a shaved beard, pores and the criss-cross grain of skin, lines on the lips, an oily coat whose sheen is broken up, and a faint vellus sheen. Random-walk skin subsurface. |
| Eyes | [`portrait_eyes.py`](../../tools/art/lib/portrait_eyes.py) | An eyeball with a recessed iris (radial fibres, crypts, a ring round the pupil, a dark ring at the edge; mostly dark brown, some hazel or amber), a warm, not white, sclera, a clear refracting cornea with a trace of roughness so the catchlight is soft, a wet line along the lower lid, and the pink caruncle. The eyes look at the viewer, or a few degrees away when the mood calls for it. |
| Clothes | [`portrait_cloth.py`](../../tools/art/lib/portrait_cloth.py) | Cloth shells with folds and real edges: the tunic with a hemmed neckline (and, for men and children, a slit) and woven stripes; an undyed mantle for elders; veils and scarves with deep folds and a turned hem; a man's head cloth held by a twisted cord; a child's kerchief tied at the nape; the wrap wound in overlapping turns (§2a); the band. Sheen is tinted with the dye, so colours don't grey. |
| Hair | [`portrait_hair.py`](../../tools/art/lib/portrait_hair.py) | Blender hair curves with the Principled Hair BSDF (melanin from the appearance's hair colour; grey hair is a mix of white and pigmented strands). See §3. |
| Light and lens | [`portrait_scene.py`](../../tools/art/lib/portrait_scene.py) | An 85 mm lens at f/3.2, focused on the near eye; short lighting (below); surroundings that are cool above and warm below; an out-of-focus limestone wall behind. |
| Finish | [`portrait_finish.py`](../../tools/art/lib/portrait_finish.py) | Rendered at twice the size and reduced (Lanczos) to 512, then to 256 and 128 px with a light sharpen on the small sizes. An optional painterly pass (anisotropic Kuwahara) is available; see §5. |

### Lighting

Portraits use **short lighting**, as painted portraits do:

- The person turns about 22° toward screen right (toward the dialogue text).
- A soft, warm key light comes from the side they turn toward, about 42° round and 30° up. (Second pass: a little smaller than before, so highlights have edges and skin texture shows.)
- The near cheek falls into soft shadow, with a triangle of light under the eye.
- A dim, cooler fill (like light from the open sky) comes from the camera's side, and a warm rim light from behind the shadow side separates hair and shoulders from the wall. Warm key and cool fill give shadows the colour they have in daylight, which is much of what makes a render read as a photograph.

The first version used broad lighting (the key on the camera's side), which flattened every face (see the log).

## 2. The head

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

**Asymmetry.** Each side has its own small offsets: eye height and opening, brow height, the corner of the mouth, the cheek, the jaw, the ears. The nose can lean.

### 2a. The wrap

A wrap is a long cloth wound round the head. It is built as a stack: a thin cap over the hair, then seven turns, first to last, each lying on everything already there. Each turn follows a loop round the head in its own tilted plane, so turns cross over the forehead; it has a rounded profile across its width, a rolled edge that stands a few millimetres proud of the turn below, pleats running along it, and crumples across it. The first turn makes the lower edge, a few centimetres above the brows and low over the back of the head. The end of the cloth hangs from behind one ear onto the neck and shoulder. Each vertex knows which turn it is on and where, so the weave runs along the turns.

**Age** changes the shape as well as the colour:

- hooded lids, bags, hollow temples and cheeks, jowls;
- a longer, wider nose and larger ears;
- thinner lips and deeper folds;
- wrinkles displaced into the surface: forehead lines, crow's feet, lines under the lids and frown lines.

**Children** (second pass: by age, fully at six, mostly at ten, a little in the teens) have a larger, rounder skull for the face, a rounded forehead, a shorter mid- and lower face, a flatter profile, a small nose with a low bridge and a small upturned tip that melts into it, round cheeks with no cheekbones, a soft jaw and small chin, eyes that are large for the face (the eyeball is nearly adult size), less everted lips close to the skin's colour, finer brows and lashes, smooth skin without oil, a thin neck, and fine baby hair along the hairline. **Women** have a finer, shorter nose and chin, a softer, narrower jaw, fuller lips and cheeks, a shorter face below the nose, a smaller brow ridge and less hollow temples, and higher, thinner, arched brows.

## 3. Hair

Hair grows in locks. A few thousand guide strands carry the wave or curl, and every other strand follows its nearest guide, drawn toward it at the tip (clumping). Strands grow from roots scattered on the head mesh. They follow a direction field (away from the crown and down; down the face for beards; outward along the brow), bend under gravity, and are kept on the skin by the head's distance field, with a little volume toward the tips.

- **Where hair grows** is described in angles round the skull: the hairline (forehead, temples receding a little for men, sideburns, above the ears, the nape), less what a head covering hides. The same edges drive the cloth.
- **Strands never pass through cloth** (they end where they would enter a covering), and scalp hair never falls in front of the eyes.
- **Density** is per square centimetre of visible scalp, so a small visible patch doesn't become a dense clump.
- **Beards** are longest at the point of the chin and shorter up the cheeks and at the sides, so they have a natural outline. The moustache is kept short so the mouth shows. Elders have long grey beards.
- **Eyebrows** are short hairs lying on the skin: upward at the inner end, outward along the body, down at the tail, each a little off, sparser toward the tail, with ragged edges; they move with the expression. Women's are finer and more arched; some men's nearly meet; old men's are unruly; a scar leaves a gap.
- **Children** have fine baby hair along the hairline. **Women's** hair shows at the front under a veil, swept back to the temples.
- **Lashes** leave the front edge of the lid margin, then curve up (upper) or down (lower). The margin itself is darkened in the skin, which is what defines an eye at small sizes.

## 4. Who they are

The appearance data has no age or sex. Everyone who speaks is **cast** in `CASTING` ([`portrait_params.py`](../../tools/art/lib/portrait_params.py)) from their part and their lines: an age, a sex where the data would guess wrong, how much of their life is spent in the sun, sometimes an old scar, and a mood. For example:

- Aunt Miriam says her "knees can't manage that road anymore": 54, kind. Hadassah calls the player "dear": a warm weaver of 41 with a smile and crow's feet. Menashe speaks most of his lines robbed and hurt on the road: weary and pained, inner brows lifted, lids heavy.
- Cousin Yonatan is a young shepherd whose scarf would make the data guess a woman: a boy of 16, sun-darkened. Old Hanina has read the lake for sixty years: 76, squinting, weathered. Hagit has lived in Bethlehem "seventy years": 77, full of wonder, looking a little away.
- Ammia, slow to forgive her apprentice, is stern; Kallias the apprentice, ashamed and hungry, is 22 with his eyes lowered; Chrysis, enslaved at the dye works, is guarded.

Moods are small and dignified (`MOODS`): open, kind, warm, gentle, jovial, bright, cheerful, hearty, salesman, cocky, wry, dry, shrewd, stern, firm, dour, pained, worried, anxious, ashamed, harried, guarded, thoughtful, wistful, wonder, weary-kind, curious, wide-eyed. Sun darkens and reddens the planes that face it, brings freckles and age spots, deepens pores and lines, and adds crow's feet from squinting.

Without a casting entry, age and sex are inferred as the world figures do ([`people.py`](../../tools/art/lib/people.py)): `build` gives the age band; a beard marks a man; an adult without a beard under a veil or scarf is a woman; an adult man without a beard is young. **The player's four looks are children of about ten drawn to be neither boy nor girl:** neutral bone structure, loose curls, an open, friendly face. How a covering is worn follows the person: a woman's scarf falls to her shoulders, a man's is a head cloth held on by a cord, a child's is a kerchief tied at the nape.

## 5. Photoreal or painterly

**Chosen: photographic.** The brief allowed a painterly finish if photographic faces still looked uncanny or plastic. Both were judged side by side on the same renders: [finish comparison](portraits/finish-comparison.webp) (top row photographic; below, Blender's anisotropic Kuwahara filter at sizes 3 and 6).

- At the sizes the game shows (104 px and smaller at 2× density), the painterly pass changes very little. What it does change is for the worse: hair strands smear into streaks, and the catchlights and lash lines that make the eyes read soften.
- At full size it reads as airbrushed digital painting rather than oil. It hides some CG smoothness in the skin, but it also removes the pores, stubble and fibre detail that make the photographic version read as real.
- With short lighting, a dim, warm, out-of-focus wall and subsurface skin, the photographic render already has the warmth and restraint of a painted portrait. It sits well on the parchment interface.

The painterly pass stays in the pipeline as an option (`--finish paint`) for art direction to revisit.

## 6. In the game

- **Lookup.** [`portraitImage`](../../src/features/portraits/portrait-art.ts) computes the appearance key (the domain copy, [`src/domain/appearance-key.ts`](../../src/domain/appearance-key.ts), with the same output as the game's `appearanceKey`). It returns the speaker's own portrait (`characterId`) if that portrait was rendered from this appearance, otherwise any portrait rendered from the same appearance (that is how players are found), otherwise nothing. A portrait is never shown for an appearance it wasn't rendered from.
- **Loading.** The image has a fixed `width` and `height` and a warm limestone background matching the render's, so the layout never shifts and nothing flashes while it decodes. If it fails to load, the SVG drawing is shown instead.
- **Accessibility.** Portraits are decorative (`alt=""` and `aria-hidden`); names are always text.
- **Sizes.** `srcset` offers 128, 256 and 512 px; the browser picks by display size and pixel density. Portraits are shown at 104 px in the dialogue box (72 px at large text, 60 px on phones), 72 px in the look picker, 64 px on profile cards and 56 px in chapter select. URLs start at `import.meta.env.BASE_URL`, so a sub-path deployment (GitHub Pages `/witness/`) works.
- **Offline.** All three sizes are precached with the rest of the art (WebP is already in the precache pattern). The whole set is small: 16 people, 48 files, 473 KB. That breaks down as 128 px about 4 KB each (65 KB in all), 256 px about 8 KB (131 KB), and 512 px about 17 KB (277 KB).
- **Preloading.** When a chapter starts, the dialogue overlay loads and decodes the portraits of everyone in it, so nobody's first line waits for their picture.
- **Why the manifest is bundled.** Code in `src/` makes no network requests (an architecture rule), and Vite does not let code import JSON from `public/`, so the manifest lives next to the code that reads it.

## 7. Adding people

1. Give the new character an `appearance` in the chapter content, as today, and a casting entry (age, sex if needed, sun, mood) in `CASTING`.
2. `npm run art:portrait-data` (exports everyone who speaks in every available chapter, and the player looks, to `tools/art/data/portrait-people.json`).
3. `npm run art:portraits`, or `npm run art:portraits -- --who <id> player:look-2` for just some people.
4. `npm run art:portrait-sheets` redraws the review sheets.
5. `npx vitest run tests/content/portraits.test.ts` checks that the portrait data is in step with every chapter, that everyone has a portrait of how they look now in every size, that every speaking character in every chapter is shown their own portrait, that no biblical figure has one, that nothing stray ships, that every file has provenance, and that sizes stay within budget.

Review options: `--size 384 --samples 48 --review <dir>` renders quickly and writes PNGs, a contact sheet (at full size and at the game's 104 px) and close-ups of the eyes and mouth to `<dir>`; `--clay` renders grey clay to judge shape; `--turn 0` renders from the front; `--device cpu` renders on the CPU when the GPU is busy. `--finish paint` applies the painterly pass. The build retries when a shared GPU runs out of memory and falls back to the CPU.

## 8. Iteration log

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

## 9. Second pass: from sculpture to person

The first pass read as a set of well-lit CG sculptures: hair, beards and light were good, but faces shared one nose, one thin mouth, one jaw and one stare; skin was plastic; eyes were glassy; faces were blank; turbans were puffy caps; children had adult faces. The second pass took each point in turn, judging probes by eye at 512, 256 and 128 px (and at the game's 104 px), in clay from the front for shape, and in close-ups of the eyes and mouth.

What changed, by the critique's points:

1. **Sameness.** Casting for everyone (§4), broad face, nose, eye and lip types moved continuously, and per-side asymmetry (§2). Wider noses and wings are common; some are aquiline with a hump, some snub, some bulbous; lips run from thin to very full with a Cupid's bow; jaws, chins (some cleft), cheekbones, brow ridges, eye depth, hooding and ear size all vary.
2. **Skin.** Pores and skin grain are rendered at 1024 px and reduced, so they survive as texture at 512 and 256 px; the oily T-zone has a broken-up sheen and the cheeks are drier; sun darkens, reddens and spots outdoor workers and deepens their lines; under-eye shadow and bags come with age; clean-shaven men have stubble dots and shadow; moles and old scars on some people; lips are smoother, wetter and darker at the edge; noses, ears and cheeks are warmer (§1).
3. **Eyes.** Longer, lower openings with the upper lid over the top of the iris and a lower lid line; wet pink-grey rims; a warm sclera; dark-brown irises with crypts (a few hazel or amber); smaller pupils; a softer catchlight; the caruncle; denser, finer lashes.
4. **Expression.** A mood for every part (§4), from Hadassah's warm smile and crow's feet to Menashe's pained brows and heavy lids, built into the face (§2).
5. **Head coverings.** Wound wraps (§2a); veils with deep folds and a turned hem; men's head cloths with a cord; children's kerchiefs.
6. **Children.** Child proportions throughout (§2), baby hair, smooth skin.
7. **Neck and shoulders.** Collarbones and the notch between them, a hemmed neckline with a slit, the tail of a wrap on the neck.

### Second-pass log

1. **Clay first.** Clay renders from the portrait angle and from the front showed the shape problems the lighting had hidden: faces were flat masks (the cross-sections were nearly square at eye and cheek height, so eyes sat in a plane); the bridge of the nose was a narrow tube whose steep sides cast a hard line down each cheek; the eye openings were too short, with the inner corners too far apart, so eyes looked round and staring.
2. **The nose as relief.** Building the bridge into the relief, with sloping sides that ease into the cheeks, removed the hard line at once and let broad, low and humped bridges look natural.
3. **The upper lip faced up.** Its most forward point was mid-way up the red, so the top of the lip faced the light and read as a pale ledge. The forward point is now near the border and the red faces down; the lower lip still catches the light.
4. **A fold of skin made of spheres.** Hooding built from a chain of spheres read as a caterpillar, and a single ellipsoid as a sausage stuck on the lid. The fold is now a soft bump in the relief itself.
5. **Stronger expressions.** The first smiles, brow lifts and lid droops were too small to read at 104 px; the amounts were roughly doubled, still within a quiet, dignified range.
6. **Lighting that looks photographed.** A smaller warm key and a cooler, dimmer fill (and surroundings cool above, warm below) turned waxy faces into photographed ones more than any skin change did; the fill was raised again a little so the eye sockets don't fall into shadow.
7. **Lumps.** Random surface irregularity made faces look like clay with fingerprints; it is now a fraction of a millimetre, and structure comes from anatomy (fat pads, folds, wrinkles) instead.
8. **The wrap.** Turns as a stack of cloth, each lying on the ones before, read as wound cloth immediately. Thin edges read as string; edges are now rolled and stand proud. The tail first hung free and, seen edge-on, read as a stick; it now lies on the neck and shoulder.
9. **Men in veils, girls in veils.** A male shepherd and a child in a woman's veil read as women; hence the head cloth with a cord and the kerchief.
10. **Children's foreheads were sliced.** The relief tables were in centimetres while the dome of the skull scaled with the head, so on a child's smaller head the dome cut the forehead flat. The tables now scale too.
11. **Children's lips looked made up** (a light rim over a dark edge); both are nearly gone on children.
12. **Women looked like men in veils.** Heavy straight brows, long noses and faces, gaunt temples and a veil that hid the cheeks. Finer brows, shorter and smaller noses, shorter lower faces, softer jaws, fuller cheeks, a wider face opening in the veil, and hair showing at the front.
13. **Holes in veils again.** Deeper folds steepened the field until the shell fell between samples; the shell is thicker and meshed finer.
14. **A shared GPU.** Another agent rendered places at the same time; the GPU ran out of memory mid-render (and once returned a black picture). The build now retries, then renders on the CPU, and checks for black pictures.

<!-- ITERATION-LOG -->
