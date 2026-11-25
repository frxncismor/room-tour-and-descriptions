import {
  DataTexture,
  Euler,
  LinearFilter,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import type { PieceConfig } from '../pieces.config';
import { chamferBox } from './geometry';
import { BuildKit, Placer, standard } from './kit';

export const MONITOR_TEXTURE_SIZE = { width: 512, height: 288 } as const;

/** Colores del «código» (cálidos, sin texto legible). */
const CODE_COLORS = [0xe8dcc3, 0xd98a64, 0x6fa6a0, 0xd9b45a, 0x9c8872] as const;

/**
 * Pantalla del monitor dibujada una sola vez: barra superior, panel lateral y
 * líneas de «código» como barras de color. Sin texto legible.
 */
export function drawMonitorPixels(
  width: number,
  height: number
): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(width * height * 4);
  const fill = (x0: number, y0: number, w: number, h: number, hex: number) => {
    for (let y = Math.max(0, y0); y < Math.min(height, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(width, x0 + w); x++) {
        const i = (y * width + x) * 4;
        data[i] = (hex >> 16) & 255;
        data[i + 1] = (hex >> 8) & 255;
        data[i + 2] = hex & 255;
        data[i + 3] = 255;
      }
    }
  };
  fill(0, 0, width, height, 0x1e1a17);
  fill(0, 0, width, 22, 0x2c2622);
  for (let i = 0; i < 3; i++) fill(10 + i * 14, 8, 7, 7, CODE_COLORS[i + 1]);
  fill(0, 22, 92, height - 22, 0x25201c);
  for (let row = 0; row < 11; row++) {
    fill(10, 40 + row * 22, 30 + ((row * 37) % 50), 8, 0x6b5a4a);
  }
  // Líneas de código: sangría y longitud pseudoaleatorias deterministas.
  for (let row = 0; row < 11; row++) {
    let x = 112 + (row % 3 === 1 ? 24 : row % 4 === 3 ? 48 : 0);
    const y = 38 + row * 22;
    fill(60, y, 18, 10, 0x4a3f36);
    for (let word = 0; word < 4; word++) {
      const length = 24 + ((row * 53 + word * 31) % 90);
      if (x + length > width - 16) break;
      fill(
        x,
        y,
        length,
        10,
        CODE_COLORS[(row + word * 2) % CODE_COLORS.length]
      );
      x += length + 12;
    }
  }
  return data;
}

/**
 * Monitor sobre el escritorio (spec A.2, B.1): panel con bisel, cuello y peana.
 * Mallas con nombre: `monitor:body`, `monitor:screen` (emisivo con la textura
 * dibujada una vez; `emissiveIntensity` 0 = apagado) y `monitor:halo` (mancha
 * azulada sobre la mesa, oculta y sin opacidad apagado).
 */
export function buildMonitor(kit: BuildKit, config: PieceConfig): void {
  const placer = new Placer(kit, config, 'work');
  const deskTop = 0.755;
  const panelH = 0.4;
  const panelW = config.size[0];
  const panelBottom = config.position[1] + config.size[1] / 2 - panelH;
  const panelCenterY = panelBottom + panelH / 2;
  kit.material('plastic', () => standard(0x1b1b1d, 0.5));
  kit.material('monitorMetal', () =>
    standard(0x2c2c2f, 0.35, { metalness: 0.6 })
  );

  placer.add(
    'plastic',
    chamferBox(panelW, panelH, 0.03, 0.008),
    0,
    panelCenterY,
    -0.03
  );
  // Peana ovalada y cuello ligeramente inclinado hacia atrás.
  placer.add(
    'monitorMetal',
    chamferBox(0.22, 0.012, 0.14, 0.005),
    0,
    deskTop + 0.006,
    0
  );
  placer.add(
    'monitorMetal',
    chamferBox(0.04, panelBottom - deskTop - 0.01, 0.02, 0.004),
    0,
    deskTop + 0.012 + (panelBottom - deskTop - 0.012) / 2,
    -0.035,
    new Euler(-0.05, 0, 0)
  );
  const texture = kit.own(
    (() => {
      const { width, height } = MONITOR_TEXTURE_SIZE;
      const t = new DataTexture(
        drawMonitorPixels(width, height),
        width,
        height,
        RGBAFormat,
        UnsignedByteType
      );
      t.colorSpace = SRGBColorSpace;
      t.magFilter = LinearFilter;
      t.minFilter = LinearFilter;
      t.flipY = false;
      t.needsUpdate = true;
      return t;
    })()
  );
  const screenMaterial = kit.material('monitor:screen', () =>
    standard(0x0a0b0d, 0.2, {
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: 0,
    })
  );
  const screenW = panelW - 0.04;
  const screenH = panelH - 0.075;
  placer.mesh(
    'monitor:screen',
    new PlaneGeometry(screenW, screenH),
    screenMaterial,
    0,
    panelCenterY + 0.0275,
    -0.0145,
    { visual: false }
  );
  const halo = placer.mesh(
    'monitor:halo',
    new PlaneGeometry(0.9, 0.6).rotateX(-Math.PI / 2),
    kit.glowMaterial('monitor:halo', 0x9fc4ff, 0),
    0,
    deskTop + 0.004,
    0.2
  );
  halo.visible = false;
}
