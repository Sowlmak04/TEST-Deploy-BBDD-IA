// ---------- Servicio de biblioteca ----------
const LibraryService = (() => {
  function getCollection(key) {
    return LibraryRepository.getAll(key);
  }

  function getById(key, id) {
    return LibraryRepository.findById(key, id);
  }

  function add(key, item, { prepend = false } = {}) {
    const current = LibraryRepository.getAll(key);

    const normalized = LibraryModel.normalizeItem(
      item,
      LibraryModel.contextFromKey(key),
      new Set(current.map(existing => existing.id))
    );

    const next = prepend
      ? [normalized, ...current]
      : [...current, normalized];

    LibraryRepository.replaceAll(key, next);
    return normalized;
  }

  function update(key, id, updater) {
    const normalizedId = String(id ?? "");
    let updatedItem = null;

    const next = LibraryRepository.getAll(key)
      .map(item => {
        if (item.id !== normalizedId) return item;

        const candidate =
          typeof updater === "function"
            ? updater(item)
            : { ...item, ...(updater || {}) };

        updatedItem = LibraryModel.normalizeItem(
          { ...candidate, id: item.id },
          LibraryModel.contextFromKey(key)
        );

        return updatedItem;
      });

    LibraryRepository.replaceAll(key, next);
    return updatedItem;
  }

  function remove(key, id) {
    const normalizedId = String(id ?? "");
    const current = LibraryRepository.getAll(key);

    const removed =
      current.find(item => item.id === normalizedId) || null;

    if (!removed) return null;

    LibraryRepository.replaceAll(
      key,
      current.filter(item => item.id !== normalizedId)
    );

    return removed;
  }

  function move({
    fromKey,
    toKey,
    id,
    transform = item => item,
    prepend = true
  }) {
    const item = LibraryRepository.findById(fromKey, id);
    if (!item) return null;

    const candidate = transform(item);

    remove(fromKey, id);
    return add(toKey, candidate, { prepend });
  }

  function replaceCollection(key, items) {
    return LibraryRepository.replaceAll(key, items);
  }

  return Object.freeze({
    getCollection,
    getById,
    add,
    update,
    remove,
    move,
    replaceCollection
  });
})();
