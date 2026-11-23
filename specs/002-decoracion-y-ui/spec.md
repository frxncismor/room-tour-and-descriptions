# Especificación: Decoración sobria y UI con identidad propia

**Feature**: `002-decoracion-y-ui` · **Fecha**: 2026-11-23 · **Estado**: Borrador para aprobación de Paco
**Base**: rama `orq/11221609` @ `15d1d5b` (Angular 21, three 0.187, Vitest). **Idioma**: spec/plan/tasks en español; la UI sigue en inglés (D-08 de la spec 001).
**Insumos**: `runs/11221609/11221609-explorador-ui2.md` (auditoría de UI), `…-explorador-escena2.md` (escena), `…-especialista-assets2.md` (candidatos) y las mediciones de esta spec (§Pesos medidos).
**Relación con la spec 001**: **sustituye D-06** («conservar modelos») y deja sin efecto el «fuera de alcance: contenido 3D nuevo» solo para lo descrito aquí. El resto de 001 sigue vigente (constitución incluida).

## Contexto y objetivo

Paco pidió «más elementos decorativos» y «que la UI se vea menos AI slop». Criterio rector, dicho por Paco: **«la idea es que se vea profesional»**.
Traducción operativa: acabado de portfolio sobrio y coherente. **Pocas piezas de calidad bien colocadas** (4 modelos + 1 alfombra, no una tienda de muebles), un suelo y un zócalo que dejen de parecer un plano gris, y una UI que comparta la paleta de la sala en lugar de la paleta por defecto de Tailwind.
Hoy la sala (16×16×4 m) tiene tres muebles, un suelo gris liso (`0xe0e0e0`), cuatro muros sin zócalo y una UI de tarjetas blancas translúcidas, chips «píldora», iconos de trazo genéricos y acento azul cielo.

**Fuera de alcance**: nuevos muebles grandes, físicas, modo oscuro, cambio de idioma, nuevas luces, cambio de tone mapping, tocar sofá/mesa/estantería (salvo su texto), backend, analítica. Nada de partículas, animaciones decorativas ni efectos de post-proceso.

## Historias de usuario

### US21 — La sala se ve habitada y cuidada (P1)
Como visitante, al entrar veo una sala con suelo de madera, zócalo, una alfombra bajo el sofá, un cuadro y un reloj en el muro del fondo y dos piezas junto a la estantería. Nada llama la atención por sí mismo; el conjunto se lee como una sala real.
**Prueba independiente**: captura 1280×800 y 390×844 de la vista inicial y de la vista del muro del fondo, comparadas con la línea base (`baseline.md`).
**Escenarios**:
1. *Dado* la vista inicial, *entonces* se ven suelo de madera, alfombra y las piezas del muro del fondo; no se ve ninguna pieza flotando ni atravesando un mueble o un muro.
2. *Dado* un clic en el cuadro o en la suculenta, *entonces* se selecciona (contorno, ficha, cámara) igual que un mueble.
3. *Dado* un clic en la alfombra, el reloj o el jarrón, *entonces* no se selecciona nada: la alfombra se comporta como suelo (la cámara se desplaza) y el resto deja pasar el clic.
4. *Dado* el teclado/lector de pantalla, *entonces* la lista de piezas contiene solo las interactivas (5) y el `aria-label` del canvas no promete lo que no hay.

### US22 — Una UI con identidad, no una plantilla (P1)
Como visitante (o revisor técnico) la interfaz me parece del mismo mundo que la sala: papel cálido, tinta oscura, terracota y verde azulado; tipografía con carácter; sin brillos ni efectos de «cristal».
**Prueba independiente**: capturas de carga, vista inicial, ayuda abierta y ficha abierta en 1280×800 y 390×844 frente a `mockups/`; Lighthouse accesibilidad 100.
**Escenarios**:
1. *Dado* la carga, *entonces* se ve el título en serif, la byline, una línea de progreso de 2 px y el porcentaje; sin degradado ni barra «píldora».
2. *Dado* cualquier panel, *entonces* es opaco, con borde fino y radio ≤ 4 px; no hay `backdrop-filter`.
3. *Dado* la lista de piezas, *entonces* es un índice de texto con la pieza activa marcada por una regla lateral, no chips redondeados.
4. *Dado* un móvil de 390 px, *entonces* la lista pasa a una tira horizontal superior y las fichas son hojas inferiores ≤ 34 % de la altura (30 % hoy; ver D-224).
5. *Dado* `prefers-reduced-motion: reduce`, *entonces* no hay transiciones ni animaciones en ningún componente (incluida la ayuda).

### US23 — Textos concretos (P2)
Como visitante leo nombres y descripciones breves, factuales y sin adjetivos apilados.
**Escenarios**: cada descripción ≤ 2 frases y ≤ 30 palabras; dice qué es y dónde está; no aparece ninguna palabra de la lista negra (FR-241).

## A. Decoración

### A.1 Piezas finales

Fuente de todas: **Poly Haven (CC0)**. Licencia: <https://polyhaven.com/license> (CC0 1.0, sin obligación de atribución; se acredita en el README por cortesía, ver FR-205). Pesos verificados con la API pública `https://api.polyhaven.com/files/<id>` y mediciones propias (§Pesos medidos). Las coordenadas son de escena (m, Y arriba); sala x,z ∈ [-8, 8], muro del fondo en z = -8 (mira a +z). Para los modelos, `position.x/z` es el **centro de la caja** y `yOffset` es la **altura de la base** (así lo aplica `ModelLoaderService.applyTransformations`).

| # | Pieza | Origen y URL | Autor(es) | Pos. (x, y, z) · rot. Y · escala | Tamaño final | Interactiva |
|---|---|---|---|---|---|---|
| 1 | **Alfombra** (procedural) | textura [`poly_wool_herringbone`](https://polyhaven.com/a/poly_wool_herringbone) 1K, tinte `0xf0e6d8` | colormass, Rico Cilliers | centro (-1.5, 0.004, -1.5) · π/4 · plano 4,2 × 3,0 m | 2 triángulos | No (suelo) |
| 2 | **Cuadro** | [`fancy_picture_frame_01`](https://polyhaven.com/a/fancy_picture_frame_01) | Rob Tuytel, Rico Cilliers | x=-4, base y=1,2 (centro 1,66), z=-7,975 · 0 · ×2 | 1,21 × 0,93 m, 938 tris | **Sí** |
| 3 | **Reloj de pared** | [`wall_clock`](https://polyhaven.com/a/wall_clock) | PierreB3D | x=4, base y=1,38 (centro 1,70), z=-7,95 · 0 · ×2 | ⌀ 0,64 m, 3 658 tris | No |
| 4 | **Suculenta en maceta** | [`potted_plant_04`](https://polyhaven.com/a/potted_plant_04) | James Ray Cock | x=1,85, base y=0, z=-7,55 · π/6 · ×2,2 | 0,37 × 0,41 × 0,59 m, 6 097 tris | **Sí** |
| 5 | **Jarrón de cerámica** | [`ceramic_vase_02`](https://polyhaven.com/a/ceramic_vase_02) | James Ray Cock | x=-1,85, base y=0, z=-7,55 · 0 · ×2,2 | 0,48 × 0,48 × 0,68 m, 2 756 tris | No |
| — | **Suelo de madera** | textura [`laminate_floor_02`](https://polyhaven.com/a/laminate_floor_02) 1K (difusa, normal, ARM) | Dario Barresi, Charlotte Baglioni | el plano `floor` existente; repetición 16/1,7 ≈ 9,41 × 9,41 | — | No (sigue siendo `floor`) |
| — | **Zócalo** (procedural) | color `0xf3ece1`, rugosidad 0,8 | — | 4 tramos pegados a los muros, 0,12 m alto × 0,02 m, **una sola malla fusionada** | 48 tris | No |

Notas de colocación (verificadas con `scene.config.ts` y la huella de los muebles):
- Cuadro y reloj quedan en x = ∓4, justo donde los focos 2 y 3 (`(-4,3.8,-7)` y `(4,3.8,-7)`) ya iluminan el muro de fondo: la iluminación existente los destaca sin añadir luces. Estantería (x ∈ [-0,91; 0,91], altura 2,13) queda centrada entre ambos: composición simétrica y sobria.
- Suculenta y jarrón flanquean la estantería a 1,85 m de su eje, a 0,45 m del muro (huella ≤ 0,48 m), sin tocar sofá (x,z ≤ -0,4) ni mesa (x ≥ 2,35).
- La alfombra (semidiagonal ≈ 2,55 m) cubre x,z ∈ [-4,05; 1,05]: queda bajo el frente del sofá (girado π/4, igual que ella), lejos de la mesa (x ≥ 2,35) y de la zona de entrada (z > 5). Eleva 4 mm con `polygonOffset` para evitar z-fighting con el suelo.
- Los valores de escala (×2 y ×2,2) llevan los objetos de «tamaño de catálogo» a un tamaño legible en una sala de 16 m (un cuadro de 0,6 m se perdería a 12 m de la cámara inicial: ≈ 2,3° de campo visual). Siguen siendo tamaños plausibles de objetos reales (cuadro 1,2 m, reloj 0,64 m, jarrón de suelo 0,68 m).
- **Orientación y posiciones finas son hipótesis hasta verlas**: los glTF de Poly Haven miran a +Z con Y arriba; la alfombra se alinea con la rotación real del sofá. T-250 ajusta con capturas; las tolerancias de aceptación están en SC-203.

Descartadas (y por qué): `hanging_picture_frame_01` (la imagen es un recuadro gris con texto de plantilla), `potted_plant_01/02` (96K/70K tris), `decorative_book_set_01` (sin glTF, 113K tris), `dirty_carpet` (acabado sucio/desgastado, contrario a «profesional»), `throw_pillows_01` (patrón chevron rojo, demasiado ruidoso sobre el sofá), `vintage_oil_lamp`/`brass_vase_*` (decoración recargada, 1,5–2 MB de origen), `planter_pot_clay` (pieza rústica «sucia»), Kenney/Quaternius (low-poly: choca con los PBR).

### A.2 Textos de las piezas interactivas (`FURNITURE_TEXT`, ≤ 2 frases, sin adjetivos apilados)

| id | `name` | `description` | `details` (crédito) |
|---|---|---|---|
| `landscapePainting` | Landscape painting | Oil landscape of a mill and a river, in a gilt frame with beaded molding. It hangs on the back wall, lit by a spotlight. | Model: "Fancy Picture Frame 01" by Rob Tuytel and Rico Cilliers, Poly Haven (CC0). |
| `succulent` | Potted succulent | Zebra haworthia in a weathered ceramic pot, set beside the bookshelf. | Model: "Potted Plant 04" by James Ray Cock, Poly Haven (CC0). |

Los textos de sofá, mesa y estantería se reescriben en B.5.

### A.3 Mejoras de la sala (sobrias)

- **Suelo**: madera clara (`laminate_floor_02`, color medio ≈ `#9c8164`) en lugar de gris plano. Material `MeshStandardMaterial` con `map` (sRGB), `normalMap` (escala 0,6) y `roughnessMap` (canal G de ARM); `roughness` 1 (la modula el mapa), `metalness` 0, anisotropía ≤ 8.
- **Zócalo**: cremoso (`0xf3ece1`), alinea el encuentro suelo-muro y da escala.
- **Fondo de escena** (`scene.background`): `0xf0f0f0` → `0xece2d1` (papel hundido). Solo se ve antes del primer frame y al perder el contexto; el cambio evita un destello gris sobre la pantalla de carga de papel.
- **No se toca**: colores de muros, luces, sombras, tone mapping, cámara.

### A.4 Requisitos funcionales — decoración

- **FR-200**: `DECOR_CONFIGURATIONS` (config nueva en `scene.config.ts`) describe las piezas **no interactivas** reales (reloj, jarrón) con la forma de `ModelConfiguration` sin `metadata`. `MODEL_CONFIGURATIONS` incorpora `landscapePainting` y `succulent` (interactivas, con `metadata` de `FURNITURE_TEXT`).
- **FR-201**: las piezas no interactivas se cargan con `ModelLoaderService.loadModel`, se añaden a un `Group` `decor` y **no** se registran en `ObjectInteractionService` ni en `getObjectList()`. Todas sus mallas llevan `raycast = () => undefined` (patrón ya usado en los contornos), de modo que el clic y el hover las atraviesan.
- **FR-202**: alfombra y zócalo los construye `RoomBuilderService` (procedurales) dentro de un `Group` `room-trim` (la alfombra con `raycast` anulado: el clic cae en el suelo y la cámara se desplaza). Se liberan geometría, material y texturas en `dispose`.
- **FR-203**: las texturas del suelo y la alfombra se cargan **antes** de ocultar la pantalla de carga y cuentan en su progreso. El suelo no «salta» de gris a madera. Si una textura falla: el suelo/alfombra conservan color plano y se muestra el aviso no bloqueante existente (principio V).
- **FR-204**: pipeline de assets: `scripts/optimize-models.mjs` fija **WebP calidad 85** (explícita; con la calidad por defecto los JPG de origen **engordan**, medido: ×4 en el difuso del jarrón) y una política de resolución por pieza (ver tabla de pesos). Los originales siguen sin versionarse; `docs/assets-pipeline.md` documenta la fuente (URLs de A.1) y el procedimiento.
- **FR-205**: README: tabla de créditos ampliada (Poly Haven CC0, con autor y enlace, y las dos fuentes con su licencia OFL), nota de que CC0 no exige atribución. `src/assets/fonts/OFL.txt` incluye la licencia de las fuentes.
- **FR-206**: `camera.service.spec.ts` (mapa `sizes`) y los conteos de `scene.service.spec.ts` (hoy 2/3/3/2) se actualizan en el mismo cambio que añade las dos piezas interactivas (pasan a 4/5/5/4).
- **FR-207**: `canvasLabel` no enumera muebles (queda válido al crecer la lista): «Interactive 3D view of a living room. Use the list of pieces to inspect each one with the keyboard.»

### A.5 Presupuesto y medición (rendimiento)

#### Pesos medidos

Método: API de Poly Haven (`/files/<id>`, tamaños por resolución, **medidos**), texturas 1K descargadas **fuera del repo** (carpeta temporal), redimensionadas y convertidas a WebP con ImageMagick (calidad 85, `method=4`; **medido**). La geometría (`.bin`) tras `meshopt --level high` se **estima** al 30 % del `.bin` de origen (los ratios reales del repo, 5–7× en sofá y mesa, la respaldan; a confirmar con el pipeline real en T-213).

| Pieza | Descarga 1K de origen (API) | Resolución final de textura | Texturas WebP q85 (medido) | `.bin` meshopt (est.) | JSON | **Total en repo** |
|---|---|---|---|---|---|---|
| Cuadro | 724 KB (8 ficheros) | canvas difusa 1024, resto 512 | 146 KB | 8 KB | 5 KB | **≈ 159 KB** |
| Reloj | 1 528 KB (6) | 512 | 65 KB | 39 KB | 9 KB | **≈ 113 KB** |
| Suculenta | 2 073 KB (5) | 512 | 134 KB | 71 KB | 7 KB | **≈ 212 KB** |
| Jarrón | 733 KB (5) | 512 | 64 KB | 86 KB | 3 KB | **≈ 153 KB** |
| Suelo | 1 790 KB (3 JPG) | 1024 (difusa 183, normal 43, ARM 57) | 282 KB | — | — | **282 KB** |
| Alfombra | 1 941 KB (2 JPG) | 512 (difusa 62, normal 49) | 110 KB | — | — | **110 KB** |
| Fuentes (woff2, subset latin) | — | — | — | — | — | **99,6 KB** (Fraunces 65,7 + Hanken Grotesk 33,9) |
| **Suma nueva** | | | | | | **≈ 1,10 MiB** |

- Estado actual: `src/assets` = 2 624 958 B (2,50 MiB). **Previsto: ≈ 3,6 MiB**.
- Medido con calidad 100 y el mismo tamaño (1024 px), las texturas de estas seis piezas sumarían ≈ 17 MB (el difuso del jarrón pasa de 96 KB en JPG a 411 KB): razón de FR-204.

#### Criterios medibles

- **SC-200 (peso)**: `du -sb src/assets` ≤ 5 242 880 B (5 MiB) **y** objetivo ≤ 4 194 304 B (4 MiB). Cada pieza ≤ su valor de la tabla + 25 %. Ninguna textura > 1024 px. Transferencia total en primera visita (modelos+texturas+fuentes) ≤ 5 MB (límite de la 001: 8 MB).
- **SC-201 (memoria de GPU)**: suma de texturas nuevas (RGBA8 con mipmaps) ≤ 48 MiB; estimado 44 MiB (suelo 16, cuadro 12, reloj 5,3, suculenta 4, jarrón 4, alfombra 2,7).
- **SC-202 (coste de dibujo)**: con `renderer.info` en la vista inicial, *draw calls* ≤ línea base + 14 (estimado +10) y triángulos ≤ línea base + 16 000 (estimado +13 500). Solo la suculenta y el jarrón proyectan sombra (+3 mallas en el pase de sombras); cuadro, reloj, alfombra y zócalo no.
- **SC-203 (colocación)**: ninguna pieza con AABB que interseque la de un mueble ni la de otra pieza (test unitario con `Box3`); base de objetos de suelo a y = 0 ± 0,02; cuadro y reloj a 0,02–0,06 m del muro (sin atravesarlo ni flotar); alfombra a y ≤ 0,01 y sin cruzar la AABB de la mesa.
- **SC-204 (fluidez)**: mediana de tiempo de frame en la vista inicial (300 frames, mismo equipo, DPR acotado a 2) ≤ línea base × 1,10; escritorio ≥ 55 fps (SC-005 de 001); móvil emulado 390×844 con CPU ×4 más lenta: no peor que la línea base + 10 %. Ciclos de `ApplicationRef.tick` en reposo: 0.
- **SC-205 (interacción)**: tests: `getObjectList()` = 5 ids exactos; ningún objeto de `decor`/`room-trim` es impactado por el raycaster; clic sobre la alfombra produce `floorPoint`; los 3 muebles previos se seleccionan igual.
- **SC-206 (carga)**: sin CLS por fuentes o texturas: CLS ≤ 0,02 en Lighthouse; el progreso sube de forma monótona hasta 100 con las texturas incluidas.

## B. UI con identidad

### B.1 Dirección visual

**Concepto: «papel de plano de interiorismo».** Superficies de papel cálido opaco con filete fino, tinta marrón casi negra, **terracota** (el sofá, `0xa65f3a`) como único color de acción y **verde azulado** (el muro de acento, `0x6f8f8c`) para foco e indicadores. Sin gradientes, sin cristal, sin sombras de color. Serif de display para los títulos (la «voz» de la pieza), sans humanista para el texto. Jerarquía en tres niveles: título en serif (≥ 22 px), texto 15 px, metadatos 12–13 px en mayúsculas espaciadas o gris cálido.

Mockups: `mockups/index.html` (`#loading`, `#overview`, `#help`, `#detail`; escritorio por ancho > 600 px) y `mockups/mobile-frame.html?s=<pantalla>` (marco real de 390×844). Capturas PNG de cada pantalla en `mockups/`: `desktop-*.png` (1280×800) y `mobile-*.png` (390×844). El fondo del mockup es un esquema plano, no el render real.

### B.2 Tokens (sustituyen a todos los valores sueltos)

Definidos en `:root` de `src/styles.scss`; los componentes **solo** usan `var(--…)`.

| Grupo | Token | Valor | Uso |
|---|---|---|---|
| Color | `--paper` | `#f6efe4` | superficie de paneles, pantalla de carga |
| | `--paper-sunk` | `#ece2d1` | hover/activo, fondo de escena |
| | `--ink` | `#2a2420` | texto principal |
| | `--ink-muted` | `#5c5046` | texto secundario, créditos |
| | `--rule` | `#d8cab6` | filetes decorativos (no portan información) |
| | `--rule-strong` | `#8c7d6e` | bordes de controles |
| | `--clay` / `--clay-hover` | `#8a4426` / `#733820` | acción primaria, pieza activa, enlace |
| | `--teal` (= `--focus`) | `#35544f` | foco visible |
| | `--danger` | `#7a2a1c` | banda de error |
| Tipografía | `--font-display` | `'Fraunces', Georgia, 'Times New Roman', serif` | títulos |
| | `--font-text` | `'Hanken Grotesk', system-ui, 'Segoe UI', Roboto, sans-serif` | todo lo demás |
| | `--fs-label/small/body/title/display` | 0,75 / 0,8125 / 0,9375 / 1,375 / 2,25 rem | escala de 5 pasos (hoy: 11 tamaños sueltos) |
| | `--lh-tight` / `--lh-body` | 1,2 / 1,5 | |
| Espacio | `--space-1…6` | 4 / 8 / 12 / 16 / 24 / 32 px (rem) | base 4 px; fuera `14px`, `18px`, `20px` |
| Forma | `--radius-1` / `--radius-2` | 2 px / 4 px | controles / paneles (fuera `999px`, 12, 20) |
| Sombra | `--shadow-panel` | `0 1px 2px rgb(42 36 32/.08), 0 12px 28px -14px rgb(42 36 32/.35)` | única sombra, solo paneles flotantes |
| Movimiento | `--dur-1/2/3` | 120 / 200 / 400 ms | hover / paneles / carga |
| | `--ease` | `cubic-bezier(.2,.7,.2,1)` | |
| Interacción | `--hit` | 44 px | tamaño táctil mínimo |

Breakpoints (literales con comentario, porque `var()` no vale en `@media`): `max-width: 600px` y `max-height: 500px` (móvil/bottom sheet y landscape), `max-width: 380px` (tira compacta), `pointer: coarse` (táctil). **Se mantienen las condiciones actuales**; se corrige el comentario de 360 → 380 px.

### B.3 Tipografía

| Familia | Uso | Archivo (latin, woff2) | Peso | Licencia |
|---|---|---|---|---|
| **Fraunces** (variable, ejes `opsz` + `wght` 300–700) | títulos de ficha/ayuda/carga, marca | `assets/fonts/fraunces-var-latin.woff2` | **65,7 KB** | SIL OFL 1.1, Undercase Type |
| **Hanken Grotesk** (variable `wght` 400–600) | texto, listas, botones | `assets/fonts/hanken-grotesk-var-latin.woff2` | **33,9 KB** | SIL OFL 1.1, Hanken Design Co. |

- **Autoalojadas** (D-220): `@font-face` en `styles.scss`, `font-display: swap`, `font-optical-sizing: auto`, y `<link rel="preload" as="font" type="font/woff2" crossorigin>` solo del archivo de display y del de texto (2 peticiones, 99,6 KB). Sin servicio externo (principio VII).
- **Fallback con métricas ajustadas** (`size-adjust`, `ascent-override`) para ≤ 0,02 de CLS; el texto es legible con la fuente de sistema mientras llega la web.
- El texto de la escena 3D no usa fuentes (no hay texto en el canvas).

### B.4 Rasgos de «plantilla de IA»: antes → después

| # | Rasgo (informe UI, archivo:línea) | Antes | Después |
|---|---|---|---|
| 1 | Cristal: `backdrop-filter` en `description-panel:81`, `help-panel:200`, `object-list:103`; blanco 0,96 en 4 sitios | `blur(6–8px)` + `rgb(255 255 255 / .96)` | Papel **opaco** `--paper` + borde `--rule`; ni blur ni alfa. `rg backdrop-filter src` = 0 |
| 2 | Degradado radial de carga `loading-screen:47-51` | `radial-gradient(surface, bg)` gris | Fondo plano `--paper` |
| 3 | Emojis (solo en capturas antiguas) | — | Sin emojis (ya ocurre); se regeneran las capturas obsoletas (T-290) |
| 4 | Set de iconos de trazo 1,8 redondeado (6 en ayuda, casa, X) | iconos tipo Lucide | Ayuda **sin iconos** (lista de definiciones); `Reset view` con un glifo propio de trazo 1,5 y esquinas rectas (el test exige un `svg`); X con terminales rectos |
| 5 | Píldoras: chips `999px` `object-list:78`, `.reopen` `help-panel:272`, barra `loading-screen:83` | `border-radius: 999px` | Índice de texto con regla lateral; botón rectangular 2 px; barra de 2 px. `rg 999px src` = 0 |
| 6 | Sombras y radios uniformes (`shadow-md` ×5; 12/20 px) | tarjeta blanca redondeada con sombra | Una sola sombra para paneles flotantes; radios 2/4 px; controles sin sombra |
| 7 | Fuente del sistema `styles.scss:15-17` | `system-ui…` | Fraunces + Hanken Grotesk (B.3) |
| 8 | Paleta Tailwind por defecto (`#0ea5e9`, `#0369a1`, `#1f2937`) y `theme-color #1f2937` | azul cielo/pizarra | Paleta de B.2 derivada de la sala; `theme-color` = `#35544f` |
| 9 | Favicon cubo isométrico `favicon.svg` | cubo celeste sobre pizarra | Marco de cuadro sobre un sofá (SVG de B.6), verde azulado y terracota |
| 10 | Textos de relleno (`ui-text.ts:99-115` y otros) | «invites you to sit back…», «touch of character» | B.5 |
| 11 | Cabecera de «landing» (título 1,9 rem + byline + tarjeta de carga) | tarjeta centrada con h1 de 1,9 rem | Pantalla de carga tipográfica: título serif 36 px, byline, línea de progreso; marca en una placa de papel con filete |
| 12 | Ayuda en tono de manual con iconos y «Got it» | «How to explore» / «Got it» | «Controls» / «Close»; términos en negrita + descripción, sin iconos |
| 13 | Valores sueltos: `#fff` ×8, `#075985`, `#b91c1c`, `rgb(...)` ×6, `--color-overlay` sin uso | 11 literales de color fuera de tokens | 0 literales fuera de `:root`; `--color-overlay` se elimina |
| 14 | Transiciones sin token (0,15/0,2/0,25/0,4 s) y la ayuda sin `prefers-reduced-motion` | | `--dur-*`; **todas** anuladas con `prefers-reduced-motion` (incluida la ayuda) |
| 15 | Duplicados en `help-panel` (`.sheet` y `ul` dos veces en el `@media`) | | Se fusionan |

### B.5 Textos (inglés)

**Piezas** (`FURNITURE_TEXT`; ≤ 2 frases, ≤ 30 palabras; los créditos en `details` se conservan):

| id | Antes | Después |
|---|---|---|
| `sofa` | «Modern Sofa» — «A low-profile contemporary sofa with generous seat cushions and clean, softly rounded lines. It anchors the living area and invites you to sit back…» | **Sectional sofa** — «Corner sectional with loose back cushions and a separate ottoman, in a terracotta tone. It anchors the seating area on the left.» (21 palabras) |
| `pokerTable` | «Poker Table» — «A game table with a felt-style playing surface, a padded rail and a polished wooden frame. It is sized for a relaxed night of cards…» | **Poker table** — «Card table with a felt playing surface, a padded rail and a wooden frame. It stands on the right, opposite the sofa.» (22) |
| `bookshelf` | «Bookshelf» — «A tall, open bookshelf with several tiers… adding useful storage and a touch of character.» | **Bookshelf** — «Open shelving in four tiers, in dark wood. It stands against the back wall, centered between the painting and the clock.» (21) |
| `landscapePainting`, `succulent` | — | ver A.2 |

**Interfaz** (`UI_TEXT`): `loading.status` «Preparing the room» → «Loading the room»; `errors.webglTitle` «3D view unavailable» → «WebGL is not available»; `errors.contextLostTitle` «Reconnecting the 3D view» → «The 3D view was interrupted»; `errors.webglHelp` → «This viewer needs WebGL. Use a recent Chrome, Edge, Firefox or Safari, with hardware acceleration on.»; `errors.retry` «Try again» → «Retry»; `list.title` «Furniture» → «Pieces»; `list.resetView` «Initial view» → «Reset view»; `list.resetViewLabel` → «Return to the initial view»; `help.title` «How to explore» → «Controls»; `help.open` «Help» → «Controls»; `help.openLabel` → «Show the controls»; `help.gotIt` «Got it» → «Close»; controles: «Look around» → «Orbit», «Slide sideways» → «Pan», «Walk» → «Move», «Inspect furniture» → «Inspect», «Keyboard» → «Keys»; textos: «Click the floor to go there», «Click a piece to read about it», «Esc closes details. Home resets the view.» (táctil: «Tap the floor to go there», «Tap a piece to read about it», «Tap the cross to close details»). **Se conservan** «Room Tour», «by Francisco Moreno», «Drag with the left mouse button», «Drag with one finger», «Pinch with two fingers» (los asertan los tests).

### B.6 Marca y metadatos

Favicon (`src/assets/brand/favicon.svg`), un marco de cuadro sobre un sofá:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="8" fill="#35544f"/>
  <rect x="14" y="12" width="36" height="26" fill="none" stroke="#f6efe4" stroke-width="3"/>
  <rect x="12" y="44" width="40" height="8" rx="2" fill="#c9744a"/>
</svg>
```

`favicon.ico` y `apple-touch-icon.png` se regeneran desde ese SVG (ImageMagick). `theme-color` → `#35544f`. `og.png` se regenera al final con una captura real (T-290).

### B.7 Contraste (AA) con los hex propuestos

Calculado con la fórmula WCAG 2.x (luminancia relativa sRGB). Umbral: texto normal ≥ 4,5; texto grande y componentes de UI ≥ 3.

| Primer plano | Fondo | Ratio | Uso | Cumple |
|---|---|---|---|---|
| `--ink` `#2a2420` | `--paper` `#f6efe4` | **13,40** | texto principal | AA y AAA |
| `--ink` | `--paper-sunk` `#ece2d1` | 11,93 | texto en fila activa/hover | AA y AAA |
| `--ink-muted` `#5c5046` | `--paper` | **6,83** | créditos, metadatos | AA |
| `--ink-muted` | `--paper-sunk` | 6,08 | ídem sobre hover | AA |
| `--paper` | `--clay` `#8a4426` | **6,26** | texto del botón primario | AA |
| `--clay` | `--paper` | 6,26 | enlace «Reset view» | AA |
| `--clay` | `--paper-sunk` | 5,58 | ídem en hover | AA |
| `--paper` | `--clay-hover` `#733820` | ≥ 7,5 (más oscuro que `--clay`) | botón en hover | AA |
| `--teal` `#35544f` | `--paper` | **7,26** | anillo de foco 2 px | ≥ 3 (1.4.11) |
| `--paper` | `--danger` `#7a2a1c` | **8,45** | texto de la banda de error | AA y AAA |
| `--rule-strong` `#8c7d6e` | `--paper` | 3,49 | borde del botón «Controls» | ≥ 3 (1.4.11) |
| `--rule` `#d8cab6` | `--paper` | 1,41 | filetes decorativos | n/a (no portan información) |

Referencia de lo que se reemplaza: `#6b7280` sobre `#f0f0f0` = **4,24 (no cumple AA)**; sobre blanco 4,83. Descartado `#a65f3a` (el terracota del sofá) como color de texto: 4,26 sobre `--paper`.

### B.8 Requisitos funcionales — UI

- **FR-230**: `styles.scss` define los tokens de B.2, el `@font-face` y los estilos base; se elimina `--color-overlay` y la paleta anterior. Ningún componente declara hex, `rgb()`, `px` de radio ni duraciones propias.
- **FR-231**: tipografía autoalojada (B.3) con `preload`, `font-display: swap` y fallback con métricas ajustadas; `OFL.txt` incluido.
- **FR-232**: ningún `backdrop-filter`, ningún `border-radius: 999px`, ninguna sombra distinta de `--shadow-panel`, ningún degradado.
- **FR-233**: lista de piezas como índice de texto (B.1), pieza activa con `aria-pressed="true"` y regla `--clay`; en ≤ 600 px / ≤ 500 px de alto, tira horizontal superior con subrayado; el botón de reinicio conserva `aria-label`, el `svg` y oculta el texto en móvil.
- **FR-234**: ficha (`.panel`): título `h2` en serif, descripción, línea de crédito bajo filete; en móvil hoja inferior ≤ 34 dvh con scroll interno. Se conserva la región `aria-live="polite"` fuera del `@if` y el `role="dialog"`.
- **FR-235**: ayuda (`.sheet`) como lista de definiciones (`dl`) sin iconos, botón `.primary` «Close», botón `.reopen` rectangular «Controls»; mantiene `role="dialog"`, `aria-modal="false"` y el retorno del foco a `.reopen`; la regla de ocultar el último ítem en táctil se reexpresa sin depender de `li:last-child` (atributo `data-keyboard`).
- **FR-236**: pantalla de carga tipográfica (B.1) con `role="progressbar"`, `aria-valuenow/min/max/text`; clases `.loading` y `.done` intactas.
- **FR-237**: banda y tarjeta de error con `--danger` / `--paper`, mismos roles (`alert`) y botón «Retry».
- **FR-238**: foco visible en todo control: `outline: 2px solid var(--focus)` con `outline-offset: 2px` (en el canvas, el borde interior ya existente con el mismo token).
- **FR-239**: `prefers-reduced-motion: reduce` anula **todas** las transiciones y animaciones, incluidas las de la ayuda y la barra de carga.
- **FR-240**: responsive: se mantienen las condiciones 600 / 500 / 380 px y el tamaño táctil 44 px (`--hit`) en `pointer: coarse`; sin scroll horizontal de página a 320–1920 px.
- **FR-241**: copy según B.5; **lista negra** (test con regex sobre `UI_TEXT` y `FURNITURE_TEXT`): `generous|stunning|seamless|perfect|beautiful|sleek|elegant|cozy|inviting|invites|touch of|polished|modern|contemporary|ultimate|effortless`.
- **FR-242**: `index.html`: `theme-color` `#35544f`, enlaces de `preload` de fuentes, favicons nuevos; descripciones OG sin cambios salvo coherencia de nombres.

### B.9 Criterios medibles — UI

- **SC-210**: `rg "backdrop-filter|999px|linear-gradient|radial-gradient" src` → 0 resultados; `rg "#[0-9a-fA-F]{3,8}\b|rgb\(" src/app/components` → 0 (los hex viven en `styles.scss`, `scene.config.ts`, `index.html` y el favicon).
- **SC-211**: **Lighthouse accesibilidad = 100** en escritorio y móvil sobre la build de producción servida (`npx -y lighthouse <url> --only-categories=accessibility`), y contrastes de B.7 reproducidos por script (tabla de ratios en el PR).
- **SC-212**: rendimiento de carga: transferencia inicial JS ≤ 900 kB (presupuesto de `angular.json`), CLS ≤ 0,02, la UI aparece con fuente de fallback sin salto > 2 px de altura de línea.
- **SC-213**: capturas 1280×800 y 390×844 de carga, vista inicial, ayuda abierta y ficha del sofá y del cuadro: ningún panel solapa el elemento enfocado; la ficha del móvil ≤ 34 % de la altura; se adjuntan al PR y se comparan con `mockups/`.
- **SC-214**: copy: cada `description` ≤ 2 frases y ≤ 30 palabras; 0 coincidencias de la lista negra (test).
- **SC-215**: `prefers-reduced-motion`: test que comprueba, en el CSS de cada componente con animación o transición, un bloque `@media (prefers-reduced-motion: reduce)` que las anula (sustituye al test por regex de duración, ver plan §6).
- **SC-216 (repo verde)**: `npm run lint:check && npm run build && npm test` en verde en cada integración (constitución I); `npm run build` sin avisos de presupuesto nuevos (`anyComponentStyle` 6 kB).

## Decisiones (todas con recomendación aplicada; alternativa en el plan §7)

D-220 fuentes autoalojadas Fraunces + Hanken Grotesk · D-221 modelos Poly Haven CC0 + alfombra procedural · D-222 decoración no interactiva en config separada · D-223 interactivas: cuadro y suculenta · D-224 hoja móvil ≤ 34 dvh (en vez de 30) · D-225 se conservan nombres de clase y se actualizan specs · D-226 ayuda sin iconos · D-227 sin modo oscuro · D-228 suelo `laminate_floor_02` · D-229 alfombra `poly_wool_herringbone` tintada · D-230 escalas ×2 / ×2,2 · D-231 WebP calidad 85 · D-232 créditos CC0 en `details` de las interactivas y en README.
Detalle, alternativas y coste en `plan.md` §7. Preguntas que solo Paco puede responder: `plan.md` §8.
