/** Texto de la interfaz (inglés, D-08). */
export interface FurnitureText {
  name: string;
  description: string;
  /** Datos secundarios (autoría, origen) para la ficha. */
  details?: string;
}

export interface ControlText {
  label: string;
  text: string;
  /** Icono SVG de la acción. */
  icon: 'rotate' | 'pan' | 'zoom' | 'walk' | 'inspect' | 'keyboard';
}

export const UI_TEXT = {
  appName: 'Room tour',
  loading: {
    title: 'Preparing the room',
    status: 'Loading 3D models',
  },
  errors: {
    webglTitle: '3D view unavailable',
    contextLostTitle: 'Reconnecting the 3D view',
    webglHelp:
      'This viewer needs WebGL. Try a recent version of Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is enabled.',
    retry: 'Try again',
  },
  panel: {
    close: 'Close details',
  },
  list: {
    title: 'Furniture',
    resetView: 'Initial view',
    resetViewLabel: 'Return to the initial view of the room',
  },
  help: {
    title: 'How to explore',
    open: 'Help',
    openLabel: 'Show navigation help',
    gotIt: 'Got it',
    controls: [
      {
        label: 'Look around',
        text: 'Drag with the left mouse button, or with one finger',
        icon: 'rotate',
      },
      {
        label: 'Slide sideways',
        text: 'Drag with the right button or two fingers; arrow keys work too',
        icon: 'pan',
      },
      {
        label: 'Zoom',
        text: 'Scroll the wheel, or pinch with two fingers',
        icon: 'zoom',
      },
      {
        label: 'Walk',
        text: 'Click or tap the floor to move there',
        icon: 'walk',
      },
      {
        label: 'Inspect furniture',
        text: 'Click or tap a piece to zoom in and read about it',
        icon: 'inspect',
      },
      {
        label: 'Keyboard',
        text: 'Esc closes the details, Home returns to the initial view',
        icon: 'keyboard',
      },
    ] as ControlText[],
  },
  canvasLabel:
    'Interactive 3D view of a living room with a sofa, a poker table and a bookshelf. Use the furniture list to inspect each piece with the keyboard.',
};

/**
 * Textos por mueble, por id de `MODEL_CONFIGURATIONS`.
 * `name` coincide con el de la configuración para poder enlazar la selección.
 */
export const FURNITURE_TEXT: Record<string, FurnitureText> = {
  sofa: {
    name: 'Modern Sofa',
    description:
      'A low-profile contemporary sofa with generous seat cushions and clean, softly rounded lines. It anchors the living area and invites you to sit back, with plenty of room for the whole group to stretch out.',
    details: 'Model: "Sofa Set" by FREEDomplant, via Sketchfab.',
  },
  pokerTable: {
    name: 'Poker Table',
    description:
      'A game table with a felt-style playing surface, a padded rail and a polished wooden frame. It is sized for a relaxed night of cards with friends, and its compact footprint keeps it at the heart of the room without crowding it.',
    details: 'Model: "Poker Board Game Table" by Lília Mara, via Sketchfab.',
  },
  bookshelf: {
    name: 'Bookshelf',
    description:
      'A tall, open bookshelf with several tiers of shelving for books and decorative pieces. Its slim wooden structure keeps the wall feeling light while adding useful storage and a touch of character.',
    details: 'Model: "BookShelf" by Twpic, via Sketchfab.',
  },
};

/** Busca el texto de un mueble por su nombre en la configuración. */
export function findFurnitureText(name: string): FurnitureText | undefined {
  return Object.values(FURNITURE_TEXT).find(entry => entry.name === name);
}
