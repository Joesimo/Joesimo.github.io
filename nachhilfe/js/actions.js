/** Dialoge zum Anlegen und Bearbeiten – von allen Ansichten geteilt. */

import {
  store, SUBJECTS, SCHOOL_TYPES, GRADE_TYPES, LESSON_STATUS, STUDENT_STATUS,
  draftLesson, formatGrade,
} from './store.js';
import { formModal, confirmDialog, toast, modal } from './ui.js';
import { icon } from './icons.js';
import { html, esc, today, sortBy, fmtDate } from './util.js';

const statusOptions = (map) => Object.entries(map).map(([value, v]) => ({ value, label: v.label }));

const studentOptions = () =>
  sortBy(store.all('students'), (s) => `${s.status === 'active' ? '0' : '1'}${s.lastName}${s.firstName}`)
    .map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}`.trim() + (s.status !== 'active' ? ` (${STUDENT_STATUS[s.status]?.label || ''})` : '') }));

const studentName = (id) => {
  const s = store.get('students', id);
  return s ? `${s.firstName} ${s.lastName}`.trim() : 'Unbekannt';
};

/* ------------------------------------------------------------------ */
/* Schüler                                                             */
/* ------------------------------------------------------------------ */

const studentFields = () => [
  { name: 'firstName', label: 'Vorname', type: 'text', required: true },
  { name: 'lastName', label: 'Nachname', type: 'text' },
  { name: 'grade', label: 'Klasse / Stufe', type: 'text', placeholder: 'z. B. 9 oder Q1' },
  { name: 'schoolType', label: 'Schulform', type: 'select', options: SCHOOL_TYPES, placeholder: 'Bitte wählen' },
  { name: 'school', label: 'Schule', type: 'text', span: 2 },
  { name: 'subjects', label: 'Fächer', type: 'tags', options: SUBJECTS, span: 2 },
  { name: 'rate', label: 'Stundensatz (€/60 min)', type: 'money' },
  { name: 'status', label: 'Status', type: 'select', options: statusOptions(STUDENT_STATUS) },
  { name: 'parentName', label: 'Ansprechpartner (Eltern)', type: 'text' },
  { name: 'phone', label: 'Telefon', type: 'tel' },
  { name: 'email', label: 'E-Mail', type: 'email', span: 2 },
  { name: 'goal', label: 'Ziel', type: 'text', span: 2, placeholder: 'z. B. Versetzung sichern, Abi-Vorbereitung' },
  { name: 'notes', label: 'Notizen', type: 'textarea', span: 2, rows: 3 },
];

export async function editStudent(id = null) {
  const existing = id ? store.get('students', id) : null;
  const fields = studentFields();

  const values = existing || {
    status: 'active',
    rate: store.settings.defaultRate,
    subjects: [],
  };

  const data = await formModal({
    title: existing ? 'Schüler bearbeiten' : 'Neuer Schüler',
    fields,
    values,
    submitLabel: existing ? 'Speichern' : 'Anlegen',
    onDelete: existing ? () => removeStudent(existing.id) : null,
  });
  if (!data) return null;

  const rec = store.upsert('students', { ...(existing || {}), ...data, id: existing?.id });
  toast(existing ? 'Gespeichert' : `${rec.firstName} angelegt`);
  return rec;
}

export async function removeStudent(id) {
  const s = store.get('students', id);
  if (!s) return false;
  const ok = await confirmDialog({
    title: `${studentName(id)} löschen?`,
    message: 'Alle Stunden und Noten dieses Schülers werden ebenfalls entfernt. Das lässt sich nicht rückgängig machen.',
    confirmLabel: 'Endgültig löschen',
  });
  if (!ok) return false;
  store.remove('students', id);
  toast('Schüler gelöscht');
  location.hash = '#/students';
  return true;
}

/* ------------------------------------------------------------------ */
/* Stunden                                                             */
/* ------------------------------------------------------------------ */

const lessonFields = (student) => [
  { name: 'studentId', label: 'Schüler', type: 'select', options: studentOptions(), required: true, placeholder: 'Bitte wählen', span: 2 },
  { name: 'date', label: 'Datum', type: 'date', required: true },
  { name: 'start', label: 'Uhrzeit', type: 'time' },
  { name: 'durationMin', label: 'Dauer (min)', type: 'number', min: 15, step: 15 },
  {
    name: 'subject', label: 'Fach', type: 'select', placeholder: 'Bitte wählen',
    options: student?.subjects?.length ? [...new Set([...student.subjects, ...SUBJECTS])] : SUBJECTS,
  },
  { name: 'topic', label: 'Thema', type: 'text', span: 2, placeholder: 'z. B. Quadratische Gleichungen' },
  { name: 'homework', label: 'Hausaufgabe', type: 'textarea', span: 2, rows: 2 },
  { name: 'notes', label: 'Notizen zur Stunde', type: 'textarea', span: 2, rows: 3 },
  { name: 'status', label: 'Status', type: 'select', options: statusOptions(LESSON_STATUS) },
  { name: 'rate', label: 'Stundensatz (€/60 min)', type: 'money', hint: 'leer = Satz des Schülers' },
  { name: 'paid', label: 'Bezahlt', type: 'switch', span: 2 },
];

export async function editLesson(id = null, prefill = {}) {
  const existing = id ? store.get('lessons', id) : null;
  const studentId = existing?.studentId || prefill.studentId;
  const student = studentId ? store.get('students', studentId) : null;

  if (!existing && !store.all('students').length) {
    toast('Lege zuerst einen Schüler an', 'err');
    return null;
  }

  const values = existing || { ...draftLesson(store.settings, student), ...prefill };
  const fields = lessonFields(student);

  const data = await formModal({
    title: existing ? 'Stunde bearbeiten' : 'Neue Stunde',
    fields,
    values,
    submitLabel: existing ? 'Speichern' : 'Eintragen',
    onDelete: existing ? () => removeLesson(existing.id) : null,
    validate: (d) => (!d.studentId ? 'Bitte einen Schüler wählen' : null),
  });
  if (!data) return null;

  const rec = store.upsert('lessons', { ...(existing || {}), ...data, id: existing?.id });
  toast(existing ? 'Gespeichert' : 'Stunde eingetragen');
  return rec;
}

export async function removeLesson(id) {
  const ok = await confirmDialog({
    title: 'Stunde löschen?',
    message: 'Der Eintrag wird entfernt.',
  });
  if (!ok) return false;
  store.remove('lessons', id);
  toast('Stunde gelöscht');
  return true;
}

/** Hakt eine Stunde ab (geplant -> gehalten). */
export function markLessonDone(id) {
  const l = store.get('lessons', id);
  if (!l) return;
  store.upsert('lessons', { id, status: l.status === 'done' ? 'planned' : 'done' });
  toast(l.status === 'done' ? 'Wieder als geplant markiert' : 'Als gehalten markiert');
}

export function togglePaid(id) {
  const l = store.get('lessons', id);
  if (!l) return;
  store.upsert('lessons', { id, paid: !l.paid });
  toast(l.paid ? 'Als offen markiert' : 'Als bezahlt markiert');
}

/* ------------------------------------------------------------------ */
/* Noten                                                               */
/* ------------------------------------------------------------------ */

const gradeFields = (student, system) => [
  { name: 'studentId', label: 'Schüler', type: 'select', options: studentOptions(), required: true, placeholder: 'Bitte wählen', span: 2 },
  {
    name: 'subject', label: 'Fach', type: 'select', required: true, placeholder: 'Bitte wählen',
    options: student?.subjects?.length ? [...new Set([...student.subjects, ...SUBJECTS])] : SUBJECTS,
  },
  { name: 'type', label: 'Art', type: 'select', options: GRADE_TYPES },
  {
    name: 'system', label: 'Notensystem', type: 'select',
    options: [
      { value: 'note', label: 'Note 1–6' },
      { value: 'punkte', label: 'Punkte 0–15' },
      { value: 'percent', label: 'Prozent 0–100' },
    ],
    value: system,
  },
  {
    name: 'value', label: 'Bewertung', type: 'number', required: true, step: '0.1',
    hint: 'Note 1,0–6,0 · Punkte 0–15 · Prozent 0–100',
  },
  { name: 'date', label: 'Datum', type: 'date', required: true },
  { name: 'weight', label: 'Gewichtung', type: 'number', step: '0.5', min: 0.5, hint: '1 = normal, 2 = doppelt' },
  { name: 'note', label: 'Notiz', type: 'textarea', span: 2, rows: 2, placeholder: 'Was lief gut, was nicht?' },
];

export async function editGrade(id = null, prefill = {}) {
  const existing = id ? store.get('grades', id) : null;
  const studentId = existing?.studentId || prefill.studentId;
  const student = studentId ? store.get('students', studentId) : null;

  if (!existing && !store.all('students').length) {
    toast('Lege zuerst einen Schüler an', 'err');
    return null;
  }

  const system = existing?.system || store.settings.gradeSystem || 'note';
  const values = existing || {
    studentId: studentId || '',
    subject: prefill.subject || student?.subjects?.[0] || '',
    type: 'Klassenarbeit',
    system,
    date: today(),
    weight: 1,
    ...prefill,
  };

  const fields = gradeFields(student, system);

  const data = await formModal({
    title: existing ? 'Note bearbeiten' : 'Neue Note',
    fields,
    values,
    submitLabel: existing ? 'Speichern' : 'Eintragen',
    onDelete: existing ? () => removeGrade(existing.id) : null,
    validate: (d) => {
      const v = Number(d.value);
      if (!Number.isFinite(v)) return 'Bitte eine Bewertung eintragen';
      if (d.system === 'note' && (v < 1 || v > 6)) return 'Note muss zwischen 1,0 und 6,0 liegen';
      if (d.system === 'punkte' && (v < 0 || v > 15)) return 'Punkte müssen zwischen 0 und 15 liegen';
      if (d.system === 'percent' && (v < 0 || v > 100)) return 'Prozent müssen zwischen 0 und 100 liegen';
      return null;
    },
  });
  if (!data) return null;

  const rec = store.upsert('grades', { ...(existing || {}), ...data, id: existing?.id });
  toast(`${formatGrade(rec.value, rec.system)} für ${studentName(rec.studentId)} gespeichert`);
  return rec;
}

export async function removeGrade(id) {
  const ok = await confirmDialog({ title: 'Note löschen?', message: 'Der Eintrag wird entfernt.' });
  if (!ok) return false;
  store.remove('grades', id);
  toast('Note gelöscht');
  return true;
}

/* ------------------------------------------------------------------ */
/* Schnellaktion                                                       */
/* ------------------------------------------------------------------ */

export function quickAdd(context = {}) {
  const hasStudents = store.all('students').length > 0;
  const options = [
    { key: 'lesson', label: 'Stunde eintragen', icon: 'clock', disabled: !hasStudents },
    { key: 'grade', label: 'Note eintragen', icon: 'star', disabled: !hasStudents },
    { key: 'student', label: 'Schüler anlegen', icon: 'users' },
  ];

  modal({
    title: 'Was möchtest du eintragen?',
    body: html`
      <div class="list card" style="overflow:hidden">
        ${options.map((o) => html`
          <button class="list-row" data-pick="${o.key}" ${o.disabled ? 'disabled style="opacity:.45"' : ''}>
            <span style="color:var(--accent-text)">${icon(o.icon, { size: 20 })}</span>
            <span class="list-main"><span class="list-title">${esc(o.label)}</span></span>
            ${icon('chevronRight', { size: 16 })}
          </button>`)}
      </div>`,
    onMount(root, close) {
      root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pick]');
        if (!btn || btn.disabled) return;
        close();
        const kind = btn.dataset.pick;
        if (kind === 'lesson') editLesson(null, context);
        else if (kind === 'grade') editGrade(null, context);
        else editStudent();
      });
    },
  });
}

/** Nächster freier Termin-Vorschlag: gleiche Zeit wie die letzte Stunde, +7 Tage. */
export function repeatLesson(id) {
  const l = store.get('lessons', id);
  if (!l) return;
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = l;
  const next = { ...rest, date: nextWeek(l.date), status: 'planned', paid: false, notes: '', homework: '' };
  editLesson(null, next);
}

function nextWeek(iso) {
  const d = new Date(iso || today());
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export { studentName, fmtDate };
