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
| `art/osmunda.webp`      | _Osmunda regalis (Australia)_, Anna Atkins, 1853/54                           | `File:Anna Atkins - Osmunda Rigalis (Australia) - Google Art Project.jpg` | Public domain (author died 1871) |
| `art/pteris.webp`       | _Pteris aquilina_, Anna Atkins, 1851, cyanotype                               | `File:Anna Atkins - Pteris aquilina - Google Art Project.jpg`             | Public domain (author died 1871) |
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

## Room completion: 9 glTF models and 4 prints (spec 004, F0)

Nine CC0 pieces from [Poly Haven](https://polyhaven.com) and four public-domain prints. Nothing is wired into
the app yet (F0 = no visible change); the pieces are loaded lazily by the `pieces` chunk in later phases.
Originals are downloaded to a temporary folder **outside the repo** and never committed; the folder is deleted afterwards.

### Models

Source: `https://api.polyhaven.com/files/<id>` (glTF `1k`; the md5 of every file is checked against the API manifest and the
download aborts on a mismatch). The pipeline is the same as for the decor pieces
(`node scripts/optimize-models.mjs <dir>`: dedup → weld → prune → resize → WebP q85 → meshopt). The per-model texture size lives in
`TEXTURE_POLICY` (`large: NEVER` switches off the "wood" rule, which would otherwise keep 2048 px for names such as
`painted_wooden_*`). The glTF is copied to `src/assets/models/<id>/scene.gltf` with its `.bin` renamed to `scene.bin`
(same layout as the existing models).

| Folder (`<id>`)             | Piece (spec A.2)            | Author (Poly Haven) | Textures (WebP q85) | Tris (measured) | Weight on disk |
| --------------------------- | --------------------------- | ------------------- | ------------------- | --------------- | -------------- |
| `mid_century_lounge_chair`  | `readingChair` (armchair)   | Kuutti Siitonen     | 512 px              | 6 148           | 144 478 B      |
| `side_table_01`             | `readingChair` (side table) | James Ray Cock      | 256 px              | 2 756           | 54 408 B       |
| `modern_arm_chair_01`       | `armchair`                  | Vibrant Nordic      | 512 px              | 8 916           | 176 244 B      |
| `modern_coffee_table_01`    | `coffeeTable`               | Amin                | 256 px              | 4 504           | 55 808 B       |
| `vintage_wooden_drawer_01`  | `sideboard`                 | James Ray Cock      | 512 px              | 5 184           | 169 944 B      |
| `painted_wooden_chair_02`   | `desk` (chair)              | Kirill Sannikov     | 256 px              | 1 246           | 46 659 B       |
| `wooden_display_shelves_01` | `displayShelves`            | James Ray Cock      | 256 px              | 3 174           | 49 053 B       |
| `painted_wooden_cabinet_02` | `tallCabinet`               | Kirill Sannikov     | 256 px              | 966             | 42 531 B       |
| `modern_ceiling_lamp_01`    | `pendant`                   | James Ray Cock      | 256 px              | 5 602           | 58 494 B       |
| **Total**                   |                             |                     |                     | **38 496**      | **797 619 B**  |

Every model is well under its spec A.2 weight + 25 % (the spec figures were measured without meshopt): e.g. armchair 176 244 B
vs 0,33 MiB (346 030 B), chair + side table 198 886 B vs 0,43 MiB, sideboard 169 944 B vs 0,30 MiB. Each glTF uses
`EXT_meshopt_compression`, `EXT_texture_webp` and `KHR_mesh_quantization`; there are no PNG or JPG files. The triangle counts
come from the accessors of the original glTF and equal the spec A.2 figures.

License: **CC0**. The site-wide license page (`https://polyhaven.com/license`: "CC0 means absolute freedom") covers every
asset; authors from `https://api.polyhaven.com/info/<id>`. Asset pages: `https://polyhaven.com/a/<id>`.

### Measured boxes and local front (for T-453)

Box = `POSITION.min/max` of the original glTF with the node transforms applied (metres, glTF Y-up, local axes, before any
rotation or scale). The front was decided by rendering each model from the four sides (orthographic flat-shaded views,
script outside the repo): backrest and seat opening, drawer fronts, door panels.

| `<id>`                      | Size x · y · z (m)    | min (x, y, z)          | max (x, y, z)       | Front (local)                                                              |
| --------------------------- | --------------------- | ---------------------- | ------------------- | -------------------------------------------------------------------------- |
| `mid_century_lounge_chair`  | 1,009 · 1,169 · 1,190 | −0,504, 0, −0,661      | 0,504, 1,169, 0,529 | **+z** (backrest at −z)                                                    |
| `modern_arm_chair_01`       | 0,820 · 1,023 · 0,987 | −0,407, 0, −0,575      | 0,414, 1,023, 0,411 | **+z** (backrest at −z)                                                    |
| `modern_ceiling_lamp_01`    | 0,432 · 0,952 · 0,432 | −0,216, 0,221, −0,214  | 0,216, 1,173, 0,217 | any (axially symmetric); spans y 0,221 to 1,173 (origin is not at the top) |
| `modern_coffee_table_01`    | 0,600 · 0,390 · 1,202 | −0,300, 0, −0,601      | 0,300, 0,390, 0,601 | any (symmetric); long side along z                                         |
| `painted_wooden_cabinet_02` | 0,997 · 2,569 · 0,722 | −0,498, −0,001, −0,322 | 0,498, 2,568, 0,400 | **+z** (door panel with knobs; the lower body protrudes toward +z)         |
| `painted_wooden_chair_02`   | 0,639 · 1,264 · 0,662 | −0,335, 0, −0,363      | 0,305, 1,264, 0,299 | **+z** (seat opening at +z, backrest at −z)                                |
| `side_table_01`             | 0,550 · 0,551 · 0,450 | −0,275, −0,002, −0,225 | 0,275, 0,548, 0,225 | any (symmetric)                                                            |
| `vintage_wooden_drawer_01`  | 1,715 · 1,091 · 1,007 | −0,858, −0,001, −0,440 | 0,858, 1,090, 0,567 | **+z** (six drawers with handles)                                          |
| `wooden_display_shelves_01` | 0,372 · 1,556 · 1,078 | −0,186, 0, −0,539      | 0,186, 1,557, 0,539 | **±x** (open cube grid seen from both x faces; long side is z)             |

How to use it (scene rule of spec A.2: rotation Y 0 on the green wall, −π/2 right, π front, +π/2 left, which turns a **+z**
front toward the room):

- Models with front **+z** (both armchairs, chair, cabinet, sideboard) take **the wall rotation** of their row in A.2 as is
  (plus the free turn A.2 gives to `readingChair` and `armchair`). To put the front on −z local instead, add π.
- `wooden_display_shelves_01` is open on x, with its long side (z) meant to run along the wall: it needs `wall rotation + π/2`
  (or `+ 3π/2`), e.g. 0 or π on the desk wall (x = +8), not the plain wall rotation. Confirm with a capture in T-453.
- Sizes agree with A.2: sideboard 1,715 × 1,091 × 1,007 at scale 0,6 = 1,03 × 0,65 × 0,60; cabinet 1,00 × 2,57 × 0,72; armchair
  0,82 × 1,02 × 0,99; chair 0,64 × 1,26 × 0,66.
- The glTF origin sits on the floor footprint (y = 0 at the base), so the A.2 centre-of-volume `y` has to be lowered by
  half the height. The box is off-centre in x/z by up to 0,07 m for the chair, cabinet and sideboard.

### Prints (E, F, G, H)

Candidates were searched with the Wikimedia Commons API and the license is the one on the **file page** (`extmetadata`
`LicenseShortName`/`UsageTerms`: "Public domain"). The 1280 px thumbnail of each file is cropped to the printed area (mat
removed), forced to 5:7 and exported with
`magick <src>.jpg -crop <w>x<h>+<x>+<y> +repage -resize 512x717! -quality 85 -define webp:method=6 <k>.webp`
(crops: e `1260x1764+10+30`, f `1190x1666+45+70`, g `1250x1750+15+20`, h `1100x1540+85+40`). All four are Atkins cyanotypes,
different from A–D and in the same blue tone. The Talbot salted prints tried from the Met album pages were nearly blank sheets
and were dropped.

| File         | Work and author                                             | Year      | Source file (Wikimedia Commons)                                                                                  | License (file page)              | Weight    |
| ------------ | ----------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------- |
| `art/e.webp` | _Asplenium Braziliense, S. America_, Anna Atkins, cyanotype | 1854      | https://commons.wikimedia.org/wiki/File:Anna_Atkins_-_Asplenium_Braziliense,_S._America_-_Google_Art_Project.jpg | Public domain (author died 1871) | 59 420 B  |
| `art/f.webp` | _Foreign Ferns_, Anna Atkins, cyanotype                     | 1845/1855 | https://commons.wikimedia.org/wiki/File:Anna_Atkins_-_Foreign_Ferns_-_Google_Art_Project.jpg                     | Public domain (author died 1871) | 84 930 B  |
| `art/g.webp` | _New Zealand_ (fern), Anna Atkins, cyanotype                | 1848/1859 | https://commons.wikimedia.org/wiki/File:Anna_Atkins_-_New_Zealand_-_Google_Art_Project.jpg                       | Public domain (author died 1871) | 109 580 B |
| `art/h.webp` | _Carex (America)_, Anna Atkins, cyanotype                   | 1848/1853 | https://commons.wikimedia.org/wiki/File:Anna_Atkins_-_Carix_(America)_-_Google_Art_Project.jpg                   | Public domain (author died 1871) | 61 938 B  |

Total **315 868 B** (spec estimate 228 000 B); each file ≤ 110 kB (`g` is the largest and was exported with `method=6` to fit).
The years are the ones shown on each file page.

### Budget (T-413)

| Concept                         | Bytes         |
| ------------------------------- | ------------- |
| `src/assets` before (spec 003)  | 4 044 814     |
| 9 glTF models                   | + 797 619     |
| 4 prints                        | + 315 868     |
| **`du -sb src/assets` after**   | **5 158 301** |
| Spec F.1 forecast (upper bound) | 6 244 136     |
| Target (≤ 6,0 MiB)              | 6 291 456     |
| Hard limit (6,5 MiB)            | 6 815 744     |

The result is 1 133 155 B under the target and 1 657 443 B under the limit, so no cut of spec F.1 is needed. The gap to the
forecast comes from meshopt and the 256 px textures, which the spec had not measured.
