#!/usr/bin/env node
/**
 * Optimizes the glTF models in src/assets/models in place (same paths, so
 * MODEL_CONFIGURATIONS does not change).
 *
 * Pipeline per model (glTF Transform CLI, run through `npx`, not a dependency):
 *   dedup -> weld -> prune -> resize (<=1024, wood 2048) -> webp -> meshopt
 * `meshopt` also quantizes the geometry. The scene graph is left untouched
 * (no flatten/join/simplify) so node names used for picking stay intact.
 * `resample` is a no-op: the models have no animations.
 *
 * Meant to run on the originals (restore them first, see docs/assets-pipeline.md).
 * Textures are never up-scaled, so re-running on optimized output is harmless but untested.
 *
 * Usage:  node scripts/optimize-models.mjs [modelsDir]
 * To start again from the originals see docs/assets-pipeline.md.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';

const CLI = '@gltf-transform/cli@4.5.1';
const MODELS_DIR = resolve(process.argv[2] ?? 'src/assets/models');
const MAX_TEXTURE = 1024;
const MAX_TEXTURE_WOOD = 2048;
// Textures whose name matches keep up to MAX_TEXTURE_WOOD (table wood grain).
const LARGE_TEXTURE = /wood/i;

function gt(...args) {
  execFileSync('npx', ['-y', CLI, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

/**
 * The Sketchfab "BookShelf" ships with broken source geometry: the central divider is
 * sheared into a diagonal "crack" (32 triangles with diagonal normals, inner vertices at
 * 16 different x values) and the material is BLEND, so it reads as a dark glass box.
 * The four tiers are also separate boxes with a 5 cm air gap between them, so from an oblique
 * angle the unit reads as four loose slabs instead of one piece of furniture.
 * This repairs the ORIGINAL export in place (the files in `dir`, which must be a copy of the
 * original: the script works in place, it does not make its own copy):
 *   1. drops the diagonal triangles (normal has both x and z components),
 *   2. snaps the inner vertices (|x| < 0.87) to a single central divider line (x = -0.1),
 *   3. closes the gaps between tiers (each tier grows half a gap up/down, so sides, back and
 *      boards of neighbouring tiers meet and the carcass reads as one closed box),
 *   4. makes the material opaque (no alphaMode).
 * Skipped when the model is already compressed (nothing to repair on optimized output).
 */
function repairBookshelf(dir) {
  const gltfPath = join(dir, 'scene.gltf');
  const gltf = JSON.parse(readFileSync(gltfPath, 'utf8'));
  if ((gltf.extensionsUsed ?? []).includes('EXT_meshopt_compression')) return;
  const binPath = join(dir, gltf.buffers[0].uri);
  const bin = Buffer.from(readFileSync(binPath));
  const primitive = gltf.meshes[0].primitives[0];
  const positions = gltf.accessors[primitive.attributes.POSITION];
  const normals = gltf.accessors[primitive.attributes.NORMAL];
  const indices = gltf.accessors[primitive.indices];
  if (
    positions.componentType !== 5126 ||
    indices.componentType !== 5125 ||
    positions.count !== 384
  ) {
    throw new Error(
      'Unexpected bookshelf layout: restore the original export first (docs/assets-pipeline.md).'
    );
  }
  const floats = acc => {
    const view = gltf.bufferViews[acc.bufferView];
    return new Float32Array(
      bin.buffer,
      bin.byteOffset + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0),
      acc.count * 3
    );
  };
  const pos = floats(positions);
  const nor = floats(normals);
  const indexView = gltf.bufferViews[indices.bufferView];
  const idx = new Uint32Array(
    bin.buffer,
    bin.byteOffset + (indexView.byteOffset ?? 0) + (indices.byteOffset ?? 0),
    indices.count
  );
  const kept = [];
  for (let t = 0; t < idx.length; t += 3) {
    const v = idx[t];
    const diagonal =
      Math.abs(nor[v * 3]) > 0.05 && Math.abs(nor[v * 3 + 2]) > 0.05;
    if (!diagonal) kept.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  new Uint32Array(
    bin.buffer,
    bin.byteOffset + (indexView.byteOffset ?? 0),
    kept.length
  ).set(kept);
  indices.count = kept.length;
  indexView.byteLength = kept.length * 4;
  for (let i = 0; i < positions.count; i++) {
    const x = pos[i * 3];
    if (Math.abs(x) < 0.87) pos[i * 3] = -0.1;
  }
  // Tiers (z, source units): the vertices of each one stretch to the middle of the gap
  // above/below, so neighbouring tiers touch.
  const TIERS = [
    [0, 0.508],
    [0.559, 1.041],
    [1.092, 1.575],
    [1.626, 2.1336],
  ];
  for (let i = 0; i < positions.count; i++) {
    const z = pos[i * 3 + 2];
    const k = TIERS.findIndex(([lo, hi]) => z >= lo - 1e-3 && z <= hi + 1e-3);
    if (k < 0) continue;
    const [lo, hi] = TIERS[k];
    const newLo = k === 0 ? lo : (TIERS[k - 1][1] + lo) / 2;
    const newHi = k === TIERS.length - 1 ? hi : (hi + TIERS[k + 1][0]) / 2;
    pos[i * 3 + 2] = newLo + ((z - lo) / (hi - lo)) * (newHi - newLo);
  }
  delete gltf.materials[0].alphaMode;
  writeFileSync(binPath, bin);
  writeFileSync(gltfPath, JSON.stringify(gltf));
  console.log(
    `bookshelf repaired: ${kept.length / 3} triangles kept, opaque material`
  );
}

function dirSize(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = join(dir, e.name);
    return sum + (e.isDirectory() ? dirSize(p) : statSync(p).size);
  }, 0);
}

const models = readdirSync(MODELS_DIR, { withFileTypes: true })
  .filter(
    e => e.isDirectory() && existsSync(join(MODELS_DIR, e.name, 'scene.gltf'))
  )
  .map(e => e.name);

const work = mkdtempSync(join(tmpdir(), 'rtad-models-'));
try {
  for (const name of models) {
    const dir = join(MODELS_DIR, name);
    const before = dirSize(dir);
    const step = n => join(work, name, `${n}`, 'scene.gltf');
    for (const n of ['1', '2', '3', '4', '5', '6'])
      mkdirSync(join(work, name, n), { recursive: true });

    if (name === 'bookshelf') repairBookshelf(dir);
    gt('dedup', join(dir, 'scene.gltf'), step(1));
    gt('weld', step(1), step(2));
    // Unused attributes (e.g. UVs on the untextured sofa) are dropped here.
    gt('prune', step(2), step(3), '--keep-attributes', 'false');
    // Large textures first (their cap is higher), then every other texture.
    // The CLI pattern has no reliable negation, so the "others" pattern is an explicit list.
    const images =
      JSON.parse(readFileSync(join(dir, 'scene.gltf'), 'utf8')).images ?? [];
    const names = images.map(i =>
      basename(decodeURIComponent(i.uri ?? ''), extname(i.uri ?? ''))
    );
    const large = names.filter(n => LARGE_TEXTURE.test(n));
    const rest = names.filter(n => n && !LARGE_TEXTURE.test(n));
    let current = step(3);
    const resize = (out, size, list) => {
      if (!list.length) {
        gt('copy', current, step(out));
        current = step(out);
        return;
      }
      gt(
        'resize',
        current,
        step(out),
        '--width',
        String(size),
        '--height',
        String(size),
        '--pattern',
        list.length > 1 ? `*{${list.join(',')}}*` : `*${list[0]}*`
      );
      current = step(out);
    };
    resize(4, MAX_TEXTURE_WOOD, large);
    resize(5, MAX_TEXTURE, rest);
    gt('webp', current, step(6));
    const final = join(work, name, 'final');
    mkdirSync(final, { recursive: true });
    gt('meshopt', step(6), join(final, 'scene.gltf'), '--level', 'high');

    rmSync(dir, { recursive: true, force: true });
    cpSync(final, dir, { recursive: true });
    const after = dirSize(dir);
    console.log(
      `${name}: ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB`
    );
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
