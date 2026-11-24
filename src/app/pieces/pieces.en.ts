import type { PieceMessages } from '../i18n/messages';

/**
 * Textos ingleses de las piezas y superficies (chunk perezoso: nada del
 * bundle inicial lo importa de forma estática). Los 5 muebles de siempre
 * repiten su texto de `en.ts` (un test comprueba que coinciden); así este
 * chunk no importa nada del inicial.
 */
const PIECES_EN = {
  pieces: {
    // Pared verde
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
    clock: {
      name: 'Wall clock',
      description:
        'A round wall clock on the green wall, to the right of the bookshelf.',
      details: 'Model: "Wall Clock" by PierreB3D, Poly Haven (CC0).',
    },
    vase: {
      name: 'Ceramic vase',
      description: 'A ceramic vase on the floor, to the left of the bookshelf.',
      details: 'Model: "Ceramic Vase 02" by James Ray Cock, Poly Haven (CC0).',
    },
    printSpiraea: {
      name: 'Cyanotype: Spiraea',
      description:
        'A cyanotype plate of goat’s-beard, white on Prussian blue. One of the two botanical prints that flank the bookshelf.',
      details:
        '"Spiraea aruncus (Tyrol)", Anna Atkins, 1851–54. Cyanotype, The Met (CC0).',
    },
    printFelce: {
      name: 'Salt print: Felce',
      description:
        'A salted paper print of a fern frond in warm sepia. It balances the cyanotype on the other side of the bookshelf.',
      details:
        '"Felce", William Henry Fox Talbot, 1839. Salted paper print, The Met (CC0).',
    },
    sconcesBack: {
      name: 'Brass wall sconces',
      description:
        'Brass wall sconces that wash the green wall in warm light, above the bookshelf.',
    },
    // Pared de la ventana
    window: {
      name: 'Window with linen curtains',
      description:
        'A tall window onto a sunset sky, framed by floor-length linen curtains.',
    },
    floorLamp: {
      name: 'Floor lamp',
      description:
        'The corner floor lamp with a brass stem. It is on by default; switch it off to see the room without it.',
      actions: {
        power: {
          whenOff: 'Turn on light',
          whenOn: 'Turn off light',
          announceOn: 'Floor lamp on.',
          announceOff: 'Floor lamp off.',
        },
      },
    },
    readingChair: {
      name: 'Reading chair & side table',
      description:
        'A mid-century lounge chair in the reading nook, with a side table within reach.',
      details:
        'Models: "Mid Century Lounge Chair" by K. Siitonen and "Side Table 01" by James Ray Cock, Poly Haven (CC0).',
    },
    readingLamp: {
      name: 'Reading lamp',
      description:
        'A small table lamp with a linen shade beside the reading chair.',
      actions: {
        power: {
          whenOff: 'Turn on light',
          whenOn: 'Turn off light',
          announceOn: 'Reading lamp on.',
          announceOff: 'Reading lamp off.',
        },
      },
    },
    sideboard: {
      name: 'Sideboard with records',
      description:
        'A low wooden chest of drawers with a row of vinyl records. It carries the turntable.',
      details:
        'Model: "Vintage Wooden Drawer 01" by James Ray Cock, Poly Haven (CC0). Records: procedural.',
    },
    turntable: {
      name: 'Turntable',
      description:
        'A walnut turntable with a brass tonearm on the sideboard. Start the record and the platter spins; sound is optional and off by default.',
      details:
        'Sound is generated in your browser: no recordings, no downloads.',
      actions: {
        spin: {
          whenOff: 'Start record',
          whenOn: 'Stop record',
          announceOn: 'Record playing.',
          announceOff: 'Record stopped.',
          stateOff: 'Platter: stopped',
          stateOn: 'Platter: spinning',
        },
        sound: {
          whenOff: 'Sound: off',
          whenOn: 'Sound: on',
          announceOn: 'Sound on.',
          announceOff: 'Sound off.',
          disabledHint: 'Start the record first',
        },
      },
    },
    bookcaseLeft: {
      name: 'Reading-corner bookcase',
      description:
        'A twin of the bookshelf on the back wall, set against the window wall to close off the reading corner.',
      details: 'Model: "BookShelf" by Twpic, via Sketchfab.',
    },
    printNook: {
      name: 'Botanical print (nook)',
      description:
        'A botanical plate in blue and sepia, on the window wall beside the reading nook.',
      details: 'Public-domain plate. Credits are in the README.',
    },
    // Pared de la tele
    tv: {
      name: 'Television',
      description:
        'A 55-inch screen in a walnut frame, hung low like a picture. In art mode it cycles through the cyanotypes and salt prints in this room, one every eight seconds.',
      details:
        'Screen content: public-domain plates from this room. Frame and sideboard: procedural.',
      actions: {
        power: {
          whenOff: 'Turn on',
          whenOn: 'Turn off',
          announceOn: 'Television on. Showing {work}.',
          announceOff: 'Television off.',
          stateOn: 'Showing: {work}',
        },
        next: {
          whenOff: 'Next picture',
          announceOn: 'Showing {work}.',
        },
      },
    },
    credenza: {
      name: 'Walnut sideboard',
      description:
        'A long walnut sideboard under the television, with a few books and a ceramic vase on top.',
    },
    printsFront: {
      name: 'Botanical prints (TV wall)',
      description:
        'Two botanical plates in blue and sepia, one on each side of the television.',
      details: 'Public-domain plates. Credits are in the README.',
    },
    plantFicus: {
      name: 'Rubber plant',
      description:
        'A rubber plant with broad leaves in a pot, in the corner of the TV lounge.',
    },
    door: {
      name: 'Panel door',
      description:
        'A panel door with a brass handle, set into the TV wall near the right corner.',
    },
    archMirror: {
      name: 'Arched cyanotype',
      description:
        'A tall arch-topped cyanotype of Osmunda fern in a thin frame, at the left end of the TV wall.',
    },
    // Pared del escritorio
    diptych: {
      name: 'Cyanotype diptych',
      description:
        'Two cyanotype plates side by side in matching frames, on the desk wall.',
      details:
        '"Osmunda regalis (Australia)" and "Pteris aquilina", Anna Atkins, c. 1850. Public domain.',
    },
    tallCabinet: {
      name: 'Painted armoire',
      description:
        'A tall armoire with two panelled doors, painted cream. It stands between the diptych and the desk.',
      details:
        'Model: "Painted Wooden Cabinet 02" by K. Sannikov, Poly Haven (CC0).',
    },
    printRight: {
      name: 'Botanical print (desk wall)',
      description:
        'A botanical plate in blue and sepia, between the armoire and the desk.',
      details: 'Public-domain plate. Credits are in the README.',
    },
    desk: {
      name: 'Oak desk, chair & shelf',
      description:
        'A plain oak desk with a wall shelf above it and a painted wooden chair. The monitor and the desk lamp are separate pieces.',
      details:
        'Desk and shelf: procedural. Chair: "Painted Wooden Chair 02" by K. Sannikov, Poly Haven (CC0).',
    },
    monitor: {
      name: 'Monitor',
      description:
        'A slim monitor on the oak desk. Wake it to see a quiet editor window; it gives off a faint cool glow.',
      actions: {
        power: {
          whenOff: 'Turn on screen',
          whenOn: 'Turn off screen',
          announceOn: 'Monitor on.',
          announceOff: 'Monitor off.',
        },
      },
    },
    deskLamp: {
      name: 'Desk lamp',
      description:
        'A brass desk lamp with an articulated arm. Its shade glows warm when it is on.',
      actions: {
        power: {
          whenOff: 'Turn on light',
          whenOn: 'Turn off light',
          announceOn: 'Desk lamp on.',
          announceOff: 'Desk lamp off.',
        },
      },
    },
    displayShelves: {
      name: 'Display shelves',
      description: 'A wooden cube shelf holding books and a few small objects.',
      details:
        'Model: "Wooden Display Shelves 01" by James Ray Cock, Poly Haven (CC0). Objects: procedural.',
    },
    // Suelo y asientos
    cushionsThrow: {
      name: 'Cushions & throw',
      description: 'Loose cushions and a throw on the sectional sofa.',
    },
    armchair: {
      name: 'Leather armchair',
      description:
        'A leather armchair in the TV lounge, turned toward the coffee table.',
      details:
        'Model: "Modern Arm Chair 01" by Vibrant Nordic, Poly Haven (CC0).',
    },
    coffeeTable: {
      name: 'Coffee table',
      description:
        'A low wooden coffee table that anchors the TV lounge, beside the armchair.',
      details: 'Model: "Modern Coffee Table 01" by Amin, Poly Haven (CC0).',
    },
    // Techo
    pendant: {
      name: 'Glass pendant lamp',
      description:
        'A glass pendant lamp hanging from the ceiling over the TV lounge.',
      details:
        'Model: "Modern Ceiling Lamp 01" by James Ray Cock, Poly Haven (CC0).',
    },
  },
  surfaces: {
    wallGreen: {
      name: 'Green wall',
      description:
        'The teal wall: prints, brass sconces, bookshelf and clock around the bookshelf.',
    },
    wallWindow: {
      name: 'Window wall',
      description:
        'The window wall: sunset window with linen curtains, floor lamp, reading nook and music corner.',
    },
    wallTv: {
      name: 'TV wall',
      description:
        'The TV wall: television over a walnut sideboard, flanked by botanical prints; door and an arched print at the sides.',
    },
    wallDesk: {
      name: 'Desk wall',
      description:
        'The desk wall: oak desk with monitor and lamp, display shelves, armoire and the cyanotype diptych.',
    },
    ceiling: {
      name: 'Ceiling',
      description:
        'The ceiling: soft cornice all around and a glass pendant over the TV lounge.',
    },
  },
} satisfies PieceMessages;

export default PIECES_EN as PieceMessages;
