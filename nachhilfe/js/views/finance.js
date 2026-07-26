/** Finanzen: Monatsumsatz, offene Beträge, Auswertung je Schüler. */

import { store, lessonFee } from '../store.js';
import { avatar, emptyState, toast } from '../ui.js';
import { icon } from '../icons.js';
import { chart } from '../charts.js';
import {
  html, esc, sortBy, sum, money, num, fmtDate, fmtMonth, monthKey, today,
  groupBy, download, fmtDuration,
} from '../util.js';

const nameOf = (s) => (s ? `${s.firstName} ${s.lastName || ''}`.trim() : 'Unbekannt');

const state = { month: monthKey(today()) };

const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function render() {
  const settings = store.settings;
  const students = new Map(store.all('students').map((s) => [s.id, s]));
  const lessons = store.all('lessons');
  const fee = (l) => lessonFee(l, students.get(l.studentId), settings);

  const monthLessons = lessons.filter((l) => l.status === 'done' && monthKey(l.date) === state.month);
  const monthIncome = sum(monthLessons, fee);
  const monthMinutes = sum(monthLessons, (l) => Number(l.durationMin) || 60);
  const paidIncome = sum(monthLessons.filter((l) => l.paid), fee);

  const openAll = lessons.filter((l) => l.status === 'done' && !l.paid);
  const openAmount = sum(openAll, fee);

  const planned = lessons.filter((l) => l.status === 'planned' && monthKey(l.date) === state.month);
  const plannedIncome = sum(planned, fee);

  const perStudent = sortBy(
    [...groupBy(monthLessons, (l) => l.studentId).entries()]
      .map(([id, items]) => ({
        student: students.get(id),
        items,
        total: sum(items, fee),
        minutes: sum(items, (l) => Number(l.durationMin) || 60),
        open: sum(items.filter((l) => !l.paid), fee),
      })),
    'total', -1,
  );

  const hourly = monthMinutes ? (monthIncome / monthMinutes) * 60 : 0;

  return html`
    <div class="stack">
      <div class="row row-wrap">
        <div class="row" style="gap:4px">
          <button class="btn btn-icon" data-month="-1" aria-label="Vorheriger Monat">${icon('chevronLeft', { size: 16 })}</button>
          <button class="btn btn-icon" data-month="1" aria-label="Nächster Monat">${icon('chevronRight', { size: 16 })}</button>
        </div>
        <div class="strong">${esc(fmtMonth(state.month))}</div>
        <div class="spacer"></div>
        <button class="btn btn-sm" data-act="export-csv">${icon('download', { size: 15 })} CSV</button>
      </div>

      <div class="grid grid-4 keep-2">
        ${tile('Umsatz', money(monthIncome, settings.currency), `${monthLessons.length} gehaltene Stunden`)}
        ${tile('Davon bezahlt', money(paidIncome, settings.currency), monthIncome ? `${Math.round((paidIncome / monthIncome) * 100)} % eingegangen` : '–')}
        ${tile('Noch geplant', money(plannedIncome, settings.currency), `${planned.length} offene Termine`)}
        ${tile('Ø Stundensatz', money(hourly, settings.currency), fmtDuration(monthMinutes) + ' unterrichtet')}
      </div>

      <section class="card">
        <div class="card-head">
          <h2>Umsatz der letzten 12 Monate</h2>
          <div class="spacer"></div>
          <span class="small muted">nur gehaltene Stunden</span>
        </div>
        <div class="chart-wrap">${chart({ type: 'bars', height: 190, bars: yearBars(lessons, fee, settings) })}</div>
      </section>

      <div class="grid grid-2" style="align-items:start">
        <section class="card">
          <div class="card-head">
            <h2>Offene Beträge</h2>
            <div class="spacer"></div>
            ${openAmount > 0 ? `<span class="badge badge-warn">${esc(money(openAmount, settings.currency))}</span>` : ''}
          </div>
          ${openAll.length ? html`
            <div class="list">
              ${sortBy([...groupBy(openAll, (l) => l.studentId).entries()], ([, items]) => -sum(items, fee))
                .map(([id, items]) => {
                  const s = students.get(id);
                  const oldest = sortBy(items, 'date')[0];
                  return html`
                    <div class="list-row" data-student="${esc(id)}">
                      ${s ? avatar(s, 'avatar-sm') : ''}
                      <div class="list-main">
                        <div class="list-title">${esc(nameOf(s))}</div>
                        <div class="list-sub">${items.length} ${items.length === 1 ? 'Stunde' : 'Stunden'} · älteste vom ${esc(fmtDate(oldest.date))}</div>
                      </div>
                      <div class="list-right">
                        <span class="strong" style="color:var(--warn)">${esc(money(sum(items, fee), settings.currency))}</span>
                        <button class="btn btn-sm" data-pay-all="${esc(id)}">alles bezahlt</button>
                      </div>
                    </div>`;
                })}
            </div>` : emptyState({ icon: 'check', title: 'Nichts offen', text: 'Alle gehaltenen Stunden sind bezahlt.' })}
        </section>

        <section class="card">
          <div class="card-head"><h2>Nach Schüler · ${esc(fmtMonth(state.month))}</h2></div>
          ${perStudent.length ? html`
            <div class="list">
              ${perStudent.map((r) => html`
                <div class="list-row" data-student="${esc(r.student?.id || '')}">
                  ${r.student ? avatar(r.student, 'avatar-sm') : ''}
                  <div class="list-main">
                    <div class="list-title">${esc(nameOf(r.student))}</div>
                    <div class="list-sub">${r.items.length} ${r.items.length === 1 ? 'Stunde' : 'Stunden'} · ${esc(fmtDuration(r.minutes))}${r.open ? ` · ${esc(money(r.open, settings.currency))} offen` : ''}</div>
                  </div>
                  <span class="strong num">${esc(money(r.total, settings.currency))}</span>
                </div>`)}
            </div>` : emptyState({ icon: 'euro', title: 'Kein Umsatz in diesem Monat', text: 'Markiere gehaltene Stunden als „gehalten“, dann erscheinen sie hier.' })}
        </section>
      </div>
    </div>`;
}

function tile(label, value, sub) {
  return html`
    <div class="card stat">
      <span class="stat-label">${esc(label)}</span>
      <span class="stat-value">${esc(value)}</span>
      <span class="stat-sub">${esc(sub)}</span>
    </div>`;
}

function yearBars(lessons, fee, settings) {
  const keys = [];
  const base = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys.map((k) => {
    const items = lessons.filter((l) => l.status === 'done' && monthKey(l.date) === k);
    const value = sum(items, fee);
    return {
      label: fmtMonth(k).slice(0, 3),
      value,
      muted: k !== state.month,
      short: money(value, settings.currency).replace(/,\d+/, ''),
      tipTitle: fmtMonth(k),
      tipValue: `${money(value, settings.currency)} · ${items.length} Stunden`,
    };
  });
}

function exportCsv() {
  const settings = store.settings;
  const students = new Map(store.all('students').map((s) => [s.id, s]));
  const rows = [['Datum', 'Schüler', 'Fach', 'Thema', 'Dauer (min)', 'Status', 'Betrag', 'Bezahlt']];

  for (const l of sortBy(store.all('lessons'), 'date')) {
    rows.push([
      l.date,
      nameOf(students.get(l.studentId)),
      l.subject || '',
      l.topic || '',
      String(l.durationMin || 60),
      l.status || '',
      num(lessonFee(l, students.get(l.studentId), settings), 2),
      l.paid ? 'ja' : 'nein',
    ]);
  }

  const csv = '﻿' + rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  download(`nachhilfe-stunden-${today()}.csv`, csv, 'text/csv;charset=utf-8');
  toast('CSV exportiert');
}

export function mount(root, ctx) {
  root.addEventListener('click', (e) => {
    const monthBtn = e.target.closest('[data-month]');
    if (monthBtn) {
      state.month = shiftMonth(state.month, Number(monthBtn.dataset.month));
      return ctx.refresh();
    }

    if (e.target.closest('[data-act="export-csv"]')) return exportCsv();

    const payAll = e.target.closest('[data-pay-all]');
    if (payAll) {
      e.stopPropagation();
      const id = payAll.dataset.payAll;
      let count = 0;
      for (const l of store.all('lessons')) {
        if (l.studentId === id && l.status === 'done' && !l.paid) {
          store.upsert('lessons', { id: l.id, paid: true });
          count++;
        }
      }
      toast(`${count} ${count === 1 ? 'Stunde' : 'Stunden'} als bezahlt markiert`);
      return;
    }

    const studentEl = e.target.closest('[data-student]');
    if (studentEl?.dataset.student) location.hash = `#/students/${studentEl.dataset.student}`;
  });
}
