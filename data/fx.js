// fx.js — Mapa DATA-DRIVEN de efectos de ataque por TIPO (motor de animaciones).
// Assets REALES del cliente Pokémon Showdown (assets/fx/, via tools/fetch-fx.mjs).
// motion: 'projectile' (viaja al objetivo) · 'burst' (estalla sobre el objetivo)
//         'rain' (cae desde arriba) · 'strike' (golpe seco en el objetivo)
//         'bolt' (cae un rayo vertical)
// Curvas estilo anime.js: Quad.in (acelera), Back.out (rebasa), stagger en counts.

export const FX_FILES = [
  'fireball', 'bluefireball', 'waterwisp', 'lightning', 'icicle', 'leaf1', 'leaf2',
  'poisonwisp', 'mudwisp', 'rock1', 'rock2', 'rock3', 'web', 'shadowball',
  'mistball', 'energyball', 'electroball', 'iceball', 'fist', 'foot', 'wisp',
  'blackwisp', 'feather', 'sword', 'heart', 'angry', 'shine', 'pokeball',
  'gear', 'hitmarker', 'flareball',
];

export const TYPE_FX = {
  normal:   { motion: 'strike',     tex: ['hitmarker'],               count: 1 },
  fighting: { motion: 'strike',     tex: ['fist', 'foot'],            count: 2 },
  fire:     { motion: 'projectile', tex: ['fireball'],                count: 1, burst: 'fireball' },
  water:    { motion: 'projectile', tex: ['waterwisp'],               count: 1, burst: 'waterwisp' },
  electric: { motion: 'bolt',       tex: ['lightning'],               count: 1 },
  grass:    { motion: 'rain',       tex: ['leaf1', 'leaf2'],          count: 6 },
  ice:      { motion: 'rain',       tex: ['icicle'],                  count: 4 },
  poison:   { motion: 'burst',      tex: ['poisonwisp'],              count: 3 },
  ground:   { motion: 'burst',      tex: ['mudwisp'],                 count: 4 },
  flying:   { motion: 'rain',       tex: ['feather'],                 count: 5 },
  psychic:  { motion: 'burst',      tex: ['mistball'],                count: 3 },
  bug:      { motion: 'projectile', tex: ['web'],                     count: 1 },
  rock:     { motion: 'rain',       tex: ['rock1', 'rock2', 'rock3'], count: 4 },
  ghost:    { motion: 'projectile', tex: ['shadowball'],              count: 1, burst: 'blackwisp' },
  dragon:   { motion: 'projectile', tex: ['bluefireball'],            count: 1, burst: 'bluefireball' },
  dark:     { motion: 'burst',      tex: ['blackwisp'],               count: 3 },
  steel:    { motion: 'strike',     tex: ['gear'],                    count: 2 },
  fairy:    { motion: 'burst',      tex: ['heart'],                   count: 4 },
};

// FX de cambios de stat: subir = espada dorada que asciende · bajar = furia roja
export const STAT_FX = { up: 'sword', down: 'angry' };
