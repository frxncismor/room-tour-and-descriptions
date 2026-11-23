# Plan de implementación: Decoración sobria y UI con identidad propia

**Feature**: `002-decoracion-y-ui` · **Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23
**Base**: `orq/11221609` @ `15d1d5b` (Angular 21, three 0.187, Vitest, eslint flat). Sin cambios de dependencias: ninguna tarea toca `package.json`.

## 1. Contexto técnico y datos verificados

| Aspecto | Hoy (verificado) | Objetivo |
|---|---|---|
| Modelos | 3 interactivos en `MODEL_CONFIGURATIONS`; no hay ruta para decoración no interactiva (`SceneService.loadOne` siempre llama a `addObject`) | +2 interactivos (cuadro, suculenta) y +2 decorativos reales (reloj, jarrón) por una ruta nueva |
| Sala | `RoomBuilderService.buildRoom` síncrono: suelo gris `0xe0e0e0`, 4 muros, techo; sin zócalo ni texturas; `scene.background 0xf0f0f0` | suelo de madera con texturas, zócalo, alfombra |
| Carga de modelo | `ModelLoaderService.applyTransformations`: centra la caja en `position.x/z` y apoya `minY` en `yOffset` | sirve tal cual para cuadro/reloj (colgados vía `yOffset`) |
| Raycast | `intersect` solo descarta contornos; el suelo se detecta por `name === 'floor'`; objetos no registrados no bloquean pero tampoco se ven afectados | `raycast = () => undefined` en la decoración (patrón ya usado en contornos) |
| Peso | `src/assets` 2 624 958 B | ≈ 3,6 MiB (spec §A.5) |
| UI | inline styles por componente, tokens parciales en `styles.scss`, 11 tamaños de fuente, 13 valores de color sueltos, `--color-overlay` sin uso | tokens completos + componentes que solo usan `var(--…)` |
| Bundle | inicial 843 kB (error a 900 kB, `angular.json`) | ≤ 900 kB: el código nuevo (decor, texturas, tokens) debe caber en ≈ 40 kB; las fuentes **no** entran en el bundle (archivos aparte) |
| Tests frágiles | `components.spec.ts` (293 líneas, 7 `describe`), regex sobre CSS `:125-138` | ver §6 |

## 2. Principios de la constitución aplicados

I repo verde en cada integración · II capturas antes/después de cada cambio visual (T-200 y T-290) · III contraste AA medido, foco, `aria-live`, `prefers-reduced-motion` en **todos** los componentes · IV `dispose` de texturas/materiales nuevos y presupuesto de assets · V fallo de textura/modelo → aviso con reintento · VI commits convencionales, un test por cambio de lógica · VII **fuentes autoalojadas** (sin CDN de Google).

## 3. Enfoques considerados

### 3.1 Cómo se consigue la decoración (D-221)

| Enfoque | Coste | Pros / contras |
|---|---|---|
| A. **Modelos Poly Haven CC0 (4) + alfombra y zócalo procedurales** | ≈ +1,0 MiB; 1 script de pipeline ya existente con 2 flags | Acabado PBR coherente con los muebles; CC0 sin obligación; autores acreditados por cortesía. Requiere verificar orientación y escala a ojo |
| B. Todo procedural (cajas, esferas, `RoundedBoxGeometry`) | ≈ 0 KB | Sin peso ni licencias, pero se ve «de prototipo» y desentona con los PBR: contrario al criterio «profesional» |
| C. Pack grande (Kenney/Quaternius) | 2–10 MB | Estilo low-poly incompatible con el sofá/mesa |
**Elegido: A.** Alternativa de respaldo si una pieza falla en la verificación visual: sustituir por la opción B del especialista (`ceramic_vase_04`, `fancy_picture_frame_01` → otro marco) sin tocar la arquitectura.

### 3.2 Ruta de la decoración no interactiva (D-222)

| Enfoque | Coste | Pros / contras |
|---|---|---|
| A. **Config separada `DECOR_CONFIGURATIONS` + `loadDecor` en `SceneService`** | 1 constante, 1 método de ~25 líneas, 1 interfaz `DecorConfiguration` (= `ModelConfiguration` sin `metadata`) | `ModelId`, `getObjectList()`, `ui-text.spec` («metadata idéntica a `FURNITURE_TEXT`») y la lista de la UI no cambian de semántica; el tipo impide por construcción que una decoración tenga ficha |
| B. Flag `interactive: false` en `MODEL_CONFIGURATIONS` | menos código nuevo | `metadata` pasa a opcional y hay que filtrar en `getObjectList`, `addObject`, `ModelId`, `ui-text.spec` y el progreso; un olvido deja una decoración clicable |
**Elegido: A.**

### 3.3 Texturas del suelo y la alfombra (FR-203)

| Enfoque | Coste | Notas |
|---|---|---|
| A. **`RoomBuilderService.loadTextures()` asíncrono** (un `TextureLoader` con el `LoadingManager` del progreso) que sustituye los materiales planos al terminar; `buildRoom` sigue siendo síncrono | medio-bajo | `room-builder.service.spec` (6 mallas) y los consumidores no cambian; el suelo no se ve gris porque la pantalla de carga se mantiene hasta que acaba |
| B. Textura vía glTF (un plano glTF por suelo) | alto | reutiliza el loader pero mezcla sala y modelo; descartado |
| C. Texturas síncronas embebidas (data URI) | bajo | infla el bundle (282 KB) y supera su presupuesto |
**Elegido: A.** Los grupos `room-trim` (zócalo + alfombra) se crean en `buildRoom` (síncrono, color plano) y la alfombra/suelo reciben su textura en `loadTextures()`.

### 3.4 Tipografía (D-220)

| Enfoque | Coste | Notas |
|---|---|---|
| A. **Autoalojar Fraunces + Hanken Grotesk** (woff2 subset latin, 99,6 KB) | 2 ficheros + `OFL.txt` | Sin red externa (principio VII), `preload` y control total del `font-display`; dentro del presupuesto de assets |
| B. Google Fonts por CDN | 0 KB propios | Añade un servicio externo (viola VII sin decisión de Paco), peor CLS y privacidad |
| C. Display más ligero: **Instrument Serif** (20,5 KB, solo peso 400) | −45 KB | Menos «carácter» a tamaños de texto (sin eje óptico) y es hoy una elección muy frecuente en sitios genéricos |
**Elegido: A.** Alternativas medidas: Newsreader 128,9 KB (descartada por peso), Young Serif 26,4 KB, Cormorant 36,8 KB (fina para cuerpo de 22 px).

### 3.5 Tests frágiles de la UI (D-225) — riesgo principal

| Enfoque | Coste | Notas |
|---|---|---|
| A. **Conservar nombres de clase** (`.sheet`, `.primary`, `.reopen`, `.chip`, `.reset`, `.panel`, `.close`, `.loading`, `.done`) y ajustar los specs por **textos** y por la **regex de CSS** en el mismo cambio | bajo | Los 8+ casos de `.sheet/.primary/.reopen` y los de `.chip` no cambian; solo se editan aserciones de texto |
| B. Renombrar a BEM (`help__sheet`…) | alto | ≈ 25 aserciones reescritas sin ganancia visible |
| C. Sustituir los tests por `data-testid` | medio | Mejor a largo plazo, pero cambia selectores en `viewer.component.spec` también |
**Elegido: A.** Detalle de qué se actualiza en §6.

## 4. Arquitectura del cambio

```
config/scene.config.ts   + DECOR_CONFIGURATIONS {clock, vase}, MODEL_CONFIGURATIONS += {landscapePainting, succulent},
                           FLOOR_TEXTURES / RUG_TEXTURES (rutas, repetición, tinte), TRIM (alto, fondo, color)
interfaces/scene.interface.ts   + DecorConfiguration
services/room-builder.service.ts   + Group 'room-trim' (zócalo fusionado, alfombra), loadTextures(), dispose de texturas
services/scene.service.ts   + loadDecor() (Group 'decor', raycast anulado), progreso con claves `decor:*` y `tex:*`, getRenderStats()
services/model-loader.service.ts   (sin cambios de lógica; helper `disableRaycast(object)` exportado)
config/ui-text.ts   FURNITURE_TEXT (5) + UI_TEXT reescrito
styles.scss   tokens, @font-face, base
components/*   solo var(--…); un componente = un dueño
assets/models/{landscape_painting,wall_clock,succulent,ceramic_vase}/ , assets/textures/{floor,rug}/ , assets/fonts/
scripts/optimize-models.mjs   WebP --quality 85, resize por pieza
```

Contratos entre pistas (para paralelizar):
- **`FURNITURE_TEXT.landscapePainting` y `.succulent`** los crea la pista UI en T-201 **antes** de que la pista Escena importe `scene.config.ts`. Mientras tanto la pista Escena no integra.
- **Rutas de assets** (fijas, las crea la pista Assets): `assets/models/landscape_painting/scene.gltf`, `assets/models/wall_clock/scene.gltf`, `assets/models/succulent/scene.gltf`, `assets/models/ceramic_vase/scene.gltf`; texturas `assets/textures/floor/{diff,nor,arm}.webp` y `assets/textures/rug/{diff,nor}.webp`; fuentes `assets/fonts/fraunces-var-latin.woff2` y `assets/fonts/hanken-grotesk-var-latin.woff2`.
- **API de depuración** `SceneService.getRenderStats(): {calls, triangles, textures, geometries}` (lectura de `renderer.info`), la crea T-230 y la usan T-200 y T-295 para medir.

## 5. Archivos a tocar (dueño único por archivo; ver tasks.md)

| Pista | Archivos |
|---|---|
| Assets (A) | `scripts/optimize-models.mjs`, `src/assets/models/{4 piezas}/**`, `src/assets/textures/**`, `docs/assets-pipeline.md` |
| Escena (E) | `src/app/config/scene.config.ts`, `src/app/interfaces/scene.interface.ts`, `src/app/services/{room-builder,scene,model-loader}.service.ts` + sus specs, `camera.service.spec.ts` (y `camera.service.ts` solo si T-237 lo exige) |
| UI global (U) | `src/styles.scss`, `src/index.html`, `src/assets/fonts/**`, `src/assets/brand/**`, `src/favicon.ico`, `src/app/config/ui-text.ts` + `ui-text.spec.ts` |
| UI componentes (C1–C3) | uno por componente: `loading-screen`, `brand-label`, `error-banner`, `error-overlay`, `viewer.component.scss`, `help-panel`, `object-list`, `description-panel`, cada uno con su spec |
| Docs (D) | `README.md`, `docs/media/**`, `docs/baseline/**`, `src/assets/brand/og.png` |

## 6. Riesgos

| # | Riesgo | Prob./impacto | Mitigación |
|---|---|---|---|
| R1 | **`components.spec.ts:125-138`** (regex sobre el CSS inline: `animation: …panel-in 0.2s` y el `@media (prefers-reduced-motion: reduce) { .panel … animation: none`) falla en cuanto se tokenizan duraciones | Alta / medio | T-202 **parte** `components.spec.ts` por componente (movimiento puro, sin cambiar aserciones). El test pasa a comprobar *presencia de la regla* (`animation:[^;]*panel-in` y un `@media (prefers-reduced-motion: reduce)` que contenga `animation: none`), sin acoplarse a la duración (SC-215). Lo actualiza la tarea del componente en el mismo cambio |
| R2 | Clases `.sheet/.primary/.reopen/.chip/.reset/.panel/.close/.loading/.done` fijadas por ≥ 8 casos | Media / alto | Se **conservan** (D-225): cambian el CSS, no los nombres |
| R3 | Aserciones de texto: `components.spec` chips `toEqual([...])` (nombres), título «How to explore» (`:222-290`), `scene.service.spec.ts:253` («Poker Table»), conteos `getObjectList()` 2/3/3/2 (`:254,261,271,515`), `camera.service.spec.ts:325-329` (mapa `sizes` lanza `TypeError` con clave nueva) | Alta / medio | Cada una la edita el dueño del archivo de su fuente de cambio (tabla en tasks.md, columna «specs»). Nombres nuevos: «Sectional sofa», «Poker table», «Bookshelf», «Landscape painting», «Potted succulent»; título «Controls» |
| R4 | `room-builder.service.spec.ts:28` espera 6 mallas en `scene.children` | Media / bajo | Zócalo y alfombra van en `Group` (`room-trim`), que no es `isMesh`; `dispose` los quita (`scene.children` = 0) |
| R5 | `ui-text.spec` exige `metadata === FURNITURE_TEXT[id]` por entrada | Baja | Solo las interactivas están en `MODEL_CONFIGURATIONS`; `DECOR_CONFIGURATIONS` no lleva `metadata` |
| R6 | Orientación/escala de los glTF de Poly Haven distinta de la supuesta (miran a +Z, Y arriba) | Media / medio | T-250 verifica con capturas desde la vista inicial y desde el muro; ajustar `rotation` es un cambio de config |
| R7 | Alfombra mal alineada con el sofá girado (la huella exacta del sofá es inferida) | Media / bajo | `Box3` real en un test de colocación (SC-203) y ajuste visual en T-250 |
| R8 | Presupuesto: `.bin` meshopt estimado, no medido | Media / bajo | Margen de 1,4 MiB frente al tope de 5 MiB; T-213 mide y reescribe la tabla de la spec |
| R9 | Texturas en móvil (VRAM) | Baja | 44 MiB estimados (SC-201), 512 px en piezas pequeñas; si el FPS móvil empeora > 10 %, bajar el suelo a 512 (−12 MiB) |
| R10 | Normal map del suelo con luces `SpotLight` produce moiré a distancia | Baja / bajo | mipmaps + anisotropía 8; `normalScale` 0,6; si aparece, quitar el normal (−43 KB) |
| R11 | Selección por contorno (stencil) sobre un cuadro plano pegado al muro | Media / medio | Se comprueba en T-250; si el contorno se funde con el muro, aumentar su grosor solo para esa pieza |
| R12 | `focusOn` en una pieza de muro puede encuadrar en ángulo rasante | Media / medio | Prueba específica con captura (SC-213); ajustar la dirección de aproximación si se ve oblicuo |
| R13 | Fuente web no cargada → salto de maquetación | Baja | `font-display: swap`, `size-adjust`, `preload`; SC-206/SC-212 miden CLS |
| R14 | Calidad WebP 85 ensucia las normales | Baja | Revisión visual en T-213; subir a 90 solo para `normal` si hace falta (+≈ 100 KB en total) |
| R15 | `anyComponentStyle` (6 kB) | Baja | Tokens reducen CSS; se vigila en `npm run build` |

**Cómo se probará**: unitarios (Vitest) para config, `loadDecor`, `room-builder`, colocación con `Box3`, lista negra de copy, reduced-motion; `npm run lint:check && npm run build && npm test`; script de pesos (`du -sb src/assets`, tabla por pieza); `getRenderStats()` en navegador para draw calls/tris; DevTools Performance (frame time) en escritorio y móvil con CPU ×4; Lighthouse accesibilidad/rendimiento; capturas 1280×800 y 390×844 de las 6 escenas de SC-213 comparadas con `mockups/` y con la línea base.

## 7. Decisiones (recomendación aplicada · alternativa)

| ID | Decisión | **Recomendación (la que asume tasks.md)** | Alternativa | Coste del cambio de opinión |
|---|---|---|---|---|
| D-220 | Fuentes | Autoalojar Fraunces + Hanken Grotesk (99,6 KB) | Google Fonts CDN; o Instrument Serif (−45 KB) | CDN: 1 línea en `index.html` pero rompe VII. Serif ligera: cambiar 1 woff2 y 1 token |
| D-221 | Origen de la decoración | Poly Haven CC0 (4 modelos) + procedural (alfombra, zócalo) | Todo procedural | Reescribir 4 piezas como geometrías (≈ −0,5 MiB, peor acabado) |
| D-222 | Ruta no interactiva | `DECOR_CONFIGURATIONS` aparte | flag `interactive: false` | Tocar `ModelId`, `getObjectList`, specs |
| D-223 | Interactivas | Cuadro y suculenta (lista de 5) | Ninguna (lista de 3) o todas (6) | Mover una entrada entre `DECOR_` y `MODEL_CONFIGURATIONS` + su texto |
| D-224 | Ficha móvil | ≤ 34 dvh (hoy 30) para que quepan título + 2 frases + crédito sin scroll; con scroll interno si no | mantener 30 dvh | Un valor de CSS |
| D-225 | Clases y specs | Conservar nombres; actualizar aserciones de texto y la regex | BEM / `data-testid` | ≈ 25 aserciones |
| D-226 | Iconos | Ayuda sin iconos; un glifo propio en `Reset view`; X de terminales rectos | mantener los 6 iconos redibujados | +6 SVG (≈ 1,5 KB) |
| D-227 | Modo oscuro | No | `prefers-color-scheme` | Duplicar tokens de color; capturas ×2 |
| D-228 | Suelo | `laminate_floor_02` (roble claro, tablas finas) | `wood_floor` (más oscuro) o `herringbone_parquet` (más llamativo, 16K) | Cambiar 3 ficheros y la repetición |
| D-229 | Alfombra | `poly_wool_herringbone` tintada cálida (gris-topo tejido) | `cotton_jersey` / `terlenka` (lisas, beige) | Cambiar 2 ficheros y el tinte |
| D-230 | Escalas | Cuadro ×2, reloj ×2, jarrón y suculenta ×2,2 | Escala real (se pierden a 12 m) | Un número por pieza |
| D-231 | Calidad WebP | 85 explícita | defecto del CLI (≈ ×4 de peso) | — |
| D-232 | Atribución | En `details` de las dos interactivas (CC0) y en README para todas | Solo README | Quitar una línea de texto |

## 8. Preguntas abiertas para Paco (no respondidas aquí; sin ellas el plan sigue con la recomendación)

1. **¿Quieres que el crédito CC0 aparezca también en la ficha** de la suculenta y el cuadro? Recomendación: sí, línea pequeña como hoy con los modelos de Sketchfab (coherencia). Si no, se borra el `details` de ambas.
2. **¿Autorizas el cambio de favicon y de `og.png`?** El favicon propuesto (marco sobre sofá) sustituye al cubo; el `og.png` se regenera al final con una captura real. Recomendación: sí a ambos.
3. **¿Aceptas que el sofá, la mesa y la estantería cambien de nombre** («Modern Sofa» → «Sectional sofa», «Poker Table» → «Poker table»)? Es un cambio de copy que afecta a tests y capturas. Recomendación: sí (mayúscula de frase en toda la UI).
4. **¿Pasamos el PR por la rama `orq/11221609` o abrimos uno propio hacia `main`?** Esta spec asume integrarse en `orq/11221609` sin push.
