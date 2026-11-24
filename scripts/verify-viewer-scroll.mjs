// Guardián del scroll del visor (spec 004 §E, T-401): el contenedor `.viewer-container` es `overflow: hidden`, que sigue
// siendo desplazable por código; un `scrollIntoView` o un `focus()` sin `preventScroll` lo mueve y la interfaz (todo
// `position: absolute`) se desplaza arriba-izquierda. Este script recorre el guion de acciones y, tras cada paso,
// comprueba scrollLeft/scrollTop del visor, scrollWidth <= clientWidth y el scroll del documento.
//
// Uso:  node scripts/verify-viewer-scroll.mjs --url http://127.0.0.1:4173/ [--browser <exe>] [--port 9701] [--sizes 1813x834,1280x800,125]
// Sale con código 1 si algún paso deja el visor desplazado (o 2 si no puede ejecutarse). Sin dependencias; Node >= 22.
// Edge/Chrome headless por CDP (WebGL por ANGLE d3d11 o, si no hay GPU, SwiftShader). Perfil nuevo por tamaño.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  if (i < 0) return d;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const URL_ = arg('url', 'http://127.0.0.1:4200/');
const PORT = Number(arg('port', 9701));
const SIZES = String(arg('sizes', '1813x834,1280x800,125')).split(',');
const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const BROWSER = arg('browser', CANDIDATES.find((p) => existsSync(p)));
if (!BROWSER) {
  console.error('No encuentro Chrome/Edge: usa --browser <exe>');
  process.exit(2);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** `125` = zoom del navegador al 125 %: 1813x834 en píxeles físicos -> 1450x667 CSS con factor de escala 1,25. */
const parseSize = (s) => {
  if (s === '125') return { name: '125%', w: Math.round(1813 / 1.25), h: Math.round(834 / 1.25), dpr: 1.25 };
  const [w, h] = s.split('x').map(Number);
  return { name: `${w}x${h}`, w, h, dpr: 1 };
};

async function launch(port) {
  const profile = mkdtempSync(join(tmpdir(), 'rtad-scroll-'));
  const args = ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-angle=d3d11', 'about:blank'];
  const proc = spawn(BROWSER, args, { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); return { proc, profile }; } catch { await sleep(250); }
  }
  proc.kill();
  throw new Error('el navegador no arrancó');
}

async function newPage(port) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { pending.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
    return r.result.value;
  };
  return { send, ev, close: () => ws.close() };
}

const STATE_JS = `(() => {
  const v = document.querySelector('.viewer-container');
  const d = document.scrollingElement;
  return { l: v ? v.scrollLeft : null, t: v ? v.scrollTop : null, over: v ? v.scrollWidth - v.clientWidth : null,
    overY: v ? v.scrollHeight - v.clientHeight : null, dl: d.scrollLeft, dt: d.scrollTop };
})()`;

const key = async (send, k, code, vk, text) => {
  const base = { key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? { text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
};

async function runSize(size) {
  const { proc, profile } = await launch(PORT);
  const failures = [];
  try {
    const { send, ev, close } = await newPage(PORT);
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: size.w, height: size.h, deviceScaleFactor: size.dpr, mobile: false });
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Page.navigate', { url: URL_ });
    for (let i = 0; i < 600; i++) {
      if (await ev(`!!document.querySelector('.scene-canvas') && !document.querySelector('.loading')`)) break;
      await sleep(100);
    }
    await sleep(2500);
    let n = 0;
    const check = async (label) => {
      await sleep(350);
      const s = await ev(STATE_JS);
      const bad = s.l === null || s.l !== 0 || s.t !== 0 || s.over > 0 || s.overY > 0 || s.dl !== 0 || s.dt !== 0;
      n += 1;
      console.log(`${bad ? 'FALLO' : 'ok   '} ${size.name.padEnd(9)} paso ${String(n).padStart(2)} ${label.padEnd(34)} scrollLeft=${s.l} scrollTop=${s.t} desborde=${s.over}x${s.overY} documento=${s.dl},${s.dt}`);
      if (bad) failures.push(`${size.name} · ${label}`);
    };

    await check('carga (ayuda abierta)');
    // 1) «Got it» (cierra la ayuda y el foco pasa a «Controls»)
    await ev(`document.querySelector('.sheet .primary')?.click()`);
    await check('«Got it» → «Controls»');
    // 2) Reabrir la ayuda y cerrarla otra vez
    await ev(`document.querySelector('.reopen')?.click()`);
    await check('«Controls» (reabrir ayuda)');
    await ev(`document.querySelector('.sheet .primary')?.click()`);
    await check('«Got it» otra vez');
    // 3) Seleccionar cada pieza de la lista (clic en su chip)
    const ids = await ev(`[...document.querySelectorAll('nav.list .chip:not(.reset)')].map((b, i) => i)`);
    for (const i of ids) {
      const name = await ev(`(() => { const b = document.querySelectorAll('nav.list .chip:not(.reset)')[${i}]; b.click(); return b.textContent.trim(); })()`);
      await sleep(900);
      await check(`seleccionar «${name}»`);
    }
    // 4) Volver a la vista inicial (botón del final de la lista)
    await ev(`document.querySelector('nav.list .chip.reset')?.click()`);
    await sleep(900);
    await check('«Initial view»');
    // 5) Tab hasta un chip y Enter sobre él
    await ev(`document.querySelector('.scene-canvas').focus({ preventScroll: true })`);
    for (let i = 0; i < 4; i++) await key(send, 'Tab', 'Tab', 9);
    await check('Tab ×4 hasta un chip');
    await key(send, 'Enter', 'Enter', 13, '\r');
    await sleep(900);
    await check('Enter sobre el chip enfocado');
    // 6) Foco en el canvas, flechas y Home
    await ev(`document.querySelector('.scene-canvas').focus()`);
    await check('foco en el canvas');
    for (const [k, code, vk] of [['ArrowLeft', 'ArrowLeft', 37], ['ArrowUp', 'ArrowUp', 38], ['ArrowRight', 'ArrowRight', 39], ['ArrowDown', 'ArrowDown', 40]]) {
      await key(send, k, code, vk);
      await check(`flecha ${k.slice(5).toLowerCase()}`);
    }
    await key(send, 'Home', 'Home', 36);
    await sleep(900);
    await check('Home');
    // 7) Rueda y arrastre sobre el canvas
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: size.w / 2, y: size.h / 2, deltaX: 0, deltaY: -300 });
    await check('rueda sobre el canvas');
    close();
  } finally {
    proc.kill();
    await sleep(700);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* perfil temporal */ }
  }
  return failures;
}

console.log(`verify-viewer-scroll · ${URL_} · ${BROWSER}`);
const all = [];
try {
  for (const s of SIZES) all.push(...(await runSize(parseSize(s))));
} catch (e) {
  console.error('No se pudo ejecutar el guion:', e.message);
  process.exit(2);
}
if (all.length) {
  console.log(`\nFALLO: ${all.length} paso(s) dejan el visor desplazado:`);
  all.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('\nOK: el visor no se desplazó en ningún paso.');
