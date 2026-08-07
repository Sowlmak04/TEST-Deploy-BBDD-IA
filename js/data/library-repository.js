// ---------- Repositorio de biblioteca ----------
const LibraryRepository = (() => {
  const LIBRARY_KEYS = [
    KEY.seriesPendientes,
    KEY.peliculasPendientes,
    KEY.seriesVistas,
    KEY.peliculasVistas
  ];

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
      data[key] = read(key);
    });

    AppState.replaceAll(data);
    return data;
  }

  function getAll(key) {
    // Se relee localStorage para conservar el comportamiento validado.
    return read(key);
  }

  function replaceAll(key, items) {
    return write(key, items);
  }

  function findById(key, id) {
    const normalizedId = String(id ?? "");

    return getAll(key)
      .find(item => item.id === normalizedId) || null;
  }

  return Object.freeze({
    loadAll,
    migrateAll,
    getAll,
    replaceAll,
    findById
  });
})();
