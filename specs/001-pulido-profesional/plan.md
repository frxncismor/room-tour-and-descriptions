# Plan de implementación: Room tour pulido profesional

**Feature**: `001-pulido-profesional` · **Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-22
**Base**: `main` en `ba66b12` (Angular 17.3, three 0.162, Node 22.12 / npm 11.6 en la máquina de Paco).

## 1. Contexto técnico

| Aspecto | Hoy | Objetivo |
|---|---|---|
| Framework | Angular 17.3.12, componentes standalone, zone.js | Angular 21 o 22 (D-02), señales, control flow `@if/@for`, **[DECIDE PACO]** zoneless (D-01) |
| 3D | three 0.162 + `OrbitControls` | three 0.187, `three/addons`, `OrbitControls.listenToKeyEvents`, `Timer`/`Clock` |
| Lenguaje | TypeScript 5.4 | El que pida Angular objetivo (~5.9); no saltar a 7 por libre |
| Lint/format | eslint 8 (`.eslintrc.json`), `@angular-eslint` 20.3 desalineado, prettier 3.6 | eslint 9 flat config + `angular-eslint` alineado; prettier 3.x; `.gitattributes` |
| Tests | Karma + Jasmine, 1 spec obsoleto | **[DECIDE PACO]** Vitest (runner oficial en Angular 21+) o Karma (D-03b) |
| Assets | 51 MB (PNG 16 MB, `sofa/scene.bin` 10,3 MB) | ≤ 8 MB: WebP + meshopt (+ KTX2 opcional) |
| Estructura | 5 servicios + 1 componente, estado en el componente, `UI_TEXT` mal ubicado | Servicios con responsabilidades claras + `ViewerStateService` (señales) + 5 componentes de UI |
| Destino | demo desplegada (build antiguo) | Misma ruta, build nuevo desde CI (D-10) |

Datos verificados en el código en esta corrida: `sofa/scene.gltf` tiene un único material `Scene_-_Root` con `baseColorFactor` y sin texturas (origen del gris, C17); `bookshelf/scene.bin` 27 kB, `poker_table/scene.bin` 891 kB, `sofa/scene.bin` 10,3 MB (el sofá es geometría pesada, no texturas: meshopt/cuantización aquí rinde más que WebP). `npm view @angular/core dist-tags` → `latest` **22.3.0** (la investigación citaba 21.2.x; 21.2 sigue disponible). `npm view three version` → 0.187.0.

## 2. Principios de la constitución aplicados

Repo verde en cada commit (I), capturas de referencia antes de tocar escena/estilos (II), a11y (III), rendimiento/dispose (IV), errores visibles (V), commits convencionales y tests (VI). Ver `.specify/memory/constitution.md`.

## 3. Arquitectura objetivo

```
AppComponent
└─ ViewerComponent (contenedor, enlaza canvas y servicios)
   ├─ <canvas role="img" aria-label tabindex="0">
   ├─ LoadingScreenComponent   (progressbar, lee ViewerStateService.loadProgress)
   ├─ ErrorOverlayComponent    (WebGL / context lost) + ErrorBannerComponent (fallo de modelo + Reintentar)
   ├─ HelpPanelComponent       (controles ratón/táctil/teclado, botón «?»)
   ├─ DescriptionPanelComponent(dialog + aria-live + cierre/Esc + transición)
   └─ ObjectListComponent      (alternativa accesible: botones por mueble + «Vista inicial»)

Servicios (providedIn root, con dispose idempotente)
  SceneService            orquesta: renderer, bucle (rAF id), resize, dispose, coordina el resto
  CameraService           cámara + OrbitControls, límites, teletransporte animado, reset, teclado
  ObjectInteractionService raycast, hover, selección, contorno (mallas clonadas), SIN rAF propio
  ModelLoaderService      GLTFLoader (+MeshoptDecoder), progreso agregado, apoyo en suelo, materiales
  RoomBuilderService      muros/suelo/techo/luces desde config
  ViewerStateService      señales: loadProgress, status, error, selected, hovered, helpOpen
config/  scene.config.ts (sala, luces, modelos)  ·  ui-text.ts (textos)
```

Contrato entre fases paralelas (para evitar conflictos, ver tasks.md):

- `ObjectInteractionService.handleClick(...)` mantiene su firma y su `InteractionResult`, que solo **gana campos opcionales**: `{ success, objectInfo, error?, floorPoint?: Vector3, object?: Object3D }`. `SceneService` (F4b) usa `floorPoint` para llamar a `CameraService.teleportTo`.
- `ObjectInteractionService` expone `update(time)` (anima contorno/hover desde el bucle principal) y `setHover(pointerNdc|null): Object3D|null`. `SceneService` (F4b) llama a `update` en cada frame.
- `ViewerStateService` (nuevo, creado en F4b) define las señales y es la única superficie que consume F7. F4b lo crea con su API final; F7 solo lo lee/escribe a través de ella.
- `CameraService` expone `teleportTo(point)`, `focusOn(object)`, `reset()`, `isAnimating()` (F4b). Los eventos de teclado los registra F7 en el componente y llaman a esos métodos.

## 4. Enfoques considerados y decisión por área

### 4.1 Teletransporte (C2, FR-010)
| Enfoque | Coste | Pros / contras |
|---|---|---|
| A. Teletransporte animado (lerp 1,2 s a posición del clic, altura de ojos fija) | Bajo: el código `CameraService.teleportTo` ya existe, falta enlazarlo y quitar el rAF duplicado | Cumple lo que promete la ayuda; fácil de testear con reloj falso; conserva órbita |
| B. Movimiento libre WASD + pointer lock | Alto (colisiones, joystick móvil, a11y) | Más «juego», fuera de alcance, mala en táctil |
| C. Sin movimiento (solo órbita) y cambiar la ayuda | Mínimo | Honesto pero pierde la función estrella |
**Elegido: A**, con `focusOn(object)` al seleccionar (D-04) y `reset()`. Se anima en el bucle principal (`CameraService.update(dt)`) y no con un rAF propio. Respeta `prefers-reduced-motion` (salto sin interpolación).

### 4.2 Cámara y límites (C7)
Quitar el listener `change` que fuerza `y`. Fijar `minPolarAngle`/`maxPolarAngle` y el `target` a la altura de ojos *al teletransportar/resetear*. Limitar con `controls.addEventListener('change')` solo para **acotar** posición al rectángulo de la sala (`clampToRoom`), con `maxDistance` derivado de los límites. Muros `DoubleSide` como segunda red de seguridad. Descartada la alternativa de cajas de colisión: sobredimensionada.

### 4.3 Selección y contorno (C3, C11)
| Enfoque | Coste | Notas |
|---|---|---|
| A. Clonar las mallas del mueble con material `BackSide` escalado/normales extruidas (hull invertido) | Medio-bajo | Sigue la forma real, rápido, sin postproceso; se añade como hijo del objeto (coordenadas locales: sin el bug del quaternion/Box3 de mundo) |
| B. `OutlinePass` (EffectComposer) | Medio-alto | Mejor calidad pero añade ~40 kB y un segundo render, peor en móvil |
| C. `BoxHelper`/caja | Mínimo | Feo en el sofá girado |
**Elegido: A** con pulso de opacidad en `update(time)` y `dispose` explícito. Hover = emisivo sutil (restaurado al salir) reutilizando el mismo mecanismo.

### 4.4 Render continuo vs. bajo demanda (FR-044)
| Enfoque | Coste | Notas |
|---|---|---|
| A. Continuo con `setAnimationLoop`, pausado si la pestaña está oculta | Bajo | Simple; el contorno pulsante y el damping exigen frames |
| B. Bajo demanda (`invalidate()` en cambios de cámara/hover/animación/carga) | Medio | Menos batería; riesgo de «frames que no se pintan» si algo olvida invalidar |
**Elegido: A en esta feature**, con `document.hidden` → pausa y `setAnimationLoop(null)` en `dispose`. B queda como mejora opcional (D-03) porque el contorno pulsante y el damping necesitan frames y el beneficio en un solo cuarto es pequeño frente al riesgo.

### 4.5 Zona de Angular (C4) — **[DECIDE PACO] D-01**
| Enfoque | Coste | Notas |
|---|---|---|
| A. **Zoneless** (`provideZonelessChangeDetection`, quitar zone.js) + señales | Bajo-medio: la app es pequeña, el estado ya es de pocas variables; hay que actualizar la UI solo con señales | Elimina el problema de raíz, menos polyfills/bundle (-~30 kB), práctica actual (por defecto en Angular nuevos); requiere que ningún componente dependa de CD por zona |
| B. Mantener zone.js y `NgZone.runOutsideAngular` en bucle, `resize`, `pointermove` y animaciones | Bajo | Funciona en cualquier versión; fácil de olvidar un sitio |
**Recomendado: A**, pero el código se escribe **agnóstico**: render y eventos continuos corren sin tocar Angular, la UI solo se actualiza con señales. Con ello cambiar entre A y B es una tarea de una línea (T-1xx de F1b). Si Paco prefiere B, se añade `runOutsideAngular` en las llamadas de F4b/F7.

### 4.6 Optimización de assets (C16) — **[DECIDE PACO] D-05**
Herramienta: `@gltf-transform/cli` por `npx` (sin dependencia en `package.json`), script reproducible `scripts/optimize-models.mjs` y copia de los originales fuera de `src/assets` (o en un `assets-src/` ignorado de la build).
| Enfoque | Coste | Resultado esperado |
|---|---|---|
| A. WebP (≤ 1024 px; 2048 madera) + `meshopt` + `quantize` + `dedup`/`prune`/`weld` | Bajo: `GLTFLoader` soporta `EXT_texture_webp` sin decodificador, y `MeshoptDecoder` ya viene en `three/addons` (se importa, sin copiar assets) | ≈ 3–6 MB total; compatible con todos los navegadores objetivo |
| B. A + KTX2/Basis (`toktx` + `KTX2Loader` + transcodificador `basis_transcoder.wasm` copiado a assets) | Medio: herramienta `toktx` externa, wasm extra (~200 kB), `renderer` debe `detectSupport` | VRAM mucho menor (≈ 4× menos que PNG/WebP descomprimido), arranque más rápido en móvil; más complejidad |
| C. Draco para geometría | Medio: wasm decoder de ~300 kB, más lento que meshopt en CPU | Peor que A para este caso |
**Recomendado: A**, con tamaños objetivo: sofá (geometría) ≤ 1,5 MB, mesa ≤ 3 MB (madera 2048 → ~400 kB WebP, resto a 1024), estantería ≤ 0,6 MB; total ≤ 5 MB (límite SC ≤ 8 MB). B solo si la medición en móvil real muestra memoria alta; se propone como fase opcional.
Nota: tras comprimir con meshopt el gltf no carga sin decodificador, por eso el registro del decodificador es una tarea del loader (F4b) y **F2 se integra con F4b o después** (ver orden en tasks.md).

### 4.7 Dependencias — orden respecto a los arreglos — **[DECIDE PACO] D-02/D-11**
Opciones: (i) deps antes de los arreglos; (ii) deps después; (iii) mezclar.
**Recomendado (i) con paralelismo parcial**: F0 (verde mínimo) → F1 (Angular 17→21(/22)) serial → después F4a/F4b/F7 en paralelo → F5 (three) → F6 (visual).
Razones:
1. `ng update` toca decoradores (p. ej. migración de v19 quita `standalone: true`; v20+ renombra/depreca APIs, v20 `@angular/build`, migración a control flow y a `inject`), `angular.json`, `tsconfig*`, tests y lint. Hacerlo **ahora** sobre ~1.200 líneas ya compilando es mecánico; hacerlo después de reescribir servicios y componentes mezcla conflictos de migración con conflictos de lógica.
2. Los arreglos de F4/F7 usan APIs finales (señales, `@if`, `inject`, zoneless, Vitest), así que se escriben una sola vez.
3. Mientras F1 (que ocupa `package.json`, `angular.json`, configuración y migraciones) está en curso, **solo se paralelizan fases que no tocan esos archivos ni `.ts`**: F2 (assets), F3 (marca/estáticos) y la **redacción** de F4/F7 (solo trabajo en worktrees que arrancan al terminar F1; no antes).
4. three se actualiza **después** de F4 (los arreglos de loader/cámara/luces ya están hechos y probados) y **antes** de F6 (el ajuste visual debe hacerse sobre la versión final de three).
Alternativa (ii) más segura para producto (arreglos primero) pero duplica trabajo y deja la peor deuda (EOL, 10 vulnerabilidades) más tiempo.

### 4.8 Plan de dependencias concreto

Cada paso: un commit, y entre pasos `npm run lint:check && npm run build && npm test` en verde. Node ≥ 22.12 (requisito de Angular 21/22).
1. **F0** (pre-requisito): `git rm --cached` + `.gitattributes`, `git add --renormalize .`; C1; spec; verde en 17.
2. **17 → 18**: `npx ng update @angular/core@18 @angular/cli@18` (+ `@angular/material` no se actualiza si ya se va a quitar: quitarlo primero en F0/F1 con `npm uninstall @angular/material @angular/forms`). Revisar `angular.json` (`application` builder ya en uso).
3. **18 → 19**: `ng update @angular/core@19 @angular/cli@19` (migraciones `standalone`, `inject`, opcionales).
4. **19 → 20**: `ng update @angular/core@20 @angular/cli@20` (TS ≥ 5.8, `@angular/build` opcional; renombrados de APIs; puede pedir `zone.js` 0.15).
5. **20 → 21**: `ng update @angular/core@21 @angular/cli@21`; TS ~5.9; `zone.js` ~0.15.
6. **(opcional) 21 → 22**: `ng update @angular/core@22 @angular/cli@22` si Paco elige 22 (D-02). Comprobar cambios de ruptura con `npx ng update` y la guía oficial en cada salto (`update.angular.dev`).
7. **Migrar builder** a `@angular/build:application` (si `ng update` no lo hizo) y quitar `@angular-devkit/build-angular`.
8. **ESLint**: `npx ng add angular-eslint` (genera `eslint.config.js` flat) → eslint 9, `typescript-eslint` 8; borrar `.eslintrc.json`; ajustar `lint-staged` y `scripts/lint-check.js`.
9. **Tests**: Karma → **Vitest** con `ng update` / schematic oficial (`@schematics/angular:refactor-jasmine-vitest` si existe en la versión objetivo; si no, `ng test` con runner `vitest`) — **[DECIDE PACO] D-03b**. Alternativa: conservar Karma/Jasmine y solo alinear versiones.
10. **Limpieza**: quitar `@angular/material`, `@angular/forms`, `@angular/router`, `@angular/animations` (y `provideAnimations`), `app.config.ts`, `app.routes.ts`, `styles.css`; `prepare: "husky"`.
11. **three**: `npm i three@0.187 @types/three@0.187` en un commit **aparte** en F5; ver §4.9.

### 4.9 three 0.162 → 0.187 (F5)
Riesgos conocidos: alias de importación `three/examples/jsm/...` → `three/addons/...` (el actual funciona, se cambia por consistencia); luces físicas (`useLegacyLights` eliminado en r165): las intensidades se reajustan; `Color` y `colorSpace`/tone mapping (`ACESFilmic`/`AgX`); cambios en `OrbitControls` (`listenToKeyEvents`, `zoomToCursor`); `GLTFLoader` y `KHR_materials_*`; `Timer` en lugar de `Clock`. Se compara visualmente contra las capturas (T de verificación) y se retocan intensidades en F6. Coste 2–4 h.

### 4.10 UI/UX
Lenguaje visual: paleta derivada del acento de la sala (`#2c4a52` verde azulado) con superficies claras translúcidas, radio único 12 px, tokens CSS en `:root` y modo oscuro (`prefers-color-scheme`) solo en los paneles (opcional). SVG propios para iconos (cursor, mano, lupa, teclado) con `<title>` o `aria-hidden` + texto visible. Texto de ayuda: «Arrastra para mirar alrededor · Rueda/pellizco para zoom · Clic/toque en el suelo para moverte · Clic/toque en un mueble para ver detalles · Esc cierra · Home vuelve al inicio». Móvil: la ayuda es una *bottom sheet* ≤ 40 % de la altura. Cursor: `pointer` sobre muebles, `grab`/`grabbing` en otro caso. Descripciones: 2–4 frases, nombre + qué es + detalle (material/uso).

### 4.11 Accesibilidad
Canvas `role="img"` con `aria-label` («Sala 3D interactiva…»), `tabindex="0"`, `aria-describedby` apuntando a la lista; lista de muebles como botones nativos; panel `role="dialog"` no modal con `aria-labelledby`; región `aria-live="polite"`; `Esc`; `:focus-visible`; objetivos táctiles ≥ 44 px; `prefers-reduced-motion`.

### 4.12 Marca y metadatos
`index.html` (`lang`, title, description, `theme-color`, OG/Twitter, canonical si hay URL de demo), favicon SVG+ICO+apple-touch (generados desde un SVG simple, p. ej. cubo/sala en `#2c4a52`), imagen OG 1200×630 hecha desde una captura real tras F6/F7 (se regenera en F9).

## 5. Estructura de archivos (objetivo)

```
.gitattributes  .editorconfig  .prettierrc  eslint.config.js  .github/workflows/ci.yml (D-07)
public/ o src/assets/brand/   favicon.svg  favicon.ico  apple-touch-icon.png  og.png
scripts/ lint-check.js  optimize-models.mjs
docs/ media/ (capturas, gif)   docs/assets-pipeline.md
src/app/
  app.component.ts|html|scss|spec.ts
  config/ scene.config.ts  ui-text.ts
  interfaces/ scene.interface.ts
  services/ scene|camera|object-interaction|model-loader|room-builder|viewer-state .service.ts (+ .spec.ts)
  components/ viewer/ loading-screen/ help-panel/ description-panel/ error-overlay/ object-list/ (+ specs)
```

## 6. Riesgos y mitigación

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| `ng update` rompe algo no cubierto por tests (tests casi inexistentes hoy) | Media | Alto | F0 añade tests mínimos y smoke de build antes de F1; commit por salto; captura de referencia por salto |
| Migración Karma→Vitest requiere reescribir specs | Media | Bajo | F0 deja solo 1–2 specs; los nuevos specs se escriben después de F1 con el runner final |
| meshopt/WebP no cargan en algún navegador | Baja | Alto | Decodificador de `three/addons` en bundle; WebP universal en objetivos; verificación en Safari; fallback: PNG optimizado |
| Cambio de iluminación con three nuevo altera el look | Alta | Medio | Capturas de referencia antes (F0) y comparación en F5/F6; ajuste de intensidades en F6 |
| WebGL no disponible en tests | Alta | Bajo | Specs con mocks/`jsdom`-less; lógica de raycast/cámara se prueba con objetos three sin renderer |
| Conflictos entre fases paralelas | Media | Medio | Mapa de archivos exclusivos por fase (tasks.md); contrato de interfaces aditivo; integración en el orden indicado |
| Licencias de los modelos 3D (Sketchfab) | Baja | Medio | Revisar `scene.gltf` (`asset.extras`) y citar en README; D-06 |
| Safari iOS: `dvh`, `touch-action`, `devicePixelRatio` | Media | Medio | Prueba con emulación y, si es posible, dispositivo real (D-12) |
| La demo desplegada se rompe con el nuevo build | Baja | Alto | Desplegar solo con permiso de Paco, desde CI, con `base href` verificado |

## 7. Estrategia de pruebas

- **Unitarias** (runner final, sin GPU): servicios con objetos three reales (`Scene`, `Mesh`, `Raycaster`) y reloj falso; renderer sustituido por *stub*.
- **Componentes**: `TestBed` con señales; `Esc`, cierre, `aria-live`, `progressbar`.
- **Humo en navegador**: `ng build` + `ng serve` + navegador headless (Playwright/Chrome) que carga la página, espera «escena lista» (atributo `data-ready` en el canvas) y captura 1280×800 y 390×844; compara con las capturas de referencia (diferencia visual manual; opcional `pixelmatch`).
- **Lighthouse** móvil (a11y, best practices, SEO) y `npm audit`.
- **Manual**: checklist de SC-007 (clic suelo, clic mueble, `Esc`, teclado, táctil emulado).
- **Rendimiento**: Performance panel (frames, `ApplicationRef.tick`), `renderer.info` (geometrías/texturas antes y después de `dispose`).

## 8. Decisiones abiertas para Paco (no resueltas aquí)

| ID | Pregunta | Recomendación | Alternativa |
|---|---|---|---|
| **D-01** | ¿Zoneless o mantener zone.js? | Zoneless + señales (código agnóstico, cambio de una línea) | zone.js + `runOutsideAngular` |
| **D-02** | ¿Versión destino de Angular? | **21** (cadena 17→18→19→20→21, soporte probado) y parar ahí en esta feature | **22.3** (latest, un salto más) o 20 si quiere menos riesgo |
| **D-03** | ¿Render continuo o bajo demanda? | Continuo con pausa por visibilidad | Bajo demanda (mejora posterior) |
| **D-03b** | ¿Tests con Vitest o conservar Karma/Jasmine? | Vitest (Karma deprecado, runner oficial) | Karma/Jasmine alineado |
| **D-04** | Al seleccionar un mueble, ¿la cámara se acerca animada? | Sí, suave y desactivable con `prefers-reduced-motion` | Solo panel + contorno (menos mareo) |
| **D-05** | Compresión de assets | WebP + meshopt (A) | + KTX2 (B) si la prueba móvil lo pide |
| **D-06** | ¿Conservar los modelos actuales o cambiar/añadir (decoración, más muebles)? | Conservar y mejorar materiales; sin contenido nuevo | Añadir 1–2 elementos decorativos livianos |
| **D-07** | ¿CI con GitHub Actions? | Sí: lint:check + build + test (+ opcional deploy a Pages) | Sin CI (solo hooks locales) |
| **D-08** | Idioma de la UI y los textos | Inglés (actual, audiencia de portfolio), textos centralizados en `ui-text.ts` | Español, o ambos con selector |
| **D-09** | Autor del README: «Francisco Morales» (README) vs «Francisco J. Moreno» (git) | Confirmar con Paco y usar el correcto | — |
| **D-10** | ¿Dónde se despliega y quién despliega? | Mismo destino de la demo actual, desde CI con su permiso | GitHub Pages / Vercel nuevo |
| **D-11** | ¿Orden deps vs. arreglos? | Deps primero (ver §4.7) | Arreglos primero |
| **D-12** | ¿Hay dispositivo móvil real para la prueba final? | Sí (iOS y Android) para F9; si no, emulación | Solo emulación |
| **D-13** | ¿Quitar `@angular/material`? | Sí (no se usa, 17.3 no es compatible con core 21) | Conservar y actualizar si va a usarlo |
| **D-14** | ¿Crear `.github` con plantillas de issue/PR, `LICENSE`, `CODEOWNERS`? | Solo `LICENSE` si Paco lo desea | Nada más |

## 9. Seguimiento

Constitución verificada: ningún principio se viola; la única tensión es *Repo siempre verde* durante F1 (cada salto verde antes del siguiente). La complejidad añadida (6 componentes, `ViewerStateService`) está justificada por testabilidad y accesibilidad (FR-060).
