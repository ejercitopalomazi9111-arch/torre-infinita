import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('../assets/_preview/', import.meta.url));
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage(); await p.setViewport({width:480,height:360,deviceScaleFactor:2});
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); p.on('pageerror',e=>errs.push('PE:'+e.message));
const press=async(k,h=100)=>{await p.keyboard.down(k);await sleep(h);await p.keyboard.up(k);};
await p.goto('http://localhost:5173/',{waitUntil:'networkidle2',timeout:30000}); await sleep(2500);
await press('Enter');await sleep(800);await press('Enter');await sleep(400);
for(let i=0;i<9;i++){await press('Enter');await sleep(330);}
await press('Enter');await sleep(800);await press('Enter');await sleep(800);await press('KeyC');await sleep(1300);
await p.evaluate(()=>{ window.__GAME.scene.getScene('Floor').openShop(); });
await sleep(500); await p.screenshot({path:OUT+'shop_top.png'}); console.log('  → shop_top.png');
for(let i=0;i<14;i++){ await p.evaluate(()=>{const f=window.__GAME.scene.getScene('Floor'); f.shopCursor=Math.min(f.shopCursor+1,14); f.paintShop();}); await sleep(60);}
await p.screenshot({path:OUT+'shop_bottom.png'}); console.log('  → shop_bottom.png');
await b.close();
console.log(errs.length?('ERRORES:'+errs.slice(0,8).join(' | ')):'✅ SHOP OK 0 errores');
