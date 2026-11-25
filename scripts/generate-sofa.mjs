#!/usr/bin/env node
/**
 * Generates the procedural sectional sofa (corner sofa with chaise and ottoman)
 * as src/assets/models/sofa/scene.gltf + scene.bin. Original work, no third-party
 * geometry (it replaced the Sketchfab "Sofa Set" in fix 11).
 *
 * Plain Node, no dependencies. One mesh, one material (the scene tints it through
 * `materialOverride`). Local frame: x = width, y = up, z = depth, front at +z,
 * chaise on the -x side.
 *
 * What makes it read as upholstery up close (fix 12, R10-I1):
 *  - UV (box projection, metres / UV_TILE) and the linen normal map that is already in
 *    the repo (`textures/fabric/linen-nor.webp`, referenced by URI, no new texture);
 *  - ambient occlusion baked per vertex into COLOR_0 (cushion seams, joins, base);
 *  - short walnut legs (vertex colour, same mesh and material) instead of a plinth;
 *  - piping (a thin cord) on the edges of the seat and back cushions;
 *  - the chaise split into three seat cushions instead of one slab.
 *
 * Usage: node scripts/generate-sofa.mjs [outDir]   (default src/assets/models/sofa)
 * Then it compresses the geometry with meshopt (glTF Transform through `npx`, not a
 * dependency) and keeps the texture URI pointing at the shared linen normal map.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const OUT = resolve(process.argv[2] ?? 'src/assets/models/sofa');
const CLI = '@gltf-transform/cli@4.5.1';
/** Where the shared linen normal map lives, relative to the glTF. */
const NORMAL_URI = '../../textures/fabric/linen-nor.webp';
const NORMAL_FILE = resolve('src/assets/textures/fabric/linen-nor.webp');
/** Side of one repeat of the linen texture, in metres (a fine, realistic weave). */
const UV_TILE = 0.2;

const positions = [];
const normals = [];
const uvs = [];
const colors = []; // tint (walnut / piping), multiplied by the baked AO at the end
const owners = []; // index of the box a vertex belongs to (skipped by its own AO)
const indices = [];
/** Axis-aligned boxes that occlude each other (the AO is computed against them). */
const occluders = [];

// ───────────────────────── Geometry helpers ─────────────────────────
const MAX_SPAN = 0.3; // flat faces get interior rows so the baked AO has resolution

/** Breakpoints along one axis of a rounded box: dense in the rounded corners. */
function breaks(h, r) {
  const inner = Math.max(h - r, 0);
  const t = a => r * Math.tan((a * Math.PI) / 180);
  const upper = [inner, inner + t(15), inner + t(30), h];
  const lower = upper.map(v => -v).reverse();
  const fill = [];
  const n = Math.ceil((2 * inner) / MAX_SPAN);
  for (let k = 1; k < n; k++) fill.push(-inner + (2 * inner * k) / n);
  return [...lower, ...fill, ...upper];
}

/** Fabric tint (white: the scene colour shows through). */
const FABRIC = [1, 1, 1];
/** Walnut over the tamed terracotta: a dark, warm brown (tuned with the scene tint). */
const WALNUT = [0.26, 0.2, 0.16];
/** Piping: a touch darker than the cushion it edges. */
const PIPING = [0.88, 0.86, 0.85];

function pushVertex(p, n, uv, tint, owner) {
  positions.push(...p);
  normals.push(...n);
  uvs.push(...uv);
  colors.push(...tint);
  owners.push(owner);
}

/** Adds a rounded box (centre c, half-sizes h, corner radius r). Returns its box index. */
function roundedBox(c, h, r, { occlude = true, seed = 0 } = {}) {
  const owner = occluders.length;
  occluders.push({
    min: c.map((v, k) => v - h[k]),
    max: c.map((v, k) => v + h[k]),
    live: occlude,
  });
  const ax = [breaks(h[0], r), breaks(h[1], r), breaks(h[2], r)];
  const inner = h.map(v => Math.max(v - r, 0));
  const clamp = (v, m) => Math.min(Math.max(v, -m), m);
  const off = [(seed * 0.37) % 1, (seed * 0.61) % 1];
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
          const w = [
            c[0] + q[0] + n[0] * r,
            c[1] + q[1] + n[1] * r,
            c[2] + q[2] + n[2] * r,
          ];
          // Box projection: the two world axes of this face, in repeats of the weave.
          const uv = [
            (w[u] + (sign > 0 ? 0 : 0.5)) / UV_TILE + off[0],
            (w[v] + (sign > 0 ? 0 : 0.5)) / UV_TILE + off[1],
          ];
          pushVertex(w, n, uv, FABRIC, owner);
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
  return owner;
}

/** Box from min/max corners. */
function box(min, max, r, options) {
  const c = min.map((v, k) => (v + max[k]) / 2);
  const h = min.map((v, k) => (max[k] - v) / 2);
  return roundedBox(c, h, Math.min(r, ...h), options);
}

/**
 * Tube along a closed path of points (piping). `radial(p, t)` is given the point and the
 * unit tangent and returns two orthonormal vectors spanning the cross section.
 */
function tube(path, radius, sides, tint, owner, seed) {
  const m = path.length;
  const base = positions.length / 3;
  let run = 0;
  for (let i = 0; i < m; i++) {
    const p = path[i];
    const nx = path[(i + 1) % m];
    const pv = path[(i + m - 1) % m];
    const t = norm([nx[0] - pv[0], nx[1] - pv[1], nx[2] - pv[2]]);
    // The cross section uses the world up (or x when the path is vertical) as reference.
    const ref = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const b1 = norm(cross(t, ref));
    const b2 = cross(t, b1);
    if (i > 0) run += Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1], p[2] - path[i - 1][2]);
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const n = [
        b1[0] * Math.cos(a) + b2[0] * Math.sin(a),
        b1[1] * Math.cos(a) + b2[1] * Math.sin(a),
        b1[2] * Math.cos(a) + b2[2] * Math.sin(a),
      ];
      pushVertex(
        [p[0] + n[0] * radius, p[1] + n[1] * radius, p[2] + n[2] * radius],
        n,
        [run / UV_TILE + seed * 0.13, (s / sides) * 0.1],
        tint,
        owner
      );
    }
  }
  const row = sides + 1;
  for (let i = 0; i < m; i++) {
    const i2 = (i + 1) % m;
    for (let s = 0; s < sides; s++) {
      const a = base + i * row + s;
      const b = base + i2 * row + s;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
}

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = a => {
  const l = Math.hypot(...a) || 1;
  return a.map(x => x / l);
};

/**
 * Piping along the crest of the rounded edge between the +/-`axis` face of a rounded box
 * and its sides: a rounded rectangle on the 45 degree line of the edge.
 */
function piping(box, axis, side, radius = 0.0055) {
  const { c, h, r, owner, seed } = box;
  const u = (axis + 1) % 3;
  const v = (axis + 2) % 3;
  const k = Math.SQRT1_2;
  const eu = h[u] - r + r * k;
  const ev = h[v] - r + r * k;
  const rc = r * k; // corner radius of the loop
  const level = c[axis] + side * (h[axis] - r + r * k);
  const pts = [];
  const corner = (cu, cv, from) => {
    for (let s = 0; s <= 6; s++) {
      const a = from + (s / 6) * (Math.PI / 2);
      pts.push([cu + rc * Math.cos(a), cv + rc * Math.sin(a)]);
    }
  };
  // Counter-clockwise in (u, v): corners at (+,+), (-,+), (-,-), (+,-).
  corner(c[u] + eu - rc, c[v] + ev - rc, 0);
  corner(c[u] - eu + rc, c[v] + ev - rc, Math.PI / 2);
  corner(c[u] - eu + rc, c[v] - ev + rc, Math.PI);
  corner(c[u] + eu - rc, c[v] - ev + rc, Math.PI * 1.5);
  const path = pts.map(([a, b]) => {
    const p = [0, 0, 0];
    p[axis] = level;
    p[u] = a;
    p[v] = b;
    return p;
  });
  const first = indices.length;
  tube(path, radius, 8, PIPING, owner, seed);
  // Make the winding face outwards whatever the loop direction.
  const a = indices[first] * 3;
  const b = indices[first + 1] * 3;
  const d = indices[first + 2] * 3;
  const e1 = [0, 1, 2].map(i => positions[b + i] - positions[a + i]);
  const e2 = [0, 1, 2].map(i => positions[d + i] - positions[a + i]);
  const fn = cross(e1, e2);
  const vn = [normals[a], normals[a + 1], normals[a + 2]];
  if (fn[0] * vn[0] + fn[1] * vn[1] + fn[2] * vn[2] < 0)
    for (let i = first; i < indices.length; i += 3) {
      const t = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = t;
    }
}

/** A cushion: rounded box plus the data piping needs. */
function cushion(min, max, r, seed) {
  const c = min.map((v, k) => (v + max[k]) / 2);
  const h = min.map((v, k) => (max[k] - v) / 2);
  const rr = Math.min(r, ...h);
  const owner = roundedBox(c, h, rr, { seed });
  return { c, h, r: rr, owner, seed };
}

/** Tapered walnut leg (truncated cone) standing on the floor under the frame. */
function leg(x, z, height, rTop, rBottom, seed) {
  const sides = 12;
  const base = positions.length / 3;
  const slope = (rBottom - rTop) / height;
  const top = height + 0.004; // tucked into the frame
  const owner = occluders.length;
  occluders.push({ min: [0, 0, 0], max: [0, 0, 0], live: false });
  for (const [y, rad] of [
    [0, rBottom],
    [top, rTop],
  ]) {
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const n = norm([Math.cos(a), slope, Math.sin(a)]);
      pushVertex(
        [x + Math.cos(a) * rad, y, z + Math.sin(a) * rad],
        n,
        [(s / sides) * 0.4 + seed * 0.1, y / UV_TILE],
        WALNUT,
        owner
      );
    }
  }
  const row = sides + 1;
  for (let s = 0; s < sides; s++) {
    const a = base + s;
    indices.push(a, a + row + 1, a + 1, a, a + row, a + row + 1);
  }
  // Bottom cap, so the foot is closed seen from a low angle.
  const centre = positions.length / 3;
  pushVertex([x, 0, z], [0, -1, 0], [0.5, 0.5], WALNUT, owner);
  for (let s = 0; s < sides; s++) indices.push(centre, base + s + 1, base + s);
}

// ───────────────────────── Layout (metres) ─────────────────────────
const X0 = -1.85; // chaise side
const X1 = 1.85; // right arm
const ZB = -0.5; // back
const ZF = 0.5; // front of the 3-seat run
const ZC = 2.2; // front of the chaise
const GAP = 0.012;
const LEG = 0.09; // walnut legs: 9 cm; the frame (and the 1.00 m height) is unchanged

// Frame: starts at the top of the legs (it used to start at 0.1 over a plinth).
// The frame is 3 mm inside the arms and the back, so no two faces are coplanar (z-fighting).
const E = 0.003;
box([X0 + E, LEG, ZB + E], [X1 - E, 0.36, ZF - E], 0.05);
box([X0 + E, LEG, ZF - 0.1], [X0 + 1.2, 0.36, ZC - E], 0.05);

// Arms: low rolled arm on the chaise side, taller on the right (they start above the
// base, whose corners are rounder, so no step shows at the bottom of the arm).
box([X0, 0.22, ZB], [X0 + 0.2, 0.66, ZC], 0.08);
box([X1 - 0.22, 0.22, ZB], [X1, 0.68, ZF], 0.08);

// Back (structure) between the arms.
box([X0 + 0.2, 0.3, ZB], [X1 - 0.22, 0.88, ZB + 0.22], 0.07);

const cushions = [];

// Seat cushions of the run: three, from the chaise side.
const runX0 = X0 + 1.2; // run seats start where the chaise ends
const seatW = (X1 - 0.22 - runX0) / 3;
for (let k = 0; k < 3; k++) {
  cushions.push({
    ...cushion(
      [runX0 + k * seatW + GAP, 0.36, ZB + 0.22],
      [runX0 + (k + 1) * seatW - GAP, 0.55, ZF],
      0.075,
      k + 1
    ),
    axis: 1,
  });
}
// Chaise: three cushions, the first as deep as the run seats and two for the extension.
const chaiseZ = [ZB + 0.22, ZF, (ZF + ZC) / 2, ZC];
for (let k = 0; k < 3; k++) {
  cushions.push({
    ...cushion(
      [X0 + 0.2 + GAP, 0.36, chaiseZ[k] + (k ? GAP : 0)],
      [runX0 - GAP, 0.55, chaiseZ[k + 1] - (k < 2 ? GAP : 0)],
      0.075,
      k + 4
    ),
    axis: 1,
  });
}

// Back cushions: four, slightly proud of the back; piping around their front face.
const backW = (X1 - 0.22 - (X0 + 0.2)) / 4;
for (let k = 0; k < 4; k++) {
  cushions.push({
    ...cushion(
      [X0 + 0.2 + k * backW + GAP, 0.55, ZB + 0.2],
      [X0 + 0.2 + (k + 1) * backW - GAP, 1.0, ZB + 0.42],
      0.1,
      k + 7
    ),
    axis: 2,
  });
}

// Ottoman (part of the model, as in the original).
const OX = 0.5;
const OZ = 1.6;
box([OX - 0.45, LEG, OZ - 0.42], [OX + 0.45, 0.2, OZ + 0.42], 0.05);
const pouf = {
  ...cushion([OX - 0.45, 0.2, OZ - 0.42], [OX + 0.45, 0.43, OZ + 0.42], 0.09, 11),
  axis: 1,
};
cushions.push(pouf);

// Piping: seat and ottoman tops (all around the perimeter), back cushions on their front.
for (const q of cushions) piping(q, q.axis, 1);

// Legs: under the corners of the frame, the chaise and the ottoman.
const legSpots = [
  [X0 + 0.14, ZB + 0.14],
  [0.0, ZB + 0.14],
  [X1 - 0.14, ZB + 0.14],
  [X1 - 0.14, ZF - 0.14],
  [0.4, ZF - 0.14],
  [X0 + 0.14, ZC - 0.14],
  [X0 + 1.06, ZC - 0.14],
  [X0 + 1.06, ZF - 0.14],
  [OX - 0.36, OZ - 0.33],
  [OX + 0.36, OZ - 0.33],
  [OX - 0.36, OZ + 0.33],
  [OX + 0.36, OZ + 0.33],
];
legSpots.forEach(([x, z], i) => leg(x, z, LEG, 0.032, 0.021, i));

// ───────────────────────── Baked ambient occlusion ─────────────────────────
const RAYS = 72;
const AO_DISTANCE = 0.55;
const AO_STRENGTH = 0.9;
const AO_FLOOR = 0.42;
/** Cosine-weighted hemisphere directions (Fibonacci), around +z. */
const hemi = Array.from({ length: RAYS }, (_, i) => {
  const rr = Math.sqrt((i + 0.5) / RAYS);
  const a = i * 2.399963229728653;
  return [rr * Math.cos(a), rr * Math.sin(a), Math.sqrt(1 - rr * rr)];
});

function rayBox(o, d, b) {
  let t0 = 0;
  let t1 = AO_DISTANCE;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) {
      if (o[k] < b.min[k] || o[k] > b.max[k]) return Infinity;
    } else {
      let a = (b.min[k] - o[k]) / d[k];
      let e = (b.max[k] - o[k]) / d[k];
      if (a > e) [a, e] = [e, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, e);
      if (t0 > t1) return Infinity;
    }
  }
  return t0;
}

function occlusion(p, n, owner) {
  const ref = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const t = norm(cross(n, ref));
  const b = cross(n, t);
  const o = [p[0] + n[0] * 0.002, p[1] + n[1] * 0.002, p[2] + n[2] * 0.002];
  let sum = 0;
  for (const h of hemi) {
    const d = [
      t[0] * h[0] + b[0] * h[1] + n[0] * h[2],
      t[1] * h[0] + b[1] * h[1] + n[1] * h[2],
      t[2] * h[0] + b[2] * h[1] + n[2] * h[2],
    ];
    let hit = Infinity;
    for (let i = 0; i < occluders.length; i++) {
      if (i === owner || !occluders[i].live) continue;
      hit = Math.min(hit, rayBox(o, d, occluders[i]));
    }
    // The floor.
    if (d[1] < -1e-6) {
      const tf = -o[1] / d[1];
      if (tf > 0 && tf < hit) hit = Math.min(hit, tf);
    }
    if (hit < AO_DISTANCE) sum += 1 - hit / AO_DISTANCE;
  }
  const ao = 1 - (AO_STRENGTH * sum) / RAYS;
  return Math.min(1, Math.max(AO_FLOOR, ao));
}

const count = positions.length / 3;
for (let i = 0; i < count; i++) {
  const ao = occlusion(
    positions.slice(i * 3, i * 3 + 3),
    normals.slice(i * 3, i * 3 + 3),
    owners[i]
  );
  for (let k = 0; k < 3; k++) colors[i * 3 + k] *= ao;
}

// ───────────────────────── glTF ─────────────────────────
const pos = new Float32Array(positions);
const nor = new Float32Array(normals);
const tex = new Float32Array(uvs);
const col = new Float32Array(colors);
const idx = new Uint32Array(indices);
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3)
  for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], pos[i + k]);
    max[k] = Math.max(max[k], pos[i + k]);
  }

const buffers = [pos, nor, tex, col, idx].map(a => Buffer.from(a.buffer));
const total = buffers.reduce((s, b) => s + b.length, 0);
let offset = 0;
const bufferViews = buffers.map((b, i) => {
  const view = {
    buffer: 0,
    byteOffset: offset,
    byteLength: b.length,
    target: i === 4 ? 34963 : 34962,
  };
  offset += b.length;
  return view;
});
const gltf = {
  asset: { version: '2.0', generator: 'scripts/generate-sofa.mjs' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'sofa', mesh: 0 }],
  meshes: [
    {
      name: 'sofa',
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, COLOR_0: 3 },
          indices: 4,
          material: 0,
        },
      ],
    },
  ],
  materials: [
    {
      name: 'sofa_fabric',
      pbrMetallicRoughness: {
        baseColorFactor: [0.55, 0.3, 0.19, 1],
        roughnessFactor: 0.92,
        metallicFactor: 0,
      },
      normalTexture: { index: 0, scale: 6 },
    },
  ],
  textures: [{ source: 0, sampler: 0 }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  images: [{ uri: NORMAL_URI, mimeType: 'image/webp' }],
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
    { bufferView: 2, componentType: 5126, count: tex.length / 2, type: 'VEC2' },
    { bufferView: 3, componentType: 5126, count: col.length / 3, type: 'VEC3' },
    { bufferView: 4, componentType: 5125, count: idx.length, type: 'SCALAR' },
  ],
  bufferViews,
  buffers: [{ uri: 'scene.bin', byteLength: total }],
};

// Write the raw glTF in a scratch tree that mirrors the repo layout (so the relative
// texture URI resolves), compress it, and copy the result over the model folder.
const work = mkdtempSync(join(tmpdir(), 'rtad-sofa-'));
try {
  const rawDir = join(work, 'models', 'sofa');
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(join(work, 'textures', 'fabric'), { recursive: true });
  cpSync(NORMAL_FILE, join(work, 'textures', 'fabric', 'linen-nor.webp'));
  writeFileSync(join(rawDir, 'scene.gltf'), JSON.stringify(gltf));
  writeFileSync(join(rawDir, 'scene.bin'), Buffer.concat(buffers));
  const outDir = join(work, 'out');
  mkdirSync(outDir, { recursive: true });
  execFileSync(
    'npx',
    [
      '-y',
      CLI,
      'meshopt',
      join(rawDir, 'scene.gltf'),
      join(outDir, 'scene.gltf'),
      '--level',
      'high',
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' }
  );
  // The CLI inlines or copies the texture next to the glTF; keep the shared one instead.
  const packed = JSON.parse(readFileSync(join(outDir, 'scene.gltf'), 'utf8'));
  packed.images = [{ uri: NORMAL_URI, mimeType: 'image/webp' }];
  mkdirSync(OUT, { recursive: true });
  const bin = packed.buffers[0].uri;
  writeFileSync(join(OUT, 'scene.gltf'), JSON.stringify(packed));
  cpSync(join(outDir, bin), join(OUT, bin));
  if (!existsSync(join(OUT, 'scene.bin'))) throw new Error(`missing ${bin}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(
  `sofa: ${idx.length / 3} tris, ${count} vertices, size ${(max[0] - min[0]).toFixed(2)} x ${(max[1] - min[1]).toFixed(2)} x ${(max[2] - min[2]).toFixed(2)} m, centre x ${((max[0] + min[0]) / 2).toFixed(3)} z ${((max[2] + min[2]) / 2).toFixed(3)}`
);
