import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--disable-gpu'] });
const URL = process.argv[2] || 'http://localhost:5173/';
const boot = async () => { const p = await b.newPage(); await p.goto(URL,{waitUntil:'domcontentloaded',timeout:30000}); await p.waitForFunction(()=>window.Net,{timeout:30000}); return p; };
const A = await boot(), B = await boot();
// A hospeda
await A.evaluate(()=>{ window.__r={}; const n=new window.Net(); window.__n=n; n.on('open',c=>window.__r.code=c).on('connect',()=>window.__r.conn=true).on('data',m=>window.__r.got=m); n.host(); });
// esperar código
let code=null; for(let i=0;i<40;i++){ code=await A.evaluate(()=>window.__r.code); if(code) break; await new Promise(r=>setTimeout(r,500)); }
console.log('código de sala:', code);
if(!code){ console.log('❌ host no abrió (broker?)'); await b.close(); process.exit(1); }
// B se une
await B.evaluate((c)=>{ window.__r={}; const n=new window.Net(); window.__n=n; n.on('connect',()=>window.__r.conn=true).on('data',m=>window.__r.got=m); n.join(c); }, code);
// esperar conexión en ambos
let ca=false,cb=false; for(let i=0;i<40;i++){ ca=await A.evaluate(()=>!!window.__r.conn); cb=await B.evaluate(()=>!!window.__r.conn); if(ca&&cb) break; await new Promise(r=>setTimeout(r,500)); }
console.log('conectados → A:',ca,' B:',cb);
// B envía mensaje a A
await B.evaluate(()=>window.__n.send({type:'hola',n:42}));
await new Promise(r=>setTimeout(r,1500));
const got = await A.evaluate(()=>window.__r.got);
console.log('A recibió:', JSON.stringify(got));
console.log(ca&&cb&&got&&got.n===42 ? '✅ TRANSPORTE P2P OK' : '❌ falló');
await b.close();
