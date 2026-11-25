import { standard, BuildKit } from './kit';
import { profileFrame, rectOutline } from './geometry';
import { Matrix4 } from 'three';

/** Cornisa perimetral (spec A «otros elementos»): 0,09 m de vuelo × 0,07 m. */
export const CORNICE = {
  reach: 0.09,
  drop: 0.07,
  color: 0xf3ece1,
  roughness: 0.8,
  /** Lado de la sala y altura del techo. */
  room: 16,
  ceiling: 4,
} as const;

/**
 * Cornisa de perfil escalonado en una sola malla (`cornice`, zona `ceiling`):
 * cuatro tramos con esquinas a inglete y tres escalones que bajan de la
 * arista del techo a la pared. Recibe sombra; sin raycast.
 */
export function buildCornice(kit: BuildKit): void {
  const { reach, drop, room, ceiling } = CORNICE;
  // Contorno 0,01 m dentro de la pared para no pelear con ella en el z-buffer.
  const outline = rectOutline(room - 0.02, room - 0.02);
  // z = profundidad bajo el techo; inset = distancia a la pared.
  const step = reach / 3;
  const geometry = profileFrame(outline, [
    { inset: 0, z: drop },
    { inset: step, z: drop },
    { inset: step, z: drop * 0.64 },
    { inset: step * 2, z: drop * 0.64 },
    { inset: step * 2, z: drop * 0.3 },
    { inset: reach, z: drop * 0.3 },
    { inset: reach, z: 0 },
  ]);
  // z (profundidad) pasa a «hacia abajo»; el plano del contorno al suelo.
  geometry.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
  geometry.translate(0, ceiling, 0);
  const material = kit.material('cornice', () =>
    standard(CORNICE.color, CORNICE.roughness)
  );
  kit.geometry(geometry);
  const mesh = kit.addMesh(
    'ceiling',
    'cornice',
    geometry,
    material,
    new Matrix4(),
    false
  );
  mesh.receiveShadow = true;
  geometry.computeBoundingSphere();
}
