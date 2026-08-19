(function () {
  "use strict";

  const STORAGE_KEY = "seriespelis.ui.theme.v1";
  const DEFAULT_THEME = "original";
  const THEMES = Object.freeze({
    original: { label: "Original", themeColor: "#0b1020" },
    dark: { label: "Oscuro", themeColor: "#050608" },
    ocean: { label: "Océano", themeColor: "#07111f" },
    amber: { label: "Ámbar", themeColor: "#120d06" }
  });

  function normalizeTheme(value) {
    return Object.prototype.hasOwnProperty.call(THEMES, value) ? value : DEFAULT_THEME;
  }

  function readTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return DEFAULT_THEME;
    }
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn("No se pudo guardar la preferencia de tema.", error);
    }
  }

  function updateThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEMES[theme].themeColor);
  }

  function syncThemeControls(theme) {
    document.querySelectorAll("[data-theme-option]").forEach(button => {
      const selected = button.dataset.themeOption === theme;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });

    const status = document.getElementById("themeSelectionStatus");
    if (status) status.textContent = `Tema activo: ${THEMES[theme].label}.`;
  }

  function applyTheme(value, options = {}) {
    const theme = normalizeTheme(value);
    document.documentElement.dataset.theme = theme;
    updateThemeColor(theme);

    if (options.persist) persistTheme(theme);
    syncThemeControls(theme);

    return theme;
  }

  // Se ejecuta en <head> para evitar que la PWA pinte primero el tema Original.
  const initialTheme = applyTheme(readTheme());

  function initThemeUI() {
    syncThemeControls(initialTheme);

    document.addEventListener("click", event => {
      const option = event.target.closest("button[data-theme-option]");
      if (!option) return;

      const theme = applyTheme(option.dataset.themeOption, { persist: true });
      syncThemeControls(theme);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThemeUI, { once: true });
  } else {
    initThemeUI();
  }

  window.ThemeUI = Object.freeze({
    apply: theme => applyTheme(theme, { persist: true }),
    current: () => normalizeTheme(document.documentElement.dataset.theme),
    themes: THEMES
  });
})();
