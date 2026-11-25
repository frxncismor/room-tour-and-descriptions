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
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';

const CLI = '@gltf-transform/cli@4.5.1';
const MODELS_DIR = resolve(process.argv[2] ?? 'src/assets/models');
const MAX_TEXTURE = 1024;
const MAX_TEXTURE_WOOD = 2048;
// Textures whose name matches keep up to MAX_TEXTURE_WOOD (table wood grain).
const LARGE_TEXTURE = /wood/i;
// WebP quality for every texture (`gltf-transform webp --quality`).
const WEBP_QUALITY = 85;
// Per-model texture resolution for the decor pieces (spec 002). Models not listed here
// (the procedural sofa) use the defaults above. `large` names the textures that
// get `largeSize`; every other texture is capped at `size`.
// Matches nothing: used as `large` to disable the wood rule for a model.
const NEVER = /(?!)/;
const TEXTURE_POLICY = {
  landscape_painting: { large: /canvas_diff/i, largeSize: 1024, size: 512 },
  wall_clock: { size: 512 },
  // The Poly Haven originals have 8.9k (succulent) and 11.1k (vase) triangles, well above
  // the plan (6.1k / 2.8k): `simplify` brings them within the SC-202 triangle budget.
  succulent: { size: 512, simplify: { ratio: 0.7, error: 0.005 } },
  ceramic_vase: { size: 512, simplify: { ratio: 0.25, error: 0.01 } },
  // Spec 004 pieces (Poly Haven 1k originals): 512 px for the armchairs and the sideboard,
  // 256 px for the rest. `large: NEVER` stops the wood rule (names like painted_wooden_*)
  // from keeping 2048 px.
  mid_century_lounge_chair: { large: NEVER, size: 512 },
  modern_arm_chair_01: { large: NEVER, size: 512 },
  vintage_wooden_drawer_01: { large: NEVER, size: 512 },
  side_table_01: { large: NEVER, size: 256 },
  modern_coffee_table_01: { large: NEVER, size: 256 },
  painted_wooden_chair_02: { large: NEVER, size: 256 },
  wooden_display_shelves_01: { large: NEVER, size: 256 },
  painted_wooden_cabinet_02: { large: NEVER, size: 256 },
  modern_ceiling_lamp_01: { large: NEVER, size: 256 },
  // Poly Haven CC0 bookshelf and round table (R9-I5).
  wooden_bookshelf_worn: { large: NEVER, size: 512 },
  round_wooden_table_01: { large: NEVER, size: 512 },
};

function gt(...args) {
  execFileSync('npx', ['-y', CLI, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
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
    // Already optimized output is left byte-identical (re-running is not idempotent).
    const source = JSON.parse(readFileSync(join(dir, 'scene.gltf'), 'utf8'));
    if ((source.extensionsUsed ?? []).includes('EXT_meshopt_compression')) {
      console.log(`${name}: already optimized, skipped`);
      continue;
    }
    const before = dirSize(dir);
    const policy = TEXTURE_POLICY[name];
    const step = n => join(work, name, `${n}`, 'scene.gltf');
    for (const n of ['1', '2', '3', '3s', '4', '5', '6'])
      mkdirSync(join(work, name, n), { recursive: true });

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
    const largeRe = policy?.large ?? LARGE_TEXTURE;
    const large = names.filter(n => largeRe.test(n));
    const rest = names.filter(n => n && !largeRe.test(n));
    let current = step(3);
    if (policy?.simplify) {
      gt(
        'simplify',
        current,
        step('3s'),
        '--ratio',
        String(policy.simplify.ratio),
        '--error',
        String(policy.simplify.error)
      );
      current = step('3s');
    }
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
    resize(4, policy?.largeSize ?? MAX_TEXTURE_WOOD, large);
    resize(5, policy?.size ?? MAX_TEXTURE, rest);
    gt('webp', current, step(6), '--quality', String(WEBP_QUALITY));
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
