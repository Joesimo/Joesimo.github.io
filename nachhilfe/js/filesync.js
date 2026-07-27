/**
 * Datei-Synchronisation – ohne Server, ohne Konto.
 *
 * Die App verknüpft sich einmalig mit einer Datei auf der Festplatte und hält
 * sie danach von selbst aktuell: Änderungen werden hineingeschrieben, und beim
 * Zurückkehren in die App wird gelesen, was inzwischen darin steht. Liegt die
 * Datei in einem Ordner, den ein anderes Programm ohnehin abgleicht
 * (iCloud Drive, Dropbox, Nextcloud, USB-Stick), synchronisieren sich mehrere
 * Rechner damit automatisch.
 *
 * Zusammengeführt wird pro Datensatz (siehe mergeDb) – wer zuletzt geändert
 * hat, gewinnt. Ein Gerät überschreibt also nie stumpf das andere.
 *
 * Die dafür nötige File System Access API gibt es nur in Chrome und Edge auf
 * dem Desktop. Auf dem Handy – und in Firefox und Safari – sind Browser-Apps
 * vom Dateisystem abgeschottet; dort bleibt der Weg über „Teilen“ und
 * „Datei einlesen“, den `exportFile()` und `readFile()` bedienen.
 */

import { store, mergeDb, latestStamp } from './store.js';
import { encryptJson, decryptJson, cryptoAvailable } from './crypto.js';
import { debounce, download, today } from './util.js';

const CFG_KEY = 'nh.file.cfg';
const PASS_KEY = 'nh.file.pass';
const DB_NAME = 'nh-filesync';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'main';

/** Kennzeichnet eine verschlüsselte Datei. */
const ENC_MARKER = 'nachhilfe-manager/verschluesselt';

export const fileSyncSupported = () =>
  typeof window !== 'undefined' && 'showSaveFilePicker' in window;

/* ------------------------------------------------------------------ */
/* Datei-Referenz überdauert das Schließen des Browsers (IndexedDB)    */
/* ------------------------------------------------------------------ */

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(value) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet() {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbClear() {
  const db = await idb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
  });
}

/* ------------------------------------------------------------------ */

const readCfg = () => {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || { auto: true, name: '', encrypt: false, lastSync: 0 };
  } catch {
    return { auto: true, name: '', encrypt: false, lastSync: 0 };
  }
};

/* ------------------------------------------------------------------ */

class FileSync extends EventTarget {
  constructor() {
    super();
    this.cfg = readCfg();
    this.handle = null;
    this.passphrase = localStorage.getItem(PASS_KEY) || null;
    this.busy = false;
    this.message = '';
    this.error = null;
    this.pushSoon = debounce(() => this.run('push'), 1200);
  }

  /* ---------- Zustand ---------- */

  get linked() {
    return Boolean(this.handle);
  }

  status() {
    let state;
    if (!fileSyncSupported()) state = 'unsupported';
    else if (!this.handle) state = this.cfg.name ? 'needs-permission' : 'off';
    else if (this.busy) state = 'busy';
    else if (this.error) state = 'error';
    else state = 'on';
    return {
      state,
      name: this.cfg.name,
      lastSync: this.cfg.lastSync,
      encrypt: this.cfg.encrypt,
      message: this.error?.message || this.message,
    };
  }

  emit() {
    this.dispatchEvent(new CustomEvent('status', { detail: this.status() }));
  }

  saveCfg(patch = {}) {
    this.cfg = { ...this.cfg, ...patch };
    localStorage.setItem(CFG_KEY, JSON.stringify(this.cfg));
  }

  setPassphrase(pass) {
    this.passphrase = pass || null;
    if (pass) localStorage.setItem(PASS_KEY, pass);
    else localStorage.removeItem(PASS_KEY);
  }

  /* ---------- Verknüpfen ---------- */

  /** Legt eine neue Datei an. Erfordert eine Nutzeraktion (Klick). */
  async createFile() {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'nachhilfe-daten.json',
      types: [{ description: 'Nachhilfe-Daten', accept: { 'application/json': ['.json'] } }],
    });
    await this.adopt(handle);
    await this.run('push');
    return handle;
  }

  /** Verknüpft eine bereits vorhandene Datei (z. B. vom anderen Rechner). */
  async openFile() {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'Nachhilfe-Daten', accept: { 'application/json': ['.json'] } }],
    });
    await this.adopt(handle);
    await this.run('auto');
    return handle;
  }

  async adopt(handle) {
    this.handle = handle;
    this.error = null;
    await idbPut(handle);
    this.saveCfg({ name: handle.name });
    this.emit();
  }

  /** Stellt die Verknüpfung nach einem Neustart wieder her. */
  async restore({ interactive = false } = {}) {
    if (!fileSyncSupported()) return false;
    const handle = await idbGet().catch(() => null);
    if (!handle) return false;

    const opts = { mode: 'readwrite' };
    let permission = await handle.queryPermission(opts);
    if (permission !== 'granted' && interactive) {
      permission = await handle.requestPermission(opts);
    }
    if (permission !== 'granted') {
      this.handle = null;
      this.emit();
      return false;
    }

    this.handle = handle;
    this.error = null;
    this.emit();
    return true;
  }

  async unlink() {
    this.handle = null;
    await idbClear();
    this.saveCfg({ name: '', lastSync: 0 });
    this.emit();
  }

  /* ---------- Lesen und Schreiben ---------- */

  async readLinked() {
    const file = await this.handle.getFile();
    const text = await file.text();
    if (!text.trim()) return null;
    return this.parse(text);
  }

  async writeLinked(db) {
    const writable = await this.handle.createWritable();
    await writable.write(await this.serialize(db));
    await writable.close();
  }

  /** Erzeugt den Dateiinhalt – bei Bedarf verschlüsselt. */
  async serialize(db) {
    if (this.cfg.encrypt && this.passphrase && cryptoAvailable()) {
      const payload = await encryptJson(db, this.passphrase);
      return JSON.stringify({ format: ENC_MARKER, ...payload }, null, 2);
    }
    return JSON.stringify(db, null, 2);
  }

  /** Liest den Dateiinhalt – erkennt verschlüsselte Dateien selbst. */
  async parse(text) {
    const raw = JSON.parse(text);
    if (raw?.format === ENC_MARKER) {
      if (!this.passphrase) throw new Error('Die Datei ist verschlüsselt – bitte Passwort eingeben.');
      return decryptJson(raw, this.passphrase);
    }
    return raw;
  }

  /* ---------- Abgleich ---------- */

  /** @param {'auto'|'push'|'pull'} reason */
  async run(reason = 'auto') {
    if (!this.handle) return;
    if (this.busy) return;

    this.busy = true;
    this.emit();

    try {
      const local = store.db;
      let merged = local;
      let changedLocally = false;

      if (reason !== 'push') {
        const remote = await this.readLinked();
        if (remote && Array.isArray(remote.students)) {
          merged = mergeDb(local, remote);
          changedLocally = latestStamp(merged) !== latestStamp(local)
            || JSON.stringify(merged) !== JSON.stringify(local);
        }
      }

      if (changedLocally) store.replaceAll(merged, { silent: false });

      if (reason !== 'pull') await this.writeLinked(store.db);

      this.error = null;
      this.saveCfg({ lastSync: Date.now() });
    } catch (err) {
      this.error = err;
      console.warn('[filesync]', err);
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  /** Verbindet sich beim Start neu und hält die Datei danach aktuell. */
  async start() {
    if (!fileSyncSupported()) return this.emit();

    await this.restore();

    store.onChange((e) => {
      if (e.detail?.local !== false && this.cfg.auto && this.handle) this.pushSoon();
    });

    const maybePull = () => {
      if (!this.handle || !this.cfg.auto) return;
      if (Date.now() - (this.cfg.lastSync || 0) > 5000) this.run('auto');
    };

    window.addEventListener('focus', maybePull);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') maybePull();
    });
    setInterval(maybePull, 60000);

    if (this.handle) this.run('auto');
    this.emit();
  }
}

export const fileSync = new FileSync();

/* ------------------------------------------------------------------ */
/* Manueller Weg – funktioniert auf jedem Gerät                        */
/* ------------------------------------------------------------------ */

/** Dateiname mit Datum, damit sich Sicherungen unterscheiden lassen. */
export const backupName = () => `nachhilfe-${today()}.json`;

/**
 * Speichert den Datenbestand als Datei.
 * @param {string|null} passphrase optional – verschlüsselt die Datei
 */
export async function exportFile(passphrase = null) {
  const data = passphrase && cryptoAvailable()
    ? JSON.stringify({ format: ENC_MARKER, ...(await encryptJson(store.db, passphrase)) }, null, 2)
    : store.export();
  download(backupName(), data);
}

/** Teilen-Dialog des Geräts (AirDrop, Nachrichten, Dateien-App …). */
export async function shareFile(passphrase = null) {
  const data = passphrase && cryptoAvailable()
    ? JSON.stringify({ format: ENC_MARKER, ...(await encryptJson(store.db, passphrase)) }, null, 2)
    : store.export();

  const file = new File([data], backupName(), { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Nachhilfe-Daten' });
    return true;
  }
  return false;
}

/**
 * Liest eine ausgewählte Datei ein.
 * @returns {Promise<object>} der geparste Datenbestand
 */
export async function readFile(file, passphrase = null) {
  const text = await file.text();
  const raw = JSON.parse(text);
  if (raw?.format === ENC_MARKER) {
    if (!passphrase) {
      const err = new Error('Diese Datei ist verschlüsselt.');
      err.needsPassphrase = true;
      throw err;
    }
    return decryptJson(raw, passphrase);
  }
  return raw;
}

export const isEncryptedFile = async (file) => {
  try {
    return JSON.parse(await file.text())?.format === ENC_MARKER;
  } catch {
    return false;
  }
};
