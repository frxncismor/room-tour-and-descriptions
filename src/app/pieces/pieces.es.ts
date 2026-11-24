import type { PieceMessages } from '../i18n/messages';

/**
 * Textos españoles de las piezas y superficies (chunk perezoso). Tuteo
 * neutro. Los 5 muebles de siempre repiten su texto de `es.ts` (un test
 * comprueba que coinciden); así este chunk no importa nada del inicial.
 */
const PIECES_ES = {
  pieces: {
    // Pared verde
    sofa: {
      name: 'Sofá rinconera',
      description:
        'Sofá rinconera con cojines sueltos en el respaldo y un puf independiente, en tono terracota. Define la zona de estar a la izquierda.',
      details: 'Modelo: «Sofa Set», de FREEDomplant, vía Sketchfab.',
    },
    pokerTable: {
      name: 'Mesa de póker',
      description:
        'Mesa de cartas con tapete de fieltro, borde acolchado y estructura de madera. Está a la derecha, frente al sofá.',
      details:
        'Modelo: «Poker Board Game Table», de Lília Mara, vía Sketchfab.',
    },
    bookshelf: {
      name: 'Estantería',
      description:
        'Estantería abierta de cuatro baldas, en madera oscura. Está contra la pared del fondo, centrada entre el cuadro y el reloj.',
      details: 'Modelo: «BookShelf», de Twpic, vía Sketchfab.',
    },
    landscapePainting: {
      name: 'Cuadro de paisaje',
      description:
        'Paisaje al óleo con un molino y un río, en marco dorado con moldura de perlas. Cuelga en la pared del fondo, iluminado por un foco.',
      details:
        'Modelo: «Fancy Picture Frame 01», de Rob Tuytel y Rico Cilliers, Poly Haven (CC0).',
    },
    succulent: {
      name: 'Suculenta en maceta',
      description:
        'Haworthia cebra en una maceta de cerámica desgastada, junto a la estantería.',
      details:
        'Modelo: «Potted Plant 04», de James Ray Cock, Poly Haven (CC0).',
    },
    clock: {
      name: 'Reloj de pared',
      description:
        'Un reloj de pared redondo en la pared verde, a la derecha de la estantería.',
      details: 'Modelo: «Wall Clock», de PierreB3D, Poly Haven (CC0).',
    },
    vase: {
      name: 'Jarrón de cerámica',
      description:
        'Un jarrón de cerámica en el suelo, a la izquierda de la estantería.',
      details:
        'Modelo: «Ceramic Vase 02», de James Ray Cock, Poly Haven (CC0).',
    },
    printSpiraea: {
      name: 'Cianotipo: Spiraea',
      description:
        'Una lámina en cianotipo de barba de cabra, blanca sobre azul de Prusia. Una de las dos láminas botánicas que flanquean la estantería.',
      details:
        '«Spiraea aruncus (Tyrol)», Anna Atkins, 1851–54. Cianotipo, The Met (CC0).',
    },
    printFelce: {
      name: 'Papel salado: Felce',
      description:
        'Una copia en papel salado de una fronda de helecho en sepia cálido. Equilibra el cianotipo del otro lado de la estantería.',
      details:
        '«Felce», William Henry Fox Talbot, 1839. Papel salado, The Met (CC0).',
    },
    sconcesBack: {
      name: 'Apliques de latón',
      description:
        'Apliques de latón que bañan la pared verde con luz cálida, sobre la estantería.',
    },
    // Pared de la ventana
    window: {
      name: 'Ventana con cortinas de lino',
      description:
        'Una ventana alta que da a un cielo de atardecer, con cortinas de lino hasta el suelo.',
    },
    floorLamp: {
      name: 'Lámpara de pie',
      description:
        'La lámpara de pie de la esquina, de tallo de latón. Viene encendida; apágala para ver la sala sin ella.',
      actions: {
        power: {
          whenOff: 'Encender luz',
          whenOn: 'Apagar luz',
          announceOn: 'Lámpara de pie encendida.',
          announceOff: 'Lámpara de pie apagada.',
        },
      },
    },
    readingChair: {
      name: 'Sillón de lectura y mesita',
      description:
        'Un sillón de lectura de estilo mid-century en el rincón, con una mesita al alcance de la mano.',
      details:
        'Modelos: «Mid Century Lounge Chair», de K. Siitonen, y «Side Table 01», de James Ray Cock, Poly Haven (CC0).',
    },
    readingLamp: {
      name: 'Lámpara de lectura',
      description:
        'Una lámpara de mesa con pantalla de lino junto al sillón de lectura.',
      actions: {
        power: {
          whenOff: 'Encender luz',
          whenOn: 'Apagar luz',
          announceOn: 'Lámpara de lectura encendida.',
          announceOff: 'Lámpara de lectura apagada.',
        },
      },
    },
    sideboard: {
      name: 'Aparador con discos',
      description:
        'Una cómoda baja de madera con una hilera de discos de vinilo. Sostiene el tocadiscos.',
      details:
        'Modelo: «Vintage Wooden Drawer 01», de James Ray Cock, Poly Haven (CC0). Discos: procedurales.',
    },
    turntable: {
      name: 'Tocadiscos',
      description:
        'Un tocadiscos de nogal con brazo de latón sobre el aparador. Pon el disco y el plato gira; el sonido es opcional y viene apagado.',
      details:
        'El sonido se genera en tu navegador: sin grabaciones ni descargas.',
      actions: {
        spin: {
          whenOff: 'Poner disco',
          whenOn: 'Parar disco',
          announceOn: 'Disco en marcha.',
          announceOff: 'Disco parado.',
          stateOff: 'Plato: parado',
          stateOn: 'Plato: girando',
        },
        sound: {
          whenOff: 'Sonido: apagado',
          whenOn: 'Sonido: encendido',
          announceOn: 'Sonido encendido.',
          announceOff: 'Sonido apagado.',
          disabledHint: 'Pon antes el disco',
        },
      },
    },
    bookcaseLeft: {
      name: 'Librería del rincón',
      description:
        'Gemela de la estantería del fondo, junto a la pared de la ventana para cerrar el rincón de lectura.',
      details: 'Modelo: «BookShelf», de Twpic, vía Sketchfab.',
    },
    printNook: {
      name: 'Lámina botánica (rincón)',
      description:
        'Una lámina botánica en azul y sepia, en la pared de la ventana junto al rincón de lectura.',
      details: 'Lámina de dominio público. Los créditos están en el README.',
    },
    // Pared de la tele
    tv: {
      name: 'Televisión',
      description:
        'Una pantalla de 55 pulgadas con marco de nogal, colgada baja como un cuadro. En modo arte repasa los cianotipos y papeles salados de esta sala, uno cada ocho segundos.',
      details:
        'Contenido de la pantalla: láminas de dominio público de esta sala. Marco y aparador: procedurales.',
      actions: {
        power: {
          whenOff: 'Encender',
          whenOn: 'Apagar',
          announceOn: 'Televisión encendida. En pantalla: {work}.',
          announceOff: 'Televisión apagada.',
          stateOn: 'En pantalla: {work}',
        },
        next: {
          whenOff: 'Siguiente lámina',
          announceOn: 'En pantalla: {work}.',
        },
      },
    },
    credenza: {
      name: 'Aparador de nogal',
      description:
        'Un aparador largo de nogal bajo la televisión, con unos libros y un jarrón de cerámica encima.',
    },
    printsFront: {
      name: 'Láminas botánicas (tele)',
      description:
        'Dos láminas botánicas en azul y sepia, una a cada lado de la televisión.',
      details: 'Láminas de dominio público. Los créditos están en el README.',
    },
    plantFicus: {
      name: 'Ficus de hoja grande',
      description:
        'Un ficus de hojas anchas en una maceta, en la esquina del salón de la tele.',
    },
    door: {
      name: 'Puerta de paneles',
      description:
        'Una puerta de paneles con manilla de latón, en la pared de la tele cerca de la esquina derecha.',
    },
    archMirror: {
      name: 'Cianotipo de arco',
      description:
        'Un cianotipo alto rematado en arco, con el helecho Osmunda y marco fino, en el extremo izquierdo de la pared de la tele.',
    },
    // Pared del escritorio
    diptych: {
      name: 'Díptico de cianotipos',
      description:
        'Dos láminas en cianotipo, una junto a otra y con marcos iguales, en la pared del escritorio.',
      details:
        '«Osmunda regalis (Australia)», 1853/54, y «Pteris aquilina», 1851, Anna Atkins. Dominio público.',
    },
    tallCabinet: {
      name: 'Armario pintado',
      description:
        'Un armario alto de dos puertas con paneles, pintado en crema. Está entre el díptico y el escritorio.',
      details:
        'Modelo: «Painted Wooden Cabinet 02», de K. Sannikov, Poly Haven (CC0).',
    },
    printRight: {
      name: 'Lámina botánica (escritorio)',
      description:
        'Una lámina botánica en azul y sepia, entre el armario y el escritorio.',
      details: 'Lámina de dominio público. Los créditos están en el README.',
    },
    desk: {
      name: 'Escritorio, silla y estante',
      description:
        'Un escritorio sencillo de roble con un estante en la pared y una silla de madera pintada. El monitor y el flexo son piezas aparte.',
      details:
        'Escritorio y estante: procedurales. Silla: «Painted Wooden Chair 02», de K. Sannikov, Poly Haven (CC0).',
    },
    monitor: {
      name: 'Monitor',
      description:
        'Un monitor fino sobre el escritorio de roble. Enciéndelo para ver una ventana de editor tranquila; da un leve resplandor frío.',
      actions: {
        power: {
          whenOff: 'Encender pantalla',
          whenOn: 'Apagar pantalla',
          announceOn: 'Monitor encendido.',
          announceOff: 'Monitor apagado.',
        },
      },
    },
    deskLamp: {
      name: 'Flexo',
      description:
        'Un flexo de latón con brazo articulado. Su pantalla se ilumina en tono cálido al encenderlo.',
      actions: {
        power: {
          whenOff: 'Encender luz',
          whenOn: 'Apagar luz',
          announceOn: 'Flexo encendido.',
          announceOff: 'Flexo apagado.',
        },
      },
    },
    displayShelves: {
      name: 'Estantería de cubos',
      description:
        'Una estantería de cubos de madera con libros y algunos objetos pequeños.',
      details:
        'Modelo: «Wooden Display Shelves 01», de James Ray Cock, Poly Haven (CC0). Objetos: procedurales.',
    },
    // Suelo y asientos
    cushionsThrow: {
      name: 'Cojines y manta',
      description: 'Cojines sueltos y una manta sobre el sofá modular.',
    },
    armchair: {
      name: 'Sillón de cuero',
      description:
        'Un sillón de cuero en el salón de la tele, girado hacia la mesa de centro.',
      details:
        'Modelo: «Modern Arm Chair 01», de Vibrant Nordic, Poly Haven (CC0).',
    },
    coffeeTable: {
      name: 'Mesa de centro',
      description:
        'Una mesa de centro baja de madera que ancla el salón de la tele, junto al sillón.',
      details: 'Modelo: «Modern Coffee Table 01», de Amin, Poly Haven (CC0).',
    },
    // Techo
    pendant: {
      name: 'Lámpara colgante',
      description:
        'Una lámpara colgante de cristal que cuelga del techo sobre el salón de la tele.',
      details:
        'Modelo: «Modern Ceiling Lamp 01», de James Ray Cock, Poly Haven (CC0).',
    },
  },
  surfaces: {
    wallGreen: {
      name: 'Pared verde',
      description:
        'La pared verde: láminas, apliques de latón, estantería y reloj en torno a la librería.',
    },
    wallWindow: {
      name: 'Pared de la ventana',
      description:
        'La pared de la ventana: ventana de atardecer con cortinas de lino, lámpara de pie, rincón de lectura y rincón de música.',
    },
    wallTv: {
      name: 'Pared de la tele',
      description:
        'La pared de la tele: televisión sobre aparador de nogal con láminas botánicas a los lados; puerta y una lámina de arco en los extremos.',
    },
    wallDesk: {
      name: 'Pared del escritorio',
      description:
        'La pared del escritorio: escritorio de roble con monitor y flexo, estantería de cubos, armario y el díptico de cianotipos.',
    },
    ceiling: {
      name: 'Techo',
      description:
        'El techo: cornisa suave en todo el perímetro y una lámpara colgante sobre el salón de la tele.',
    },
  },
} satisfies PieceMessages;

export default PIECES_ES as PieceMessages;
