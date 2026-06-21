// _pwatest.mjs — QA de la PWA (port móvil). Verifica que el manifiesto sea válido,
// que el Service Worker se registre, que los iconos se sirvan y que no haya errores.
// Uso: node tools/_pwatest.mjs [url]   (sirve dist/ con `npx vite preview` primero)
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'http://localhost:4280/';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const p = await b.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(URL, { waitUntil: 'load', timeout: 30000 });

const man = await p.evaluate(async () => {
  const l = document.querySelector('link[rel=manifest]'); if (!l) return null;
  const r = await fetch(l.href); return r.ok ? await r.json() : ('HTTP ' + r.status);
});
console.log('manifest name:', man && man.name, '| display:', man && man.display, '| icons:', man && man.icons.length);

const sw = await p.evaluate(async () => {
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    return reg.active ? 'active' : (reg.installing ? 'installing' : (reg.waiting ? 'waiting' : 'ready-no-state'));
  } catch { return 'none'; }
});
console.log('service worker:', sw);
const icon = await p.evaluate(async () => (await fetch('icons/icon-512.png')).status);
console.log('icon-512 HTTP:', icon);
console.log('errores consola:', errors.length); errors.slice(0, 5).forEach((e) => console.log('  ✗', e));

const ok = man && man.name && man.icons.length >= 3 && (sw === 'active' || sw === 'installing') && icon === 200 && errors.length === 0;
console.log(ok ? '\n✅ PWA OK — manifiesto válido, SW registrado, iconos servidos, 0 errores.' : '\n❌ PWA falló.');
await b.close(); process.exit(ok ? 0 : 1);
