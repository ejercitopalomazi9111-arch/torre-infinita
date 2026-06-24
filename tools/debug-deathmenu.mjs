// Regresión #38: morir en combate NO debe congelar el juego; tras la derrota se llega
// al menú y el cursor responde. Uso: node tools/debug-deathmenu.mjs
import puppeteer from 'puppeteer';
const URL=process.env.URL||'http://localhost:5173/';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu']});
const p=await b.newPage(); await p.setViewport({width:672,height:360});
const errs=[]; p.on('pageerror',e=>errs.push('PE:'+(e.stack||e.message).split('\n').slice(0,3).join(' | ')));
p.on('console',m=>{if(m.type()==='error')errs.push('CE:'+m.text());});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tap=async k=>{ await p.keyboard.down(k); await sleep(70); await p.keyboard.up(k); await sleep(150); };
const scenes=()=>p.evaluate(()=>window.__GAME.scene.getScenes(true).map(s=>s.scene.key));
await p.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
let ok=false; for(let i=0;i<70;i++){ await sleep(2000); if(await p.evaluate(()=>window.__GAME?.textures?.exists('item_pokeball')&&window.__GAME.scene.getScenes(true).length>0)){ok=true;break;} }
console.log('boot:',ok);
await p.evaluate(()=>localStorage.setItem('torre_infinita_hasplayed','1'));
// 1) construye un mon REAL con godtest y serialízalo
await p.evaluate(()=>window.__GODTEST.start({floor:3,starter:25}));
await sleep(2500);
const mon = await p.evaluate(()=>{ const m=window.__GAME.scene.getScene('Floor').run.party[0]; return JSON.parse(JSON.stringify(m)); });
console.log('mon real OK:', mon?.name, 'movs', mon?.moves?.length);
// 2) Floor LIMPIO (sin godtest) con ese mon a 1 HP, sin caja
await p.evaluate((mon)=>{
  const g=window.__GAME, r=g.registry;
  r.set('godtest',false); r.set('autoplay',false);
  mon.hp=1;
  r.set('run',{wins:5,dex:{caught:[],seen:[]},box:[],bag:{},found:[],seed:'dd',rescuedFloors:[],party:[mon]});
  for(const s of g.scene.getScenes(true).slice()) g.scene.stop(s.scene.key);
  g.scene.start('Hud'); g.scene.start('Floor',{floor:3,seed:'dd'});
},mon);
await sleep(1800);
await p.evaluate(()=>{ const f=window.__GAME.scene.getScene('Floor'); f.transitioning=false; f.run.wins=5; f.startEncounter(true,{species:6}); });
await sleep(1600);
console.log('escenas tras encuentro:', (await scenes()).join(','));
// 3) pelea a mano hasta GameOver (o hasta crash)
let reachedGO=false;
for(let i=0;i<60;i++){ const sc=await scenes(); if(sc.includes('GameOver')){reachedGO=true;break;} if(errs.length){console.log('CRASH en combate, corto');break;} await tap('z'); }
console.log('GameOver:', reachedGO, '| escenas:', (await scenes()).join(','));
await sleep(2800);
for(let i=0;i<8;i++){ if((await scenes()).includes('Title'))break; await tap('Enter'); await sleep(450); }
console.log('tras GameOver:', (await scenes()).join(','));
for(let i=0;i<8;i++){ if((await scenes()).includes('MainMenu'))break; await tap('Enter'); await sleep(450); }
const c0=await p.evaluate(()=>window.__GAME.scene.getScene('MainMenu')?.cursor);
await tap('ArrowDown'); await tap('ArrowDown');
const c1=await p.evaluate(()=>window.__GAME.scene.getScene('MainMenu')?.cursor);
console.log('menu cursor', c0,'->',c1, (c1>c0)?'(SE MUEVE OK)':'(*** CONGELADO ***)');
await p.screenshot({path:'tools/_realdeath.png'});
console.log('PAGEERRORS:', errs.length); errs.slice(0,10).forEach(e=>console.log('  '+e));
await b.close();
