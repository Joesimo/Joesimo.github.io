/** Übersicht: heutiger Tag, offene Punkte, Kennzahlen. */

import { store, average, gradeClass, gradeTrend, formatGrade, lessonFee, LESSON_STATUS } from '../store.js';
import { avatar, emptyState } from '../ui.js';
import { icon } from '../icons.js';
import { chart } from '../charts.js';
import {
  html, esc, today, addDays, fmtDate, fmtMonth, monthKey, money, num,
  sortBy, sum, relDate, addMinutes, fmtDuration, startOfWeek,
} from '../util.js';

const nameOf = (s) => `${s.firstName} ${s.lastName || ''}`.trim();

export function render() {
  const s = store.settings;
  const students = store.all('students');
  const active = students.filter((x) => x.status === 'active');
  const lessons = store.all('lessons');
  const grades = store.all('grades');
  const now = today();

  const byId = new Map(students.map((x) => [x.id, x]));

  const todays = sortBy(lessons.filter((l) => l.date === now && l.status !== 'cancelled'), 'start');
  const upcoming = sortBy(
    lessons.filter((l) => l.date > now && l.date <= addDays(now, 14) && l.status === 'planned'),
    (l) => l.date + (l.start || ''),
  ).slice(0, 6);

  const thisMonth = monthKey(now);
  const monthLessons = lessons.filter((l) => l.status === 'done' && monthKey(l.date) === thisMonth);
  const monthIncome = sum(monthLessons, (l) => lessonFee(l, byId.get(l.studentId), s));

  const openLessons = lessons.filter((l) => l.status === 'done' && !l.paid);
  const openAmount = sum(openLessons, (l) => lessonFee(l, byId.get(l.studentId), s));

  const weekStart = startOfWeek(now);
  const weekLessons = lessons.filter((l) => l.date >= weekStart && l.date < addDays(weekStart, 7) && l.status !== 'cancelled');
  const weekMinutes = sum(weekLessons, (l) => Number(l.durationMin) || 60);

  const avgAll = average(grades);

  const recentGrades = sortBy(grades, 'date', -1).slice(0, 5);

  /* Aufmerksamkeit: verschlechterter Trend oder lange keine Stunde */
  const attention = [];
  for (const st of active) {
    const g = grades.filter((x) => x.studentId === st.id);
    if (g.length >= 2) {
      const t = gradeTrend(g);
      if (t.dir === 'down') {
        attention.push({ student: st, kind: 'warn', text: `Noten verschlechtern sich (${t.delta > 0 ? '+' : ''}${num(t.delta, 1)})` });
      }
    }
    const last = sortBy(lessons.filter((x) => x.studentId === st.id && x.status === 'done'), 'date', -1)[0];
    if (last && last.date < addDays(now, -21)) {
      attention.push({ student: st, kind: 'info', text: `Letzte Stunde ${relDate(last.date)}` });
    } else if (!last) {
      attention.push({ student: st, kind: 'info', text: 'Noch keine Stunde gehalten' });
    }
  }

  const greeting = greetingText(s.tutorName);

  return html`
    <div class="stack">
      <div>
        <h2 style="font-size:22px;font-weight:670;letter-spacing:-.02em">${esc(greeting)}</h2>
        <p class="muted small">${esc(fmtDate(now, 'long'))}</p>
      </div>

      <div class="grid grid-4 keep-2">
        ${statTile('Aktive Schüler', String(active.length), students.length > active.length ? `${students.length} insgesamt` : 'alle aktiv')}
        ${statTile('Diese Woche', String(weekLessons.length) + (weekLessons.length === 1 ? ' Stunde' : ' Stunden'), fmtDuration(weekMinutes))}
        ${statTile('Einnahmen ' + fmtMonth(thisMonth).split(' ')[0], money(monthIncome, s.currency), `${monthLessons.length} gehaltene Stunden`)}
        ${statTile(
          'Offen',
          money(openAmount, s.currency),
          openLessons.length ? `${openLessons.length} unbezahlte Stunden` : 'alles bezahlt',
          openAmount > 0 ? 'warn' : 'ok',
        )}
      </div>

      <div class="grid grid-2" style="align-items:start">
        <section class="card">
          <div class="card-head">
            <h2>Heute</h2>
            <div class="spacer"></div>
            <button class="btn btn-sm" data-act="add-lesson">${icon('plus', { size: 15 })} Stunde</button>
          </div>
          ${todays.length ? html`
            <div class="list">
              ${todays.map((l) => lessonRow(l, byId.get(l.studentId), s))}
            </div>` : emptyState({
              icon: 'clock',
              title: 'Heute keine Stunden',
              text: 'Genieß den freien Tag – oder trag eine Stunde nach.',
            })}
        </section>

        <section class="card">
          <div class="card-head">
            <h2>Als Nächstes</h2>
            <div class="spacer"></div>
            <a class="btn btn-sm btn-ghost" href="#/calendar">Kalender ${icon('chevronRight', { size: 14 })}</a>
          </div>
          ${upcoming.length ? html`
            <div class="list">
              ${upcoming.map((l) => {
                const st = byId.get(l.studentId);
                return html`
                  <div class="list-row" data-lesson="${esc(l.id)}">
                    ${st ? avatar(st, 'avatar-sm') : ''}
                    <div class="list-main">
                      <div class="list-title">${esc(st ? nameOf(st) : 'Unbekannt')}</div>
                      <div class="list-sub">${esc([l.subject, l.topic].filter(Boolean).join(' · ') || 'Kein Thema')}</div>
                    </div>
                    <div class="list-right">
                      <span class="small strong">${esc(relDate(l.date))}</span>
                      <span class="small muted num">${esc(l.start || '')}</span>
                    </div>
                  </div>`;
              })}
            </div>` : emptyState({ icon: 'calendar', title: 'Nichts geplant', text: 'Trag deine nächsten Termine ein, dann siehst du sie hier.' })}
        </section>
      </div>

      <div class="grid grid-2" style="align-items:start">
        <section class="card">
          <div class="card-head">
            <h2>Zuletzt eingetragene Noten</h2>
            <div class="spacer"></div>
            <button class="btn btn-sm" data-act="add-grade">${icon('plus', { size: 15 })} Note</button>
          </div>
          ${recentGrades.length ? html`
            <div class="list">
              ${recentGrades.map((g) => {
                const st = byId.get(g.studentId);
                const note = average([g]);
                return html`
                  <div class="list-row" data-grade="${esc(g.id)}">
                    ${st ? avatar(st, 'avatar-sm') : ''}
                    <div class="list-main">
                      <div class="list-title">${esc(st ? nameOf(st) : 'Unbekannt')}</div>
                      <div class="list-sub">${esc([g.subject, g.type].filter(Boolean).join(' · '))} · ${esc(fmtDate(g.date))}</div>
                    </div>
                    <span class="grade-pill ${gradeClass(note)}">${esc(formatGrade(g.value, g.system))}</span>
                  </div>`;
              })}
            </div>` : emptyState({ icon: 'star', title: 'Noch keine Noten', text: 'Sobald du Noten einträgst, siehst du hier den Verlauf.' })}
          ${avgAll != null ? html`
            <div class="card-head" style="border-top:1px solid var(--border);padding-top:var(--sp-3)">
              <span class="small muted">Durchschnitt über alle Schüler</span>
              <div class="spacer"></div>
              <span class="grade-pill ${gradeClass(avgAll)}">${esc(num(avgAll, 2))}</span>
            </div>` : ''}
        </section>

        <section class="card">
          <div class="card-head"><h2>Im Blick behalten</h2></div>
          ${attention.length ? html`
            <div class="list">
              ${attention.slice(0, 6).map((a) => html`
                <a class="list-row" href="#/students/${esc(a.student.id)}">
                  ${avatar(a.student, 'avatar-sm')}
                  <div class="list-main">
                    <div class="list-title">${esc(nameOf(a.student))}</div>
                    <div class="list-sub">${esc(a.text)}</div>
                  </div>
                  <span style="color:var(--${a.kind === 'warn' ? 'warn' : 'muted'})">${icon(a.kind === 'warn' ? 'alert' : 'info', { size: 17 })}</span>
                </a>`)}
            </div>` : emptyState({ icon: 'check', title: 'Alles im grünen Bereich', text: 'Keine auffälligen Notenverläufe oder vergessenen Schüler.' })}
        </section>
      </div>

      ${monthChart(lessons, byId, s)}
    </div>`;
}

function statTile(label, value, sub, tone = '') {
  return html`
    <div class="card stat">
      <span class="stat-label">${esc(label)}</span>
      <span class="stat-value" ${tone === 'warn' ? 'style="color:var(--warn)"' : ''}>${esc(value)}</span>
      <span class="stat-sub">${esc(sub)}</span>
    </div>`;
}

function lessonRow(l, st, settings) {
  const status = LESSON_STATUS[l.status] || LESSON_STATUS.planned;
  const end = l.start ? addMinutes(l.start, Number(l.durationMin) || 60) : '';
  return html`
    <div class="list-row" data-lesson="${esc(l.id)}">
      ${st ? avatar(st, 'avatar-sm') : ''}
      <div class="list-main">
        <div class="list-title">${esc(st ? nameOf(st) : 'Unbekannt')}</div>
        <div class="list-sub">${esc([l.subject, l.topic].filter(Boolean).join(' · ') || status.label)}</div>
      </div>
      <div class="list-right">
        <span class="small strong num">${esc(l.start || '–')}${end ? '–' + esc(end) : ''}</span>
        <span class="small muted">${esc(money(lessonFee(l, st, settings), settings.currency))}</span>
      </div>
      <button class="btn btn-icon btn-ghost" data-done="${esc(l.id)}" title="${l.status === 'done' ? 'Als geplant markieren' : 'Als gehalten markieren'}"
        style="color:var(--${l.status === 'done' ? 'ok' : 'muted'})">${icon('check', { size: 17 })}</button>
    </div>`;
}

/** Einnahmen der letzten sechs Monate. */
function monthChart(lessons, byId, settings) {
  const keys = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }

  const bars = keys.map((k) => {
    const items = lessons.filter((l) => l.status === 'done' && monthKey(l.date) === k);
    const value = sum(items, (l) => lessonFee(l, byId.get(l.studentId), settings));
    return {
      label: fmtMonth(k).slice(0, 3),
      value,
      short: money(value, settings.currency).replace(/,\d+/, ''),
      tipTitle: fmtMonth(k),
      tipValue: `${money(value, settings.currency)} · ${items.length} Stunden`,
    };
  });

  if (!bars.some((b) => b.value > 0)) return '';

  return html`
    <section class="card">
      <div class="card-head">
        <h2>Einnahmen der letzten 6 Monate</h2>
        <div class="spacer"></div>
        <a class="btn btn-sm btn-ghost" href="#/finance">Details ${icon('chevronRight', { size: 14 })}</a>
      </div>
      <div class="chart-wrap">${chart({ type: 'bars', bars, height: 170 })}</div>
    </section>`;
}

function greetingText(name) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  return name ? `${part}, ${name}!` : `${part}!`;
}

export function mount(root, ctx) {
  root.addEventListener('click', async (e) => {
    const doneBtn = e.target.closest('[data-done]');
    if (doneBtn) {
      e.stopPropagation();
      const { markLessonDone } = await import('../actions.js');
      markLessonDone(doneBtn.dataset.done);
      return;
    }

    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'add-lesson') {
      const { editLesson } = await import('../actions.js');
      return void editLesson();
    }
    if (act === 'add-grade') {
      const { editGrade } = await import('../actions.js');
      return void editGrade();
    }

    const lessonEl = e.target.closest('[data-lesson]');
    if (lessonEl) {
      const { editLesson } = await import('../actions.js');
      return void editLesson(lessonEl.dataset.lesson);
    }

    const gradeEl = e.target.closest('[data-grade]');
    if (gradeEl) {
      const { editGrade } = await import('../actions.js');
      return void editGrade(gradeEl.dataset.grade);
    }
  });
  void ctx;
}
