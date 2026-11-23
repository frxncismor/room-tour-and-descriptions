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
[simplify, decor pieces that need it] → resize (≤ 1024 px, table wood 2048 px) → WebP (quality 85) → meshopt (+ quantization)`.
Models that already use `EXT_meshopt_compression` are skipped, so the script never changes the bytes of sofa, poker_table or bookshelf.
`resample` is not needed (no animations). The scene graph is kept (no flatten/join/simplify)
so node names used for picking stay intact.

**Bookshelf repair.** The original Sketchfab export has broken geometry: the central divider is
sheared into a diagonal "crack" (32 triangles with diagonal normals, inner vertices at 16 different
x values) and its material is `BLEND`, which read as a dark glass box. `optimize-models.mjs` runs
`repairBookshelf()` on the original before the pipeline: it drops the diagonal triangles,
snaps the inner vertices to a single central line, closes the 5 cm gaps between the four tiers
(each tier stretches half a gap up/down, so sides, back and boards meet and the unit reads as one
closed carcass from any angle, not four loose slabs) and makes the material opaque. It works in
place on a copy of the original export (it is idempotent: it is skipped on already-optimized output and on a model already marked
`asset.extras.repaired`, so re-running after a failed pipeline step is safe; it throws on an
unexpected layout).

Runtime: the viewer registers `MeshoptDecoder` in `ModelLoaderService`
(`three/examples/jsm/libs/meshopt_decoder.module.js`, bundled by the build). No KTX2 (decision D-05).
Check a model: `npx @gltf-transform/cli inspect src/assets/models/sofa/scene.gltf`
(lists `EXT_meshopt_compression`, `KHR_mesh_quantization`, `EXT_texture_webp`).

## Decor pieces and textures (spec 002)

Four CC0 pieces and two CC0 texture sets from [Poly Haven](https://polyhaven.com) (1K glTF / JPG from
`https://api.polyhaven.com/files/<id>`; originals are downloaded outside the repo and never committed).
The glTF is copied to `src/assets/models/<name>/scene.gltf` (+ `scene.bin`) and `node scripts/optimize-models.mjs` does the rest.

| Folder               | Poly Haven id            | Texture policy (WebP q85)                                    | Triangles |
| -------------------- | ------------------------ | ------------------------------------------------------------ | --------- |
| `landscape_painting` | `fancy_picture_frame_01` | `canvas_diff` 1024, rest 512                                 | 938       |
| `wall_clock`         | `wall_clock`             | 512                                                          | 3 658     |
| `succulent`          | `potted_plant_04`        | 512; `simplify` ratio 0.7, error 0.005 (8 929 → 6 578 tris)  | 6 578     |
| `ceramic_vase`       | `ceramic_vase_02`        | 512; `simplify` ratio 0.25, error 0.01 (11 128 → 2 782 tris) | 2 782     |

The per-model policy lives in `TEXTURE_POLICY` and the quality in `WEBP_QUALITY` (`scripts/optimize-models.mjs`).

Room textures (`src/assets/textures/`) are plain WebP q85 made with ImageMagick
(`magick <src>.jpg -resize NxN -quality 85 -define webp:method=4 <dst>.webp`) from the 1K JPGs:

| Destination       | Poly Haven id           | Source file | Size |
| ----------------- | ----------------------- | ----------- | ---- |
| `floor/diff.webp` | `laminate_floor_02`     | `Diffuse`   | 1024 |
| `floor/nor.webp`  | `laminate_floor_02`     | `nor_gl`    | 1024 |
| `floor/arm.webp`  | `laminate_floor_02`     | `arm`       | 1024 |
| `rug/diff.webp`   | `poly_wool_herringbone` | `Diffuse`   | 512  |
| `rug/nor.webp`    | `poly_wool_herringbone` | `nor_gl`    | 512  |

Total `src/assets` after this step: 3 631 139 B (without the fonts). Licenses of these assets: CC0 (no attribution required, credited in the README anyway).

## Wall prints and fabric (spec 003)

Four public-domain botanical prints (`src/assets/textures/art/`) and a grey linen set
(`src/assets/textures/fabric/`). Originals are downloaded to a temporary folder **outside the repo**
and never committed. Use a generic `User-Agent` and pause a few seconds between requests (Commons
rate-limits bursts).

### Sources and licenses

| File                    | Work and author                                                               | Source file (Wikimedia Commons)                                           | License (file page)              |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| `art/spiraea.webp`      | _Spiraea aruncus (Tyrol)_, Anna Atkins, 1851–54, cyanotype                    | `File:Spiraea aruncus (Tyrol) MET DT5664.jpg` (Met 285421)                | CC0 (Met Open Access)            |
| `art/felce.webp`        | _Felce_, William Henry Fox Talbot, 1839, salted paper print                   | `File:Felce MET DP202191.jpg` (Met 289193)                                | CC0 (Met Open Access)            |
| `art/osmunda.webp`      | _Osmunda regalis (Australia)_, Anna Atkins, c. 1850                           | `File:Anna Atkins - Osmunda Rigalis (Australia) - Google Art Project.jpg` | Public domain (author died 1871) |
| `art/pteris.webp`       | _Pteris aquilina_, Anna Atkins, c. 1850, cyanotype                            | `File:Anna Atkins - Pteris aquilina - Google Art Project.jpg`             | Public domain (author died 1871) |
| `fabric/linen.webp`     | `rough_linen`, Poly Haven (photography: colormass; processing: Rico Cilliers) | `https://api.polyhaven.com/files/rough_linen` (`Diffuse`, 1k, jpg)        | CC0                              |
| `fabric/linen-nor.webp` | same                                                                          | same (`nor_gl`, 1k, jpg)                                                  | CC0                              |

### Reproduce

```bash
T=$(mktemp -d)   # outside the repo; delete it when done
UA="room-tour-asset-fetch/1.0 (generic client)"

# Commons: ask the API for the 1280 px thumbnail URL of each file (iiurlwidth=1280), then download it
thumb() { curl -s -G -A "$UA" https://commons.wikimedia.org/w/api.php \
  --data-urlencode action=query --data-urlencode "titles=File:$1" --data-urlencode prop=imageinfo \
  --data-urlencode iiprop=url --data-urlencode iiurlwidth=1280 --data-urlencode format=json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(Object.values(JSON.parse(s).query.pages)[0].imageinfo[0].thumburl))'; }
get() { curl -s -A "$UA" -o "$T/$2.jpg" "$(thumb "$1")"; sleep 4; }
get "Spiraea aruncus (Tyrol) MET DT5664.jpg" spiraea
get "Felce MET DP202191.jpg" felce
get "Anna Atkins - Osmunda Rigalis (Australia) - Google Art Project.jpg" osmunda
get "Anna Atkins - Pteris aquilina - Google Art Project.jpg" pteris

# Poly Haven: 1k diffuse and nor_gl (URLs from https://api.polyhaven.com/files/rough_linen)
PH=https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rough_linen
curl -s -A "$UA" -o "$T/linen_diff.jpg" $PH/rough_linen_diff_1k.jpg; sleep 4
curl -s -A "$UA" -o "$T/linen_nor.jpg"  $PH/rough_linen_nor_gl_1k.jpg

# Prints: crop to the printed area, force 5:7, WebP q85 (ImageMagick 7)
mkdir -p src/assets/textures/art src/assets/textures/fabric
mk() { magick "$T/$1.jpg" -crop "$2" +repage -resize 512x717! -quality 85 -define webp:method=4 "src/assets/textures/art/$1.webp"; }
mk spiraea 1190x1666+45+72
mk felce   922x1291+190+60
mk osmunda 1230x1722+25+80
mk pteris  1150x1610+65+60

# Linen: grey diffuse with levels, plain normal, 512x512, WebP q85
magick "$T/linen_diff.jpg" -resize 512x512! -colorspace Gray -level 20%,95% -quality 85 -define webp:method=4 src/assets/textures/fabric/linen.webp
magick "$T/linen_nor.jpg"  -resize 512x512! -quality 85 -define webp:method=4 src/assets/textures/fabric/linen-nor.webp
```

### Measured sizes

| File                    | Source (bytes)          | Result            | Budget (spec D.1 + 25 %) |
| ----------------------- | ----------------------- | ----------------- | ------------------------ |
| `art/spiraea.webp`      | 528 565 (1280×1811 JPG) | 512×717, 65 052 B | ≤ 81 KB                  |
| `art/felce.webp`        | 340 982 (1280×1656 JPG) | 512×717, 21 640 B | ≤ 27 KB                  |
| `art/osmunda.webp`      | 535 647 (1280×1884 JPG) | 512×717, 40 414 B | ≤ 51 KB                  |
| `art/pteris.webp`       | 613 973 (1280×1739 JPG) | 512×717, 99 304 B | ≤ 124 KB                 |
| `fabric/linen.webp`     | 835 801 (1024×1026 JPG) | 512×512, 33 904 B | ≤ 44 KB                  |
| `fabric/linen-nor.webp` | 916 843 (1024×1026 JPG) | 512×512, 26 212 B | ≤ 34 KB                  |

Total added: 287 026 B. `du -sb src/assets` goes from 3 717 013 B to 4 003 539 B (limit 4 194 304 B).
All six are CC0 or public domain: no attribution is legally required (they are credited in the README anyway).

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
