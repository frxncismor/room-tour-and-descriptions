# Tareas: Sala completa, decorada e interactuable

**Entrada**: [spec.md](./spec.md), [plan.md](./plan.md) · **Fecha**: 2026-11-23 · **Asume todas las recomendaciones de plan §7** (D-400…D-421).
**Formato**: `- [ ] T-4xx [P] [USn] Pista: descripción — archivos`. `[P]` = paralelizable con otras tareas **de la misma fase** (archivos distintos).
**Reglas**: cada pista trabaja en **su propio worktree** (`Orq-Worktree.ps1 -Accion nuevo -Agente <pista>`) y toca **solo** los archivos de su columna; **un único dueño por archivo en cada fase**; **máximo 3 agentes en paralelo**; integra su orquestador (`integrar`) cuando se cumplen los criterios de la fase. Entre integraciones: `npm run lint:check && npm run build && npm test` en verde (constitución I). Ningún agente hace commit/push/PR por su cuenta.
**Máquina compartida**: nada de `npm install` ni dependencias nuevas; Lighthouse y herramientas por `npx -y`; las descargas de assets van a una **carpeta temporal fuera del repo**, borrada al acabar; los navegadores headless se lanzan y cierran solo con procesos cuyo `CommandLine` contenga el worktree propio.
**Red de seguridad entre fases**: cada fase deja la app **idéntica a la de hoy en la vista inicial** (salvo cornisa tras F3) y con 5 piezas en la lista hasta que F3 conecta la escena; los nuevos servicios y componentes funcionan con listas vacías.

## Pistas y dueños

| Pista                    | Agente         | Archivos que posee (exclusivos, por fase)                                                                                                                    |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **V** Verificación       | `verif`        | `specs/004-sala-completa/{baseline,verification}.md`, `docs/baseline/004-*`, `scripts/verify-viewer-scroll.mjs`, `scripts/bundle-report.mjs`                 |
| **A** Assets             | `assets`       | `src/assets/models/<9 nuevos>/**`, `src/assets/textures/art/{e,f,g,h}.webp`, `docs/assets-pipeline.md` (F0)                                                  |
| **T** Tipos e i18n       | `tipos`        | F0: `interfaces/scene.interface.ts`, `i18n/{messages,en,es,locale.service}.ts` (+specs), `pieces/{piece-ids,pieces.en,pieces.es}.ts` (+spec de paridad)      |
| **K** Cámara             | `camara`       | F1: `services/camera.service.ts` (+spec)                                                                                                                     |
| **I** Interacción        | `interaccion`  | F1: `services/object-interaction.service.ts`, `services/viewer-state.service.ts` (+specs)                                                                    |
| **P1** Piezas: datos     | `piezas-datos` | F1: `pieces/{pieces.config,surfaces.config}.ts` (+specs). F4: los mismos (colocación)                                                                        |
| **P2** Piezas: geometría | `piezas-geo`   | F2: `pieces/pieces-builder.service.ts`, `pieces/builders/*.ts` (+specs)                                                                                      |
| **P3** Piezas: acciones  | `piezas-acc`   | F2: `pieces/piece-actions.runtime.ts`, `pieces/turntable-audio.ts` (+specs)                                                                                  |
| **U** Lista y visor      | `ui-lista`     | F2: `components/object-list/**`, `components/viewer/**`                                                                                                      |
| **UP** Ficha y ayuda     | `ui-ficha`     | F3: `components/description-panel/**`, `components/help-panel/**`, `app.component.html`, `angular.json` (solo si SC-404 lo exige, con permiso del principal) |
| **S** Escena             | `escena`       | F3: `services/scene.service.ts`, `services/model-loader.service.ts`, `services/room-builder.service.ts` (+specs)                                             |
| **D** Docs               | `docs`         | F6: `README.md`, `docs/media/**`                                                                                                                             |

## Mapa de fases

```
F0 ┬ V  T-400…401 línea base (frame A/B, bundle, scroll) + script CDP ─┐
   ├ A  T-410…413 9 modelos WebP + 4 láminas + créditos ───────────────┤
   └ T  T-420…423 tipos, cadenas iniciales, LocaleService, diccionarios┴─► F1 ┬ K  T-430…433 focusSurface, zoom
                                                                            ├ I  T-440…443 pickables, prioridad, estado
                                                                            └ P1 T-450…452 pieces/surfaces config
                                                                                   │
                                                              F2 ┬ P2 T-460…465 builders por zona
                                                                 ├ P3 T-470…474 acciones y audio
                                                                 └ U  T-480…483 lista agrupada + fix del visor
                                                                        │
                                                              F3 ┬ S  T-488…491 cableado perezoso, sombras estáticas, cornisa
                                                                 └ UP T-484…487, T-492 ficha, ayuda, @defer, bundle
                                                                        │
                                                              F4 P1 T-453…454 colocación y tuning con capturas
                                                                        │
                                                              F5 V  T-494…497 verificación EN+ES ─► F6 D T-498…499 README y media
```

| Fase | Depende de | Agentes | Resumen                                                                                          |
| ---- | ---------- | ------- | ------------------------------------------------------------------------------------------------ |
| F0   | —          | 3       | línea base **antes** de todo; assets medidos; tipos, cadenas y diccionarios (sin efecto visible) |
| F1   | F0         | 3       | cámara (superficies, zoom), interacción (pickables, estado), datos de piezas                     |
| F2   | F1         | 3       | geometría procedural por zona, acciones y audio, lista agrupada y fix del visor                  |
| F3   | F2         | 2       | cableado en la escena y paneles (acciones, tramos), dieta del bundle                             |
| F4   | F3         | 1       | colocación fina y orientación de glTF con capturas                                               |
| F5   | F4         | 1       | verificación completa SC-400…415 en EN y ES                                                      |
| F6   | F5         | 1       | README (créditos, controles) y capturas finales                                                  |

---

## Fase F0 — Línea base, assets, tipos y diccionarios (paralela ×3)

**Criterio de fase**: `npm run lint:check && npm run build && npm test` en verde; **ningún cambio visual ni de texto en la app**.

### Pista V · `verif`

- [ ] T-400 [P] [US46] V: **línea base** en `baseline.md`: (a) frame ×4 en vistas **A** (inicial) y **B** (cámara (0; 1,7; 4,5), objetivo (0; 1,36; 7,5)) con el método de la 003 (300 frames, `--uncapped --prod`, 10 pares ABAB); (b) draw calls/tris por vista con `window.__rtad.stats()`; (c) `ng build --stats-json` y `scripts/bundle-report.mjs` (lee el metafile de esbuild: bytes por módulo del inicial, top 20); (d) capturas 1280×800, 1813×834 y 390×844 de la vista inicial y de la B en `docs/baseline/004-base-*`; (e) cifra de `src/assets` — `specs/004-sala-completa/baseline.md`, `scripts/bundle-report.mjs`, `docs/baseline/004-base-*`.
      _Aceptación_: `baseline.md` con las 5 cifras y los comandos; `node scripts/bundle-report.mjs` imprime el desglose del inicial y la suma coincide ±1 kB con `dist`.
- [ ] T-401 [P] [US45] V: `scripts/verify-viewer-scroll.mjs` (Edge/Chrome headless por CDP, sin dependencias): guion de spec §E a 1813×834, 1280×800 y 125 %; sale con código ≠ 0 si algún `scrollLeft/scrollTop` ≠ 0; **debe fallar en la rama base** si el disparador se reproduce (anotar el resultado; si no reproduce, dejarlo como guardián) — `scripts/verify-viewer-scroll.mjs`.
      _Aceptación_: `node scripts/verify-viewer-scroll.mjs --url <preview>` imprime una línea por paso y por tamaño; se documenta cómo lanzarlo en `baseline.md`.

### Pista A · `assets`

- [ ] T-410 [P] [US41] A: descargar a carpeta temporal (fuera del repo) los 9 glTF 1k de Poly Haven (`mid_century_lounge_chair`, `side_table_01`, `modern_arm_chair_01`, `modern_coffee_table_01`, `vintage_wooden_drawer_01`, `painted_wooden_chair_02`, `wooden_display_shelves_01`, `painted_wooden_cabinet_02`, `modern_ceiling_lamp_01`); comprobar md5 contra la API; texturas a WebP q85 (**512 px**: sillones, aparador; **256 px**: mesitas, silla, estantería, armario, colgante); optimizar con `scripts/optimize-models.mjs`; copiar a `src/assets/models/<id>/` con el mismo formato que los actuales — `src/assets/models/**`.
      _Aceptación_: tabla en `docs/assets-pipeline.md` con peso y tris medidos por modelo (cada peso ≤ el de spec A.2 + 25 %); `du -sb src/assets` ≤ 6 815 744 B; sin PNG/JPG; la carpeta temporal borrada.
- [ ] T-411 [US41] A: medir la caja real (`POSITION.min/max` con nodos) y el frente de cada glTF y anotar en `docs/assets-pipeline.md` la rotación Y que deja el frente a −z local (para T-453) — `docs/assets-pipeline.md`.
      _Aceptación_: 9 filas con dimensiones medidas y «frente = ±x/±z local».
- [ ] T-412 [US41] A: elegir **4 láminas nuevas** de dominio público (botánica de A. Atkins y/o W. H. F. Talbot; distintas de A–D; tono azul/sepia), **verificar la licencia en la página de cada archivo** de Wikimedia Commons, recortar a 5:7 y exportar `e.webp`, `f.webp`, `g.webp`, `h.webp` a 512×717 q85 — `src/assets/textures/art/{e,f,g,h}.webp`.
      _Aceptación_: cada archivo ≤ 110 kB; tabla (obra, autor, año, URL del archivo, licencia, peso) en `docs/assets-pipeline.md` lista para el README.
- [ ] T-413 [US46] A: confirmar el presupuesto: suma de T-410 + T-412 y comparación con spec F.1 — `docs/assets-pipeline.md`.
      _Aceptación_: `du -sb src/assets` documentado y ≤ 6 815 744 B (tope); si supera 6 291 456 B, propuesta de recorte de F.1 en el informe.

### Pista T · `tipos`

- [ ] T-420 [P] [US43] T: tipos: `SelectableId = FurnitureId | PieceId | SurfaceId`, `ObjectInfo.kind`, `ActionId`, `PieceState` — `interfaces/scene.interface.ts`; `pieces/piece-ids.ts` (solo tipos y lista de ids, perezoso).
      _Aceptación_: `npm run build` verde; ningún consumidor roto (`kind` por defecto `'furniture'`); `piece-ids.ts` solo contiene tipos y constantes de ids.
- [ ] T-421 [US44] T: cadenas **iniciales** nuevas EN/ES (`list.search`, `list.searchEmpty`, `list.viewWall`, `list.groups.*`, `panel.actions`, `wall.nav.*`, texto de ayuda sobre el clic en pared y el zoom) en `Messages`/`en.ts`/`es.ts` — `i18n/{messages,en,es}.ts` + specs.
      _Aceptación_: paridad de claves; `npm run build` verde; el inicial crece ≤ 0,8 kB (informe de `bundle-report.mjs`).
- [ ] T-422 [US43] T: `LocaleService` carga `pieces.<locale>` (import perezoso) cuando el chunk de piezas está presente y al cambiar de idioma, con error visible si falla (constitución V) — `i18n/locale.service.ts` + spec.
      _Aceptación_: tests: cambio EN→ES con diccionario de piezas cargado actualiza `pieceMessages()`; fallo de carga muestra el aviso y conserva el idioma anterior.
- [ ] T-423 [US43] T: diccionarios perezosos `pieces/pieces.en.ts` y `pieces.es.ts`: **35 piezas + 5 superficies** con `name`, `description`, `details?` y `actions` (etiquetas on/off y anuncios) según spec §B.6 y la tabla A.2 — `pieces/pieces.{en,es}.ts` + `pieces/pieces.i18n.spec.ts`.
      _Aceptación_: test de paridad EN/ES de claves; nombre ≤ 28 car., descripción ≤ 220 car.; ids == `piece-ids.ts`; ningún `{work}` sin sustituir en las plantillas de la TV; cada archivo ≤ 14 kB.

---

## Fase F1 — Cámara, interacción y datos de piezas (paralela ×3: K, I, P1)

**Criterio de fase**: build/lint/test en verde; la escena sigue con 5 piezas (los servicios nuevos aceptan listas vacías).

### Pista K · `camara` · Depende de: F0 (T-420).

- [ ] T-430 [P] [US43] K: `CameraService.focusSurface(surface, tramo, aspect)`: pose frontal (distancia `max(d_alto, d_ancho)`, tope 9 m, objetivo 0,5 m delante de la pared), nº de tramos `n = ceil(16·1,04 / (2·9·tan(hFOV/2)))`, tramo elegido por punto pulsado, `prefers-reduced-motion` — `services/camera.service.ts` + spec.
      _Aceptación_: tests a 1,6:1, 1,33:1 y 0,46:1: las esquinas del tramo con margen 0,4 m dentro del frustum, cámara dentro de ±7,5 m, `d ≤ 9`; `n = 1/1/2`.
- [ ] T-431 [US43] K: pose fija del **techo** (centro, pitch 23°) incluida en `focusSurface` — `services/camera.service.ts` + spec.
      _Aceptación_: test: pitch ≤ 30°, cámara en la sala, el punto (0; 4; 5,9) dentro del frustum.
- [ ] T-432 [US43] K: `maxDistance` 12 (sin romper `applyDistanceLimit` de retrato), `minDistance` 0,8 — `services/camera.service.ts` + spec.
      _Aceptación_: tests existentes actualizados; la vista inicial no cambia (misma pose).
- [ ] T-433 [US43] K: `zoomToCursor = true` con revisión de `clampToRoom` para que el objetivo no salga de la sala ni quede a < 0,5 m de una pared — `services/camera.service.ts` + spec.
      _Aceptación_: tests de zoom repetido hacia una esquina: objetivo siempre dentro de ±7,5 m; si no es estable, `zoomToCursor` se queda en `false` y el informe lo dice (fallback D-410).

### Pista I · `interaccion` · Depende de: F0 (T-420).

- [ ] T-440 [P] [US43] I: actualizar primero los specs que cuentan 5 ids/entradas y `ObjectInfo` con `kind` — `services/object-interaction.service.spec.ts`, `services/viewer-state.service.spec.ts`.
      _Aceptación_: specs verdes con los mismos casos (el recuento de casos no baja).
- [ ] T-441 [US43] I: `intersect` sobre una lista `pickables` (alta/baja de proxies, muebles, suelo y superficies) en vez de `scene.children`; superficies registrables con `kind: 'surface'` y su punto de impacto — `services/object-interaction.service.ts` + spec.
      _Aceptación_: tests: un proxy invisible (`visible = false`) recibe el rayo; los contornos siguen filtrados; ≥ 40 proxies no cambian el resultado del suelo.
- [ ] T-442 [US43] I: prioridad **pieza > pared > suelo** con ratón y con tolerancia táctil (impactos de los 17 rayos); piezas con varias cajas se resaltan todas; `groupOf(id)` — `services/object-interaction.service.ts` + spec.
      _Aceptación_: tests: tap a 10 px de una lámpara sobre una pared devuelve la lámpara; clic en pared sin pieza devuelve la pared; clic en suelo/alfombra devuelve `floorPoint`.
- [ ] T-443 [US42] I: `ViewerStateService`: señal `pieceState` por pieza (`power`, `index`, `spin`, `sound`) y `selectedKind`; estado inicial: solo `floorLamp` encendida — `services/viewer-state.service.ts` + spec.
      _Aceptación_: tests de estado inicial y de reinicio; sin `effect` que dispare detección de cambios por frame.

### Pista P1 · `piezas-datos` · Depende de: F0 (T-420, T-423 para ids).

- [ ] T-450 [P] [US41] P1: `pieces/pieces.config.ts`: las 35 piezas (id, grupo, orden, posición, rotación, tamaño, proxies con caja y rotación, orientación frontal, acciones, `pick: 'object'|'proxy'`) con los números de spec A.2 — `pieces/pieces.config.ts` + `pieces.config.spec.ts`.
      _Aceptación_: spec: 35 ids únicos en 6 grupos; todos con proxy o glTF; eje 1,60 ± 0,02 en láminas y espejo; ids == `piece-ids.ts`.
- [ ] T-451 [US43] P1: `pieces/surfaces.config.ts`: 4 paredes (normal, ancho 16, alto 4, centro) y techo (pose) — `pieces/surfaces.config.ts` + spec.
      _Aceptación_: spec: normales unitarias y hacia el interior; ids == `piece-ids.ts`.
- [ ] T-452 [US41] P1: test de colocación estático SC-412 con `Box3` (sin solapes entre piezas, muebles y paredes; pasillos ≥ 0,9 m; 0,02–0,06 m a pared) y de **no intrusión en los frustums iniciales** (escritorio 1,6 y 2,2; retrato) — `pieces/pieces.config.spec.ts`.
      _Aceptación_: el test falla si se mueve cualquier pieza nueva 0,5 m hacia un mueble o un cono (probado a mano una vez).

---

## Fase F2 — Geometría, acciones y lista (paralela ×3: P2, P3, U)

**Criterio de fase**: build/lint/test en verde; los builders y el runtime funcionan sin WebGL (tests con three real); la app aún no los carga.

### Pista P2 · `piezas-geo` · Depende de: F1 (T-450).

- [ ] T-460 [P] [US41] P2: `PiecesBuilderService.build(config, textures)`: zonas como `Group` (salón TV, trabajo, lectura, música, pared de la tele, techo) con fusión **por material y zona**, proxies compartidos, `dispose` completo — `pieces/pieces-builder.service.ts` + spec.
      _Aceptación_: tests: ≤ 56 mallas, ≤ 12 000 tris procedurales, 0 luces, `raycast` anulado en las fusionadas, cada zona con su `boundingSphere`; `dispose` libera geometrías/materiales/texturas (espías) y deja el grupo vacío.
- [ ] T-461 [US42] P2: builders de **TV** (marco de nogal con bisel, cristal, dos planos de pantalla, halo), **monitor** (pantalla con `CanvasTexture` dibujada una vez, peana) y **aparador de nogal** (cuerpo, 22 estrías, patas cónicas, libros y clon del jarrón) — `pieces/builders/{tv,monitor,credenza}.ts` + specs.
      _Aceptación_: pantalla/halo en mallas y materiales **separados** (accesibles por nombre); tris de cada builder ≤ su estimación + 25 %.
- [ ] T-462 [US41] P2: builders de **escritorio** (roble con la textura del suelo, cajón, patas), **lámparas** (flexo, de lectura, pantalla con material propio + halo + charco), **puerta** (hoja, paneles, cerco, manilla de latón), **espejo de arco**, **ficus** (maceta + 24 hojas curvas con textura de canvas, instanciado/fusionado), **estantes** (flotante, objetos de la estantería de cubos) y alfombras — `pieces/builders/{desk,lamps,door,mirror,plant,shelves,rugs}.ts` + specs.
      _Aceptación_: tests de dimensiones (±1 cm de spec A.2); material de pantalla de cada lámpara **único**; captura de la planta (T-453 la revisa).
- [ ] T-463 [US42] P2: builder del **tocadiscos** (plinto de nogal, plato como malla propia con disco y etiqueta, brazo con pivote, discos apoyados) — `pieces/builders/turntable.ts` + spec.
      _Aceptación_: plato y brazo con nombres `turntable:platter`/`turntable:arm`; tris ≤ 650.
- [ ] T-464 [US41] P2: carga de glTF nuevos y aplicación del tinte (armario crema, silla de roble) con `materialOverride` y `map: null` — `pieces/pieces-builder.service.ts` (consume `model-loader` por interfaz) + spec.
      _Aceptación_: test con modelo simulado: el override cambia color y anula el mapa sin tocar el original; fallo de carga devuelve `ViewerError` con código y nombre del activo.
- [ ] T-465 [US41] P2: cornisa perimetral fusionada (perfil escalonado) — `pieces/builders/cornice.ts` + spec.
      _Aceptación_: 1 malla, ≤ 220 tris, `receiveShadow`, sin raycast.

### Pista P3 · `piezas-acc` · Depende de: F1 (T-443, T-450).

- [ ] T-470 [P] [US42] P3: `PieceActionsRuntime.run(id, action)` y `update(dt)`: máquinas de estado de spec B.1 (TV con fundido y `TICK`, monitor, 3 lámparas, tocadiscos) aplicadas a mallas/materiales por nombre; sin trabajo por frame en reposo — `pieces/piece-actions.runtime.ts` + spec.
      _Aceptación_: tests SC-402 (todas las transiciones; `TICK` solo encendida y sin reducir movimiento; `SPIN_OFF` fuerza `muted`; estado inicial: solo `floorLamp`); `update` no se llama sin animación activa.
- [ ] T-471 [US42] P3: reducir movimiento: sin fundidos, sin `TICK`, plato quieto con brazo apoyado y estado «reproduciendo» — `pieces/piece-actions.runtime.ts` + spec.
      _Aceptación_: tests con `matchMedia` simulado a `reduce`.
- [ ] T-472 [US42] P3: `pieces/turntable-audio.ts`: Web Audio generativo (pad de 4 compases + crepitar, ≈ −24 dB), `AudioContext` creado en el gesto, fundidos, `visibilitychange`, `dispose` — `pieces/turntable-audio.ts` + spec.
      _Aceptación_: tests con `AudioContext` simulado: nada se crea hasta `SOUND_ON`; `dispose` cierra el contexto; fallo de inicio devuelve un resultado de error mostrable (constitución V); chunk ≤ 3 kB.
- [ ] T-473 [US42] P3: anuncios para `aria-live` (cadenas con `{work}`) y obra en pantalla de la TV, y orden de láminas — `pieces/piece-actions.runtime.ts` + spec.
      _Aceptación_: tests: `NEXT` actualiza el estado y el texto anunciado; no se anuncia en `TICK`.
- [ ] T-474 [US42] P3: halos y charcos de luz (opacidades, `depthWrite: false`, `toneMapped: false` en pantallas) y atenuación de la `PointLight` de la lámpara de pie — `pieces/piece-actions.runtime.ts` + spec.
      _Aceptación_: tests: opacidad 0 ↔ máximo; intensidad de la luz 2,2 ↔ 0; ninguna luz creada.

### Pista U · `ui-lista` · Depende de: F0 (T-421), F1 (T-440).

- [ ] T-480 [P] [US44] U: `ObjectListComponent` agrupado: acordeón (`aria-expanded`, un grupo abierto), fila «Ver pared», contador, etiqueta de estado, búsqueda (`role="search"`, sin acentos), `max-height` con scroll interno — `components/object-list/object-list.component.ts` + spec.
      _Aceptación_: tests: 6 grupos/35 entradas con datos de prueba; búsqueda «lam»/«lám» filtra igual; `Esc`/Tab/Intro; el grupo de la selección se abre solo.
- [ ] T-481 [US44] U: tira móvil de dos niveles (pestañas de zona + piezas de la zona) y `revealActive` acotado al `ul` (sin `scrollIntoView`) — mismo componente + spec.
      _Aceptación_: test: `scrollIntoView` no se llama al seleccionar en escritorio ni en móvil; `ul.scrollLeft` cambia en la tira.
- [ ] T-482 [US45] U: `viewer.component.scss`: `overflow: hidden; overflow: clip;`; `viewer.component.ts` pasa `groups`/`query` y enruta `viewSurface` y teclas de tramo — `components/viewer/**` + spec.
      _Aceptación_: test de estilo computado (`overflow: clip` con respaldo) y de enrutado; `npm run build` verde.
- [ ] T-483 [US44] U: mockups de la lista como referencia visual: comparar la implementación con `mockups/ui-list-*.png` (anchos 264 px y 390 px) y ajustar espaciado/estados — `components/object-list/**`.
      _Aceptación_: captura de la implementación en 1280×800 y 390×844 EN y ES sin cortes de texto a 360 px.

---

## Fase F3 — Cableado y paneles (paralela ×2: S, UP)

**Criterio de fase**: build/lint/test en verde; la escena carga la sala completa; la lista y la ficha funcionan con todas las piezas.

### Pista S · `escena` · Depende de: F2.

- [ ] T-488 [P] [US41] S: `SceneService`: `import()` perezoso de `pieces` junto a la carga de decor 3, textura de láminas E–H en el `LoadingManager` (progreso monótono), registro de proxies/glTF en `ObjectInteractionService`, reloj y jarrón existentes registrados (pasan de decorativos a seleccionables) — `services/scene.service.ts` + spec.
      _Aceptación_: tests con servicios simulados: 35 ids en `getObjectList()`; si falla el chunk o un modelo se muestra el aviso con reintento (constitución V) y la escena sigue.
- [ ] T-489 [US43] S: `selectObject(id)` para `SelectableId`: piezas (caja unión de proxies, orientación frontal), superficies (`focusSurface`, tramos), ejecución de la acción principal solo con origen puntero y estado apagado — `services/scene.service.ts` + spec.
      _Aceptación_: tests: clic en TV apagada → encendida; selección desde la lista → no se enciende; clic en pared → encuadre y la ficha no se cierra; clic en suelo → teletransporte.
- [ ] T-490 [US46] S: sombras estáticas (`shadowMap.autoUpdate = false`, `needsUpdate` tras cada carga), casters nuevos ≤ 6, matrices congeladas en lo estático — `services/scene.service.ts`, `services/model-loader.service.ts` (+specs).
      _Aceptación_: tests: `needsUpdate` se pide tras la carga y tras `loadPieces`; ningún `castShadow` fuera de la lista; frame del reposo sin `updateMatrixWorld` de estáticos.
- [ ] T-491 [US41] S: cornisa y nombres de superficie (`wall-back/left/front/right`, `ceiling`) en `RoomBuilderService`; `ModelLoaderService` admite `materialOverride.clearMap` — `services/room-builder.service.ts`, `services/model-loader.service.ts` (+specs).
      _Aceptación_: tests: nombres presentes; cornisa añadida y liberada en `dispose`; override sin mapa.

### Pista UP · `ui-ficha` · Depende de: F2.

- [ ] T-484 [P] [US42] UP: ficha con sección «Acciones» (`role="group"`, botones `aria-pressed` ≥ 44 px, «Siguiente lámina», estado del tocadiscos y del sonido con `aria-disabled` y pista), `aria-live` para anuncios — `components/description-panel/**` + spec.
      _Aceptación_: tests: Espacio/Intro ejecutan; el anuncio aparece en la región `aria-live`; «Sonido» deshabilitado si no gira.
- [ ] T-485 [US43] UP: ficha de **pared/techo**: nombre, descripción, «Tramo n de m» con botones solo si `m > 1`, anuncio «Pared verde, tramo 1 de 2» — `components/description-panel/**` + spec.
      _Aceptación_: tests con `m = 1` y `m = 2`; el cambio EN↔ES con la ficha abierta traduce todo.
- [ ] T-486 [US45] UP: `help-panel`: `focus({ preventScroll: true })` en el reabrir y texto de ayuda nuevo (clic activa, clic en pared encuadra, rueda hacia el cursor) — `components/help-panel/**` + spec.
      _Aceptación_: test: `focus` llamado con `{ preventScroll: true }`; paridad EN/ES; contraste AA.
- [ ] T-487 [US46] UP: **dieta**: `@defer (on idle)` para `description-panel`, `error-overlay`, `error-banner` (con `@placeholder` vacío) — `app.component.html`, `components/{error-overlay,error-banner}/**` solo si hace falta para tipos.
      _Aceptación_: `npm run build` verde; el inicial baja ≥ 5 kB frente a T-400; los tests de componentes siguen verdes (se prueban con `ComponentFixture` sin `@defer`).
- [ ] T-492 [US46] UP: medición de bundle final con `scripts/bundle-report.mjs` y propuesta de `angular.json` si procede — informe (y `angular.json` solo con permiso).
      _Aceptación_: **inicial ≤ 890 kB**; si no, informe con cifra y propuesta 900/910; chunks perezosos listados; transferido ≤ 220 kB.

---

## Fase F4 — Colocación fina (serial, `piezas-datos`)

- [ ] T-453 [US41] P1: con la app corriendo en local (`npm start`, **solo** en esta fase y con permiso del principal), capturas de cada zona; ajustar **rotaciones de glTF «≈»** (con la tabla de T-411), posiciones (≤ ±0,15 m), escala del aparador (0,6) y tinte del armario; revisar el contorno de selección sobre proxies y el ficus (puerta de calidad: si no pasa, sustituir por jarrón con ramas) — `pieces/pieces.config.ts`, `pieces/surfaces.config.ts` (+specs).
      _Aceptación_: capturas EN/ES de las 4 paredes sin solapes visibles ni piezas flotando; SC-412 sigue verde; informe con antes/después.
- [ ] T-454 [US42] P1: ajustar halos/charcos y emisivos con capturas (≤ 3 % de píxeles ≥ 250, calidez de la 003 intacta) y el orden de las 8 láminas de la TV — `pieces/pieces.config.ts` (+spec).
      _Aceptación_: métrica de SC-306 de la 003 repetida: techo, escena y saturación dentro de rango con todas las luces apagadas **y** encendidas.

---

## Fase F5 — Verificación (serial, `verif`)

- [ ] T-494 [US41] V: capturas SC-414 (EN y ES; 1280×800 y 390×844): vista inicial vs línea base (SC-400), vista B, 4 paredes y techo encuadrados, TV encendida, escritorio, rincón de lectura, tocadiscos, lista y ficha de pared — `docs/baseline/004-final-*`.
      _Aceptación_: diferencia de la vista inicial ≤ 1,5/255 fuera de la banda de la cornisa; cada captura listada en `verification.md`.
- [ ] T-495 [US46] V: rendimiento SC-406/407: frame ×4 en vistas A y B (10 pares ABAB), `__rtad.stats()` (tris, draw calls, texturas, luces, casters), `src/assets` — `verification.md`.
      _Aceptación_: mediana < 16,7 ms en A y en B; límites de SC-407; si falla, lista de palancas aplicadas (plan §3.5) y reintento.
- [ ] T-496 [US42] V: accesibilidad y contraste SC-403 (Lighthouse 100 EN/ES en móvil y escritorio con una ficha con acciones abierta; recorrido por teclado; `prefers-reduced-motion`), visor SC-411 (`verify-viewer-scroll.mjs` a 3 tamaños) — `verification.md`.
      _Aceptación_: Lighthouse 100 en las 4 combinaciones; script en verde; contrastes medidos.
- [ ] T-497 [US46] V: cierre: tabla SC-400…415 con valor medido y estado, incidencias abiertas y lista de preguntas de plan §8 aún sin respuesta — `specs/004-sala-completa/verification.md`.
      _Aceptación_: todos los SC cumplidos o con excepción justificada y firmada por el principal.

---

## Fase F6 — Documentación (serial, `docs`)

- [ ] T-498 [US41] D: README: sección de controles actualizada (clic en pieza, paredes, zoom), tabla de créditos con las 9 piezas Poly Haven (CC0) y las 4 láminas nuevas (obra, autor, año, fuente, licencia), cifras de rendimiento de la 004 — `README.md`.
      _Aceptación_: enlaces válidos; coincide con `docs/assets-pipeline.md` y con el código.
- [ ] T-499 [US41] D: media del README (`tour.gif`, `og.png` si cambian) con la sala completa — `docs/media/**`.
      _Aceptación_: pesos ≤ los de la 003 + 20 %; GIF sin parpadeos.
