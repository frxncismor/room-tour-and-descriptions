import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Vector2,
  Vector3,
} from 'three';

/**
 * Geometría procedural de las piezas (spec 004). Todo con pocas caras pero
 * con biseles y perfiles reales: nada es una caja o un cilindro sin más.
 * Las funciones devuelven geometría sin indexar (normales planas o suavizadas
 * por ángulo de arista), con `position`, `normal` y `uv`.
 */

/** Punto 2D de un contorno (en el plano XY, visto desde +Z, antihorario). */
export type Point2 = readonly [number, number];

/** Anillo de un perfil: inset hacia dentro desde el contorno y altura Z. */
export interface ProfileStep {
  inset: number;
  z: number;
}

/** Acumula triángulos con normal y UV y los convierte en una geometría. */
class MeshWriter {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];

  /** Triángulo con una normal por vértice y UV por vértice. */
  tri(
    a: Vector3,
    b: Vector3,
    c: Vector3,
    na: Vector3,
    nb: Vector3,
    nc: Vector3,
    ua: Point2,
    ub: Point2,
    uc: Point2
  ): void {
    for (const [p, n, uv] of [
      [a, na, ua],
      [b, nb, ub],
      [c, nc, uc],
    ] as const) {
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(n.x, n.y, n.z);
      this.uvs.push(uv[0], uv[1]);
    }
  }

  geometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(this.positions, 3)
    );
    geometry.setAttribute(
      'normal',
      new Float32BufferAttribute(this.normals, 3)
    );
    geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    return geometry;
  }
}

/** UV planares: la cara se proyecta sobre los dos ejes menos alineados con su normal. */
function planarUv(p: Vector3, n: Vector3, tile: number): Point2 {
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  if (ax >= ay && ax >= az) return [p.z / tile, p.y / tile];
  if (ay >= az) return [p.x / tile, p.z / tile];
  return [p.x / tile, p.y / tile];
}

/** Caja con las 12 aristas achaflanadas (44 triángulos), centrada. */
export function chamferBox(
  width: number,
  height: number,
  depth: number,
  bevel: number,
  uvTile = 0.5
): BufferGeometry {
  const half = [width / 2, height / 2, depth / 2];
  const b = Math.min(bevel, ...half.map(h => h * 0.9));
  const writer = new MeshWriter();
  const emit = (points: Vector3[]): void => {
    const centroid = new Vector3();
    points.forEach(p => centroid.add(p));
    centroid.divideScalar(points.length);
    const normal = new Vector3()
      .subVectors(points[1], points[0])
      .cross(new Vector3().subVectors(points[2], points[0]))
      .normalize();
    const ordered = [...points];
    if (normal.dot(centroid) < 0) {
      ordered.reverse();
      normal.negate();
    }
    for (let i = 1; i < ordered.length - 1; i++) {
      const [p0, p1, p2] = [ordered[0], ordered[i], ordered[i + 1]];
      writer.tri(
        p0,
        p1,
        p2,
        normal,
        normal,
        normal,
        planarUv(p0, normal, uvTile),
        planarUv(p1, normal, uvTile),
        planarUv(p2, normal, uvTile)
      );
    }
  };
  // Esquina de la cara (eje a, signo s) con los otros dos ejes en (su, sv).
  const faceCorner = (
    axis: number,
    sign: number,
    su: number,
    sv: number
  ): Vector3 => {
    const [u, v] = [0, 1, 2].filter(i => i !== axis);
    const p = [0, 0, 0];
    p[axis] = sign * half[axis];
    p[u] = su * (half[u] - b);
    p[v] = sv * (half[v] - b);
    return new Vector3(p[0], p[1], p[2]);
  };
  // 6 caras.
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [-1, 1]) {
      emit([
        faceCorner(axis, sign, -1, -1),
        faceCorner(axis, sign, 1, -1),
        faceCorner(axis, sign, 1, 1),
        faceCorner(axis, sign, -1, 1),
      ]);
    }
  }
  // 12 chaflanes: entre las caras (a1, s1) y (a2, s2).
  for (let a1 = 0; a1 < 3; a1++) {
    for (let a2 = a1 + 1; a2 < 3; a2++) {
      for (const s1 of [-1, 1]) {
        for (const s2 of [-1, 1]) {
          const corner = (
            axis: number,
            sign: number,
            other: number,
            so: number,
            sf: number
          ): Vector3 => {
            const p = [0, 0, 0];
            const free = [0, 1, 2].filter(i => i !== axis && i !== other)[0];
            p[axis] = sign * half[axis];
            p[other] = so * (half[other] - b);
            p[free] = sf * (half[free] - b);
            return new Vector3(p[0], p[1], p[2]);
          };
          emit([
            corner(a1, s1, a2, s2, -1),
            corner(a1, s1, a2, s2, 1),
            corner(a2, s2, a1, s1, 1),
            corner(a2, s2, a1, s1, -1),
          ]);
        }
      }
    }
  }
  // 8 esquinas (un triángulo entre las tres caras).
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        emit([
          new Vector3(sx * half[0], sy * (half[1] - b), sz * (half[2] - b)),
          new Vector3(sx * (half[0] - b), sy * half[1], sz * (half[2] - b)),
          new Vector3(sx * (half[0] - b), sy * (half[1] - b), sz * half[2]),
        ]);
      }
    }
  }
  return writer.geometry();
}

/** Normal hacia fuera de la arista i del contorno (antihorario). */
function edgeOutward(points: readonly Point2[], i: number): Vector2 {
  const a = points[i];
  const b = points[(i + 1) % points.length];
  return new Vector2(b[1] - a[1], a[0] - b[0]).normalize();
}

/** Contorno desplazado `inset` hacia dentro, con esquinas a inglete. */
export function insetOutline(
  points: readonly Point2[],
  inset: number
): Point2[] {
  const n = points.length;
  return points.map((p, i) => {
    const previous = edgeOutward(points, (i + n - 1) % n);
    const next = edgeOutward(points, i);
    const bisector = previous.clone().add(next);
    const cos = Math.max(bisector.length() / 2, 0.2);
    bisector.normalize();
    const scale = inset / cos;
    return [p[0] - bisector.x * scale, p[1] - bisector.y * scale] as Point2;
  });
}

/** Contorno rectangular centrado (antihorario). */
export function rectOutline(width: number, height: number): Point2[] {
  return [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2],
  ];
}

/** Contorno de un arco de medio punto sobre un rectángulo, centrado en su caja. */
export function archOutline(
  width: number,
  height: number,
  arcSegments = 12
): Point2[] {
  const radius = width / 2;
  const springY = height / 2 - radius;
  const points: Point2[] = [
    [-radius, -height / 2],
    [radius, -height / 2],
    [radius, springY],
  ];
  for (let i = 1; i < arcSegments; i++) {
    const angle = (i / arcSegments) * Math.PI;
    points.push([radius * Math.cos(angle), springY + radius * Math.sin(angle)]);
  }
  points.push([-radius, springY]);
  return points;
}

/**
 * Marco con perfil: cada anillo del perfil es el contorno desplazado `inset`
 * hacia dentro a la altura `z`; entre anillos consecutivos hay una banda.
 * Las esquinas son a inglete y las normales se suavizan solo si la arista es
 * suave (arcos), no en esquinas ni entre bandas.
 */
export function profileFrame(
  outline: readonly Point2[],
  profile: readonly ProfileStep[],
  uvTile = 0.5
): BufferGeometry {
  const writer = new MeshWriter();
  const rings = profile.map(step => insetOutline(outline, step.inset));
  const n = outline.length;
  const crease = Math.cos((40 * Math.PI) / 180);
  for (let s = 0; s < profile.length - 1; s++) {
    const [lower, upper] = [rings[s], rings[s + 1]];
    const dz = profile[s + 1].z - profile[s].z;
    const faceNormals: Vector3[] = [];
    for (let i = 0; i < n; i++) {
      // Normal de la banda i: contorno hacia fuera + pendiente del perfil.
      const out = edgeOutward(outline, i);
      const inwardStep = profile[s + 1].inset - profile[s].inset;
      const normal = new Vector3(out.x * dz, out.y * dz, inwardStep);
      faceNormals.push(normal.normalize());
    }
    const smoothAt = (i: number, side: 'prev' | 'next'): Vector3 => {
      const own = faceNormals[i];
      const other = faceNormals[(i + (side === 'prev' ? n - 1 : 1)) % n];
      return own.dot(other) > crease ? own.clone().add(other).normalize() : own;
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const p = [
        new Vector3(lower[i][0], lower[i][1], profile[s].z),
        new Vector3(lower[j][0], lower[j][1], profile[s].z),
        new Vector3(upper[j][0], upper[j][1], profile[s + 1].z),
        new Vector3(upper[i][0], upper[i][1], profile[s + 1].z),
      ];
      const ni = smoothAt(i, 'prev');
      const nj = smoothAt(j, 'next');
      // Normales por vértice: i usa el vecino anterior, j el siguiente.
      const uv = (v: Vector3): Point2 => [
        (v.x + v.z) / uvTile,
        (v.y + v.z) / uvTile,
      ];
      writer.tri(p[0], p[1], p[2], ni, nj, nj, uv(p[0]), uv(p[1]), uv(p[2]));
      writer.tri(p[0], p[2], p[3], ni, nj, ni, uv(p[0]), uv(p[2]), uv(p[3]));
    }
  }
  return fixWinding(writer.geometry());
}

/** Gira los triángulos cuyo orden contradice a su normal. */
function fixWinding(geometry: BufferGeometry): BufferGeometry {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const face = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    face.subVectors(b, a).cross(c.sub(a));
    n.fromBufferAttribute(normal, i)
      .add(new Vector3().fromBufferAttribute(normal, i + 1))
      .add(new Vector3().fromBufferAttribute(normal, i + 2));
    if (face.dot(n) < 0) {
      swapVertices(geometry, i + 1, i + 2);
    }
  }
  return geometry;
}

function swapVertices(geometry: BufferGeometry, i: number, j: number): void {
  for (const name of ['position', 'normal', 'uv']) {
    const attribute = geometry.getAttribute(name);
    const items = attribute.itemSize;
    for (let k = 0; k < items; k++) {
      const a = attribute.array[i * items + k];
      attribute.array[i * items + k] = attribute.array[j * items + k];
      attribute.array[j * items + k] = a;
    }
  }
}

/** Cono truncado de sección cuadrada (patas cónicas de mobiliario). */
export function squareTaper(
  topSide: number,
  bottomSide: number,
  height: number
): BufferGeometry {
  const geometry = new CylinderGeometry(
    (topSide * Math.SQRT2) / 2,
    (bottomSide * Math.SQRT2) / 2,
    height,
    4,
    1
  );
  geometry.rotateY(Math.PI / 4);
  return geometry;
}

/** Sólido de revolución a partir de un perfil (radio, altura), de abajo arriba. */
export function lathe(
  profile: readonly Point2[],
  segments = 16
): BufferGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments
  );
}

/** Número de triángulos de una geometría. */
export function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  return (index ? index.count : geometry.getAttribute('position').count) / 3;
}

/** Abanico plano (z fijo) sobre un contorno convexo, mirando a +Z. */
export function fanGeometry(
  outline: readonly Point2[],
  z: number,
  uvSize: Point2
): BufferGeometry {
  const writer = new MeshWriter();
  const normal = new Vector3(0, 0, 1);
  let cx = 0;
  let cy = 0;
  outline.forEach(([x, y]) => {
    cx += x;
    cy += y;
  });
  cx /= outline.length;
  cy /= outline.length;
  const uv = (x: number, y: number): Point2 => [
    x / uvSize[0] + 0.5,
    y / uvSize[1] + 0.5,
  ];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    writer.tri(
      new Vector3(cx, cy, z),
      new Vector3(a[0], a[1], z),
      new Vector3(b[0], b[1], z),
      normal,
      normal,
      normal,
      uv(cx, cy),
      uv(a[0], a[1]),
      uv(b[0], b[1])
    );
  }
  return writer.geometry();
}
