/** Wiederverwendbare UI-Bausteine: Modal, Formular, Toast, Bestätigung. */

import { esc, html, initials, colorFor } from './util.js';
import { icon } from './icons.js';

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

export function toast(message, kind = 'ok', ms = 2600) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = html`${icon(kind === 'err' ? 'alert' : 'check', { size: 16 })}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s, transform .2s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 220);
  }, ms);
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

let openModals = 0;

/**
 * @param {{title:string, body:string, footer?:string, wide?:boolean,
 *          onMount?:(root:HTMLElement, close:Function)=>void,
 *          onClose?:()=>void}} opts
 */
export function modal({ title, body, footer = '', wide = false, onMount, onClose }) {
  const root = document.getElementById('modal-root');
  const scrim = document.createElement('div');
  scrim.className = 'modal-scrim';
  scrim.innerHTML = html`
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <h2>${esc(title)}</h2>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-icon" data-close aria-label="Schließen">${icon('x', { size: 18 })}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scrim.remove();
    openModals = Math.max(0, openModals - 1);
    if (!openModals) document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };

  scrim.addEventListener('click', (e) => {
    if (e.target === scrim || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);

  root.appendChild(scrim);
  openModals++;
  document.body.style.overflow = 'hidden';

  onMount?.(scrim, close);

  const focusable = scrim.querySelector('input:not([type=hidden]), select, textarea, button:not([data-close])');
  if (focusable && window.innerWidth > 760) focusable.focus();

  return { el: scrim, close };
}

export function confirmDialog({
  title = 'Sicher?',
  message = '',
  confirmLabel = 'Löschen',
  danger = true,
} = {}) {
  return new Promise((resolve) => {
    let result = false;
    modal({
      title,
      body: html`<p class="small" style="color:var(--text-2)">${esc(message)}</p>`,
      footer: html`
        <button class="btn" data-close>Abbrechen</button>
        <div class="spacer"></div>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmLabel)}</button>`,
      onMount(root, closeFn) {
        root.querySelector('[data-ok]').addEventListener('click', () => {
          result = true;
          closeFn();
        });
      },
      onClose: () => resolve(result),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Formulare                                                           */
/* ------------------------------------------------------------------ */

/**
 * Ein Feld:
 * {name, label, type, value, options?, placeholder?, hint?, required?,
 *  min?, max?, step?, span?, rows?}
 * type: text | number | money | date | time | textarea | select | tags | switch | password | email | tel | static
 */
function fieldHtml(f, value) {
  const v = value ?? f.value ?? '';
  const id = `f-${f.name}`;
  const required = f.required ? 'required' : '';
  let control = '';

  switch (f.type) {
    case 'textarea':
      control = html`<textarea class="textarea" id="${id}" name="${f.name}" rows="${f.rows || 3}"
        placeholder="${esc(f.placeholder || '')}" ${required}>${esc(v)}</textarea>`;
      break;

    case 'select':
      control = html`<select class="select" id="${id}" name="${f.name}" ${required}>
        ${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}
        ${(f.options || []).map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const label = typeof o === 'string' ? o : o.label;
          return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(label)}</option>`;
        })}
      </select>`;
      break;

    case 'tags': {
      const selected = Array.isArray(v) ? v : [];
      control = html`
        <div class="chips" data-tags="${f.name}">
          ${(f.options || []).map((o) => html`
            <button type="button" class="chip ${selected.includes(o) ? 'is-active' : ''}" data-tag="${esc(o)}">${esc(o)}</button>`)}
        </div>
        <input type="hidden" name="${f.name}" value="${esc(selected.join('|'))}">`;
      break;
    }

    case 'switch':
      return html`
        <div class="field" ${f.span ? `style="grid-column:span ${f.span}"` : ''}>
          <label class="switch">
            <input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}>
            <span class="switch-track"></span>
            <span>${esc(f.label)}</span>
          </label>
          ${f.hint ? `<div class="field-hint">${esc(f.hint)}</div>` : ''}
        </div>`;

    case 'static':
      return html`
        <div class="field" ${f.span ? `style="grid-column:span ${f.span}"` : ''}>
          <label>${esc(f.label)}</label>
          <div class="small">${f.html || esc(v)}</div>
        </div>`;

    case 'money':
      control = html`<input class="input" id="${id}" name="${f.name}" type="number" inputmode="decimal"
        step="${f.step || '0.5'}" min="${f.min ?? 0}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${required}>`;
      break;

    case 'number':
      control = html`<input class="input" id="${id}" name="${f.name}" type="number" inputmode="decimal"
        ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}
        value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${required}>`;
      break;

    default:
      control = html`<input class="input" id="${id}" name="${f.name}" type="${f.type || 'text'}"
        value="${esc(v)}" placeholder="${esc(f.placeholder || '')}"
        ${f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''} ${required}>`;
  }

  return html`
    <div class="field" ${f.span ? `style="grid-column:span ${f.span}"` : ''}>
      <label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>
      ${control}
      ${f.hint ? `<div class="field-hint">${esc(f.hint)}</div>` : ''}
    </div>`;
}

/** Rendert Felder in ein 2-spaltiges Raster (Feld-`span` steuert die Breite). */
export function formGrid(fields, values = {}) {
  return html`
    <div class="grid grid-2 keep-2" style="gap:var(--sp-3) var(--sp-3)">
      ${fields.map((f) => fieldHtml(f, values[f.name]))}
    </div>`;
}

/** Liest ein Formular anhand der Felddefinition typrichtig aus. */
export function readForm(formEl, fields) {
  const out = {};
  for (const f of fields) {
    const el = formEl.querySelector(`[name="${f.name}"]`);
    if (!el) continue;
    if (f.type === 'switch') out[f.name] = el.checked;
    else if (f.type === 'tags') out[f.name] = el.value ? el.value.split('|').filter(Boolean) : [];
    else if (f.type === 'number' || f.type === 'money') out[f.name] = el.value === '' ? null : Number(el.value);
    else if (f.type === 'static') continue;
    else out[f.name] = el.value.trim();
  }
  return out;
}

/**
 * Modal mit Formular.
 * @returns {Promise<object|null>} Werte oder null bei Abbruch
 */
export function formModal({
  title,
  fields,
  values = {},
  submitLabel = 'Speichern',
  extra = '',
  wide = false,
  onDelete = null,
  validate = null,
}) {
  return new Promise((resolve) => {
    let result = null;

    modal({
      title,
      wide,
      onClose: () => resolve(result),
      body: html`<form id="modal-form" novalidate>${formGrid(fields, values)}${extra}</form>`,
      footer: html`
        ${onDelete ? '<button class="btn btn-danger" data-delete>Löschen</button>' : ''}
        <div class="spacer"></div>
        <button class="btn" data-close>Abbrechen</button>
        <button class="btn btn-primary" data-submit>${esc(submitLabel)}</button>`,
      onMount(root, closeFn) {
        const form = root.querySelector('#modal-form');

        // Tag-Chips umschalten
        form.querySelectorAll('[data-tags]').forEach((box) => {
          const hidden = form.querySelector(`input[type=hidden][name="${box.dataset.tags}"]`);
          box.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-tag]');
            if (!chip) return;
            chip.classList.toggle('is-active');
            const active = [...box.querySelectorAll('.chip.is-active')].map((c) => c.dataset.tag);
            hidden.value = active.join('|');
          });
        });

        const submit = () => {
          const data = readForm(form, fields);
          const missing = fields.find((f) => f.required && !String(data[f.name] ?? '').trim());
          if (missing) {
            toast(`Bitte „${missing.label}" ausfüllen`, 'err');
            form.querySelector(`[name="${missing.name}"]`)?.focus();
            return;
          }
          if (validate) {
            const err = validate(data);
            if (err) return toast(err, 'err');
          }
          result = data;
          closeFn();
        };

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          submit();
        });
        form.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            submit();
          }
        });
        root.querySelector('[data-submit]').addEventListener('click', submit);
        root.querySelector('[data-delete]')?.addEventListener('click', () => {
          closeFn();
          onDelete();
        });
      },
    });
  });
}

/* ------------------------------------------------------------------ */
/* Kleinteile                                                          */
/* ------------------------------------------------------------------ */

export function avatar(student, size = '') {
  const color = student.color || colorFor(student.id || '');
  return html`<div class="avatar ${size}" style="background:${esc(color)}" aria-hidden="true">${esc(
    initials(student.firstName, student.lastName),
  )}</div>`;
}

export function emptyState({ icon: ic = 'note', title, text, action = '' }) {
  return html`
    <div class="empty">
      <div class="empty-icon">${icon(ic)}</div>
      <h3>${esc(title)}</h3>
      ${text ? `<p>${esc(text)}</p>` : ''}
      ${action}
    </div>`;
}

export const badge = (label, kind = '') => html`<span class="badge ${kind}">${esc(label)}</span>`;
