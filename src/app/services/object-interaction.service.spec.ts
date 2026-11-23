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
    service.addObject(furniture, { name: 'Box', description: 'A box' });
  });

  afterEach(() => service.dispose());

  it('returns the object on a furniture click', async () => {
    const result = await click(100, 100);
    expect(result.success).toBe(true);
    expect(result.objectInfo?.name).toBe('Box');
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
      expect(result.objectInfo?.name).toBe('Box');
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
    service.onHoverChange = t => changes.push(t?.info.name ?? null);
    service.setContext(camera, scene);

    service.setHover({ x: 0, y: 0 });
    service.update(16);
    expect(service.getHovered()?.info.name).toBe('Box');
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
    expect(changes).toEqual(['Box', null]);
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
    service.addObject(root, { name: 'Group', description: '' });
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
      service.addObject(mixed, { name: 'Mixed', description: '' });
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
      service.addObject(mixed, { name: 'Mixed', description: '' });

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
});
