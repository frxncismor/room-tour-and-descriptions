# Assets pipeline (3D models)

The models in `src/assets/models/` are **optimized in place**: same paths
(`scene.gltf` + `scene.bin` + `textures/`), so `MODEL_CONFIGURATIONS` does not change.
There is no Git LFS and no `assets-src/` folder: the original Sketchfab exports live
in the git history (commit `ba66b12`).

## Regenerate

```bash
# 1. Restore the originals (optional: only if you want to start from scratch)
git checkout ba66b12 -- src/assets/models      # or: git show ba66b12:<path> > <path>

# 2. Optimize (uses `npx @gltf-transform/cli`, not a project dependency)
node scripts/optimize-models.mjs [modelsDir]
```

Pipeline per model: `dedup → weld → prune (drops unused attributes/textures) →
resize (≤ 1024 px, table wood 2048 px) → WebP → meshopt (+ quantization)`.
`resample` is not needed (no animations). The scene graph is kept (no flatten/join/simplify)
so node names used for picking stay intact.

**Bookshelf repair.** The original Sketchfab export has broken geometry: the central divider is
sheared into a diagonal "crack" (32 triangles with diagonal normals, inner vertices at 16 different
x values) and its material is `BLEND`, which read as a dark glass box. `optimize-models.mjs` runs
`repairBookshelf()` on the original before the pipeline: it drops the diagonal triangles,
snaps the inner vertices to a single central line, closes the 5 cm gaps between the four tiers
(each tier stretches half a gap up/down, so sides, back and boards meet and the unit reads as one
closed carcass from any angle, not four loose slabs) and makes the material opaque. It works in
place on a copy of the original export (it is skipped on already-optimized output and throws on an
unexpected layout).

Runtime: the viewer registers `MeshoptDecoder` in `ModelLoaderService`
(`three/examples/jsm/libs/meshopt_decoder.module.js`, bundled by the build). No KTX2 (decision D-05).
Check a model: `npx @gltf-transform/cli inspect src/assets/models/sofa/scene.gltf`
(lists `EXT_meshopt_compression`, `KHR_mesh_quantization`, `EXT_texture_webp`).

## Sizes (before → after)

| Model       | Before     | After       |
| ----------- | ---------- | ----------- |
| sofa        | 9.94 MB    | 1.45 MB     |
| poker_table | 36.09 MB   | 0.80 MB     |
| bookshelf   | 4.99 MB    | 0.13 MB     |
| **Total**   | **~51 MB** | **~2.4 MB** |

Notes: the sofa has no textures, so its UVs were pruned. Solid-colour textures of the table
(Beer/Glass normal, Glass base colour) were folded into material factors. The sofa keeps its
`baseColorFactor`; the final colour assignment belongs to the scene work (F6).

## Licenses (from each `scene.gltf` `asset.extras`)

| Model                                 | Author       | License            | Source                                                                                               |
| ------------------------------------- | ------------ | ------------------ | ---------------------------------------------------------------------------------------------------- |
| SOFA SET                              | FREEDomplant | Sketchfab Standard | https://sketchfab.com/3d-models/sofa-set-2fc4feb7793144f5ae04901082d4d3d2                            |
| Poker Board Game Table - Downloadable | Lília Mara   | Sketchfab Standard | https://sketchfab.com/3d-models/poker-board-game-table-downloadable-c68dbd76122840b59c8783f623fde050 |
| BookShelf                             | Twpic        | Sketchfab Standard | https://sketchfab.com/3d-models/bookshelf-ed697dcb7e634c1e92ed0192364588e6                           |

Sketchfab Standard license: https://sketchfab.com/licenses (credit the authors in the README).
