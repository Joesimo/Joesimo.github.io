/** Schülerliste und Schülerakte. */

import {
  store, average, gradeClass, gradeTrend, formatGrade, lessonFee,
  STUDENT_STATUS, LESSON_STATUS,
} from '../store.js';
import { avatar, emptyState, badge } from '../ui.js';
import { icon } from '../icons.js';
import { chart } from '../charts.js';
import {
  html, esc, sortBy, sum, money, num, fmtDate, relDate, today,
  normalize, groupBy, addMinutes, fmtDuration,
} from '../util.js';

const nameOf = (s) => `${s.firstName} ${s.lastName || ''}`.trim();

/* Ansichts-Zustand (bewusst modul-lokal, nicht persistiert) */
const state = { filter: 'active', tab: 'overview' };

/* ------------------------------------------------------------------ */
/* Liste                                                               */
/* ------------------------------------------------------------------ */

function renderList(ctx) {
  const settings = store.settings;
  const q = normalize(ctx.query || '');
  const all = store.all('students');
  const lessons = store.all('lessons');
  const grades = store.all('grades');

  let list = all.filter((s) => state.filter === 'all' || s.status === state.filter);
  if (q) {
    list = list.filter((s) => normalize(
      [s.firstName, s.lastName, s.school, s.grade, (s.subjects || []).join(' '), s.parentName].join(' '),
    ).includes(q));
  }
  list = sortBy(list, (s) => normalize(s.lastName || s.firstName));

  const counts = {
    active: all.filter((s) => s.status === 'active').length,
    paused: all.filter((s) => s.status === 'paused').length,
    ended: all.filter((s) => s.status === 'ended').length,
    all: all.length,
  };

  return html`
    <div class="stack">
      <div class="row row-wrap">
        <div class="chips">
          ${[
            ['active', `Aktiv (${counts.active})`],
            ['paused', `Pausiert (${counts.paused})`],
            ['ended', `Beendet (${counts.ended})`],
            ['all', `Alle (${counts.all})`],
          ].map(([key, label]) => html`
            <button class="chip ${state.filter === key ? 'is-active' : ''}" data-filter="${key}">${esc(label)}</button>`)}
        </div>
        <div class="spacer"></div>
        <button class="btn btn-primary" data-act="add-student">${icon('plus', { size: 16 })} Neuer Schüler</button>
      </div>

      ${list.length ? html`
        <div class="card">
          <div class="list">
            ${list.map((s) => {
              const sg = grades.filter((g) => g.studentId === s.id);
              const avg = average(sg);
              const trend = gradeTrend(sg);
              const sl = lessons.filter((l) => l.studentId === s.id);
              const next = sortBy(sl.filter((l) => l.status === 'planned' && l.date >= today()), 'date')[0];
              const open = sum(sl.filter((l) => l.status === 'done' && !l.paid), (l) => lessonFee(l, s, settings));

              return html`
                <a class="list-row" href="#/students/${esc(s.id)}">
                  ${avatar(s)}
                  <div class="list-main">
                    <div class="list-title">
                      ${esc(nameOf(s))}
                      ${s.status !== 'active' ? badge(STUDENT_STATUS[s.status]?.label || '', STUDENT_STATUS[s.status]?.badge) : ''}
                    </div>
                    <div class="list-sub">
                      ${esc([s.grade ? `Klasse ${s.grade}` : '', s.schoolType, (s.subjects || []).join(', ')].filter(Boolean).join(' · ') || 'Keine Angaben')}
                    </div>
                  </div>
                  <div class="list-right">
                    ${avg != null ? html`
                      <span class="grade-pill ${gradeClass(avg)}">${esc(num(avg, 1))}</span>
                      <span class="stat-trend trend-${trend.dir}">${trendIcon(trend.dir)} ${esc(trendLabel(trend))}</span>`
                      : '<span class="small muted">keine Noten</span>'}
                  </div>
                  <div class="list-right hide-sm" style="min-width:96px">
                    ${next ? `<span class="small">${esc(relDate(next.date))}</span>` : '<span class="small muted">kein Termin</span>'}
                    ${open > 0 ? `<span class="small" style="color:var(--warn)">${esc(money(open, settings.currency))} offen</span>` : ''}
                  </div>
                  <span class="muted">${icon('chevronRight', { size: 16 })}</span>
                </a>`;
            })}
          </div>
        </div>`
        : emptyState({
          icon: 'users',
          title: q ? 'Keine Treffer' : 'Noch keine Schüler',
          text: q ? 'Andere Suche versuchen oder Filter zurücksetzen.' : 'Leg deinen ersten Schüler an – Fächer, Klasse und Stundensatz kannst du später jederzeit ändern.',
          action: q ? '' : '<button class="btn btn-primary" data-act="add-student">Schüler anlegen</button>',
        })}
    </div>`;
}

const trendIcon = (dir) => icon(dir === 'up' ? 'arrowUp' : dir === 'down' ? 'arrowDown' : 'minus', { size: 12 });
const trendLabel = (t) => (t.dir === 'flat' ? 'stabil' : `${Math.abs(t.delta).toFixed(1).replace('.', ',')}`);

/* ------------------------------------------------------------------ */
/* Akte                                                                */
/* ------------------------------------------------------------------ */

function renderDetail(id) {
  const s = store.get('students', id);
  if (!s) {
    return emptyState({
      icon: 'alert', title: 'Schüler nicht gefunden',
      action: '<a class="btn" href="#/students">Zur Übersicht</a>',
    });
  }

  const settings = store.settings;
  const lessons = sortBy(store.all('lessons').filter((l) => l.studentId === id), 'date', -1);
  const grades = sortBy(store.all('grades').filter((g) => g.studentId === id), 'date', -1);

  const done = lessons.filter((l) => l.status === 'done');
  const open = done.filter((l) => !l.paid);
  const avg = average(grades);
  const trend = gradeTrend(grades);
  const nextLesson = sortBy(lessons.filter((l) => l.status === 'planned' && l.date >= today()), 'date')[0];

  const status = STUDENT_STATUS[s.status] || STUDENT_STATUS.active;

  return html`
    <div class="stack">
      <a class="btn btn-ghost btn-sm" href="#/students" style="align-self:flex-start">${icon('chevronLeft', { size: 15 })} Alle Schüler</a>

      <section class="card">
        <div class="detail-head">
          ${avatar(s, 'avatar-lg')}
          <div style="min-width:0;flex:1">
            <h2>${esc(nameOf(s))}</h2>
            <p class="detail-meta">
              ${esc([s.grade ? `Klasse ${s.grade}` : '', s.schoolType, s.school].filter(Boolean).join(' · ') || 'Keine Schulangaben')}
            </p>
            <div class="chips" style="margin-top:8px">
              ${badge(status.label, status.badge)}
              ${(s.subjects || []).map((f) => badge(f, 'badge-accent'))}
            </div>
          </div>
          <div class="row detail-actions">
            <button class="btn btn-icon" data-act="edit-student" title="Bearbeiten">${icon('edit', { size: 16 })}</button>
            <button class="btn btn-primary btn-sm" data-act="add-lesson">${icon('plus', { size: 15 })} Stunde</button>
            <button class="btn btn-sm" data-act="add-grade">${icon('star', { size: 15 })} Note</button>
          </div>
        </div>

        <div class="grid grid-4 keep-2" style="padding:0 var(--sp-4) var(--sp-4);gap:var(--sp-3)">
          ${miniStat('Ø Note', avg != null ? num(avg, 2) : '–', avg != null ? trendText(trend) : 'noch keine Noten')}
          ${miniStat('Stunden', String(done.length), fmtDuration(sum(done, (l) => Number(l.durationMin) || 60)))}
          ${miniStat('Umsatz', money(sum(done, (l) => lessonFee(l, s, settings)), settings.currency), `${money(Number(s.rate ?? settings.defaultRate), settings.currency)} / 60 min`)}
          ${miniStat('Offen', money(sum(open, (l) => lessonFee(l, s, settings)), settings.currency), open.length ? `${open.length} Stunden` : 'alles bezahlt')}
        </div>
      </section>

      <div class="tabs" role="tablist">
        ${[['overview', 'Übersicht'], ['lessons', `Stunden (${lessons.length})`], ['grades', `Noten (${grades.length})`]].map(([key, label]) => html`
          <button class="tab ${state.tab === key ? 'is-active' : ''}" data-tab="${key}" role="tab">${esc(label)}</button>`)}
      </div>

      ${state.tab === 'lessons' ? lessonsTab(lessons, s, settings)
        : state.tab === 'grades' ? gradesTab(grades)
        : overviewTab(s, settings, grades, nextLesson, lessons)}
    </div>`;
}

function trendText(t) {
  if (t.dir === 'flat') return 'stabil';
  return t.dir === 'up' ? `verbessert um ${Math.abs(t.delta).toFixed(1).replace('.', ',')}` : `verschlechtert um ${Math.abs(t.delta).toFixed(1).replace('.', ',')}`;
}

function miniStat(label, value, sub) {
  return html`
    <div style="background:var(--surface-2);border-radius:var(--r-md);padding:var(--sp-3)">
      <div class="stat-label">${esc(label)}</div>
      <div class="stat-value" style="font-size:20px">${esc(value)}</div>
      <div class="stat-sub">${esc(sub)}</div>
    </div>`;
}

function overviewTab(s, settings, grades, nextLesson, lessons) {
  const bySubject = groupBy(grades, (g) => g.subject || 'Ohne Fach');
  const lastLessons = lessons.filter((l) => l.status === 'done').slice(0, 3);

  return html`
    <div class="grid grid-2" style="align-items:start">
      <section class="card">
        <div class="card-head"><h2>Kontakt & Stammdaten</h2></div>
        <div class="card-pad" style="padding-top:0">
          <dl class="kv">
            <dt>Ansprechpartner</dt><dd>${esc(s.parentName || '–')}</dd>
            <dt>Telefon</dt><dd>${s.phone ? `<a href="tel:${esc(s.phone)}">${esc(s.phone)}</a>` : '–'}</dd>
            <dt>E-Mail</dt><dd>${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '–'}</dd>
            <dt>Stundensatz</dt><dd>${esc(money(Number(s.rate ?? settings.defaultRate), settings.currency))} / 60 min</dd>
            <dt>Ziel</dt><dd>${esc(s.goal || '–')}</dd>
            <dt>Nächster Termin</dt><dd>${nextLesson ? `${esc(fmtDate(nextLesson.date, 'medium'))}${nextLesson.start ? ', ' + esc(nextLesson.start) : ''} <span class="muted">(${esc(relDate(nextLesson.date))})</span>` : '–'}</dd>
          </dl>
          ${s.notes ? html`
            <hr class="divider" style="margin:var(--sp-4) 0">
            <div class="section-title">Notizen</div>
            <p class="small" style="white-space:pre-wrap">${esc(s.notes)}</p>` : ''}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Notenverlauf</h2></div>
        ${grades.length ? html`
          <div class="chart-wrap">
            ${chart({
              type: 'gradeLine',
              height: 170,
              ariaLabel: 'Notenverlauf',
              points: sortBy(grades, 'date').map((g) => ({
                note: average([g]),
                label: formatGrade(g.value, g.system),
                date: g.date,
                sub: [g.subject, g.type].filter(Boolean).join(' · '),
              })),
            })}
          </div>
          <div class="card-pad" style="padding-top:0">
            <div class="section-title">Durchschnitt je Fach</div>
            <div class="list" style="margin:0 calc(-1 * var(--sp-4))">
              ${[...bySubject.entries()].map(([subject, items]) => {
                const a = average(items);
                return html`
                  <div class="list-row no-hover">
                    <div class="list-main">
                      <div class="list-title">${esc(subject)}</div>
                      <div class="list-sub">${items.length} ${items.length === 1 ? 'Bewertung' : 'Bewertungen'}</div>
                    </div>
                    <span class="grade-pill ${gradeClass(a)}">${esc(num(a, 2))}</span>
                  </div>`;
              })}
            </div>
          </div>` : emptyState({ icon: 'star', title: 'Noch keine Noten', text: 'Trag die erste Bewertung ein, dann entsteht hier ein Verlauf.' })}
      </section>
    </div>

    ${lastLessons.length ? html`
      <section class="card" style="margin-top:var(--sp-4)">
        <div class="card-head"><h2>Zuletzt behandelt</h2></div>
        <div class="list">
          ${lastLessons.map((l) => html`
            <div class="list-row" data-lesson="${esc(l.id)}">
              <div class="list-main">
                <div class="list-title">${esc(l.topic || l.subject || 'Ohne Thema')}</div>
                <div class="list-sub">${esc(fmtDate(l.date, 'medium'))}${l.homework ? ' · HA: ' + esc(l.homework) : ''}</div>
              </div>
              <span class="muted">${icon('chevronRight', { size: 16 })}</span>
            </div>`)}
        </div>
      </section>` : ''}`;
}

function lessonsTab(lessons, student, settings) {
  if (!lessons.length) {
    return emptyState({
      icon: 'clock', title: 'Noch keine Stunden',
      text: 'Sobald du Stunden einträgst, entsteht hier die komplette Historie.',
      action: '<button class="btn btn-primary" data-act="add-lesson">Stunde eintragen</button>',
    });
  }

  return html`
    <section class="card">
      <div class="list">
        ${lessons.map((l) => {
          const st = LESSON_STATUS[l.status] || LESSON_STATUS.planned;
          return html`
            <div class="list-row" data-lesson="${esc(l.id)}">
              <div class="list-main">
                <div class="list-title">${esc(l.topic || l.subject || 'Ohne Thema')}</div>
                <div class="list-sub">
                  ${esc(fmtDate(l.date, 'medium'))}${l.start ? ' · ' + esc(l.start) + '–' + esc(addMinutes(l.start, Number(l.durationMin) || 60)) : ''}
                  ${l.subject && l.topic ? ' · ' + esc(l.subject) : ''}
                </div>
              </div>
              <div class="list-right">
                ${badge(st.label, st.badge)}
                <span class="small ${l.paid ? 'muted' : ''}" ${!l.paid && l.status === 'done' ? 'style="color:var(--warn)"' : ''}>
                  ${esc(money(lessonFee(l, student, settings), settings.currency))}${l.status === 'done' ? (l.paid ? ' · bezahlt' : ' · offen') : ''}
                </span>
              </div>
            </div>`;
        })}
      </div>
    </section>`;
}

function gradesTab(grades) {
  if (!grades.length) {
    return emptyState({
      icon: 'star', title: 'Noch keine Noten',
      action: '<button class="btn btn-primary" data-act="add-grade">Note eintragen</button>',
    });
  }

  return html`
    <section class="card">
      <div class="list">
        ${grades.map((g) => {
          const note = average([g]);
          return html`
            <div class="list-row" data-grade="${esc(g.id)}">
              <div class="list-main">
                <div class="list-title">${esc(g.subject || 'Ohne Fach')} <span class="muted small">${esc(g.type || '')}</span></div>
                <div class="list-sub">${esc(fmtDate(g.date, 'medium'))}${Number(g.weight) > 1 ? ` · Gewichtung ${esc(String(g.weight))}` : ''}${g.note ? ' · ' + esc(g.note) : ''}</div>
              </div>
              <span class="grade-pill ${gradeClass(note)}">${esc(formatGrade(g.value, g.system))}</span>
            </div>`;
        })}
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ */

export function render(ctx) {
  return ctx.params[0] ? renderDetail(ctx.params[0]) : renderList(ctx);
}

export function title(ctx) {
  const s = ctx.params[0] ? store.get('students', ctx.params[0]) : null;
  return s ? nameOf(s) : 'Schüler';
}

export function mount(root, ctx) {
  const id = ctx.params[0];

  root.addEventListener('click', async (e) => {
    const filter = e.target.closest('[data-filter]');
    if (filter) {
      state.filter = filter.dataset.filter;
      return ctx.refresh();
    }

    const tab = e.target.closest('[data-tab]');
    if (tab) {
      state.tab = tab.dataset.tab;
      return ctx.refresh();
    }

    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act) {
      const actions = await import('../actions.js');
      if (act === 'add-student') return void actions.editStudent();
      if (act === 'edit-student') return void actions.editStudent(id);
      if (act === 'add-lesson') return void actions.editLesson(null, { studentId: id });
      if (act === 'add-grade') return void actions.editGrade(null, { studentId: id });
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
}

/** Beim Wechsel in die Liste wieder auf den ersten Reiter stellen. */
export function onEnter(ctx) {
  if (!ctx.params[0]) state.tab = 'overview';
}
