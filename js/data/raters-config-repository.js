// ---------- Configuración central de valoradores ----------
const RatersConfigRepository = (() => {
  const STORAGE_KEY = "inv_raters_config_v1";
  const SCHEMA_VERSION = 1;
  const DEFAULT_RATERS = Object.freeze([
    Object.freeze({ id: "adri", name: "Adri" }),
    Object.freeze({ id: "laura", name: "Laura" })
  ]);

  function cleanName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function defaults() {
    return { schemaVersion: SCHEMA_VERSION, raters: DEFAULT_RATERS.map(r => ({ ...r })), savedAt: null };
  }

  function normalizeConfig(source, { strict = false } = {}) {
    const raw = Array.isArray(source) ? source : source?.raters;
    if (!Array.isArray(raw)) {
      if (strict) throw new Error("La configuración de valoradores no es válida.");
      return defaults();
    }
    const byId = new Map(raw.map(item => [String(item?.id || "").toLowerCase(), item]));
    const raters = DEFAULT_RATERS.map(base => ({ id: base.id, name: cleanName(byId.get(base.id)?.name) }));
    if (raters.some(r => !r.name)) {
      if (strict) throw new Error("Los nombres de los valoradores no pueden estar vacíos.");
      return defaults();
    }
    const normalizedNames = raters.map(r => r.name.toLocaleLowerCase("es"));
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      if (strict) throw new Error("Los valoradores deben tener nombres diferentes.");
      return defaults();
    }
    return { schemaVersion: SCHEMA_VERSION, raters, savedAt: Number(source?.savedAt) || null };
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    try { return normalizeConfig(JSON.parse(raw)); }
    catch { return defaults(); }
  }

  function save(source) {
    const normalized = normalizeConfig(source, { strict: true });
    const payload = { ...normalized, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("ratersconfigchange", { detail: payload }));
    return payload;
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    const payload = defaults();
    window.dispatchEvent(new CustomEvent("ratersconfigchange", { detail: payload }));
    return payload;
  }

  function getRatersConfig() { return load().raters.map(r => ({ ...r })); }
  function getRaterName(id) {
    const key = String(id || "").toLowerCase();
    return getRatersConfig().find(r => r.id === key)?.name || key;
  }

  return Object.freeze({ STORAGE_KEY, SCHEMA_VERSION, DEFAULT_RATERS, normalizeConfig, load, save, reset, getRatersConfig, getRaterName });
})();
