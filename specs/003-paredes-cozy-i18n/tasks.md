# Tareas: Paredes decoradas, ambiente acogedor y español (i18n)

**Entrada**: [spec.md](./spec.md), [plan.md](./plan.md) · **Fecha**: 2026-11-23 · **Asume todas las recomendaciones de plan §7** (D-300…D-328).
**Formato**: `- [ ] T-3xx [P] [USn] Descripción — archivos`. `[P]` = paralelizable con otras tareas **de la misma fase** (archivos distintos).
**Reglas**: cada pista trabaja en **su propio worktree** (`Orq-Worktree.ps1 -Accion nuevo -Agente <pista>`) y toca **solo** los archivos de su columna; **un único dueño por archivo en cada fase** (un archivo puede cambiar de dueño entre fases: se indica); **máximo 3 agentes en paralelo**; integra su orquestador (`integrar`) cuando cumple los criterios de la fase. Entre integraciones: `npm run lint:check && npm run build && npm test` en verde (constitución I). Ningún agente hace commit/push/PR por su cuenta.
**Nada de `npm install`/dependencias nuevas**: las herramientas externas (Lighthouse, http-server, ImageMagick `magick`) van por `npx -y` o ya instaladas. Las descargas de assets van a una **carpeta temporal fuera del repo**, que se borra al acabar.
**Red de seguridad entre fases**: cada fase deja la app **funcionando en inglés idéntico al de hoy** hasta que F2 conecta el selector; `ui-text.ts` queda como fachada de `en.ts` hasta F3 (así ningún test ni componente se rompe en mitad de la migración).

## Pistas y dueños

| Pista                    | Nombre de agente | Archivos que posee (exclusivos, por fase)                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **V** Verificación       | `verif`          | `specs/003-paredes-cozy-i18n/{baseline,verification}.md`, capturas `docs/baseline/003-*`; `angular.json` **solo** si SC-301 lo exige (F5, con permiso del principal)                                                                                                                                                     |
| **A** Assets             | `assets`         | `src/assets/textures/art/**`, `src/assets/textures/fabric/**`, `docs/assets-pipeline.md` (F0)                                                                                                                                                                                                                            |
| **I** i18n núcleo        | `i18n`           | `src/app/i18n/**` (nuevo), `src/app/config/ui-text.ts` (→ fachada de `en.ts`), `src/app/config/ui-text.spec.ts` (se mantiene hasta F3), `src/main.ts`, `src/index.html`, `CONTRIBUTING.md` (F0)                                                                                                                          |
| **E** Luces y config     | `escena-luz`     | F1: `interfaces/scene.interface.ts`, `config/scene.config.ts` (+spec), `services/room-builder.service.ts` (+spec), `services/scene.service.ts` (+spec; solo el `toneMapping`). F4: `config/scene.config.ts` (solo ajuste de valores de luz) + spec                                                                       |
| **B** Decoración         | `decor`          | F1: `config/decor.config.ts`, `services/decor-builder.service.ts` (nuevos, + specs). F3: `config/decor.config.ts` (colocación fina)                                                                                                                                                                                      |
| **CA** Componentes A     | `ui-comp-a`      | `components/{loading-screen,error-banner,error-overlay,help-panel}/**` (ts + spec; añade `error-overlay.component.spec.ts`) (F1)                                                                                                                                                                                         |
| **CB** Componentes B     | `ui-comp-b`      | `components/{object-list,description-panel,brand-label,viewer}/**`, `components/language-switcher/**` (nuevo), `src/styles.scss` (solo un token si hace falta) (F2)                                                                                                                                                      |
| **S** Servicios y estado | `servicios`      | F2: `services/scene.service.ts`, `services/viewer-state.service.ts`, `services/object-interaction.service.ts` (solo tipos) + specs. F3: además `config/scene.config.ts`, `interfaces/scene.interface.ts`, `i18n/error-messages.ts` (+spec; quita el fallback), `config/ui-text.ts`, `config/ui-text.spec.ts` (se borran) |
| **D** Docs               | `docs`           | `README.md`, `docs/media/**` (F6)                                                                                                                                                                                                                                                                                        |

## Mapa de fases

```
F0 ┬ V  T-300 línea base ───────────────────────────────────────┐
   ├ A  T-310…313 láminas y lino (WebP) ─────────────────────────┤
   └ I  T-320…325 núcleo i18n (en/es/servicio/fachada) ──────────┴─► F1 ┬ E  T-330…334 luz cálida, tone mapping, eje 1,60
                                                                       ├ B  T-340…342 decor.config + DecorBuilderService
                                                                       └ CA T-350…352 loading, errores, ayuda
                                                                              │
                                              F2 ┬ S  T-360…363 decor perezoso, errores por código, id en ObjectInfo
                                                 └ CB T-370…374 selector, lista, ficha, marca, canvas
                                                       │
                                              F3 ┬ B  T-343 colocación fina (capturas)
                                                 └ S  T-364 limpieza (borra ui-text, campos de texto)
                                                       │
                                              F4 E  T-335 ajuste final de luz con la decoración puesta
                                                       │
                                              F5 V  T-390…396 verificación EN+ES ─► F6 D  T-380…381 README y media
```

| Fase | Depende de | Agentes en paralelo | Resumen                                                                                      |
| ---- | ---------- | ------------------- | -------------------------------------------------------------------------------------------- |
| F0   | —          | 3 (V, A, I)         | línea base **antes** de todo cambio visual; assets WebP; núcleo i18n sin efecto visible      |
| F1   | F0         | 3 (E, B, CA)        | luz cálida y eje; builder procedural aislado; componentes de carga/errores/ayuda traducibles |
| F2   | F1         | 2 (S, CB)           | cableado de la decoración y errores por código; selector y resto de componentes              |
| F3   | F2         | 2 (B, S)            | colocación con capturas; limpieza (sin `ui-text`)                                            |
| F4   | F3         | 1 (E)               | ajuste final de luz con la escena completa                                                   |
| F5   | F4         | 1 (V)               | verificación completa en EN y ES                                                             |
| F6   | F5         | 1 (D)               | README (créditos, i18n) y capturas finales                                                   |

---

## Fase F0 — Línea base, assets y núcleo i18n (paralela ×3)

**Criterio de fase**: `npm run lint:check && npm run build && npm test` en verde; **ningún cambio visual ni de texto en la app** (la app sigue en inglés idéntico).

### Pista V

- [ ] T-300 [P] [US32] V: con el repo de `orq/11221609` @ `4ea4c08`, `npm start` y: (1) capturas 1280×800 y 390×844 de carga, vista inicial, ayuda y ficha del sofá en `docs/baseline/003-base-*.png` (EN); (2) `window.__rtad.stats()` en la vista inicial (escritorio y móvil) → draw calls, triángulos, texturas, geometrías; (3) frame time mediana de 300 frames en móvil ×4 y escritorio (`baseline-capture.mjs --uncapped --prod`); (4) `du -sb src/assets`; (5) `npm run build` y el desglose (`npx ng build --stats-json` si hace falta); (6) Lighthouse accesibilidad y rendimiento (móvil y escritorio) sobre la build servida con `npx -y http-server dist/interior-viewer/browser -p 4173`; (7) las 4 regiones de SC-306 de la captura base (techo, escena) con `magick`. Todo a `specs/003-paredes-cozy-i18n/baseline.md`.
      _Aceptación_: `baseline.md` con cada cifra, fecha, equipo y comando; coinciden (± ruido) con `verification.md` de la 002 (assets 3 717 013 B; inicial 873,58 kB; techo luma 118 / R−B 17; escena luma 98 / R−B 30). **Sin él no empieza F1** (constitución II). Nota: Edge/Chrome headless con `--use-angle=swiftshader --enable-unsafe-swiftshader` si no hay GPU; ancho mínimo de ventana ≈ 500 px (para 390×844 usar emulación de dispositivo por CDP). Un solo navegador a la vez; cerrar al acabar (matar solo procesos cuya línea de comandos contenga el worktree).

### Pista A

- [ ] T-310 [P] [US31] A: descargar a una **carpeta temporal fuera del repo** las 4 imágenes de las láminas (URLs de `thumburl` de Commons con `iiurlwidth=1024`, ver spec A.3; sin ráfagas: la API de Commons limita las peticiones) y `rough_linen` 1K (difusa y `nor_gl`, URL de `https://api.polyhaven.com/files/rough_linen`); anotar el tamaño de cada original.
      _Aceptación_: tabla de tamaños de origen en el informe; coincide con spec D.1 (± 10 %); ningún original dentro del repo; licencia de cada archivo de Commons confirmada («CC0» o «Public domain») en su ficha.
- [ ] T-311 [P] [US31] A: generar `src/assets/textures/art/{spiraea,felce,osmunda,pteris}.webp` (recortes a 5:7 del área impresa y `-resize 512x717!`, calidad 85) y `src/assets/textures/fabric/{linen,linen-nor}.webp` (512×512, la difusa en escala de grises con `-colorspace Gray -level 20%,95%`, calidad 85) — `src/assets/textures/**`.
      Recortes de partida (sobre los JPG de 1280 px): Spiraea `1190x1666+45+72`, Felce `922x1291+190+60`, Osmunda `1230x1722+25+80`, Pteris `1150x1610+65+60`.
      _Aceptación_: `magick identify` da 512×717 y 512×512; `du -b`: A ≤ 81 KB, B ≤ 27 KB, C ≤ 51 KB, D ≤ 124 KB (o ≤ 95 KB si se baja a q80), lino ≤ 44 KB, normal ≤ 34 KB; revisión visual de que no queda marco dorado ni borde de libro en ninguna lámina.
- [ ] T-312 [P] [US31] A: reescribir en `docs/assets-pipeline.md` una sección «Wall prints and fabric» con fuentes (URLs), licencias, autores, los comandos exactos de T-311 y los pesos medidos.
      _Aceptación_: un tercero reproduce los 6 ficheros con solo esa sección (probado una vez por A sobre una copia).
- [ ] T-313 [US31] A: verificar presupuesto: `du -sb src/assets` ≤ 4 194 304 B (previsto ≈ 4 004 719); `git status` solo muestra los 6 ficheros nuevos y `docs/assets-pipeline.md`; sin PNG/JPG.
      _Aceptación_: cifras en el informe de la tarea.

### Pista I

- [ ] T-320 [P] [US33] I: `src/app/i18n/messages.ts`: `Locale`, `LOCALES`, `interface Messages` (bloques `meta`, `brand`, `loading`, `errors` con `messages.{context-lost,webgl-unavailable,render-failed,model-load-failed,locale-load-failed}`, `panel`, `list`, `help` con `controls: readonly [ControlText ×6]`, `language`, `canvasLabel`, `assets`, `furniture`), `FurnitureId`, `AssetLabelId`, `ViewerErrorCode`; y `en.ts` con **todas** las cadenas actuales (mismo texto que hoy) y las claves nuevas de spec C.5 — `src/app/i18n/{messages,en}.ts`.
      _Aceptación_: `npm run build` verde; los textos EN de `en.ts` son idénticos a los de `ui-text.ts` (test `en.spec.ts` los compara con `UI_TEXT`/`FURNITURE_TEXT`).
- [ ] T-321 [P] [US33] I: `es.ts` con la tabla de spec C.5 (`export default ES satisfies Messages`) y `messages.spec.ts` (nuevo; sustituirá a `ui-text.spec.ts`): paridad de claves recursiva EN/ES, `help.controls.length === 6` en ambos, reglas de copy por idioma (EN ≤ 2 frases y ≤ 30 palabras; ES ≤ 2 frases y ≤ 34; lista negra por idioma de spec C.4), `canvasLabel` sin nombres de muebles — `src/app/i18n/es.ts`, `src/app/i18n/messages.spec.ts`.
      _Aceptación_: `npm test -- --include "**/messages.spec.ts"` verde; si se quita una clave de `es.ts`, **no compila** (comprobado a mano una vez).
- [ ] T-322 [P] [US33] I: `format.ts`: `pct(value, locale)` (`Intl.NumberFormat` percent: EN «7%», ES «7 %» con U+00A0), `list(items, locale)` (`Intl.ListFormat`), `fill(template, params)` (`{names}`), `collator(locale)` — `src/app/i18n/format.ts` + spec.
      _Aceptación_: tests de los dos idiomas; `pct(7,'es')` contiene ` `.
- [ ] T-323 [US33] I: `locale.service.ts`: `LocaleService` (`locale`, `messages`, `announcement`, `setLocale`, `init`), `detectLocale(languages)`, persistencia con `try/catch` (`room-tour.locale`, solo al elegir), carga perezosa del ES con fallback a EN + aviso, `effect` para `lang`, `title`, `meta[name=description]`; `src/app/i18n/testing.ts` con `provideLocale('en'|'es')` — `src/app/i18n/{locale.service,testing}.ts` + spec.
      _Aceptación_: tests: los 6 casos de detección de spec C.2; valor guardado válido/inválido; `localStorage` que lanza (`getItem` y `setItem`); `setLocale('es')` con `import()` rechazado deja `en` y `announcement` sin cambio y emite el aviso; `document.documentElement.lang`, `document.title` y `meta` cambian; no se escribe al detectar.
- [ ] T-324 [P] [US33] I: `error-messages.ts`: `errorText(messages, {code, params?, message?})` traduce por código; con `params.names` (ids de `assets`/`furniture`) los traduce y une con `list()`; si falta el código o el `params` necesario usa `message` (compatibilidad hasta F3) — `src/app/i18n/error-messages.ts` + spec.
      _Aceptación_: tests por código en EN y ES; fallback cubierto.
- [ ] T-325 [US33] I: `ui-text.ts` pasa a **fachada** de `en.ts` (`UI_TEXT` y `FURNITURE_TEXT` como vistas de `EN`, mismas formas y **misma identidad de objeto** de `FURNITURE_TEXT[id]`), `app.config`/`main.ts`: `provideAppInitializer(() => inject(LocaleService).init())`; `index.html`: `<noscript>` con dos párrafos con `lang`; `CONTRIBUTING.md`: «Keep user-facing text in `src/app/i18n/` (EN in `en.ts`, ES in `es.ts`)» — `src/app/config/ui-text.ts`, `src/main.ts`, `src/index.html`, `CONTRIBUTING.md`.
      _Aceptación_: `npm run lint:check && npm run build && npm test` verde **sin tocar ningún otro spec**; `ui-text.spec.ts` sigue verde; en un navegador con idioma `es` el initializer espera el chunk y `<html lang>` queda en `es` (comprobación manual una vez; los textos aún en inglés porque los componentes no están migrados).

**Gate de F0**: baseline listo (T-300), assets dentro de presupuesto (T-313), `npm run lint:check && npm run build && npm test` verde, y el recuento de casos de Vitest no baja.

---

## Fase F1 — Luz cálida, builder aislado y componentes de carga (paralela ×3: E, B, CA)

### Pista E — Escena: luz, renderer y alturas · Depende de: F0.

- [ ] T-330 [P] [US32] E: tipos `HemisphereLightConfig`, `PointLightConfig`, `RendererConfiguration`; `LightingConfiguration` incorpora `hemisphere` y `point[]`; `SceneConfiguration.renderer`; `ObjectInfo` gana `id: FurnitureId` (**aditivo**, los campos de texto se conservan) — `interfaces/scene.interface.ts`.
      _Aceptación_: `npm run build` verde; ningún consumidor roto.
- [ ] T-331 [US32] E: valores de spec B.2: colores/intensidades de ambiente, sol, focos, `hemisphere`, `point` (lámpara), `renderer: { toneMapping: 'neutral', exposure: 1 }`; `roomColors.ceiling` `#f1e2cf`; tinte de la alfombra `#ffd9b3`; `landscapePainting.yOffset` 1,14 y `DECOR_CONFIGURATIONS.clock.yOffset` 1,28; `metadata` de `MODEL_CONFIGURATIONS` incorpora `id` — `config/scene.config.ts`, `scene.config.spec.ts`.
      _Aceptación_: spec de config actualizada: centro del cuadro = 1,60 ± 0,02 y del reloj = 1,60 ± 0,02, `lighting.point.length === 1`, ninguna luz nueva con `castShadow`.
- [ ] T-332 [US32] E: `RoomBuilderService.buildLighting` crea `HemisphereLight` y `PointLight` desde la config (sin sombra) y los libera en `dispose`; techo y alfombra con los colores nuevos — `services/room-builder.service.ts` + spec.
      _Aceptación_: tests: el recuento de luces del grupo es 7 (ambiente, hemisférica, sol, 3 focos, 1 puntual), la única con `castShadow` es el sol; `dispose` deja `scene.children = 0`.
- [ ] T-333 [US32] E: `SceneService.initialize` aplica `renderer.toneMapping = NeutralToneMapping` y `toneMappingExposure` desde la config (mapa `'neutral' | 'aces' | 'none'`) — `services/scene.service.ts` + spec (solo esa línea y su test).
      _Aceptación_: test con renderer simulado comprueba `toneMapping === NeutralToneMapping` y la exposición; `git diff --stat` solo toca esas líneas de `scene.service.ts`.
- [ ] T-334 [US32] E: pasada de captura inicial: con los valores de partida, tomar capturas 1280×800 y 390×844 de la vista inicial y calcular las regiones de SC-306; ajustar solo los números de `scene.config.ts` (exposición 0,95–1,15; ambiente/hemisférica) hasta cumplirlo **sin la decoración nueva** (el tuning final es T-335) — `config/scene.config.ts`.
      _Aceptación_: informe con capturas antes/después y las 4 cifras de SC-306; techo luma 120–160 y R−B ≥ 30; escena luma ≥ 90; píxeles ≥ 250 ≤ 3 %.

### Pista B — Decoración procedural (aislada) · Depende de: F0 (nombres de textura).

- [ ] T-340 [P] [US31] B: `config/decor.config.ts` (nuevo): interfaz `Decor3Config` y constante `DECOR3` con **todas** las piezas de spec A.2 y B.3 (posición, rotación, medidas, colores, intensidades, rutas `assets/textures/art/*.webp` y `fabric/*`) y la lista de claves de carga `art:<id>`/`fabric:<id>` — `config/decor.config.ts` + `decor.config.spec.ts`.
      _Aceptación_: spec: 4 láminas, 2 apliques, 1 ventana, 2 paños, 1 lámpara, 2 cojines, 1 manta; eje 1,60 ± 0,02 en las láminas; apliques 1,70; ninguna lámina en z = +8 ni con `|x| > 8`; sumas de tamaño coherentes con spec A.1.
- [ ] T-341 [US31] B: `services/decor-builder.service.ts` (nuevo): `DecorBuilderService.build(config, textures): { group, dispose }` con `wall-art`, `fixtures`, `textiles`; fusión por material (`mergeGeometries`), halos aditivos (`depthWrite:false`), degradado del cristal y radial de halos como `CanvasTexture`, lino con `map` + `normalMap` y tinte, raycast anulado, `castShadow = false`, `toneMapped:false` en cristal y halos — `services/decor-builder.service.ts` + spec.
      _Aceptación_: tests con three real (sin WebGL): nº de mallas ≤ 20, triángulos ≤ 9 000, todas con `raycast` anulado, ninguna `castShadow`; `dispose` libera todas las geometrías/materiales/texturas (contadores `dispose` de espías) y deja el grupo vacío; funciona sin texturas (color plano) si se le pasan `null`.
- [ ] T-342 [US31] B: test de colocación SC-307 (parte estática): `Box3` de cada pieza con la config: sin intersecciones entre piezas ni con las AABB de los muebles (estantería, mesa, caja del sofá de spec plan §1), marcos y cortinas a 0,02–0,06 m del muro, lámpara a ≥ 1,0 m del sofá y de ambos muros — `services/decor-builder.service.spec.ts`.
      _Aceptación_: el test falla si se mueve cualquier pieza 0,5 m hacia un mueble o un muro (probado a mano una vez).

### Pista CA — Componentes de carga, errores y ayuda · Depende de: F0 (T-320…325).

- [ ] T-350 [P] [US33] CA: `loading-screen`: `text = computed(() => i18n.messages().loading)`; porcentaje con `pct()` (visible y `aria-valuetext`); spec con `describe.each(LOCALES)` — `components/loading-screen/**`.
      _Aceptación_: EN igual que hoy («Loading the room · 7%»); ES «Cargando la sala · 7 %» (espacio U+00A0).
- [ ] T-351 [P] [US33] CA: `error-banner` y `error-overlay` muestran `errorText(messages, error)` (código + params; mensaje como fallback); títulos y «Reintentar» desde el diccionario; **añadir** `error-overlay.component.spec.ts` (hoy no existe) — `components/{error-banner,error-overlay}/**`.
      _Aceptación_: tests por código y por idioma; el cambio de idioma con el error visible lo retraduce; el botón de reintento conserva su comportamiento.
- [ ] T-352 [P] [US33] CA: `help-panel`: `text` computado; `controls` y `touchLabel`/`touchText` por idioma; aserciones de especificación por palabra pasan a comparar con `messages[locale].help` (no con regex en inglés); `localStorage` de la ayuda sin cambios — `components/help-panel/**`.
      _Aceptación_: tests en EN y ES (táctil y no táctil); `aria-modal`, foco y `Esc` intactos; la hoja no desborda a 360 px con las cadenas ES (captura).

**Gate de F1**: `npm run lint:check && npm run build && npm test` verde; capturas de E (T-334) con SC-306 cumplido; la app sigue funcionando (la decoración aún no está cableada; es normal).

---

## Fase F2 — Cableado de la escena y componentes restantes (paralela ×2: S, CB)

### Pista S — Servicios y estado · Depende de: F1 (E, B) y F0 (I).

- [ ] T-360 [P] [US31] S: `SceneService.loadDecor3()`: `await import('./decor-builder.service')` (chunk perezoso), carga de las texturas `art:*` y `fabric:*` con el `LoadingManager` existente, `DecorBuilderService.build(DECOR3, …)`, grupo `decor3` en la escena, claves en `publishProgress`; fallo de textura → aviso no bloqueante y color plano; `retryLoad` la reintenta; `dispose` — `services/scene.service.ts` + spec.
      _Aceptación_: tests: el estado no pasa a `ready` hasta terminar; progreso monótono hasta 100 con `art:*`/`fabric:*`; `getObjectList()` sigue siendo 5 ids; `ObjectInteractionService` ignora (raycast) todas las mallas de `decor3`; `dispose` libera; un `import()` rechazado muestra el aviso y la escena sigue.
- [ ] T-361 [P] [US33] S: `ViewerError` gana `params?: { names?: string[] }`; `SceneService` emite `params.names` con **ids** de `assets`/`furniture` (hoy etiquetas); el `message` EN se conserva (se retira en F3) — `services/viewer-state.service.ts`, `services/scene.service.ts` + specs.
      _Aceptación_: tests de `model-load-failed` comprueban código y `params.names` (ids), no texto; `message` sigue presente.
- [ ] T-362 [US33] S: `ObjectInteractionService` y `selected` usan `ObjectInfo.id`; `getObjectList()` devuelve `{ id, name }` (el `name` EN se conserva hasta F3) — `services/object-interaction.service.ts` (tipos) + specs.
      _Aceptación_: `selectObject('sofa')` publica `{ id: 'sofa', … }`; la selección por teclado sigue igual.
- [ ] T-363 [US31] S: medir el coste de dibujo de la decoración con `__rtad.stats()` (dev) en la vista inicial y anotar el delta en el informe; si supera SC-303, anotarlo para que B ajuste la fusión en T-343 (el builder es de B) — informe.
      _Aceptación_: delta de draw calls ≤ +34 y mallas nuevas ≤ 20 (SC-303); sin ciclos de `tick` en reposo.

### Pista CB — Componentes B, selector y marca · Depende de: F0 (I) y F1 (`ObjectInfo.id` de T-330).

- [ ] T-370 [P] [US34] CB: `components/language-switcher/language-switcher.component.ts` (+spec): `role="group"` con `aria-label` traducido; dos `<button type="button">` EN/ES con `lang`, `aria-pressed`, `aria-label` «English (EN)»/«Español (ES)»; `role="status"` oculto con `announcement`; foco interior (`outline: 2px solid var(--ink); outline-offset: -4px`, pulsado `outline-color: var(--paper)`); 44 px; sin transiciones con `prefers-reduced-motion`.
      _Aceptación_: tests: clic cambia `locale` y `aria-pressed`; el foco no se mueve; el anuncio solo aparece tras un cambio (no al crear el componente); accesibilidad por Tab/Intro/Espacio; contraste 7,26:1 y 3,49:1 (script de contraste).
- [ ] T-371 [US33] CB: `brand-label` (texto traducible; deja de posicionarse solo: lo coloca el contenedor `.corner` del visor) y `viewer.component.{ts,html,scss}`: contenedor `.corner` abajo-izquierda con `[selector][marca]` (escritorio, en fila) y apilado (selector encima) en ≤ 600 px; `canvasLabel` computado; la lista de piezas se construye con `getObjectList()` (ids) + `messages().furniture[id].name` ordenada con `collator(locale)` — `components/{brand-label,viewer}/**`.
      _Aceptación_: capturas EN/ES a 1280×800, 390×844 **y 360×640**: el selector no toca «Controls/Controles» ni la placa; tests de `viewer` en ambos idiomas (orden ES: Cuadro de paisaje, Estantería, Mesa de póker, Sofá rinconera, Suculenta en maceta).
- [ ] T-372 [P] [US33] CB: `object-list` (texto y `aria-label` desde el diccionario; el chip activo se conserva por `id` al cambiar de idioma; reordenación sin perder el foco) — `components/object-list/**`.
      _Aceptación_: tests por idioma; con un chip enfocado, cambiar de idioma no mueve el foco fuera de la lista.
- [ ] T-373 [P] [US33] CB: `description-panel`: nombre, descripción y crédito de `messages().furniture[info.id]`; la región `aria-live` se actualiza al cambiar de idioma sin re-anunciar la apertura; `panel.close` traducido — `components/description-panel/**`.
      _Aceptación_: con la ficha del sofá abierta, `setLocale('es')` cambia título, texto y crédito a la vez; el foco del botón de cierre no cambia.
- [ ] T-374 [US33] CB: capturas EN y ES de la ficha (sofá y suculenta) y de la lista a 390 px para detectar desbordes; ajustar solo CSS propio — capturas en el informe.
      _Aceptación_: sin recortes de texto; `overflow-wrap` activo en `dt/dd` y en la ficha.

**Gate de F2**: `npm run lint:check && npm run build && npm test` verde; en un navegador con el selector se cambia EN↔ES en caliente (ficha abierta, ayuda abierta, error simulado); la decoración se carga (colocación aún provisional); `renderer.info` dentro de SC-303.

---

## Fase F3 — Colocación fina y limpieza (paralela ×2: B, S)

### Pista B — Colocación (`decor`)

- [ ] T-343 [US31] B: con capturas del render real, fijar posición/rotación de cojines y manta con la **AABB real del sofá** cargado (test), afinar apliques, halos, cortinas, ventana y lámpara contra spec A.2; ajustar solo `decor.config.ts` — `config/decor.config.ts` (+ spec).
      _Aceptación_: SC-307 en verde con la AABB **real** (no la aproximada); capturas 1280×800 y 390×844 de la vista inicial, del muro del fondo, de la ventana y del sofá; sin pieza flotante ni atravesada.

### Pista S — Limpieza (`servicios`)

- [ ] T-364 [US33] S: retirar los campos de texto: `ObjectInfo = { id }`; `getObjectList(): { id }[]`; `MODEL_CONFIGURATIONS[id].metadata` desaparece (queda `id`); `ViewerError` sin `message`; `label()` devuelve ids; **borrar** `config/ui-text.ts` y `ui-text.spec.ts` (sustituidos por `i18n/`); quitar el fallback `message` de `errorText` — `scene.config.ts`, `scene.interface.ts`, `scene.service.ts`, `viewer-state.service.ts`, `i18n/error-messages.ts`, `ui-text*.ts` + specs.
      _Aceptación_: `grep -rn "ui-text" src` → 0; `grep -rn "FURNITURE_TEXT\|UI_TEXT" src` → 0; `npm run lint:check && npm run build && npm test` verde; el recuento de casos de Vitest no baja (los de `ui-text.spec` ya viven en `messages.spec`).

**Gate de F3**: SC-307 cumplido con la AABB real; repo verde; sin `ui-text`.

---

## Fase F4 — Luz final (serial, `escena-luz`)

- [ ] T-335 [US32] E: con la decoración integrada y colocada, repetir la medición de SC-306 y ajustar **solo números** de `config/scene.config.ts` (lámpara 1,5 → ≤ 2,5; exposición 0,95–1,15; ambiente/hemisférica) hasta cumplirlo con la escena completa — `config/scene.config.ts` + spec.
      _Aceptación_: informe con antes/después, las 4 cifras de SC-306, y frame time móvil ×4 < 16,7 ms (una pasada rápida de `baseline-capture.mjs`); `npm run lint:check && npm run build && npm test` verde.

**Gate de F4**: SC-306 cumplido con la escena completa.

---

## Fase F5 — Verificación (serial, `verif`)

- [ ] T-390 [US32] V: método de la 002 con el repo final: `window.__rtad.stats()` (draw calls, triángulos, texturas) antes/después → SC-303; frame time móvil ×4 (20 pares, `--uncapped --prod`) y escritorio → SC-302; `du -sb src/assets` → SC-300; VRAM por textura (cálculo con `renderer.info.memory`) → SC-303.
      _Aceptación_: cifras en `verification.md`; mediana móvil < 16,7 ms.
- [ ] T-391 [US33] V: `npm run build`: tamaño inicial y de los chunks perezosos → SC-301; si > 880 kB, subir el aviso a 890 kB en `angular.json` **con permiso del principal** y la cifra en el mensaje del commit.
      _Aceptación_: `ng build` sin avisos; ES y decor builder aparecen como chunks aparte.
- [ ] T-392 [US34] V: Lighthouse accesibilidad en móvil y escritorio **en EN y en ES** (`--lang=es` / `Accept-Language`), contraste AA con `contrast-b7.mjs` (selector, ayuda y ficha en ES), foco visible del selector, orden de tabulación.
      _Aceptación_: accesibilidad **100** en los 4 casos; sin `label-content-name-mismatch`; tabla de contrastes en `verification.md`.
- [ ] T-393 [US33] V: i18n funcional por CDP: (1) primera pintura en ES con `--lang=es` (captura al primer fotograma, sin inglés); (2) cambio EN↔ES con ficha abierta **sin navegación**; (3) persistencia tras recargar con otro idioma de navegador; (4) `localStorage` bloqueado; (5) ES con red cortada (chunk que falla) → aviso y EN; (6) `<html lang>`, título y meta tras cada cambio.
      _Aceptación_: 6/6 en `verification.md` con la evidencia (capturas o salida de CDP).
- [ ] T-394 [US31] V: capturas EN y ES a 1280×800 y 390×844 de carga, vista inicial, ayuda, ficha del sofá, ficha de la suculenta, muro del fondo y ventana → `docs/baseline/003-final-*`; comparación con `002-final-*` con las diferencias intencionadas anotadas (constitución II).
      _Aceptación_: lista de diferencias, ninguna no intencionada; las láminas se leen en la vista inicial de escritorio.
- [ ] T-395 [US32] V: SC-306 con las capturas finales (comando de abajo) y regresión por inspección: sofá, mesa y estantería sin cambios de forma; sombras iguales.
      _Aceptación_: las 4 cifras dentro de rango.
- [ ] T-396 [US33] V: ejecutar `npm run lint:check && npm run build && npm test` y recuento de casos de Vitest; revisar con un hablante de español la tabla C.5 (marcar en el informe lo que Paco debe validar).
      _Aceptación_: verde; informe de cadenas con dudas.

Comando de SC-306 (sobre una captura `cap.png` de 1280×800 de la vista inicial):

```bash
for r in "700x120+300+10:techo" "990x580+260+120:escena"; do
  geo=${r%%:*}; n=${r##*:}
  echo "$n $(magick cap.png -crop $geo +repage -colorspace sRGB \
    -format '%[fx:int(255*mean.r)],%[fx:int(255*mean.g)],%[fx:int(255*mean.b)] luma=%[fx:int(255*(0.2126*mean.r+0.7152*mean.g+0.0722*mean.b))]' info:)"
done
magick cap.png -crop 990x580+260+120 +repage -fx "(r>0.98&&g>0.98&&b>0.98)?1:0" -format "saturados=%[fx:mean*100]%%\n" info:
```

---

## Fase F6 — Documentación (serial, `docs`)

- [ ] T-380 [US31] D: `README.md`: tabla de créditos ampliada (láminas A–D con autor, año, fuente, licencia/dominio público; lino de Poly Haven CC0), sección «Languages» (detección, selector, dónde están los diccionarios, cómo añadir una clave o un idioma, qué queda en inglés: OG/Twitter), nota de que no hay piezas CC-BY — `README.md`.
      _Aceptación_: cada lámina del repo tiene su crédito; `grep -n "Atkins\|Talbot" README.md` ≥ 4 líneas; los comandos documentados existen.
- [ ] T-381 [US31] D: copiar a `docs/media/` las capturas finales elegidas (EN y ES) y actualizar `README.md` para enlazarlas; regenerar `tour.gif` si la composición visible cambió — `docs/media/**`.
      _Aceptación_: las imágenes del README existen y miden lo declarado; `npm run lint:check` verde.

**Gate de F6**: PR #3 actualizado por el principal con las cifras de `verification.md` en la descripción; nada a `main`.
