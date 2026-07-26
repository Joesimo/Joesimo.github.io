/** Einstellungen: Profil, Darstellung, Cloud-Sync, Datenverwaltung. */

import { store, DEFAULT_SETTINGS } from '../store.js';
import { sync } from '../sync.js';
import { suggestPassphrase, cryptoAvailable } from '../crypto.js';
import { formModal, confirmDialog, modal, toast } from '../ui.js';
import { icon } from '../icons.js';
import { html, esc, download, today, money } from '../util.js';
import { applyTheme } from '../theme.js';

const fmtTime = (ts) => (ts ? new Date(ts).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : 'noch nie');

export function render() {
  const s = store.settings;
  const status = sync.status();
  const counts = {
    students: store.all('students').length,
    lessons: store.all('lessons').length,
    grades: store.all('grades').length,
  };

  return html`
    <div class="stack" style="max-width:760px">
      <section class="card">
        <div class="card-head"><h2>Profil & Vorgaben</h2></div>
        <div class="list">
          ${settingRow('Dein Name', s.tutorName || 'nicht gesetzt', 'wird in der Begrüßung verwendet', 'profile')}
          ${settingRow('Standard-Stundensatz', money(s.defaultRate, s.currency) + ' / 60 min', 'Vorbelegung für neue Schüler', 'profile')}
          ${settingRow('Standard-Dauer', `${s.defaultDuration} min`, 'Vorbelegung für neue Stunden', 'profile')}
          ${settingRow('Notensystem', s.gradeSystem === 'punkte' ? 'Punkte 0–15' : 'Note 1–6', 'Vorauswahl beim Eintragen', 'profile')}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Darstellung</h2></div>
        <div class="card-pad" style="padding-top:0">
          <div class="chips">
            ${[['system', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([key, label]) => html`
              <button class="chip ${s.theme === key ? 'is-active' : ''}" data-theme="${key}">${esc(label)}</button>`)}
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Synchronisation</h2>
          <div class="spacer"></div>
          <span class="badge ${statusBadge(status.state)}">${esc(statusLabel(status.state))}</span>
        </div>

        ${!cryptoAvailable() ? html`
          <div class="card-pad" style="padding-top:0">
            <div class="callout callout-warn">
              Verschlüsselung steht nicht zur Verfügung. Die Seite muss über <strong>https://</strong> geladen werden –
              über <code>file://</code> funktioniert die Synchronisation nicht.
            </div>
          </div>` : ''}

        <div class="card-pad" style="padding-top:0">
          ${syncBody(status)}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Daten</h2></div>
        <div class="card-pad" style="padding-top:0">
          <p class="small muted" style="margin-bottom:var(--sp-3)">
            ${counts.students} Schüler · ${counts.lessons} Stunden · ${counts.grades} Noten.
            Alles liegt auf diesem Gerät${status.state === 'on' ? ' und verschlüsselt in deiner Cloud' : ''}.
          </p>
          <div class="row row-wrap" style="gap:var(--sp-2)">
            <button class="btn" data-act="export">${icon('download', { size: 16 })} Backup exportieren</button>
            <button class="btn" data-act="import">${icon('upload', { size: 16 })} Backup einlesen</button>
            <div class="spacer"></div>
            <button class="btn btn-danger" data-act="wipe">${icon('trash', { size: 16 })} Alles löschen</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Datenschutz</h2></div>
        <div class="card-pad" style="padding-top:0">
          <p class="small" style="color:var(--text-2);line-height:1.6">
            Du verarbeitest hier personenbezogene Daten – meist von Minderjährigen. Deshalb:
          </p>
          <ul class="small" style="color:var(--text-2);line-height:1.7;margin-top:8px;padding-left:18px;list-style:disc">
            <li>Die Daten liegen lokal in deinem Browser. Ohne eingerichtete Synchronisation verlassen sie das Gerät nie.</li>
            <li>Beim Hochladen werden sie <strong>vor</strong> dem Versand verschlüsselt (AES-256). Der Server speichert nur unlesbaren Chiffretext.</li>
            <li>Verlierst du dein Sync-Passwort, ist die Cloud-Kopie nicht wiederherstellbar – das ist der Preis echter Verschlüsselung. Leg ein Backup an.</li>
            <li>Notiere nur, was du wirklich brauchst, und lösche Schülerakten, wenn die Nachhilfe endet.</li>
          </ul>
        </div>
      </section>

      <p class="small muted center">Nachhilfe Manager · lokal gespeichert · <a href="SETUP.md">Einrichtung der Synchronisation</a></p>
    </div>`;
}

function settingRow(label, value, hint, act) {
  return html`
    <button class="list-row" data-act="${act}">
      <div class="list-main">
        <div class="list-title">${esc(label)}</div>
        <div class="list-sub">${esc(hint)}</div>
      </div>
      <span class="small muted">${esc(value)}</span>
      ${icon('chevronRight', { size: 16 })}
    </button>`;
}

const statusLabel = (state) => ({
  off: 'nicht eingerichtet',
  signedout: 'nicht angemeldet',
  locked: 'Passwort fehlt',
  busy: 'synchronisiert …',
  error: 'Fehler',
  on: 'aktiv',
}[state] || state);

const statusBadge = (state) => ({
  on: 'badge-ok', busy: 'badge-info', error: 'badge-danger', locked: 'badge-warn', signedout: 'badge-warn',
}[state] || '');

function syncBody(status) {
  if (!sync.configured) {
    return html`
      <p class="small" style="color:var(--text-2);line-height:1.6">
        Ohne Synchronisation liegen deine Daten nur auf diesem Gerät. Verbinde einen kostenlosen
        Supabase-Account, um Handy, Tablet und Laptop auf dem gleichen Stand zu halten –
        Ende-zu-Ende-verschlüsselt.
      </p>
      <div class="row" style="margin-top:var(--sp-3);gap:var(--sp-2)">
        <button class="btn btn-primary" data-act="sync-setup">${icon('cloud', { size: 16 })} Synchronisation einrichten</button>
        <a class="btn btn-ghost" href="SETUP.md">Anleitung</a>
      </div>`;
  }

  if (!sync.signedIn) {
    return html`
      <p class="small muted">Server verbunden. Melde dich an, um zu synchronisieren.</p>
      <div class="row" style="margin-top:var(--sp-3);gap:var(--sp-2)">
        <button class="btn btn-primary" data-act="sync-login">Anmelden</button>
        <button class="btn" data-act="sync-register">Konto anlegen</button>
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="sync-config">Server ändern</button>
      </div>`;
  }

  if (!sync.unlocked) {
    return html`
      <div class="callout callout-warn">Das Sync-Passwort fehlt auf diesem Gerät. Ohne dieses Passwort lassen sich die Daten nicht entschlüsseln.</div>
      <div class="row" style="margin-top:var(--sp-3);gap:var(--sp-2)">
        <button class="btn btn-primary" data-act="sync-pass">${icon('key', { size: 16 })} Passwort eingeben</button>
        <button class="btn btn-ghost" data-act="sync-logout">Abmelden</button>
      </div>`;
  }

  return html`
    <dl class="kv">
      <dt>Konto</dt><dd>${esc(status.email)}</dd>
      <dt>Zuletzt</dt><dd>${esc(fmtTime(status.lastSync))}</dd>
      <dt>Verschlüsselung</dt><dd>AES-256-GCM, Schlüssel nur auf deinen Geräten</dd>
      ${status.state === 'error' ? `<dt>Fehler</dt><dd style="color:var(--danger)">${esc(status.message)}</dd>` : ''}
    </dl>
    <div class="row row-wrap" style="margin-top:var(--sp-3);gap:var(--sp-2)">
      <button class="btn btn-primary" data-act="sync-now">${icon('refresh', { size: 16 })} Jetzt synchronisieren</button>
      <button class="btn" data-act="sync-show-pass">${icon('key', { size: 16 })} Passwort anzeigen</button>
      <div class="spacer"></div>
      <button class="btn btn-ghost" data-act="sync-logout">Abmelden</button>
      <button class="btn btn-danger" data-act="sync-disconnect">Trennen</button>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Dialoge                                                             */
/* ------------------------------------------------------------------ */

async function editProfile(ctx) {
  const s = store.settings;
  const fields = [
    { name: 'tutorName', label: 'Dein Name', type: 'text', span: 2, placeholder: 'z. B. Yassin' },
    { name: 'defaultRate', label: 'Standard-Stundensatz (€/60 min)', type: 'money' },
    { name: 'defaultDuration', label: 'Standard-Dauer (min)', type: 'number', min: 15, step: 15 },
    {
      name: 'gradeSystem', label: 'Notensystem', type: 'select',
      options: [
        { value: 'note', label: 'Note 1–6' },
        { value: 'punkte', label: 'Punkte 0–15 (Oberstufe)' },
      ],
    },
    { name: 'currency', label: 'Währung', type: 'select', options: ['EUR', 'CHF', 'USD', 'GBP'] },
  ];

  const data = await formModal({ title: 'Profil & Vorgaben', fields, values: s });
  if (!data) return;
  store.updateSettings({ ...data, defaultRate: Number(data.defaultRate) || DEFAULT_SETTINGS.defaultRate });
  toast('Gespeichert');
  ctx.refresh();
}

async function setupSync(ctx) {
  const data = await formModal({
    title: 'Synchronisation einrichten',
    submitLabel: 'Verbinden',
    fields: [
      { name: 'url', label: 'Projekt-URL', type: 'text', required: true, span: 2, placeholder: 'https://xxxx.supabase.co' },
      { name: 'anonKey', label: 'anon public key', type: 'text', required: true, span: 2, placeholder: 'eyJhbGciOi…' },
    ],
    values: { url: sync.cfg.url, anonKey: sync.cfg.anonKey },
    extra: html`
      <div class="callout callout-info" style="margin-top:var(--sp-3)">
        Beides findest du in deinem Supabase-Projekt unter <strong>Project Settings → API</strong>.
        Die Schritt-für-Schritt-Anleitung inklusive SQL steht in <a href="SETUP.md">SETUP.md</a>.
        Der <em>anon key</em> ist ein öffentlicher Schlüssel – der Zugriff wird über dein Konto und
        Row Level Security geschützt.
      </div>`,
    validate: (d) => (/^https:\/\/.+/.test(d.url) ? null : 'Die URL muss mit https:// beginnen'),
  });
  if (!data) return;

  sync.configure({ url: data.url, anonKey: data.anonKey });
  toast('Server gespeichert – jetzt anmelden');
  ctx.refresh();
}

async function authDialog(ctx, mode) {
  const isRegister = mode === 'register';
  const data = await formModal({
    title: isRegister ? 'Konto anlegen' : 'Anmelden',
    submitLabel: isRegister ? 'Konto anlegen' : 'Anmelden',
    fields: [
      { name: 'email', label: 'E-Mail', type: 'email', required: true, span: 2, autocomplete: 'username' },
      { name: 'password', label: 'Passwort', type: 'password', required: true, span: 2, autocomplete: isRegister ? 'new-password' : 'current-password' },
    ],
    extra: isRegister ? html`
      <div class="callout callout-info" style="margin-top:var(--sp-3)">
        Dieses Konto dient nur der Anmeldung am Server. Für die Verschlüsselung deiner Daten
        vergibst du gleich danach ein separates Sync-Passwort.
      </div>` : '',
  });
  if (!data) return;

  try {
    if (isRegister) {
      const res = await sync.signUp(data.email, data.password);
      if (!sync.signedIn) {
        toast('Bestätige zuerst die E-Mail, dann anmelden', 'ok', 5000);
        void res;
        return ctx.refresh();
      }
    } else {
      await sync.signIn(data.email, data.password);
    }
    toast('Angemeldet');
    ctx.refresh();
    if (!sync.unlocked) await passphraseDialog(ctx, true);
  } catch (err) {
    toast(err.message, 'err', 5000);
  }
}

async function passphraseDialog(ctx, firstTime = false) {
  const suggested = firstTime ? suggestPassphrase() : '';
  const data = await formModal({
    title: firstTime ? 'Sync-Passwort festlegen' : 'Sync-Passwort eingeben',
    submitLabel: 'Übernehmen',
    fields: [
      {
        name: 'pass', label: 'Sync-Passwort', type: 'text', required: true, span: 2,
        value: suggested,
        hint: 'Auf jedem Gerät identisch eingeben. Ohne dieses Passwort sind die Cloud-Daten nicht lesbar.',
      },
      { name: 'remember', label: 'Auf diesem Gerät merken', type: 'switch', span: 2, value: true },
    ],
    extra: firstTime ? html`
      <div class="callout callout-warn" style="margin-top:var(--sp-3)">
        Schreib dieses Passwort auf. Es wird nirgendwo gespeichert außer auf deinen Geräten –
        wir können es nicht zurücksetzen.
      </div>` : '',
    validate: (d) => (String(d.pass).length >= 8 ? null : 'Mindestens 8 Zeichen'),
  });
  if (!data) return;

  sync.setPassphrase(data.pass, data.remember !== false);
  toast('Passwort übernommen');
  ctx.refresh();
  sync.run('auto');
}

function showPassphrase() {
  modal({
    title: 'Sync-Passwort',
    body: html`
      <p class="small muted">Gib genau dieses Passwort auf deinen anderen Geräten ein.</p>
      <div class="input mono" style="user-select:all;padding:12px;font-size:16px;text-align:center">${esc(sync.passphrase || '')}</div>
      <button class="btn btn-block" data-copy>${icon('copy', { size: 16 })} Kopieren</button>`,
    onMount(root) {
      root.querySelector('[data-copy]').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(sync.passphrase || '');
          toast('Kopiert');
        } catch {
          toast('Kopieren nicht möglich – bitte markieren', 'err');
        }
      });
    },
  });
}

function importBackup(ctx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const replace = await confirmDialog({
      title: 'Backup einlesen',
      message: 'Zusammenführen behält deine aktuellen Daten und ergänzt fehlende. Ersetzen verwirft alles Lokale.',
      confirmLabel: 'Ersetzen',
      danger: true,
    });
    try {
      store.import(text, replace ? 'replace' : 'merge');
      toast(replace ? 'Daten ersetzt' : 'Daten zusammengeführt');
      ctx.refresh();
    } catch (err) {
      toast('Import fehlgeschlagen: ' + err.message, 'err', 5000);
    }
  });
  input.click();
}

/* ------------------------------------------------------------------ */

export function mount(root, ctx) {
  root.addEventListener('click', async (e) => {
    const themeBtn = e.target.closest('[data-theme]');
    if (themeBtn) {
      store.updateSettings({ theme: themeBtn.dataset.theme });
      applyTheme(themeBtn.dataset.theme);
      return ctx.refresh();
    }

    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;

    switch (act) {
      case 'profile': return editProfile(ctx);

      case 'export':
        download(`nachhilfe-backup-${today()}.json`, store.export());
        return toast('Backup gespeichert');

      case 'import': return importBackup(ctx);

      case 'wipe': {
        const ok = await confirmDialog({
          title: 'Wirklich alles löschen?',
          message: 'Sämtliche Schüler, Stunden und Noten auf diesem Gerät werden entfernt. Exportiere vorher ein Backup.',
          confirmLabel: 'Alles löschen',
        });
        if (!ok) return;
        store.wipe();
        toast('Alle Daten gelöscht');
        return ctx.refresh();
      }

      case 'sync-setup': return setupSync(ctx);
      case 'sync-config': return setupSync(ctx);
      case 'sync-login': return authDialog(ctx, 'login');
      case 'sync-register': return authDialog(ctx, 'register');
      case 'sync-pass': return passphraseDialog(ctx, false);
      case 'sync-show-pass': return showPassphrase();

      case 'sync-now':
        await sync.run('push');
        ctx.refresh();
        return toast(sync.status().state === 'error' ? sync.status().message : 'Synchronisiert',
          sync.status().state === 'error' ? 'err' : 'ok');

      case 'sync-logout':
        await sync.signOut();
        toast('Abgemeldet');
        return ctx.refresh();

      case 'sync-disconnect': {
        const ok = await confirmDialog({
          title: 'Synchronisation trennen?',
          message: 'Die lokalen Daten bleiben erhalten. Die verschlüsselte Kopie in der Cloud wird nicht gelöscht.',
          confirmLabel: 'Trennen',
        });
        if (!ok) return;
        sync.disconnect();
        toast('Getrennt');
        return ctx.refresh();
      }

      default:
    }
  });

}
