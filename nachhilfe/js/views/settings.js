/** Einstellungen: Profil, Darstellung, Datei-Synchronisation, Datenverwaltung. */

import { store, DEFAULT_SETTINGS } from '../store.js';
import { fileSync, exportFile, shareFile, readFile } from '../filesync.js';
import { cryptoAvailable } from '../crypto.js';
import { formModal, confirmDialog, modal, toast } from '../ui.js';
import { icon } from '../icons.js';
import { html, esc, money } from '../util.js';
import { applyTheme } from '../theme.js';

const fmtTime = (ts) => (ts
  ? new Date(ts).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
  : 'noch nie');

export function render() {
  const s = store.settings;
  const sync = fileSync.status();
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
          <h2>Datei-Synchronisation</h2>
          <div class="spacer"></div>
          <span class="badge ${statusBadge(sync.state)}">${esc(statusLabel(sync.state))}</span>
        </div>
        <div class="card-pad" style="padding-top:0">${syncBody(sync)}</div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Daten übertragen & sichern</h2></div>
        <div class="card-pad" style="padding-top:0">
          <p class="small muted" style="margin-bottom:var(--sp-3)">
            ${counts.students} Schüler · ${counts.lessons} Stunden · ${counts.grades} Noten.
            Beim Einlesen werden Daten standardmäßig <strong>zusammengeführt</strong> – es geht also nichts verloren,
            wenn du auf beiden Geräten etwas eingetragen hast.
          </p>
          <div class="row row-wrap" style="gap:var(--sp-2)">
            <button class="btn btn-primary" data-act="share">${icon('upload', { size: 16 })} Daten senden</button>
            <button class="btn" data-act="import">${icon('download', { size: 16 })} Datei einlesen</button>
            <button class="btn" data-act="export">${icon('note', { size: 16 })} Backup speichern</button>
          </div>
          <hr class="divider" style="margin:var(--sp-4) 0">
          <div class="row row-wrap" style="gap:var(--sp-2)">
            <span class="small muted">Setzt dieses Gerät vollständig zurück.</span>
            <div class="spacer"></div>
            <button class="btn btn-danger" data-act="wipe">${icon('trash', { size: 16 })} Alles löschen</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Wo deine Daten liegen</h2></div>
        <div class="card-pad" style="padding-top:0">
          <ul class="small" style="color:var(--text-2);line-height:1.7;padding-left:18px;list-style:disc">
            <li>Alles bleibt auf deinen Geräten. Es gibt keinen Server, kein Konto und keine Übertragung im Hintergrund.</li>
            <li>Du verarbeitest personenbezogene Daten, meist von Minderjährigen – erfasse nur, was du wirklich brauchst,
                und lösche Schülerakten, wenn die Nachhilfe endet.</li>
            <li>Legst du die Datei in einen Ordner, den ein anderes Programm abgleicht (iCloud, Dropbox, Nextcloud),
                verlässt sie dein Gerät. Schalte dann unter „Datei-Synchronisation“ die Verschlüsselung ein.</li>
            <li>Ein Backup gehört an einen zweiten Ort. Geht das Handy verloren, sind die Daten sonst weg.</li>
          </ul>
        </div>
      </section>

      <p class="small muted center">Nachhilfe Manager · <a href="SETUP.md">Anleitung zur Synchronisation</a></p>
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
  unsupported: 'nur manuell',
  off: 'nicht verknüpft',
  'needs-permission': 'Zugriff bestätigen',
  busy: 'gleicht ab …',
  error: 'Fehler',
  on: 'aktiv',
}[state] || state);

const statusBadge = (state) => ({
  on: 'badge-ok', busy: 'badge-info', error: 'badge-danger', 'needs-permission': 'badge-warn',
}[state] || '');

/* ------------------------------------------------------------------ */

function syncBody(sync) {
  if (sync.state === 'unsupported') {
    return html`
      <p class="small" style="color:var(--text-2);line-height:1.6">
        Dieser Browser darf aus Sicherheitsgründen nicht dauerhaft auf Dateien zugreifen – das betrifft alle
        Handy-Browser sowie Firefox und Safari. Der Abgleich läuft hier über <strong>Daten senden</strong> und
        <strong>Datei einlesen</strong> im Abschnitt darunter.
      </p>
      <div class="callout callout-info" style="margin-top:var(--sp-3)">
        In der Praxis: Am Rechner Chrome oder Edge benutzen und die Datei dort dauerhaft verknüpfen. Vom Handy
        schickst du deine Änderungen mit „Daten senden“ hinüber – dort einlesen, fertig. Nichts wird überschrieben,
        beide Stände werden zusammengeführt.
      </div>`;
  }

  if (sync.state === 'needs-permission') {
    return html`
      <div class="callout callout-warn">
        Die Datei <strong>${esc(sync.name)}</strong> ist noch verknüpft, der Browser braucht aber nach dem Neustart
        deine Bestätigung.
      </div>
      <div class="row row-wrap" style="margin-top:var(--sp-3);gap:var(--sp-2)">
        <button class="btn btn-primary" data-act="resume">${icon('refresh', { size: 16 })} Zugriff erlauben</button>
        <button class="btn btn-ghost" data-act="unlink">Verknüpfung lösen</button>
      </div>`;
  }

  if (sync.state === 'off') {
    return html`
      <p class="small" style="color:var(--text-2);line-height:1.6">
        Verknüpfe eine Datei, dann schreibt die App jede Änderung von selbst hinein und liest beim Öffnen,
        was inzwischen darin steht. Legst du diese Datei in einen Ordner, den iCloud, Dropbox oder Nextcloud
        ohnehin abgleicht, sind deine Rechner automatisch auf demselben Stand.
      </p>
      <div class="row row-wrap" style="margin-top:var(--sp-3);gap:var(--sp-2)">
        <button class="btn btn-primary" data-act="link-new">${icon('plus', { size: 16 })} Neue Datei anlegen</button>
        <button class="btn" data-act="link-open">${icon('note', { size: 16 })} Vorhandene Datei wählen</button>
      </div>`;
  }

  return html`
    <dl class="kv">
      <dt>Datei</dt><dd class="strong">${esc(sync.name)}</dd>
      <dt>Zuletzt</dt><dd>${esc(fmtTime(sync.lastSync))}</dd>
      <dt>Verschlüsselt</dt><dd>${sync.encrypt ? 'ja – ohne Passwort nicht lesbar' : 'nein – Klartext auf deiner Festplatte'}</dd>
      ${sync.state === 'error' ? `<dt>Fehler</dt><dd style="color:var(--danger)">${esc(sync.message)}</dd>` : ''}
    </dl>
    <div class="row row-wrap" style="margin-top:var(--sp-3);gap:var(--sp-2)">
      <button class="btn btn-primary" data-act="sync-now">${icon('refresh', { size: 16 })} Jetzt abgleichen</button>
      <button class="btn" data-act="encrypt">${icon('lock', { size: 16 })} ${sync.encrypt ? 'Verschlüsselung ändern' : 'Datei verschlüsseln'}</button>
      <div class="spacer"></div>
      <button class="btn btn-ghost" data-act="unlink">Verknüpfung lösen</button>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Dialoge                                                             */
/* ------------------------------------------------------------------ */

async function editProfile(ctx) {
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

  const data = await formModal({ title: 'Profil & Vorgaben', fields, values: store.settings });
  if (!data) return;
  store.updateSettings({ ...data, defaultRate: Number(data.defaultRate) || DEFAULT_SETTINGS.defaultRate });
  toast('Gespeichert');
  ctx.refresh();
}

/** Fragt ein Passwort ab – für verschlüsselte Dateien. */
function askPassphrase({ title, hint, submitLabel = 'Weiter' }) {
  return formModal({
    title,
    submitLabel,
    fields: [{ name: 'pass', label: 'Passwort', type: 'text', required: true, span: 2, hint }],
    validate: (d) => (String(d.pass).length >= 6 ? null : 'Mindestens 6 Zeichen'),
  });
}

async function toggleEncryption(ctx) {
  if (!cryptoAvailable()) {
    return toast('Verschlüsselung braucht eine über https geladene Seite', 'err', 5000);
  }

  if (fileSync.cfg.encrypt) {
    const off = await confirmDialog({
      title: 'Verschlüsselung abschalten?',
      message: 'Die Datei wird danach im Klartext gespeichert – jeder mit Zugriff auf den Ordner kann sie lesen.',
      confirmLabel: 'Abschalten',
    });
    if (!off) return;
    fileSync.saveCfg({ encrypt: false });
    fileSync.setPassphrase(null);
    await fileSync.run('push');
    toast('Verschlüsselung abgeschaltet');
    return ctx.refresh();
  }

  const data = await askPassphrase({
    title: 'Datei verschlüsseln',
    hint: 'Merk dir dieses Passwort. Ohne es lässt sich die Datei nicht mehr lesen – auch von mir nicht.',
    submitLabel: 'Verschlüsseln',
  });
  if (!data) return;

  fileSync.setPassphrase(data.pass);
  fileSync.saveCfg({ encrypt: true });
  await fileSync.run('push');
  toast('Datei ist jetzt verschlüsselt');
  ctx.refresh();
}

/** Lässt wählen, ob eingelesene Daten ergänzt oder alles ersetzt wird. */
function askImportMode() {
  return new Promise((resolve) => {
    let mode = null;
    modal({
      title: 'Wie sollen die Daten übernommen werden?',
      body: html`
        <div class="list card" style="overflow:hidden">
          <button class="list-row" data-mode="merge">
            <span style="color:var(--ok)">${icon('check', { size: 20 })}</span>
            <span class="list-main">
              <span class="list-title">Zusammenführen</span>
              <span class="list-sub">Empfohlen. Neuere Einträge gewinnen, nichts geht verloren.</span>
            </span>
          </button>
          <button class="list-row" data-mode="replace">
            <span style="color:var(--danger)">${icon('alert', { size: 20 })}</span>
            <span class="list-main">
              <span class="list-title">Ersetzen</span>
              <span class="list-sub">Verwirft alles auf diesem Gerät und übernimmt nur die Datei.</span>
            </span>
          </button>
        </div>`,
      onMount(root, close) {
        root.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-mode]');
          if (!btn) return;
          mode = btn.dataset.mode;
          close();
        });
      },
      onClose: () => resolve(mode),
    });
  });
}

function importBackup(ctx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      let data;
      try {
        data = await readFile(file);
      } catch (err) {
        if (!err.needsPassphrase) throw err;
        const answer = await askPassphrase({
          title: 'Datei ist verschlüsselt',
          hint: 'Gib das Passwort ein, mit dem die Datei gesichert wurde.',
          submitLabel: 'Einlesen',
        });
        if (!answer) return;
        data = await readFile(file, answer.pass);
      }

      const mode = await askImportMode();
      if (!mode) return;

      const before = store.all('students').length + store.all('lessons').length + store.all('grades').length;
      store.import(data, mode);
      const after = store.all('students').length + store.all('lessons').length + store.all('grades').length;

      toast(mode === 'replace'
        ? 'Daten ersetzt'
        : `Zusammengeführt – ${Math.max(0, after - before)} neue Einträge`);
      ctx.refresh();
    } catch (err) {
      toast('Einlesen fehlgeschlagen: ' + err.message, 'err', 5000);
    }
  });

  input.click();
}

async function sendData() {
  const pass = fileSync.cfg.encrypt ? fileSync.passphrase : null;
  try {
    if (await shareFile(pass)) return;
  } catch {
    return; // Nutzer hat den Teilen-Dialog abgebrochen
  }
  await exportFile(pass);
  toast('Datei gespeichert – auf dem anderen Gerät einlesen', 'ok', 4000);
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

    try {
      switch (act) {
        case 'profile': return await editProfile(ctx);

        case 'share': return await sendData();
        case 'import': return importBackup(ctx);

        case 'export':
          await exportFile(fileSync.cfg.encrypt ? fileSync.passphrase : null);
          return toast('Backup gespeichert');

        case 'wipe': {
          const ok = await confirmDialog({
            title: 'Wirklich alles löschen?',
            message: 'Sämtliche Schüler, Stunden und Noten auf diesem Gerät werden entfernt. Speichere vorher ein Backup.',
            confirmLabel: 'Alles löschen',
          });
          if (!ok) return;
          store.wipe();
          toast('Alle Daten gelöscht');
          return ctx.refresh();
        }

        case 'link-new':
          await fileSync.createFile();
          toast('Datei verknüpft – Änderungen landen ab jetzt automatisch darin');
          return ctx.refresh();

        case 'link-open':
          await fileSync.openFile();
          toast('Datei verknüpft und abgeglichen');
          return ctx.refresh();

        case 'resume': {
          const ok = await fileSync.restore({ interactive: true });
          if (ok) {
            await fileSync.run('auto');
            toast('Verbunden');
          } else {
            toast('Zugriff wurde nicht erteilt', 'err');
          }
          return ctx.refresh();
        }

        case 'sync-now':
          await fileSync.run('auto');
          ctx.refresh();
          return toast(fileSync.error ? fileSync.error.message : 'Abgeglichen',
            fileSync.error ? 'err' : 'ok');

        case 'encrypt': return await toggleEncryption(ctx);

        case 'unlink': {
          const ok = await confirmDialog({
            title: 'Verknüpfung lösen?',
            message: 'Die Datei bleibt erhalten, wird aber nicht mehr automatisch aktualisiert.',
            confirmLabel: 'Lösen',
          });
          if (!ok) return;
          await fileSync.unlink();
          toast('Verknüpfung gelöst');
          return ctx.refresh();
        }

        default:
      }
    } catch (err) {
      if (err?.name === 'AbortError') return; // Dateiauswahl abgebrochen
      toast(err.message || 'Etwas ist schiefgelaufen', 'err', 5000);
    }
  });

}
