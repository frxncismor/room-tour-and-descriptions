import { CylinderGeometry, Euler } from 'three';
import type { PieceConfig } from '../pieces.config';
import { chamferBox, squareTaper } from './geometry';
import { BuildKit, Placer, brassMaterial, oakMaterial } from './kit';

/**
 * Escritorio de roble (spec A.2): tapa achaflanada con la textura del suelo,
 * cuatro patas cónicas con ligera abertura, faldones, bloque de cajón con
 * tirador de latón y trasera. Zona `work`. La silla es un glTF (la carga el
 * servicio) y el estante flotante lo pone `shelves.ts`.
 */
export function buildDesk(kit: BuildKit, config: PieceConfig): void {
  const placer = new Placer(kit, config, 'work');
  const [width, height, depth] = config.size;
  oakMaterial(kit);
  brassMaterial(kit);
  const topThickness = 0.04;
  const topY = height - topThickness / 2;
  placer.add('oak', chamferBox(width, topThickness, depth, 0.007), 0, topY, 0);

  // Faldones bajo la tapa.
  const railY = height - topThickness - 0.035;
  placer.add(
    'oak',
    chamferBox(width - 0.14, 0.07, 0.02, 0.004),
    0,
    railY,
    depth / 2 - 0.07
  );
  placer.add(
    'oak',
    chamferBox(width - 0.14, 0.07, 0.02, 0.004),
    0,
    railY,
    -depth / 2 + 0.07
  );
  for (const sx of [-1, 1]) {
    placer.add(
      'oak',
      chamferBox(0.02, 0.07, depth - 0.12, 0.004),
      sx * (width / 2 - 0.07),
      railY,
      0
    );
  }

  // Patas cónicas, abiertas hacia fuera (estilo de mediados de siglo).
  const legHeight = height - topThickness;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      placer.add(
        'oak',
        squareTaper(0.05, 0.03, legHeight),
        sx * (width / 2 - 0.08),
        legHeight / 2,
        sz * (depth / 2 - 0.08),
        new Euler(-sz * 0.06, 0, sx * 0.06)
      );
    }
  }

  // Bloque de cajón, a la derecha mirando al frente de la mesa.
  const drawerX = width / 2 - 0.3;
  const blockH = 0.15;
  const blockY = height - topThickness - blockH / 2;
  placer.add(
    'oak',
    chamferBox(0.4, blockH, depth - 0.1, 0.005),
    drawerX,
    blockY,
    -0.02
  );
  placer.add(
    'oak',
    chamferBox(0.37, blockH - 0.03, 0.014, 0.004),
    drawerX,
    blockY,
    depth / 2 - 0.065
  );
  placer.add(
    'brass',
    new CylinderGeometry(0.013, 0.013, 0.02, 12).rotateX(Math.PI / 2),
    drawerX,
    blockY,
    depth / 2 - 0.05
  );

  // Trasera a media altura.
  placer.add(
    'oak',
    chamferBox(width - 0.2, 0.26, 0.016, 0.003),
    0,
    height - topThickness - 0.2,
    -depth / 2 + 0.1
  );
}
