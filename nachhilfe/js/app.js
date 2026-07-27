/**
 * Anwendungsgerüst: Routing, Layout, Suche, Auto-Sync.
 *
 * Jede Ansicht liefert HTML als String und bekommt danach ihr Wurzelelement
 * zum Verdrahten der Ereignisse. Nach Datenänderungen wird die aktive Ansicht
 * neu aufgebaut – bei dieser Datenmenge schnell genug und deutlich einfacher
 * als feingranulare Aktualisierungen.
 */

import { store } from './store.js';
import { fileSync } from './filesync.js';
import { icon } from './icons.js';
import { html, esc, debounce } from './util.js';
import { applyTheme, watchSystemTheme } from './theme.js';
import { mountCharts, resetCharts } from './charts.js';
import { toast } from './ui.js';

import * as dashboard from './views/dashboard.js';
import * as students from './views/students.js';
import * as lessons from './views/lessons.js';
import * as grades from './views/grades.js';
import * as calendar from './views/calendar.js';
import * as finance from './views/finance.js';
import * as settings from './views/settings.js';

const ROUTES = {
  dashboard: { title: 'Übersicht', icon: 'home', view: dashboard, nav: true, mobile: true },
  students: { title: 'Schüler', icon: 'users', view: students, nav: true, mobile: true, search: 'Schüler suchen …' },
  calendar: { title: 'Kalender', icon: 'calendar', view: calendar, nav: true, mobile: true },
  lessons: { title: 'Stunden', icon: 'clock', view: lessons, nav: true, mobile: true, search: 'Stunden durchsuchen …' },
  grades: { title: 'Noten', icon: 'star', view: grades, nav: true, mobile: false, search: 'Noten durchsuchen …' },
  finance: { title: 'Finanzen', icon: 'wallet', view: finance, nav: true, mobile: false },
  settings: { title: 'Einstellungen', icon: 'settings', view: settings, nav: true, mobile: false },
};

/** Routen, die auf dem Handy hinter „Mehr“ liegen. */
const MOBILE_MORE = ['grades', 'finance', 'settings'];

const app = {
  route: 'dashboard',
  params: [],
  query: '',
};

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, ...params] = raw.split('/').filter(Boolean);
  return { name: ROUTES[name] ? name : 'dashboard', params };
}

function navigate() {
  const { name, params } = parseHash();
  const changedRoute = name !== app.route;
  app.route = name;
  app.params = params;
  if (changedRoute) app.query = '';
  renderShell();
  window.scrollTo({ top: 0 });
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

function navItems(mobile = false) {
  return Object.entries(ROUTES)
    .filter(([, r]) => (mobile ? r.mobile : r.nav))
    .map(([key, r]) => ({ key, ...r }));
}

function shellHtml() {
  const route = ROUTES[app.route];
  const s = fileSync.status();

  return html`
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">NH</div>
          <div>
            <div class="brand-name">Nachhilfe</div>
            <div class="brand-sub">${esc(store.settings.tutorName || 'Manager')}</div>
          </div>
        </div>

        <nav class="nav">
          ${navItems().map((r) => html`
            <a class="nav-item ${app.route === r.key ? 'is-active' : ''}" href="#/${r.key}">
              ${icon(r.icon, { size: 19 })}<span>${esc(r.title)}</span>
              ${navBadge(r.key)}
            </a>`)}
        </nav>

        <div class="sidebar-foot">
          <button class="btn btn-primary btn-block" data-quick-add>${icon('plus', { size: 16 })} Eintragen</button>
          <a class="sync-chip" href="#/settings">
            <span class="sync-dot ${syncDotClass(s.state)}"></span>
            <span class="truncate">${esc(syncText(s))}</span>
          </a>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <h1>${esc(titleFor(route))}</h1>
          <div class="spacer"></div>
          ${route.search ? html`
            <div class="search">
              ${icon('search', { size: 16 })}
              <input type="search" id="search-input" placeholder="${esc(route.search)}" value="${esc(app.query)}"
                     aria-label="${esc(route.search)}" autocomplete="off">
            </div>` : ''}
          <button class="btn btn-icon btn-ghost" data-quick-add title="Neu eintragen">${icon('plus', { size: 18 })}</button>
        </header>

        <main class="content" id="view-root"></main>
      </div>
    </div>

    <button class="fab" data-quick-add aria-label="Neu eintragen">${icon('plus')}</button>

    <nav class="mobile-nav">
      ${navItems(true).map((r) => html`
        <a class="mnav-item ${app.route === r.key ? 'is-active' : ''}" href="#/${r.key}">
          ${icon(r.icon, { size: 21 })}<span>${esc(r.title)}</span>
        </a>`)}
      <button class="mnav-item ${MOBILE_MORE.includes(app.route) ? 'is-active' : ''}" data-more>
        ${icon('menu', { size: 21 })}<span>Mehr</span>
      </button>
    </nav>`;
}

function titleFor(route) {
  const view = route.view;
  if (typeof view.title === 'function') {
    try {
      return view.title({ params: app.params });
    } catch { /* Titel ist nur Kosmetik */ }
  }
  return route.title;
}

function navBadge(key) {
  if (key === 'lessons') {
    const open = store.all('lessons').filter((l) => l.status === 'done' && !l.paid).length;
    return open ? `<span class="nav-badge">${open}</span>` : '';
  }
  if (key === 'students') {
    const n = store.all('students').filter((s) => s.status === 'active').length;
    return n ? `<span class="nav-badge">${n}</span>` : '';
  }
  return '';
}

const syncDotClass = (state) => ({
  on: 'on', busy: 'busy', error: 'err', 'needs-permission': 'warn',
}[state] || 'off');

function syncText(s) {
  switch (s.state) {
    case 'on': return s.lastSync
      ? 'Datei aktuell · ' + new Date(s.lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : 'Datei verknüpft';
    case 'busy': return 'Gleicht ab …';
    case 'error': return 'Datei-Fehler';
    case 'needs-permission': return 'Zugriff bestätigen';
    default: return 'Nur auf diesem Gerät';
  }
}

/* ------------------------------------------------------------------ */
/* Rendern                                                             */
/* ------------------------------------------------------------------ */

let searchDebounced = null;

function renderShell() {
  const root = document.getElementById('app');
  root.innerHTML = shellHtml();
  renderView();
  wireShell(root);
}

function renderView() {
  const route = ROUTES[app.route];
  const old = document.getElementById('view-root');
  if (!old) return;

  const ctx = {
    params: app.params,
    query: app.query,
    refresh: () => renderView(),
    go: (hash) => { location.hash = hash; },
  };

  route.view.onEnter?.(ctx);

  // Frisches Element statt innerHTML: `mount()` bindet bei jedem Aufbau neu,
  // und ein ausgetauschter Knoten nimmt die alten Listener mit.
  const host = document.createElement('main');
  host.className = 'content';
  host.id = 'view-root';

  resetCharts();
  try {
    host.innerHTML = route.view.render(ctx);
  } catch (err) {
    console.error('[view]', err);
    host.innerHTML = html`
      <div class="card card-pad">
        <h2>Diese Ansicht konnte nicht geladen werden</h2>
        <p class="small muted" style="margin-top:8px">${esc(err.message)}</p>
      </div>`;
    old.replaceWith(host);
    return;
  }

  old.replaceWith(host);
  route.view.mount?.(host, ctx);
  mountCharts(host);
}

function wireShell(root) {
  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-quick-add]')) {
      const { quickAdd } = await import('./actions.js');
      quickAdd(app.route === 'students' && app.params[0] ? { studentId: app.params[0] } : {});
      return;
    }
    if (e.target.closest('[data-more]')) openMoreSheet();
  });

  const input = root.querySelector('#search-input');
  if (input) {
    searchDebounced ||= debounce((value) => {
      app.query = value;
      renderView();
    }, 180);
    input.addEventListener('input', (e) => searchDebounced(e.target.value));
  }
}

/** Restliche Bereiche auf dem Handy – erreichbar über „Mehr“. */
async function openMoreSheet() {
  const { modal } = await import('./ui.js');
  modal({
    title: 'Weitere Bereiche',
    body: html`
      <div class="list card" style="overflow:hidden">
        ${MOBILE_MORE.map((key) => html`
          <button class="list-row" data-go="${key}">
            <span style="color:var(--accent-text)">${icon(ROUTES[key].icon, { size: 20 })}</span>
            <span class="list-main"><span class="list-title">${esc(ROUTES[key].title)}</span></span>
            ${icon('chevronRight', { size: 16 })}
          </button>`)}
      </div>`,
    onMount(root, close) {
      root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-go]');
        if (!btn) return;
        close();
        location.hash = '#/' + btn.dataset.go;
      });
    },
  });
}

/** Nach Datenänderungen: Ansicht und Statusanzeige aktualisieren. */
const refreshAll = debounce(() => {
  const active = document.activeElement;
  const isSearch = active?.id === 'search-input';
  const caret = isSearch ? active.selectionStart : null;

  renderShell();

  if (isSearch) {
    const next = document.getElementById('search-input');
    next?.focus();
    if (caret != null) next?.setSelectionRange(caret, caret);
  }
}, 60);

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function boot() {
  store.load();
  applyTheme(store.settings.theme);
  watchSystemTheme(() => store.settings.theme);

  window.addEventListener('hashchange', navigate);
  store.onChange(() => refreshAll());
  fileSync.addEventListener('status', () => refreshAll());

  navigate();
  fileSync.start();

  // Tastenkürzel: n = neu, / = suchen
  document.addEventListener('keydown', async (e) => {
    if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey) return;
    if (e.key === 'n') {
      e.preventDefault();
      const { quickAdd } = await import('./actions.js');
      quickAdd();
    }
    if (e.key === '/') {
      const input = document.getElementById('search-input');
      if (input) {
        e.preventDefault();
        input.focus();
      }
    }
  });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* Offline-Betrieb ist optional */ });
  }

  window.addEventListener('error', (e) => {
    console.error(e.error || e.message);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { toast };
