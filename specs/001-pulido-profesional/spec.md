# Especificación: Room tour pulido profesional

**Feature**: `001-pulido-profesional` · **Fecha**: 2026-11-22 · **Estado**: Borrador para aprobación de Paco
**Fuente de verdad del diagnóstico**: `runs/11221609/investigacion.md` (bugs C1–C17). Verificado contra el código en `ba66b12`.
**Idioma**: spec y plan en español; el idioma de la UI es una decisión abierta (ver plan, D-08).

## Contexto y objetivo

Interior Viewer es una pieza de portfolio de Paco (fullstack software engineer): una sala 3D con tres muebles
cuyas descripciones aparecen al hacer clic. Hoy **el repo no compila** (C1), dos de las tres funciones
anunciadas no funcionan (C2, C3), la carga pesa ~51 MB sin indicador y la base técnica (Angular 17, three 0.162,
eslint 8, Karma) está obsoleta. Objetivo: que quien abra la demo o el repositorio vea un proyecto
**estable, rápido, accesible y cuidado**, y que un revisor técnico encuentre un repo verde y bien documentado.

**Fuera de alcance** (no se hace en esta feature): nuevos muebles o contenido 3D nuevo, físicas, multijugador,
backend, analítica, PWA/offline, pointer lock o modo pantalla completa, internacionalización con cambio de idioma
en caliente, editor de escena. Los estilos muertos de pointer lock/fullscreen en `styles.scss` se eliminan.

## Historias de usuario (priorizadas)

### US1 — Un repo que compila, pasa lint y tests (P0, bloqueante)
Como revisor técnico clono el repo y `npm ci && npm run lint:check && npm run build && npm test` termina en verde.
**Por qué P0**: sin esto no hay build, ni tests, ni CI, ni demo reproducible. Es lo primero que vería un revisor.
**Prueba independiente**: ejecutar los tres comandos en limpio, en Windows (CRLF) y en Linux (CI).
**Escenarios**:
1. *Dado* un clon limpio, *cuando* corro `npm run build`, *entonces* termina sin errores TS.
2. *Dado* un checkout en Windows con `core.autocrlf=true`, *cuando* corro `npm run lint:check`, *entonces* prettier no marca archivos por EOL.
3. *Dado* el spec de `AppComponent`, *cuando* corro `npm test`, *entonces* pasa y valida algo real (se crea el componente, hay un visor).

### US2 — Navegar la sala con lo que la ayuda promete (P1)
Como visitante hago clic en el suelo y la cámara se desplaza hasta ahí con una animación; puedo girar, hacer zoom,
volver a la vista inicial, y no puedo atravesar paredes ni salir de la sala.
**Prueba independiente**: en navegador, clic en suelo → cámara se mueve; arrastrar no dispara clic; zoom máx no saca de la sala.
**Escenarios**:
1. *Dado* la sala cargada, *cuando* hago clic en un punto del suelo dentro de límites, *entonces* la cámara se anima (≈1 s) hasta allí y la vista queda estable.
2. *Dado* que arrastro para girar, *cuando* suelto el botón, *entonces* no se interpreta como clic (umbral por distancia, no por tiempo).
3. *Dado* que giro hacia arriba/abajo, *cuando* muevo la cámara, *entonces* la rotación vertical es fluida (sin saltos).
4. *Dado* zoom al máximo, *cuando* me alejo, *entonces* la cámara permanece dentro de los muros.
5. *Dado* el teclado, *cuando* uso flechas (rotar) y `Home`/botón «Vista inicial», *entonces* la vista responde / se restablece.

### US3 — Descubrir los muebles con feedback claro (P1)
Como visitante, al pasar el puntero sobre un mueble el cursor cambia y el mueble se resalta; al hacer clic se
resalta con contorno visible y se abre un panel con una descripción útil, que puedo cerrar con botón o `Esc`.
**Prueba independiente**: clic sobre sofá, mesa, estantería; clic fuera; `Esc`.
**Escenarios**:
1. *Dado* el puntero sobre un mueble, *entonces* el cursor es `pointer` y hay un resalte sutil (hover).
2. *Dado* un clic en un mueble, *entonces* aparece contorno/resalte visible que sigue la forma real (no una caja rotada) y el panel con transición.
3. *Dado* el panel abierto, *cuando* pulso `Esc`, la «×», o hago clic en vacío, *entonces* se cierra y el contorno se retira; el foco vuelve al canvas.
4. *Dado* un lector de pantalla, *cuando* se abre el panel, *entonces* el nombre y la descripción se anuncian (`aria-live`).
5. *Dado* que selecciono otro mueble, *entonces* solo hay un contorno y un único bucle de animación activos.

### US4 — Carga con progreso y errores comprensibles (P1)
Como visitante veo una pantalla de carga con progreso real mientras se descargan los modelos, puedo interactuar en
cuanto la escena esté lista, y si algo falla (sin WebGL, red, modelo) veo un mensaje claro con «Reintentar».
**Escenarios**:
1. *Dado* una conexión lenta, *entonces* se ve una barra/porcentaje que sube con los bytes reales, no «Infinity%».
2. *Dado* que un modelo falla, *entonces* los otros se muestran igualmente y aparece un aviso no bloqueante con reintento de ese modelo.
3. *Dado* un navegador sin WebGL, *entonces* aparece un mensaje de error a pantalla completa explicando qué hacer, no una pantalla en blanco.
4. *Dado* la carga completa, *entonces* el cuerpo de clics está activo (los listeners no esperan a la descarga).

### US5 — Funciona bien en móvil y táctil (P2)
Como visitante en un teléfono la ayuda no tapa la escena, la altura respeta la barra del navegador, la imagen es
nítida y puedo girar (un dedo), hacer zoom (pellizco) y tocar muebles/suelo.
**Escenarios**: en 390×844 el encuadre inicial muestra los muebles; la ayuda ocupa ≤ 40 % de la altura y se puede cerrar;
un toque corto selecciona, un arrastre gira; no hay scroll de página ni zoom accidental; `100dvh` correcto al ocultarse la barra.

### US6 — Accesible por teclado y lector de pantalla (P2)
Como usuario de teclado/lector de pantalla puedo conocer los muebles y sus descripciones sin ratón.
**Escenarios**: Tab recorre: ayuda → botón «Vista inicial» → lista de muebles (botones que abren el panel y llevan la cámara) → cerrar;
foco visible siempre; el canvas tiene `role="img"`/`aria-label` descriptivo y `tabindex`; los iconos de la ayuda tienen texto.

### US7 — Rendimiento y limpieza (P2)
Como visitante con un portátil o móvil modesto la app consume poco: no hay change detection a 60 Hz, no hay bucles huérfanos,
y al destruir el visor se liberan recursos. La descarga inicial es ≤ 8 MB.
**Escenarios**: con el visor en reposo, `ApplicationRef.tick` no se ejecuta por frame; tras `dispose()` no queda ningún rAF ni listener;
Chrome DevTools → Performance muestra frames estables y sin avisos de «context lost»; transferencia total de modelos ≤ 8 MB.

### US8 — Escena visualmente cuidada (P2)
Como visitante veo muebles apoyados en el suelo, con color/material coherente (el sofá ya no es gris con moiré),
la estantería se distingue de la pared, y hay sombras y luces razonables.
**Escenarios**: comparación contra las capturas de referencia; ningún mueble flota ni se hunde (base a y=0 ± 0,02 m);
estantería con contraste visible contra la pared; sombras sin recortes en los bordes de la sala.

### US9 — Marca y metadatos (P3)
Como persona que comparte el enlace veo un título y vista previa decentes (Open Graph/Twitter), con favicon propio y `theme-color`.

### US10 — Documentación y demo creíbles (P3)
Como revisor leo un README que describe lo que realmente hace la app: capturas/GIF, features reales, stack con versiones
correctas, scripts, arquitectura real (servicios que existen), cómo contribuir, y enlace a la demo.

### US11 — Dependencias al día y tooling moderno (P2)
Como mantenedor tengo Angular y three actuales, `npm audit --omit=dev` sin vulnerabilidades altas, eslint flat config,
tests con el runner recomendado por Angular y (propuesta) CI que ejecuta lint, build y tests en cada PR.

## Requisitos funcionales

### Estabilidad y tooling (US1, US11)
- **FR-001** (C1): el proyecto compila sin errores TS: import de `Object3D` en `scene.service.ts`; `UI_TEXT` en un módulo propio (`config/ui-text.ts`) y no en `scene.interface`; tipos de `camera`/`scene` correctos (`PerspectiveCamera`, `Scene`) en `ObjectInteractionService`.
- **FR-002**: `.gitattributes` con `* text=auto eol=lf` (y binarios marcados); los archivos del repo se renormalizan a LF en un commit propio; `npm run lint:check` pasa en Windows y Linux.
- **FR-003**: `CONTRIBUTING.md` coincide con `.prettierrc`/`.editorconfig` (2 espacios, no tabs) y con los scripts reales.
- **FR-004**: `app.component.spec.ts` se reescribe contra el componente real; se añaden specs útiles de servicios (ver FR-060).
- **FR-005**: `package.json` pasa a `husky` (no `husky install`) y se eliminan `@angular/material`, `@angular/forms`, `@angular/router`, `@angular/animations`/`provideAnimations`, `app.config.ts`, `app.routes.ts`, `styles.css` y la copia de `three/examples/jsm` a assets si no se usan.
- **FR-006** (propuesta): workflow de GitHub Actions con `npm ci`, `lint:check`, `build`, `test` en push/PR (decisión D-07).

### Navegación y cámara (US2)
- **FR-010** (C2): el clic en el suelo mueve la cámara con una animación (teletransporte suave); respeta los límites de la sala y no interrumpe si ya hay una animación (se encola o se ignora de forma documentada).
- **FR-011** (C7): la rotación vertical no se fuerza en cada evento `change`; se fijan `minPolarAngle`/`maxPolarAngle` y la altura de ojos solo se aplica al teletransportar. `maxDistance` y la posición se limitan a la sala (con margen a los muros). Los muros pasan a doble cara (`DoubleSide`) o se usan límites duros de cámara, de forma que nunca se ve el exterior.
- **FR-012**: botón «Vista inicial» y tecla `Home`/`R` restablecen cámara y cierran el panel.
- **FR-013** (C10): clic vs. arrastre se decide por distancia recorrida (≥ 5 px entre `pointerdown` y `pointerup`) usando Pointer Events (ratón, táctil, lápiz). Un toque corto selecciona.
- **FR-014**: se desactiva la selección de texto y el zoom del navegador sobre el canvas (`touch-action: none`).
- **FR-015**: teclado: flechas giran la vista (`OrbitControls.listenToKeyEvents`), `+`/`-` zoom; documentado en la ayuda.

### Selección y panel (US3)
- **FR-020** (C3, C11): el contorno de selección se añade a la escena, usa el recorrido de la geometría del objeto (clon de mallas con `BackSide` y escalado, o `OutlinePass`/`BoxHelper` según plan) en coordenadas locales, se anima sin bucle propio (se actualiza en el bucle principal) y se libera al deseleccionar.
- **FR-021**: hover: el cursor es `pointer` sobre muebles y `grab`/`grabbing` en otro caso; el hover aplica un resalte de emisión sutil. Se calcula con throttle (≤ 1 raycast por frame) y fuera de la zona de Angular.
- **FR-022** (C15): el panel tiene botón de cierre, cierra con `Esc` y con clic en vacío, devuelve el foco al canvas, tiene transición de entrada/salida (CSS, respeta `prefers-reduced-motion`) y no se mueve con `:hover`.
- **FR-023**: el panel usa `role="dialog"`/`complementary` con `aria-labelledby` y una región `aria-live="polite"` que anuncia el mueble seleccionado.
- **FR-024**: descripciones mejoradas (2–4 frases, con material, dimensiones o usos) y datos estructurados `ObjectInfo { name, description, details? }` definidos en configuración.
- **FR-025**: la selección anima la cámara suavemente para encuadrar el mueble (opcional configurable; ver D-04).
- **FR-026**: una lista accesible «Muebles» (botones) permite seleccionar cada mueble por teclado/lector (US6).

### Carga y errores (US4)
- **FR-030** (C8): los tres modelos se cargan en paralelo (`Promise.allSettled`), cada uno con su propio manejo de error; los listeners de interacción se registran antes de la carga.
- **FR-031** (C8): el progreso agregado se calcula con bytes reales (`loaded/total` solo si `lengthComputable`/`total>0`; si no, estimación por tamaño conocido en config) y se expone a la UI como señal 0–100.
- **FR-032**: pantalla de carga con barra de progreso `role="progressbar"`, porcentaje y nombre del activo; desaparece con fundido al terminar.
- **FR-033**: errores de WebGL, carga e interacción se muestran en la UI (overlay de error a pantalla completa para WebGL; toast/banner con «Reintentar» para carga) y se registran con contexto. Se elimina todo `catch` mudo.
- **FR-034**: detección de WebGL antes de crear el renderer; manejo de `webglcontextlost`/`webglcontextrestored` con mensaje y reintento.

### Rendimiento y limpieza (US7)
- **FR-040** (C4): el bucle de render, `resize` y los listeners de puntero no disparan detección de cambios (decisión D-01: zoneless con señales *o* `runOutsideAngular`). La UI se actualiza solo por señales en eventos puntuales.
- **FR-041** (C5): `SceneService` guarda el id de `requestAnimationFrame` y lo cancela en `dispose`; `dispose` libera geometrías, materiales, texturas, `OrbitControls`, renderer y listeners; los servicios son reinicializables (`initialize → dispose → initialize` sin fugas).
- **FR-042** (C6): el listener de `resize` se guarda y se quita con la misma referencia; mejor aún, `ResizeObserver` sobre el contenedor.
- **FR-043** (C9): `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`; el tamaño sale del contenedor (no de `window`); la altura usa `100dvh` con *fallback* `100vh`.
- **FR-044** (opcional, D-03): render bajo demanda (solo cuando cambian cámara, hover, animación) en lugar de continuo, para ahorrar batería.
- **FR-045** (C14): materiales tratados como `Material | Material[]`; `needsUpdate` innecesario eliminado; `castShadow` solo en mallas relevantes y `receiveShadow` donde aporte.

### Assets y escena (US7, US8)
- **FR-050** (C16): los modelos se optimizan con gltf-transform: texturas a WebP (o KTX2 según D-05) con tamaño máximo 1024 px (2048 la madera de la mesa si hace falta), geometría con `meshopt` + cuantización, deduplicación; total de `src/assets/models` ≤ 8 MB y ninguna textura individual > 1 MB. `ModelLoader` registra el decodificador necesario.
- **FR-051** (C12): los modelos se posicionan por su base (min Y del bounding box = 0 sobre el suelo + `offsetY` opcional por modelo), no por su centro; las posiciones `y` de `MODEL_CONFIGURATIONS` pasan a ser offsets documentados.
- **FR-052** (C17): el sofá recibe un material propio (color, rugosidad, normal procedural opcional) por configuración, eliminando el gris y el moiré (antialiasing + `anisotropy` y mipmaps en texturas; cuantización correcta de normales).
- **FR-053** (C13): iluminación coherente con `DEFAULT_SCENE_CONFIG.lighting` (ahora sin usar): luz hemisférica/ambiental, una direccional con sombra dimensionada para la sala (cámara de sombra ajustada, `mapSize` 2048, `bias`/`normalBias`), puntos de luz sin sombra; materiales de muros `MeshStandardMaterial` mate en vez de `MeshPhysicalMaterial` con clearcoat; contraste suficiente entre estantería y pared.
- **FR-054**: tras actualizar three (r165+), intensidades y `colorSpace`/`outputColorSpace`/tone mapping revisados para que la imagen coincida con (o supere) las capturas de referencia.

### UI/UX, accesibilidad y marca (US5, US6, US9)
- **FR-060**: componentes separados y *standalone*: `viewer` (contenedor), `loading-screen`, `help-panel`, `description-panel`, `error-banner`/`error-overlay`, `object-list`. Estado compartido en un servicio de estado con señales (`ViewerStateService`).
- **FR-061**: ayuda de controles honesta: ratón (arrastrar, rueda, clic), táctil (un dedo, pellizco, toque), teclado (flechas, `Home`, `Esc`); iconos SVG con `aria-hidden` y texto visible; se puede reabrir con botón «?»; se recuerda que se cerró (`localStorage` protegido con try/catch).
- **FR-062**: CSS: media queries (≤ 600 px, orientación apaisada), `dvh`, paneles responsivos (ancho `min(92vw, 360px)`), variables CSS (paleta, radios coherentes 12 px, sombras), sin `transition: all`, fuente de sistema con *stack* definido o una fuente web con `font-display: swap`.
- **FR-063**: encuadre inicial ajustado para que en 390×844 se vean los tres muebles (FOV/posición en función del aspect ratio).
- **FR-064**: foco visible (`:focus-visible`) en todos los controles; contraste AA; tamaños táctiles ≥ 44 px; `prefers-reduced-motion` desactiva animaciones de cámara largas y transiciones.
- **FR-065**: `index.html`: `lang`, `<title>` descriptivo, `meta description`, `theme-color`, Open Graph y Twitter Card (imagen en `assets/brand/og.png` 1200×630), favicon propio (SVG + ICO + apple-touch-icon), `noscript`.
- **FR-066**: se retira el `UI_TEXT` hardcodeado en `scene.config.ts`; los textos viven en `config/ui-text.ts` (idioma de D-08) para poder cambiar de idioma.

### Documentación (US10)
- **FR-070**: README con descripción real, badge de versiones correctas, capturas/GIF (`docs/media/`), lista de features verificada, tabla de stack, scripts, arquitectura (diagrama de servicios real), decisiones técnicas (optimización de assets, render, accesibilidad), enlace a demo y autoría confirmada (D-09).
- **FR-071**: `CONTRIBUTING.md` actualizado (comandos, formato, commits convencionales, flujo de PR).

### Pruebas (transversal)
- **FR-080**: specs de servicio: `ObjectInteractionService` (raycast, floor vs objeto, validación de teletransporte, contorno añadido/retirado a la escena, sin bucles acumulados), `CameraService` (límites, animación de teletransporte con temporizador falso, reset), `ModelLoaderService` (progreso, fallo parcial, base sobre suelo), `SceneService` (initialize/dispose idempotentes, cancela rAF, quita listeners), `ViewerStateService`/componentes de UI (cierre con Esc, aria-live, progressbar). Se usa WebGL simulado o *mocks*; los tests no necesitan GPU.

## Cobertura de bugs (trazabilidad)

| Bug | Req. | Fase del plan | Decisión |
|---|---|---|---|
| C1 | FR-001 | F0 | Incluido |
| C2 | FR-010 | F4a+F4b | Incluido |
| C3 | FR-020 | F4a | Incluido |
| C4 | FR-040 | F4b, F7 | Incluido |
| C5 | FR-041 | F4b | Incluido |
| C6 | FR-042 | F4b | Incluido |
| C7 | FR-011 | F4b | Incluido |
| C8 | FR-030/031/033 | F4b, F7 | Incluido |
| C9 | FR-043 | F4b, F7 | Incluido |
| C10 | FR-013 | F7 | Incluido |
| C11 | FR-020 | F4a | Incluido (se reemplaza el Box3 de mundo) |
| C12 | FR-051 | F4b (lógica), F6 (afinado) | Incluido |
| C13 | FR-053 | F6 | Incluido |
| C14 | FR-045 | F4b | Incluido |
| C15 | FR-022/023 | F7 | Incluido |
| C16 | FR-050 | F2 | Incluido |
| C17 | FR-052 | F6 (material por config); F2 (limpieza de normales) | Incluido. Causa verificada: el `gltf` del sofá solo tiene `baseColorFactor` y ninguna textura; el gris es el color del factor, y el moiré viene de geometría densa sin mipmaps/normal. |
| Deuda baja | FR-005, FR-066 | F0, F1, F7 | Incluida (código muerto, estilos muertos, `getMousePosition` con `event.target`). |

No se deja fuera ningún C1–C17. Solo se excluye (por valor/coste) lo listado en «Fuera de alcance».

## Criterios de éxito medibles

- **SC-001**: `npm ci && npm run lint:check && npm run build && npm test` → exit code 0 en Windows y Linux (CI); 0 warnings de TS.
- **SC-002**: `npm audit --omit=dev --audit-level=high` → 0 vulnerabilidades altas/críticas.
- **SC-003**: transferencia de `src/assets/models` ≤ 8 MB (hoy ~51 MB); LCP (3G rápido simulado) ≤ 6 s con la pantalla de carga visible desde el primer paint.
- **SC-004**: bundle inicial (JS) ≤ 900 kB sin comprimir / ≤ 220 kB transferido (hoy 770/177 kB; margen por three actual).
- **SC-005**: en reposo, 0 ciclos de `ApplicationRef.tick` por frame (medido con un contador en test/*perfil*) y ≥ 55 fps medios en escritorio; tras `dispose`, 0 rAF activos y 0 listeners de `window` residuales (test automático).
- **SC-006**: Lighthouse (móvil) Accesibilidad ≥ 95, Best Practices ≥ 95, SEO ≥ 90; 0 errores de consola; 0 logs `Infinity%`.
- **SC-007**: comprobación manual escrita (checklist del plan) superada en Chrome, Firefox y Safari iOS/Android emulado: clic en suelo mueve la cámara, clic en mueble muestra contorno y panel, `Esc` cierra, teclado completo.
- **SC-008**: en 390×844 y 1280×800 las capturas muestran los tres muebles, sin elementos solapados y con la ayuda cerrada o ≤ 40 % de la altura.
- **SC-009**: cobertura de los servicios (líneas) ≥ 70 %; cada bug C1–C15 tiene al menos un test que falla sin el arreglo (cuando es testeable sin GPU).
- **SC-010**: README contiene capturas/GIF, versiones correctas (coinciden con `package.json`) y todos los archivos citados existen.

## Supuestos

- Se mantienen los tres modelos y la sala actual (D-06 confirma si se cambian). La licencia de los modelos (Sketchfab) se revisa y se cita en el README.
- Se despliega en el mismo destino que la demo actual (D-10); la ruta base no cambia.
- Navegadores objetivo: últimas 2 versiones de Chrome, Firefox, Safari y Edge; WebGL 2.
- Node ≥ 22.12 (exigencia de las versiones actuales de Angular).
