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
  /** Variante para dispositivos táctiles (sin ratón ni teclado). */
  touchText: string;
  /** Icono SVG de la acción. */
  icon: 'rotate' | 'pan' | 'zoom' | 'walk' | 'inspect' | 'keyboard';
}

export const UI_TEXT = {
  appName: 'Room tour',
  brand: {
    title: 'Room Tour',
    byline: 'by Francisco Moreno',
  },
  loading: {
    title: 'Room Tour',
    byline: 'by Francisco Moreno',
    status: 'Preparing the room',
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
        text: 'Drag with the left mouse button',
        touchText: 'Drag with one finger',
        icon: 'rotate',
      },
      {
        label: 'Slide sideways',
        text: 'Drag with the right button; arrow keys work too',
        touchText: 'Drag with two fingers',
        icon: 'pan',
      },
      {
        label: 'Zoom',
        text: 'Scroll the wheel',
        touchText: 'Pinch with two fingers',
        icon: 'zoom',
      },
      {
        label: 'Walk',
        text: 'Click the floor to move there',
        touchText: 'Tap the floor to move there',
        icon: 'walk',
      },
      {
        label: 'Inspect furniture',
        text: 'Click a piece to zoom in and read about it',
        touchText: 'Tap a piece to zoom in and read about it',
        icon: 'inspect',
      },
      {
        label: 'Keyboard',
        text: 'Esc closes the details, Home returns to the initial view',
        touchText: 'Tap the cross to close the details',
        icon: 'keyboard',
      },
    ] as ControlText[],
  },
  canvasLabel:
    'Interactive 3D view of a living room. Use the list of pieces to inspect each one with the keyboard.',
};

/**
 * Textos por mueble, por id de `MODEL_CONFIGURATIONS`.
 * Fuente única: `MODEL_CONFIGURATIONS` toma de aquí nombre y descripción.
 */
export const FURNITURE_TEXT = {
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
  landscapePainting: {
    name: 'Landscape painting',
    description:
      'Oil landscape of a mill and a river, in a gilt frame with beaded molding. It hangs on the back wall, lit by a spotlight.',
    details:
      'Model: "Fancy Picture Frame 01" by Rob Tuytel and Rico Cilliers, Poly Haven (CC0).',
  },
  succulent: {
    name: 'Potted succulent',
    description:
      'Zebra haworthia in a weathered ceramic pot, set beside the bookshelf.',
    details: 'Model: "Potted Plant 04" by James Ray Cock, Poly Haven (CC0).',
  },
} satisfies Record<string, FurnitureText>;
