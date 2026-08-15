// ---------- UX1.1 · Navegación dirigida a un registro de biblioteca ----------
const LibraryTargetNavigation = (() => {
  const EMPTY_FILTER = Object.freeze({
    platforms: [],
    genres: [],
    priorities: [],
    tags: [],
    myPlatformsOnly: false,
    favoritesOnly: false
  });

  function visibleItems(key, screenName) {
    return applySort(
      applyFilter(
        applySearch(loadArray(key), screenName),
        screenName
      ),
      screenName
    );
  }

  function prepare({ key, screenName, itemId }) {
    if (!key || !screenName || !itemId) return false;

    let items = visibleItems(key, screenName);
    let index = items.findIndex(item => String(item?.id || "") === String(itemId));

    if (index < 0) {
      setSearch(screenName, "");
      setFilter(screenName, EMPTY_FILTER);
      updateFilterBadge(screenName);
      syncSearchInput(screenName);

      items = visibleItems(key, screenName);
      index = items.findIndex(item => String(item?.id || "") === String(itemId));
    }

    if (index < 0) return false;

    setPageState(screenName, Math.floor(index / PAGE_SIZE) + 1);
    return true;
  }

  function highlight(itemId) {
    if (!itemId) return;

    window.setTimeout(() => {
      const escapedId = typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(String(itemId))
        : String(itemId).replace(/["\\]/g, "\\$&");

      const target = document.querySelector(`.itemCard[data-id="${escapedId}"]`);
      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("itemCardHighlighted");
      window.setTimeout(() => target.classList.remove("itemCardHighlighted"), 1600);
    }, 80);
  }

  function open({ key, screenName, itemId }) {
    prepare({ key, screenName, itemId });
    if (typeof showScreen === "function") showScreen(screenName);
    highlight(itemId);
  }

  return Object.freeze({ prepare, highlight, open });
})();
