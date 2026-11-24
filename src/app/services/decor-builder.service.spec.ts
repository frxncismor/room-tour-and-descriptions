import {
  AlwaysStencilFunc,
  Box3,
  BufferGeometry,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  ReplaceStencilOp,
  Texture,
  Vector3,
} from 'three';
import { DECOR3, DECOR3_LOAD_KEYS } from '../config/decor.config';
import {
  createCushionGeometry,
  createThrowGeometry,
  DecorBuild,
  DecorBuilderService,
  DecorTextures,
} from './decor-builder.service';

/**
 * AABB REAL del sofá cargado (T-343): medida con GLTFLoader sobre
 * assets/models/sofa (rotación π/4 en Y, centrado en (-3, -3), base en y = 0),
 * el mismo cálculo que ModelLoaderService.applyTransformations. La aproximada
 * (-5,65…-0,35) sobreestimaba la caja en 0,5 m por lado.
 */
const SOFA = new Box3(
  new Vector3(-5.16, 0, -5.595),
  new Vector3(-0.84, 1.332, -0.405)
);
/** Altura del asiento del sofá (cojines de asiento, medida en el glTF). */
const SEAT_TOP = 0.585;
/** AABB aproximadas del resto de muebles (plan §1). */
const FURNITURE: Record<string, Box3> = {
  sofa: SOFA,
  pokerTable: new Box3(
    new Vector3(3 - 0.652, 0, -3 - 0.652),
    new Vector3(3 + 0.652, 1.089, -3 + 0.652)
  ),
  bookshelf: new Box3(
    new Vector3(-0.9145, 0, -7.6 - 0.197),
    new Vector3(0.9145, 2.134, -7.6 + 0.197)
  ),
  // Altura generosa (cota superior) para jarrón y suculenta.
  vase: new Box3(new Vector3(-2.1, 0, -7.8), new Vector3(-1.6, 1, -7.3)),
  succulent: new Box3(new Vector3(1.6, 0, -7.8), new Vector3(2.1, 1, -7.3)),
};

function meshes(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse(object => {
    if ((object as Mesh).isMesh) {
      found.push(object as Mesh);
    }
  });
  return found;
}

function triangles(mesh: Mesh): number {
  const geometry = mesh.geometry;
  return (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
}

function fakeTextures(): Record<string, Texture> {
  return Object.fromEntries(DECOR3_LOAD_KEYS.map(key => [key, new Texture()]));
}

describe('DecorBuilderService', () => {
  const service = new DecorBuilderService();
  let build: DecorBuild;

  beforeEach(() => {
    build = service.build(DECOR3, {});
  });

  afterEach(() => build.dispose());

  describe('geometría', () => {
    it('crea los grupos wall-art, fixtures y textiles dentro de decor3', () => {
      expect(build.group.name).toBe('decor3');
      expect(build.group.children.map(c => c.name)).toEqual([
        'wall-art',
        'fixtures',
        'textiles',
      ]);
    });

    it('usa como máximo 20 mallas y 9 000 triángulos', () => {
      const all = meshes(build.group);
      expect(all.length).toBeGreaterThan(0);
      expect(all.length).toBeLessThanOrEqual(20);
      const total = all.reduce((sum, mesh) => sum + triangles(mesh), 0);
      expect(total).toBeLessThanOrEqual(9000);
    });

    it('fusiona por material: ninguna malla comparte material con otra', () => {
      const all = meshes(build.group);
      expect(new Set(all.map(m => m.material)).size).toBe(all.length);
    });

    it('anula el raycast y no proyecta sombra en ninguna malla', () => {
      for (const mesh of meshes(build.group)) {
        expect(mesh.castShadow).toBe(false);
        expect(mesh.raycast).not.toBe(Mesh.prototype.raycast);
        const hits: unknown[] = [];
        mesh.raycast({} as never, hits as never);
        expect(hits).toHaveLength(0);
      }
    });

    it('deja halos aditivos sin escritura de profundidad y cristal/halos sin tone mapping', () => {
      const byName = (name: string): Material =>
        meshes(build.group).find(m => m.name === name)!.material as Material;
      const halo = byName('halo');
      expect(halo.depthWrite).toBe(false);
      expect(halo.transparent).toBe(true);
      expect(halo.blending).toBe(2); // AdditiveBlending
      expect(halo.toneMapped).toBe(false);
      expect(byName('glass').toneMapped).toBe(false);
    });

    it('tiene 4 láminas, 2 apliques, 1 ventana, 2 paños, 1 lámpara, 2 cojines y 1 manta', () => {
      const count = (kind: string) =>
        build.pieces.filter(p => p.kind === kind).length;
      expect(count('frame')).toBe(4);
      expect(count('sconce')).toBe(2);
      expect(count('window')).toBe(1);
      expect(count('curtain')).toBe(2);
      expect(count('lamp')).toBe(1);
      expect(count('cushion')).toBe(2);
      expect(count('throw')).toBe(1);
    });

    it('todos los vértices son finitos', () => {
      for (const mesh of meshes(build.group)) {
        const position = mesh.geometry.getAttribute('position');
        for (const value of position.array) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    });
  });

  describe('texturas', () => {
    it('funciona sin texturas (color plano)', () => {
      for (const mesh of meshes(build.group)) {
        const material = mesh.material as Material & {
          map?: Texture | null;
          normalMap?: Texture | null;
        };
        if (mesh.name.startsWith('art:') || mesh.name.startsWith('textile:')) {
          expect(material.map ?? null).toBeNull();
        }
      }
      expect(meshes(build.group).length).toBeGreaterThan(0);
    });

    it('acepta valores null', () => {
      const nulls: DecorTextures = Object.fromEntries(
        DECOR3_LOAD_KEYS.map(key => [key, null])
      );
      const other = service.build(DECOR3, nulls);
      expect(meshes(other.group).length).toBe(meshes(build.group).length);
      other.dispose();
    });

    it('al construir, solo cojines, manta y libros escriben stencil = 1 (silueta de su mueble)', () => {
      const textureSet = service.build(DECOR3, fakeTextures());
      for (const mesh of meshes(textureSet.group)) {
        const m = mesh.material as Material;
        const hosted =
          mesh.name.startsWith('textile:') || mesh.name === 'books';
        expect(m.stencilWrite, mesh.name).toBe(hosted);
        if (hosted) {
          expect(m.stencilRef, mesh.name).toBe(1);
          expect(m.stencilFunc, mesh.name).toBe(AlwaysStencilFunc);
          expect(m.stencilZPass, mesh.name).toBe(ReplaceStencilOp);
        }
      }
      textureSet.dispose();
    });

    it('R8-M3: setSilhouette("sofa", false) quita el stencil de cojines y manta (no recortan el contorno de otros muebles) y (true) lo devuelve', () => {
      const textureSet = service.build(DECOR3, fakeTextures());
      const textiles = meshes(textureSet.group).filter(m =>
        m.name.startsWith('textile:')
      );
      const books = meshes(textureSet.group).find(m => m.name === 'books')!;
      expect(textiles.length).toBe(3);
      textureSet.setSilhouette('sofa', false);
      for (const mesh of textiles) {
        expect((mesh.material as Material).stencilWrite, mesh.name).toBe(false);
      }
      // El otro host no cambia.
      expect((books.material as Material).stencilWrite).toBe(true);
      textureSet.setSilhouette('sofa', true);
      for (const mesh of textiles) {
        const m = mesh.material as Material;
        expect(m.stencilWrite, mesh.name).toBe(true);
        expect(m.stencilRef, mesh.name).toBe(1);
      }
      textureSet.dispose();
    });

    it('R8-M3: setSilhouette("bookshelf", false) apaga solo los libros y no los textiles', () => {
      const textureSet = service.build(DECOR3, fakeTextures());
      textureSet.setSilhouette('bookshelf', false);
      for (const mesh of meshes(textureSet.group)) {
        expect((mesh.material as Material).stencilWrite, mesh.name).toBe(
          mesh.name.startsWith('textile:')
        );
      }
      textureSet.setSilhouette('bookshelf', true);
      expect(
        (
          meshes(textureSet.group).find(m => m.name === 'books')!
            .material as Material
        ).stencilWrite
      ).toBe(true);
      textureSet.dispose();
    });

    it('aplica lino (map + normalMap) a cortinas y textiles, y la obra a su lámina', () => {
      const textures = fakeTextures();
      const withTextures = service.build(DECOR3, textures);
      const material = (name: string) =>
        meshes(withTextures.group).find(m => m.name === name)!
          .material as Material & { map: Texture; normalMap: Texture };
      for (const name of [
        'curtain',
        'textile:cushion-cream',
        'textile:throw',
      ]) {
        expect(material(name).map).toBe(textures['fabric:linen']);
        expect(material(name).normalMap).toBe(textures['fabric:linen-nor']);
      }
      expect(material('art:spiraea').map).toBe(textures['art:spiraea']);
      withTextures.dispose();
    });
  });

  describe('dispose', () => {
    it('libera todas las geometrías, materiales y texturas y vacía el grupo', () => {
      const textures = fakeTextures();
      const full = service.build(DECOR3, textures);
      const all = meshes(full.group);
      const geometries = new Set<BufferGeometry>(all.map(m => m.geometry));
      const materials = new Set<Material>(all.map(m => m.material as Material));
      const owned = new Set<Texture>(Object.values(textures));
      // Texturas generadas por el builder (halo y cristal) dentro de los materiales.
      for (const material of materials) {
        const map = (material as Material & { map?: Texture | null }).map;
        if (map) {
          owned.add(map);
        }
      }
      const spies = [...geometries, ...materials, ...owned].map(item => {
        const spy = vi.fn();
        item.addEventListener('dispose', spy);
        return spy;
      });

      full.dispose();

      for (const spy of spies) {
        expect(spy).toHaveBeenCalled();
      }
      expect(owned.size).toBeGreaterThanOrEqual(
        Object.keys(textures).length + 2
      );
      expect(full.group.children).toHaveLength(0);
    });

    it('puede llamarse dos veces', () => {
      expect(() => {
        build.dispose();
        build.dispose();
      }).not.toThrow();
    });
  });

  describe('colocación estática (SC-307)', () => {
    const solid = () => build.pieces.filter(p => p.kind !== 'halo');
    const textile = (kind: string) => kind === 'cushion' || kind === 'throw';

    it('ninguna pieza intersecta con otra', () => {
      const pieces = solid();
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          expect(
            pieces[i].box.intersectsBox(pieces[j].box),
            `${pieces[i].id} × ${pieces[j].id}`
          ).toBe(false);
        }
      }
    });

    it('ninguna pieza (salvo los textiles, que van sobre el sofá) intersecta con los muebles', () => {
      for (const piece of solid().filter(p => !textile(p.kind))) {
        for (const [name, box] of Object.entries(FURNITURE)) {
          expect(piece.box.intersectsBox(box), `${piece.id} × ${name}`).toBe(
            false
          );
        }
      }
    });

    it('los textiles evitan mesa, estantería, jarrón y suculenta y se apoyan en el sofá', () => {
      for (const piece of solid().filter(p => textile(p.kind))) {
        expect(piece.box.intersectsBox(SOFA), piece.id).toBe(true);
        for (const [name, box] of Object.entries(FURNITURE)) {
          if (name !== 'sofa') {
            expect(piece.box.intersectsBox(box), `${piece.id} × ${name}`).toBe(
              false
            );
          }
        }
      }
    });

    it('la manta interseca la AABB del sofá en al menos el 25 % de su volumen', () => {
      const blanket = build.pieces.find(p => p.kind === 'throw')!.box;
      const overlap = blanket.clone().intersect(SOFA);
      const size = (box: Box3) => box.getSize(new Vector3());
      const volume = (box: Box3) => {
        const s = size(box);
        return s.x * s.y * s.z;
      };
      expect(volume(overlap) / volume(blanket)).toBeGreaterThanOrEqual(0.25);
    });

    it('cada cojín interseca la AABB real del sofá en al menos el 25 % de su volumen', () => {
      const volume = (box: Box3) => {
        const s = box.getSize(new Vector3());
        return s.x * s.y * s.z;
      };
      for (const { id, box } of build.pieces.filter(
        p => p.kind === 'cushion'
      )) {
        const overlap = box.clone().intersect(SOFA);
        expect(volume(overlap) / volume(box), id).toBeGreaterThanOrEqual(0.25);
      }
    });

    it('cojines y manta quedan dentro de la AABB real del sofá y apoyados en el asiento', () => {
      for (const { id, kind, box } of build.pieces.filter(p =>
        textile(p.kind)
      )) {
        expect(SOFA.containsBox(box), id).toBe(true);
        // Los cojines no se hunden en el asiento (holgura 2 cm); la manta puede
        // caer hasta su  por el borde delantero.
        const slack =
          kind === 'throw' ? DECOR3.textiles.throw.drape + 0.02 : 0.02;
        expect(box.min.y, id).toBeGreaterThanOrEqual(SEAT_TOP - slack);
        expect(box.min.y, id).toBeLessThanOrEqual(SEAT_TOP + 0.05);
      }
    });

    it('los cojines descansan sobre el asiento (y ∈ [0,60; 0,95]) y con ≥ 0,05 m entre ellos', () => {
      const cushions = build.pieces.filter(p => p.kind === 'cushion');
      for (const { box } of cushions) {
        const centre = box.getCenter(new Vector3());
        expect(centre.y).toBeGreaterThanOrEqual(0.6);
        expect(centre.y).toBeLessThanOrEqual(0.95);
      }
      expect(
        cushions[0].box.distanceToPoint(
          cushions[1].box.getCenter(new Vector3())
        )
      ).toBeGreaterThan(0.05);
    });

    it('marcos a 0,02–0,06 m del muro (cara trasera)', () => {
      for (const frame of build.pieces.filter(p => p.kind === 'frame')) {
        const art = DECOR3.artworks.find(a => a.id === frame.id)!;
        const onBack = Math.abs(art.rotationY) < 1e-6;
        const back = onBack ? 8 + frame.box.min.z : 8 - frame.box.max.x; // pared derecha (x = +8)
        expect(back, frame.id).toBeGreaterThanOrEqual(0.02);
        expect(back, frame.id).toBeLessThanOrEqual(0.06);
      }
    });

    it('apliques a 0,02–0,06 m del muro del fondo', () => {
      for (const sconce of build.pieces.filter(p => p.kind === 'sconce')) {
        const gap = 8 + sconce.box.min.z;
        expect(gap).toBeGreaterThanOrEqual(0.02);
        expect(gap).toBeLessThanOrEqual(0.06);
      }
    });

    it('cortinas dentro de la sala y sin tocar la ventana (el antepecho sobresale 0,12 m)', () => {
      const win = build.pieces.find(p => p.kind === 'window')!;
      for (const curtain of build.pieces.filter(p => p.kind === 'curtain')) {
        // Spec A.1.5 pide 0,02–0,06 m para marcos y cortinas, pero A.2 las
        // coloca en x = −7,80 (0,20 m) para librar el antepecho: se prueba eso.
        const gap = curtain.box.min.x + 8;
        expect(gap).toBeGreaterThan(win.box.max.x + 8);
        expect(gap).toBeLessThan(0.25);
      }
    });

    it('la lámpara queda a ≥ 1,0 m del sofá y a ≥ 0,75 m de cada muro', () => {
      const centre = DECOR3.floorLamp.position;
      const lamp = build.pieces.find(p => p.kind === 'lamp')!.box;
      expect(
        lamp.distanceToPoint(SOFA.getCenter(new Vector3()))
      ).toBeGreaterThan(0);
      const toSofa = Math.hypot(
        Math.max(SOFA.min.x - lamp.max.x, lamp.min.x - SOFA.max.x, 0),
        Math.max(SOFA.min.z - lamp.max.z, lamp.min.z - SOFA.max.z, 0)
      );
      expect(toSofa).toBeGreaterThanOrEqual(1.0);
      // Spec A.2 fija la lámpara en (−7,2; −7,2): 0,8 m de cada muro.
      expect(centre.x + 8).toBeGreaterThanOrEqual(0.75);
      expect(centre.z + 8).toBeGreaterThanOrEqual(0.75);
    });

    it('los apliques quedan a ≥ 0,9 m (eje a borde) de la estantería', () => {
      // La spec mide desde el eje de la placa (0,94 m); la pantalla llega a 0,85 m.
      for (const position of DECOR3.sconces.positions) {
        const gap = Math.abs(position.x) - FURNITURE['bookshelf'].max.x;
        expect(gap).toBeGreaterThanOrEqual(0.9);
      }
    });
  });
  describe('textiles (pulido de cojines y manta)', () => {
    const { cushionSize, cushionThickness, cushionPuff } = DECOR3.textiles;
    const half = cushionSize / 2;

    it('el cojín tiene esquinas y bordes redondeados (sin vértices en la esquina de la caja)', () => {
      const geometry = createCushionGeometry(DECOR3.textiles);
      const position = geometry.getAttribute('position');
      let maxRadial = 0;
      let maxZ = 0;
      for (let i = 0; i < position.count; i++) {
        maxRadial = Math.max(
          maxRadial,
          Math.hypot(position.getX(i), position.getY(i))
        );
        maxZ = Math.max(maxZ, Math.abs(position.getZ(i)));
      }
      // Esquina viva de la caja: half·√2 ≈ 0,318 m.
      expect(maxRadial).toBeLessThan(half * Math.SQRT2 - 0.02);
      expect(maxRadial).toBeGreaterThanOrEqual(half - 1e-6);
      // Abombado: sobresale del grosor nominal pero no más que el hinchado.
      expect(maxZ).toBeLessThanOrEqual(
        cushionThickness / 2 + cushionPuff + 1e-6
      );
      expect(maxZ).toBeGreaterThan(cushionThickness / 2);
    });

    it('el cojín lleva normales unitarias suaves (sin costuras en las aristas)', () => {
      const geometry = createCushionGeometry(DECOR3.textiles);
      const normal = geometry.getAttribute('normal');
      for (let i = 0; i < normal.count; i++) {
        const length = Math.hypot(
          normal.getX(i),
          normal.getY(i),
          normal.getZ(i)
        );
        expect(length).toBeCloseTo(1, 3);
      }
    });

    it('la manta tiene grosor real (dos capas de tela con borde) y cae por el borde', () => {
      const blanket = DECOR3.textiles.throw;
      const geometry = createThrowGeometry(blanket, DECOR3.textiles.tileSize);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      // Altura local (z): grosor + caída; la caída del borde largo es ≥ 0,08 m.
      expect(box.max.z - box.min.z).toBeGreaterThanOrEqual(
        blanket.thickness + blanket.drape * 0.8
      );
      const position = geometry.getAttribute('position');
      let top = -Infinity;
      let bottomAtCentre = Infinity;
      for (let i = 0; i < position.count; i++) {
        if (
          Math.abs(position.getX(i)) < 0.05 &&
          Math.abs(position.getY(i)) < 0.05
        ) {
          top = Math.max(top, position.getZ(i));
          bottomAtCentre = Math.min(bottomAtCentre, position.getZ(i));
        }
      }
      expect(top - bottomAtCentre).toBeGreaterThanOrEqual(
        blanket.thickness * 0.9
      );
    });

    it('los textiles caben en el presupuesto: ≤ 3 200 triángulos entre cojines y manta (≤ 3 000 extra sobre la ronda 3)', () => {
      const textiles = meshes(build.group).filter(m =>
        m.name.startsWith('textile:')
      );
      const total = textiles.reduce((sum, mesh) => sum + triangles(mesh), 0);
      expect(total).toBeLessThanOrEqual(3200);
    });

    it('el cojín lleva color por vértice: más oscuro en las costuras que en el centro (volumen)', () => {
      const geometry = createCushionGeometry(DECOR3.textiles);
      const color = geometry.getAttribute('color');
      const position = geometry.getAttribute('position');
      expect(color).toBeDefined();
      let centre = 0;
      let edge = 1;
      for (let i = 0; i < color.count; i++) {
        const r = Math.hypot(position.getX(i), position.getY(i));
        if (r < 0.05 && position.getZ(i) > 0) {
          centre = Math.max(centre, color.getX(i));
        }
        if (r > half * 1.2) {
          edge = Math.min(edge, color.getX(i));
        }
      }
      expect(centre).toBeGreaterThan(0.95);
      expect(edge).toBeLessThan(0.85);
    });

    it('la manta tiene franjas de borde (color por vértice) y flecos en los extremos', () => {
      const blanket = DECOR3.textiles.throw;
      const geometry = createThrowGeometry(blanket, DECOR3.textiles.tileSize);
      const color = geometry.getAttribute('color');
      expect(color).toBeDefined();
      let min = 1;
      let max = 0;
      for (let i = 0; i < color.count; i++) {
        min = Math.min(min, color.getX(i));
        max = Math.max(max, color.getX(i));
      }
      expect(max).toBeGreaterThan(0.95);
      expect(min).toBeLessThan(0.8);
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.max.x).toBeGreaterThan(
        blanket.width / 2 + blanket.fringe * 0.8
      );
      expect(geometry.boundingBox!.min.x).toBeLessThan(
        -(blanket.width / 2 + blanket.fringe * 0.8)
      );
    });

    it('los materiales de cojines y manta usan color por vértice', () => {
      for (const mesh of meshes(build.group).filter(m =>
        m.name.startsWith('textile:')
      )) {
        expect((mesh.material as Material).vertexColors, mesh.name).toBe(true);
      }
    });
  });

  describe('lámparas y apliques con volumen (R8-M4)', () => {
    const named = (name: string) =>
      meshes(build.group).filter(m => m.name === name);

    it('la pantalla de la lámpara de pie es la malla propia `floorLamp:shade` con material emisivo no compartido', () => {
      const [shade, ...others] = named('floorLamp:shade');
      expect(shade).toBeDefined();
      expect(others).toHaveLength(0);
      const material = shade.material as MeshStandardMaterial;
      expect(material.isMeshStandardMaterial).toBe(true);
      expect(material.emissiveIntensity).toBeGreaterThan(0);
      const sharing = meshes(build.group).filter(
        m => m !== shade && m.material === material
      );
      expect(sharing).toHaveLength(0);
      expect(shade.parent?.name).toBe('fixtures');
    });

    it('apagar `floorLamp:shade` no apaga los apliques (material distinto)', () => {
      const lamp = named('floorLamp:shade')[0].material as MeshStandardMaterial;
      const sconce = named('sconce-shade')[0].material as MeshStandardMaterial;
      expect(sconce).not.toBe(lamp);
      lamp.emissiveIntensity = 0;
      expect(sconce.emissiveIntensity).toBeGreaterThan(0);
    });

    it('la pantalla de la lámpara es un volumen: cono con tapa y bombilla (no un plano)', () => {
      const shade = named('floorLamp:shade')[0];
      shade.geometry.computeBoundingBox();
      const box = shade.geometry.boundingBox!;
      const lamp = DECOR3.floorLamp;
      expect(box.max.y - box.min.y).toBeGreaterThanOrEqual(lamp.shade.height);
      expect(triangles(shade)).toBeGreaterThan(150);
      expect(lamp.shade.radiusTop).toBeLessThan(lamp.shade.radius);
    });

    it('los apliques tienen tapa y bombilla (más de 250 triángulos de pantalla por aplique)', () => {
      const shade = named('sconce-shade')[0];
      expect(
        triangles(shade) / DECOR3.sconces.positions.length
      ).toBeGreaterThan(250);
    });
  });

  describe('estantería con libros (R8-M4)', () => {
    const books = () => meshes(build.group).find(m => m.name === 'books')!;

    it('hay una malla `books` con color por vértice', () => {
      expect(books()).toBeDefined();
      expect((books().material as Material).vertexColors).toBe(true);
      expect(books().geometry.getAttribute('color')).toBeDefined();
      expect(triangles(books())).toBeGreaterThan(100);
      expect(triangles(books())).toBeLessThanOrEqual(1200);
    });

    it('los libros caben dentro de la estantería y quedan sobre una balda', () => {
      const geometry = books().geometry;
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const shelf = FURNITURE['bookshelf'];
      expect(box.min.x).toBeGreaterThanOrEqual(shelf.min.x + 0.04);
      expect(box.max.x).toBeLessThanOrEqual(shelf.max.x - 0.04);
      expect(box.min.z).toBeGreaterThanOrEqual(shelf.min.z + 0.04);
      expect(box.max.z).toBeLessThanOrEqual(shelf.max.z - 0.01);
      expect(box.max.y).toBeLessThanOrEqual(shelf.max.y - 0.03);
      const tops = DECOR3.books.tiers.map(t => t.top);
      expect(box.min.y).toBeGreaterThanOrEqual(Math.min(...tops) - 1e-6);
    });

    it('es determinista (misma entrada, misma geometría)', () => {
      const other = service.build(DECOR3, {});
      const a = books().geometry.getAttribute('position').array;
      const b = meshes(other.group)
        .find(m => m.name === 'books')!
        .geometry.getAttribute('position').array;
      expect(Array.from(a)).toEqual(Array.from(b));
      other.dispose();
    });
  });
});
