# Tareas: Room tour pulido profesional

**Entrada**: [spec.md](./spec.md), [plan.md](./plan.md) · **Fecha**: 2026-11-22
**Formato**: `- [ ] T-xxx [P] [USn] Descripción con ruta`. `[P]` = paralelizable con otras tareas **de la misma fase** (archivos distintos).
**Regla de oro**: cada fase se ejecuta en **su propio worktree** (`Orq-Worktree.ps1 -Accion nuevo -Agente <fase>`), toca **solo** los archivos de su columna «Archivos que toca», y se integra con `integrar` cuando cumple su criterio de aceptación. Entre integraciones, `npm run lint:check && npm run build && npm test` en verde (constitución I).
**Decisiones**: las tareas marcadas **[DECIDE PACO]** dependen de una decisión del plan §8 (se asume la recomendación hasta que Paco diga otra cosa).

## Mapa de fases y dependencias

```
F0 Verde ──► F1a Angular ─► F1b Tooling ──► F4a Interacción ─┐
        │                         │                           ├─► F5 three ─► F6 Escena ─┐
        │                         ├────────► F4b Núcleo ──────┤                          ├─► F9 Docs/media ─► F10 Verificación
        ├──► F2 Assets [P con F1] ┘              │            │                          │
        ├──► F3 Marca  [P con F1]                └────────────► F7 UI/UX (tras F4b) ──────┘
        └──► F8 CI (tras F1b) [P con F4–F7]
```

| Fase | Depende de | Paralela con | Resumen |
|---|---|---|---|
| F0 Verde mínimo | — | nadie (primera, serial) | C1, EOL, spec, contratos, capturas base |
| F1a Angular 17→21(/22) | F0 | F2, F3 | `ng update` por saltos |
| F1b Tooling | F1a | F2, F3 | eslint flat, tests, limpieza, zoneless |
| F2 Assets | F0 | F1a, F1b, F3 | gltf-transform, WebP+meshopt (C16) |
| F3 Marca/estáticos | F0 | F1a, F1b, F2 | index.html, favicon, styles globales |
| F4a Interacción | F1b, F2 | F4b | contorno, hover, clic (C3, C11) |
| F4b Núcleo 3D | F1b, F2 | F4a | bucle, cámara, carga, estado (C2, C4–C9, C12, C14) |
| F5 three 0.187 | F4a, F4b | F7, F8 | actualización de three |
| F6 Escena visual | F5, F2 | F7, F8 | luces, sombras, materiales, muros (C13, C17) |
| F7 UI/UX y a11y | F4b | F4a, F5, F6, F8 | componentes, móvil, a11y, textos |
| F8 CI | F1b | F4a–F7 | GitHub Actions (D-07) |
| F9 Docs y media | F6, F7 | F8 | README, capturas, OG |
| F10 Verificación | todas | — | checklist final, auditorías |

**Orden de integración recomendado**: F0 → F3 → F1a → F1b → F2 → F8 → (F4a, F4b) → F7 → F5 → F6 → F9 → F10. (F3 y F2 se integran en cuanto cierran, sin esperar a F1; si F2 choca con una migración de F1 en `model-loader.service.ts`, resuelve el orquestador: son 2 líneas.)

**Verificación de solapes** (mismo archivo en dos fases paralelas = prohibido; resumen):

| Archivo / zona | Dueño único | Notas |
|---|---|---|
| `package.json`, `package-lock.json`, `angular.json`, `tsconfig*.json`, eslint/vitest config, `.husky/` | F0 → F1a → F1b → (F5 solo `three`) | F5 solo toca las líneas de `three`; va después de F1b y sin otra fase editando `package.json` en paralelo |
| `src/assets/models/**`, `scripts/optimize-models.mjs`, `assets-src/` | F2 | Ninguna otra fase toca `models/` |
| `src/index.html`, `src/styles.scss`, `src/styles.css`, `src/favicon.ico`, `src/assets/brand/**` | F3 (og.png final: F9) | F9 solo sustituye `og.png` cuando F3 ya está integrada |
| `services/object-interaction.service.ts` (+spec) | F4a | |
| `services/scene.service.ts`, `camera.service.ts`, `model-loader.service.ts`, `viewer-state.service.ts`, `interfaces/scene.interface.ts` (+specs) | F4b | tras F0, nadie más edita estos archivos; F6 vuelve a tocar `model-loader` solo para overrides de material (serial, después de F5) |
| `components/**`, `app.component.*`, `config/ui-text.ts` | F7 | |
| `services/room-builder.service.ts`, `config/scene.config.ts` | F6 | F4b no toca `scene.config.ts` (usa `MODEL_CONFIGURATIONS` tal cual); F0 solo le quita `UI_TEXT` |
| `.github/**` | F8 | |
| `README.md`, `CONTRIBUTING.md` (revisión final), `docs/**` | F9 (F0 toca `CONTRIBUTING.md` antes) | |

---

## Fase F0 — Verde mínimo y contratos (SERIAL, bloqueante)

**Meta**: el repo compila, lint:check pasa, hay baseline visual y contratos para paralelizar. **Historias**: US1.
**Archivos que toca**: `.gitattributes` (nuevo), **todos los archivos de texto por renormalización EOL (en un commit propio y primero)**, `package.json`+`package-lock.json` (quitar material/forms, `prepare`), `src/app/services/scene.service.ts` (import), `src/app/components/viewer/viewer.component.ts` (import de `UI_TEXT`), `src/app/services/object-interaction.service.ts` (tipos), `src/app/config/scene.config.ts` (quitar `UI_TEXT`), `src/app/config/ui-text.ts` (nuevo), `src/app/interfaces/scene.interface.ts` (campos opcionales), `src/app/services/viewer-state.service.ts` (nuevo, solo señales), `src/app/app.component.spec.ts`, `CONTRIBUTING.md`, `scripts/lint-check.js` (si hace falta), `docs/baseline/*.png` (copia de capturas).
**Dependencias**: ninguna. **Nada en paralelo** hasta integrarla (la renormalización toca todo).

- [ ] T-001 [US1] `.gitattributes`: `* text=auto eol=lf`; `*.png *.jpg *.ico *.bin *.glb binary`; `git add --renormalize .` en commit propio `chore: normalize line endings to LF`.
- [ ] T-002 [US1] Revisar `.prettierrc`/`.editorconfig`/`scripts/lint-check.js`: `endOfLine: "lf"`, coherencia 2 espacios; que `lint:check` pase en limpio.
- [ ] T-003 [US1] C1: importar `Object3D` en `src/app/services/scene.service.ts`; `getCamera(): PerspectiveCamera`.
- [ ] T-004 [US1] C1: crear `src/app/config/ui-text.ts` con `UI_TEXT` (mover desde `scene.config.ts`, borrar de allí); corregir import en `viewer.component.ts`.
- [ ] T-005 [US1] C1: tipar `camera: PerspectiveCamera, scene: Scene` en `ObjectInteractionService.handleClick` (sin cambiar lógica).
- [ ] T-006 [US1] `scene.interface.ts`: `InteractionResult` gana `floorPoint?: Vector3` y `object?: Object3D` (contrato aditivo para F4a/F4b).
- [ ] T-007 [US1] `viewer-state.service.ts` (esqueleto): señales `loadProgress` (0–100), `loadStatus` ('idle'|'loading'|'ready'|'error'), `error` (`{code,message,retry?}`|null), `selected` (`ObjectInfo|null`), `hovered` (`string|null`), `sceneReady`. Sin lógica. Contrato para F4b (escribe) y F7 (lee).
- [ ] T-008 [US1] `npm uninstall @angular/material @angular/forms`; `prepare: "husky"`; comprobar `husky` funciona.
- [ ] T-009 [US1] Reescribir `app.component.spec.ts` (crea el componente, contiene `app-viewer`); `ng test` en verde.
- [ ] T-010 [US1] `CONTRIBUTING.md`: 2 espacios, no tabs; comandos reales; commits convencionales.
- [ ] T-011 [US1] Copiar capturas de referencia a `docs/baseline/` (`rtad-desktop-1280x800.png`, `rtad-mobile-390x844.png`) desde `runs/11221609/capturas/`.

**Criterios de aceptación F0** (verificables):
1. `npm ci && npm run lint:check && npm run build && npm test` → exit 0 (con `core.autocrlf=true` en Windows).
2. `git ls-files --eol | grep -c "w/crlf"` → 0 en archivos de texto.
3. `git grep -n "UI_TEXT" src` solo aparece en `config/ui-text.ts` y `viewer.component.ts`.
4. `npm ls @angular/material @angular/forms` → vacío.

---

## Fase F1a — Angular 17 → 21 (o 22) por saltos (SERIAL, un solo agente)

**Historias**: US11. **Dependencias**: F0. **Paralela con**: F2, F3.
**Archivos que toca**: `package.json`, `package-lock.json`, `angular.json`, `tsconfig*.json`, `src/main.ts`, `src/app/app.config.ts`, `src/app/app.routes.ts` (borrar), `src/app/app.component.ts`, y **cualquier `.ts` bajo `src/app/**` que modifique una migración automática** (solo cambios mecánicos). **Prohibido** editar lógica.
**Aviso**: durante F1a no se crean worktrees de F4a/F4b/F7 (tocan los mismos `.ts`).

- [ ] T-101 [US11] Salto 17→18: `npx ng update @angular/core@18 @angular/cli@18`; `lint:check`, `build`, `test` en verde; commit `build(deps): update Angular to 18`.
- [ ] T-102 [US11] Salto 18→19 (commit propio). Aceptar migración `standalone` y la de `inject` si es mecánica.
- [ ] T-103 [US11] Salto 19→20 (commit propio). TypeScript/zone.js que pida el salto.
- [ ] T-104 [US11] Salto 20→21 (commit propio). **[DECIDE PACO D-02]** parar aquí (recomendado) o continuar con T-105.
- [ ] T-105 [US11] (opcional D-02) Salto 21→22; commit propio.
- [ ] T-106 [US11] Pasar al builder `@angular/build:application` si `ng update` no lo hizo; quitar `@angular-devkit/build-angular`; quitar de `angular.json` la copia de `three/examples/jsm` a assets (no se usa) y verificar que el visor sigue cargando.
- [ ] T-107 [US11] Quitar `@angular/router`, `@angular/animations`, `provideAnimations`, `app.config.ts`, `app.routes.ts`; `main.ts` mínimo. (Control flow `@if/@for`: migración automática si el schematic lo ofrece.)
- [ ] T-108 [US11] Tras cada salto, captura 1280×800 y comparación visual con `docs/baseline/`; anotar diferencias en el commit.

**Criterios de aceptación F1a**:
1. `npm ls @angular/core @angular/cli typescript zone.js` muestran versiones objetivo coherentes (sin `invalid`).
2. `npm run lint:check && npm run build && npm test` exit 0 en cada commit de salto (`git rebase --exec` o revisión de los commits).
3. `npm audit --omit=dev --audit-level=high` → 0.
4. `git diff F0..F1a --stat -- src/app/services src/app/components` solo muestra cambios mecánicos (`standalone`, `inject`, control flow).

## Fase F1b — Tooling moderno (SERIAL tras F1a)

**Historias**: US11, US1. **Archivos que toca**: `package.json`/lock, `eslint.config.js` (nuevo), `.eslintrc.json` (borrar), `.husky/*`, `lint-staged` en `package.json`, `scripts/lint-check.js`, `karma.conf.js`/`vitest` config, `tsconfig.spec.json`, `angular.json` (test), `src/main.ts` (zoneless), `*.spec.ts` existentes (migración de runner), `angular.json` polyfills (quitar zone.js si zoneless).

- [ ] T-111 [US11] `npx ng add angular-eslint` → `eslint.config.js` flat; eslint 9 + typescript-eslint 8; borrar `.eslintrc.json`; `lint`/`lint:check`/lint-staged adaptados. Reglas: `no-console` (excepto `warn`/`error` con contexto), `@typescript-eslint/no-explicit-any`, `@angular-eslint/template/accessibility` recomendado.
- [ ] T-112 [US11] **[DECIDE PACO D-03b]** Runner de tests: Vitest (oficial) o conservar Karma. Migrar los specs existentes.
- [ ] T-113 [US11] **[DECIDE PACO D-01]** Zoneless: `provideZonelessChangeDetection()`, quitar `zone.js` de polyfills/`package.json`; o dejar zone.js (y F4b/F7 usan `runOutsideAngular`).
- [ ] T-114 [US1] Presupuestos de `angular.json` ajustados a SC-004; `prettier` + hooks `husky` (`pre-commit` → `lint-staged`).

**Criterios de aceptación F1b**:
1. `npm run lint` (flat config) y `lint:check` exit 0; `ls .eslintrc.json` no existe.
2. `npm test` ejecuta con el runner elegido y pasa (≥ 1 spec).
3. Con zoneless: `grep -R "zone.js" package.json angular.json src` sin coincidencias y la app carga (smoke manual: `npm start` y ver la sala).
4. `git commit` de prueba dispara `lint-staged` (hook activo).

---

## Fase F2 — Optimización de assets (PARALELA con F1a/F1b/F3)

**Historias**: US7. **Dependencias**: F0. **Archivos que toca**: `src/assets/models/**`, `assets-src/**` (originales, fuera del build), `scripts/optimize-models.mjs`, `docs/assets-pipeline.md`, y en `src/app/services/model-loader.service.ts` **solo** el registro del decodificador (`GLTFLoader.setMeshoptDecoder(MeshoptDecoder)`, 2 líneas).
**Integración**: tras F1b (o antes si no hay conflicto). Hasta integrarla, F4a/F4b no arrancan.

- [ ] T-201 [US7] Mover los originales a `assets-src/models/**` (añadir a `.gitignore` solo si son > 60 MB; **[DECIDE PACO]** si se versionan los originales con Git LFS o se documentan los enlaces de Sketchfab).
- [ ] T-202 [US7] `scripts/optimize-models.mjs` (usa `npx @gltf-transform/cli`): `optimize` con texturas WebP (máx. 1024; madera de la mesa 2048), `meshopt`, `quantize`, `dedup`, `prune`, `weld`, `resample`. Idempotente y documentado.
- [ ] T-203 [US7] Ejecutar para sofá, mesa y estantería; sustituir `scene.gltf/scene.bin/textures` en `src/assets/models/**` (mismas rutas, para que `MODEL_CONFIGURATIONS` no cambie).
- [ ] T-204 [US7] C17 (parte de datos): para el sofá, conservar `baseColorFactor` pero eliminar normales/atributos innecesarios; la asignación de color final se hace en F6.
- [ ] T-205 [US7] Registrar el decodificador meshopt en `model-loader.service.ts` (import `three/examples/jsm/libs/meshopt_decoder.module.js` desde `three`; se bundlea, sin copiar assets).
- [ ] T-206 [US7] `docs/assets-pipeline.md`: cómo regenerar, tamaños antes/después y licencias de los modelos (revisar `asset.extras` de cada `scene.gltf`; cita en README en F9).

**Criterios de aceptación F2**:
1. `du -sb src/assets/models` ≤ 8 MB (objetivo 5 MB) y `find src/assets/models -name "*.png" -size +1M` vacío.
2. `npx @gltf-transform/cli inspect src/assets/models/sofa/scene.gltf` lista `EXT_meshopt_compression` y `EXT_texture_webp` donde corresponda.
3. `npm run build` verde y smoke manual: la sala carga los tres modelos sin errores de consola (comparación con `docs/baseline/`).

---

## Fase F3 — Marca y metadatos (PARALELA con F1a/F1b/F2)

**Historias**: US9. **Dependencias**: F0. **Archivos que toca**: `src/index.html`, `src/styles.scss`, `src/styles.css` (borrar), `src/favicon.ico`, `src/assets/brand/**` (nuevo: `favicon.svg`, `apple-touch-icon.png`, `og.png` provisional).

- [ ] T-301 [P] [US9] `index.html`: `lang` (D-08), `<title>` descriptivo, `meta description`, `theme-color`, Open Graph/Twitter, `<noscript>`, enlaces a favicon SVG/ICO/apple-touch. **No** tocar `angular.json` (los assets se sirven por el glob `src/assets` y `src/favicon.ico` ya existentes).
- [ ] T-302 [P] [US9] Favicon propio (SVG simple + ICO regenerado) y `apple-touch-icon.png` 180×180.
- [ ] T-303 [P] [US9] `og.png` 1200×630 provisional desde `docs/baseline/` (se regenera en F9).
- [ ] T-304 [P] [US9] `styles.scss`: reset, tokens CSS (paleta, radios, sombras), tipografía de sistema con stack, `html, body { height:100% }`, `100dvh`; quitar clases/modos inexistentes (pointer lock, fullscreen); borrar `styles.css`.

**Criterios de aceptación F3**:
1. `npm run build` verde; `dist/**/index.html` contiene `og:title`, `meta name="description"`, `theme-color`.
2. `grep -c "pointer-lock\|fullscreen" src/styles.scss` → 0; `ls src/styles.css` no existe.
3. Pestaña del navegador muestra el título y favicon nuevos (comprobación manual).

---

## Fase F4a — Interacción: selección, contorno, hover (PARALELA con F4b)

**Historias**: US3. **Dependencias**: F1b, F2. **Archivos que toca**: `src/app/services/object-interaction.service.ts` y `object-interaction.service.spec.ts`. **Nada más.**
**Contrato**: mantener `handleClick(event, camera, scene): Promise<InteractionResult>`; devolver `floorPoint` (validado y recortado) en clics de suelo; `object` en clics de mueble; añadir `update(timeMs)` y `setHover(ndc|null)`; cero `requestAnimationFrame` propios.

- [ ] T-401 [US3] C3/C11: contorno como hijo del objeto (mallas clonadas `BackSide`, material propio por selección, `dispose` al deseleccionar); pulso de opacidad en `update(time)`.
- [ ] T-402 [US3] C2 (lado interacción): `handleFloorClick` devuelve `floorPoint`; mantener la validación de límites; test de bordes.
- [ ] T-403 [US3] `getMousePosition` con el rectángulo del canvas (no `event.target`); aceptar `PointerEvent`/coordenadas.
- [ ] T-404 [US3] `setHover(ndc)`: resalte emisivo restaurable y `hovered` (id) para el cursor; throttle por frame.
- [ ] T-405 [US3] Eliminar bucles rAF, código muerto y `Material` compartido; `dispose` libera todo.
- [ ] T-406 [US3] `object-interaction.service.spec.ts`: raycast suelo vs mueble; un solo contorno; tras 10 clics hay 0 rAF pendientes (spy) y 1 contorno en la escena; `dispose` limpia.

**Criterios de aceptación F4a**:
1. `npm test -- --include **/object-interaction.service.spec.ts` verde (≥ 6 tests); sin GPU.
2. `npm run lint:check && npm run build` verde.
3. `git grep -n "requestAnimationFrame" src/app/services/object-interaction.service.ts` → 0.
4. Revisión: `git diff --stat` solo muestra los dos archivos de la fase.

## Fase F4b — Núcleo 3D: bucle, cámara, carga, estado (PARALELA con F4a)

**Historias**: US2, US4, US7. **Dependencias**: F1b, F2 (decodificador ya registrado). **Archivos que toca**: `scene.service.ts`, `camera.service.ts`, `model-loader.service.ts`, `viewer-state.service.ts`, `interfaces/scene.interface.ts` (+ sus `.spec.ts`). **No toca** `object-interaction.service.ts`, `scene.config.ts`, `room-builder.service.ts`, componentes.
**Contrato de salida para F7**: `SceneService` expone `initialize(canvas)`, `loadAll(): Promise<void>` (progreso/errores en `ViewerStateService`), `retryLoad(id?)`, `resetView()`, `selectObject(id)`, `clearSelection()`, `getObjectList(): {id,name}[]`, `handlePointerSelect(point)`, `handlePointerMove(point|null)`, `dispose()`; el canvas recibe `data-ready="true"` cuando `sceneReady`.

- [ ] T-411 [US7] C5: `setAnimationLoop`/rAF con id cancelable, pausa si `document.hidden`; `dispose` completo (renderer, controles, escena: geometrías/materiales/texturas, listeners); `initialize→dispose→initialize` seguro (test).
- [ ] T-412 [US7] C6/C9: `ResizeObserver` sobre el contenedor (o `resize` con referencia estable), `setPixelRatio(min(dpr,2))`, tamaño por contenedor.
- [ ] T-413 [US7] C4: bucle y eventos continuos **fuera de Angular** (agnóstico a D-01): sin acceso a señales ni a CD dentro del frame; actualizaciones de señal solo en eventos discretos.
- [ ] T-414 [US2] C7: quitar el listener `change` que fuerza `y`; `minPolar/maxPolar`; `clampToRoom` con límites de `DEFAULT_SCENE_CONFIG.room.limits`; `maxDistance` derivado; `listenToKeyEvents` (flechas) y `reset()`.
- [ ] T-415 [US2] C2: `teleportTo(point)` animado dentro del bucle (sin rAF propio, `update(dt)`), cancelable, respeta `prefers-reduced-motion`; `focusOn(object)` (D-04); `SceneService.handlePointerSelect` conecta `floorPoint` con `teleportTo`.
- [ ] T-416 [US4] C8: `ModelLoaderService.loadModel(config, onProgress)`; progreso agregado con bytes reales (`total>0`); `SceneService.loadAll()` con `Promise.allSettled`, errores por modelo en `ViewerStateService.error` y `retryLoad`.
- [ ] T-417 [US4] Detección de WebGL y `webglcontextlost/restored` → `ViewerStateService.error`.
- [ ] T-418 [US2] C12: colocar por base (`minY=0` + offset de config); C14: `Material|Material[]`, sin `needsUpdate` sobrante, sombras solo donde corresponde.
- [ ] T-419 [US7] Specs: `scene.service.spec.ts` (init/dispose idempotentes, cancela rAF), `camera.service.spec.ts` (clamp, teleport con reloj falso, reset), `model-loader.service.spec.ts` (progreso, fallo parcial, base sobre suelo), `viewer-state.service.spec.ts`.

**Criterios de aceptación F4b**:
1. `npm test` verde con ≥ 12 tests nuevos; `lint:check` y `build` verdes.
2. Test automático: tras `dispose()`, `renderer.info.memory.geometries/textures === 0` y 0 rAF vivos (spy).
3. Manual (`npm start`): consola sin `Infinity%`; barra de progreso (valor en `ViewerStateService.loadProgress` visible desde DevTools); clic en suelo desplaza la cámara; alejar zoom al máximo no muestra el exterior.
4. `git diff --stat` solo toca los archivos listados.

---

## Fase F7 — UI/UX, accesibilidad y móvil (tras F4b; PARALELA con F4a, F5, F6, F8)

**Historias**: US3, US4, US5, US6. **Dependencias**: F4b (contrato de `SceneService`/`ViewerStateService`). **Archivos que toca**: `src/app/components/**` (viewer + nuevos), `src/app/app.component.*`, `src/app/config/ui-text.ts`, specs de componentes. **No toca** servicios, `scene.config.ts`, `index.html`, `styles.scss`.

- [ ] T-701 [P] [US4] `LoadingScreenComponent` (`role="progressbar"`, `aria-valuenow`, texto, fundido); lee `loadProgress`/`loadStatus`.
- [ ] T-702 [P] [US4] `ErrorOverlayComponent` (WebGL/context lost) y `ErrorBannerComponent` (modelo fallido + «Reintentar» → `retryLoad`).
- [ ] T-703 [P] [US3] `DescriptionPanelComponent`: botón «×», `Esc`, clic en vacío, `role="dialog"`+`aria-labelledby`, región `aria-live="polite"`, transición CSS (respeta `prefers-reduced-motion`), sin `:hover translateY`; devuelve foco al canvas.
- [ ] T-704 [P] [US5] `HelpPanelComponent`: controles ratón/táctil/teclado, iconos SVG con texto, botón «?» para reabrir, recuerda cierre con `localStorage` (try/catch), *bottom sheet* ≤ 40 % en móvil.
- [ ] T-705 [P] [US6] `ObjectListComponent`: botones por mueble (`getObjectList`) + «Vista inicial» (`resetView`); orden de tab lógico.
- [ ] T-706 [US3] `ViewerComponent`: Pointer Events (distancia ≥ 5 px para distinguir clic de arrastre; C10), `touch-action: none`, cursor `pointer`/`grab`/`grabbing` según `hovered`, `Esc`/`Home`; canvas con `role="img"`, `aria-label`, `tabindex=0`; registra listeners **antes** de la carga; usa `@if/@for`.
- [ ] T-707 [US5] SCSS: variables heredadas de `styles.scss` (F3), media queries (≤ 600 px, apaisado), `dvh`, paneles `min(92vw,360px)`, `:focus-visible`, objetivos ≥ 44 px, sin `transition: all`, radios coherentes.
- [ ] T-708 [US3] Textos: `config/ui-text.ts` con ayuda honesta y **descripciones mejoradas** (2–4 frases por mueble; las descripciones viven en `MODEL_CONFIGURATIONS`, propiedad de F6: F7 solo propone el texto en `ui-text.ts` y F6 lo referencia, o **[DECIDE PACO]** quién redacta los textos finales).
- [ ] T-709 [US6] Specs de componentes (cierre con Esc, `aria-live`, `progressbar`, lista, reintento) con `TestBed` y señales.

**Criterios de aceptación F7**:
1. `npm test` verde; `lint:check` (incluye reglas de accesibilidad de plantillas) y `build` verdes.
2. Manual 1280×800 y 390×844 (emulación): ayuda no tapa más del 40 % en móvil; `Tab` recorre ayuda → lista → «Vista inicial» → cerrar con foco visible; `Esc` cierra el panel; un lector de pantalla anuncia el mueble (comprobar con NVDA/VoiceOver o inspector de accesibilidad).
3. Lighthouse móvil: Accesibilidad ≥ 95.
4. Táctil emulado: un toque corto selecciona, un arrastre gira sin abrir panel.

---

## Fase F5 — Actualizar three 0.162 → 0.187 (tras F4a y F4b; PARALELA con F7, F8)

**Historias**: US11. **Archivos que toca**: `package.json`/lock (solo `three` y `@types/three`), y en `camera.service.ts`, `model-loader.service.ts`, `scene.service.ts` **solo** imports (`three/addons/*`) y adaptaciones obligatorias de API (colorSpace, `Clock`→`Timer`). **Condición**: F4b ya integrada; ninguna otra fase edita esos archivos a la vez (F7 no los toca).

- [ ] T-501 [US11] `npm i three@0.187 @types/three@0.187` en commit propio; arreglar roturas de tipos.
- [ ] T-502 [US11] Cambiar imports a `three/addons/...`; ajustar `outputColorSpace`/tone mapping; revisar luces físicas (sin `useLegacyLights`).
- [ ] T-503 [US11] Captura 1280×800 y 390×844; comparar con `docs/baseline/`; listar diferencias para F6.

**Criterios de aceptación F5**:
1. `npm ls three @types/three` → 0.187.x; `npm run lint:check && npm run build && npm test` verdes.
2. Smoke: la sala carga sin warnings de deprecación de three en consola.
3. Capturas nuevas adjuntas en `docs/baseline/after-three/`; diferencias anotadas.

## Fase F6 — Escena visual: luces, sombras, materiales, muros (tras F5 y F2)

**Historias**: US8. **Archivos que toca**: `services/room-builder.service.ts`, `config/scene.config.ts`, `services/model-loader.service.ts` (solo *overrides* de material por modelo), sus specs. **No** toca componentes ni `index.html`.

- [ ] T-601 [US8] C13: usar `DEFAULT_SCENE_CONFIG.lighting`; luz direccional con cámara de sombra dimensionada (±10, `mapSize` 2048, `bias/normalBias`) y puntos de luz sin sombra; ajustar intensidades para three 0.187.
- [ ] T-602 [US8] Muros `MeshStandardMaterial` mates (quitar clearcoat) y `DoubleSide` como red de seguridad (C7); contraste de la estantería frente a la pared de acento (color/valores).
- [ ] T-603 [US8] C17: *override* de material del sofá por config (`color`, `roughness`, normal procedural opcional); mipmaps/anisotropía en texturas.
- [ ] T-604 [US8] C12 (afinado): `offsetY` por modelo en `MODEL_CONFIGURATIONS` para que apoyen en el suelo; encuadre inicial para 390×844.
- [ ] T-605 [US8] Specs de `room-builder.service` (crea suelo/muros/luces esperados, `dispose`).

**Criterios de aceptación F6**:
1. `lint:check`, `build`, `test` verdes.
2. Capturas 1280×800 y 390×844 muestran los 3 muebles con base en el suelo (medible: `min.y` de cada bounding box = 0 ± 0,02 en un test), sofá con color, estantería distinguible, sin sombras recortadas.
3. Comparación con `docs/baseline/`: aprobada visualmente por Paco o por el orquestador principal.

## Fase F8 — CI (PARALELA tras F1b) — **[DECIDE PACO D-07]**

**Archivos**: `.github/workflows/ci.yml` (nuevo). 
- [ ] T-801 [P] Workflow: Node 22, `npm ci`, `lint:check`, `build`, `test` (headless) en `push`/`pull_request`; caché de npm; matriz opcional ubuntu+windows.
- [ ] T-802 [P] (opcional D-10) Job de despliegue condicionado a rama y a aprobación de Paco.
**Criterios**: el workflow pasa en una rama de prueba; `act` o ejecución en GitHub verde (la ejecución real la hace Paco/el principal).

## Fase F9 — Documentación y media (tras F6 y F7)

**Archivos**: `README.md`, `CONTRIBUTING.md` (revisión final), `docs/media/**`, `docs/**`, `src/assets/brand/og.png` (reemplaza el provisional de F3).
- [ ] T-901 [US10] Capturas finales 1280×800 y 390×844 y un GIF corto (clic en suelo + clic en mueble) en `docs/media/`.
- [ ] T-902 [US10] README: descripción real, badges con versiones correctas, features verificadas, tabla de stack, scripts, arquitectura (diagrama de §3 del plan), decisiones técnicas, licencias de modelos (de T-206), autoría (D-09), enlace a la demo.
- [ ] T-903 [US10] `og.png` final 1200×630 desde una captura real.
**Criterios**: todos los archivos citados en el README existen (`grep -o "\](\([^)]*\))"` + `test -f`); versiones del README = `package.json`; enlace a la demo responde 200 (si D-10 está resuelto).

## Fase F10 — Verificación final (SERIAL)

- [ ] T-1001 `npm ci && npm run lint:check && npm run build && npm test` en limpio (Windows y, vía CI, Linux).
- [ ] T-1002 `npm audit --omit=dev --audit-level=high` → 0 (SC-002).
- [ ] T-1003 Medir `du -sb dist/**/assets/models` ≤ 8 MB y bundle inicial (SC-003/004).
- [ ] T-1004 Perfil de rendimiento: 0 `ApplicationRef.tick` por frame, ≥ 55 fps, `dispose` sin fugas (SC-005).
- [ ] T-1005 Lighthouse móvil (a11y ≥ 95, BP ≥ 95, SEO ≥ 90) y consola sin errores (SC-006).
- [ ] T-1006 Checklist manual SC-007 en Chrome, Firefox, Safari iOS/Android (D-12): clic en suelo mueve; clic en mueble → contorno + panel; `Esc`; teclado; táctil.
- [ ] T-1007 Capturas finales vs `docs/baseline/` (SC-008).
- [ ] T-1008 Revisión de trazabilidad: cada C1–C17 tiene su test/prueba y está marcado en `spec.md` (tabla de cobertura).
**Criterio de aceptación**: todos los SC-001…SC-010 cumplidos o con excepción escrita y aprobada por Paco.

---

## Estrategia de implementación

- **Ruta crítica**: F0 → F1a → F1b → F4b → F7/F5 → F6 → F9 → F10. F2, F3 y F8 se absorben en paralelo.
- **MVP**: F0 solo ya deja el repo verde y presentable; F0+F2+F4a+F4b entrega las funciones prometidas y la carga mejorada.
- **Cada fase = un worktree = un orquestador/agente**; integración con `integrar` en el orden indicado; si `Integrado: false`, resolver el conflicto o devolverlo al agente.
- **Riesgo de ruta crítica**: F4b es la fase más grande; si el orquestador quiere más paralelismo puede dividirla en F4b-core (`scene/camera/viewer-state/interface`) y F4b-loader (`model-loader`), acordando antes la firma `loadModel(config, onProgress?)` en F0.
