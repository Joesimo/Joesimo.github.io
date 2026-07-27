/**
 * Diagramme als Inline-SVG – ohne Bibliothek.
 *
 * Views geben nur einen Platzhalter mit JSON-Konfiguration aus; `mountCharts()`
 * misst die tatsächliche Breite und zeichnet danach. So bleiben Schriftgrößen
 * auf jedem Gerät gleich groß, statt mit der SVG-Skalierung zu schrumpfen.
 *
 * Beide Diagramme zeigen genau eine Reihe – deshalb keine Legende (der Titel
 * benennt sie), dafür sparsame Direktbeschriftung und ein Hover-Tooltip.
 */

import { esc, money, num, fmtDate, fmtMonth } from './util.js';

const registry = new Map();

/** Platzhalter erzeugen; die Daten werden bis zum Mounten geparkt. */
export function chart(config) {
  const id = 'c' + (registry.size + 1) + '-' + Math.random().toString(36).slice(2, 7);
  registry.set(id, config);
  return `<div class="chart-host" data-chart="${id}" style="height:${config.height || 180}px"></div>`;
}

/* ------------------------------------------------------------------ */

const svgEl = (name, attrs = {}) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) el.setAttribute(k, String(v));
  }
  return el;
};

function tooltipEl() {
  let tip = document.getElementById('chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'chart-tip';
    tip.style.cssText = `position:fixed;z-index:150;pointer-events:none;opacity:0;
      transition:opacity .12s;background:var(--bg-elev);border:1px solid var(--border);
      border-radius:10px;padding:6px 10px;font-size:12.5px;line-height:1.35;
      box-shadow:var(--shadow-2);white-space:nowrap;color:var(--text)`;
    document.body.appendChild(tip);
  }
  return tip;
}

function bindTip(target, htmlText) {
  const show = (e) => {
    const tip = tooltipEl();
    tip.innerHTML = htmlText;
    tip.style.opacity = '1';
    const r = tip.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    tip.style.left = Math.max(8, Math.min(window.innerWidth - r.width - 8, x - r.width / 2)) + 'px';
    tip.style.top = Math.max(8, y - r.height - 14) + 'px';
  };
  const hide = () => { tooltipEl().style.opacity = '0'; };
  target.addEventListener('mouseenter', show);
  target.addEventListener('mousemove', show);
  target.addEventListener('mouseleave', hide);
  target.addEventListener('touchstart', (e) => { show(e); setTimeout(hide, 2200); }, { passive: true });
}

/* ------------------------------------------------------------------ */
/* Notenverlauf (Linie, y-Achse invertiert: 1 oben)                    */
/* ------------------------------------------------------------------ */

function drawGradeLine(host, cfg, width) {
  const points = cfg.points || [];
  const height = cfg.height || 180;
  const pad = { t: 16, r: 46, b: 24, l: 26 };
  const w = Math.max(160, width);
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const svg = svgEl('svg', { class: 'chart', width: w, height, viewBox: `0 0 ${w} ${height}`, role: 'img' });
  svg.setAttribute('aria-label', cfg.ariaLabel || 'Notenverlauf');

  const yFor = (note) => pad.t + ((note - 1) / 5) * innerH;
  const xFor = (i) => (points.length === 1
    ? pad.l + innerW / 2
    : pad.l + (i / (points.length - 1)) * innerW);

  // Zurückhaltendes Raster mit Notenbeschriftung
  for (let n = 1; n <= 6; n++) {
    const y = yFor(n);
    svg.appendChild(svgEl('line', {
      x1: pad.l, x2: w - pad.r, y1: y, y2: y,
      stroke: 'var(--border)', 'stroke-width': 1,
      'stroke-dasharray': n === 1 || n === 6 ? null : '2 4',
    }));
    const label = svgEl('text', { x: pad.l - 7, y: y + 3.5, class: 'axis-text', 'text-anchor': 'end' });
    label.textContent = String(n);
    svg.appendChild(label);
  }

  if (!points.length) return svg;

  const coords = points.map((p, i) => [xFor(i), yFor(p.note)]);

  if (points.length > 1) {
    const areaPath = `M ${coords[0][0]} ${yFor(6)} `
      + coords.map(([x, y]) => `L ${x} ${y}`).join(' ')
      + ` L ${coords.at(-1)[0]} ${yFor(6)} Z`;
    svg.appendChild(svgEl('path', { d: areaPath, fill: 'var(--accent)', opacity: 0.09 }));
    svg.appendChild(svgEl('path', {
      d: 'M ' + coords.map(([x, y]) => `${x} ${y}`).join(' L '),
      fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }));
  }

  points.forEach((p, i) => {
    const [x, y] = coords[i];
    // 2px Ring in Flächenfarbe, damit sich überlappende Punkte trennen
    svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 5, fill: 'var(--surface)' }));
    const dot = svgEl('circle', { cx: x, cy: y, r: 4, fill: 'var(--accent)' });
    svg.appendChild(dot);
    const hit = svgEl('circle', { cx: x, cy: y, r: 14, fill: 'transparent', style: 'cursor:pointer' });
    bindTip(hit, `<strong>${esc(p.label)}</strong><br>${esc(fmtDate(p.date))}${p.sub ? '<br>' + esc(p.sub) : ''}`);
    svg.appendChild(hit);
  });

  // Nur den letzten Wert direkt beschriften – rechts neben dem Punkt
  const last = points.at(-1);
  const [lx, ly] = coords.at(-1);
  const tag = svgEl('text', {
    x: lx + 11, y: ly + 3.5,
    class: 'axis-text', 'text-anchor': 'start',
    style: 'font-weight:650',
  });
  tag.textContent = last.label;
  svg.appendChild(tag);

  return svg;
}

/* ------------------------------------------------------------------ */
/* Monatseinnahmen (Balken)                                            */
/* ------------------------------------------------------------------ */

function drawBars(host, cfg, width) {
  const bars = cfg.bars || [];
  const height = cfg.height || 180;
  const pad = { t: 18, r: 6, b: 26, l: 6 };
  const w = Math.max(160, width);
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const svg = svgEl('svg', { class: 'chart', width: w, height, viewBox: `0 0 ${w} ${height}`, role: 'img' });
  svg.setAttribute('aria-label', cfg.ariaLabel || 'Balkendiagramm');

  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = bars.length ? innerW / bars.length : innerW;
  const barW = Math.max(6, Math.min(58, slot - 8)); // deutlicher Abstand zwischen Balken

  // Grundlinie
  svg.appendChild(svgEl('line', {
    x1: pad.l, x2: w - pad.r, y1: pad.t + innerH, y2: pad.t + innerH,
    stroke: 'var(--border)', 'stroke-width': 1,
  }));

  const maxIdx = bars.reduce((best, b, i) => (b.value > bars[best].value ? i : best), 0);

  bars.forEach((b, i) => {
    const h = max ? (b.value / max) * innerH : 0;
    const x = pad.l + i * slot + (slot - barW) / 2;
    const y = pad.t + innerH - h;

    const rect = svgEl('rect', {
      x, y: Math.min(y, pad.t + innerH - 2),
      width: barW, height: Math.max(2, h),
      rx: 4,
      fill: b.muted ? 'var(--surface-3)' : 'var(--accent)',
      style: 'cursor:pointer',
    });
    bindTip(rect, `<strong>${esc(b.tipTitle || b.label)}</strong><br>${esc(b.tipValue || money(b.value))}`);
    svg.appendChild(rect);

    const lbl = svgEl('text', {
      x: x + barW / 2, y: height - 8, class: 'axis-text', 'text-anchor': 'middle',
    });
    lbl.textContent = b.label;
    svg.appendChild(lbl);

    // Nur der Höchstwert wird direkt beschriftet
    if (i === maxIdx && b.value > 0) {
      const val = svgEl('text', {
        x: x + barW / 2, y: Math.max(11, y - 6), class: 'axis-text',
        'text-anchor': 'middle', style: 'font-weight:650',
      });
      val.textContent = b.short || num(b.value, 0);
      svg.appendChild(val);
    }
  });

  return svg;
}

/* ------------------------------------------------------------------ */

const RENDERERS = { gradeLine: drawGradeLine, bars: drawBars };

/** Zeichnet alle Platzhalter im übergebenen Wurzelelement. */
export function mountCharts(root = document) {
  for (const host of root.querySelectorAll('[data-chart]')) {
    const cfg = registry.get(host.dataset.chart);
    if (!cfg) continue;
    const render = RENDERERS[cfg.type];
    if (!render) continue;

    const paint = () => {
      const width = host.clientWidth || host.parentElement?.clientWidth || 320;
      host.replaceChildren(render(host, cfg, width));
    };
    paint();

    if (window.ResizeObserver && !host._ro) {
      let last = host.clientWidth;
      host._ro = new ResizeObserver(() => {
        if (Math.abs(host.clientWidth - last) > 8) {
          last = host.clientWidth;
          paint();
        }
      });
      host._ro.observe(host);
    }
  }
}

/** Verwirft alte Konfigurationen vor einem Neuaufbau der Seite. */
export function resetCharts() {
  registry.clear();
  const tip = document.getElementById('chart-tip');
  if (tip) tip.style.opacity = '0';
}

export { fmtMonth };
