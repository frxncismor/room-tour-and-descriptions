# Plan de implementación: Sala completa, decorada e interactuable

**Rama**: `orq/11221609` · **Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23 · **Estado**: borrador para aprobación (el principal aprueba con las recomendaciones de §7; las preguntas de §8 no bloquean).

## 1. Contexto técnico y datos verificados

| Dato                       | Valor                                                                                                                                                                                         | Fuente                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Angular / three            | Angular 21 zoneless, componentes OnPush con señales; three 0.187 (OrbitControls con `zoomToCursor`)                                                                                           | `package.json`, `explorador-escena4` §3                         |
| Interacción hoy            | solo `addObject` de `loadOne` registra; `ObjectInfo.id: FurnitureId` (5 ids); `intersect` lanza contra toda `scene.children` y **ignora** lo no registrado; clic en pared → `selected = null` | `object-interaction.service.ts:460-498`, `scene.service.ts:789` |
| Cámara                     | FOV 65°, `maxDistance` 8, objetivo y cámara a ±7,5 m, `focusOn(object, obstacles, approach)` con encuadre frontal de planos finos; 1200/900 ms de tween con `prefers-reduced-motion`          | `camera.service.ts:198-313`                                     |
| Bundle                     | inicial 884,8 kB (build 886,95 con CSS); aviso 890 / error 900; **ES y decor 3 ya perezosos**; `en.ts` en el inicial                                                                          | `angular.json`, `explorador-escena4` §5                         |
| Frame móvil                | 14,05 ms mediana ×4 (p95 34,3); 003 lo subió desde 7,4 ms con +31 draw calls, +2 luces y tone mapping: **el coste es de relleno/luces y de llamadas**, no de triángulos                       | `implementacion.md`, `explorador-escena4` §4                    |
| Sombras                    | 1 luz con sombra 2048², `autoUpdate` por defecto (se regenera cada frame aunque nada se mueva); casters hoy: sofá, mesa de póker, estantería                                                  | `room-builder.service.ts:367-388`                               |
| Assets                     | `src/assets` 4 044 814 B; 10 candidatos medidos por `especialista-assets4`, 4 más medidos aquí                                                                                                | spec §A.4                                                       |
| Presupuesto de visibilidad | la vista inicial deja libres z ≥ 0,4 en laterales y z ≥ 4,7 al centro (0 piezas nuevas en frustum; script de la spec)                                                                         | `mockups/plan.png`                                              |
| Herramientas               | Prettier disponible (sin instalar); ImageMagick 7.1.2; Edge/Chrome headless; **sin** `npm install`, builds de Angular ni dev server en esta máquina compartida durante el diseño              | corrida                                                         |

## 2. Principios de la constitución aplicados

I (repo verde en cada integración; cada pista deja `lint:check`, `build`, `test` en verde), II (capturas antes/después: **T-400 toma la línea base de las dos vistas antes de cualquier cambio**; la única diferencia visual intencionada en la vista inicial es la cornisa y se anota en su commit), III (acciones con botón en la ficha, `aria-pressed`, `aria-live`, `prefers-reduced-motion`, contraste AA, `Esc`), IV (todo `requestAnimationFrame`, temporizador, `AudioContext`, geometría, material, textura y `CanvasTexture` nuevos se liberan en `dispose`; sin trabajo por frame cuando nada se anima; assets de la primera visita ≤ 8 MB y con progreso real), V (si falla un modelo o textura de zona: aviso visible con reintento y la zona se omite sin romper la escena; el sonido que no pueda iniciarse muestra un mensaje en la ficha, no `console.error`), VI (commits convencionales; un test por cada lógica nueva), VII (sin dependencias, sin red nueva: audio generado en el navegador, láminas y modelos locales).

## 3. Enfoques considerados

### 3.1 Selección de la decoración (D-408)

| Enfoque                                       | Cómo                                                                                                                    | Coste                                                                                                                                          | Veredicto                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **A. Proxies de raycast por pieza** (elegido) | cajas invisibles registradas por pieza; las mallas fusionadas siguen sin raycast; glTF nuevos se registran directamente | ≈ 40 mallas invisibles (0 draw calls, 12 tris de raycast cada una); `pickables` acota el rayo; contorno sobre la caja para piezas procedurales | **Recomendado**: conserva la fusión por material (draw calls), cambio pequeño y testeable con `Box3` |
| B. Dejar de fusionar la decoración            | una malla por pieza con raycast propio                                                                                  | +≈ 40 draw calls (la 003 ya pagó +31 por 14 ms)                                                                                                | Descartado: rompe el presupuesto de frame                                                            |
| C. Picking por GPU (buffer de ids)            | segundo pase con color por pieza                                                                                        | complejo, un pase extra por clic, mucho código nuevo en el bundle inicial                                                                      | Descartado                                                                                           |

### 3.2 Luz de las fuentes encendibles (D-407)

| Enfoque                                                    | Cómo                                                                        | Coste                                                             | Veredicto                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| **A. Emisivo + halo aditivo + charco** (elegido)           | patrón de los apliques de la 003; `emissiveIntensity` y opacidades animadas | 0 luces nuevas, 2 mallas simples por fuente                       | **Recomendado**                       |
| B. 1 `PointLight` compartida que salta a la última lámpara | iluminación real de un foco a la vez                                        | +1 luz permanente en el shader de todo (la 003 pagó por +2 luces) | Alternativa si Paco prefiere realismo |
| C. 1 `PointLight` por lámpara                              | realismo máximo                                                             | +3 luces: descartada                                              | —                                     |

### 3.3 Contenido de la TV (D-402)

A. **Modo arte con las 8 láminas** (elegido: 0 B, sin derechos, coherente y sobrio, 2 mallas + 1 halo). B. Canvas generativo (más «tele», menos coherente; coste por frame). C. Vídeo corto en bucle (peso, derechos, `autoplay`). D. CRT de Poly Haven (retro; no sobrio).

### 3.4 Encuadre de pared y zoom (D-409, D-410)

A. **`CameraService.focusSurface` propio** (elegido): pose frontal calculada desde FOV, aspecto y ancho del tramo (≤ 9 m), `maxDistance` 12, `zoomToCursor`. B. Reutilizar `focusOn` con un `Object3D` plano auxiliar por tramo (más código de pegamento, rotaciones de `approach` frágiles). C. Subir solo `maxDistance` sin tramos (no cabe en retrato). El techo usa una pose fija.

### 3.5 Rendimiento (D-415): palancas por orden de coste/beneficio

1. **Sin luces nuevas**; 2. **sombras estáticas** (`shadowMap.autoUpdate = false`, `needsUpdate = true` tras cada carga y tras cada cambio de zona: la escena es estática; el plato que gira y las pantallas no proyectan); 3. **fusión por material y por zona** (cada zona es un `Group` con su esfera: **frustum culling gratis**, por eso la vista inicial no paga las piezas del lado opuesto); 4. texturas 512 en piezas principales y 256 en secundarias, láminas a 512×717; 5. **casters nuevos ≤ 6** (sillones, aparador de nogal, armario); 6. matrices congeladas (`matrixAutoUpdate = false` + `updateMatrix()`) en lo estático; 7. si aún no cabe: LOD por zona (ocultar el «styling» pequeño a > 9 m) y quitar el colgante. **Gate**: mediana < 16,7 ms en la vista A **y** en la B.

### 3.6 Bundle inicial y textos (D-412, D-413)

Todo lo nuevo es perezoso: `src/app/pieces/**` (config, builders, acciones, audio, diccionarios). En el inicial entra solo el pegamento común: tipos (0 B), selección unificada, panel de acciones, lista agrupada, `focusSurface`, ≈ 20 cadenas EN. Estimación **+4–5 kB**. **Dieta** para compensar: convertir `description-panel`, `error-overlay` y `error-banner` (y la ayuda tras el primer cierre) en `@defer (on idle)`/`(when …)` → −6…9 kB estimados; se mide con `ng build --stats-json` y un script que lee el metafile de esbuild (T-400 línea base, T-492 final). Si tras la dieta supera 890 kB: justificar con cifra y subir aviso/error a 900/910. Textos: `pieces.en.ts` y `pieces.es.ts` se cargan junto a la escena (y con el cambio de idioma) por `LocaleService`.

### 3.7 Lista (D-411)

A. **Acordeón + búsqueda (escritorio) y pestañas de zona (móvil)** (elegido). B. Lista plana con scroll (35 filas: peor orientación, sin «Ver pared»). C. Búsqueda también en móvil (teclado virtual tapa la escena; se queda como mejora futura).

### 3.8 Carga de assets (D-414)

A. **Todo tras la pantalla de carga con progreso real** (elegido; simple, sin pop-in; primera visita ≈ 6,3 MB < 8 MB). B. Streaming por zonas en segundo plano (primera carga igual que hoy, pero hay pop-in al girar rápido y más código en el inicial). C. Recortar piezas (spec §F.1).

## 4. Arquitectura del cambio

```
initial chunk                          lazy chunk `pieces` (import() desde SceneService)
────────────                          ──────────────────────────────────────────────
interfaces/scene.interface.ts          pieces/pieces.config.ts      PIECES (35), ZONES, SURFACES, proxies, facing
  SelectableId, ObjectInfo.kind        pieces/surfaces.config.ts    WALLS (4) + CEILING: normal, ancho, tramos
object-interaction.service.ts          pieces/pieces-builder.service.ts  construye zonas (grupos), proxies, alfombras
  pickables, prioridad, kind           pieces/builders/*.ts         tv, credenza, desk, monitor, lamps, turntable,
camera.service.ts                                                    door, mirror, plant, shelves, books (geometría)
  focusSurface, max/min, zoomToCursor  pieces/piece-actions.runtime.ts   máquinas de estado y animación por frame
scene.service.ts                       pieces/turntable-audio.ts    Web Audio generativo (chunk propio)
  carga perezosa, selectObject(Id)     pieces/piece-ids.ts          PieceId/SurfaceId (solo tipos)
viewer-state.service.ts                pieces/pieces.en.ts · pieces.es.ts  diccionarios perezosos
  pieceState (señal)
components: object-list (grupos),
 description-panel (acciones, tramos),
 viewer (clip, teclas), help-panel
```

**Flujo de selección**: `pointerup` → `handlePointerSelect` → `intersect(pickables)` ordena por distancia; el primer impacto **registrado** decide: pieza (`kind: piece|furniture`) → `selectObject(id)`; si no, pared/techo (`kind: surface`) → `focusSurface`; si no, suelo → teletransporte. Con tolerancia táctil se juntan los impactos de los 17 rayos y se aplica pieza > pared > suelo. `selectObject(id)`: piezas → `focusOn(caja unión de proxies, obstáculos, approach)` con la orientación frontal de la definición; **si el origen fue un clic de puntero y la acción principal está apagada, `PieceActionsRuntime.run(id, primary)`**. El estado vive en `ViewerStateService.pieceState` (señal por pieza: `{power, index, spin, sound}`); el runtime lo escribe y las mallas lo leen en `update(dt)` solo cuando hay animación activa (plato, fundido, `TICK`); en reposo no hay trabajo por frame.

**Idioma**: `LocaleService` pide `pieces.<locale>` junto con la escena cuando el chunk de piezas está cargado y al cambiar de idioma; el panel resuelve el texto por `kind` (`furniture` → `en.ts`; `piece|surface` → diccionario perezoso). Hasta que el diccionario carga, la selección de pieza nueva no es posible (los proxies se crean después de cargarlo).

## 5. Archivos a tocar (dueño único por archivo; ver tasks.md)

| Área                      | Archivos                                                                                                                                                                                                      | Pista |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Línea base y verificación | `specs/004-sala-completa/{baseline,verification}.md`, `docs/baseline/004-*`, `scripts/verify-viewer-scroll.mjs`, `scripts/bundle-report.mjs`                                                                  | V     |
| Assets                    | `src/assets/models/{lounge_chair,side_table,arm_chair,coffee_table,drawer_sideboard,wood_chair,display_shelves,armoire,pendant_lamp}/**`, `src/assets/textures/art/{e,f,g,h}.webp`, `docs/assets-pipeline.md` | A     |
| Tipos e i18n              | `interfaces/scene.interface.ts`, `i18n/{messages,en,es,locale.service}.ts` (+specs), `pieces/{piece-ids,pieces.en,pieces.es}.ts` (+spec de paridad)                                                           | T     |
| Cámara                    | `services/camera.service.ts` (+spec)                                                                                                                                                                          | K     |
| Interacción y estado      | `services/object-interaction.service.ts`, `services/viewer-state.service.ts` (+specs)                                                                                                                         | I     |
| Piezas: datos             | `pieces/pieces.config.ts`, `pieces/surfaces.config.ts` (+specs)                                                                                                                                               | P1    |
| Piezas: geometría         | `pieces/pieces-builder.service.ts`, `pieces/builders/*.ts` (+specs)                                                                                                                                           | P2    |
| Piezas: acciones          | `pieces/piece-actions.runtime.ts`, `pieces/turntable-audio.ts` (+specs)                                                                                                                                       | P3    |
| Lista y visor             | `components/object-list/**`, `components/viewer/**` (fix de scroll, teclas)                                                                                                                                   | U     |
| Ficha y ayuda             | `components/description-panel/**`, `components/help-panel/**`, `app.component.html` (`@defer`), `angular.json` solo si SC-404 lo exige                                                                        | UP    |
| Escena                    | `services/scene.service.ts`, `services/model-loader.service.ts` (tinte con `map` nulo), `services/room-builder.service.ts` (cornisa, nombres de superficies) (+specs)                                         | S     |
| Docs                      | `README.md`, `docs/media/**`                                                                                                                                                                                  | D     |

## 6. Riesgos

| Riesgo                                                      | Prob. | Impacto                    | Mitigación                                                                                                             |
| ----------------------------------------------------------- | ----- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| El bundle inicial pasa de 890 kB                            | media | aviso de build             | dieta `@defer` medida en T-400/T-492; fallback justificado (900/910)                                                   |
| Frame móvil > 16,7 ms en la vista B (media sala nueva)      | media | gate SC-406                | sombras estáticas, culling por zona, 0 luces nuevas, ≤ 6 casters; palancas 5–7 de §3.5; baseline de B antes de empezar |
| `zoomToCursor` deriva el objetivo contra `clampToRoom`      | media | zoom raro cerca de paredes | T-433 con pruebas; fallback a dolly al centro                                                                          |
| Orientación frontal de los glTF desconocida                 | alta  | piezas giradas             | rotaciones marcadas «≈» y verificadas por captura en T-453                                                             |
| Ficus procedural «de primitiva»                             | media | aspecto barato             | puerta de calidad por captura en T-462; fallback: jarrón de cerámica con ramas secas (clon de `vase`)                  |
| Sonido generado poco agradable o bloqueado por autoplay     | media | molesta                    | solo con gesto, −24 dB, desactivado por defecto; fallback: tocadiscos sin audio                                        |
| Halos aditivos «lavan» la imagen (SC-306 de la 003)         | baja  | calidez                    | opacidades ≤ 0,35, métrica de ≤ 3 % de píxeles ≥ 250 repetida en F5                                                    |
| Contorno de selección feo sobre cajas (piezas procedurales) | media | UX                         | revisar capturas en T-453; fallback: realce por tinte de halo                                                          |
| El clic en pared dejó de cerrar la ficha: confusión         | baja  | UX                         | texto en la ayuda; `Esc`/✕ y botón de la ficha                                                                         |
| VRAM +27 MiB en móviles modestos                            | baja  | memoria                    | 256 px en secundarias; medir `renderer.info.memory`; recorte de §F.1                                                   |
| Tests frágiles que cuentan 5 ids o 5 entradas               | alta  | CI rojo                    | T-440/T-480 actualizan primero los specs que cuentan ids/entradas                                                      |

## 7. Decisiones (recomendación aplicada · alternativa)

| ID    | Decisión                                                                                                                              | Alternativa                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| D-400 | Subdividir con zonas y 2 alfombras; **no** acercar paredes                                                                            | reducir la sala a 12×12 (rechazada en 003 D-325)                                                |
| D-401 | 9 glTF Poly Haven (CC0) + procedurales de calidad (bisel, PBR, materiales aparte para lo animado)                                     | aparador real `modern_wooden_cabinet` (+1,19 MiB, +25 k tris); `metal_office_desk` (industrial) |
| D-402 | TV en modo arte con las 8 láminas, pase cada 8 s, sin vídeo                                                                           | canvas generativo; vídeo en bucle; CRT retro                                                    |
| D-403 | Escritorio de roble procedural; monitor y flexo como piezas separadas con acción propia                                               | un solo escritorio con 2 botones                                                                |
| D-404 | Tocadiscos procedural; plato gira (toggle); sonido Web Audio, apagado por defecto, control accesible; sin giro con reducir movimiento | sin audio esta ronda; pista CC0 concreta                                                        |
| D-405 | Rincón de lectura (sillón + mesita + lámpara) + lámpara de pie existente conmutable (encendida de inicio)                             | lámpara de pie nueva                                                                            |
| D-406 | Clic en pieza activa la acción principal si está apagada; lista/teclado solo seleccionan; botón en la ficha siempre                   | solo botón en la ficha; clic siempre alterna                                                    |
| D-407 | Luz sin `PointLight` nuevas: emisivo + halo + charco                                                                                  | 1 `PointLight` compartida                                                                       |
| D-408 | Proxies de raycast por pieza; fusión intacta; `pickables`                                                                             | desfusionar; picking por GPU                                                                    |
| D-409 | Paredes y techo seleccionables: encuadre frontal ≤ 9 m, tramos si no cabe, prioridad pieza > pared > suelo                            | botón «Ver pared» solo en la lista                                                              |
| D-410 | `zoomToCursor`, mínimo 0,8 m, máximo 12 m, límites de sala intactos                                                                   | dolly al centro                                                                                 |
| D-411 | Acordeón + búsqueda (escritorio); pestañas de zona (móvil)                                                                            | lista plana; búsqueda en móvil                                                                  |
| D-412 | Textos de piezas en diccionarios perezosos (`pieces.en/es.ts`)                                                                        | todo en `en.ts` (rompe el presupuesto)                                                          |
| D-413 | Dieta `@defer` del inicial; presupuestos 890/900 sin cambio salvo medición                                                            | subir a 900/910 de entrada                                                                      |
| D-414 | Tope de assets 6,5 MiB (objetivo 6,0); carga tras la pantalla de carga                                                                | streaming por zonas; recortes                                                                   |
| D-415 | Sombras estáticas, merge por material y zona, 0 luces nuevas, ≤ 6 casters, gate de frame en vistas A y B                              | calidad de sombra más baja                                                                      |
| D-416 | Cornisa + 1 colgante en la zona de TV (fuera de la vista inicial); techo seleccionable                                                | 2 colgantes (uno sobre la mesa de póker, cambia la vista inicial); sin cornisa                  |
| D-417 | Ficus procedural con puerta de calidad por captura                                                                                    | jarrones con ramas; asset de Sketchfab que aporte Paco                                          |
| D-418 | Alfombras nuevas no seleccionables (el clic teletransporta)                                                                           | seleccionables                                                                                  |
| D-419 | Fix del visor: `overflow: clip`, `preventScroll`, `revealActive` sin `scrollIntoView`                                                 | solo `clip`                                                                                     |
| D-420 | 4 láminas nuevas de dominio público (E–H)                                                                                             | reutilizar A–D                                                                                  |
| D-421 | Puerta decorativa                                                                                                                     | puerta que se abre (P3)                                                                         |

## 8. Preguntas abiertas para Paco (no respondidas aquí; sin ellas el plan sigue con la recomendación)

1. **Sonido**: ¿te vale un sonido generado (pad suave + crepitar, sin música real) o prefieres sin audio / una pista CC0 concreta?
2. **TV**: ¿modo arte con las láminas de la sala te gusta, o querías algo tipo chimenea o paisaje en movimiento (más peso y derechos)?
3. **Cornisa**: es lo único que cambia en tu vista inicial (una línea fina bajo el techo). ¿Aceptas?
4. **Carga**: la sala pasa de 3,9 a ≈ 6,0 MiB (primera visita algo más lenta). ¿Aceptas el tope de 6,5 MiB o prefieres recortar sillón/aparador (−0,6 MiB)?
5. **Clic en pared**: ya no cierra la ficha (la cierran ✕ y `Esc`). ¿Te parece bien?
6. **Plantas**: ¿vale un ficus procedural o prefieres aportar un modelo CC0/CC-BY concreto?
7. **Activación**: ¿te gusta que el clic en la TV/lámpara las encienda directamente (y el teclado solo seleccione)?

## 9. Cómo se prueba y mide

- **Siempre**: `npm run lint:check && npm run build && npm test` (cada integración).
- **Unit (Vitest)**: máquinas de estado, prioridad de raycast, `focusSurface` (esquinas dentro del frustum a 3 aspectos), paridad EN/ES, colocación `Box3`, lista agrupada y búsqueda, `scrollIntoView` no llamado, `dispose` sin fugas.
- **Medición** (Edge/Chrome headless por CDP, sin dependencias): `bundle-report.mjs` (`ng build --stats-json`), frame ×4 en vistas A y B (10 pares ABAB), `window.__rtad.stats()`, Lighthouse EN/ES (`npx -y lighthouse`), contraste (`contrast-b7.mjs` de la 003), `verify-viewer-scroll.mjs`.
- **Capturas** (SC-414) en `docs/baseline/004-*`, comparadas con `003-final-*` (constitución II).
