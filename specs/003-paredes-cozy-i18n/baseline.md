# Línea base 003 (T-300)

Medida el **2026-11-23** sobre `orq/11221609-r3-verif` (HEAD `6f93f3e` = código de `4ea4c08` + solo docs de la spec 003; mismo código y assets).
Sin cambios de código ni de assets. T-390…T-396 (F5) deben repetir **el mismo método** y comparar con estas cifras.
Esta base es, en la práctica, la **final de la 002** (con los arreglos de la ronda 2 posteriores a `verification.md`), de ahí que algunas cifras difieran de la base 002.

## Entorno

| Dato                 | Valor                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Equipo               | AMD Ryzen 7 5700X (8 núcleos), 32 GB RAM, NVIDIA GeForce RTX 4060, Windows 11 Pro (máquina compartida con otros agentes)              |
| Navegador            | Chrome 157.0.8103.79, `--headless=new --use-angle=d3d11 --enable-unsafe-swiftshader --ignore-gpu-blocklist` (perfil nuevo por página) |
| GPU / renderer WebGL | `ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)` → **GPU real**                                 |
| Node / Angular       | Node 22.12.0, `npm ci`, Angular 21, three 0.187                                                                                       |
| Emulación            | Escritorio 1280×800 DPR 1. Móvil 390×844 DPR 1 (CDP `Emulation.setDeviceMetricsOverride` mobile + táctil), CPU ×4 en el frame time    |
| Servidores           | Build de producción servida con `scripts-r2\static-server.mjs` en el puerto 4421; `ng serve` (dev) en 4422 solo para `__rtad.stats()` |

Scripts (fuera del repo): `C:\Users\paco_\.config\orquestacion\runs\11221609\scripts-r2\{baseline-capture,static-server}.mjs` y, nuevos,
`...\scripts-r3\f0\{run-frames.ps1,agg.mjs,stats.mjs}` (JSON y salidas de lh en esa misma carpeta).

## 1. Capturas (`docs/baseline/003-base-*.png`, EN)

|                                                           | Escritorio 1280×800            | Móvil 390×844                 |
| --------------------------------------------------------- | ------------------------------ | ----------------------------- |
| Carga (red limitada a ~600 kB/s; escritorio 37 % visible) | `003-base-desktop-loading.png` | `003-base-mobile-loading.png` |
| Vista inicial (ayuda cerrada)                             | `003-base-desktop-initial.png` | `003-base-mobile-initial.png` |
| Ayuda abierta                                             | `003-base-desktop-help.png`    | `003-base-mobile-help.png`    |
| Ficha del sofá (chip «Sectional sofa»)                    | `003-base-desktop-sofa.png`    | `003-base-mobile-sofa.png`    |

Comando (sobre la build de producción servida): `node ...\scripts-r2\baseline-capture.mjs --url http://127.0.0.1:4421/ --out docs/baseline --prefix 003-base --prod --port 9441`.
Las ocho capturas se han revisado a ojo: muro del fondo verde azulado liso, cuadro y reloj con foco cálido, sin láminas, cortinas ni lámpara (aún no existen).

## 2. `window.__rtad.stats()` en la vista inicial (build de desarrollo, ayuda cerrada, +≈3,7 s de asentamiento)

Comando: `npx ng serve --port 4422 --host 127.0.0.1` + `scripts-r3\f0\stats.mjs http://127.0.0.1:4422/`.

| Vista               | draw calls | triángulos    | texturas | geometrías |
| ------------------- | ---------- | ------------- | -------- | ---------- |
| Escritorio 1280×800 | **168**    | **1 147 358** | **41**   | **54**     |
| Móvil 390×844       | **161**    | **1 139 510** | **37**   | **51**     |

Coherencia con `specs/002-decoracion-y-ui/verification.md` (final 002: escritorio 168 / 1 156 714 / 41 / 53; móvil 161 / 1 148 866 / 37 / 50):
draw calls y texturas **idénticos**. Los triángulos bajan ≈ 9 400 (−0,8 %) probablemente porque después de esa medida se quitaron las sombras de suculenta y jarrón (no verificado por bisección)
(menos pasadas contadas por `renderer.info`); la geometría sube de 53 → 54 (y 50 → 51) por el ribete de la alfombra y el zócalo sin raycast de la ronda 2.
Respecto a la base 002 original (149 / 1 118 814 / 20 / 45) la diferencia es la decoración de la 002 (ver `verification.md` §3).

## 3. Frame time (300 fotogramas `requestAnimationFrame`, vista inicial, ayuda cerrada)

Comando: `scripts-r3\f0\run-frames.ps1 -N 5` → 5 veces `node scripts-r2\baseline-capture.mjs --url http://127.0.0.1:4421/ --no-shots --uncapped --prod`
(`--uncapped` = `--disable-gpu-vsync --disable-frame-rate-limit`; build de **producción**; cada ejecución mide escritorio y luego móvil con CPU ×4). Resolución de `performance.now()`: 0,1 ms.

| Plataforma (5 ejecuciones) | Medianas de cada ejecución (ms) | **Mediana de medianas** | Rango (mín–máx) | p95 (mediana de ejecuciones) |
| -------------------------- | ------------------------------- | ----------------------- | --------------- | ---------------------------- |
| Escritorio, sin límite     | 1,9 · 1,3 · 0,9 · 0,7 · 0,7     | **0,9 ms**              | 0,7–1,9         | 1,3 ms                       |
| Móvil emulado CPU ×4       | 12,0 · 8,1 · 5,8 · 6,0 · 8,3    | **8,1 ms**              | 5,8–12,0        | 11,0 ms                      |

Carga de CPU de la máquina (media del 100 % de núcleos antes→después de cada ejecución): 35→41, 31→37, 35→15, 15→22, 17→10 % (media ≈ 26 %).
Las dos primeras ejecuciones, con la máquina más cargada, son las más altas; las tres con CPU ≤ 22 % dan escritorio 0,7–0,9 y móvil 5,8–8,3 ms.
Con una máquina en reposo la referencia es **escritorio ≈ 0,7 ms, móvil ≈ 6 ms**. Con vsync (una sola ejecución, captura de §1): escritorio 6,1 ms, móvil CPU ×4 18,0 ms (p95 30,3 ms; ejecución con la máquina cargada).
Coherente con `verification.md` §4 (final 002: móvil 7,4 ms, escritorio 1,0 ms, con CPU media ≈ 37 %; gate < 16,7 ms en móvil ✓: aquí 8,1 ms ✓).

## 4. Peso de `src/assets`

`du -sb src/assets` → **3 717 013 B** (3,54 MiB) ≤ 4 194 304 B. (`verification.md` 002 anotaba 3 720 960 B; la diferencia, −3 947 B, no se ha investigado su origen (probablemente arreglos posteriores de la ronda 2); el
presupuesto 003 prevé ≈ 4 004 719 B con las 6 texturas nuevas, ver T-313.)

## 5. `npm run build`

Comando: `npm run build` (producción, sin avisos de presupuesto ni de otro tipo).

| Fichero               | Bruto         | Transferido (estimado) |
| --------------------- | ------------- | ---------------------- |
| `main-P6LFASR5.js`    | 871,45 kB     | 194,38 kB              |
| `styles-GSNNMEZJ.css` | 2,13 kB       | 849 B                  |
| **Initial total**     | **873,58 kB** | **195,23 kB**          |

Un solo chunk inicial (`main`); no hay chunks perezosos todavía (ES y decor builder serán los primeros, T-391). Margen sobre el aviso de 880 kB: 6,42 kB; sobre el límite duro de 900 kB: 26,42 kB.
`dist/interior-viewer/browser` pesa 4 609 754 B en total (assets incluidos). Coincide con `verification.md` de la 002 (872,80 kB) y la cifra prevista de 873,58 kB. No hizo falta `--stats-json`.

## 6. Lighthouse 12.8.2 (build de producción servida, una ejecución por plataforma)

Comando: `npx -y lighthouse http://127.0.0.1:4421/ [--preset=desktop] --only-categories=performance,accessibility --output=json --chrome-flags="--headless=new --use-angle=d3d11 --enable-unsafe-swiftshader --ignore-gpu-blocklist"`.
CPU de la máquina ≈ 23 % durante la medida.

|                   | Móvil     | Escritorio |
| ----------------- | --------- | ---------- |
| **Accesibilidad** | **100**   | **100**    |
| **Rendimiento**   | **31**    | **50**     |
| FCP               | 5,4 s     | 0,9 s      |
| LCP               | 8,8 s     | 2,8 s      |
| TBT               | 4 060 ms  | 1 030 ms   |
| CLS               | 0         | 0,002      |
| Speed Index       | 6,2 s     | 2,5 s      |
| Peso de red       | 4 385 KiB | 4 385 KiB  |

Ninguna auditoría de accesibilidad falla (en escritorio `label-content-name-mismatch` ya pasa, arreglado en la ronda 2). Frente a `verification.md` (móvil 31 / escritorio 43, 59, 42):
móvil igual; escritorio 50 está dentro de la dispersión de las tres ejecuciones anteriores (el rendimiento de escritorio varía ±9 puntos entre ejecuciones por el TBT y el LCP).
Para T-390/T-392, comparar por **mediana de al menos 3 ejecuciones**.

## 7. SC-306: regiones de la captura base 1280×800 de la vista inicial

Comando (el del final de `tasks.md`, sobre `docs/baseline/003-base-desktop-initial.png`):

| Región                   | R,G,B       | Luma    | R−B    | Referencia 002                              |
| ------------------------ | ----------- | ------- | ------ | ------------------------------------------- |
| Techo `700x120+300+10`   | 125,117,108 | **118** | **17** | luma 118 / R−B 17 ✓                         |
| Escena `990x580+260+120` | 110,97,80   | **99**  | **30** | luma 98 / R−B 30 ✓ (+1 de ruido de captura) |
| Píxeles ≥ 250 en escena  | —           | **0 %** | —      | (límite de SC-306 ≤ 3 %)                    |

Todas las cifras coinciden (± ruido) con `verification.md` de la 002.

## Resumen de coincidencias con 002

| Cifra                     | 002 (`verification.md`) | Esta base               | ¿Coincide?                                 |
| ------------------------- | ----------------------- | ----------------------- | ------------------------------------------ |
| Assets (`du -sb`)         | 3 720 960 B             | 3 717 013 B             | ✓ (−0,1 %; arreglos de la ronda 2)         |
| Initial total             | 872,80 kB               | 873,58 kB               | ✓ (+0,78 kB)                               |
| Draw calls (esc. / móvil) | 168 / 161               | 168 / 161               | ✓ idénticas                                |
| Triángulos (esc. / móvil) | 1 156 714 / 1 148 866   | 1 147 358 / 1 139 510   | ✓ −0,8 % (sin sombras de suculenta/jarrón) |
| Techo luma / R−B          | 118 / 17                | 118 / 17                | ✓                                          |
| Escena luma / R−B         | 98 / 30                 | 99 / 30                 | ✓                                          |
| Lighthouse a11y           | 100 / 100               | 100 / 100               | ✓                                          |
| Frame time móvil CPU ×4   | 7,4 ms                  | 8,1 ms (rango 5,8–12,0) | ✓ (máquina más cargada al empezar)         |
