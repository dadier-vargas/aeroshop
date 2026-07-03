/**
 * Gestor de tema claro/oscuro para AeroShop.
 * Persiste la preferencia en localStorage y evita parpadeo con script inline en index.html.
 */
const ThemeManager = {
  STORAGE_KEY: 'aero_theme',
  DEFAULT: 'dark',

  get() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : this.DEFAULT;
  },

  apply(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next;
    localStorage.setItem(this.STORAGE_KEY, next);
    this.updateToggleUI();
    window.dispatchEvent(new CustomEvent('themeChange', { detail: { theme: next } }));
    return next;
  },

  toggle() {
    return this.apply(this.get() === 'dark' ? 'light' : 'dark');
  },

  updateToggleUI() {
    const btn = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-toggle-icon');
    if (!btn || !icon) return;

    const isDark = this.get() === 'dark';
    icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    btn.title = isDark ? 'Modo claro' : 'Modo oscuro';
    btn.setAttribute('aria-label', btn.title);
    btn.classList.toggle('is-active', !isDark);
  },

  getStripeElementStyle() {
    const style = getComputedStyle(document.documentElement);
    const pick = (name, fallback) => (style.getPropertyValue(name).trim() || fallback);

    return {
      base: {
        color: pick('--white', '#eaeaea'),
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        '::placeholder': { color: pick('--white-dim', '#9CA3AF') }
      },
      invalid: { color: pick('--magenta', '#ff2d7b') }
    };
  },

  init() {
    this.apply(this.get());
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => this.toggle());
    }
  }
};

window.addEventListener('DOMContentLoaded', () => ThemeManager.init());