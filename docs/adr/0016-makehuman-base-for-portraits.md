# ADR-0016: MakeHuman's CC0 human model as the base of the conversation portraits

- **Status:** Accepted. Approved by the owner, Zac Harlan, on 2026-09-26, with the limits below.
- **Related:** [portraits guide](../art/portraits.md), [asset manifest](../art/asset-manifest.json), [pinned file list](../../tools/art/data/makehuman-files.json), [ADR-0014](0014-prerendered-places.md), [ADR-0004](0004-ascii-maps-procedural-art-audio.md), [`tools/art/lib/makehuman.py`](../../tools/art/lib/makehuman.py), [`scripts/fetch-makehuman.mjs`](../../scripts/fetch-makehuman.mjs)

## Context

The conversation portraits (ADR-0014's pipeline, [portraits guide](../art/portraits.md)) were heads sculpted entirely in code, as signed distance fields. After three passes they still read as CG mannequins:

- waxy skin and lifeless eyes;
- every man with essentially the same face, told apart only by beard and headwear.

Sculpting believable anatomy from equations had reached its limit. The project's rule until now was **no downloaded images, textures, models or artwork**: everything original, made by code in this repository.

## Decision

On 2026-09-26 the owner, Zac Harlan, approved using **MakeHuman's CC0 anatomical human model** as the base for the portrait heads and faces. This relaxes the "nothing downloaded" rule **for this one purpose only**, within these limits:

1. **Only MakeHuman's geometry and modelling data is used.** That means:
   - the hm08 base mesh, including its helper geometry for the eyes, lashes, teeth and tongue;
   - its morph targets:
     - the macro key shapes for sex, age, muscle, weight and the three ancestry averages;
     - the face and neck modifiers;
     - the asymmetry targets;
     - the expression units (muscle actions).
2. **Everything else is made here, procedurally, as before:**
   - skin materials and every skin map;
   - eyes (the eyeball, iris, cornea and tear line);
   - teeth and gums;
   - hair, beards, brows and lashes;
   - clothing and headwear;
   - lighting and camera;
   - every expression, authored here as a mix of MakeHuman's expression units ([`portrait_face.py`](../../tools/art/lib/portrait_face.py)).
3. **No MakeHuman skin textures or images, no other downloaded textures, images, hair or clothing assets, and no image-generation models.** MakeHuman's own eye, eyebrow, eyelash, hair and clothing proxies are not used.
4. **No MakeHuman or MPFB code is used or copied.** MakeHuman's code is AGPL-3.0 and MPFB2's is GPL-3.0; their assets are CC0. The loader reads the simple file formats directly (Wavefront OBJ; targets as `vertex dx dy dz` lines). The macro weighting (linear interpolation between named key shapes) is written here, from the targets' names.
5. **Provenance is pinned and checked:**
   - Files come from `makehumancommunity/makehuman` at tag v1.3.0, commit `1f508f6083b2f823dab15de924b3bde72e08d77c`.
   - Each file's path, size and SHA-256 is listed in [`tools/art/data/makehuman-files.json`](../../tools/art/data/makehuman-files.json).
   - `npm run art:fetch-makehuman` downloads them into a gitignored cache (`tools/art/.cache/makehuman/`) and refuses any file whose checksum differs.
   - The build checks every file again before it renders.
   - The files are **not committed**. The rendered portraits are, so neither players nor CI need them.
6. **Licence verified.** Both texts were read at the pinned commit:
   - `makehuman/license.txt`, section C: "the base mesh and proxies, targets and modifiers, textures, clothes (any MHCLO-based asset), poses and expressions … have been released under CC0 1.0 Universal".
   - `LICENSE.ASSETS.md`: the CC0 1.0 legal code, which is downloaded with the files.

   `base.obj`'s header states it "was explicitly released as CC0 in september 2020". Section D adds that the MakeHuman project makes no claim over renderings made from its assets.

## Consequences

- **Faces become believable people.** Skulls, noses, lids, lips and ears have real anatomy, and about 170 target weights per person make every face distinct. Everyone is also cast by type: face, nose, eyes and lips. Ages, sexes and builds follow the story.
- **Expressions become possible.** Dialogue lines carry an optional `expression` (glad, worried, sad, angry, surprised, afraid). Each person's portrait is rendered in every expression their lines use.
- **Authoring now needs the cache.** Before rendering portraits, run `npm run art:fetch-makehuman` (25.5 MB, 497 files) once. Nothing else in the project depends on it.
- **The project's no-download rule stands everywhere else.** Places, people sprites, props, audio and icons remain original work. Any further exception needs the owner's approval and its own ADR.
- **Provenance is recorded** in [`docs/art/asset-manifest.json`](../art/asset-manifest.json):
  - an entry for the MakeHuman data (source, commit, licence, the pinned list);
  - the portraits' entry, which names it.

  Every rendered portrait is a derivative of CC0 data plus original work here. Attribution is not required under CC0, but MakeHuman is credited in the portraits guide.

## Alternatives considered

- **Keep sculpting in code (a fourth procedural pass).** The third pass was only a marginal improvement. Anatomy at this level of detail is a body of measured data, not a few equations.
- **MPFB2 (MakeHuman's Blender add-on).** It would load the same data. But it is GPL code that would have to be installed into Blender for every rebuild, its asset packs bundle skin textures this decision excludes, and a small loader for two plain file formats is more reliable and fully under our control.
- **Scanned heads, photogrammetry or commercial character kits (MetaHuman, Character Creator, Daz).** Restrictive licences, photographic textures, and a borrowed look. All excluded by the owner's terms.
- **Image-generation models.** Excluded outright: provenance, consistency across expressions, and the owner's rule.
