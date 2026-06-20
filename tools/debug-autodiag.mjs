import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 672, height: 360 });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const press = async (k,h=80)=>{await p.keyboard.down(k);await sleep(h);await p.keyboard.up(k);};
const active = () => p.evaluate(() => window.__GAME?.scene.scenes.filter(x=>x.scene.isActive()).map(x=>x.scene.key).join(',')||'');
const onFloor = () => p.evaluate(() => { const f=window.__GAME?.scene.getScene('Floor'); return !!(f&&f.floorNum&&f.run&&f.scene.isActive()); });
await sleep(2800); await press('Enter'); await sleep(700);
for (let i=0;i<30;i++){ const a=await active(); if(a.includes('CharacterSelect')||a.includes('Story')||a.includes('Floor'))break; await press('Enter'); await sleep(550); }
for (let i=0;i<4;i++){ const a=await active(); if(a.includes('Story')||a.includes('Floor'))break; await press('Enter'); await sleep(600); }
for (let i=0;i<8 && !(await onFloor());i++){ await press('KeyC'); await sleep(600); }
if(!(await onFloor())){ console.log('no floor'); await b.close(); process.exit(0);}
const diag = await p.evaluate(() => {
  const f = window.__GAME.scene.getScene('Floor');
  const out = { col:f.col, row:f.row, hole:f.holeTile, stepping:f.stepping, room:f.currentRoomId, exit:f.floor.exitId };
  try { out.target = f.botTarget(); } catch(e){ out.targetErr = e.message; }
  try { out.nextDoor = f.nextDoorDir(); } catch(e){ out.doorErr = e.message; }
  try { out.dir = out.target ? f.botPathDir(out.target) : null; } catch(e){ out.dirErr = e.message; }
  return out;
});
console.log('DIAG:', JSON.stringify(diag));
// forzar 5 autoStep manuales y ver si cambia col/row
for(let i=0;i<6;i++){ await p.evaluate(()=>window.__GAME.scene.getScene('Floor').autoStep()); await sleep(350); const cr=await p.evaluate(()=>{const f=window.__GAME.scene.getScene('Floor');return f.col+','+f.row+' floor'+f.floorNum;}); console.log('step',i,cr); }
console.log(errs.length?'ERR:'+errs.slice(0,3).join(' | '):'sin errores');
await b.close();
