// ---------- Estado central de la aplicación ----------
const AppState = (() => {
  const collections = new Map();

  function normalize(value) {
    return Array.isArray(value) ? [...value] : [];
  }

  function setCollection(key, value) {
    const next = normalize(value);
    collections.set(key, next);
    return next;
  }

  function getCollection(key) {
    if (!collections.has(key)) collections.set(key, []);
    return collections.get(key);
  }

  function replaceAll(dataByKey = {}) {
    Object.entries(dataByKey).forEach(([key, value]) => {
      setCollection(key, value);
    });
  }

  function clear() {
    collections.clear();
  }

  function snapshot() {
    const result = {};
    collections.forEach((value, key) => {
      result[key] = [...value];
    });
    return result;
  }

  return Object.freeze({
    getCollection,
    setCollection,
    replaceAll,
    clear,
    snapshot
  });
})();
