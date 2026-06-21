// QA Criadero: reglas de cría + forma base. node tools/breeding-test.mjs
import { baseFormOf, canBreed, eggSpeciesOf, isDitto } from '../src/systems/pokemon/breeding.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) fails++; };
const mon = (id, name) => ({ speciesId: id, name });
const DITTO = mon(132, 'ditto'), CHARMANDER = mon(4, 'charmander'), CHARMELEON = mon(5, 'charmeleon'),
      CHARIZARD = mon(6, 'charizard'), VENUSAUR = mon(3, 'venusaur'), BLASTOISE = mon(9, 'blastoise');

ok(baseFormOf(6) === 4, 'Forma base de Charizard = Charmander');
ok(baseFormOf(3) === 1, 'Forma base de Venusaur = Bulbasaur');
ok(baseFormOf(4) === 4, 'Forma base de Charmander = sí mismo');
ok(isDitto(DITTO) && !isDitto(CHARIZARD), 'Detecta a Ditto');

ok(canBreed(DITTO, CHARIZARD), 'Ditto + Charizard SÍ crían');
ok(eggSpeciesOf(DITTO, CHARIZARD) === 4, '→ huevo de Charmander (forma base)');
ok(eggSpeciesOf(CHARIZARD, DITTO) === 4, '→ funciona en cualquier orden');

ok(canBreed(CHARMELEON, CHARIZARD), 'Dos de la misma familia SÍ crían');
ok(eggSpeciesOf(CHARMELEON, CHARIZARD) === 4, '→ huevo de la forma base de la familia');

ok(!canBreed(CHARIZARD, BLASTOISE), 'Familias distintas NO crían');
ok(!canBreed(DITTO, DITTO), 'Dos Dittos NO crían');
ok(!canBreed(VENUSAUR, VENUSAUR === VENUSAUR ? null : VENUSAUR), 'Necesita dos Pokémon válidos');

console.log('\n' + (fails === 0 ? '🎉 TODO VERDE' : `💥 ${fails} fallo(s)`));
process.exit(fails ? 1 : 0);
