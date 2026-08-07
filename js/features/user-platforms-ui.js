// ---------- Sprint 14.2 · Pantalla Mis plataformas ----------
const UserPlatformsUI = (() => {
  let initialized = false;
  let catalog = [];

  function elements() {
    return {
      screen: document.querySelector('[data-screen="mis-plataformas"]'),
      list: document.getElementById("userPlatformsList"),
      summary: document.getElementById("userPlatformsSummary"),
      status: document.getElementById("userPlatformsStatus"),
      saveButton: document.getElementById("btnUserPlatformsSave"),
      refreshButton: document.getElementById("btnUserPlatformsRefresh")
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(message, type = "") {
    const { status } = elements();
    if (!status) return;
    status.textContent = message;
    status.className = `msg userPlatformsStatus ${type}`.trim();
  }

  function formatDate(timestamp) {
    if (!timestamp) return "";

    try {
      return new Intl.DateTimeFormat("es-ES", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(new Date(timestamp));
    } catch {
      return "";
    }
  }

  function mergeCatalogWithSelection(catalogProviders, selectedProviders) {
    return UserPlatformsRepository.normalizeProviders([
      ...catalogProviders,
      ...selectedProviders
    ]);
  }

  function sortSelectedFirst(providers, selectedIds) {
    return [...providers].sort((a, b) => {
      const aSelected = selectedIds.has(a.providerId) ? 0 : 1;
      const bSelected = selectedIds.has(b.providerId) ? 0 : 1;

      return aSelected - bSelected;
    });
  }

  function render(providers = catalog) {
    const { list, summary } = elements();
    if (!list || !summary) return;

    const selection = UserPlatformsRepository.loadSelection();
    const selectedIds = new Set(
      selection.providers.map(provider => provider.providerId)
    );

    catalog = sortSelectedFirst(
      mergeCatalogWithSelection(providers, selection.providers),
      selectedIds
    );

    if (!catalog.length) {
      list.innerHTML = '<p class="userPlatformsEmpty">No hay un catálogo disponible todavía.</p>';
    } else {
      list.innerHTML = catalog.map(provider => {
        const checked = selectedIds.has(provider.providerId);
        const logo = provider.logoUrl
          ? `<img src="${escapeHtml(provider.logoUrl)}" alt="" loading="lazy">`
          : '<span class="userPlatformLogoFallback" aria-hidden="true">▶</span>';

        return `
          <label class="userPlatformOption">
            <input
              type="checkbox"
              value="${provider.providerId}"
              data-user-platform-id="${provider.providerId}"
              ${checked ? "checked" : ""}
            >
            <span class="userPlatformLogo">${logo}</span>
            <span class="userPlatformName">${escapeHtml(provider.name)}</span>
          </label>
        `;
      }).join("");
    }

    updateSummary();
  }

  function updateSummary() {
    const { list, summary } = elements();
    if (!list || !summary) return;

    const selectedCount = list.querySelectorAll(
      "[data-user-platform-id]:checked"
    ).length;

    summary.textContent = selectedCount === 1
      ? "1 plataforma seleccionada"
      : `${selectedCount} plataformas seleccionadas`;
  }

  function selectedProvidersFromForm() {
    const { list } = elements();
    if (!list) return [];

    const selectedIds = new Set(
      Array.from(list.querySelectorAll("[data-user-platform-id]:checked"))
        .map(input => Number(input.value))
        .filter(Boolean)
    );

    return catalog.filter(provider => selectedIds.has(provider.providerId));
  }

  function errorMessage(error) {
    switch (error?.message) {
      case "TMDB_TOKEN_MISSING":
        return "No hay un token de TMDb configurado. Se mantiene intacta tu selección guardada.";
      case "TMDB_TOKEN_INVALID":
        return "El token de TMDb no es válido. Se mantiene intacta tu selección guardada.";
      case "TMDB_REQUEST_TIMEOUT":
        return "TMDb ha tardado demasiado en responder. Se muestra la última información guardada.";
      case "TMDB_NETWORK_ERROR":
        return "No hay conexión con TMDb. Se muestra la última información guardada.";
      default:
        return "No se pudo actualizar el catálogo. Se muestra la última información guardada.";
    }
  }

  async function fetchCatalog() {
    const [movieProviders, tvProviders] = await Promise.all([
      TMDbClient.getWatchProviderCatalog("peliculas", UserPlatformsRepository.REGION),
      TMDbClient.getWatchProviderCatalog("series", UserPlatformsRepository.REGION)
    ]);

    return UserPlatformsRepository.normalizeProviders([
      ...movieProviders,
      ...tvProviders
    ]);
  }

  async function refresh({ userInitiated = false } = {}) {
    const { refreshButton, saveButton } = elements();
    const selection = UserPlatformsRepository.loadSelection();
    const cached = UserPlatformsRepository.loadCatalog();

    catalog = mergeCatalogWithSelection(cached.providers, selection.providers);
    render(catalog);

    if (!TMDbClient.hasToken()) {
      setStatus(errorMessage(new Error("TMDB_TOKEN_MISSING")), "error");
      return;
    }

    refreshButton && (refreshButton.disabled = true);
    saveButton && (saveButton.disabled = true);
    setStatus(userInitiated ? "Actualizando catálogo desde TMDb…" : "Consultando plataformas disponibles en España…");

    try {
      const remoteCatalog = await fetchCatalog();
      const savedCatalog = UserPlatformsRepository.saveCatalog(remoteCatalog);
      catalog = mergeCatalogWithSelection(savedCatalog.providers, selection.providers);
      render(catalog);
      setStatus(
        `Catálogo actualizado desde TMDb: ${savedCatalog.providers.length} plataformas disponibles en España.`,
        "ok"
      );
    } catch (error) {
      console.error("No se pudo cargar el catálogo de plataformas de TMDb.", error);
      render(catalog);
      setStatus(errorMessage(error), "error");
    } finally {
      refreshButton && (refreshButton.disabled = false);
      saveButton && (saveButton.disabled = false);
    }
  }

  function save() {
    try {
      const saved = UserPlatformsRepository.saveSelection(
        selectedProvidersFromForm()
      );
      render(catalog);

      const savedDate = formatDate(saved.savedAt);
      setStatus(
        `Selección guardada: ${saved.providers.length} plataforma${saved.providers.length === 1 ? "" : "s"}${savedDate ? ` · ${savedDate}` : ""}.`,
        "ok"
      );
    } catch (error) {
      console.error("No se pudo guardar la selección de plataformas.", error);
      setStatus(
        "No se pudo guardar la selección. La configuración anterior no se ha eliminado.",
        "error"
      );
    }
  }

  function init() {
    if (initialized) return;

    const { screen, list, saveButton, refreshButton } = elements();
    if (!screen || !list || !saveButton || !refreshButton) return;

    initialized = true;
    list.addEventListener("change", updateSummary);
    saveButton.addEventListener("click", save);
    refreshButton.addEventListener("click", () => refresh({ userInitiated: true }));

    const selection = UserPlatformsRepository.loadSelection();
    const cached = UserPlatformsRepository.loadCatalog();
    catalog = mergeCatalogWithSelection(cached.providers, selection.providers);
    render(catalog);
  }

  function open() {
    init();
    refresh();
  }

  return Object.freeze({ init, open, refresh });
})();
