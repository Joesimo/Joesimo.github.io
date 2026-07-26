/**
 * Datenhaltung: local-first.
 *
 * Alles liegt als ein JSON-Dokument im localStorage. Jeder Datensatz trägt
 * `id` und `updatedAt`; Löschen setzt nur `deleted: true` (Tombstone), damit
 * beim Sync zwischen Geräten pro Datensatz zusammengeführt werden kann statt
 * ein Gerät das andere zu überschreiben.
 */

import { uid, now, isoDate } from './util.js';

const KEY = 'nh.db.v1';
export const SCHEMA_VERSION = 1;

export const COLLECTIONS = ['students', 'lessons', 'grades'];

export const DEFAULT_SETTINGS = {
  tutorName: '',
  defaultRate: 25,
  defaultDuration: 60,
  currency: 'EUR',
  gradeSystem: 'note',   // 'note' (1–6) | 'punkte' (0–15)
  theme: 'system',       // 'system' | 'light' | 'dark'
  weekStartsMonday: true,
};

function emptyDb() {
  return {
    schema: SCHEMA_VERSION,
    createdAt: now(),
    students: [],
    lessons: [],
    grades: [],
    settings: { ...DEFAULT_SETTINGS },
    settingsUpdatedAt: now(),
  };
}

/* ------------------------------------------------------------------ */

class Store extends EventTarget {
  constructor() {
    super();
    this.db = emptyDb();
    this.ready = false;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.db = pruneTombstones(migrate(JSON.parse(raw)));
    } catch (err) {
      console.error('[store] Laden fehlgeschlagen, starte leer', err);
    }
    this.ready = true;
    return this.db;
  }

  /** Persistiert und benachrichtigt Views + Sync. */
  save({ silent = false, local = true } = {}) {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.db));
    } catch (err) {
      console.error('[store] Speichern fehlgeschlagen', err);
      this.dispatchEvent(new CustomEvent('error', { detail: err }));
    }
    if (!silent) this.dispatchEvent(new CustomEvent('change', { detail: { local } }));
  }

  onChange(fn) {
    this.addEventListener('change', fn);
    return () => this.removeEventListener('change', fn);
  }

  /* ---------- Lesen ---------- */

  /** Alle nicht gelöschten Einträge einer Collection. */
  all(collection) {
    return (this.db[collection] || []).filter((r) => !r.deleted);
  }

  get(collection, id) {
    const rec = (this.db[collection] || []).find((r) => r.id === id);
    return rec && !rec.deleted ? rec : null;
  }

  get settings() {
    return this.db.settings;
  }

  /* ---------- Schreiben ---------- */

  /** Legt an oder aktualisiert (per `id`) und gibt den Datensatz zurück. */
  upsert(collection, data) {
    const list = this.db[collection] || (this.db[collection] = []);
    const idx = data.id ? list.findIndex((r) => r.id === data.id) : -1;
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...data, updatedAt: now() };
      this.save();
      return list[idx];
    }
    const rec = { ...data, id: data.id || uid(), createdAt: now(), updatedAt: now() };
    list.push(rec);
    this.save();
    return rec;
  }

  /** Soft-Delete inkl. abhängiger Datensätze bei Schülern. */
  remove(collection, id) {
    const list = this.db[collection] || [];
    const rec = list.find((r) => r.id === id);
    if (!rec) return;
    rec.deleted = true;
    rec.updatedAt = now();

    if (collection === 'students') {
      for (const c of ['lessons', 'grades']) {
        for (const r of this.db[c] || []) {
          if (r.studentId === id && !r.deleted) {
            r.deleted = true;
            r.updatedAt = now();
          }
        }
      }
    }
    this.save();
  }

  updateSettings(patch) {
    this.db.settings = { ...this.db.settings, ...patch };
    this.db.settingsUpdatedAt = now();
    this.save();
  }

  /* ---------- Import / Export ---------- */

  export() {
    return JSON.stringify({ ...this.db, exportedAt: new Date().toISOString() }, null, 2);
  }

  /** @param {'merge'|'replace'} mode */
  import(json, mode = 'merge') {
    const incoming = migrate(typeof json === 'string' ? JSON.parse(json) : json);
    if (!incoming || !Array.isArray(incoming.students)) throw new Error('Unbekanntes Dateiformat');
    this.db = mode === 'replace' ? incoming : mergeDb(this.db, incoming);
    this.save();
    return this.db;
  }

  /** Ersetzt den kompletten Datenbestand (Sync-Pfad). */
  replaceAll(db, { silent = false } = {}) {
    this.db = migrate(db);
    this.save({ silent, local: false });
  }

  wipe() {
    this.db = emptyDb();
    this.save();
  }
}

/* ------------------------------------------------------------------ */

/** Hebt ältere Dokumente auf das aktuelle Schema. */
export function migrate(db) {
  const out = { ...emptyDb(), ...db };
  out.schema = SCHEMA_VERSION;
  out.settings = { ...DEFAULT_SETTINGS, ...(db?.settings || {}) };
  for (const c of COLLECTIONS) {
    out[c] = Array.isArray(db?.[c]) ? db[c].filter(Boolean) : [];
    for (const r of out[c]) {
      if (!r.id) r.id = uid();
      if (!r.updatedAt) r.updatedAt = r.createdAt || 0;
    }
  }
  return out;
}

/**
 * Führt zwei Datenbestände datensatzweise zusammen – der jüngere
 * `updatedAt` gewinnt. Tombstones bleiben erhalten, damit ein Löschen
 * nicht durch ein Gerät mit altem Stand rückgängig gemacht wird.
 */
export function mergeDb(a, b) {
  const out = {
    ...a,
    schema: SCHEMA_VERSION,
    createdAt: Math.min(a.createdAt || now(), b.createdAt || now()),
  };

  for (const c of COLLECTIONS) {
    const map = new Map();
    for (const rec of a[c] || []) map.set(rec.id, rec);
    for (const rec of b[c] || []) {
      const cur = map.get(rec.id);
      if (!cur || (rec.updatedAt || 0) > (cur.updatedAt || 0)) map.set(rec.id, rec);
    }
    out[c] = [...map.values()];
  }

  const aTime = a.settingsUpdatedAt || 0;
  const bTime = b.settingsUpdatedAt || 0;
  if (bTime > aTime) {
    out.settings = { ...DEFAULT_SETTINGS, ...b.settings };
    out.settingsUpdatedAt = bTime;
  }
  return out;
}

/** Neuester `updatedAt` im Dokument – Basis für Sync-Vergleiche. */
export function latestStamp(db) {
  let max = db?.settingsUpdatedAt || 0;
  for (const c of COLLECTIONS) {
    for (const r of db?.[c] || []) if ((r.updatedAt || 0) > max) max = r.updatedAt;
  }
  return max;
}

/** Entfernt Tombstones, die älter als `days` sind. */
export function pruneTombstones(db, days = 180) {
  const cutoff = now() - days * 86400000;
  for (const c of COLLECTIONS) {
    db[c] = (db[c] || []).filter((r) => !(r.deleted && (r.updatedAt || 0) < cutoff));
  }
  return db;
}

export const store = new Store();

/* ------------------------------------------------------------------ */
/* Fachliche Konstanten                                                */
/* ------------------------------------------------------------------ */

export const SUBJECTS = [
  'Mathematik', 'Deutsch', 'Englisch', 'Physik', 'Chemie', 'Biologie',
  'Französisch', 'Latein', 'Spanisch', 'Informatik', 'Geschichte',
  'Erdkunde', 'Politik/Wirtschaft', 'Religion/Ethik', 'Musik', 'Kunst', 'Sonstiges',
];

export const SCHOOL_TYPES = [
  'Grundschule', 'Hauptschule', 'Realschule', 'Gesamtschule',
  'Gymnasium', 'Berufsschule', 'Universität', 'Sonstige',
];

export const GRADE_TYPES = [
  'Klassenarbeit', 'Klausur', 'Test', 'Mündlich', 'Referat',
  'Hausaufgabe', 'Projekt', 'Zeugnis', 'Sonstiges',
];

export const LESSON_STATUS = {
  planned: { label: 'Geplant', badge: 'badge-info' },
  done: { label: 'Gehalten', badge: 'badge-ok' },
  cancelled: { label: 'Abgesagt', badge: 'badge-danger' },
};

export const STUDENT_STATUS = {
  active: { label: 'Aktiv', badge: 'badge-ok' },
  paused: { label: 'Pausiert', badge: 'badge-warn' },
  ended: { label: 'Beendet', badge: '' },
};

/* ---------- Noten-Logik ---------- */

/** Punkte (0–15) -> Notenwert (0,7–6,0). Offizielle Umrechnung der Oberstufe. */
const PUNKTE_TO_NOTE = [6.0, 5.3, 5.0, 4.7, 4.3, 4.0, 3.7, 3.3, 3.0, 2.7, 2.3, 2.0, 1.7, 1.3, 1.0, 0.7];

/** Vereinheitlicht jede Bewertung auf die Notenskala (kleiner = besser). */
export function toNote(value, system) {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  if (system === 'punkte') return PUNKTE_TO_NOTE[Math.round(Math.min(15, Math.max(0, v)))];
  if (system === 'percent') return Math.max(1, Math.min(6, 6 - (v / 100) * 5));
  return Math.min(6, Math.max(1, v));
}

/** Gewichteter Durchschnitt auf Notenskala; `null` wenn keine Werte. */
export function average(grades) {
  let wsum = 0;
  let vsum = 0;
  for (const g of grades) {
    const n = toNote(g.value, g.system);
    if (n == null) continue;
    const w = Number(g.weight) > 0 ? Number(g.weight) : 1;
    vsum += n * w;
    wsum += w;
  }
  return wsum ? vsum / wsum : null;
}

/** Anzeigeform einer Bewertung, z. B. "2,3" oder "11 P". */
export function formatGrade(value, system) {
  const v = Number(value);
  if (!Number.isFinite(v)) return '–';
  if (system === 'punkte') return `${Math.round(v)} P`;
  if (system === 'percent') return `${Math.round(v)} %`;
  return v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** CSS-Klasse für die Farbgebung einer Note. */
export function gradeClass(note) {
  if (note == null) return '';
  if (note < 1.75) return 'g-1';
  if (note < 2.75) return 'g-2';
  if (note < 3.75) return 'g-3';
  if (note < 4.75) return 'g-4';
  return 'g-5';
}

/**
 * Trend der letzten Bewertungen: Durchschnitt der jüngsten Hälfte gegen
 * die ältere. Negatives Delta = Note verbessert sich.
 */
export function gradeTrend(grades) {
  const list = grades
    .filter((g) => toNote(g.value, g.system) != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (list.length < 2) return { dir: 'flat', delta: 0 };
  const cut = Math.floor(list.length / 2);
  const older = average(list.slice(0, cut));
  const recent = average(list.slice(cut));
  if (older == null || recent == null) return { dir: 'flat', delta: 0 };
  const delta = recent - older;
  if (Math.abs(delta) < 0.15) return { dir: 'flat', delta };
  return { dir: delta < 0 ? 'up' : 'down', delta };
}

/** Honorar einer Stunde – Stundensatz ist anteilig zur Dauer. */
export function lessonFee(lesson, student, settings) {
  const rate = Number(
    lesson.rate ?? student?.rate ?? settings?.defaultRate ?? 0,
  );
  const mins = Number(lesson.durationMin) || Number(settings?.defaultDuration) || 60;
  return (rate * mins) / 60;
}

/** Neue Stunde mit sinnvollen Vorbelegungen. */
export function draftLesson(settings, student) {
  return {
    studentId: student?.id || '',
    date: isoDate(new Date()),
    start: '15:00',
    durationMin: Number(settings.defaultDuration) || 60,
    subject: student?.subjects?.[0] || '',
    topic: '',
    homework: '',
    notes: '',
    status: 'planned',
    paid: false,
    // Leer lassen, solange kein Schüler feststeht – dann greift dessen
    // Stundensatz, statt den Standardwert einzufrieren.
    rate: student?.rate ?? null,
  };
}
