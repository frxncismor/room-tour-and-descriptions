# Tareas: Decoración sobria y UI con identidad propia

**Entrada**: [spec.md](./spec.md), [plan.md](./plan.md) · **Fecha**: 2026-11-23 · **Asume todas las recomendaciones de plan §7** (D-220…D-232).
**Formato**: `- [ ] T-2xx [P] [USn] Descripción — archivos`. `[P]` = paralelizable con otras tareas **de la misma fase** (archivos distintos).
**Reglas**: cada pista trabaja en **su propio worktree** (`Orq-Worktree.ps1 -Accion nuevo -Agente <pista>`) y toca **solo** los archivos de su columna; **un único dueño por archivo**; **máximo 3 agentes en paralelo**; integra su orquestador (`integrar`) cuando cumple los criterios de la fase. Entre integraciones: `npm run lint:check && npm run build && npm test` en verde (constitución I). Ningún agente hace commit/push/PR por su cuenta.
**Nada de `npm install`/dependencias nuevas**: las herramientas externas (gltf-transform, Lighthouse, http-server) van por `npx -y`.

## Pistas y dueños

| Pista | Nombre de agente | Archivos que posee (exclusivos) |
|---|---|---|
| **A** Assets | `assets` | `scripts/optimize-models.mjs`, `src/assets/models/{landscape_painting,wall_clock,succulent,ceramic_vase}/**`, `src/assets/textures/**`, `docs/assets-pipeline.md` |
| **E** Escena | `escena` | `src/app/config/scene.config.ts`, `src/app/interfaces/scene.interface.ts`, `src/app/services/{room-builder,scene,model-loader}.service.ts` y sus specs, `src/app/services/camera.service.spec.ts`; `camera.service.ts` solo en T-237 |
| **U** UI global | `ui-global` | `src/styles.scss`, `src/index.html`, `src/assets/fonts/**`, `src/assets/brand/{favicon.svg,apple-touch-icon.png}`, `src/favicon.ico`, `src/app/config/ui-text.ts`, `src/app/config/ui-text.spec.ts` |
| **CA** Componentes A | `ui-comp-a` | `components/{loading-screen,brand-label,error-banner,error-overlay,help-panel}/**` (ts + spec), `components/viewer/viewer.component.scss` |
| **CB** Componentes B | `ui-comp-b` | `components/{object-list,description-panel}/**` (ts + spec) |
| **S** Specs/partición | `specs-split` | `src/app/components/components.spec.ts` (se divide y desaparece), los `*.spec.ts` nuevos de `components/*` **hasta que CA/CB los tomen** |
| **D** Docs | `docs` | `README.md`, `docs/media/**`, `docs/baseline/**`, `src/assets/brand/og.png` |
| **V** Verificación | `verif` | `specs/002-decoracion-y-ui/baseline.md`, `specs/002-decoracion-y-ui/verification.md`, capturas en `docs/baseline/002-*` |

## Mapa de fases

```
F0 ┬ T-201 (U) textos nuevos aditivos ─┐
   ├ T-202 (S) partir components.spec ─┼─► F0b T-200 (V) línea base ─► F1 ┬ A  T-210…214 ─┐
   └ T-230 (E) getRenderStats ─────────┘                                 ├ E  T-231…237 ─┼─► F2 ┬ CA T-240…245
                                                                          └ U  T-220…224,T-260   │  ├ CB T-246…249
                                                                                                  │  └ E  T-250 (colocación con capturas)
                                                                                                  └─► F3 ┬ U  T-270 (limpieza) ─► F4 V T-295
                                                                                                         └ D  T-290
```

| Fase | Depende de | Agentes en paralelo | Resumen |
|---|---|---|---|
| F0 | — | 3 (U, S, E) | textos aditivos, partición de specs, API de estadísticas |
| F0b | F0 | 1 (V) | línea base de capturas y rendimiento **antes** de cualquier cambio visual |
| F1 | F0b | 3 (A, E, U) | assets, escena (código), tokens/fuentes/marca/textos |
| F2 | F1 | 3 (CA, CB, E) | componentes de UI y colocación fina con assets reales |
| F3 | F2 | 2 (U, D) | limpieza de tokens heredados, README, capturas, `og.png` |
| F4 | F3 | 1 (V) | verificación final (Lighthouse, rendimiento, contraste) |

---

## Fase F0 — Preparación (paralela ×3)

**Archivos**: ver pistas U, S, E. **Criterio de fase**: `npm run lint:check && npm run build && npm test` en verde; ningún cambio visual.

- [ ] T-201 [P] [US21] U: añadir `FURNITURE_TEXT.landscapePainting` y `.succulent` (textos de spec A.2, con `details` de crédito CC0) y `canvasLabel` genérico (FR-207). **Solo aditivo**: no se reescribe ningún texto existente — `src/app/config/ui-text.ts`.
  *Aceptación*: `npm test -- --include "**/ui-text.spec.ts"` en verde; `git diff --stat` solo toca `ui-text.ts`.
- [ ] T-202 [P] [US22] S: partir `components.spec.ts` en un spec por componente **sin cambiar lo que se comprueba**, salvo sustituir literales de copy por referencias (`FURNITURE_TEXT.*.name`, `UI_TEXT.help.title`, `UI_TEXT.brand.*`) para que el copy se pueda reescribir sin romper tests; cambiar el test CSS-por-regex (`:125-138`) por la versión tolerante de plan R1 — `src/app/components/components.spec.ts` → `{loading-screen,brand-label,error-banner,description-panel,object-list,help-panel}/*.spec.ts`.
  *Aceptación*: el número de casos del total de Vitest no baja (`npm test` antes/después, mismo recuento); `grep -rn "How to explore\|Poker Table\|Modern Sofa" src/app/components` → 0 literales de copy en specs; `npm test` verde.
- [ ] T-230 [P] [US21] E: `SceneService.getRenderStats(): {calls, triangles, textures, geometries}` (lee `renderer.info`) + test con renderer simulado; en `isDevMode()` expone `window.__rtad = { stats: () => … }` — `scene.service.ts`, `scene.service.spec.ts`.
  *Aceptación*: test nuevo verde; en producción `window.__rtad` es `undefined`.

## Fase F0b — Línea base (serial)

- [ ] T-200 [US21] V: con el repo tal cual tras F0, `npm start` y: (1) capturas 1280×800 y 390×844 de carga, vista inicial, ayuda, ficha del sofá (`docs/baseline/002-*.png`); (2) `window.__rtad.stats()` en la vista inicial → draw calls, triángulos, texturas; (3) frame time mediana de 300 frames en escritorio y móvil emulado (CPU ×4); (4) `du -sb src/assets`; (5) Lighthouse accesibilidad y rendimiento (móvil y escritorio) sobre `npm run build` servida con `npx -y http-server dist/interior-viewer/browser -p 4173`; (6) transferencia inicial JS. Todo a `specs/002-decoracion-y-ui/baseline.md` — `baseline.md`, `docs/baseline/002-*`.
  *Aceptación*: `baseline.md` con cada cifra, fecha, equipo y comando. **Sin él no empieza F1** (constitución II). Nota: para WebGL en Edge/Chrome headless, `--use-angle=swiftshader --enable-unsafe-swiftshader`; el ancho mínimo de ventana headless es ≈ 500 px: para 390×844 usar emulación de dispositivo (CDP) o recortar.

---

## Fase F1 — Assets, escena y UI global (paralela ×3: A, E, U)

### Pista A — Assets (`assets`) · Archivos: ver tabla. Depende de: F0b.

- [ ] T-210 [US21] A: obtener los glTF 1K de `fancy_picture_frame_01`, `wall_clock`, `potted_plant_04`, `ceramic_vase_02` y las texturas 1K (`laminate_floor_02`: Diffuse, nor_gl, arm; `poly_wool_herringbone`: Diffuse, nor_gl) de Poly Haven usando las URLs de `https://api.polyhaven.com/files/<id>` **a una carpeta temporal fuera del repo**; comprobar que cada tamaño coincide con spec A.5 (±5 %).
  *Aceptación*: tabla de tamaños de origen en el informe de la tarea; ningún original dentro del repo.
- [ ] T-211 [US21] A: `scripts/optimize-models.mjs`: añadir `--quality 85` al paso `webp` (constante `WEBP_QUALITY`) y una política de resolución por modelo (`landscape_painting`: `canvas_diff` 1024, resto 512; `wall_clock`, `succulent`, `ceramic_vase`: 512; los tres muebles existentes **sin cambios** de resolución ni de resultado) — `scripts/optimize-models.mjs`.
  *Aceptación*: `node scripts/optimize-models.mjs <carpeta de prueba>` con los 4 modelos nuevos termina sin error; ejecutarlo sobre los 3 muebles actuales no cambia sus bytes (`git status` limpio en `src/assets/models/{sofa,poker_table,bookshelf}`) o, si cambia por la calidad, se documenta y se descarta el cambio (los tres ya optimizados se omiten).
- [ ] T-212 [US21] A: generar `src/assets/models/{landscape_painting,wall_clock,succulent,ceramic_vase}/scene.gltf` (+`.bin`+`textures/*.webp`) y convertir a WebP q85 las texturas del suelo (`src/assets/textures/floor/{diff,nor,arm}.webp`, 1024) y la alfombra (`rug/{diff,nor}.webp`, 512) — `src/assets/models/**`, `src/assets/textures/**`.
  *Aceptación*: `npx -y @gltf-transform/cli@4.5.1 inspect src/assets/models/wall_clock/scene.gltf` lista `EXT_meshopt_compression` y `EXT_texture_webp`; sin PNG/JPG en `src/assets`.
- [ ] T-213 [US21] A: medir y reescribir la tabla de pesos de la spec (columnas «medido») y `docs/assets-pipeline.md` (fuentes, URLs, calidad 85, resoluciones) — `docs/assets-pipeline.md`; informe a E/V.
  *Aceptación*: `du -sb src/assets` ≤ 5 242 880 B (objetivo ≤ 4 194 304); cada pieza ≤ valor de la spec + 25 %; ninguna textura > 1024 px (`npx gltf-transform inspect` o `magick identify`); sin pérdida visible de las normales (si la hay, subir a q90 solo `nor`).
- [ ] T-214 [US21] A: comprobar con `npx gltf-transform inspect` el nº de triángulos y materiales de cada pieza (para SC-202) y las dimensiones reales (caja) para que E fije `position/yOffset` — informe.
  *Aceptación*: triángulos ≈ spec (938 / 3 658 / 6 097 / 2 756); dimensiones en metros anotadas.

### Pista E — Escena (`escena`) · Depende de: F0b, T-201 (textos) y de los **nombres de ruta** (plan §4), no de los bytes.

- [ ] T-231 [US21] E: `DecorConfiguration` (en `scene.interface.ts`) y `DECOR_CONFIGURATIONS` `{ clock, vase }`, y `MODEL_CONFIGURATIONS += { landscapePainting, succulent }` con los valores de spec A.1; `FLOOR_TEXTURES`, `RUG_TEXTURES`, `TRIM` (alto 0,12, fondo 0,02, color `0xf3ece1`) y `scene.background = 0xece2d1` — `scene.config.ts`, `scene.interface.ts`, `room-builder.service.ts` (solo el fondo).
  *Aceptación*: `npm run build` verde; test de config: las claves de `DECOR_CONFIGURATIONS` no están en `MODEL_CONFIGURATIONS` y viceversa; `ui-text.spec` verde.
- [ ] T-232 [US21] E: `SceneService.loadDecor()`: carga cada `DECOR_CONFIGURATIONS` con `ModelLoaderService.loadModel`, la mete en `Group` `decor` y anula `raycast` en todas sus mallas (helper `disableRaycast` exportado desde `model-loader.service.ts`); sin `addObject`/`models.set`; progreso con claves `decor:<id>`; `dispose` y reintento incluidos; fallo → aviso no bloqueante existente — `scene.service.ts`, `model-loader.service.ts`, specs.
  *Aceptación*: tests: `getObjectList()` no contiene `clock`/`vase`; `ObjectInteractionService` ignora el reloj (raycast sin impactos); progreso monótono hasta 100 con decor; `dispose` libera geometrías/materiales/texturas; `retryLoad` reintenta una decoración fallida.
- [ ] T-233 [US21] E: `RoomBuilderService`: `Group` `room-trim` con zócalo fusionado (una malla, 4 tramos) y alfombra (plano 4,2 × 3,0, y = 0,004, rot Y π/4, `polygonOffset`, `raycast` anulado); `loadTextures(manager)` asíncrono aplica `map/normalMap/roughnessMap` al suelo (repetición 16/1,7, anisotropía ≤ 8, sRGB solo en difuso) y `map/normalMap` a la alfombra (tinte `0xf0e6d8`, repetición 4,2/0,27 × 3,0/0,27); `dispose` libera texturas — `room-builder.service.ts` + spec.
  *Aceptación*: `meshes()` sigue en 6 (zócalo y alfombra en `Group`); tests nuevos: zócalo = 1 malla, alfombra con `raycast` anulado, `dispose` deja `scene.children` = 0 y libera 5 texturas; fallo de textura conserva color plano y notifica.
- [ ] T-234 [US21] E: `SceneService.loadAll()` espera a `loadDecor()` y `loadTextures()`; `publishProgress` pondera todas las claves (modelos + `decor:*` + `tex:*`) y no oculta la pantalla de carga hasta terminar — `scene.service.ts` + spec.
  *Aceptación*: test: con textura lenta el estado no pasa a `ready`; progreso monótono; el recuento de `loadStatus` es correcto con un fallo de textura.
- [ ] T-235 [US21] E: actualizar specs: conteos de `getObjectList()` a 4/5/5/4 (`scene.service.spec.ts:254,261,271,515`), mensaje de error con `FURNITURE_TEXT.pokerTable.name` (`:253`), y `camera.service.spec.ts` (`sizes` con `landscapePainting` y `succulent`, medidas de T-214) — `scene.service.spec.ts`, `camera.service.spec.ts`.
  *Aceptación*: `npm test` verde; `grep -n "Poker Table" src/app/services/*.spec.ts` → 0.
- [ ] T-236 [US21] E: test de colocación (SC-203) con `Box3`: ninguna pieza interseca a otra ni a los muebles; bases a y = 0 ± 0,02; cuadro/reloj a 0,02–0,06 m del muro; alfombra y ≤ 0,01 y fuera de la AABB de la mesa — `scene.service.spec.ts` (o `scene.config.spec.ts` nuevo, mismo dueño).
  *Aceptación*: el test falla si se mueve cualquier pieza 0,5 m hacia un mueble (probado a mano una vez).
- [ ] T-237 [US21] E: `selectObject('landscapePainting')` y `('succulent')` abren ficha y encuadran sin oclusión; revisar `focusOn` para piezas planas en muro (R12) — `camera.service.ts` **solo si hace falta** (se coordina con el orquestador: es el único archivo fuera de la lista de E que podría tocarse) y spec.
  *Aceptación*: test de `focusOn` con una caja de 1,21 × 0,93 × 0,04 en z = -7,975: la cámara queda a z > -7 y mira a +Z (ángulo ≤ 30° respecto de la normal).

### Pista U — UI global (`ui-global`) · Depende de: F0b, T-201.

- [ ] T-220 [US22] U: `styles.scss`: tokens de spec B.2, `@font-face` (Fraunces y Hanken Grotesk, `font-display: swap`, `font-optical-sizing: auto`, fallbacks con `size-adjust`), estilos base y `:focus-visible` global; **mantener alias de los tokens antiguos** (`--color-text`, `--color-surface`, `--color-accent*`, `--radius-*`, `--shadow-*`, `--font-sans`) apuntando a los nuevos hasta T-270 — `src/styles.scss`.
  *Aceptación*: `npm run build` verde; sin cambios de layout (capturas ≈ línea base salvo tipografía/color); `anyComponentStyle` sin avisos nuevos.
- [ ] T-221 [US22] U: copiar los woff2 a `src/assets/fonts/` (`fraunces-var-latin.woff2` 67 304 B, `hanken-grotesk-var-latin.woff2` 34 704 B; origen: `mockups/fonts/`) + `OFL.txt` con la licencia y autoría — `src/assets/fonts/**`.
  *Aceptación*: `stat -c %s` de ambos = 67 304 y 34 704; `OFL.txt` presente.
- [ ] T-222 [US22] U: `index.html`: `theme-color` `#35544f`, `<link rel="preload" as="font" type="font/woff2" crossorigin>` de las dos fuentes, favicons nuevos — `src/index.html`.
  *Aceptación*: Lighthouse no avisa de recursos bloqueantes; las 2 fuentes se piden en paralelo con el JS (pestaña Network).
- [ ] T-223 [US22] U: `favicon.svg` (spec B.6), regenerar `favicon.ico` (16/32/48) y `apple-touch-icon.png` (180) con ImageMagick desde el SVG — `src/assets/brand/{favicon.svg,apple-touch-icon.png}`, `src/favicon.ico`.
  *Aceptación*: `magick identify src/favicon.ico` lista 3 tamaños; el SVG pesa < 1 KB; no queda ningún `#38bdf8`/`#0ea5e9`/`#1f2937` en `src/assets/brand` ni en `index.html`.
- [ ] T-224 [US23] U: en `ui-text.spec.ts`, la lista negra de FR-241 y los límites de SC-214 (≤ 2 frases, ≤ 30 palabras) aplicados a `FURNITURE_TEXT` (el contraste de B.7 no es un test unitario: lo calcula el script de T-295) — `ui-text.spec.ts`.
  *Aceptación*: el test falla si se añade «generous» a cualquier texto (comprobado a mano).
- [ ] T-260 [US23] U: reescribir `FURNITURE_TEXT` (sofá, mesa, estantería) y `UI_TEXT` según spec B.5 — `ui-text.ts`. **Depende de T-202** (specs sin literales de copy).
  *Aceptación*: `npm test` verde sin editar ningún otro archivo; SC-214 cumplido; `ui-text.spec` verde.

**Criterios de fase F1**: `lint:check` + `build` + `test` verdes; `du -sb src/assets` ≤ 5 MiB; en navegador, la sala muestra suelo de madera, zócalo, alfombra y las 4 piezas (captura 1280×800 provisional); ninguna regresión de FPS > 10 % frente a `baseline.md`.

---

## Fase F2 — Componentes y colocación (paralela ×3: CA, CB, E)

Todos usan **solo** tokens (`var(--…)`); conservan los nombres de clase (D-225); cada uno actualiza **sus** specs en el mismo cambio. Referencia visual: `mockups/` (PNG y HTML). Depende de: F1 integrada.

### Pista CA — `ui-comp-a`

- [ ] T-240 [P] [US22] CA: `loading-screen`: fondo plano `--paper`, título Fraunces `--fs-display`, byline en mayúsculas espaciadas, barra de 2 px (`--clay` sobre `--rule`), «Loading the room · NN %» con `tabular-nums`; `.loading`/`.done`, `role="progressbar"` y `aria-value*` intactos; transiciones con `--dur-3` y `prefers-reduced-motion` — `components/loading-screen/**`.
  *Aceptación*: spec del componente verde; `rg "gradient|999px" components/loading-screen` → 0; captura = `mockups/desktop-loading.png` (±2 px de posición).
- [ ] T-241 [P] [US22] CA: `brand-label`: placa de papel con filete, Fraunces 18 px + byline en mayúsculas 12 px; **sin** `button`/`a` (test) — `components/brand-label/**`.
- [ ] T-242 [P] [US22] CA: `error-banner` (`--danger` + `--paper`, botón «Retry» rectangular con foco visible) y `error-overlay` (tarjeta de papel, título Fraunces) — `components/error-banner/**`, `components/error-overlay/**`.
  *Aceptación*: roles `alert` y textos inyectados intactos; contraste 8,45 (B.7).
- [ ] T-243 [P] [US22] CA: `viewer.component.scss`: foco del canvas con `--focus`, fondo `--paper-sunk`, radio por token — `components/viewer/viewer.component.scss`.
- [ ] T-244 [US22] CA: `help-panel`: lista de definiciones (`dl`), **sin iconos** (eliminar los 6 `svg` y el `switch` de iconos), «Controls»/«Close», `.reopen` rectangular con borde `--rule-strong`, fusión de los `.sheet`/`ul` duplicados del `@media`, `data-keyboard` en vez de `li:last-child` para ocultar la tecla en táctil, y `prefers-reduced-motion` aplicado — `components/help-panel/**`.
  *Aceptación*: `.sheet`, `.primary`, `.reopen`, `aria-modal="false"`, retorno de foco a `.reopen` y «one finger»/«Pinch»/«left mouse button» siguen verdes; hoja móvil ≤ 40 % de la altura (US5 de 001); captura = `mockups/*-help.png`.
- [ ] T-245 [US22] CA: `ui-comp-a` revisa que `rg "#[0-9a-fA-F]{3,8}\b|rgb\(|backdrop-filter|999px" src/app/components/{loading-screen,brand-label,error-banner,error-overlay,help-panel,viewer}` → 0.

### Pista CB — `ui-comp-b`

- [ ] T-246 [US22] CB: `object-list`: índice de texto (sin píldoras), cabecera «Pieces» en mayúsculas 12 px, fila activa con regla `--clay` y `--paper-sunk`, «Reset view» con glifo propio (`svg` con trazo 1,5, terminales rectos, `aria-hidden`) separado por filete; móvil: tira horizontal con subrayado, reset solo icono con `aria-label`; ≤ 380 px compacto; `pointer: coarse` → `--hit` — `components/object-list/**`.
  *Aceptación*: `.chip`, `.chip.reset` con `svg`, `aria-pressed`, `nav` con `aria-label`; captura = `mockups/*-overview.png`.
- [ ] T-247 [US22] CB: `description-panel`: `.panel` opaco con filete y `--shadow-panel`, `h2` Fraunces `--fs-title`, descripción, crédito bajo filete, X con terminales rectos y `--hit`; móvil: hoja inferior ≤ 34 dvh con scroll interno; región `aria-live` **fuera** del `@if`; animación `panel-in` con `--dur-2` y bloque `prefers-reduced-motion` — `components/description-panel/**`.
  *Aceptación*: spec de movimiento (versión tolerante de T-202) verde; `aria-live` estable entre renders; captura = `mockups/*-detail.png`.
- [ ] T-248 [US22] CB: comprobar `rg "#[0-9a-fA-F]{3,8}\b|rgb\(|backdrop-filter|999px" src/app/components/{object-list,description-panel}` → 0.
- [ ] T-249 [US22] CB: con la lista de 5 piezas, la tira móvil de 390 px no recorta el nombre más largo («Landscape painting») en vista de escritorio ni oculta la pieza activa (`scrollIntoView` del activo en móvil) — `components/object-list/**`.

### Pista E (F2) — `escena`

- [ ] T-250 [US21] E: colocación fina con los assets reales: abrir `npm start`, comprobar orientación (+Z), escala y alturas de A.1; ajustar `position/yOffset/rotation/scale` y la rotación/centro de la alfombra respecto del sofá real; comprobar contorno y encuadre de cuadro y suculenta (R11, R12); capturas 1280×800 y 390×844 de: vista inicial, muro del fondo, cuadro seleccionado, suculenta seleccionada, alfombra — `scene.config.ts` (y spec de colocación de T-236).
  *Aceptación*: SC-203 verde; en las capturas ninguna pieza se solapa con la ficha ni con la lista; tabla final de coordenadas pegada en el informe y en `spec.md` A.1 si cambió algo.

**Criterios de fase F2**: `lint:check` + `build` + `test` verdes; SC-210 (greps) en 0 para los componentes migrados; SC-213 parcial (capturas de las 4 pantallas coinciden con los mockups).

---

## Fase F3 — Cierre (paralela ×2: U, D)

- [ ] T-270 [US22] U: eliminar los alias de tokens antiguos de `styles.scss` y `--color-overlay`; el `rg` global de SC-210 debe dar 0 — `styles.scss`.
  *Aceptación*: `rg "backdrop-filter|999px|linear-gradient|radial-gradient" src` → 0; `rg "#[0-9a-fA-F]{3,8}\b|rgb\(" src/app/components` → 0; `rg "var\(--color-(text|surface|accent)" src` → 0; build y tests verdes.
- [ ] T-290 [P] [US21] D: README: créditos nuevos (tabla Poly Haven con autor y enlace; Fraunces y Hanken Grotesk con licencia OFL), «CC0 no exige atribución», sección de cómo se optimizan los assets (enlace a `docs/assets-pipeline.md`), pesos actualizados, regenerar `docs/media/*` (las capturas actuales muestran la UI antigua) y `src/assets/brand/og.png` con una captura real 1200×630 — `README.md`, `docs/media/**`, `src/assets/brand/og.png`.
  *Aceptación*: `rg "Sketchfab" README.md` sigue acreditando a los tres autores originales; las 3 capturas del README corresponden a la UI nueva; `og.png` ≤ 200 kB.

---

## Fase F4 — Verificación (serial, `verif`)

- [ ] T-295 [US21] V: ejecutar y registrar en `verification.md`, frente a `baseline.md`: (1) `npm run lint:check && npm run build && npm test` (sin avisos de presupuesto nuevos); (2) `du -sb src/assets` y tabla por pieza (SC-200); (3) `window.__rtad.stats()` → calls ≤ base + 14 y tris ≤ base + 16 000 (SC-202); (4) frame time mediana ≤ base × 1,10 en escritorio y móvil emulado (SC-204); (5) transferencia inicial y CLS (SC-206, SC-212); (6) **Lighthouse accesibilidad = 100** móvil y escritorio, y rendimiento sin caída > 3 puntos (SC-211); (7) script de contraste que reproduce la tabla B.7 (SC-211); (8) capturas 1280×800 y 390×844 de carga, inicial, ayuda, ficha sofá, ficha cuadro, muro del fondo (SC-213); (9) los `rg` de SC-210; (10) `prefers-reduced-motion` emulado: ninguna animación visible (SC-215); (11) prueba manual: clic en alfombra (desplaza), reloj/jarrón (no seleccionan), cuadro/suculenta (ficha), `Esc`, `Home`, teclado/Tab por la lista de 5.
  *Aceptación*: cada SC-2xx con ✓/✗, comando y salida. Cualquier ✗ se devuelve a la pista dueña antes de proponer el PR (que abre solo el orquestador principal con permiso de Paco).
