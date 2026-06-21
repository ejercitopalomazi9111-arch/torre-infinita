// net.js — Transporte P2P para el modo ONLINE (Club de Batalla). Usa PeerJS
// (WebRTC con broker público gratuito): sin servidor propio que mantener. Un
// jugador HOSPEDA (genera un código de sala) y el otro se UNE con ese código.
// Mensajería simple por JSON: send({type, ...}) / onMessage(cb).
//
// Códigos de sala: prefijo fijo para no chocar con otros usuarios del broker.
import { Peer } from 'peerjs';

const PREFIX = 'torreinf-';                 // namespace en el broker público
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin caracteres ambiguos
const randCode = (n = 4) => Array.from({ length: n }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export class Net {
  constructor() {
    this.peer = null; this.conn = null; this.isHost = false;
    this.code = null; this.handlers = {}; this.connected = false;
  }

  /** Eventos: 'open'(code) · 'connect'() · 'data'(msg) · 'close'() · 'error'(e) */
  on(ev, cb) { (this.handlers[ev] = this.handlers[ev] || []).push(cb); return this; }
  off(ev, cb) { if (this.handlers[ev]) this.handlers[ev] = this.handlers[ev].filter((h) => h !== cb); return this; }
  _emit(ev, arg) { for (const cb of (this.handlers[ev] || [])) { try { cb(arg); } catch (e) { console.warn('net handler', e); } } }

  /** HOSPEDAR: crea un peer con código de sala y espera a que alguien se conecte. */
  host() {
    this.isHost = true;
    this.code = randCode();
    this.peer = new Peer(PREFIX + this.code, { debug: 1 });
    this.peer.on('open', () => this._emit('open', this.code));
    this.peer.on('connection', (c) => { this.conn = c; this._wireConn(); });
    this.peer.on('error', (e) => this._emit('error', e));
    return this;
  }

  /** UNIRSE: conecta a una sala existente por su código. */
  join(code) {
    this.isHost = false;
    this.code = String(code || '').toUpperCase().trim();
    this.peer = new Peer({ debug: 1 });
    this.peer.on('open', () => {
      this.conn = this.peer.connect(PREFIX + this.code, { reliable: true });
      this._wireConn();
      this._emit('open', this.code);
    });
    this.peer.on('error', (e) => this._emit('error', e));
    return this;
  }

  _wireConn() {
    this.conn.on('open', () => { this.connected = true; this._emit('connect'); });
    this.conn.on('data', (d) => { try { this._emit('data', typeof d === 'string' ? JSON.parse(d) : d); } catch { this._emit('data', d); } });
    this.conn.on('close', () => { this.connected = false; this._emit('close'); });
    this.conn.on('error', (e) => this._emit('error', e));
  }

  /** Envía un objeto (se serializa a JSON). */
  send(obj) { if (this.conn && this.connected) { try { this.conn.send(JSON.stringify(obj)); return true; } catch (e) { this._emit('error', e); } } return false; }

  close() {
    try { this.conn?.close(); } catch { /* */ }
    try { this.peer?.destroy(); } catch { /* */ }
    this.connected = false; this.conn = null; this.peer = null;
  }
}
