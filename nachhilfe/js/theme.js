/** Hell/Dunkel-Umschaltung. 'system' folgt den Geräteeinstellungen. */

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function applyTheme(mode = 'system') {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);

  const dark = mode === 'dark' || (mode === 'system' && media.matches);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0e1015' : '#f4f5f8');
}

/** Bei 'system' auf Änderungen des Geräts reagieren. */
export function watchSystemTheme(getMode) {
  const handler = () => {
    if (getMode() === 'system') applyTheme('system');
  };
  media.addEventListener?.('change', handler);
}

export const currentlyDark = () =>
  document.documentElement.getAttribute('data-theme') === 'dark'
  || (!document.documentElement.hasAttribute('data-theme') && media.matches);
