// ---------- Repositorio de biblioteca ----------
const LibraryRepository = (() => {
  const LIBRARY_KEYS = [
    KEY.seriesPendientes,
    KEY.peliculasPendientes,
    KEY.seriesVistas,
    KEY.peliculasVistas
  ];

  // Claves ya cargadas/normalizadas durante esta sesión.
  // localStorage sigue siendo la persistencia entre sesiones; AppState evita
  // releer y renormalizar la misma colección en cada consulta.
  const loadedKeys = new Set();

  function parseArray(raw) {
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readRaw(key) {
    return parseArray(localStorage.getItem(key));
  }

  function read(key) {
    const normalized =
      LibraryModel.normalizeCollection(readRaw(key), key);

    AppState.setCollection(key, normalized.items);
    loadedKeys.add(key);
    return AppState.getCollection(key);
  }

  function write(key, items) {
    const normalized =
      LibraryModel.normalizeCollection(items, key);

    localStorage.setItem(
      key,
      JSON.stringify(normalized.items)
    );

    AppState.setCollection(key, normalized.items);
    loadedKeys.add(key);
    return AppState.getCollection(key);
  }

  function migrateAll() {
    const usedIds = new Set();

    const report = {
      changedCollections: [],
      counts: {},
      duplicateCandidates: {}
    };

    LIBRARY_KEYS.forEach(key => {
      const current = readRaw(key);

      const normalized =
        LibraryModel.normalizeCollection(
          current,
          key,
          usedIds
        );

      if (normalized.changed) {
        localStorage.setItem(
          key,
          JSON.stringify(normalized.items)
        );

        report.changedCollections.push(key);
      }

      AppState.setCollection(key, normalized.items);
      loadedKeys.add(key);
      report.counts[key] = normalized.items.length;

      report.duplicateCandidates[key] =
        LibraryModel
          .duplicateCandidates(normalized.items)
          .length;
    });

    return report;
  }

  function loadAll() {
    const data = {};

    LIBRARY_KEYS.forEach(key => {
      data[key] = loadedKeys.has(key)
        ? AppState.getCollection(key)
        : read(key);
    });

    AppState.replaceAll(data);
    return data;
  }

  function getAll(key) {
    if (!loadedKeys.has(key)) return read(key);
    return AppState.getCollection(key);
  }

  function replaceAll(key, items) {
    return write(key, items);
  }

  function findById(key, id) {
    const normalizedId = String(id ?? "");

    return getAll(key)
      .find(item => item.id === normalizedId) || null;
  }

  function findByTmdbId(key, tmdbId, excludeId = null) {
    const normalizedTmdbId = Number(tmdbId);
    if (!Number.isFinite(normalizedTmdbId) || normalizedTmdbId <= 0) return null;
    const excluded = excludeId == null ? null : String(excludeId);
    return getAll(key).find(item => {
      if (excluded !== null && String(item?.id ?? "") === excluded) return false;
      return Number(item?.tmdbId) === normalizedTmdbId;
    }) || null;
  }

  return Object.freeze({
    loadAll,
    migrateAll,
    getAll,
    replaceAll,
    findById,
    findByTmdbId
  });
})();
