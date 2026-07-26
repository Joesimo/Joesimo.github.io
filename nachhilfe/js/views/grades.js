/** Alle Noten – nach Fach filterbar, mit Durchschnitten je Schüler. */

import { store, average, gradeClass, gradeTrend, formatGrade } from '../store.js';
import { avatar, emptyState, badge } from '../ui.js';
import { icon } from '../icons.js';
import { chart } from '../charts.js';
import { html, esc, sortBy, num, fmtDate, normalize, groupBy } from '../util.js';

const nameOf = (s) => (s ? `${s.firstName} ${s.lastName || ''}`.trim() : 'Unbekannt');

const state = { subject: 'alle', view: 'students' };

export function render(ctx) {
  const students = new Map(store.all('students').map((s) => [s.id, s]));
  const all = store.all('grades');
  const q = normalize(ctx.query || '');

  const subjects = [...new Set(all.map((g) => g.subject).filter(Boolean))].sort();

  let grades = state.subject === 'alle' ? all : all.filter((g) => g.subject === state.subject);
  if (q) {
    grades = grades.filter((g) => normalize([
      nameOf(students.get(g.studentId)), g.subject, g.type, g.note,
    ].join(' ')).includes(q));
  }
  grades = sortBy(grades, 'date', -1);

  if (!all.length) {
    return emptyState({
      icon: 'star',
      title: 'Noch keine Noten erfasst',
      text: 'Trag Klassenarbeiten, Tests und mündliche Noten ein – die Durchschnitte und Verläufe entstehen automatisch.',
      action: '<button class="btn btn-primary" data-act="add-grade">Erste Note eintragen</button>',
    });
  }

  const avgAll = average(grades);

  return html`
    <div class="stack">
      <div class="row row-wrap">
        <div class="chips">
          <button class="chip ${state.subject === 'alle' ? 'is-active' : ''}" data-subject="alle">Alle Fächer</button>
          ${subjects.map((f) => html`
            <button class="chip ${state.subject === f ? 'is-active' : ''}" data-subject="${esc(f)}">${esc(f)}</button>`)}
        </div>
        <div class="spacer"></div>
        <button class="btn btn-primary" data-act="add-grade">${icon('plus', { size: 16 })} Neue Note</button>
      </div>

      <div class="row row-wrap" style="gap:var(--sp-3)">
        <div class="chips">
          <button class="chip ${state.view === 'students' ? 'is-active' : ''}" data-view="students">Nach Schüler</button>
          <button class="chip ${state.view === 'list' ? 'is-active' : ''}" data-view="list">Chronologisch</button>
        </div>
        <div class="spacer"></div>
        ${avgAll != null ? html`
          <span class="small muted">Durchschnitt der Auswahl</span>
          <span class="grade-pill ${gradeClass(avgAll)}">${esc(num(avgAll, 2))}</span>` : ''}
      </div>

      ${grades.length
        ? (state.view === 'list' ? chronological(grades, students) : byStudent(grades, students))
        : emptyState({ icon: 'search', title: 'Keine Treffer', text: 'Für diese Auswahl gibt es keine Noten.' })}
    </div>`;
}

function byStudent(grades, students) {
  const groups = [...groupBy(grades, (g) => g.studentId).entries()];
  const sorted = sortBy(groups, ([, items]) => average(items) ?? 99);

  return html`
    <div class="grid grid-2" style="align-items:start">
      ${sorted.map(([studentId, items]) => {
        const s = students.get(studentId);
        const avg = average(items);
        const trend = gradeTrend(items);
        const chronological = sortBy(items, 'date');

        return html`
          <section class="card">
            <div class="card-head">
              ${s ? avatar(s, 'avatar-sm') : ''}
              <div style="min-width:0">
                <h2 class="truncate">${esc(nameOf(s))}</h2>
                <div class="small muted">${items.length} ${items.length === 1 ? 'Bewertung' : 'Bewertungen'} · ${esc(trendText(trend))}</div>
              </div>
              <div class="spacer"></div>
              <span class="grade-pill ${gradeClass(avg)}">${esc(num(avg, 2))}</span>
            </div>

            <div class="chart-wrap" style="padding-top:0">
              ${chart({
                type: 'gradeLine',
                height: 150,
                ariaLabel: `Notenverlauf ${nameOf(s)}`,
                points: chronological.map((g) => ({
                  note: average([g]),
                  label: formatGrade(g.value, g.system),
                  date: g.date,
                  sub: [g.subject, g.type].filter(Boolean).join(' · '),
                })),
              })}
            </div>

            <div class="list">
              ${sortBy(items, 'date', -1).slice(0, 4).map((g) => gradeRow(g, null))}
            </div>
            ${items.length > 4 ? html`
              <div class="card-pad" style="padding-top:var(--sp-2)">
                <a class="btn btn-sm btn-ghost btn-block" href="#/students/${esc(studentId)}">Alle ${items.length} Noten ansehen</a>
              </div>` : ''}
          </section>`;
      })}
    </div>`;
}

function chronological(grades, students) {
  const groups = groupBy(grades, (g) => String(g.date).slice(0, 7));
  return html`
    <div class="stack" style="gap:var(--sp-3)">
      ${[...groups.entries()].map(([month, items]) => html`
        <section class="card">
          <div class="card-head" style="padding-bottom:var(--sp-2)">
            <h2>${esc(monthLabel(month))}</h2>
            <div class="spacer"></div>
            <span class="grade-pill ${gradeClass(average(items))}">${esc(num(average(items), 2))}</span>
          </div>
          <div class="list">
            ${items.map((g) => gradeRow(g, students.get(g.studentId)))}
          </div>
        </section>`)}
    </div>`;
}

function gradeRow(g, student) {
  const note = average([g]);
  return html`
    <div class="list-row" data-grade="${esc(g.id)}">
      ${student ? avatar(student, 'avatar-sm') : ''}
      <div class="list-main">
        <div class="list-title">
          ${student ? esc(nameOf(student)) + ' · ' : ''}${esc(g.subject || 'Ohne Fach')}
          ${Number(g.weight) > 1 ? badge(`×${g.weight}`, '') : ''}
        </div>
        <div class="list-sub">${esc([g.type, fmtDate(g.date)].filter(Boolean).join(' · '))}${g.note ? ' · ' + esc(g.note) : ''}</div>
      </div>
      <span class="grade-pill ${gradeClass(note)}">${esc(formatGrade(g.value, g.system))}</span>
    </div>`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${months[(m || 1) - 1]} ${y}`;
}

const trendText = (t) => (t.dir === 'flat' ? 'Trend stabil'
  : t.dir === 'up' ? `Trend besser (${Math.abs(t.delta).toFixed(1).replace('.', ',')})`
  : `Trend schlechter (${Math.abs(t.delta).toFixed(1).replace('.', ',')})`);

export function mount(root, ctx) {
  root.addEventListener('click', async (e) => {
    const subject = e.target.closest('[data-subject]');
    if (subject) {
      state.subject = subject.dataset.subject;
      return ctx.refresh();
    }

    const view = e.target.closest('[data-view]');
    if (view) {
      state.view = view.dataset.view;
      return ctx.refresh();
    }

    const { editGrade } = await import('../actions.js');
    if (e.target.closest('[data-act="add-grade"]')) return void editGrade();

    const gradeEl = e.target.closest('[data-grade]');
    if (gradeEl) return void editGrade(gradeEl.dataset.grade);
  });
}
