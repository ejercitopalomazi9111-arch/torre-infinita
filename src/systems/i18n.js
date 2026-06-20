// i18n.js — Motor de localización (sección O). Inglés = idioma base interno.
// NADA hardcodeado: toda cadena vive en /i18n/<lang>.json. Añadir idioma =
// añadir un JSON, sin tocar lógica. t(clave, params) con fallback EN → clave.

let _base = {};      // en.json (referencia de claves)
let _active = {};    // idioma activo
let _lang = 'en';

/** Carga base (en) y el idioma activo. NAVEGADOR: fetch a ruta relativa ESTABLE
 *  (funciona en dev y en build; antes `new URL(...import.meta.url)` lo reescribía
 *  Vite y colgaba el arranque en producción). Node: fs. Nunca cuelga (fallback {}). */
export async function loadLocale(lang = 'en') {
  _lang = lang;
  const read = async (code) => {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const r = await fetch(`i18n/${code}.json`);   // relativo a la raíz del sitio
      if (!r.ok) throw new Error('i18n ' + code + ' ' + r.status);
      return r.json();
    }
    const fs = await import('node:fs/promises');
    const url = new URL(`../../i18n/${code}.json`, import.meta.url);
    return JSON.parse(await fs.readFile(url, 'utf8'));
  };
  _base = await read('en').catch(() => ({}));          // si falla, claves crudas (no cuelga)
  _active = lang === 'en' ? _base : await read(lang).catch(() => ({}));
  return _lang;
}

/** Traduce una clave con interpolación {var}. Fallback: activo → base → clave. */
export function t(key, params = {}) {
  let s = _active[key] ?? _base[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export function currentLang() { return _lang; }
export function availableKeys() { return Object.keys(_base); }
