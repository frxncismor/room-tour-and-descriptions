#!/usr/bin/env node
/**
 * Generates the procedural sectional sofa (corner sofa with chaise and ottoman)
 * as src/assets/models/sofa/scene.gltf + scene.bin. Original work, no third-party
 * geometry (it replaced the Sketchfab "Sofa Set" in fix 11).
 *
 * Plain Node, no dependencies. One mesh, one material (the scene tints it through
 * `materialOverride`). Local frame: x = width, y = up, z = depth, front at +z,
 * chaise on the -x side. Run `node scripts/optimize-models.mjs` afterwards
 * (meshopt + quantization) and copy nothing else.
 *
 * Usage: node scripts/generate-sofa.mjs [outDir]   (default src/assets/models/sofa)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OUT = resolve(process.argv[2] ?? 'src/assets/models/sofa');

const positions = [];
const normals = [];
const indices = [];

/** Breakpoints along one axis of a rounded box: dense in the rounded corners. */
function breaks(h, r) {
  const inner = Math.max(h - r, 0);
  const t = a => r * Math.tan((a * Math.PI) / 180);
  const upper = [inner, inner + t(15), inner + t(30), h];
  return [...upper.map(v => -v).reverse(), ...upper];
}

/** Adds a rounded box (centre c, half-sizes h, corner radius r). */
function roundedBox(c, h, r) {
  const ax = [breaks(h[0], r), breaks(h[1], r), breaks(h[2], r)];
  const inner = h.map(v => Math.max(v - r, 0));
  const clamp = (v, m) => Math.min(Math.max(v, -m), m);
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [-1, 1]) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      const base = positions.length / 3;
      const nu = ax[u].length;
      const nv = ax[v].length;
      for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
          const p = [0, 0, 0];
          p[axis] = sign * h[axis];
          p[u] = ax[u][i];
          p[v] = ax[v][j];
          // Project onto the rounded surface: inner box + r along the offset.
          const q = p.map((x, k) => clamp(x, inner[k]));
          const d = p.map((x, k) => x - q[k]);
          const len = Math.hypot(...d) || 1;
          const n = d.map(x => x / len);
          positions.push(
            c[0] + q[0] + n[0] * r,
            c[1] + q[1] + n[1] * r,
            c[2] + q[2] + n[2] * r
          );
          normals.push(...n);
        }
      }
      for (let j = 0; j < nv - 1; j++) {
        for (let i = 0; i < nu - 1; i++) {
          const a = base + j * nu + i;
          const b = a + 1;
          const d = a + nu;
          const e = d + 1;
          // (u, v, axis) is a right-handed cycle: +axis faces wind (a, b, e).
          indices.push(...(sign > 0 ? [a, b, e, a, e, d] : [a, e, b, a, d, e]));
        }
      }
    }
  }
}

/** Box from min/max corners. */
function box(min, max, r) {
  const c = min.map((v, k) => (v + max[k]) / 2);
  const h = min.map((v, k) => (max[k] - v) / 2);
  roundedBox(c, h, Math.min(r, ...h));
}

// ───────────────────────── Layout (metres) ─────────────────────────
const X0 = -1.85; // chaise side
const X1 = 1.85; // right arm
const ZB = -0.5; // back
const ZF = 0.5; // front of the 3-seat run
const ZC = 2.2; // front of the chaise
const GAP = 0.012;

// Plinth (inset, reads as a shadow gap) and frame.
box([X0 + 0.08, 0.0, ZB + 0.06], [X1 - 0.08, 0.1, ZF - 0.06], 0.02);
box([X0 + 0.08, 0.0, ZF - 0.2], [X0 + 1.15, 0.1, ZC - 0.06], 0.02);
box([X0, 0.1, ZB], [X1, 0.36, ZF], 0.05);
box([X0, 0.1, ZF - 0.1], [X0 + 1.2, 0.36, ZC], 0.05);

// Arms: low rolled arm on the chaise side, taller on the right.
box([X0, 0.1, ZB], [X0 + 0.2, 0.66, ZC], 0.08);
box([X1 - 0.22, 0.1, ZB], [X1, 0.68, ZF], 0.08);

// Back (structure) between the arms.
box([X0 + 0.2, 0.3, ZB], [X1 - 0.22, 0.88, ZB + 0.22], 0.07);

// Seat cushions of the run: three, from the chaise side.
const runX0 = X0 + 1.2; // run seats start where the chaise ends
const seatW = (X1 - 0.22 - runX0) / 3;
for (let k = 0; k < 3; k++) {
  box(
    [runX0 + k * seatW + GAP, 0.36, ZB + 0.22],
    [runX0 + (k + 1) * seatW - GAP, 0.55, ZF],
    0.075
  );
}
// Chaise cushion (long).
box([X0 + 0.2 + GAP, 0.36, ZB + 0.22], [runX0 - GAP, 0.55, ZC], 0.075);

// Back cushions: three, slightly proud of the back.
const backW = (X1 - 0.22 - (X0 + 0.2)) / 4;
for (let k = 0; k < 4; k++) {
  box(
    [X0 + 0.2 + k * backW + GAP, 0.55, ZB + 0.2],
    [X0 + 0.2 + (k + 1) * backW - GAP, 1.0, ZB + 0.42],
    0.1
  );
}

// Ottoman (part of the model, as in the original).
const OX = 0.5;
const OZ = 1.6;
box([OX - 0.45, 0.0, OZ - 0.42], [OX + 0.45, 0.07, OZ + 0.42], 0.02);
box([OX - 0.45, 0.07, OZ - 0.42], [OX + 0.45, 0.43, OZ + 0.42], 0.09);

// ───────────────────────── glTF ─────────────────────────
const pos = new Float32Array(positions);
const nor = new Float32Array(normals);
const idx = new Uint32Array(indices);
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3)
  for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], pos[i + k]);
    max[k] = Math.max(max[k], pos[i + k]);
  }

const buffers = [pos, nor, idx].map(a => Buffer.from(a.buffer));
const total = buffers.reduce((s, b) => s + b.length, 0);
const gltf = {
  asset: { version: '2.0', generator: 'scripts/generate-sofa.mjs' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'sofa', mesh: 0 }],
  meshes: [
    {
      name: 'sofa',
      primitives: [
        { attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 },
      ],
    },
  ],
  materials: [
    {
      name: 'sofa_fabric',
      pbrMetallicRoughness: {
        baseColorFactor: [0.55, 0.3, 0.19, 1],
        roughnessFactor: 0.9,
        metallicFactor: 0,
      },
    },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: pos.length / 3,
      type: 'VEC3',
      min,
      max,
    },
    { bufferView: 1, componentType: 5126, count: nor.length / 3, type: 'VEC3' },
    { bufferView: 2, componentType: 5125, count: idx.length, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: buffers[0].length, target: 34962 },
    {
      buffer: 0,
      byteOffset: buffers[0].length,
      byteLength: buffers[1].length,
      target: 34962,
    },
    {
      buffer: 0,
      byteOffset: buffers[0].length + buffers[1].length,
      byteLength: buffers[2].length,
      target: 34963,
    },
  ],
  buffers: [{ uri: 'scene.bin', byteLength: total }],
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'scene.gltf'), JSON.stringify(gltf));
writeFileSync(join(OUT, 'scene.bin'), Buffer.concat(buffers));
console.log(
  `sofa: ${idx.length / 3} tris, size ${(max[0] - min[0]).toFixed(2)} x ${(max[1] - min[1]).toFixed(2)} x ${(max[2] - min[2]).toFixed(2)} m, centre x ${((max[0] + min[0]) / 2).toFixed(3)} z ${((max[2] + min[2]) / 2).toFixed(3)}`
);
