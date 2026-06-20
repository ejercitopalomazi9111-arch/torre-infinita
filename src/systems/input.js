// input.js — Esquema de control tipo GAME BOY ADVANCE (botones lógicos).
// Pensado para jugar en consola/emulador GBA: D-pad + A + B + L + R + Start +
// Select, todo mapeado a teclas (remapeable). Cero dependencia del ratón.
//
// Mapeo por defecto (compatible con emuladores tipo mGBA/VBA):
//   D-pad  → flechas + WASD
//   A      → Z · Space · J        (confirmar / interactuar)
//   B      → X · Backspace · K     (cancelar / volver / correr)
//   L / R  → Q / E                 (gatillos)
//   Start  → Enter                 (menú; también confirma en menús)
//   Select → Shift · C
import Phaser from 'phaser';

const KC = Phaser.Input.Keyboard.KeyCodes;
export const DEFAULT_MAP = {
  UP: [KC.UP, KC.W], DOWN: [KC.DOWN, KC.S], LEFT: [KC.LEFT, KC.A], RIGHT: [KC.RIGHT, KC.D],
  A: [KC.Z, KC.SPACE, KC.J], B: [KC.X, KC.BACKSPACE, KC.K],
  L: [KC.Q], R: [KC.E], START: [KC.ENTER], SELECT: [KC.SHIFT, KC.C],
};

// GAMEPAD (PS4/DualShock y estándar): ✕=A · ◯=B · D-pad/stick izq=direcciones
// · Options=Start · Share=Select · L1/R1=L/R. Índices del mapeo estándar W3C.
const PAD_BTN = { A: [0], B: [1], L: [4], R: [5], START: [9], SELECT: [8], UP: [12], DOWN: [13], LEFT: [14], RIGHT: [15], SQR: [2], TRI: [3] };
const AXIS_T = 0.45;   // zona muerta del stick

/** Crea el gestor de input GBA para una escena. */
export function makeInput(scene, map = DEFAULT_MAP) {
  const keys = {};
  for (const [btn, codes] of Object.entries(map)) {
    keys[btn] = codes.map(c => scene.input.keyboard.addKey(c, false));
  }
  const getPad = () => (scene.input.gamepad && scene.input.gamepad.total > 0) ? scene.input.gamepad.getPad(0) : null;
  const padDown = (btn) => {
    const p = getPad(); if (!p) return false;
    if ((PAD_BTN[btn] || []).some(i => p.buttons[i]?.pressed)) return true;
    const ax = p.axes[0]?.getValue() ?? 0, ay = p.axes[1]?.getValue() ?? 0;
    if (btn === 'LEFT') return ax < -AXIS_T;
    if (btn === 'RIGHT') return ax > AXIS_T;
    if (btn === 'UP') return ay < -AXIS_T;
    if (btn === 'DOWN') return ay > AXIS_T;
    return false;
  };
  const padPrev = {};
  const padJust = (btn) => {
    const now = padDown(btn), was = padPrev[btn] || false;
    padPrev[btn] = now;
    return now && !was;
  };
  const anyDown = (btn) => (keys[btn] || []).some(k => k.isDown) || padDown(btn);
  const anyJust = (btn) => (keys[btn] || []).some(k => Phaser.Input.Keyboard.JustDown(k)) || padJust(btn);
  return {
    keys,
    isDown: anyDown,
    justDown: anyJust,
    /** confirmar = A o Start (Enter), para menús */
    confirm: () => anyJust('A') || anyJust('START'),
    /** cancelar/volver = B */
    cancel: () => anyJust('B'),
    /** dirección d-pad recién pulsada: 'up'|'down'|'left'|'right'|null */
    dirJust: () => anyJust('UP') ? 'up' : anyJust('DOWN') ? 'down' : anyJust('LEFT') ? 'left' : anyJust('RIGHT') ? 'right' : null,
    /** dirección d-pad mantenida */
    dirHeld: () => anyDown('UP') ? 'up' : anyDown('DOWN') ? 'down' : anyDown('LEFT') ? 'left' : anyDown('RIGHT') ? 'right' : null,
  };
}
