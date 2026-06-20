// IntroScene — Entrevista estilo Pokémon Mundo Misterioso: el Gurú Xatu hace
// preguntas, lee tu personalidad y te OFRECE un inicial (aceptas o eliges otro)
// y un entrenador sugerido. Nada se impone: todo se ofrece.
import Phaser from 'phaser';
import { VIEW, frameCamera } from '../main.js';
import { QUIZ, TRAIT_RESULT, STARTERS } from '../../data/quiz.js';
import { makeInput } from '../systems/input.js';
import { sfx } from '../systems/audio.js';

const GURU_ID = 178;   // Xatu, el pájaro oráculo

// TUTORIAL: el Gurú Xatu explica el juego (tras el quiz, antes de ofrecer inicial).
const TUTORIAL = [
  'Kiu... Antes de partir, deja que mi visión te guíe por la Torre Infinita.',
  'Son 9111 pisos. En cada uno busca el AGUJERO que desciende al siguiente nivel.',
  'Los Pokémon salvajes acechan en la HIERBA ALTA y en las cuevas. ¡Cuídate!',
  'Debilítalos en combate y lánzales una POKÉ BALL para capturarlos.',
  'En los PUEBLOS (cada 5 pisos) cura tu equipo, compra objetos y descansa.',
  'Mueve con las FLECHAS, corre con B, mochila con M, equipo con T, Pokédex con P.',
  'Equipa una Piedra Mega o un Cristal Z para desatar FENÓMENOS en combate.',
  'En la tienda hay HUEVOS: cómpralos y caminan contigo hasta eclosionar.',
  'Cada 10 pisos hay un JEFE; cada 50, un GUARDIÁN legendario con gran recompensa.',
  'En el menú principal eliges DIFICULTAD y ganas MEJORAS y LOGROS entre partidas.',
  '¿Cansado de andar? Pulsa I y deja que la IA juegue por ti. ¡Que la Torre te sea leve!',
];

export class IntroScene extends Phaser.Scene {
  constructor() { super('Intro'); }

  create() {
    frameCamera(this);
    const { w, h } = VIEW;
    this.add.rectangle(0, 0, w, h, 0x070a14, 1).setOrigin(0, 0);
    for (let i = 0; i < 50; i++) {
      const s = this.add.rectangle(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h * 0.55), 1, 1, 0xffffff, Phaser.Math.FloatBetween(0.15, 0.6));
      this.tweens.add({ targets: s, alpha: 0.05, duration: Phaser.Math.Between(1300, 2800), yoyo: true, repeat: -1 });
    }
    // el Gurú flota arriba
    this.guru = this.add.image(w / 2, 64, 'mon_' + GURU_ID).setScale(1.3);
    this.tweens.add({ targets: this.guru, y: 72, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.txt = this.add.text(w / 2, 124, '', { fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#e8f6ff', align: 'center', wordWrap: { width: w - 60 }, lineSpacing: 6 }).setOrigin(0.5, 0);
    this.optTexts = [];
    this.gba = makeInput(this);
    this.scores = {}; this.qIdx = -1; this.state = 'hello'; this.cursor = 0; this.lock = false;

    // confirmación por evento + polling (D-007)
    const onA = () => this.confirm();
    this.input.keyboard.on('keydown-ENTER', onA);
    this.input.keyboard.on('keydown-Z', onA);
    this.input.keyboard.on('keydown-SPACE', onA);

    this.say('Kiu... kiuuu. Bienvenido, viajero. Soy el Gurú Xatu: veo el ayer y el mañana.\n\nResponde con el corazón.', ['Estoy listo.', '¿Mi... corazón?']);
    this.cameras.main.fadeIn(350, 0, 0, 0);
  }

  say(text, options) {
    this.txt.setText(text);
    for (const t of this.optTexts) t.destroy();
    this.optTexts = [];
    this.optLabels = options.slice();
    this.cursor = 0;
    const baseY = VIEW.h - 24 - options.length * 22;
    options.forEach((op, i) => {
      const t = this.add.text(70, baseY + i * 22, op, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#9fb0d0' })
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => { this.cursor = i; this.paint(); })
        .on('pointerdown', () => this.confirm());
      this.optTexts.push(t);
    });
    this.paint();
  }

  paint() {
    this.optTexts.forEach((t, i) => {
      const on = i === this.cursor;
      t.setColor(on ? '#ffd76a' : '#9fb0d0').setText((on ? '▶ ' : '  ') + this.optLabels[i]);
    });
  }

  update() {
    const d = this.gba.dirJust();
    if (d === 'up') { this.cursor = Math.max(0, this.cursor - 1); sfx(this, 'cursor'); this.paint(); }
    else if (d === 'down') { this.cursor = Math.min(this.optTexts.length - 1, this.cursor + 1); sfx(this, 'cursor'); this.paint(); }
    else if ((d === 'left' || d === 'right') && this.state === 'pick') { sfx(this, 'cursor'); this.movePick(d === 'left' ? -1 : 1); }
    if (this.gba.confirm()) this.confirm();
  }

  confirm() {
    if (this.lock) return; this.lock = true;
    sfx(this, 'select');
    this.time.delayedCall(180, () => { this.lock = false; });
    switch (this.state) {
      case 'hello': this.state = 'ask'; this.nextQuestion(); break;
      case 'ask': {
        const q = QUIZ[this.qIdx], op = q.options[this.cursor];
        for (const [tr, v] of Object.entries(op.traits)) this.scores[tr] = (this.scores[tr] || 0) + v;
        this.nextQuestion();
        break;
      }
      case 'offer': {
        if (this.cursor === 0) this.acceptStarter(this.offered);          // ¡Acepto!
        else this.showPicker();                                           // ver otros
        break;
      }
      case 'pick': this.acceptStarter(STARTERS[this.pickIdx].id); break;
      case 'tutorial': {
        this.tutIdx++;
        if (this.tutIdx >= TUTORIAL.length) this.showResult();
        else this.say(TUTORIAL[this.tutIdx], ['Continuar']);
        break;
      }
    }
  }

  startTutorial() {
    // solo la PRIMERA partida ve el tutorial; después se salta directo a la oferta
    let seen = false; try { seen = localStorage.getItem('torre_infinita_tutseen') === '1'; } catch { /* */ }
    if (seen) return this.showResult();
    try { localStorage.setItem('torre_infinita_tutseen', '1'); } catch { /* */ }
    this.state = 'tutorial'; this.tutIdx = 0;
    this.say(TUTORIAL[0], ['Continuar']);
  }

  nextQuestion() {
    this.qIdx++;
    if (this.qIdx >= QUIZ.length) return this.startTutorial();   // tras el quiz → tutorial
    const q = QUIZ[this.qIdx];
    this.say(q.q, q.options.map(o => o.txt));   // sin numeración: no romper la ilusión
  }

  showResult() {
    this.state = 'offer';
    const trait = Object.entries(this.scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'alegre';
    this.result = TRAIT_RESULT[trait];
    this.offered = this.result.starter;
    const st = STARTERS.find(s => s.id === this.offered);
    // aparece el inicial ofrecido, con rebote
    this.starterImg = this.add.image(VIEW.w / 2, 228, 'mon_' + this.offered).setScale(0.1);
    this.tweens.add({ targets: this.starterImg, scale: 1.25, duration: 420, ease: 'Back.out' });
    this.say(`${this.result.line}\n\nCreo que ${st.name.toUpperCase()} y tú harían historia. ¿Lo aceptas como compañero?`,
      ['¡Acepto!', 'Quiero conocer a otros.']);
  }

  showPicker() {
    this.state = 'pick';
    this.pickIdx = STARTERS.findIndex(s => s.id === this.offered);
    this.say('', ['¡Este mismo!']);
    this.renderPick();
  }

  renderPick(dir = 0) {
    const st = STARTERS[this.pickIdx];
    this.starterImg.setTexture('mon_' + st.id);
    if (dir) {  // deslizamiento estilo carrusel (curva Back.out, anime.js)
      this.starterImg.setX(VIEW.w / 2 + dir * 60).setAlpha(0.2);
      this.tweens.add({ targets: this.starterImg, x: VIEW.w / 2, alpha: 1, duration: 260, ease: 'Back.out' });
    }
    this.txt.setText(`◀ ${st.name.toUpperCase()} ▶\n\n${st.desc}`);
  }

  movePick(d) {
    this.pickIdx = (this.pickIdx + d + STARTERS.length) % STARTERS.length;
    this.renderPick(d);
  }

  acceptStarter(id) {
    this.registry.set('starter', id);
    this.registry.set('suggestedTrainer', this.result.trainer);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.time.delayedCall(370, () => this.scene.start('CharacterSelect'));
  }
}
