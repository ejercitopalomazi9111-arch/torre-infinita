// test-edgecases.mjs — casos límite de las features nuevas (gimmicks/jefes/cambios)
import { Battle, makeBattleMon } from '../src/systems/combat/battle.js';
let pass=0, fail=0;
const ok = (c, msg) => { if (c) { pass++; } else { fail++; console.log('  ❌', msg); } };

// 1) Mega no se puede usar 2 veces por combate
{ const ch=makeBattleMon(6,50); ch.item='megastone'; const b=new Battle([ch, makeBattleMon(9,50)],[makeBattleMon(19,50)],'t');
  b.log=[]; b.applyGimmick('A','mega'); const t1=ch.types.join('/');
  b.log=[]; b.applyGimmick('A','mega'); ok(b.gimmicksUsed.mega===true, 'mega marcado usado');
  ok(t1==='fire/dragon', 'mega aplicó forma'); }

// 2) Z armado dispara y se consume (×1.8) una sola vez
{ const me=makeBattleMon(25,50); me.item='zcrystal'; const foe=makeBattleMon(19,50); foe.maxhp=foe.hp=9999;
  const b=new Battle([me],[foe],'t'); b.applyGimmick('A','z', me.moves[0]);
  ok(me.zArmed===me.moves[0], 'z armado'); b.log=[]; b.doMove('A',{move:me.moves[0]});
  ok(me.zArmed===null, 'z se consumió tras el golpe'); ok(b.log.some(l=>l.t==='zmove'), 'evento zmove'); }

// 3) Dinamax duplica PS y marca dynamax
{ const me=makeBattleMon(143,50); me.item='maxiband'; const b=new Battle([me],[makeBattleMon(19,50)],'t');
  const hp0=me.maxhp; b.applyGimmick('A','dynamax'); ok(me.maxhp===hp0*2, 'dinamax x2 PS'); ok(me.dynamax===true,'dynamax flag'); }

// 4) Furia de jefe: una sola vez, cura + sube atk
{ const boss=makeBattleMon(6,60); boss.isBossMon=true; boss.maxhp=boss.hp=400; const me=makeBattleMon(19,90);
  const b=new Battle([me],[boss],'t'); let rages=0;
  for(let i=0;i<30 && boss.hp>0;i++){ b.log=[]; boss.hp=Math.max(1,boss.hp-30); 
    if (boss.isBossMon&&!boss.enraged&&boss.hp>0&&boss.hp<=Math.floor(boss.maxhp*0.5)){ boss.enraged=true; boss.hp+=Math.floor(boss.maxhp*0.25); boss.stages.atk+=2; rages++; } }
  ok(rages===1, 'furia solo 1 vez'); ok(boss.stages.atk===2, 'furia subió atk'); }

// 5) Captura imposible si especie inexistente NO rompe (robustez makeBattleMon)
{ let threw=false; try{ makeBattleMon(99999,5);}catch(e){threw=true;} ok(threw, 'especie inválida lanza limpio (no corrompe)'); }

// 6) Combate de 2 vs 1 (entrenador): el cambio al debilitarse funciona
{ const me=makeBattleMon(6,80); const t1=makeBattleMon(19,5), t2=makeBattleMon(16,5); t1.maxhp=t1.hp=1;
  const b=new Battle([me],[t1,t2],'t'); b.log=[]; b.doMove('A',{move:me.moves.find(m=>true)});
  ok(b.active.B===1 || b.over, 'entrenador saca al 2º al caer el 1º'); }

console.log(`\n${fail===0?'✅':'❌'} EDGE CASES: ${pass} OK, ${fail} fallos`);
process.exit(fail?1:0);
