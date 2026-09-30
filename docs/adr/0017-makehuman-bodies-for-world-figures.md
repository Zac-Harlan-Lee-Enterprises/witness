# ADR-0017: MakeHuman bodies for the people in the world, clothes draped by simulation

- **Status:** Accepted. Approved by the owner, Zac Harlan, on 2026-09-26, with the limits below. Extends [ADR-0016](0016-makehuman-base-for-portraits.md) from the portraits to the world's figures.
- **Related:** [technical art guide §7](../art/technical-art-guide.md), [asset manifest](../art/asset-manifest.json), [pinned file list](../../tools/art/data/makehuman-files.json), [ADR-0014](0014-prerendered-places.md), [`tools/art/lib/world_body.py`](../../tools/art/lib/world_body.py), [`world_person.py`](../../tools/art/lib/world_person.py), [`world_cloth.py`](../../tools/art/lib/world_cloth.py), [`world_motion.py`](../../tools/art/lib/world_motion.py)

## Context

The owner judges the game above all on its realism. Once the conversation portraits were rebuilt on MakeHuman's anatomical model (ADR-0016), the people walking about the world were the largest gap left. They were procedural mannequins ([`people.py`](../../tools/art/lib/people.py)):

- a smooth body grown along a joint skeleton;
- tubes for garments, with painted-on folds that never moved;
- faces made of ellipsoids.

So a person in the world looked nothing like their own portrait. Their robes were stiff bells, and they walked like dolls.

## Decision

The world figures are rebuilt on the portraits' MakeHuman model, within the scope the owner approved on 2026-09-26: **MakeHuman geometry and modelling data only** (the base mesh, its morph targets, its default skeleton and that skeleton's skin weights). Skin, hair, clothes, lighting and motion are still made here, procedurally.

1. **The body is the portrait's person.** [`world_body.py`](../../tools/art/lib/world_body.py) gives each figure MakeHuman target weights from the portrait's own identity (`portrait_face.identity`): the same sex, age, build, face and resting mood.
   - A person's height and proportions are their own.
   - The body is re-posed once from MakeHuman's A-pose into a relaxed standing pose, which becomes the armature's rest pose.
2. **The skeleton and weights are MakeHuman's.**
   - The files are `rigs/default.mhskel` and `rigs/default_weights.mhw`: CC0, the same pinned commit, and their SHA-256 are in [`makehuman-files.json`](../../tools/art/data/makehuman-files.json).
   - `npm run art:fetch-makehuman` fetches them.
   - The armature is built here, in Blender, from the skeleton's joint markers.
   - No MakeHuman or MPFB code is used.
3. **The skin is the portrait's.**
   - Its colour is set by the same regional maps (`portrait_mhskin.maps`) on the same vertices.
   - It is scaled by the correction the portrait build measured for that person (`tools/art/data/portrait-checks.json`).
   - A passer-by, who has no portrait, takes the portraits' median correction.
   - Hair and beard are shells grown where the portrait's grow (`portrait_hair.scalp_mask`, `portrait_mhskin.beard_mask`).
4. **The clothes are cut to the body and draped by Blender's cloth simulation** ([`world_cloth.py`](../../tools/art/lib/world_cloth.py)):
   - **The tunic's body and sleeves** are the body's surface let out. The cloth hangs from the shoulders and chest and is drawn in by the belt.
   - **The tunic's skirt, veils, head cloths, hoods, mantles and the story's spare cloak** are simulated as linen or wool:
     - a pose is settled for every frame a sheet shows;
     - a walk is recorded over its third stride.
   - The recorded shapes are then set on the garments frame by frame, so every frame is repeatable.
   - A story mark's garment (the cloak) collides with the person's own clothes, but never the reverse, so overlays line up with the sheet under them.
5. **Motion is authored here** ([`world_motion.py`](../../tools/art/lib/world_motion.py)):
   - a walk after normative gait angles;
   - a contrapposto stance and breathing;
   - the talk gesture and the rest poses.
6. **The sheet contract is unchanged:**
   - frame names, sizes and origins, directions and turns;
   - overlays with the body as a holdout;
   - cast-shadow sheets with their fading margins;
   - `-low` phone sheets and `people.json`.

   The game needs no change.
7. **Carried things and marks** (a basket, a staff, a water skin, a lamb) are still built by `people.py`, placed by the same landmarks and bound to the matching MakeHuman bones.

Excluded, as for the portraits: MakeHuman's skins, textures, proxies (eyes, brows, lashes, hair, clothes) and poses; any other downloaded texture, image, hair or clothing asset; image-generation models.

## Consequences

- **A person looks like their portrait.** They have the same face, build, height and skin. Men and women, children, the young and the old differ as real bodies do.
- **Cloth behaves like cloth:**
  - a skirt swings with the stride and catches on the knee;
  - a veil falls over the shoulders;
  - a belt gathers the tunic, and it blouses over it.
- **Authoring needs the MakeHuman cache** for people too (`npm run art:fetch-makehuman`). A person's sheet takes about a minute longer to build, mostly cloth simulation. Players and CI need nothing new: the rendered sheets are committed.
- **Sizes and texture memory** are measured in [performance.md](../performance.md). The sheet sizes are unchanged. What changes is how much of each frame is covered, so how much each packed atlas holds.
- `people.py`'s body, garments and posing stay for the teaser film ([`teaser_people.py`](../../tools/art/lib/teaser_people.py)), which renders crowds far from the camera.

## Alternatives considered

- **A fifth pass on the procedural mannequins.** The portraits showed that anatomy is data, not a few equations. The mannequins' proportions, joints and faces were the problem, not their materials.
- **Garments as rigid shells with sculpted folds.** Cheaper, but folds that never move read as plastic in a walk cycle, and a skirt that can't be pushed by a knee shows the leg through the cloth.
- **MakeHuman's clothes proxies, or MPFB2.** Excluded by the owner's terms (ADR-0016): only geometry and modelling data.
- **Motion capture data (e.g. CMU).** Not within the approved scope. The walk is authored here from published normative gait angles.
