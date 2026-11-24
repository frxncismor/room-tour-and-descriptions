import { Euler } from 'three';
import type { PieceConfig } from '../pieces.config';
import { chamferBox, lathe } from './geometry';
import { BuildKit, Placer, brassMaterial, oakMaterial, standard } from './kit';

/** Libros: materiales compartidos por todas las zonas. */
export function bookMaterials(kit: BuildKit): void {
  kit.material('bookA', () => standard(0xd9c8a6, 0.8));
  kit.material('bookB', () => standard(0xa4553a, 0.8));
  kit.material('bookC', () => standard(0x3f6b6a, 0.8));
}

/**
 * Estante flotante de roble sobre el escritorio (el tercer proxy de `desk`):
 * tablero achaflanado, tres libros de pie con un sujetalibros de latón y un
 * cuenco de cerámica. Zona `work`.
 */
export function buildDeskShelf(kit: BuildKit, desk: PieceConfig): void {
  const proxy = desk.proxies[2];
  if (!proxy) return;
  const [px, py, pz] = proxy.position;
  const [width, thick, depth] = proxy.size;
  const placer = new Placer(kit, desk, 'work', {
    position: kit.origin(px, 0, pz),
    rotationY: proxy.rotationY,
  });
  oakMaterial(kit);
  brassMaterial(kit);
  bookMaterials(kit);
  kit.material('ceramicCream', () => standard(0xd7cdb8, 0.45));
  placer.add('oak', chamferBox(width, thick, depth, 0.006), 0, py, 0);
  const top = py + thick / 2;
  // Libros de pie, ligeramente inclinados el último.
  const books: [string, number, number, number][] = [
    ['bookB', 0.04, 0.24, -0.5],
    ['bookA', 0.035, 0.21, -0.455],
    ['bookC', 0.045, 0.23, -0.415],
  ];
  for (const [material, w, h, x] of books) {
    placer.add(material, chamferBox(w, h, 0.17, 0.003), x, top + h / 2, 0);
  }
  placer.add(
    'brass',
    chamferBox(0.004, 0.1, 0.12, 0.001),
    -0.385,
    top + 0.05,
    0
  );
  // Cuenco de cerámica torneado.
  placer.add(
    'ceramicCream',
    lathe(
      [
        [0.001, 0],
        [0.035, 0],
        [0.07, 0.03],
        [0.085, 0.07],
        [0.078, 0.07],
        [0.06, 0.035],
        [0.001, 0.012],
      ],
      14
    ),
    0.35,
    top,
    0
  );
  // Segundo cuenco pequeño y tres libros tumbados.
  placer.add(
    'bookA',
    chamferBox(0.2, 0.03, 0.14, 0.003),
    0.0,
    top + 0.015,
    0.0,
    new Euler(0, 0.1, 0)
  );
  placer.add(
    'bookB',
    chamferBox(0.18, 0.025, 0.13, 0.003),
    0.005,
    top + 0.0425,
    0.0,
    new Euler(0, -0.06, 0)
  );
}

/**
 * Objetos sobre la estantería de cubos (glTF): un jarrón alto, libros
 * apilados y un cuenco, en la tapa. Las posiciones se afinan en F4.
 */
export function buildDisplayObjects(kit: BuildKit, config: PieceConfig): void {
  const placer = new Placer(kit, config, 'work');
  const top = config.position[1] + config.size[1] / 2;
  bookMaterials(kit);
  brassMaterial(kit);
  kit.material('ceramicCream', () => standard(0xd7cdb8, 0.45));
  // Jarrón torneado alto con cuello estrecho.
  placer.add(
    'ceramicCream',
    lathe(
      [
        [0.001, 0],
        [0.05, 0],
        [0.085, 0.07],
        [0.09, 0.14],
        [0.06, 0.22],
        [0.03, 0.27],
        [0.034, 0.3],
        [0.027, 0.3],
        [0.001, 0.27],
      ],
      16
    ),
    -0.3,
    top,
    0
  );
  // Pila de libros.
  const stack: [string, number, number, number, number][] = [
    ['bookB', 0.24, 0.035, 0.17, 0.05],
    ['bookC', 0.22, 0.03, 0.16, -0.04],
    ['bookA', 0.2, 0.028, 0.15, 0.07],
  ];
  let y = top;
  for (const [material, w, h, d, turn] of stack) {
    placer.add(
      material,
      chamferBox(w, h, d, 0.003),
      0.05,
      y + h / 2,
      0,
      new Euler(0, turn, 0)
    );
    y += h;
  }
  // Esfera de latón sobre los libros.
  placer.add(
    'brass',
    lathe(
      [
        [0.001, 0],
        [0.03, 0.02],
        [0.04, 0.05],
        [0.03, 0.08],
        [0.001, 0.1],
      ],
      12
    ),
    0.05,
    y,
    0
  );
}
