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
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';

const CLI = '@gltf-transform/cli@4.5.1';
const MODELS_DIR = resolve(process.argv[2] ?? 'src/assets/models');
const MAX_TEXTURE = 1024;
const MAX_TEXTURE_WOOD = 2048;
// Textures whose name matches keep up to MAX_TEXTURE_WOOD (table wood grain).
const LARGE_TEXTURE = /wood/i;

function gt(...args) {
  execFileSync('npx', ['-y', CLI, ...args], { stdio: 'inherit', shell: process.platform === 'win32' });
}

function dirSize(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = join(dir, e.name);
    return sum + (e.isDirectory() ? dirSize(p) : statSync(p).size);
  }, 0);
}

const models = readdirSync(MODELS_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory() && existsSync(join(MODELS_DIR, e.name, 'scene.gltf')))
  .map(e => e.name);

const work = mkdtempSync(join(tmpdir(), 'rtad-models-'));
try {
  for (const name of models) {
    const dir = join(MODELS_DIR, name);
    const before = dirSize(dir);
    const step = (n) => join(work, name, `${n}`, 'scene.gltf');
    for (const n of ['1', '2', '3', '4', '5', '6']) mkdirSync(join(work, name, n), { recursive: true });

    gt('dedup', join(dir, 'scene.gltf'), step(1));
    gt('weld', step(1), step(2));
    // Unused attributes (e.g. UVs on the untextured sofa) are dropped here.
    gt('prune', step(2), step(3), '--keep-attributes', 'false');
    // Large textures first (their cap is higher), then every other texture.
    // The CLI pattern has no reliable negation, so the "others" pattern is an explicit list.
    const images = JSON.parse(readFileSync(join(dir, 'scene.gltf'), 'utf8')).images ?? [];
    const names = images.map(i => basename(decodeURIComponent(i.uri ?? ''), extname(i.uri ?? '')));
    const large = names.filter(n => LARGE_TEXTURE.test(n));
    const rest = names.filter(n => n && !LARGE_TEXTURE.test(n));
    let current = step(3);
    const resize = (out, size, list) => {
      if (!list.length) { gt('copy', current, step(out)); current = step(out); return; }
      gt('resize', current, step(out), '--width', String(size), '--height', String(size),
        '--pattern', list.length > 1 ? `*{${list.join(',')}}*` : `*${list[0]}*`);
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
    console.log(`${name}: ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
