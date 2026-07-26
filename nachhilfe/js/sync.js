/**
 * Geräteübergreifende Synchronisation über Supabase (REST, ohne SDK).
 *
 * Ablauf: lokalen Bestand entschlüsselt zusammenführen -> verschlüsselt
 * hochladen. Der Server sieht nur den Chiffretext (siehe crypto.js); Zugriff
 * ist zusätzlich über Row Level Security auf den eigenen Account begrenzt.
 *
 * Tabelle (siehe SETUP.md):
 *   vault(user_id uuid pk, cipher, iv, salt, alg, iter, stamp int8, updated_at)
 */

import { store, mergeDb, latestStamp } from './store.js';
import { encryptJson, decryptJson, cryptoAvailable } from './crypto.js';
import { debounce } from './util.js';

const CFG_KEY = 'nh.sync.cfg';
const SESSION_KEY = 'nh.sync.session';
const PASS_KEY = 'nh.sync.pass';
const META_KEY = 'nh.sync.meta';

const read = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  if (value == null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
};

/* ------------------------------------------------------------------ */

class Sync extends EventTarget {
  constructor() {
    super();
    this.cfg = read(CFG_KEY, { url: '', anonKey: '', auto: true });
    this.session = read(SESSION_KEY);
    this.meta = read(META_KEY, { lastSync: 0, stamp: 0 });
    this.passphrase = read(PASS_KEY) || null;
    this.state = 'off';
    this.message = '';
    this.busy = false;
    this.queued = false;
    this.pushSoon = debounce(() => this.run('push'), 1500);
  }

  /* ---------- Zustand ---------- */

  get configured() {
    return Boolean(this.cfg.url && this.cfg.anonKey);
  }

  get signedIn() {
    return Boolean(this.session?.access_token && this.session?.user?.id);
  }

  get unlocked() {
    return Boolean(this.passphrase);
  }

  get email() {
    return this.session?.user?.email || '';
  }

  status() {
    let state = 'off';
    if (!this.configured) state = 'off';
    else if (!this.signedIn) state = 'signedout';
    else if (!this.unlocked) state = 'locked';
    else if (this.busy) state = 'busy';
    else if (this.state === 'error') state = 'error';
    else state = 'on';
    return { state, message: this.message, lastSync: this.meta.lastSync, email: this.email };
  }

  emit() {
    this.dispatchEvent(new CustomEvent('status', { detail: this.status() }));
  }

  setError(err) {
    this.state = 'error';
    this.message = err?.message || String(err);
    console.warn('[sync]', err);
    this.emit();
  }

  /* ---------- Konfiguration ---------- */

  configure({ url, anonKey, auto }) {
    const clean = String(url || '').trim().replace(/\/+$/, '');
    this.cfg = { url: clean, anonKey: String(anonKey || '').trim(), auto: auto !== false };
    write(CFG_KEY, this.cfg);
    this.state = 'idle';
    this.message = '';
    this.emit();
  }

  setPassphrase(pass, remember = true) {
    this.passphrase = pass || null;
    write(PASS_KEY, remember && pass ? pass : null);
    this.emit();
  }

  forget() {
    this.session = null;
    this.passphrase = null;
    this.meta = { lastSync: 0, stamp: 0 };
    write(SESSION_KEY, null);
    write(PASS_KEY, null);
    write(META_KEY, this.meta);
    this.state = 'idle';
    this.emit();
  }

  /** Trennt die Cloud komplett – lokale Daten bleiben erhalten. */
  disconnect() {
    this.forget();
    this.cfg = { url: '', anonKey: '', auto: true };
    write(CFG_KEY, this.cfg);
    this.state = 'off';
    this.emit();
  }

  /* ---------- HTTP ---------- */

  async api(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
    if (!this.configured) throw new Error('Sync ist nicht eingerichtet.');
    const h = {
      apikey: this.cfg.anonKey,
      'Content-Type': 'application/json',
      ...headers,
    };
    if (auth && this.session?.access_token) {
      h.Authorization = `Bearer ${this.session.access_token}`;
    }

    let res;
    try {
      res = await fetch(this.cfg.url + path, {
        method,
        headers: h,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error('Keine Verbindung zum Server. Offline?');
    }

    if (res.status === 401 && auth && this.session?.refresh_token && !this._refreshing) {
      await this.refreshSession();
      return this.api(path, { method, body, auth, headers });
    }

    const text = await res.text();
    const data = text ? safeJson(text) : null;
    if (!res.ok) {
      throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `Serverfehler ${res.status}`);
    }
    return data;
  }

  /* ---------- Auth ---------- */

  async signUp(email, password) {
    const data = await this.api('/auth/v1/signup', {
      method: 'POST', auth: false, body: { email, password },
    });
    if (data?.access_token) this.storeSession(data);
    return data;
  }

  async signIn(email, password) {
    const data = await this.api('/auth/v1/token?grant_type=password', {
      method: 'POST', auth: false, body: { email, password },
    });
    this.storeSession(data);
    return data;
  }

  async refreshSession() {
    if (!this.session?.refresh_token) throw new Error('Sitzung abgelaufen – bitte neu anmelden.');
    this._refreshing = true;
    try {
      const data = await this.api('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', auth: false, body: { refresh_token: this.session.refresh_token },
      });
      this.storeSession(data);
    } finally {
      this._refreshing = false;
    }
  }

  storeSession(data) {
    if (!data?.access_token) throw new Error('Anmeldung fehlgeschlagen.');
    this.session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      user: { id: data.user?.id, email: data.user?.email },
    };
    write(SESSION_KEY, this.session);
    this.state = 'idle';
    this.message = '';
    this.emit();
  }

  async signOut() {
    try {
      if (this.signedIn) await this.api('/auth/v1/logout', { method: 'POST', body: {} });
    } catch { /* Abmelden darf auch offline gelingen */ }
    this.forget();
  }

  /* ---------- Tresor ---------- */

  async fetchVault() {
    const rows = await this.api(
      `/rest/v1/vault?user_id=eq.${encodeURIComponent(this.session.user.id)}&select=*&limit=1`,
    );
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async putVault(payload, stamp) {
    await this.api('/rest/v1/vault', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: [{
        user_id: this.session.user.id,
        cipher: payload.cipher,
        iv: payload.iv,
        salt: payload.salt,
        alg: payload.alg,
        iter: payload.iter,
        stamp,
        updated_at: new Date().toISOString(),
      }],
    });
  }

  /* ---------- Synchronisieren ---------- */

  /**
   * Ein voller Zyklus: herunterladen, zusammenführen, bei Bedarf hochladen.
   * @param {'auto'|'push'|'pull'} reason
   */
  async run(reason = 'auto') {
    if (!this.configured || !this.signedIn) return;
    if (!cryptoAvailable()) return this.setError(new Error('Verschlüsselung nicht verfügbar (HTTPS nötig).'));
    if (!this.unlocked) {
      this.state = 'locked';
      return this.emit();
    }
    if (this.busy) {
      this.queued = true;
      return;
    }

    this.busy = true;
    this.state = 'syncing';
    this.emit();

    try {
      const local = store.db;
      const row = await this.fetchVault();

      let merged = local;
      let remoteChanged = false;

      if (row?.cipher) {
        const remote = await decryptJson(row, this.passphrase);
        merged = mergeDb(local, remote);
        remoteChanged = JSON.stringify(merged) !== JSON.stringify(local);
      }

      if (remoteChanged) store.replaceAll(merged, { silent: false });

      const stamp = latestStamp(store.db);
      const needsPush = reason === 'push' || !row || Number(row.stamp || 0) !== stamp || remoteChanged;

      if (needsPush) {
        // Salt wiederverwenden, damit derselbe Schlüssel gilt.
        const payload = await encryptJson(
          store.db,
          this.passphrase,
          row?.salt ? base64ToBytes(row.salt) : undefined,
        );
        await this.putVault(payload, stamp);
      }

      this.meta = { lastSync: Date.now(), stamp };
      write(META_KEY, this.meta);
      this.state = 'idle';
      this.message = '';
    } catch (err) {
      this.setError(err);
    } finally {
      this.busy = false;
      this.emit();
      if (this.queued) {
        this.queued = false;
        setTimeout(() => this.run('auto'), 400);
      }
    }
  }

  /** Startet Auto-Sync: bei Änderungen, beim Fokus und periodisch. */
  start() {
    store.onChange((e) => {
      if (e.detail?.local !== false && this.cfg.auto) this.pushSoon();
    });

    const maybe = () => {
      if (!this.cfg.auto || !this.signedIn) return;
      if (Date.now() - (this.meta.lastSync || 0) > 20000) this.run('auto');
    };

    window.addEventListener('focus', maybe);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') maybe();
    });
    window.addEventListener('online', () => this.run('auto'));
    setInterval(maybe, 120000);

    if (this.signedIn && this.cfg.auto) this.run('auto');
    this.emit();
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 200) };
  }
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const sync = new Sync();
