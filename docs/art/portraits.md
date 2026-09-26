# Portraits: rendered heads and shoulders

The dialogue box, the profile look picker and chapter select show a portrait of whoever is speaking or playing. They used to be small SVG drawings (a round head, dot eyes, an ink outline), which read as cartoons next to the pre-rendered world. They are now **rendered portraits**: realistic, lit heads and shoulders of every character and every player look, made offline by Blender from each person's appearance data.

- **Where they come from:** [`tools/art/build_portraits.py`](../../tools/art/build_portraits.py) and `tools/art/lib/portrait_*.py`. Run `npm run art:portraits` (Blender 5.2+; about 22 minutes for Chapter 1's 16 people on an M3 Pro: roughly a minute to build each person, then 10–60 seconds of Cycles at 512 px and 128 samples, denoised).
- **What ships:** `public/art/portraits/<id>-512.webp` (the master), `-256.webp` and `-128.webp`, and the manifest [`src/features/portraits/portrait-manifest.json`](../../src/features/portraits/portrait-manifest.json) (`id` → the appearance key it was rendered from).
- **What the game does:** [`Portrait`](../../src/features/common/Portrait.tsx) shows the rendered image when there is one for how the person looks now, and the original SVG drawing otherwise.
- **Honesty about tools:** everything is made by code in this repository. No image, texture, model, HDRI or photograph was downloaded, and no image-generation model was used. Provenance is in the [asset manifest](asset-manifest.json).

**Pictures** (in [`portraits/`](portraits/)):

- [before-after.webp](portraits/before-after.webp) — the game before (left, the drawn portraits) and after (right): Aunt Miriam and Hadassah in conversation, and the look picker. [before-after-phone.webp](portraits/before-after-phone.webp) — the same conversation on a phone.
- [contact-sheet.webp](portraits/contact-sheet.webp) — everyone, as rendered: Chapter 1's twelve characters, then the four player looks.
- [finish-comparison.webp](portraits/finish-comparison.webp) and [finish-comparison-full.webp](portraits/finish-comparison-full.webp) — photographic against painterly (§5).

Recreate the in-game pair with `E2E_SHOTS=1 npx playwright test e2e/portrait-art.spec.ts --project=desktop-chromium` (the `before` set blocks the portrait images, so the game falls back to the drawings).

## 1. How a portrait is made

One Blender run per person ([`portrait_person.build`](../../tools/art/lib/portrait_person.py)). Every step is deterministic: the same id and appearance always give the same picture.

| Step | Module | What it does |
|---|---|---|
| Who | [`portrait_params.py`](../../tools/art/lib/portrait_params.py) | Age, how masculine or feminine the bone structure is, face width and length, jaw, chin, nose length, width, projection and hump, eye spacing and opening, lips, fullness, brows, iris colour, hair curl, greying and beard length. Seeded from the id, within ordinary anatomy. |
| Head | [`portrait_head.py`](../../tools/art/lib/portrait_head.py) | A signed distance field, in centimetres. See §2. |
| Mesh | [`portrait_sdf.py`](../../tools/art/lib/portrait_sdf.py) | The field is sampled finely only near the surface, meshed with OpenVDB (0.75–1 mm voxels), and every vertex is moved onto the exact surface and given its exact normal, so the skin is as smooth as the maths. |
| Skin | [`portrait_skin.py`](../../tools/art/lib/portrait_skin.py), [`portrait_materials.py`](../../tools/art/lib/portrait_materials.py) | Regional colour per vertex, from the appearance's skin colour: warmer cheeks, nose and ears; darker, cooler eyelids and under-eyes; the lips; the lash line; a beard's shadow; sun-darkening for outdoor workers. Principled BSDF with random-walk skin subsurface, two scales of pores, fine lines, mottling, and an oily coat. |
| Eyes | [`portrait_eyes.py`](../../tools/art/lib/portrait_eyes.py) | An eyeball with a recessed iris (radial fibres, a lighter ring round the pupil, a dark ring at the edge), a clear refracting cornea that catches the light, a wet tear line along each lid, and the pink caruncle. The eyes turn to look at the viewer. |
| Clothes | [`portrait_cloth.py`](../../tools/art/lib/portrait_cloth.py) | Thin cloth shells with folds and real edges: the tunic in the robe colour with woven stripes in the accent colour; an undyed mantle for elders; the veil, scarf, hood, wrap or band in the head-covering colour. Sheen is tinted with the dye, so colours don't grey. |
| Hair | [`portrait_hair.py`](../../tools/art/lib/portrait_hair.py) | Blender hair curves with the Principled Hair BSDF (melanin from the appearance's hair colour; grey hair is a mix of white and pigmented strands). See §3. |
| Light and lens | [`portrait_scene.py`](../../tools/art/lib/portrait_scene.py) | An 85 mm lens at f/3.2, focused on the near eye; short lighting (below); an out-of-focus limestone wall behind. |
| Finish | [`portrait_finish.py`](../../tools/art/lib/portrait_finish.py) | Lanczos resizing to 256 and 128 px, with a light sharpen on the small sizes. An optional painterly pass (anisotropic Kuwahara) is available; see §5. |

### Lighting

Portraits use **short lighting**, as painted portraits do:

- The person turns about 22° toward screen right (toward the dialogue text).
- A large, soft, slightly warm key light comes from the side they turn toward, about 42° round and 34° up.
- The near cheek falls into soft shadow, with a triangle of light under the eye.
- A dim fill comes from the camera's side, and a warm rim light from behind the shadow side separates hair and shoulders from the wall.

The first version used broad lighting (the key on the camera's side), which flattened every face (see the log).

## 2. The head

A head is sculpted in three layers:

1. **A relief round a vertical axis.** Each height has a cross-section taken from anatomical tables: the depth of the midline (the forehead, glabella, nasion, the base under the nose, lips, the groove above the chin, the chin), the half-width, how square the front is, and how far back the skull goes. The tables are adult averages (head height about 23 cm, pupils 6.3 cm apart, the cornea about 1 cm behind the bridge of the nose), moved by the person's parameters. They are smoothed so the skin shows no banding. On top, soft bumps and dents give:
   - the brow ridge, eye sockets and the fold above each lid crease;
   - cheekbones and the hollow under them, temples, cheeks and jowls;
   - the lips (profiles that roll out from the mouth line and carry on as the skin up to the nose);
   - the philtrum, the mouth line and its corners, the folds from nose to mouth, and the chin.

   A plane through the chin and the angles of the jaw cuts a clean jawline. An ellipsoid closes the dome of the skull.
2. **Solid features.** The nose is a bridge, side walls, a tip lobule and columella, and wings that join the face with a crease. The nostrils open underneath. The ears have a helix, antihelix, concha, tragus and lobe; the neck has sternocleidomastoids and, for men, a larynx.
3. **Lids.** A shell of skin over each eyeball, blended into the socket, with the opening between the lids carved out along anatomical lid curves (the upper lid highest toward the nose, the lower lowest toward the temple). A crease runs above the upper lid.

**Age** changes the shape as well as the colour:

- hooded lids, bags, hollow temples and cheeks, jowls;
- a longer, wider nose and larger ears;
- thinner lips and deeper folds;
- wrinkles displaced into the surface: forehead lines, crow's feet, lines under the lids and frown lines.

**Children** have fuller cheeks, a shorter lower face, a smaller, less projecting nose, no brow ridge, and eyes that are large for the face. **Women** have a finer nose and chin, a narrower jaw, fuller lips and cheeks, a smaller brow ridge, and higher, thinner, arched brows.

## 3. Hair

Hair grows in locks. A few thousand guide strands carry the wave or curl, and every other strand follows its nearest guide, drawn toward it at the tip (clumping). Strands grow from roots scattered on the head mesh. They follow a direction field (away from the crown and down; down the face for beards; outward along the brow), bend under gravity, and are kept on the skin by the head's distance field, with a little volume toward the tips.

- **Where hair grows** is described in angles round the skull: the hairline (forehead, temples receding a little for men, sideburns, above the ears, the nape), less what a head covering hides. The same edges drive the cloth.
- **Strands never pass through cloth** (they end where they would enter a covering), and scalp hair never falls in front of the eyes.
- **Density** is per square centimetre of visible scalp, so a small visible patch doesn't become a dense clump.
- **Beards** are longest at the point of the chin and shorter up the cheeks and at the sides, so they have a natural outline. The moustache is kept short so the mouth shows. Elders have long grey beards.
- **Eyebrows** are dense short hairs lying on the skin: upward at the inner end, outward along the body, down at the tail. Women's are finer and more arched.
- **Lashes** leave the front edge of the lid margin, then curve up (upper) or down (lower). The margin itself is darkened in the skin, which is what defines an eye at small sizes.

## 4. Who they are

The appearance data has no age or sex, so, as in the world figures ([`people.py`](../../tools/art/lib/people.py)):

- `build` gives the age band: child about 11, adult 18–50, elder 64–76.
- A beard marks a man. An adult without a beard whose head is covered with a veil or scarf is a woman. An adult man without a beard is young (18–22).
- **The player's four looks are children drawn to be neither boy nor girl:** soft, neutral bone structure and loose curls of middling length.

A few ages that the story implies are cast in `CASTING` ([`portrait_params.py`](../../tools/art/lib/portrait_params.py)). For example, Aunt Miriam says her "knees can't manage that road anymore", so she is about 54. Everyone not listed, including characters in later chapters, is cast from their appearance and id alone.

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

1. Give the new character an `appearance` in the chapter content, as today.
2. `npm run art:data` (exports characters and player looks to `tools/art/data/chapter.json`).
3. `npm run art:portraits`, or `npm run art:portraits -- --who <id> player:look-2` for just some people.
4. `npx vitest run tests/content/portraits.test.ts` checks that everyone has a portrait of how they look now, that every size exists, that nothing stray ships, that every file has provenance, and that sizes stay within budget.

Review options: `--size 384 --samples 48 --review <dir>` renders quickly and writes PNGs and a contact sheet to `<dir>`. `--finish paint` applies the painterly pass.

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

<!-- ITERATION-LOG -->
