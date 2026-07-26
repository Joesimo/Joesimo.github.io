/** Alle Stunden: filtern, abhaken, bezahlt markieren. */

import { store, lessonFee, LESSON_STATUS } from '../store.js';
import { avatar, emptyState, badge } from '../ui.js';
import { icon } from '../icons.js';
import {
  html, esc, sortBy, sum, money, fmtDate, today, normalize, addMinutes, fmtDuration, groupBy,
} from '../util.js';

const nameOf = (s) => (s ? `${s.firstName} ${s.lastName || ''}`.trim() : 'Unbekannt');

const state = { filter: 'upcoming' };

const FILTERS = [
  ['upcoming', 'Anstehend'],
  ['done', 'Gehalten'],
  ['unpaid', 'Unbezahlt'],
  ['all', 'Alle'],
];

function applyFilter(lessons) {
  const now = today();
  switch (state.filter) {
    case 'upcoming': return lessons.filter((l) => l.status === 'planned' && l.date >= now);
    case 'done': return lessons.filter((l) => l.status === 'done');
    case 'unpaid': return lessons.filter((l) => l.status === 'done' && !l.paid);
    default: return lessons;
  }
}

export function render(ctx) {
  const settings = store.settings;
  const students = new Map(store.all('students').map((s) => [s.id, s]));
  const q = normalize(ctx.query || '');

  let lessons = applyFilter(store.all('lessons'));
  if (q) {
    lessons = lessons.filter((l) => normalize([
      nameOf(students.get(l.studentId)), l.subject, l.topic, l.notes, l.homework,
    ].join(' ')).includes(q));
  }

  const ascending = state.filter === 'upcoming';
  lessons = sortBy(lessons, (l) => l.date + (l.start || ''), ascending ? 1 : -1);

  const totalFee = sum(lessons, (l) => lessonFee(l, students.get(l.studentId), settings));
  const totalMin = sum(lessons, (l) => Number(l.durationMin) || 60);
  const groups = groupBy(lessons, (l) => l.date);

  return html`
    <div class="stack">
      <div class="row row-wrap">
        <div class="chips">
          ${FILTERS.map(([key, label]) => html`
            <button class="chip ${state.filter === key ? 'is-active' : ''}" data-filter="${key}">${esc(label)}</button>`)}
        </div>
        <div class="spacer"></div>
        <button class="btn btn-primary" data-act="add-lesson">${icon('plus', { size: 16 })} Neue Stunde</button>
      </div>

      ${lessons.length ? html`
        <div class="row small muted" style="gap:var(--sp-4)">
          <span>${lessons.length} ${lessons.length === 1 ? 'Stunde' : 'Stunden'}</span>
          <span>${esc(fmtDuration(totalMin))}</span>
          <span>${esc(money(totalFee, settings.currency))}</span>
        </div>

        <div class="stack" style="gap:var(--sp-3)">
          ${[...groups.entries()].map(([date, items]) => html`
            <section class="card">
              <div class="card-head" style="padding-bottom:var(--sp-2)">
                <h2>${esc(fmtDate(date, 'medium'))}</h2>
                ${date === today() ? badge('Heute', 'badge-accent') : ''}
                <div class="spacer"></div>
                <span class="small muted">${items.length} ${items.length === 1 ? 'Stunde' : 'Stunden'}</span>
              </div>
              <div class="list">
                ${sortBy(items, 'start').map((l) => row(l, students.get(l.studentId), settings))}
              </div>
            </section>`)}
        </div>`
        : emptyState({
          icon: 'clock',
          title: q ? 'Keine Treffer' : 'Keine Stunden in dieser Ansicht',
          text: q ? 'Andere Suche versuchen.' : 'Trag deine nächste Stunde ein – Datum, Fach und Thema genügen.',
          action: q ? '' : '<button class="btn btn-primary" data-act="add-lesson">Stunde eintragen</button>',
        })}
    </div>`;
}

function row(l, student, settings) {
  const st = LESSON_STATUS[l.status] || LESSON_STATUS.planned;
  const end = l.start ? addMinutes(l.start, Number(l.durationMin) || 60) : '';

  return html`
    <div class="list-row" data-lesson="${esc(l.id)}">
      ${student ? avatar(student, 'avatar-sm') : ''}
      <div class="list-main">
        <div class="list-title">${esc(nameOf(student))}</div>
        <div class="list-sub">
          ${l.start ? `<span class="num">${esc(l.start)}–${esc(end)}</span> · ` : ''}${esc([l.subject, l.topic].filter(Boolean).join(' · ') || 'Ohne Thema')}
        </div>
      </div>
      <div class="list-right">
        <span class="hide-sm">${badge(st.label, st.badge)}</span>
        <span class="small muted">${esc(money(lessonFee(l, student, settings), settings.currency))}</span>
      </div>
      <div class="row" style="gap:2px;flex:none">
        <button class="btn btn-icon btn-ghost" data-done="${esc(l.id)}"
          title="${l.status === 'done' ? 'Doch nicht gehalten' : 'Als gehalten markieren'}"
          style="color:var(--${l.status === 'done' ? 'ok' : 'muted'})">${icon('check', { size: 17 })}</button>
        <button class="btn btn-icon btn-ghost" data-paid="${esc(l.id)}"
          title="${l.paid ? 'Als offen markieren' : 'Als bezahlt markieren'}"
          style="color:var(--${l.paid ? 'ok' : 'muted'})">${icon('euro', { size: 17 })}</button>
      </div>
    </div>`;
}

export function mount(root, ctx) {
  root.addEventListener('click', async (e) => {
    const filter = e.target.closest('[data-filter]');
    if (filter) {
      state.filter = filter.dataset.filter;
      return ctx.refresh();
    }

    const actions = await import('../actions.js');

    const doneBtn = e.target.closest('[data-done]');
    if (doneBtn) {
      e.stopPropagation();
      return actions.markLessonDone(doneBtn.dataset.done);
    }

    const paidBtn = e.target.closest('[data-paid]');
    if (paidBtn) {
      e.stopPropagation();
      return actions.togglePaid(paidBtn.dataset.paid);
    }

    if (e.target.closest('[data-act="add-lesson"]')) return void actions.editLesson();

    const lessonEl = e.target.closest('[data-lesson]');
    if (lessonEl) return void actions.editLesson(lessonEl.dataset.lesson);
  });
}
