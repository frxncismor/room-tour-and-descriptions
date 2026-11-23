import { Messages } from './messages';

/** Diccionario inglés: el único que va en el bundle inicial. */
export const EN = {
  meta: {
    title: 'Room Tour — Interactive 3D Interior Viewer',
    description:
      'Explore a 3D living room in your browser: orbit the camera, click furniture to see its details and walk through the space. Built with Angular and Three.js.',
  },
  brand: {
    title: 'Room Tour',
    byline: 'by Francisco Moreno',
  },
  loading: {
    title: 'Room Tour',
    byline: 'by Francisco Moreno',
    status: 'Loading the room',
  },
  errors: {
    webglTitle: 'WebGL is not available',
    contextLostTitle: 'The 3D view was interrupted',
    webglHelp:
      'This viewer needs WebGL. Use a recent Chrome, Edge, Firefox or Safari, with hardware acceleration on.',
    retry: 'Retry',
    messages: {
      'context-lost': 'The 3D context was lost. It will recover automatically.',
      'webgl-unavailable':
        'Your browser or device cannot run the 3D viewer (WebGL).',
      'render-failed': 'The 3D view stopped working. Try again.',
      'model-load-failed': 'Could not load: {names}.',
      'locale-load-failed': 'Could not load Spanish. Staying in English.',
    },
  },
  panel: {
    close: 'Close details',
  },
  list: {
    title: 'Pieces',
    resetView: 'Reset view',
    resetViewLabel: 'Reset view to the initial position',
  },
  help: {
    title: 'Controls',
    open: 'Controls',
    openLabel: 'Show the controls',
    gotIt: 'Close',
    controls: [
      {
        label: 'Orbit',
        text: 'Drag with the left mouse button',
        touchText: 'Drag with one finger',
        icon: 'rotate',
      },
      {
        label: 'Pan',
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
        label: 'Move',
        text: 'Click the floor to go there',
        touchText: 'Tap the floor to go there',
        icon: 'walk',
      },
      {
        label: 'Inspect',
        text: 'Click a piece to read about it',
        touchText: 'Tap a piece to read about it',
        icon: 'inspect',
      },
      {
        label: 'Keys',
        touchLabel: 'Close',
        text: 'Esc closes details. Home resets the view.',
        touchText: 'Tap the cross to close details',
        icon: 'keyboard',
      },
    ],
  },
  language: {
    label: 'Language',
    announce: 'Language: English',
  },
  canvasLabel:
    'Interactive 3D view of a living room. Use the list of pieces to inspect each one with the keyboard.',
  assets: {
    floor: 'Floor texture',
    rug: 'Rug texture',
    clock: 'Wall clock',
    vase: 'Ceramic vase',
    prints: 'Wall prints',
    fabric: 'Fabric texture',
  },
  furniture: {
    sofa: {
      name: 'Sectional sofa',
      description:
        'Corner sectional with loose back cushions and a separate ottoman, in a terracotta tone. It anchors the seating area on the left.',
      details: 'Model: "Sofa Set" by FREEDomplant, via Sketchfab.',
    },
    pokerTable: {
      name: 'Poker table',
      description:
        'Card table with a felt playing surface, a padded rail and a wooden frame. It stands on the right, opposite the sofa.',
      details: 'Model: "Poker Board Game Table" by Lília Mara, via Sketchfab.',
    },
    bookshelf: {
      name: 'Bookshelf',
      description:
        'Open shelving in four tiers, in dark wood. It stands against the back wall, centered between the painting and the clock.',
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
  },
} satisfies Messages;
