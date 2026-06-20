// fxPlayer.js — Motor de animaciones de ataque DATA-DRIVEN (200+ patrones).
// Lee data/fxanims.js (FX_ANIMS) y renderiza CADA movimiento con su propia
// animación coherente con el tipo, usando FORMAS coloreadas + texturas fx_ reales.
import { STAT_FX } from '../../../data/fx.js';
import { MOVES } from '../../../data/moves.js';
import { animForMove } from '../../../data/fxanims.js';

/** Reproduce el FX del movimiento `moveId` de `from` hacia `to`. onDone al terminar. */
export function playMoveFX(scene, moveId, from, to, onDone) {
  const mv = MOVES[moveId];
  if (!mv) { onDone?.(); return; }
  const anim = animForMove(moveId, mv.type);
  renderAnim(scene, anim, from, to, onDone);
}

/** Renderiza una config { motion, c, c2, tex } de `from` a `to`. */
export function renderAnim(scene, a, from, to, onDone) {
  const S = scene, stage = S.stage || null;
  const add = (o) => { o.setDepth(355); if (stage) stage.add(o); return o; };
  const circ = (x, y, r, col, al = 1) => add(S.add.circle(x, y, r, col, al));
  const line = (x1, y1, x2, y2, col, w = 3, al = 1) => add(S.add.line(0, 0, x1, y1, x2, y2, col, al).setLineWidth(w));
  const rect = (x, y, w, h, col, al = 1) => add(S.add.rectangle(x, y, w, h, col, al));
  const tri = (x, y, s, col, al = 1) => add(S.add.triangle(x, y, 0, s, s, s, s / 2, 0, col, al));
  const star = (x, y, r, col) => add(S.add.star(x, y, 4, r * 0.4, r, col));
  const img = (tex, x, y) => (tex && S.textures.exists('fx_' + tex)) ? add(S.add.image(x, y, 'fx_' + tex)) : null;
  const kill = (o, d, after) => S.tweens.add({ targets: o, alpha: 0, duration: d, onComplete: () => { o.destroy(); after && after(); } });
  const flash = (ms, col) => S.cameras.main.flash(ms, (col >> 16) & 255, (col >> 8) & 255, col & 255);
  const fx = from, tx = to.x, ty = to.y - 6, ang = Math.atan2(ty - (fx.y - 6), tx - fx.x);
  const c = a.c, c2 = a.c2;
  let dur = 520;

  switch (a.motion) {
    case 'projectile': case 'comet': {
      const p = img(a.tex, fx.x, fx.y - 10) || circ(fx.x, fx.y - 10, 7, c);
      if (a.motion === 'comet') { const tail = circ(fx.x, fx.y - 10, 4, c2, 0.6); S.tweens.add({ targets: tail, x: tx, y: ty, scale: 0.1, alpha: 0, duration: 360 }); }
      S.tweens.add({ targets: p, x: tx, y: ty, scale: 1.2, duration: 360, ease: 'Quad.in', onComplete: () => { p.destroy(); flash(80, c); ringBurst(circ, tx, ty, c2, kill); } });
      break;
    }
    case 'burst': case 'nova': {
      flash(70, c);
      const n = a.motion === 'nova' ? 12 : 8;
      for (let i = 0; i < n; i++) { const an = (Math.PI * 2 * i) / n; const e = img(a.tex, tx, ty) || circ(tx, ty, 5, c); e.setScale(0.4); S.tweens.add({ targets: e, x: tx + Math.cos(an) * 34, y: ty + Math.sin(an) * 28, scale: 1, alpha: 0, duration: 460, delay: i * 25, ease: 'Back.out', onComplete: () => e.destroy() }); }
      if (a.motion === 'nova') { const r = circ(tx, ty, 6, c2, 0); r.setStrokeStyle(3, c2, 0.9); S.tweens.add({ targets: r, scale: 6, alpha: 0, duration: 480 }); }
      break;
    }
    case 'rain': case 'rainUp': {
      const up = a.motion === 'rainUp';
      for (let i = 0; i < 6; i++) { const x = tx + (i - 3) * 13 + 6; const e = img(a.tex, x, up ? ty + 60 : ty - 90) || tri(x, up ? ty + 60 : ty - 90, 10, c); e.setAlpha(0); S.tweens.add({ targets: e, y: ty, alpha: 1, duration: 300, delay: i * 60, ease: 'Quad.in', onComplete: () => kill(e, 130) }); }
      break;
    }
    case 'strike': case 'multiStrike': {
      const n = a.motion === 'multiStrike' ? 5 : 3;
      for (let i = 0; i < n; i++) { const e = img(a.tex, tx + (i % 2 ? 14 : -10), ty - (i * 6)) || star(tx + (i % 2 ? 14 : -10), ty - i * 6, 12, c); e.setScale(0.2).setAlpha(0); S.tweens.add({ targets: e, scale: 1.2, alpha: 1, duration: 110, delay: i * 90, ease: 'Back.out', onComplete: () => kill(e, 110) }); }
      S.cameras.main.shake(180, 0.008);
      break;
    }
    case 'bolt': {
      const b = rect(tx, ty - 55, 6, 110, c); b.setAlpha(0);
      S.tweens.add({ targets: b, alpha: 1, scaleX: 1.6, duration: 120, onComplete: () => { flash(110, c2); kill(b, 150); } });
      break;
    }
    case 'beam': case 'lasers': {
      const n = a.motion === 'lasers' ? 3 : 1;
      for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 10; const ln = line(fx.x, fx.y - 8 + off, fx.x, fx.y - 8 + off, c, 5); ln.setAlpha(0.9); S.tweens.add({ targets: ln, duration: 80, onUpdate: (tw) => { const p = tw.progress; ln.setTo(fx.x, fx.y - 8 + off, fx.x + (tx - fx.x) * p, ty + off); }, onComplete: () => { flash(80, c2); kill(ln, 160); } }); }
      break;
    }
    case 'slashArc': {
      const g = add(S.add.graphics()); g.lineStyle(4, c, 0.95);
      let p = 0; const ev = S.time.addEvent({ delay: 16, repeat: 18, callback: () => { p += 1 / 19; g.clear(); g.lineStyle(4, c, 0.95 * (1 - p * 0.5)); g.beginPath(); const a0 = -1.2, a1 = 1.2; const aa = a0 + (a1 - a0) * p; g.arc(tx, ty, 26, a0, aa); g.strokePath(); if (p >= 1) { kill(g, 120); } } });
      flash(60, c2);
      break;
    }
    case 'spiral': case 'orbit': {
      const n = 10; for (let i = 0; i < n; i++) { const e = img(a.tex, tx, ty) || circ(tx, ty, 4, c); const a0 = (Math.PI * 2 * i) / n; e.setScale(0.5); S.tweens.add({ targets: e, duration: 460, delay: i * 20, onUpdate: (tw) => { const r = (a.motion === 'orbit' ? 30 : 34 * (1 - tw.progress)); const an = a0 + tw.progress * 6; e.setPosition(tx + Math.cos(an) * r, ty + Math.sin(an) * r); }, onComplete: () => e.destroy() }); }
      break;
    }
    case 'shockwave': case 'ring': {
      for (let i = 0; i < 3; i++) { const r = circ(tx, ty, 8, c, 0); r.setStrokeStyle(4, i % 2 ? c2 : c, 0.9); S.tweens.add({ targets: r, scale: 5, alpha: 0, duration: 480, delay: i * 110, onComplete: () => r.destroy() }); }
      flash(60, c);
      break;
    }
    case 'vortex': case 'gust': {
      for (let i = 0; i < 8; i++) { const e = img(a.tex, tx + Math.cos(i) * 40, ty + Math.sin(i) * 30) || circ(tx + Math.cos(i) * 40, ty + Math.sin(i) * 30, 4, c2); S.tweens.add({ targets: e, x: tx, y: ty, angle: 360, scale: 0.2, alpha: 0, duration: 460, delay: i * 25, ease: 'Quad.in', onComplete: () => e.destroy() }); }
      break;
    }
    case 'meteor': case 'crush': {
      const e = img(a.tex, tx + 40, ty - 110) || circ(tx + 40, ty - 110, 12, c);
      S.tweens.add({ targets: e, x: tx, y: ty, scale: 1.4, duration: 320, ease: 'Quad.in', onComplete: () => { e.destroy(); flash(110, c2); S.cameras.main.shake(220, 0.012); ringBurst(circ, tx, ty, c, kill); } });
      break;
    }
    case 'charge': {
      const e = circ(fx.x, fx.y - 10, 4, c2, 0.9);
      S.tweens.add({ targets: e, scale: 4, duration: 280, ease: 'Quad.in', onComplete: () => { S.tweens.add({ targets: e, x: tx, y: ty, scale: 1, duration: 160, onComplete: () => { e.destroy(); flash(110, c); ringBurst(circ, tx, ty, c2, kill); } }); } });
      break;
    }
    case 'wave': case 'zigzag': {
      const e = img(a.tex, fx.x, fx.y - 10) || circ(fx.x, fx.y - 10, 6, c);
      S.tweens.add({ targets: e, x: tx, duration: 400, ease: 'Linear', onUpdate: (tw) => { const p = tw.progress; e.y = (fx.y - 10) + (ty - (fx.y - 10)) * p + Math.sin(p * (a.motion === 'zigzag' ? 18 : 10)) * 14; }, onComplete: () => { e.destroy(); flash(70, c2); } });
      break;
    }
    case 'spikes': {
      for (let i = 0; i < 5; i++) { const x = tx + (i - 2) * 14; const sp = tri(x, ty + 18, 14, c); sp.setAlpha(0); S.tweens.add({ targets: sp, y: ty - 6, alpha: 1, duration: 130, delay: i * 50, ease: 'Back.out', onComplete: () => kill(sp, 130) }); }
      S.cameras.main.shake(160, 0.007);
      break;
    }
    case 'twin': {
      for (const off of [-16, 16]) { const e = img(a.tex, fx.x, fx.y - 10 + off) || circ(fx.x, fx.y - 10 + off, 6, c); S.tweens.add({ targets: e, x: tx, y: ty, scale: 1.1, duration: 360, ease: 'Quad.in', onComplete: () => { e.destroy(); flash(60, c2); } }); }
      break;
    }
    default: { ringBurst(circ, tx, ty, c, kill); flash(70, c); }
  }
  S.time.delayedCall(dur, () => onDone?.());
}

function ringBurst(circ, x, y, col, kill) {
  for (let i = 0; i < 6; i++) { const an = (Math.PI * 2 * i) / 6; const e = circ(x, y, 4, col, 0.9); e.tw = null; const tx = x + Math.cos(an) * 24, ty = y + Math.sin(an) * 20; e.scene.tweens.add({ targets: e, x: tx, y: ty, scale: 0.2, alpha: 0, duration: 360, onComplete: () => e.destroy() }); }
}

/** FX de cambio de stat sobre un sprite (subida: asciende; bajada: cae). */
export function playStatFX(scene, sprite, up) {
  const tex = 'fx_' + STAT_FX[up ? 'up' : 'down'];
  if (!scene.textures.exists(tex)) return;
  const im = scene.add.image(sprite.x, sprite.y - 8, tex).setDepth(355).setScale(0.6).setAlpha(0);
  if (scene.stage) scene.stage.add(im);
  scene.tweens.add({ targets: im, y: sprite.y - (up ? 46 : -18), alpha: { from: 0, to: 1 }, scale: 1, duration: 360, ease: up ? 'Back.out' : 'Quad.in',
    onComplete: () => scene.tweens.add({ targets: im, alpha: 0, duration: 180, onComplete: () => im.destroy() }) });
}
