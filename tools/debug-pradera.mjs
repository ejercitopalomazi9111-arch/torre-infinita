import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 672, height: 360 });
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const press = async (k,h=80)=>{await p.keyboard.down(k);await sleep(h);await p.keyboard.up(k);};
const onFloor = () => p.evaluate(() => { const f=window.__GAME?.scene.getScene('Floor'); return !!(f&&f.floorNum&&f.run&&f.scene.isActive()); });
await sleep(2800); await press('Enter'); await sleep(700);
for (let i=0;i<30;i++){ const a=await p.evaluate(()=>window.__GAME?.scene.scenes.filter(x=>x.scene.isActive()).map(x=>x.scene.key).join(',')||''); if(a.includes('CharacterSelect')||a.includes('Story')||a.includes('Floor'))break; await press('Enter'); await sleep(420); }
for (let i=0;i<4;i++){ const a=await p.evaluate(()=>window.__GAME?.scene.scenes.filter(x=>x.scene.isActive()).map(x=>x.scene.key).join(',')||''); if(a.includes('Story')||a.includes('Floor'))break; await press('Enter'); await sleep(550); }
for (let i=0;i<8 && !(await onFloor());i++){ await press('KeyC'); await sleep(550); }
if(!(await onFloor())){ console.log('no floor'); await b.close(); process.exit(0);}
// forzar bioma pradera y reconstruir la sala
await p.evaluate(() => { const f=window.__GAME.scene.getScene('Floor'); const B=f.floor.biome; const m=f.cache?.json; 
  import('/data/biomes.js').then(()=>{}); 
  f.biome = { ...f.biome, id:'pradera', name:'Pradera Encantada', palette:{wall:'#4a7a4a',floor:'#7fc06a',accent:'#ffb0e0'}, typesFavored:['fairy','grass','normal'], dark:false }; 
  f.registerBiomeTextures?.(f, f.biome); f.buildRoom(f.currentRoomId, null); });
await sleep(1500);
await p.screenshot({ path: 'assets/_preview/debug_pradera.png' });
console.log('pradera render · errores:', errs.length);
await b.close();
