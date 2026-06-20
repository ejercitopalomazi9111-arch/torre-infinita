import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 672, height: 360 });
const errs = []; p.on('console', m => { if (m.type()==='error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PE:'+(e.stack||e.message)));
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const press = async (k,h=80)=>{await p.keyboard.down(k);await sleep(h);await p.keyboard.up(k);};
const active = () => p.evaluate(() => window.__GAME?.scene.scenes.filter(x=>x.scene.isActive()).map(x=>x.scene.key).join(',') || '');
const onFloor = () => p.evaluate(() => { const f=window.__GAME?.scene.getScene('Floor'); return !!(f&&f.floorNum&&f.run&&f.scene.isActive()); });
await sleep(2800);
await press('Enter'); await sleep(700);   // título→intro
// avanzar quiz/starter: Enter paciente hasta que aparezca el carrusel (CharacterSelect)
for (let i=0;i<30;i++){ const a=await active(); if(a.includes('CharacterSelect')||a.includes('Story')||a.includes('Floor')) break; await press('Enter'); await sleep(550); }
// carrusel: elegir
for (let i=0;i<4;i++){ const a=await active(); if(a.includes('Story')||a.includes('Floor')) break; await press('Enter'); await sleep(600); }
// historia: saltar con C
for (let i=0;i<8 && !(await onFloor());i++){ await press('KeyC'); await sleep(600); }
if (!(await onFloor())) { console.log('no llegó:', await active()); await b.close(); process.exit(0); }
const start = await p.evaluate(() => window.__GAME.scene.getScene('Floor').floorNum);
await p.evaluate(() => window.__GAME.registry.set('autoplay', true));
console.log('IA activada en piso', start);
for (let t=0;t<16;t++){ await sleep(2000); const s = await p.evaluate(() => { const g=window.__GAME; const f=g.scene.getScene('Floor'); return { fl:f.floorNum, room:f.currentRoomId, exit:f.floor.exitId, hole:!!f.holeTile, nd:f.nextDoorDir() }; }); console.log(`t${t*2}s`, JSON.stringify(s)); }
await p.screenshot({ path: 'assets/_preview/debug_auto.png' });
console.log(errs.length ? 'ERR('+errs.length+'): '+errs.slice(0,4).join(' | ') : 'sin errores');
await b.close();
