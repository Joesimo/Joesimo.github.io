/** Wochenkalender mit Terminüberblick. */

import { store, lessonFee } from '../store.js';
import { emptyState } from '../ui.js';
import { icon } from '../icons.js';
import {
  html, esc, today, addDays, startOfWeek, fmtDate, WEEKDAYS, MONTHS,
  sortBy, sum, money, parseDate, addMinutes, fmtDuration,
} from '../util.js';

const nameOf = (s) => (s ? `${s.firstName} ${s.lastName || ''}`.trim() : 'Unbekannt');

const state = { week: startOfWeek(today()) };

export function render() {
  const settings = store.settings;
  const students = new Map(store.all('students').map((s) => [s.id, s]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(state.week, i));
  const end = days[6];

  const lessons = store.all('lessons').filter((l) => l.date >= state.week && l.date <= end);
  const minutes = sum(lessons.filter((l) => l.status !== 'cancelled'), (l) => Number(l.durationMin) || 60);
  const income = sum(lessons.filter((l) => l.status === 'done'), (l) => lessonFee(l, students.get(l.studentId), settings));

  const now = today();
  const isCurrent = state.week === startOfWeek(now);

  return html`
    <div class="stack">
      <div class="row row-wrap">
        <div class="row" style="gap:4px">
          <button class="btn btn-icon" data-nav="-1" aria-label="Vorherige Woche">${icon('chevronLeft', { size: 16 })}</button>
          <button class="btn btn-icon" data-nav="1" aria-label="Nächste Woche">${icon('chevronRight', { size: 16 })}</button>
          <button class="btn btn-sm ${isCurrent ? '' : 'btn-primary'}" data-nav="0">Heute</button>
        </div>
        <div>
          <div class="strong">${esc(weekLabel(state.week, end))}</div>
          <div class="small muted">
            ${lessons.length} ${lessons.length === 1 ? 'Termin' : 'Termine'} · ${esc(fmtDuration(minutes))}${income ? ' · ' + esc(money(income, settings.currency)) : ''}
          </div>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-primary" data-act="add-lesson">${icon('plus', { size: 16 })} Termin</button>
      </div>

      <div class="week">
        ${days.map((date) => {
          const items = sortBy(lessons.filter((l) => l.date === date), 'start');
          const d = parseDate(date);
          return html`
            <div class="day-col ${date === now ? 'is-today' : ''} ${items.length ? '' : 'is-empty'}" data-day="${esc(date)}">
              <div class="day-head">
                <span class="day-name">${esc(WEEKDAYS[(d.getDay() + 6) % 7])}</span>
                <span class="day-num">${d.getDate()}.</span>
                <span class="spacer"></span>
                <button class="btn btn-ghost btn-icon" data-add-day="${esc(date)}" aria-label="Termin am ${esc(fmtDate(date))} hinzufügen"
                        style="width:24px;height:24px;padding:0">${icon('plus', { size: 14 })}</button>
              </div>
              ${items.map((l) => {
                const st = students.get(l.studentId);
                const color = st?.color || 'var(--accent)';
                return html`
                  <div class="slot ${esc(l.status)}" data-lesson="${esc(l.id)}" style="border-left-color:${esc(color)}">
                    <div class="slot-time num">${esc(l.start || '–')}${l.start ? '–' + esc(addMinutes(l.start, Number(l.durationMin) || 60)) : ''}</div>
                    <div class="slot-name">${esc(nameOf(st))}</div>
                    ${l.subject || l.topic ? `<div class="slot-sub">${esc(l.topic || l.subject)}</div>` : ''}
                  </div>`;
              })}
            </div>`;
        })}
      </div>

      ${!lessons.length ? emptyState({
        icon: 'calendar',
        title: 'Diese Woche ist frei',
        text: 'Tippe auf einen Tag, um einen Termin einzutragen.',
      }) : ''}

      ${weekAgenda(days, lessons, students, settings)}
    </div>`;
}

/** Kompakte Liste unter dem Raster – nützlich auf dem Handy und zum Ausdrucken. */
function weekAgenda(days, lessons, students, settings) {
  if (!lessons.length) return '';
  return html`
    <section class="card">
      <div class="card-head"><h2>Wochenplan</h2></div>
      <div class="list">
        ${days.flatMap((date) => sortBy(lessons.filter((l) => l.date === date), 'start').map((l) => {
          const st = students.get(l.studentId);
          return html`
            <div class="list-row" data-lesson="${esc(l.id)}">
              <div class="list-right" style="min-width:74px;align-items:flex-start">
                <span class="small strong">${esc(fmtDate(date, 'medium').split(',')[0])}</span>
                <span class="small muted num">${esc(l.start || '')}</span>
              </div>
              <div class="list-main">
                <div class="list-title">${esc(nameOf(st))}</div>
                <div class="list-sub">${esc([l.subject, l.topic].filter(Boolean).join(' · ') || 'Ohne Thema')}</div>
              </div>
              <span class="small muted">${esc(money(lessonFee(l, st, settings), settings.currency))}</span>
            </div>`;
        }))}
      </div>
    </section>`;
}

function weekLabel(start, end) {
  const a = parseDate(start);
  const b = parseDate(end);
  const sameMonth = a.getMonth() === b.getMonth();
  return sameMonth
    ? `${a.getDate()}.–${b.getDate()}. ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
    : `${a.getDate()}. ${MONTHS[a.getMonth()].slice(0, 3)} – ${b.getDate()}. ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
}

export function mount(root, ctx) {
  root.addEventListener('click', async (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const dir = Number(nav.dataset.nav);
      state.week = dir === 0 ? startOfWeek(today()) : addDays(state.week, dir * 7);
      return ctx.refresh();
    }

    const actions = await import('../actions.js');

    const addDay = e.target.closest('[data-add-day]');
    if (addDay) {
      e.stopPropagation();
      return void actions.editLesson(null, { date: addDay.dataset.addDay });
    }

    if (e.target.closest('[data-act="add-lesson"]')) return void actions.editLesson();

    const lessonEl = e.target.closest('[data-lesson]');
    if (lessonEl) return void actions.editLesson(lessonEl.dataset.lesson);
  });

  // Wischen zwischen den Wochen
  let x0 = null;
  const grid = root.querySelector('.week');
  grid?.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  grid?.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 70) return;
    state.week = addDays(state.week, dx < 0 ? 7 : -7);
    ctx.refresh();
  });
}
