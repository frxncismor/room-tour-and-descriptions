import {
  AlwaysStencilFunc,
  BoxGeometry,
  KeepStencilOp,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  Box3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import {
  ensureOutlineNormals,
  isTranslucent,
  ObjectInteractionService,
  OUTLINE_DEPTH_PUSH,
  OUTLINE_POLYGON_OFFSET,
  OUTLINE_NORMAL_ATTRIBUTE,
  OUTLINE_THICKNESS_PX,
} from './object-interaction.service';

const VERTEX_STUB = ['void main() {', '#include <project_vertex>', '}'].join(
  '\n'
);

function makeCanvas(): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
  return el;
}

describe('ObjectInteractionService', () => {
  let service: ObjectInteractionService;
  let scene: Scene;
  let camera: PerspectiveCamera;
  let furniture: Mesh;
  let floor: Mesh;
  let canvas: HTMLElement;

  const click = (x: number, y: number) =>
    service.handleClick({ clientX: x, clientY: y }, camera, scene);

  beforeEach(() => {
    service = new ObjectInteractionService();
    canvas = makeCanvas();
    service.setCanvas(canvas);
    scene = new Scene();
    camera = new PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 5, 5);
    camera.lookAt(0, 0, 0);

    floor = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial());
    floor.name = 'floor';
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    furniture = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
    furniture.position.set(0, 0.5, 0);
    scene.add(furniture);
    service.addObject(furniture, { id: 'sofa', kind: 'furniture' });
  });

  afterEach(() => service.dispose());

  it('returns the object on a furniture click', async () => {
    const result = await click(100, 100);
    expect(result.success).toBe(true);
    expect(result.objectInfo?.id).toBe('sofa');
    expect(result.object).toBe(furniture);
    expect(result.floorPoint).toBeUndefined();
  });

  describe('touch tolerance', () => {
    /** Primer x (a la derecha del centro) donde un clic exacto ya falla el mueble. */
    async function firstMissX(): Promise<number> {
      for (let x = 100; x < 200; x++) {
        if (!(await click(x, 100)).object) return x;
      }
      throw new Error('furniture fills the view');
    }

    const touch = (x: number, y: number) =>
      service.handleClick(
        { clientX: x, clientY: y, pointerType: 'touch' },
        camera,
        scene
      );

    it('selects a piece when a touch lands a few px beside it', async () => {
      const miss = await firstMissX();
      const exact = await click(miss + 6, 100);
      expect(exact.object).toBeUndefined();
      const result = await touch(miss + 6, 100);
      expect(result.object).toBe(furniture);
      expect(result.objectInfo?.id).toBe('sofa');
      expect(result.floorPoint).toBeUndefined();
      expect(service.getSelected()).toBe(furniture);
    });

    it('does not select anything beyond the tolerance and keeps the floor click', async () => {
      const miss = await firstMissX();
      const result = await touch(miss + 40, 100);
      expect(result.object).toBeUndefined();
      expect(result.floorPoint).toBeDefined();
    });

    it('a mouse pointer gets no tolerance unless asked explicitly', async () => {
      const miss = await firstMissX();
      const mouse = await service.handleClick(
        { clientX: miss + 6, clientY: 100, pointerType: 'mouse' },
        camera,
        scene
      );
      expect(mouse.object).toBeUndefined();
      const explicit = await service.handleClick(
        { clientX: miss + 6, clientY: 100 },
        camera,
        scene,
        { tolerancePx: 14 }
      );
      expect(explicit.object).toBe(furniture);
    });

    it('a direct touch on the piece still selects it', async () => {
      expect((await touch(100, 100)).object).toBe(furniture);
    });
  });

  it('returns a validated floorPoint on a floor click', async () => {
    const result = await click(100, 190);
    expect(result.success).toBe(true);
    expect(result.objectInfo).toBeNull();
    expect(result.floorPoint).toBeDefined();
  });

  it('clamps the floor point and rejects far-out clicks', async () => {
    service.setRoomLimits({ minX: -3, maxX: 3, minZ: -3, maxZ: 3 });
    // Límite útil: ±1.5. Cerca del borde se recorta.
    camera.position.set(0, 10, 0.01);
    camera.lookAt(0, 0, 0);
    const clamped = await click(100 + 20, 100);
    expect(clamped.floorPoint).toBeDefined();
    expect(Math.abs(clamped.floorPoint!.x)).toBeLessThanOrEqual(1.5);
    // Muy fuera de límites: se descarta.
    service.setRoomLimits({ minX: -1, maxX: 1, minZ: -1, maxZ: 1 });
    const far = await click(100 + 90, 100 - 90);
    expect(far.floorPoint).toBeUndefined();
  });

  it('uses the canvas rect, not event.target', async () => {
    const other = document.createElement('div');
    other.getBoundingClientRect = () =>
      ({ left: 500, top: 500, width: 10, height: 10 }) as DOMRect;
    const result = await service.handleClick(
      { clientX: 100, clientY: 100, target: other },
      camera,
      scene
    );
    expect(result.object).toBe(furniture);
  });

  it('reports failure when no element is available', async () => {
    service.setCanvas(null);
    const result = await click(100, 100);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('keeps a single outline as child, with no pending rAF after 10 clicks', async () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
    for (let i = 0; i < 10; i++) await click(100, 100);
    const outlines = () =>
      scene.children
        .flatMap(c => [c, ...c.children])
        .filter(c => c.name === '__selection-outline');
    expect(outlines().length).toBe(1);
    expect(furniture.children.length).toBe(1);
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
  });

  it('removes the outline on deselect and when clicking elsewhere', async () => {
    await click(100, 100);
    expect(furniture.children.length).toBe(1);
    await click(100, 190);
    expect(furniture.children.length).toBe(0);
    expect(service.getSelected()).toBeNull();
  });

  it('pulses the outline colour in update() and keeps it opaque', async () => {
    await click(100, 100);
    const outlineMesh = furniture.children[0].children[0] as Mesh;
    const material = outlineMesh.material as MeshBasicMaterial;
    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(1);
    service.update(0);
    const a = material.color.getHex();
    service.update(Math.PI / 2 / 0.003);
    expect(material.color.getHex()).not.toBe(a);
  });

  it('skips transparent meshes (glass, cups) so their hull is not seen through', () => {
    const glass = new Mesh(
      new BoxGeometry(0.2, 0.2, 0.2),
      new MeshStandardMaterial({ transparent: true, opacity: 0.4 })
    );
    const faded = new Mesh(
      new BoxGeometry(0.2, 0.2, 0.2),
      new MeshStandardMaterial({ opacity: 0.5 })
    );
    furniture.add(glass, faded);
    service.selectObject(furniture);
    const outline = furniture.children.find(
      c => c.name === '__selection-outline'
    )!;
    expect(outline.children.length).toBe(1); // solo la caja opaca
    expect(outline.children[0].matrix.equals(new Matrix4())).toBe(true);
  });

  it('keeps the outline mesh in the furniture frame without scaling it', async () => {
    furniture.geometry.translate(5, 0, 0);
    service.selectObject(furniture);
    const outlineMesh = furniture.children[0].children[0] as Mesh;
    // Mismo marco que el mueble: sin escalado ni desplazamiento (el grosor lo da el shader).
    expect(outlineMesh.matrix.equals(new Matrix4())).toBe(true);
    expect(outlineMesh.geometry).toBe(furniture.geometry);
  });

  it('smooths normals per position so hard edges do not open cracks', () => {
    const box = new BoxGeometry(1, 1, 1); // 24 vértices: 3 normales por esquina
    ensureOutlineNormals(box);
    const attr = box.getAttribute(OUTLINE_NORMAL_ATTRIBUTE);
    expect(attr.count).toBe(box.getAttribute('position').count);
    const pos = box.getAttribute('position');
    const byCorner = new Map<string, Vector3>();
    for (let i = 0; i < attr.count; i++) {
      const n = new Vector3().fromBufferAttribute(attr, i);
      expect(n.length()).toBeCloseTo(1, 5);
      const k = `${pos.getX(i)}_${pos.getY(i)}_${pos.getZ(i)}`;
      const first = byCorner.get(k);
      if (first) expect(n.distanceTo(first)).toBeLessThan(1e-6);
      else byCorner.set(k, n);
      // apunta hacia fuera de la esquina (mismo signo que la posición)
      expect(
        n.x * pos.getX(i) + n.y * pos.getY(i) + n.z * pos.getZ(i)
      ).toBeGreaterThan(0.5);
    }
  });

  it('is idempotent on geometry that already has outline normals', () => {
    const box = new BoxGeometry(1, 1, 1);
    ensureOutlineNormals(box);
    const first = box.getAttribute(OUTLINE_NORMAL_ATTRIBUTE);
    ensureOutlineNormals(box);
    expect(box.getAttribute(OUTLINE_NORMAL_ATTRIBUTE)).toBe(first);
  });

  it('extrudes the outline in clip space by a constant px thickness', async () => {
    await click(100, 100);
    const material = (furniture.children[0].children[0] as Mesh)
      .material as MeshBasicMaterial;
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: VERTEX_STUB,
    };
    material.onBeforeCompile(shader as never, null as never);
    expect(shader.vertexShader).toContain(OUTLINE_NORMAL_ATTRIBUTE);
    expect(shader.vertexShader).not.toContain('#include <project_vertex>');
    const offset = shader.uniforms['uOutlineOffset'].value as Vector2;
    // canvas de 200×200 → 3 px = 2·3/200 en NDC, igual en X e Y.
    expect(offset.x).toBeCloseTo((2 * OUTLINE_THICKNESS_PX) / 200, 6);
    expect(offset.y).toBeCloseTo(offset.x, 6);
  });

  it('rescales the outline offset when the canvas is resized', async () => {
    await click(100, 100);
    const spy = vi.spyOn(canvas, 'getBoundingClientRect');
    service.setCanvasSize(400, 100);
    service.update(0);
    service.update(16);
    expect(spy).not.toHaveBeenCalled(); // sin lecturas de layout por frame
    const material = (furniture.children[0].children[0] as Mesh)
      .material as MeshBasicMaterial;
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: VERTEX_STUB,
    };
    material.onBeforeCompile(shader as never, null as never);
    const offset = shader.uniforms['uOutlineOffset'].value as Vector2;
    expect(offset.x).toBeCloseTo((2 * OUTLINE_THICKNESS_PX) / 400, 6);
    expect(offset.y).toBeCloseTo((2 * OUTLINE_THICKNESS_PX) / 100, 6);
  });

  it('does not select the outline itself when raycasting', async () => {
    await click(100, 100);
    const result = await click(100, 100);
    expect(result.object).toBe(furniture);
  });

  const snapshot = (m: MeshStandardMaterial) => ({
    emissive: m.emissive.getHex(),
    emissiveIntensity: m.emissiveIntensity,
    color: m.color.getHex(),
    map: m.map,
    opacity: m.opacity,
    transparent: m.transparent,
  });

  it('shows a thin translucent hover outline and leaves materials untouched', () => {
    const material = furniture.material as MeshStandardMaterial;
    material.emissive.setRGB(0.2, 0.1, 0.05);
    material.emissiveIntensity = 0.7;
    const before = snapshot(material);
    const changes: (string | null)[] = [];
    service.onHoverChange = t => changes.push(t?.info.id ?? null);
    service.setContext(camera, scene);

    service.setHover({ x: 0, y: 0 });
    service.update(16);
    expect(service.getHovered()?.info.id).toBe('sofa');
    const hover = furniture.children.find(c => c.name === '__hover-outline')!;
    expect(hover).toBeDefined();
    const hull = (hover.children[0] as Mesh).material as MeshBasicMaterial;
    expect(hull.transparent).toBe(true);
    expect(hull.opacity).toBeLessThan(1);
    expect(snapshot(material)).toEqual(before); // ni emisivo, ni color, ni mapa

    service.setHover(null);
    service.update(32);
    expect(service.getHovered()).toBeNull();
    expect(furniture.children.some(c => c.name === '__hover-outline')).toBe(
      false
    );
    expect(snapshot(material)).toEqual(before);
    expect(changes).toEqual(['sofa', null]);
  });

  it('keeps materials identical with hover and selection, and swaps outlines', async () => {
    const material = furniture.material as MeshStandardMaterial;
    const before = snapshot(material);
    service.setContext(camera, scene);
    service.setHover({ x: 0, y: 0 });
    service.update(16);
    await click(100, 100);
    expect(snapshot(material)).toEqual(before);
    const names = furniture.children.map(c => c.name);
    expect(names).toContain('__selection-outline');
    expect(names).not.toContain('__hover-outline'); // el seleccionado no duplica contorno
    service.clearSelection();
    service.update(48);
    expect(furniture.children.some(c => c.name === '__hover-outline')).toBe(
      true
    ); // vuelve el hover si el puntero sigue encima
    expect(snapshot(material)).toEqual(before);
  });

  it('builds a hull for every opaque mesh and keeps the push small relative to its size', async () => {
    const root = new Mesh(new BoxGeometry(0.4, 0.4, 0.4));
    root.material = new MeshStandardMaterial();
    const child = new Mesh(
      new BoxGeometry(1, 2, 0.3),
      new MeshStandardMaterial()
    );
    root.add(child);
    scene.add(root);
    service.addObject(root, { id: 'sofa' });
    service.selectObject(root);
    const outline = root.children.find(c => c.name === '__selection-outline')!;
    expect(outline.children.length).toBe(2);
    for (const mesh of [root, child]) {
      mesh.geometry.computeBoundingBox();
      const size = mesh.geometry.boundingBox!.getSize(new Vector3());
      const smallest = Math.min(size.x, size.y, size.z);
      // empuje < 5 % de la dimensión menor: el casco no queda tras la malla ni la pared
      expect(Math.abs(OUTLINE_DEPTH_PUSH)).toBeLessThan(smallest * 0.05);
    }
    const hullMaterial = (outline.children[0] as Mesh)
      .material as MeshBasicMaterial;
    // sesgo hacia la cámara: gana el empate con paredes/suelo pegados al mueble
    expect(hullMaterial.polygonOffset).toBe(true);
    expect(OUTLINE_POLYGON_OFFSET).toBeLessThan(0);
    expect(new Box3().setFromObject(outline).isEmpty()).toBe(false);
  });

  it('writes stencil on the piece only while selected/hovered and draws the hull outside it', async () => {
    const material = furniture.material as MeshStandardMaterial;
    material.emissive.setRGB(0.2, 0.1, 0.05);
    const before = snapshot(material);
    expect(material.stencilWrite).toBe(false);

    await click(100, 100);
    expect(material.stencilWrite).toBe(true);
    expect(material.stencilRef).toBe(1);
    expect(material.stencilFunc).toBe(AlwaysStencilFunc);
    expect(material.stencilZPass).toBe(ReplaceStencilOp);
    expect(snapshot(material)).toEqual(before);
    const hull = furniture.children.find(c => c.name === '__selection-outline')!
      .children[0] as Mesh;
    const hullMat = hull.material as MeshBasicMaterial;
    expect(hullMat.stencilWrite).toBe(true);
    expect(hullMat.stencilFunc).toBe(NotEqualStencilFunc);
    expect(hullMat.stencilRef).toBe(1);
    expect(hullMat.depthTest).toBe(false);
    expect(hullMat.depthWrite).toBe(false);
    expect(hull.renderOrder).toBeGreaterThan(0);

    service.clearSelection();
    expect(material.stencilWrite).toBe(false);
    expect(material.stencilRef).toBe(0);
    expect(material.stencilFunc).toBe(AlwaysStencilFunc);
    expect(material.stencilZPass).toBe(KeepStencilOp);
    expect(snapshot(material)).toEqual(before);

    service.setContext(camera, scene);
    service.setHover({ x: 0, y: 0 });
    service.update(16);
    expect(material.stencilWrite).toBe(true);
    service.setHover(null);
    service.update(32);
    expect(material.stencilWrite).toBe(false);
    expect(snapshot(material)).toEqual(before);
  });

  it('uses a pixel-space stroke direction so thickness is isotropic', async () => {
    await click(100, 100);
    const material = (furniture.children[0].children[0] as Mesh)
      .material as MeshBasicMaterial;
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: VERTEX_STUB,
    };
    material.onBeforeCompile(shader as never, null as never);
    expect(shader.vertexShader).toContain('/ uOutlineOffset');
  });

  describe('translucent materials', () => {
    const glass = () =>
      new MeshStandardMaterial({ transparent: true, opacity: 0.4 });

    it('treats a mixed opaque+glass array as opaque and outlines only the opaque part', () => {
      const geometry = new BoxGeometry(1, 1, 1);
      geometry.clearGroups();
      geometry.addGroup(0, 6, 0);
      geometry.addGroup(6, 30, 1);
      const mixed = new Mesh(geometry, [new MeshStandardMaterial(), glass()]);
      expect(isTranslucent(mixed)).toBe(false);
      mixed.position.set(2, 0.5, 0);
      scene.add(mixed);
      service.addObject(mixed, { id: 'sofa' });
      service.selectObject(mixed);
      const outline = mixed.children.find(
        c => c.name === '__selection-outline'
      )!;
      const hull = outline.children[0] as Mesh;
      expect(hull.geometry.getIndex()!.count).toBe(6); // solo el grupo opaco
    });

    it('disposes cloned hull geometry and reuses one hover material', () => {
      const geometry = new BoxGeometry(1, 1, 1);
      geometry.clearGroups();
      geometry.addGroup(0, 6, 0);
      geometry.addGroup(6, 30, 1);
      const mixed = new Mesh(geometry, [new MeshStandardMaterial(), glass()]);
      mixed.position.set(2, 0.5, 0);
      scene.add(mixed);
      service.addObject(mixed, { id: 'sofa' });

      service.selectObject(mixed);
      const hullGeometry = (
        mixed.children.find(c => c.name === '__selection-outline')!
          .children[0] as Mesh
      ).geometry;
      expect(hullGeometry).not.toBe(geometry);
      const disposed = vi.fn();
      hullGeometry.addEventListener('dispose', disposed);
      service.removeOutline();
      expect(disposed).toHaveBeenCalledTimes(1);

      const hoverOf = (o: Mesh) =>
        (
          o.children.find(c => c.name === '__hover-outline')!
            .children[0] as Mesh
        ).material;
      service.setContext(camera, scene);
      service.setHover({ x: 0, y: 0 });
      service.update(16);
      const first = hoverOf(furniture) as MeshBasicMaterial;
      const matDisposed = vi.fn();
      first.addEventListener('dispose', matDisposed);
      service.setHover(null);
      service.update(32);
      service.setHover({ x: 0, y: 0 });
      service.update(48);
      expect(hoverOf(furniture)).toBe(first);
      expect(matDisposed).not.toHaveBeenCalled();
      service.dispose();
      expect(matDisposed).toHaveBeenCalledTimes(1);
    });

    it('skips a mesh whose materials are all translucent', () => {
      const all = new Mesh(new BoxGeometry(1, 1, 1), [glass(), glass()]);
      expect(isTranslucent(all)).toBe(true);
    });
  });

  it('dispose clears outline, hover and objects', async () => {
    const material = furniture.material as MeshStandardMaterial;
    const original = material.emissive.getHex();
    await click(100, 100);
    service.setHover({ x: 0, y: 0 });
    service.update(16);
    service.dispose();
    expect(furniture.children.length).toBe(0);
    expect(material.emissive.getHex()).toBe(original);
    expect(service.getObjectInfo(furniture)).toBeUndefined();
  });

  describe('pickables, pieces and surfaces', () => {
    const invisible = new MeshBasicMaterial({ visible: false });

    /** Posición en px (canvas de 200×200) de un punto 3D. */
    const screenOf = (point: Vector3): { x: number; y: number } => {
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      const ndc = point.clone().project(camera);
      return { x: ((ndc.x + 1) / 2) * 200, y: ((1 - ndc.y) / 2) * 200 };
    };

    const makeProxy = (x: number, y: number, z: number, size = 0.4): Mesh => {
      const proxy = new Mesh(new BoxGeometry(size, size, size), invisible);
      proxy.position.set(x, y, z);
      proxy.visible = false;
      scene.add(proxy);
      return proxy;
    };

    const makeWall = (): Mesh => {
      const wall = new Mesh(
        new PlaneGeometry(40, 10),
        new MeshStandardMaterial()
      );
      wall.position.set(0, 5, -3);
      scene.add(wall);
      service.registerSurface(wall, 'wallGreen');
      return wall;
    };

    it('an invisible proxy (visible = false) receives the ray', async () => {
      const proxy = makeProxy(3, 0.5, 0);
      service.registerPiece({ id: 'tv', kind: 'piece' }, [proxy]);
      const p = screenOf(proxy.position);
      const result = await click(p.x, p.y);
      expect(result.objectInfo).toEqual({ id: 'tv', kind: 'piece' });
      expect(result.object).toBe(proxy);
    });

    it('unregistered meshes do not receive the ray', async () => {
      const decor = new Mesh(
        new BoxGeometry(1, 1, 1),
        new MeshStandardMaterial()
      );
      decor.position.set(3, 0.5, 0);
      scene.add(decor);
      const p = screenOf(decor.position);
      const result = await click(p.x, p.y);
      expect(result.objectInfo).toBeNull();
      expect(result.floorPoint).toBeDefined();
    });

    it('keeps filtering the outlines: they are never picked', async () => {
      const proxy = makeProxy(3, 0.5, 0, 1);
      service.registerPiece({ id: 'tv', kind: 'piece' }, [proxy]);
      const p = screenOf(proxy.position);
      await click(p.x, p.y);
      expect(proxy.children.length).toBe(0); // invisible: el casco cuelga del padre
      expect(scene.children.some(c => c.name === '__selection-outline')).toBe(
        true
      );
      const again = await click(p.x, p.y);
      expect(again.object).toBe(proxy);
    });

    it('40+ proxies do not change the floor result', async () => {
      const before = await click(40, 160);
      for (let i = 0; i < 45; i++) {
        const proxy = makeProxy(
          -6 + (i % 9) * 1.5,
          0.3,
          -2 - Math.floor(i / 9)
        );
        service.registerPiece({ id: 'vase', kind: 'piece' }, [proxy]);
      }
      const after = await click(40, 160);
      expect(before.floorPoint).toBeDefined();
      expect(after.floorPoint?.toArray()).toEqual(before.floorPoint?.toArray());
    });

    it('a click on a wall without a piece returns the surface and its hit point', async () => {
      const wall = makeWall();
      const p = screenOf(new Vector3(-2, 3, -3));
      const result = await click(p.x, p.y);
      expect(result.objectInfo).toEqual({ id: 'wallGreen', kind: 'surface' });
      expect(result.object).toBe(wall);
      expect(result.surfacePoint?.z).toBeCloseTo(-3, 3);
      expect(result.surfacePoint?.x).toBeCloseTo(-2, 1);
      expect(service.getSelected()).toBeNull(); // las paredes no se contornean
    });

    it('a click on the floor or the rug still returns the floorPoint with walls registered', async () => {
      makeWall();
      const result = await click(100, 170);
      expect(result.floorPoint).toBeDefined();
      expect(result.objectInfo).toBeNull();
    });

    it('a piece in front of a wall wins over the wall by distance', async () => {
      makeWall();
      const lamp = makeProxy(2, 2, -2.5);
      service.registerPiece({ id: 'readingLamp', kind: 'piece' }, [lamp]);
      const p = screenOf(lamp.position);
      const result = await click(p.x, p.y);
      expect(result.objectInfo?.id).toBe('readingLamp');
    });

    describe('touch priority piece > wall > floor', () => {
      const tap = (x: number, y: number) =>
        service.handleClick(
          { clientX: x, clientY: y, pointerType: 'touch' },
          camera,
          scene
        );

      it('a tap 10 px from a lamp over a wall returns the lamp', async () => {
        makeWall();
        const lamp = makeProxy(2, 2, -2.5, 0.3);
        service.registerPiece({ id: 'readingLamp', kind: 'piece' }, [lamp]);
        const p = screenOf(lamp.position);
        // El proxy mide unos 8 px: a 18 px del centro quedan 10 px de hueco.
        const mouse = await click(p.x + 18, p.y);
        expect(mouse.objectInfo?.id).toBe('wallGreen');
        const result = await tap(p.x + 18, p.y);
        expect(result.objectInfo?.id).toBe('readingLamp');
        expect(result.object).toBe(lamp);
      });

      it('a tap on a wall with no piece nearby returns the wall', async () => {
        makeWall();
        const p = screenOf(new Vector3(-6, 3, -3));
        const result = await tap(p.x, p.y);
        expect(result.objectInfo?.id).toBe('wallGreen');
      });

      it('a tap on the floor returns the floorPoint', async () => {
        makeWall();
        const result = await tap(100, 170);
        expect(result.floorPoint).toBeDefined();
      });
    });

    it('a piece with several boxes highlights them all and groupOf returns them', async () => {
      const a = makeProxy(3, 0.5, 0);
      const b = makeProxy(3.5, 0.5, 0);
      service.registerPiece({ id: 'sconcesBack', kind: 'piece' }, [a, b]);
      expect(service.groupOf('sconcesBack')).toEqual([a, b]);
      expect(service.groupOf('sofa')).toEqual([furniture]);
      expect(service.groupOf('tv')).toEqual([]);
      const p = screenOf(a.position);
      const result = await click(p.x, p.y);
      expect(result.objectInfo?.id).toBe('sconcesBack');
      expect(
        scene.children.filter(c => c.name === '__selection-outline')
      ).toHaveLength(2);
      expect(service.getObjectInfo(service.getSelected()!)).toEqual({
        id: 'sconcesBack',
        kind: 'piece',
      });
      service.clearSelection();
      expect(
        scene.children.filter(c => c.name === '__selection-outline')
      ).toHaveLength(0);
    });

    it('outlines the visuals instead of the proxies when given', async () => {
      const proxy = makeProxy(3, 0.5, 0);
      const visual = new Mesh(
        new BoxGeometry(0.4, 0.4, 0.4),
        new MeshStandardMaterial()
      );
      visual.position.copy(proxy.position);
      scene.add(visual);
      service.registerPiece({ id: 'tv', kind: 'piece' }, [proxy], {
        visuals: [visual],
      });
      const p = screenOf(proxy.position);
      await click(p.x, p.y);
      expect(visual.children.some(c => c.name === '__selection-outline')).toBe(
        true
      );
    });

    it('selectObject on one box of a piece selects every box', () => {
      const a = makeProxy(3, 0.5, 0);
      const b = makeProxy(3.5, 0.5, 0);
      service.registerPiece({ id: 'sconcesBack', kind: 'piece' }, [a, b]);
      service.selectObject(b);
      expect(service.getSelected()).toBe(b);
      expect(
        scene.children.filter(c => c.name === '__selection-outline')
      ).toHaveLength(2);
    });

    it('removeObject drops one box and the whole group once empty', () => {
      const a = makeProxy(3, 0.5, 0);
      const b = makeProxy(3.5, 0.5, 0);
      service.registerPiece({ id: 'sconcesBack', kind: 'piece' }, [a, b]);
      service.removeObject(a);
      expect(service.groupOf('sconcesBack')).toEqual([b]);
      service.removeObject(b);
      expect(service.groupOf('sconcesBack')).toEqual([]);
    });

    it('hovering a piece reports its kind; hovering a wall draws no outline', () => {
      const proxy = makeProxy(3, 0.5, 0);
      service.registerPiece({ id: 'tv', kind: 'piece' }, [proxy]);
      const wall = makeWall();
      const ndcOf = (v: Vector3) => {
        const p = screenOf(v);
        return { x: (p.x / 200) * 2 - 1, y: -((p.y / 200) * 2 - 1) };
      };
      service.setContext(camera, scene);
      const seen: (string | undefined)[] = [];
      service.onHoverChange = t => seen.push(t?.info.kind);
      service.setHover(ndcOf(proxy.position));
      service.update(16);
      expect(seen).toEqual(['piece']);
      service.setHover(ndcOf(new Vector3(-6, 3, -3)));
      service.update(32);
      expect(seen).toEqual(['piece', 'surface']);
      expect(wall.children).toHaveLength(0);
      expect(scene.children.some(c => c.name === '__hover-outline')).toBe(
        false
      );
    });

    it('the selection and hover outline materials skip tone mapping (R8-M8)', async () => {
      await click(100, 100);
      const hull = furniture.children.find(
        c => c.name === '__selection-outline'
      )?.children[0] as Mesh;
      expect((hull.material as MeshBasicMaterial).toneMapped).toBe(false);
      service.clearSelection();
      service.setHover({ x: 0, y: 0 });
      service.update(16);
      const hover = furniture.children.find(c => c.name === '__hover-outline')
        ?.children[0] as Mesh;
      expect((hover.material as MeshBasicMaterial).toneMapped).toBe(false);
    });
  });
});
