// ---------- Preferencias globales de plataformas contratadas ----------
const UserPlatformsRepository = (() => {
  const SELECTION_KEY = "inv_user_platforms_v1";
  const CATALOG_KEY = "inv_user_platform_catalog_es_v1";
  const SCHEMA_VERSION = 1;
  const REGION = "ES";

  function normalizeProvider(source) {
    const id = Number(source?.id ?? source?.providerId) || null;
    const name = String(source?.name ?? source?.providerName ?? "").trim();

    if (!id || !name) return null;

    return {
      providerId: id,
      name,
      displayPriority: Number.isFinite(Number(source?.displayPriority))
        ? Number(source.displayPriority)
        : 9999,
      logoPath: String(source?.logoPath || "").trim(),
      logoUrl: String(source?.logoUrl || "").trim()
    };
  }

  function normalizeProviders(items) {
    if (!Array.isArray(items)) return [];

    const unique = new Map();

    items.forEach(item => {
      const provider = normalizeProvider(item);
      if (!provider) return;

      const current = unique.get(provider.providerId);
      if (!current || provider.displayPriority < current.displayPriority) {
        unique.set(provider.providerId, {
          ...current,
          ...provider,
          logoPath: provider.logoPath || current?.logoPath || "",
          logoUrl: provider.logoUrl || current?.logoUrl || ""
        });
      }
    });

    return Array.from(unique.values()).sort((a, b) =>
      a.displayPriority - b.displayPriority ||
      a.name.localeCompare(b.name, "es")
    );
  }

  function safeRead(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    try {
      const value = JSON.parse(raw);
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
    } catch {
      return null;
    }
  }

  function loadSelection() {
    const stored = safeRead(SELECTION_KEY);

    return {
      schemaVersion: SCHEMA_VERSION,
      region: REGION,
      providers: normalizeProviders(stored?.providers),
      savedAt: Number(stored?.savedAt) || null
    };
  }

  function saveSelection(providers) {
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      region: REGION,
      providers: normalizeProviders(providers),
      savedAt: Date.now()
    };

    localStorage.setItem(SELECTION_KEY, JSON.stringify(payload));
    return payload;
  }

  function loadCatalog() {
    const stored = safeRead(CATALOG_KEY);

    return {
      schemaVersion: SCHEMA_VERSION,
      region: REGION,
      providers: normalizeProviders(stored?.providers),
      updatedAt: Number(stored?.updatedAt) || null
    };
  }

  function saveCatalog(providers) {
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      region: REGION,
      providers: normalizeProviders(providers),
      updatedAt: Date.now()
    };

    localStorage.setItem(CATALOG_KEY, JSON.stringify(payload));
    return payload;
  }

  return Object.freeze({
    SELECTION_KEY,
    CATALOG_KEY,
    REGION,
    normalizeProviders,
    loadSelection,
    saveSelection,
    loadCatalog,
    saveCatalog
  });
})();
