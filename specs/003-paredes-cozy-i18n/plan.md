# Plan de implementación: Paredes decoradas, ambiente acogedor y español (i18n)

**Rama**: `orq/11221609` · **Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23 · **Estado**: borrador para aprobación (el principal aprueba con las recomendaciones de §7; las preguntas de §8 no bloquean).

## 1. Contexto técnico y datos verificados

| Dato                              | Valor                                                                                                                                                                                                                                  | Fuente                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Angular / builder / zona          | 21.2.x, `@angular/build:application`, zoneless (`provideZonelessChangeDetection`), componentes OnPush con señales                                                                                                                      | `package.json`, `src/main.ts`, `explorador-i18n3`                                          |
| Budgets iniciales                 | aviso 880 kB, error 900 kB; actual **873,58 kB** brutos / 195,23 kB transferidos → margen **6,4 kB** al aviso, 26,4 kB al error                                                                                                        | `angular.json`, `review.md:469`                                                            |
| Cadenas                           | `UI_TEXT` 38 + `FURNITURE_TEXT` 15 + ≈ 12 fuera del diccionario (errores de `scene.service.ts:145,171,295,475`, etiquetas de `scene.config.ts`, frase de `description-panel`) + `index.html` (lang, title, meta, noscript) ≈ **72–80** | `explorador-i18n3` §1                                                                      |
| Estado traducible hoy             | `ObjectInfo` con `name/description/details` ya resueltos en `MODEL_CONFIGURATIONS.metadata` (identidad de referencia comprobada en tests); `ViewerError.message` es texto; `getObjectList()` devuelve `{id, name}`                     | `scene.config.ts`, `viewer-state.service.ts`, `scene.service.ts:591`                       |
| Luces / renderer                  | ambiente 0,7; sol 1,3 con sombra 2048²; 3 focos sin sombra (2 de acento `#ffffff`); `toneMapping` sin asignar; techo gris (luma 118, R−B 17)                                                                                           | `scene.config.ts:37-87`, `scene.service.ts:71-76`, captura `002-final-desktop-initial.png` |
| Paredes                           | solo el fondo tiene piezas (cuadro −4, estantería 0, reloj +4; jarrón −1,85, suculenta +1,85); laterales y frontal vacíos                                                                                                              | `explorador-escena3` §1                                                                    |
| Visibilidad                       | escritorio: fondo entero y laterales solo z < −3,35; retrato: fondo hasta x ≈ +2 y pared izquierda, **no** la derecha; la frontal nunca                                                                                                | cálculo con la cámara inicial; `mockups/walls.png`                                         |
| Caja de los muebles (de los glTF) | sofá local 3,895 × 1,332 × 3,591 (girado π/4 en (−3, −3): x, z ∈ [−5,65; −0,35]); mesa 1,304 × 1,089 × 1,304; estantería 1,829 × 2,134 × 0,394                                                                                         | cálculo propio sobre `scene.gltf` (acceso a `min/max`, composición de nodos)               |
| Medidas de la 002                 | frame time móvil ×4 **7,4 ms**; draw calls 168 (dev, escritorio); +14 006 tris de geometría; assets **3 717 013 B**                                                                                                                    | `verification.md`, `explorador-escena3` §4                                                 |
| Herramientas                      | Poly Haven API y Wikimedia Commons accesibles; el CDN `images.metmuseum.org` devuelve un desafío HTML a clientes automáticos; ImageMagick 7.1.2 para medir WebP                                                                        | pruebas de esta corrida                                                                    |

## 2. Principios de la constitución aplicados

I (repo verde en cada integración), II (capturas antes/después en EN y ES; F0 toma la línea base **antes** de cualquier cambio visual), III (selector con `role`, foco, `aria-live`; `lang` correcto; contraste AA), IV (todo `CanvasTexture`, geometría y material nuevos se liberan en `dispose`; sin trabajo por frame nuevo), V (si el ES no carga: aviso visible, no silencio; si una textura falla: aviso y color plano), VI (commits convencionales; un test por cada arreglo de lógica), VII (sin dependencias, sin red nueva: el ES va en un chunk propio y las láminas son locales).

## 3. Enfoques considerados

### 3.1 i18n (D-300)

| Enfoque                                                  | Cambio en caliente                                  | Coste en el bundle inicial                                                                              | Esfuerzo                                                                                                                             | Veredicto                                    |
| -------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| **A. `@angular/localize` nativo**                        | **No**: un build por idioma, cambio por URL/recarga | runtime de `$localize` (≈ pocos kB, sin medir) y `polyfills` nuevo                                      | Alto: `i18n` en cada plantilla, `extract-i18n`, 2 artefactos, `vercel.json` y `<base href>` por idioma (hoy no existe `vercel.json`) | Rechazado: no cumple «sin recargar»          |
| **B. Capa propia con señales + diccionario ES perezoso** | **Sí** (señales + OnPush + zoneless)                | **+3–5 kB** estimados (servicio, selector, tipos); EN ya está en el bundle; ES ≈ 7–9 kB en chunk aparte | Medio: refactor de 8 componentes y de 3 servicios (`ObjectInfo` → id, `ViewerError` → código)                                        | **Elegido**                                  |
| C1. `@ngx-translate/core` v18                            | Sí                                                  | ≈ 31 kB min (8,2 kB gzip) por bundlephobia → rompe el aviso (margen 6,4 kB)                             | Medio                                                                                                                                | Rechazado por peso                           |
| C2. Transloco                                            | Sí                                                  | no verificado (el README no da cifra ni confirma zoneless)                                              | Medio                                                                                                                                | Rechazado: riesgo sin medir                  |
| D. JSON en `assets/` cargado por `fetch`                 | Sí                                                  | ≈ 1 kB                                                                                                  | Medio + una petición de red extra y sin tipos que fuercen la traducción                                                              | Rechazado: pierde la garantía de compilación |

**Por qué B**: mantiene el estilo del repo (señales, standalone, sin zona), da el tipo `Messages` que **obliga** a traducir cada clave (`satisfies`), y el único coste real es el refactor de cadenas, que se hace de todos modos con cualquiera de las opciones. **Alternativa**: C2 si en el futuro hubiera ≥ 4 idiomas (se medirá con un spike `npm view @jsverse/transloco` + build en rama).

### 3.2 Piezas de pared (D-310, D-312)

Se inspeccionaron las **miniaturas** de Poly Haven de los candidatos del especialista (`mockups` no las incluye; descargas temporales borradas):

| Candidato                                                | Resultado de la inspección                                                                                              | Decisión                                                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `hanging_picture_frame_01` (marco negro)                 | marco negro liso con texto de maqueta impreso («Ray Homes»); 0,23 MiB estimados                                         | **Procedural** (misma forma, 0 B, tamaño y proporción a medida, láminas intercambiables)                       |
| `ornate_mirror_01` (espejo arqueado)                     | el «cristal» es un reflejo horneado, borroso y oscuro; sin `envMap` real un espejo en three se ve gris plano; 14 k tris | **Descartado** (D-312). Alternativa: incluirlo si Paco lo pide (≈ 0,33 MiB est.) aceptando el cristal horneado |
| `throw_pillows_01` (cojines)                             | zigzag rojo/naranja/ocre de alto contraste: **no sobrio**, choca con el terracota del sofá                              | **Procedural** liso en crema y salvia                                                                          |
| `vintage_oil_lamp`                                       | estilo victoriano; 1,24 MiB a 1K                                                                                        | **Procedural** (lámpara de pie de latón y lino)                                                                |
| Estante flotante, planta colgante, cortina, tapiz, manta | no existen en Poly Haven (verificado por el especialista)                                                               | Cortina y manta **procedurales**; estante, planta y tapiz **fuera de alcance**                                 |

Coste de lo procedural: ≈ 400–500 líneas de TypeScript (builder + config + tests) y ≈ 7 200 tris frente a ≈ 1,3 MiB de glTF/texturas; riesgo de «aspecto de caja»: mitigado con chaflanes, pliegues senoidales y texturas de lino (§B.3 de la spec). **Alternativa** (D-310): modelos Poly Haven para marcos y cojines (+ ≈ 0,45 MiB, − ≈ 1 día de código) — peor control de paleta.

### 3.3 Tone mapping (D-320)

| Opción                                 | Efecto sobre la paleta                                                | Veredicto                                      |
| -------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Ninguno (hoy)                          | alto contraste y brillos recortados con luces cálidas más intensas    | no                                             |
| **`NeutralToneMapping`** (PBR Neutral) | conserva tono y saturación de albedos; solo comprime brillos          | **Elegido**, exposición 1,0 (ajuste 0,95–1,15) |
| `ACESFilmicToneMapping`                | desatura y desplaza rojos; oscurece medios → exige exposición 1,2–1,4 | alternativa (D-320)                            |
| `AgXToneMapping`                       | muy desaturado                                                        | no                                             |

### 3.4 Luz de apliques y ventana (D-316)

Una `PointLight` por aplique añadiría 2 luces al shader de **todos** los materiales (≈ +2 evaluaciones por fragmento en una sala de 168 draw calls). El efecto visible (charco cálido) ya lo dan los focos de acento re-tintados, así que: pantalla emisiva + **halo aditivo** (1 quad con textura radial de canvas) = coste ≈ 0 en luces. **Alternativa**: PointLight real en cada aplique (+2 luces, medir SC-302) si Paco quiere que iluminen de verdad.

### 3.5 Ubicación del selector (D-306)

| Sitio                                               | Problema                                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Arriba a la derecha                                 | lo tapa la ficha (360 px, arriba-derecha); en móvil la tira de piezas ocupa todo el ancho            |
| Dentro de la hoja de ayuda                          | no es «visible» (Paco pidió selector visible)                                                        |
| Abajo a la derecha, junto a «Controls»              | lo tapa la hoja de ayuda; en 360–390 px choca con el botón (más ancho en ES: «Controles»)            |
| **Abajo a la izquierda, junto a la placa de marca** | ningún panel cubre esa esquina en escritorio; en móvil se apila **encima** de la placa → **elegido** |

### 3.6 Arranque en español (D-307)

Con idioma inicial `es`, `provideAppInitializer` espera `import('./es')` (≈ 3 kB gzip, una petición paralela al `main`) antes de pintar: sin parpadeo inglés (SC-308). **Alternativa**: arrancar en EN y cambiar al cargar (parpadeo de ≈ 50–200 ms, y rompería el test «primer fotograma en ES»). Riesgo: la espera añade latencia al primer pintado en español → medir con Lighthouse (≤ +50 ms).

### 3.7 Tests frágiles (riesgo principal) — qué cambia y cómo

| Archivo                                                | Aserción actual                                                                                 | Cambio                                                                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-text.spec.ts` (se mueve a `i18n/messages.spec.ts`) | identidad `cfg.metadata toBe FURNITURE_TEXT[id]`; lista negra y longitud solo EN                | se elimina la identidad (ya no hay `metadata`); reglas de copy por idioma (`EN`: ≤ 30 palabras; `ES`: ≤ 34 y lista negra ES); paridad de claves |
| `help-panel.component.spec.ts`                         | `not.toMatch(/mouse\|wheel\|click/i)`, `toContain('Close')`/`'Keys'`, `finger\|pinch\|tap`      | parametrizar con `describe.each(LOCALES)` y comparar con `messages[locale].help.*`                                                              |
| `loading-screen.component.spec.ts`                     | `toBe(\`${status} · 7%\`)`                                                                      | `pct(7, locale)` (ES: «7 %» con U+00A0)                                                                                                         |
| `object-list.component.spec.ts`                        | lista exacta de chips, `h2` = título                                                            | por idioma; el orden de ES es el de `Intl.Collator('es')`                                                                                       |
| `description-panel.component.spec.ts`                  | live region con `info.name`                                                                     | con `{id}` y `messages().furniture[id]`; caso de cambio de idioma con la ficha abierta                                                          |
| `scene.service.spec.ts`                                | `message toContain(FURNITURE_TEXT.pokerTable.name)` (:303), `toContain('Floor texture')` (:761) | pasan a comprobar **código y `params`** (no texto); el texto se prueba en `error-messages.spec.ts`                                              |
| `scene.config.spec.ts`                                 | `toBe(FURNITURE_TEXT.landscapePainting)` (:41-47), lista `['clock','vase']` (:16)               | comprobar `id` ∈ `FurnitureId`; el eje 1,60 de cuadro y reloj; lista de decor sin cambios (las piezas nuevas viven en `decor.config.ts`)        |
| `viewer.component.spec.ts`                             | `FURNITURE_TEXT.sofa.name` (:13, :101)                                                          | `EN.furniture.sofa.name`                                                                                                                        |
| `camera.service.spec.ts`                               | mapa `sizes`                                                                                    | sin cambios (no hay muebles nuevos)                                                                                                             |

Regla general: **ningún test importa texto literal inglés**; todos leen `EN`/`ES`. Los componentes se prueban con un `provideLocale('en'|'es')` de test (carga síncrona del ES con `await`).

### 3.8 Budget del bundle (D-308)

Presupuesto de 6,4 kB al aviso. Estimación: i18n +3–5 kB (**dentro**), decor builder ≈ 8–12 kB (**fuera si va en el inicial**) → por eso `DecorBuilderService` se importa con `import()` desde `SceneService.loadDecor` (no hace falta antes de que exista el renderer; carga en paralelo). Si aun así el inicial medido supera 880 kB: **subir el aviso a 890 kB** con la cifra en el commit (error 900 intacto). **Alternativa**: no lazy-load y subir el aviso a 890 kB directamente (+0 esfuerzo, pierde ≈ 10 kB de margen inicial).

## 4. Arquitectura del cambio

```
main.ts ── provideAppInitializer(LocaleService.init)  ── (idioma inicial = es ⇒ espera import('./i18n/es'))
LocaleService ── signals: locale, messages ── effect: <html lang>, title, meta[description]
   ├─ components (8) ── text = computed(() => i18n.messages().<bloque>)       ← plantillas: text().x
   ├─ LanguageSwitcherComponent (nuevo, en viewer.component.html)
   └─ ViewerStateService.selected = {id}  ·  .error = {code, params, retry}   ← sin texto
SceneService
   ├─ renderer.toneMapping = Neutral (config)                                 (FR-310)
   ├─ RoomBuilderService.buildLighting: + HemisphereLight, + PointLight (lámpara), colores cálidos
   └─ loadDecor(): await import('./decor-builder.service') → DecorBuilderService.build(DECOR3_CONFIG, textures)
         grupos: wall-art · fixtures · textiles   (raycast anulado, fusión por material, dispose)
decor.config.ts ── única fuente de posiciones/medidas/colores de las piezas nuevas
```

## 5. Archivos a tocar (dueño único por archivo; ver tasks.md)

| Área                        | Archivos                                                                                                                                                       | Pista  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| i18n núcleo (nuevo)         | `src/app/i18n/{messages,en,es,locale.service,format,error-messages}.ts` + specs; `src/main.ts`; `src/index.html`; `CONTRIBUTING.md`                            | **I**  |
| Componentes A               | `components/{loading-screen,error-banner,error-overlay,help-panel}/**` (ts + spec; añadir spec de `error-overlay`)                                             | **CA** |
| Componentes B               | `components/{object-list,description-panel,brand-label,viewer}/**`, `components/language-switcher/**` (nuevo), `src/styles.scss` (solo si hace falta un token) | **CB** |
| Servicios / escena (código) | `services/scene.service.ts`, `viewer-state.service.ts`, `object-interaction.service.ts` (solo tipos), `interfaces/scene.interface.ts`, sus specs               | **S**  |
| Config / luces              | `config/scene.config.ts` (+spec), `services/room-builder.service.ts` (+spec)                                                                                   | **E**  |
| Decor                       | `config/decor.config.ts` (nuevo, +spec), `services/decor-builder.service.ts` (nuevo, +spec)                                                                    | **B3** |
| Assets                      | `src/assets/textures/art/**`, `src/assets/textures/fabric/**`, `docs/assets-pipeline.md`                                                                       | **A**  |
| Docs                        | `README.md`, `docs/media/**`, `docs/baseline/003-*`                                                                                                            | **D**  |
| Verificación                | `specs/003-paredes-cozy-i18n/{baseline,verification}.md`                                                                                                       | **V**  |
| Retirado                    | `src/app/config/ui-text.ts` y su spec (`git mv` al nuevo `i18n/`)                                                                                              | I      |

`angular.json` solo se toca si SC-301 lo exige (propietario: V, con permiso del principal).

## 6. Riesgos

| ID  | Riesgo                                                                                  | Prob. / impacto | Mitigación                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Tests que fijan texto o identidad (§3.7)                                                | Alta / medio    | Cada dueño edita los de su archivo; regla «ningún literal inglés»; F0 deja un `provideLocale` de test                                                |
| R2  | El bundle inicial pasa de 880 kB                                                        | Media / bajo    | Decor builder perezoso; si aun así, aviso a 890 con cifra; `ng build --stats-json` en F0 para ver el desglose                                        |
| R3  | El tone mapping cambia todo el aspecto (regresión visual, constitución II)              | Media / medio   | Se aplica en la misma tarea que las luces con capturas antes/después; la exposición se ajusta 0,95–1,15; si empeora, ACES o sin tone mapping (D-320) |
| R4  | Cojines y manta mal colocados (la huella real del sofá en L es inferida)                | Alta / bajo     | Colocación con la AABB real y capturas en T-343 (como T-250 de la 002); SC-307 los comprueba                                                         |
| R5  | Lámpara quema el rincón (PointLight a 0,8 m de dos muros)                               | Media / bajo    | Intensidad de partida 1,5 con tope 2,5 y criterio de píxeles saturados ≤ 3 % (SC-306)                                                                |
| R6  | Cortinas de ≈ 3 840 tris por z-fighting/sombras raras                                   | Baja / bajo     | Sin sombra, doble cara, `polygonOffset` en halos; separación ≥ 0,02 m del muro                                                                       |
| R7  | Ancho en español: «Restablecer vista», «Inspeccionar» o la ayuda desbordan a 360–390 px | Media / medio   | Pruebas visuales a 360 y 390 px; `overflow-wrap` en `dt/dd`; tira de piezas con scroll (ya existe)                                                   |
| R8  | El orden de la lista cambia con el idioma y desorienta                                  | Baja / bajo     | Orden alfabético por idioma (ya lo era en EN); el foco no se pierde: el chip activo se conserva por `id`                                             |
| R9  | `localStorage` bloqueado (modo privado)                                                 | Media / bajo    | `try/catch`; test; no hay aviso                                                                                                                      |
| R10 | El chunk ES no carga (offline)                                                          | Baja / medio    | EN de reserva + aviso (principio V) + test con `import()` rechazado                                                                                  |
| R11 | El selector choca con la ficha móvil (hoja inferior ≤ 34 dvh)                           | Baja / bajo     | La ficha cubre el selector mientras está abierta (modal temporal); se cierra con Esc/✕. No se reubica                                                |
| R12 | Doble recuento de `renderer.info.calls` hace parecer que se supera SC-303               | Media / bajo    | Medir en el mismo build antes/después (F0 y F5) y usar el delta, como en la 002                                                                      |
| R13 | VRAM no medida                                                                          | Media / bajo    | Estimación 10,4 MiB nuevos (< 14); medir con `renderer.info.memory.textures` y un cálculo por textura en F5                                          |

## 7. Decisiones (recomendación aplicada · alternativa)

| ID    | Decisión                 | **Recomendación (la que asume tasks.md)**                                                                            | Alternativa                                                                     | Coste del cambio de opinión                                                   |
| ----- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| D-300 | Enfoque de i18n          | Capa propia con señales y `Messages` tipado                                                                          | `@angular/localize` (build por idioma) o ngx-translate (+31 kB)                 | Reescribir ≈ 8 componentes y el servicio; localize además exige `vercel.json` |
| D-301 | Detección y persistencia | Primer idioma soportado de `navigator.languages`; `localStorage['room-tour.locale']` con `try/catch`, solo al elegir | Solo `navigator.language`; o cookie                                             | 1 función + 1 test                                                            |
| D-302 | Estado traducible        | `ObjectInfo = {id}`, `ViewerError = {code, params}`; traducir en la plantilla                                        | Guardar texto y re-traducir al cambiar                                          | Más estado y casos de desincronía; `+` tests                                  |
| D-303 | Carga del ES             | `import('./es')` perezoso                                                                                            | ES eager (+7–9 kB: rompe el aviso del budget)                                   | Quitar el `import()`; subir el aviso                                          |
| D-304 | Tuteo vs usted           | **Tuteo neutro** en imperativo                                                                                       | Usted                                                                           | Reescribir ≈ 20 cadenas del ES (tabla C.5)                                    |
| D-305 | Metadatos                | Runtime: `lang`, `title`, `meta[description]`; OG/Twitter estáticos en EN; `noscript` bilingüe                       | Actualizar también OG en runtime (sin efecto en rastreadores) o HTML por idioma | HTML por idioma: build/despliegue (alto)                                      |
| D-306 | Selector                 | Abajo-izquierda junto a la marca; `role="group"` + `aria-pressed`; apilado en móvil                                  | Radio group (`role="radiogroup"`); arriba a la derecha                          | Cambiar roles/estilos del componente                                          |
| D-307 | Arranque en ES           | `provideAppInitializer` espera el chunk (sin parpadeo)                                                               | Arrancar en EN y conmutar                                                       | Quitar el initializer; el test «primer frame ES» desaparece                   |
| D-308 | Budget                   | Decor builder perezoso; aviso 880 se mantiene; si > 880 sube a 890 con cifra                                         | Eager + aviso a 890                                                             | Quitar el `import()`                                                          |
| D-310 | Piezas de pared          | **Procedurales** (marcos, apliques, ventana, cortinas, lámpara)                                                      | Modelos Poly Haven (marco 01, espejo 01, cojines 01, lámpara de aceite)         | + ≈ 0,45 MiB y + importación/pipeline de 3–4 glTF                             |
| D-311 | Láminas                  | 4: Atkins (Spiraea, Osmunda, Pteris) + Talbot (Felce); CC0/PD                                                        | Obras del Met más reconocibles (Girasoles, Renoir)                              | Cambiar 4 WebP + créditos                                                     |
| D-312 | Espejo                   | **No** (sin `envMap` se ve gris; el de Poly Haven tiene el reflejo horneado)                                         | `ornate_mirror_01` (+0,33 MiB)                                                  | + 1 glTF, 1 entrada                                                           |
| D-313 | CC-BY                    | Sin piezas CC-BY (no hace falta)                                                                                     | Una manta/cojín CC-BY modelado                                                  | Atribución en README y ficha                                                  |
| D-314 | Alturas                  | Eje 1,60: cuadro 1,66 → 1,60 y reloj 1,70 → 1,60                                                                     | Mantener 1,66/1,70 y alinear las nuevas a 1,66                                  | 2 números + tests                                                             |
| D-315 | Interactividad           | Ninguna pieza nueva (lista de 5)                                                                                     | Lámpara de pie como 6.ª con ficha (textos reservados en spec C.5)               | `MODEL_CONFIGURATIONS` + ficha + recuentos de `scene.service.spec`            |
| D-316 | Apliques                 | Emisivos + halo aditivo, sin luz                                                                                     | `PointLight` por aplique (+2 luces)                                             | 2 luces y medir SC-302                                                        |
| D-317 | Reparto en paredes       | Fondo: 2 láminas + 2 apliques; izquierda: ventana + cortinas (+ lámpara); derecha: díptico                           | Más láminas en la derecha / ventana en el fondo                                 | Cambiar coordenadas en `decor.config.ts`                                      |
| D-320 | Tone mapping             | `NeutralToneMapping` exp. 1,0                                                                                        | `ACESFilmic` (exp. 1,2–1,4) o ninguno                                           | 1 línea + reajuste de luces                                                   |
| D-321 | Temperaturas             | Sol 4200 K, foco central 3300 K, acentos 3000 K, lámpara 2700 K                                                      | Todo a ≈ 3000 K (más naranja)                                                   | Cambiar 5 colores                                                             |
| D-322 | Techo                    | Hemisférica `#fff2e0/#d9b48c` 0,95 + ambiente 0,25 + techo `#f1e2cf`                                                 | Solo subir ambiente / emisivo en el techo                                       | 3 números                                                                     |
| D-323 | Luces nuevas             | Solo la lámpara (+ hemisférica)                                                                                      | Ninguna (solo emisivos) o 2 puntuales                                           | Medir; 1–2 luces                                                              |
| D-324 | Textiles                 | Lino gris teñido (procedural), 2 cojines + 1 manta                                                                   | Poly Haven `throw_pillows_01` (zigzag)                                          | + 0,22 MiB; contra el criterio sobrio                                         |
| D-325 | Sala enorme              | Luz + agrupar zona de estar; sin niebla; sin tocar dimensiones                                                       | Acercar cámara inicial (P-3) o reducir a 12×12                                  | Cámara: 1 constante; reducir: ≈ 1–2 días                                      |
| D-326 | Alfombra                 | Tinte `#ffd9b3` (más cálido)                                                                                         | Cambiar de textura (`cotton_jersey`)                                            | 1 número; textura: 2 ficheros                                                 |
| D-327 | Formato de texturas      | WebP q85, láminas 512×717, lino 512                                                                                  | q80 en Pteris (≈ −25 KB)                                                        | —                                                                             |
| D-328 | Organización             | `decor.config.ts` + `DecorBuilderService` aparte de `scene.config.ts`/`RoomBuilderService`                           | Todo en `scene.config.ts`/`room-builder`                                        | Más conflictos entre pistas                                                   |

## 8. Preguntas abiertas para Paco (no respondidas aquí; sin ellas el plan sigue con la recomendación)

1. **¿Tuteo («Arrastra…») o usted («Arrastre…»)?** Recomendación: tuteo neutro (C.4).
2. **¿Quieres un espejo?** Recomendación: no, el cristal se vería gris o con un reflejo horneado de Poly Haven (D-312); si lo quieres, se añade `ornate_mirror_01` (+0,33 MiB).
3. **¿Acercamos la cámara inicial para que la sala se sienta más pequeña?** Recomendación: no en esta ronda (toca capturas y la constitución II); es una constante (D-325, opción C).
4. **¿La lámpara de pie debe ser la 6.ª pieza interactiva (con ficha)?** Recomendación: no (D-315); los textos EN/ES ya están reservados.
5. **¿Aceptas que las miniaturas de enlaces compartidos (Open Graph) sigan en inglés?** Recomendación: sí (D-305); servirlas en español pide HTML/URL por idioma.
6. **¿Aceptas subir el aviso del budget a 890 kB** solo si el build inicial supera 880 kB tras lo perezoso? Recomendación: sí, con la cifra medida (D-308).
7. **¿Todo por `orq/11221609` (PR #3)?** Esta spec lo asume; no se hace push desde aquí.

## 9. Cómo se prueba y mide

- **Unit/integración**: `npm run lint:check && npm run build && npm test` (constitución I) en cada integración; `npm test -- --include "**/locale.service.spec.ts"` para el servicio.
- **Peso**: `du -sb src/assets` (previsto ≈ 4 004 719 B).
- **Bundle**: `npm run build` (la salida lista inicial y perezosos); `npx ng build --stats-json` para el desglose si hace falta.
- **Coste de dibujo**: dev server + `window.__rtad.stats()` en la vista inicial (escritorio y móvil) antes (F0) y después (F5); geometría nueva por `gltf-tris`-equivalente sobre los grupos `decor3` (`BufferGeometry.index.count / 3`).
- **Frame time**: `node …/scripts-r2/baseline-capture.mjs --out <dir> --no-shots --uncapped --prod` (móvil ×4, 300 frames, 20 pares) como en la 002.
- **Calidez**: capturas 1280×800 + `magick <png> -crop <región> -format "%[fx:…]" info:` (regiones de SC-306; comando completo en `tasks.md`, fase F5).
- **Accesibilidad**: Lighthouse (`npx -y lighthouse`) en EN y ES, y `contrast-b7.mjs` para el selector.
- **i18n en navegador**: Edge/Chrome headless con `--lang=es` y `Emulation.setLocaleOverride` para la detección; cambio de idioma por CDP sin recarga comprobando que `performance.getEntriesByType('navigation').length` no cambia.
- **Capturas**: EN y ES, 1280×800 y 390×844 (emulación de dispositivo por CDP: la ventana headless tiene ancho mínimo ≈ 500 px), en `docs/baseline/003-*`.
