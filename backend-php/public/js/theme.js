/**
 * VEYRA — Theme Engine (Light, Dark, System)
 * Manages theme selection, persistence, and dynamic OS color scheme detection.
 */

const VeyraTheme = {
  STORAGE_KEY: 'veyra_theme',
  currentTheme: 'system', // 'light' | 'dark' | 'system'

  init() {
    this.currentTheme = localStorage.getItem(this.STORAGE_KEY) || 'system';
    this.applyTheme(this.currentTheme);
    this.bindEvents();
    this.listenToOsChanges();
  },

  applyTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem(this.STORAGE_KEY, theme);

    let effectiveTheme = theme;
    if (theme === 'system') {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = isDark ? 'dark' : 'light';
    }

    // Set Bootstrap 5.3 data-bs-theme attribute
    document.documentElement.setAttribute('data-bs-theme', effectiveTheme);

    // Update Dropdown UI
    this.updateDropdownUI(theme, effectiveTheme);
  },

  updateDropdownUI(selectedTheme, effectiveTheme) {
    const themeBtn = document.getElementById('themeDropdownBtn');
    const themeIcon = document.getElementById('themeCurrentIcon');
    const themeText = document.getElementById('themeCurrentText');

    if (!themeBtn) return;

    let iconClass = 'bi-circle-half';
    let label = 'System';

    if (selectedTheme === 'light') {
      iconClass = 'bi-sun-fill text-warning';
      label = 'Light';
    } else if (selectedTheme === 'dark') {
      iconClass = 'bi-moon-stars-fill text-primary';
      label = 'Dark';
    } else {
      iconClass = effectiveTheme === 'dark' ? 'bi-moon-stars text-primary' : 'bi-sun text-warning';
      label = 'System';
    }

    if (themeIcon) {
      themeIcon.className = `bi ${iconClass} me-2`;
    }
    if (themeText) {
      themeText.textContent = label;
    }

    // Update active class on dropdown items
    document.querySelectorAll('[data-theme-value]').forEach(el => {
      const val = el.getAttribute('data-theme-value');
      if (val === selectedTheme) {
        el.classList.add('active');
        el.querySelector('.theme-check')?.classList.remove('d-none');
      } else {
        el.classList.remove('active');
        el.querySelector('.theme-check')?.classList.add('d-none');
      }
    });
  },

  bindEvents() {
    document.querySelectorAll('[data-theme-value]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const chosen = btn.getAttribute('data-theme-value');
        this.applyTheme(chosen);
      });
    });
  },

  listenToOsChanges() {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Modern event listener for OS appearance toggle
    const handler = (e) => {
      if (this.currentTheme === 'system') {
        const effectiveTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-bs-theme', effectiveTheme);
        this.updateDropdownUI('system', effectiveTheme);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handler);
    }
  }
};

// Initialize immediately to prevent theme flash
document.addEventListener('DOMContentLoaded', () => {
  VeyraTheme.init();
});
