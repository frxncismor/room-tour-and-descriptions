# Verificación final 003 (T-390…T-396)

Medida el **2026-11-23** sobre `orq/11221609-r3-verif-f5` (HEAD `2febc46`: F0–F4 + textiles + lámpara a 2,2). Sin cambios de código ni de assets en esta tarea.
Base: `baseline.md` (código de `4ea4c08`). Mismo equipo y navegador que la base: Ryzen 7 5700X, RTX 4060, Chrome 157 `--headless=new --use-angle=d3d11` (GPU real), perfil nuevo por página,
1280×800 DPR 1 y 390×844 móvil emulado por CDP. **La máquina estaba compartida y cargada** (CPU media 45–99 % durante el ABAB; la base midió ≈ 26 %): las cifras de frame time son pesimistas.

Scripts (fuera del repo): `C:\Users\paco_\.config\orquestacion\runs\11221609\scripts-r3\f5\` (`run-abab.ps1`, `agg-abab.mjs`, `stats-vram.mjs`, `final-shots.mjs`, `i18n-check.mjs`, `tab-check.mjs`; JSON de cada medida en esa carpeta) y `scripts-r2\{baseline-capture,contrast-b7,static-server}.mjs`, `scripts-r3\sc306.mjs`.

## Resumen

| Criterio                                                  | Resultado                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm ci` limpio, `npm audit --omit=dev`                   | ✓ 0 vulnerabilidades                                                                                                |
| `lint:check && build && test` (SC-305)                    | ✓ 372 tests / 24 ficheros; build sin avisos                                                                         |
| Cobertura (`test:coverage`, umbral 70 %)                  | ✓ 95,99 / 85,27 / 95,51 / 97,71 % (stmts / branches / funcs / lines)                                                |
| SC-300 assets                                             | ✓ 4 003 539 B (3,82 MiB) ≤ 4 MiB                                                                                    |
| SC-301 bundle                                             | ✓ inicial 886,94 kB (aviso 890 kB, error 900 kB), 202,50 kB transferidos ≤ 220; ES y decor builder en chunks aparte |
| SC-302 frame time móvil ×4 (gate < 16,7 ms)               | ✓ **14,05 ms** (mediana de 10 medianas ABAB); 4 de 10 ejecuciones individuales por encima (máquina cargada)         |
| SC-303 coste de dibujo                                    | ✓ +8 642 tris, +16 geometrías, +31 calls, +10,15 MiB VRAM                                                           |
| SC-304 accesibilidad (Lighthouse 100 ×4, contraste, foco) | ✓ 100 en los 4 casos · contraste 12/12 · foco y tabulación ✓ · **✗ `label-content-name-mismatch` (peso 0)**         |
| SC-306 cozy                                               | ✓ techo 144 / R−B 58 · escena 111 / R−B 59 · 0 % saturados                                                          |
| SC-308 i18n funcional (6 casos)                           | ✓ 6/6                                                                                                               |
| SC-309 capturas EN+ES                                     | ✓ 32 capturas en `docs/baseline/003-final-*`                                                                        |

**Hallazgo ✗ (no corregido, para la pista dueña):** auditoría de Lighthouse `label-content-name-mismatch` (peso 0, no baja el 100) falla en los 4 casos; ver §5.

## 1. Repo verde y dependencias (T-396)

- `npm ci` en limpio: ✓. `npm audit --omit=dev`: **found 0 vulnerabilities**.
- `npm run lint:check`: ✓ (Prettier y ESLint sin avisos). `npm run build`: ✓ sin avisos de presupuesto. `npm test`: **372 tests pasan, 24 ficheros** (no baja respecto a F0; los informes previos de la ronda registran 368 tras F2).
- `npm run test:coverage`: umbral 70 % ✓ — All files 95,99 % stmts, 85,27 % branches, 95,51 % funcs, 97,71 % lines.

## 2. Peso y bundle (SC-300, SC-301, T-391)

`du -sb src/assets` → **4 003 539 B** (3,82 MiB) ≤ 4 194 304 B (base 3 717 013 B; +286 526 B; previsto ≈ 4 004 719 B ✓).

| Build de producción   | Base `4ea4c08` | Final                     |
| --------------------- | -------------- | ------------------------- |
| Initial total (bruto) | 873,58 kB      | **886,94 kB** (+13,36 kB) |
| Initial transferido   | 195,23 kB      | **202,50 kB** (≤ 220 ✓)   |

Chunks iniciales del final: `chunk-NJQHR7VJ` 579,72 · `main` 181,32 · `chunk-AZXZLIKA` 123,32 · `styles` 2,13 · `chunk-2NFLSA4Y` 0,45 kB.
**Chunks perezosos:** `decor-builder-service` 8,30 kB (3,42 transferidos), `es` 3,71 kB (1,57), `decor-config` 2,46 kB (0,99) — total 14,47 kB aparte. ✓ ES y decor builder son chunks propios.
El aviso de `angular.json` ya está en 890 kB (commit 6c4c921, decisión 6): margen 3,06 kB al aviso y 13,06 kB al error de 900 kB. No se toca.

## 3. Coste de dibujo y VRAM (SC-303, T-390)

`window.__rtad.stats()` (build de desarrollo servida con `ng serve`, ayuda cerrada, +3,7 s) en base y final:

| Vista      | Medida     | Base      | Final     | Δ          | Límite SC-303 |
| ---------- | ---------- | --------- | --------- | ---------- | ------------- |
| Escritorio | draw calls | 168       | 199       | **+31**    | ≤ +34 ✓       |
| Escritorio | triángulos | 1 147 358 | 1 156 000 | **+8 642** | ≤ 9 000 ✓     |
| Escritorio | texturas   | 41        | 49        | +8         | —             |
| Escritorio | geometrías | 54        | 70        | **+16**    | ≤ 20 mallas ✓ |
| Móvil      | draw calls | 161       | 186       | **+25**    | ≤ +34 ✓       |
| Móvil      | triángulos | 1 139 510 | 1 148 140 | **+8 630** | ≤ 9 000 ✓     |
| Móvil      | texturas   | 37        | 42        | +5         | —             |
| Móvil      | geometrías | 51        | 64        | +13        | ≤ 20 ✓        |

Luces (por código, `scene.config.ts`): ambiente, hemisférica, direccional (única con sombra), 3 focos y 1 puntual (lámpara) = **7 luces, 1 con sombra** ✓.
Escritorio y móvil difieren en 3 texturas de láminas porque three.js solo sube una textura al dibujar su malla por primera vez: en la vista inicial móvil (vertical) 3 de las 4 láminas quedan fuera del encuadre (no hay defecto; sí aparecen al orbitar).

**VRAM por textura** (sin tocar código: hook de `texStorage2D` de WebGL sobre la misma vista inicial; color con cadena de mipmaps completa, sin el mapa de sombras de 2048² profundidad = 12 MiB, que no cambia):

| Textura nueva                            | Escritorio | Móvil | VRAM aprox. c/u |
| ---------------------------------------- | ---------- | ----- | --------------- |
| Láminas 512×717 (RGBA/SRGB8_A8, mipmaps) | 4          | 1     | ≈ 1,96 MiB      |
| Lino difusa + normal 512×512             | 2          | 2     | ≈ 1,33 MiB c/u  |
| Canvas 64×64 + rampa 1×128               | 2          | 2     | ≈ 0,02 MiB      |

Total de color en GPU: base 172,6 MiB → final 182,8 MiB en escritorio (**+10,15 MiB**), 167,3 → 171,8 MiB en móvil (**+4,55 MiB**); límite SC-303 14 MiB ✓ (previsión de diseño 10,4 MiB). (Las cifras absolutas incluyen el suelo, las 4 texturas de 2048² y demás assets heredados.)

## 4. Frame time (SC-302, T-390)

Método: `baseline-capture.mjs --no-shots --uncapped --prod` (300 fotogramas `requestAnimationFrame`, vista inicial, ayuda cerrada; móvil 390×844 con CPU ×4, escritorio 1280×800), **10 pares ABAB** base/final (20 ejecuciones alternadas; base = `git archive 4ea4c08` en carpeta temporal fuera del repo, ya borrada). Servidos con `static-server.mjs` en los puertos 4531/4532.

| Móvil CPU ×4 | Medianas por par (base → final), ms                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Pares 1–10   | 9,6→10,2 · 11,3→12,7 · 13,5→16,9 · 16,3→21,7 · 12,7→13,9 · 11,0→14,2 · 10,0→13,8 · 11,4→18,4 · 10,4→13,9 · 10,2→16,4 |

| Plataforma               | Base: mediana de medianas (rango) | Final: mediana de medianas (rango) | p95 final (mediana · rango) | Cociente final/base (mediana · rango) |
| ------------------------ | --------------------------------- | ---------------------------------- | --------------------------- | ------------------------------------- |
| **Móvil ×4**             | 11,15 ms (9,6–16,3)               | **14,05 ms (10,2–21,7)**           | 34,3 ms · 31,1–62,9         | ×1,31 · 1,06–1,61 (informativo)       |
| Escritorio (informativo) | 1,3 ms (1,1–1,5)                  | 1,75 ms (1,5–2,5)                  | 2,45 ms · 2,1–3,7           | ×1,30 · 1,07–2,00                     |

- **Gate absoluto: 14,05 ms < 16,7 ms ✓** (mediana de las 10 medianas finales). Escritorio sin límite 1,75 ms ≫ 55 fps ✓ (570 fps nominales).
- **Carga de CPU de la máquina** (media de núcleos antes→después de cada ejecución): 45–99 %, media ≈ 62 % (lista en `cpu.txt`), frente al ≈ 26 % de la línea base 003. Por eso la base de este ABAB (11,15 ms) sale **más alta** que la de `baseline.md` (8,1 ms, ≈ 6 ms en reposo): los números absolutos son pesimistas; el cociente, medido por pares alternados bajo la misma carga, es la comparación fiable.
- Margen: 4 de las 10 ejecuciones finales (16,9 · 21,7 · 18,4 · 16,4 ms) superan 16,7 ms por separado, siempre con CPU ≥ 53 %; en las 4 de menor carga la mediana final fue 10,2 · 13,9 · 13,8 · 13,9 ms. El gate se define sobre la mediana y se cumple, pero **el margen real es estrecho en una máquina cargada** (×1,31 sobre la base).
- **p95 de 34,3 ms** (F4 midió 33,8 ms con mediana 12,7): son 1–2 fotogramas por cada 20 que tardan ~2 vsync; la base también los tiene (p95 mediana 25,4 ms, máx. 31–70 ms) y vienen de la competencia de CPU de la máquina compartida (emulación ×4 + otros agentes) ; no he aislado la causa exacta (no verificado por bisección), pero la base ya los muestra. La mediana (lo que se siente en reposo) es 14 ms; el p95 de la base ya incumpliría 16,7 ms. Informativo.

## 5. Lighthouse 12.8.2 y accesibilidad (SC-304, T-392)

Build de producción final servida; idioma por `--lang`/`--accept-lang` + cabecera `Accept-Language` (en ES se comprobó con la captura final de Lighthouse: textos «Piezas», «Controles», «Cerrar»). Una ejecución por caso.

| Caso          | Accesibilidad | Rendimiento | FCP   | LCP   | TBT      | CLS   |
| ------------- | ------------- | ----------- | ----- | ----- | -------- | ----- |
| EN móvil      | **100**       | 28          | 5,9 s | 8,3 s | 5 520 ms | 0     |
| EN escritorio | **100**       | 56          | 1,0 s | 1,5 s | 1 410 ms | 0,002 |
| ES móvil      | **100**       | 27          | 6,0 s | 9,1 s | 5 030 ms | 0     |
| ES escritorio | **100**       | 54          | 1,1 s | 1,7 s | 1 580 ms | 0,002 |

Rendimiento: móvil 31 → 27–28 y escritorio 50 → 54–56 respecto a la base (misma dispersión de ±9 puntos señalada en `baseline.md`; máquina cargada; no es criterio de la 003).

**✗ `label-content-name-mismatch`** (auditoría de peso 0, grupo oculto: no afecta al 100, pero la aceptación pide «sin `label-content-name-mismatch`»). Falla en los **4 casos** en los dos botones del selector de idioma
(`<button lang="en" aria-label="English (EN)">EN</button>` y `<button lang="es" aria-label="Español (ES)">ES</button>`: «Text inside the element is not included in the accessible name»;
el texto visible «EN»/«ES» sí aparece entre paréntesis en el nombre, pero Lighthouse no lo da por incluido) y, **solo en ES escritorio**, también en el botón «Restablecer vista»
(`class="chip reset" aria-label="Volver a la posición inicial de la vista"` frente al texto visible «Restablecer vista»: el nombre accesible no contiene el texto visible; en EN «Reset view» ⊂ «Reset view to the initial position» sí pasa).
Sugerencia para la pista UI (no aplicada): nombre accesible que **empiece** por el texto visible («EN — English», «ES — Español», «Restablecer vista: volver a la posición inicial»).

**Contraste AA** (`contrast-b7.mjs` sobre `src/styles.scss`, tokens reales): **12/12 ✓, ningún cambio frente a la 002.** Son los mismos tokens para EN y ES (el idioma solo cambia las cadenas, no los colores).

| fg / bg                | Ratio | Umbral | Uso                                |
| ---------------------- | ----- | ------ | ---------------------------------- |
| ink / paper            | 13,40 | 4,5    | texto principal (ayuda, ficha ES)  |
| ink / paper-sunk       | 11,93 | 4,5    | fila activa / hover                |
| ink-muted / paper      | 6,83  | 4,5    | créditos, metadatos                |
| ink-muted / paper-sunk | 6,08  | 4,5    | ídem sobre hover                   |
| paper / clay           | 6,26  | 4,5    | botón «Cerrar»                     |
| clay / paper           | 6,26  | 4,5    | «Restablecer vista»                |
| clay / paper-sunk      | 5,58  | 4,5    | ídem en hover                      |
| paper / clay-hover     | 7,94  | 4,5    | botón en hover                     |
| teal / paper           | 7,26  | 3      | anillo de foco, botón EN/ES activo |
| paper / danger         | 8,45  | 4,5    | banda de error                     |
| rule-strong / paper    | 3,49  | 3      | borde del selector y «Controles»   |
| rule / paper           | 1,41  | n/a    | filetes decorativos                |

**Foco visible y tabulación** (`tab-check.mjs`, CDP, EN y ES): anillo `outline` de 2 px en cada botón enfocado (teal 7,26:1 sobre papel; tinta 13,4:1 y papel 7,26:1 sobre el botón activo teal) ≥ 3:1 ✓.
Orden de tabulación idéntico en ambos idiomas y conforme al DOM: selector EN → ES → «Controles» → piezas (5 chips) → «Restablecer vista» → lienzo.
**Sin desbordes a 360/390 px en ES:** ver capturas `003-final-es-mobile-*` (390 px); a 360 px las capturas de la pista CB (`r3-ui-comp-b-es-m360-*`) siguen siendo las vigentes (no se cambió UI desde entonces).

## 6. i18n funcional por CDP (SC-308, T-393) — 6/6 ✓

Build de producción final, Chrome con perfil nuevo; salida completa en `scripts-r3\f5\i18n.log` y `...\f5out\r3-i18n-results.json`; capturas en `runs\11221609\capturas\r3-i18n-*.png`.

1. **Primera pintura en ES (`--lang=es-ES`, red limitada a 600 kB/s) ✓.** Un `MutationObserver` instalado antes de cualquier script registró 18 instantáneas; las 14 con la pantalla de carga muestran **solo** «Room Tour · POR FRANCISCO MORENO · Cargando la sala · n %» (0 instantáneas en inglés). La primera con `app-root` ya renderizado (t = 2 080 ms) tiene `lang="es"` y título ES. Antes de ese instante `app-root` está vacío (solo el fondo de papel): no hay pintura en EN. Nota: `index.html` estático trae `lang="en"` y título EN durante ≈ 2 s hasta que arranca el inicializador (visible solo en la pestaña, no en la página; el `<noscript>` es bilingüe).
2. **Cambio EN↔ES con la ficha del sofá abierta, sin navegación ✓.** «Sectional sofa» → «Sofá rinconera» → «Sectional sofa» → «Sofá rinconera»; la ficha sigue abierta, `window.__marker` se conserva, 0 `frameNavigated` nuevos, 0 excepciones. Anuncio del lector: «Idioma: español». Captura `r3-i18n-2-*`.
3. **Persistencia ✓.** Navegador EN → elijo ES → `localStorage['room-tour.locale']='es'` → recargo con `Accept-Language: fr-FR` → arranca en ES. Navegador ES → detectado `es` → elijo EN → recargo → arranca en EN (lo guardado gana a la detección).
4. **`localStorage` bloqueado ✓.** El getter lanza `SecurityError`; la app arranca, detecta ES por el navegador, el cambio a EN y de vuelta a ES funciona dentro de la sesión, sin excepciones; al recargar vuelve a detectar (nada se guardó). Captura `r3-i18n-4-*`.
5. **ES con chunk que falla ✓.** (a) Arranque en ES con la URL del chunk `es` bloqueada: arranca en **EN** con el aviso «Could not load Spanish. Staying in English.» + botón «Retry»; tras desbloquear y pulsar «Retry» pasa a ES y el aviso desaparece. (b) EN ya cargado y red cortada (offline) al pulsar ES: mismo aviso, la app sigue en EN y el lienzo sigue vivo (1280×800); al volver la red y reintentar pasa a ES. 0 excepciones. Capturas `r3-i18n-5a-*`, `r3-i18n-5b-*`.
6. **`<html lang>`, título y `meta[name=description]` tras cada cambio ✓.** En todos los pasos de 2–5: `lang` y `title` coinciden con el idioma activo, `meta description` cambia a ES («Explora un salón en 3D en tu navegador…») y a EN («Explore a 3D living room…»), y `aria-label` del lienzo y título de la lista («Piezas»/«Pieces») también. Se mantiene EN tras un fallo de carga.

## 7. Capturas EN y ES (SC-309, T-394) — `docs/baseline/003-final-{en,es}-{desktop,mobile}-<vista>.png`

Vistas: `loading`, `help`, `initial`, `sofa` (ficha), `suculenta` (ficha), `muro-fondo` (recorte ×1,5/×3 de la vista inicial con el muro del fondo), `ventana` (recorte ×2 de la ventana), `estanteria` (ficha de la estantería, encuadre cercano) = 8 × 2 idiomas × 2 formatos = **32 PNG** (9,6 MB). Copias en `C:\Users\paco_\.config\orquestacion\runs\11221609\capturas\r3-{en,es}-{desktop,mobile}-<vista>.png`.
Revisadas a ojo (hojas de contacto de las 6 vistas principales en EN y ES, escritorio y móvil, y los recortes de muro y ventana): textos 100 % en el idioma elegido (carga, selector, lista, ayuda, ficha, créditos con el título del modelo en original), sin desbordes a 390 px, ficha y ayuda legibles.

**Diferencias intencionadas frente a `002-final-*` / `003-base-*`** (constitución II; todas previstas por la spec 003):

1. Muro del fondo liso verde azulado → **cuatro láminas** (azules cianotipo y crema, repartidas a ambos lados de la estantería) más cuadro y reloj ahora a 1,60 m; **apliques** con halo cálido a ambos lados de la estantería. Las láminas se leen en la vista inicial de escritorio ✓.
2. **Ventana con cortinas** verde oliva y barra latón en el muro izquierdo, con luz cálida de entrada.
3. **Lámpara de pie** en la esquina izquierda (pantalla crema encendida).
4. **Textiles en el sofá**: cojines abombados crema y azul verdoso y manta color arena con caída (paleta crema/azul verdoso/arena).
5. **Luz cálida**: techo y escena visiblemente más cálidos (SC-306, §8); suelo y paredes en el mismo tono pero sin lavado.
6. **UI**: selector EN | ES y marca «Room Tour · by Francisco Moreno» abajo a la izquierda; lista y ayuda con tipografía y cadenas traducidas (ES: «Piezas», «Controles», «Cerrar»…).
7. **Pantalla de carga** con marca y estado traducido.

**No intencionadas: ninguna encontrada.** La forma y la posición del sofá, la mesa y la estantería no cambian; el contorno de selección sigue la silueta (ahora también con los textiles); no hay clipping de cortinas/láminas con muebles en las vistas capturadas.
Observaciones menores (no son regresiones): (a) en móvil vertical la vista inicial solo encuadra una lámina y la ventana en el borde; (b) en `estanteria` (encuadre de la ficha) las láminas quedan fuera de plano; el muro completo está en `muro-fondo`.

## 8. SC-306 (cozy) y regresión (T-395)

Método de la 002 (`sc306.mjs`, regiones fijas) sobre la captura final de la vista inicial 1280×800 (EN; ES idéntica porque la ayuda está cerrada y la UI visible es la misma región). Doble comprobación con el comando `magick` de `tasks.md`: techo `168,140,109 luma=144`, escena `133,108,74 luma=111`, saturados 0 %.

| Región                     | Final (EN y ES)               | Base 003 / 002 | Criterio SC-306             |
| -------------------------- | ----------------------------- | -------------- | --------------------------- |
| Techo `700x120+300+10`     | luma **144,5** · R−B **58,1** | 118,8 / 16,4   | luma 120–160 ✓ · R−B ≥ 30 ✓ |
| Escena `990x580+260+120`   | luma **111,6** · R−B **58,9** | 99,4 / 30,5    | luma ≥ 90 ✓ · R−B ≥ 38 ✓    |
| Píxeles RGB ≥ 250 (escena) | **0,00 %**                    | 0 %            | ≤ 3 % ✓                     |

Las 4 cifras dentro de rango. La ayuda y la ficha siguen legibles (contraste de §5 no depende de la escena).
**Regresión por inspección** (`003-final-*-sofa/suculenta/estanteria` frente a `003-base-*-sofa`): sofá (silueta, esquina y puf), mesa de póker y estantería sin cambios de forma; las sombras del sofá, la estantería y la mesa son las mismas (misma dirección y dureza); lo único nuevo en la zona es la manta y los cojines, intencionados.

## 9. Resumen de desviaciones y puntos abiertos

- ✗ `label-content-name-mismatch` (§5): botones EN/ES (4 casos) y «Restablecer vista» (solo ES escritorio). Peso 0; accesibilidad sigue en 100.
- Frame time: gate cumplido por la mediana (14,05 ms) pero con margen estrecho y bajo CPU de máquina muy cargada (≈ 62 %); p95 34,3 ms (§4). Conviene repetirlo en una máquina en reposo si se quiere un número limpio (referencia de la base en reposo ≈ 6 ms).
- Se matan por error 4 procesos `node` de `ng serve` identificados por línea de comandos al limpiar; coincidían con los dos servidores propios (puertos 4533/4534).
- Cadenas ES para validar por Paco: ver `runs\11221609\i18n-es.md` (T-396).
