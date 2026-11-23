# Línea base 002 (T-200)

Medida el **2026-11-23** sobre `orq/11221609-verif` (commit `19ff43a`, ya con F0: `window.__rtad.stats()` en dev).
Sin cambios de código ni de assets. F4 (T-295) debe repetir **el mismo método** y comparar con estas cifras.

## Entorno

| Dato                 | Valor                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Equipo               | AMD Ryzen 7 5700X (8 núcleos), 32 GB RAM, NVIDIA GeForce RTX 4060 (driver 32.0.16.1742), Windows 11 Pro                                      |
| Navegador            | Chrome 157.0.8103.79, `--headless=new` (UA `HeadlessChrome/157`)                                                                             |
| GPU / renderer WebGL | `ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)` → **GPU real** (`--use-angle=d3d11`), no swiftshader  |
| Node / Angular       | Node 22.12.0, `npm ci`, Angular 21, three 0.187                                                                                              |
| Emulación            | Escritorio 1280×800 DPR 1. Móvil 390×844 DPR 1 (CDP `Emulation.setDeviceMetricsOverride` mobile + táctil), CPU ×4 en la medida de frame time |

Script reutilizable (fuera del repo): `C:\Users\paco_\.config\orquestacion\runs\11221609\scripts-r2\baseline-capture.mjs`
(CDP puro, sin dependencias; salidas JSON de esta corrida en la misma carpeta: `r-capped.json`, `r-uncapped.json`, `r-sw.json`, `lh-mobile.json`, `lh-desktop.json`).

## 1. Capturas (`docs/baseline/002-*.png`, todas < 300 kB, PNG sin metadatos)

|                                                    | Escritorio 1280×800       | Móvil 390×844            |
| -------------------------------------------------- | ------------------------- | ------------------------ |
| Carga (red limitada a ~600 kB/s para verla, ≈50 %) | `002-desktop-loading.png` | `002-mobile-loading.png` |
| Vista inicial (ayuda cerrada)                      | `002-desktop-initial.png` | `002-mobile-initial.png` |
| Ayuda abierta                                      | `002-desktop-help.png`    | `002-mobile-help.png`    |
| Ficha del sofá (chip «Modern Sofa»)                | `002-desktop-sofa.png`    | `002-mobile-sofa.png`    |

Comando: `node C:\Users\paco_\.config\orquestacion\runs\11221609\scripts-r2\baseline-capture.mjs --out docs/baseline --prefix 002`
(con `npm start` sirviendo en `http://localhost:4200/`).

## 2. `window.__rtad.stats()` en la vista inicial (build de desarrollo, `npm start`)

| Vista               | draw calls | triángulos    | texturas | geometrías |
| ------------------- | ---------- | ------------- | -------- | ---------- |
| Escritorio 1280×800 | **149**    | **1 118 814** | **20**   | **45**     |
| Móvil 390×844       | 147        | 1 118 810     | 20       | 44         |

Referencia: la cifra de escritorio es la de la línea base; la diferencia móvil viene del frustum culling con otra relación de aspecto.
Medida tras cerrar la ayuda y esperar ≈1,2 s a que la cámara de entrada se asiente.

## 3. Frame time (300 fotogramas con `requestAnimationFrame`, vista inicial, ayuda cerrada)

Comando: `node …\scripts-r2\baseline-capture.mjs --out <dir> --no-shots [--uncapped] [--angle swiftshader]` (mismo script que arriba).

| Configuración                                                                                         | Mediana  | p95      | Media    | Máx      |
| ----------------------------------------------------------------------------------------------------- | -------- | -------- | -------- | -------- |
| Escritorio, GPU real, con vsync                                                                       | 6,10 ms  | 6,20 ms  | 6,06 ms  | 6,20 ms  |
| Escritorio, GPU real, **sin límite** (`--uncapped`: `--disable-gpu-vsync --disable-frame-rate-limit`) | 0,80 ms  | 1,10 ms  | 0,81 ms  | 1,60 ms  |
| Móvil emulado, CPU ×4, GPU real, con vsync                                                            | 24,2 ms  | 78,8 ms  | 30,6 ms  | 121,3 ms |
| Móvil emulado, CPU ×4, GPU real, sin límite                                                           | 32,7 ms  | 64,0 ms  | 32,9 ms  | 98,8 ms  |
| _Referencia lenta:_ escritorio, swiftshader (CPU)                                                     | 799,9 ms | 836,4 ms | 793,4 ms | 866,6 ms |
| _Referencia lenta:_ móvil CPU ×4, swiftshader                                                         | 539,4 ms | 563,6 ms | 540,4 ms | 575,8 ms |

Notas:

- El vsync del monitor de esta máquina es ≈165 Hz (6,1 ms): por eso la mediana de escritorio con límite no baja de ahí. Para comparar rendimiento **usar la fila «sin límite»**, que sí refleja el coste real por fotograma. En móvil emulado la CPU ×4 domina; la dispersión entre ejecuciones es grande (p95 muy superior a la mediana), así que comparar en F4 con varias repeticiones y tolerancia ±25 %.
- swiftshader solo se anota por si otro entorno sin GPU lo necesita; no es la referencia.

## 4. Peso de `src/assets`

Comando: `du -sb src/assets` (y por carpeta).

| Carpeta                | Bytes                                              |
| ---------------------- | -------------------------------------------------- |
| **`src/assets` total** | **2 624 958** (≈ 2,50 MiB)                         |
| `brand/`               | 130 176                                            |
| `models/`              | 2 494 782                                          |
| `models/sofa/`         | 1 525 000 (`scene.bin` 1 445 408)                  |
| `models/poker_table/`  | 837 640 (`Table_Game_Wood_baseColor.webp` 403 526) |
| `models/bookshelf/`    | 132 142                                            |

## 5. Lighthouse (build de producción servido)

Comandos (desde `npm run build`, salida en `dist/interior-viewer/browser`):

```
npx -y http-server dist/interior-viewer/browser -p 4183 -s
CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" npx -y lighthouse http://localhost:4183/ [--preset=desktop] --only-categories=performance,accessibility --output=json --output-path=lh-<mobile|desktop>.json --chrome-flags="--headless=new --use-angle=d3d11 --enable-unsafe-swiftshader --ignore-gpu-blocklist" --quiet
```

(Puerto **4183** en lugar de 4173: el 4173 estaba ocupado por otro proceso ajeno.) Lighthouse 12.8.2, mismo Chrome 157.

|                   | Móvil (throttling por defecto: 4G lento, CPU ×4) | Escritorio (`--preset=desktop`) |
| ----------------- | ------------------------------------------------ | ------------------------------- |
| **Accesibilidad** | **100**                                          | **100**                         |
| **Rendimiento**   | **31**                                           | **46**                          |
| FCP               | 5,3 s                                            | 0,9 s                           |
| LCP               | 19,0 s                                           | 3,3 s                           |
| TBT               | 3 180 ms                                         | 1 060 ms                        |
| CLS               | 0                                                | 0,001                           |
| Speed Index       | 5,8 s                                            | 2,5 s                           |
| Peso total de red | 3 288 KiB                                        | 3 288 KiB                       |

Nota: `http-server` sirve sin compresión; la transferencia real en Vercel va comprimida (ver §6).

## 6. Transferencia inicial de JS (`npm run build`)

Comando: `npm run build`.

| Archivo               | Tamaño bruto  | Transferencia estimada |
| --------------------- | ------------- | ---------------------- |
| `main-KTSW3TGH.js`    | 859,75 kB     | 192,06 kB              |
| `styles-BDBNZYWS.css` | 749 bytes     | 749 bytes              |
| **Initial total**     | **860,50 kB** | **192,80 kB**          |

CLS: 0 (móvil) / 0,001 (escritorio), de Lighthouse (§5).

## Presupuestos sugeridos para F4 (a partir de esta línea base)

Sin regresión respecto a: 149 draw calls y ≈1,12 M triángulos en la vista inicial (el plan fija sus propios objetivos en `plan.md`), frame time «sin límite» escritorio ≤ 0,8 ms ±25 %, accesibilidad Lighthouse 100 en ambos perfiles, JS inicial transferido ≤ 192,8 kB.
