/* Kleine Helfer – bewusst abhängigkeitsfrei. */

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

export const now = () => Date.now();

/* ---------- Escaping ---------- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Tagged Template: escaped standardmäßig, Arrays werden gejoined. */
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    out += (Array.isArray(v) ? v.join('') : v ?? '') + strings[i + 1];
  }
  return out;
}

/* ---------- Datum ---------- */
export const pad2 = (n) => String(n).padStart(2, '0');

/** ISO-Datum (YYYY-MM-DD) in lokaler Zeit – kein UTC-Versatz. */
export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export const today = () => isoDate(new Date());

export function addDays(iso, n) {
  const d = parseDate(iso) || new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** Montag der Woche, in der `iso` liegt. */
export function startOfWeek(iso) {
  const d = parseDate(iso) || new Date();
  const wd = (d.getDay() + 6) % 7; // Mo = 0
  d.setDate(d.getDate() - wd);
  return isoDate(d);
}

export const monthKey = (iso) => String(iso || '').slice(0, 7);

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WEEKDAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Wochentag-Index mit Mo = 0. */
export function weekdayIndex(iso) {
  const d = parseDate(iso);
  return d ? (d.getDay() + 6) % 7 : 0;
}

export function fmtDate(iso, style = 'short') {
  const d = parseDate(iso);
  if (!d) return '–';
  if (style === 'long') return `${WEEKDAYS_LONG[weekdayIndex(iso)]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (style === 'medium') return `${WEEKDAYS[weekdayIndex(iso)]}, ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function fmtMonth(key) {
  const [y, m] = String(key || '').split('-').map(Number);
  if (!y || !m) return '–';
  return `${MONTHS[m - 1]} ${y}`;
}

/** "heute", "morgen", "in 3 Tagen", "vor 2 Wochen" … */
export function relDate(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  const diff = Math.round((d - parseDate(today())) / 86400000);
  if (diff === 0) return 'heute';
  if (diff === 1) return 'morgen';
  if (diff === -1) return 'gestern';
  if (diff > 1 && diff < 7) return `in ${diff} Tagen`;
  if (diff < -1 && diff > -7) return `vor ${-diff} Tagen`;
  if (diff >= 7 && diff < 28) return `in ${Math.round(diff / 7)} Wochen`;
  if (diff <= -7 && diff > -28) return `vor ${Math.round(-diff / 7)} Wochen`;
  return fmtDate(iso);
}

/** "14:30" + 90 min -> "16:00" */
export function addMinutes(time, mins) {
  const [h, m] = String(time || '00:00').split(':').map(Number);
  const total = (h * 60 + m + (mins || 0) + 1440 * 3) % 1440;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

export const timeToMin = (t) => {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function fmtDuration(mins) {
  const m = Math.round(mins || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  if (!r) return `${h} h`;
  return `${h} h ${r} min`;
}

/* ---------- Zahlen ---------- */
export function money(v, currency = 'EUR') {
  const n = Number(v) || 0;
  try {
    return n.toLocaleString('de-DE', { style: 'currency', currency, maximumFractionDigits: 2 });
  } catch {
    return n.toFixed(2) + ' ' + currency;
  }
}

export const num = (v, digits = 1) => (Number(v) || 0).toLocaleString('de-DE', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ---------- Sonstiges ---------- */
export function initials(first = '', last = '') {
  const a = String(first).trim()[0] || '';
  const b = String(last).trim()[0] || '';
  return (a + b).toUpperCase() || '?';
}

const AVATAR_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706', '#db2777',
  '#7c3aed', '#0284c7', '#16a34a', '#ea580c', '#be123c',
];

/** Stabile Farbe aus einer ID – gleiche ID ergibt immer dieselbe Farbe. */
export function colorFor(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function debounce(fn, ms = 300) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(t);
  wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
  return wrapped;
}

export const sortBy = (arr, key, dir = 1) =>
  [...arr].sort((a, b) => {
    const x = typeof key === 'function' ? key(a) : a[key];
    const y = typeof key === 'function' ? key(b) : b[key];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return x < y ? -dir : x > y ? dir : 0;
  });

export function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

export const sum = (arr, fn = (x) => x) => arr.reduce((a, b) => a + (Number(fn(b)) || 0), 0);

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Normalisiert für Suche: Kleinbuchstaben, Umlaute aufgelöst. */
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
