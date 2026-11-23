import { Messages } from './messages';

/** Diccionario español (chunk perezoso: `import('./es')`). */
const ES = {
  meta: {
    title: 'Room Tour — Visor 3D interactivo de interiores',
    description:
      'Explora un salón en 3D en tu navegador: orbita la cámara, haz clic en los muebles para ver sus detalles y recorre el espacio. Hecho con Angular y Three.js.',
  },
  brand: {
    title: 'Room Tour',
    byline: 'por Francisco Moreno',
  },
  loading: {
    title: 'Room Tour',
    byline: 'por Francisco Moreno',
    status: 'Cargando la sala',
  },
  errors: {
    webglTitle: 'WebGL no está disponible',
    contextLostTitle: 'La vista 3D se interrumpió',
    webglHelp:
      'Este visor necesita WebGL. Usa una versión reciente de Chrome, Edge, Firefox o Safari, con la aceleración por hardware activada.',
    retry: 'Reintentar',
    messages: {
      'context-lost':
        'Se perdió el contexto 3D. Se recuperará automáticamente.',
      'webgl-unavailable':
        'Tu navegador o dispositivo no puede ejecutar el visor 3D (WebGL).',
      'render-failed': 'La vista 3D dejó de funcionar. Inténtalo de nuevo.',
      'model-load-failed': 'No se pudo cargar: {names}.',
      // Solo se muestra cuando falta el ES: se queda en inglés a propósito.
      'locale-load-failed': 'Could not load Spanish. Staying in English.',
    },
  },
  panel: {
    close: 'Cerrar detalles',
  },
  list: {
    title: 'Piezas',
    resetView: 'Restablecer vista',
    resetViewLabel: 'Volver a la posición inicial de la vista',
  },
  help: {
    title: 'Controles',
    open: 'Controles',
    openLabel: 'Mostrar los controles',
    gotIt: 'Cerrar',
    controls: [
      {
        label: 'Orbitar',
        text: 'Arrastra con el botón izquierdo del ratón',
        touchText: 'Arrastra con un dedo',
        icon: 'rotate',
      },
      {
        label: 'Desplazar',
        text: 'Arrastra con el botón derecho; también valen las flechas del teclado',
        touchText: 'Arrastra con dos dedos',
        icon: 'pan',
      },
      {
        label: 'Zoom',
        text: 'Gira la rueda del ratón',
        touchText: 'Pellizca con dos dedos',
        icon: 'zoom',
      },
      {
        label: 'Moverse',
        text: 'Haz clic en el suelo para ir allí',
        touchText: 'Toca el suelo para ir allí',
        icon: 'walk',
      },
      {
        label: 'Inspeccionar',
        text: 'Haz clic en una pieza para leer sobre ella',
        touchText: 'Toca una pieza para leer sobre ella',
        icon: 'inspect',
      },
      {
        label: 'Teclas',
        touchLabel: 'Cerrar',
        text: 'Esc cierra los detalles. Inicio restablece la vista.',
        touchText: 'Toca la cruz para cerrar los detalles',
        icon: 'keyboard',
      },
    ],
  },
  language: {
    label: 'Idioma',
    announce: 'Idioma: español',
  },
  canvasLabel:
    'Vista 3D interactiva de un salón. Usa la lista de piezas para inspeccionar cada una con el teclado.',
  assets: {
    floor: 'Textura del suelo',
    rug: 'Textura de la alfombra',
    clock: 'Reloj de pared',
    vase: 'Jarrón de cerámica',
    prints: 'Láminas',
    fabric: 'Textura de tela',
  },
  furniture: {
    sofa: {
      name: 'Sofá rinconera',
      description:
        'Sofá rinconera con cojines sueltos en el respaldo y un puf independiente, en tono terracota. Define la zona de estar a la izquierda.',
      details: 'Modelo: "Sofa Set", de FREEDomplant, vía Sketchfab.',
    },
    pokerTable: {
      name: 'Mesa de póker',
      description:
        'Mesa de cartas con superficie de juego de fieltro, borde acolchado y estructura de madera. Está a la derecha, frente al sofá.',
      details:
        'Modelo: "Poker Board Game Table", de Lília Mara, vía Sketchfab.',
    },
    bookshelf: {
      name: 'Estantería',
      description:
        'Estantería abierta de cuatro baldas, en madera oscura. Está contra la pared del fondo, centrada entre el cuadro y el reloj.',
      details: 'Modelo: "BookShelf", de Twpic, vía Sketchfab.',
    },
    landscapePainting: {
      name: 'Cuadro de paisaje',
      description:
        'Paisaje al óleo con un molino y un río, en marco dorado con moldura de perlas. Cuelga en la pared del fondo, iluminado por un foco.',
      details:
        'Modelo: "Fancy Picture Frame 01", de Rob Tuytel y Rico Cilliers, Poly Haven (CC0).',
    },
    succulent: {
      name: 'Suculenta en maceta',
      description:
        'Haworthia cebra en una maceta de cerámica desgastada, junto a la estantería.',
      details:
        'Modelo: "Potted Plant 04", de James Ray Cock, Poly Haven (CC0).',
    },
  },
} satisfies Messages;

export default ES;
