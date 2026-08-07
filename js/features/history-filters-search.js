// ---------- WatchLog (historial de visionados) ----------
    function makeWatchEntry({ ratingAdri, ratingLaura, notesAdri, notesLaura, at }) {
      return {
        at: at || Date.now(),
        ratingAdri: Number(ratingAdri),
        ratingLaura: Number(ratingLaura),
        notesAdri: (notesAdri || "").toString().trim(),
        notesLaura: (notesLaura || "").toString().trim(),
      };
    }

    // Garantiza que item.watchLog exista y sea un array.
    // Si no existe pero el item tiene rating/notes, crea una entrada inicial.
    function ensureWatchLog(item) {
      if (!item || typeof item !== "object") return item;
  
      if (Array.isArray(item.watchLog)) return item;
  
      const hasRatings =
        (item.ratingAdri != null && item.ratingAdri !== "") ||
        (item.ratingLaura != null && item.ratingLaura !== "") ||
        (item.notesAdri != null && item.notesAdri !== "") ||
        (item.notesLaura != null && item.notesLaura !== "");
  
      const entryAt = item.watchedAt || item.createdAt || Date.now();
  
      return {
        ...item,
        watchLog: hasRatings ?
          [makeWatchEntry({
            ratingAdri: item.ratingAdri ?? "",
            ratingLaura: item.ratingLaura ?? "",
            notesAdri: item.notesAdri ?? "",
            notesLaura: item.notesLaura ?? "",
            at: entryAt
          })] :
          []
      };
    }

    // Migración: añade watchLog en VISTAS (series + películas) si falta
    function migrateWatchLog() {
      const keys = [KEY.seriesVistas, KEY.peliculasVistas];
  
      keys.forEach(k => {
        const arr = loadArray(k);
        let changed = false;
    
        const next = arr.map(it => {
          if (Array.isArray(it?.watchLog)) return it;
          changed = true;
          return ensureWatchLog(it);
        });
    
        if (changed) saveArray(k, next);
      });
    }
    
    
    function getLastWatch(item) {
      const base = ensureWatchLog(item);
      const log = Array.isArray(base.watchLog) ? base.watchLog : [];
      const last = log.length ? log[log.length - 1] : null;
  
      // Fallback legacy si no hay log
      if (!last) {
        const ra = (base.ratingAdri ?? "");
        const rl = (base.ratingLaura ?? "");
        const na = (base.notesAdri ?? "");
        const nl = (base.notesLaura ?? "");
        const hasAnything = (ra !== "" || rl !== "" || na !== "" || nl !== "");
        return hasAnything ? { at: base.watchedAt || base.createdAt || Date.now(), ratingAdri: ra, ratingLaura: rl, notesAdri: na, notesLaura: nl } : null;
      }
      return last;
    }

    function applyLastWatchToView(item) {
      const last = getLastWatch(item);
      if (!last) return item;
  
      // Para UI: garantizamos que rating/notes reflejen el último visionado
      return {
        ...item,
        ratingAdri: last.ratingAdri,
        ratingLaura: last.ratingLaura,
        notesAdri: last.notesAdri,
        notesLaura: last.notesLaura,
        watchedAt: last.at
      };
    }
    
    
    // ===== Ordenar (estado + modal) =====
    const SORT_KEY = "inv_sort_state_v1";
    let sortState = {};
    try { sortState = JSON.parse(localStorage.getItem(SORT_KEY) || "{}"); } catch(e){ sortState = {}; }

    const sortOverlay = document.getElementById("sortOverlay");
    const sortClose   = document.getElementById("sortClose");
    const sortCancel  = document.getElementById("sortCancel");
    const sortApply   = document.getElementById("sortApply");

    let currentSortScope = null;
    let pendingSortMode = "az";

    
    function getSortMode(scope) {
      return sortState?.[scope] || "az";
    }
    
    function setSortMode(scope, mode){
      sortState[scope] = mode;
      localStorage.setItem(SORT_KEY, JSON.stringify(sortState));
    }

    
    function openSortModal(scope) {
      currentSortScope = scope;
      pendingSortMode = getSortMode(scope);
      
      const isVistas = (scope === "series-vistas" || scope === "peliculas-vistas");
      const isPendientes = scope.endsWith("pendientes");
      const isSeriesPendientes = scope === "series-pendientes";

      sortOverlay.querySelectorAll(".sortRatingOption").forEach(el => {
        el.style.display = isVistas ? "flex" : "none";
      });
      sortOverlay.querySelectorAll(".sortPendingOption").forEach(el => {
        el.style.display = isPendientes ? "flex" : "none";
      });
      sortOverlay.querySelectorAll(".sortSeriesPendingOption").forEach(el => {
        el.style.display = isSeriesPendientes ? "flex" : "none";
      });

      const invalidForScope =
        (!isVistas && ["rating_desc", "rating_asc"].includes(pendingSortMode)) ||
        (!isPendientes && ["planned", "priority", "progress"].includes(pendingSortMode)) ||
        (!isSeriesPendientes && pendingSortMode === "progress");

      if (invalidForScope) pendingSortMode = "az";

      // marcar radio actual
      sortOverlay.querySelectorAll('input[name="sortMode"]').forEach(r => {
        r.checked = (r.value === pendingSortMode);
      });
      
      sortOverlay.classList.add("open");
      sortOverlay.setAttribute("aria-hidden", "false");
      syncBodyModalOpen();
    }


    function closeSortModal(){
      sortOverlay.classList.remove("open");
      sortOverlay.setAttribute("aria-hidden", "true");
      syncBodyModalOpen();
      currentSortScope = null;
    }

    sortOverlay.addEventListener("click", (e) => {
      if (e.target === sortOverlay) closeSortModal();
    });
    sortClose.addEventListener("click", closeSortModal);
    sortCancel.addEventListener("click", closeSortModal);

    sortOverlay.querySelectorAll('input[name="sortMode"]').forEach(r => {
      r.addEventListener("change", () => pendingSortMode = r.value);
    });

    
    sortApply.addEventListener("click", () => {
      if (!currentSortScope) return;
  
      const scope = currentSortScope;
      setSortMode(scope, pendingSortMode);
  
      // ✅ Volver siempre a la página 1 al cambiar orden
      if (typeof pageState === "object" && pageState[scope] != null) {
        setPageState(scope, 1);
      }
  
      closeSortModal();
      refreshScope(scope);
    });
    
    
    // Aplica el orden a un array de items (NO muta el original)
    function applySort(items, scope) {
      const mode = getSortMode(scope);
      const arr = [...items];
      
      const titleA = (x) => (x?.title || "").toString().trim().toLocaleLowerCase("es");
      const dateA = (x) => {
        // En pendientes: lo más reciente incluye "volver a ver"
        if ((scope || "").endsWith("pendientes")) return Number(x?.movedBackAt || x?.createdAt || 0);
        return Number(x?.createdAt || 0);
      };
      
      const avgRating = (x) => {
        const item = applyLastWatchToView(x);
        const ra = Number(item?.ratingAdri);
        const rl = Number(item?.ratingLaura);
        
        if (Number.isFinite(ra) && Number.isFinite(rl)) return (ra + rl) / 2;
        if (Number.isFinite(ra)) return ra;
        if (Number.isFinite(rl)) return rl;
        return -1;
      };
      
      const plannedDate = (x) => {
        const value = String(x?.plannedDate || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return Number.POSITIVE_INFINITY;
        }
        const time = new Date(`${value}T12:00:00`).getTime();
        return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
      };

      const priorityRank = (x) => ({
        alta: 0,
        media: 1,
        baja: 2
      })[x?.priority] ?? 3;

      const progressRank = (x) => {
        const season = Number(x?.currentSeason);
        const episode = Number(x?.currentEpisode);
        if (!Number.isFinite(season) || !Number.isFinite(episode)) return -1;
        return season * 10000 + episode;
      };

      if (mode === "az") {
        arr.sort((a, b) =>
          titleA(a).localeCompare(titleA(b), "es", { sensitivity: "base" }) ||
          (dateA(b) - dateA(a))
        );
      } else if (mode === "za") {
        arr.sort((a, b) =>
          titleA(b).localeCompare(titleA(a), "es", { sensitivity: "base" }) ||
          (dateA(b) - dateA(a))
        );
      } else if (mode === "old") {
        arr.sort((a, b) =>
          (dateA(a) - dateA(b)) ||
          titleA(a).localeCompare(titleA(b), "es", { sensitivity: "base" })
        );
      } else if (mode === "rating_desc") {
        arr.sort((a, b) =>
          (avgRating(b) - avgRating(a)) ||
          titleA(a).localeCompare(titleA(b), "es", { sensitivity: "base" })
        );
      } else if (mode === "rating_asc") {
        arr.sort((a, b) =>
          (avgRating(a) - avgRating(b)) ||
          titleA(a).localeCompare(titleA(b), "es", { sensitivity: "base" })
        );
      } else if (mode === "recent") {
        arr.sort((a, b) =>
          (dateA(b) - dateA(a)) ||
          titleA(a).localeCompare(titleA(b), "es", { sensitivity: "base" })
        );
      } else if (mode === "planned") {
        arr.sort((a, b) =>
          (plannedDate(a) - plannedDate(b)) ||
          (priorityRank(a) - priorityRank(b)) ||
          titleA(a).localeCompare(titleA(b), "es", { sensitivity: "base" })
        );
      } else if (mode === "priority") {
        arr.sort((a, b) =>
          (priorityRank(a) - priorityRank(b)) ||
          (plannedDate(a) - plannedDate(b)) ||
          titleA(a).localeCompare(titleA(b), "es", { sensitivity: "base" })
        );
      } else if (mode === "progress") {
        arr.sort((a, b) =>
          (progressRank(b) - progressRank(a)) ||
          titleA(a).localeCompare(titleA(b), "es", { sensitivity: "base" })
        );
      } else { // "az" por defecto
        arr.sort((a, b) =>
          titleA(a).localeCompare(titleA(b), "es", { sensitivity: "base" }) ||
          (dateA(b) - dateA(a))
        );
      }
      
      return arr;
    }


    // Re-render según scope
    function refreshScope(scope){
      switch(scope){
        case "series-pendientes":    return renderPendientes("series");
        case "peliculas-pendientes": return renderPendientes("peliculas");
        case "series-vistas":        return renderVistas("series");
        case "peliculas-vistas":     return renderVistas("peliculas");
        default:
          return;
      }
    }
    
    function resetViewState(scope) {
      if (!scope) return;
      
      // reset orden
      if (sortState && typeof sortState === "object") {
        delete sortState[scope];
        localStorage.setItem(SORT_KEY, JSON.stringify(sortState));
      }
      
      // reset filtros
      if (filterState && typeof filterState === "object") {
        delete filterState[scope];
        localStorage.setItem(FILTER_KEY, JSON.stringify(filterState));
      }
      
      // reset búsqueda
      if (searchState && typeof searchState === "object") {
        delete searchState[scope];
        localStorage.setItem(SEARCH_KEY, JSON.stringify(searchState));
      }
      
      // reset página
      if (typeof pageState === "object" && pageState[scope] != null) {
        setPageState(scope, 1);
      }
      
      // cerrar buscador visual si estuviera abierto
      const box = document.querySelector(`.searchBox[data-search-box="${scope}"]`);
      if (box) box.classList.remove("open");
      
      const screen = document.querySelector(`.screen[data-screen="${scope}"]`);
      if (screen) screen.classList.remove("searchOpen");
    }

    
    // ===== Filtrar (estado + modal) =====
    const FILTER_KEY = "inv_filter_state_v1";
    let filterState = {};
    try { filterState = JSON.parse(localStorage.getItem(FILTER_KEY) || "{}"); } catch(e){ filterState = {}; }

    const filterOverlay   = document.getElementById("filterOverlay");
    const filterClose     = document.getElementById("filterClose");
    const filterCancel    = document.getElementById("filterCancel");
    const filterClear     = document.getElementById("filterClear");
    const filterApply     = document.getElementById("filterApply");
    const filterPlatforms = document.getElementById("filterPlatforms");
    const filterGenres    = document.getElementById("filterGenres");
    const filterPriorities = document.getElementById("filterPriorities");
    const filterTags       = document.getElementById("filterTags");
    const filterMyPlatforms = document.getElementById("filterMyPlatforms");
    const filterFavorites  = document.getElementById("filterFavorites");

    let currentFilterScope = null;
    let pendingFilter = {
      platforms: [], genres: [], priorities: [], tags: [],
      myPlatformsOnly: false, favoritesOnly: false
    };

    function splitGenres(value){
      if (typeof GenreNormalizer !== "undefined") {
        return GenreNormalizer.normalizeList(value);
      }

      return String(value || "")
        .split(",")
        .map(genre => genre.trim())
        .filter(Boolean);
    }

    function normalizeGenreKey(value){
      if (typeof GenreNormalizer !== "undefined") {
        return GenreNormalizer.key(value);
      }

      return String(value || "")
        .trim()
        .toLocaleLowerCase("es");
    }

    function uniqueGenres(values){
      const byKey = new Map();

      values
        .flatMap(splitGenres)
        .forEach(genre => {
          const key = normalizeGenreKey(genre);
          if (key && !byKey.has(key)) byKey.set(key, genre);
        });

      return [...byKey.values()]
        .sort((a,b) => a.localeCompare(b, "es", { sensitivity:"base" }));
    }

    function getFilter(scope){
      const f = filterState?.[scope];
      return {
        platforms: Array.isArray(f?.platforms) ? f.platforms : [],
        genres: Array.isArray(f?.genres) ? uniqueGenres(f.genres) : [],
        priorities: Array.isArray(f?.priorities) ? f.priorities : [],
        tags: Array.isArray(f?.tags) ? f.tags : [],
        myPlatformsOnly: Boolean(f?.myPlatformsOnly),
        favoritesOnly: Boolean(f?.favoritesOnly),
      };
    }

    const normalizedFilterState = Object.fromEntries(
      Object.entries(filterState || {}).map(([scope, filter]) => [scope, {
        ...(filter && typeof filter === "object" ? filter : {}),
        genres: Array.isArray(filter?.genres) ? uniqueGenres(filter.genres) : []
      }])
    );

    if (JSON.stringify(normalizedFilterState) !== JSON.stringify(filterState)) {
      filterState = normalizedFilterState;
      localStorage.setItem(FILTER_KEY, JSON.stringify(filterState));
    }

    function setFilter(scope, filter){
      filterState[scope] = {
        platforms: Array.isArray(filter?.platforms) ? filter.platforms : [],
        genres: Array.isArray(filter?.genres) ? uniqueGenres(filter.genres) : [],
        priorities: Array.isArray(filter?.priorities) ? filter.priorities : [],
        tags: Array.isArray(filter?.tags) ? filter.tags : [],
        myPlatformsOnly: Boolean(filter?.myPlatformsOnly),
        favoritesOnly: Boolean(filter?.favoritesOnly),
      };
      localStorage.setItem(FILTER_KEY, JSON.stringify(filterState));
    }

    function readChecked(containerEl){
      if (!containerEl) return [];
      return [...containerEl.querySelectorAll('input[type="checkbox"]:checked')]
        .map(i => (i.value || "").toString())
        .filter(Boolean);
    }

    function renderFilterGroup(containerEl, values, selected){
      if (!containerEl) return;

      if (!values.length){
        containerEl.innerHTML = `<div class="empty" style="margin-top:0;">No hay opciones disponibles.</div>`;
        return;
      }

      containerEl.innerHTML = values.map(v => `
        <label class="optRow">
          <input type="checkbox" value="${escapeHtml(v)}" ${selected.includes(v) ? "checked" : ""}>
          <span>${escapeHtml(v)}</span>
        </label>
      `).join("");
    }

    function getItemsForScope(scope){
      // OJO: aquí no aplicamos sort/filter, solo cogemos el origen para sacar opciones
      switch(scope){
        case "series-pendientes":    return loadArray(KEY.seriesPendientes);
        case "peliculas-pendientes": return loadArray(KEY.peliculasPendientes);
        case "series-vistas":        return loadArray(KEY.seriesVistas);
        case "peliculas-vistas":     return loadArray(KEY.peliculasVistas);
        default: return [];
      }
    }

    function openFilterModal(scope){
      currentFilterScope = scope;
      pendingFilter = getFilter(scope);

      const items = getItemsForScope(scope);

      const platforms = [...new Set(items.map(x => (x?.platform || "").toString().trim()).filter(Boolean))]
        .sort((a,b) => a.localeCompare(b, "es", { sensitivity:"base" }));

      const genres = uniqueGenres(items.map(item => item?.genre || ""));

      const priorities = [
        ["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]
      ].filter(([value]) => items.some(item => item?.priority === value));
      const tags = [...new Set(items.flatMap(item =>
        String(item?.tags || "").split(",").map(tag => tag.trim()).filter(Boolean)
      ))].sort((a,b) => a.localeCompare(b, "es", { sensitivity:"base" }));

      renderFilterGroup(filterPlatforms, platforms, pendingFilter.platforms);
      renderFilterGroup(filterGenres, genres, pendingFilter.genres);
      renderFilterGroup(filterPriorities, priorities.map(x => x[1]),
        pendingFilter.priorities.map(v => ({alta:"Alta",media:"Media",baja:"Baja"})[v] || v));
      renderFilterGroup(filterTags, tags, pendingFilter.tags);
      if (filterMyPlatforms) filterMyPlatforms.checked = pendingFilter.myPlatformsOnly;
      if (filterFavorites) filterFavorites.checked = pendingFilter.favoritesOnly;

      filterOverlay.classList.add("open");
      filterOverlay.setAttribute("aria-hidden", "false");
      syncBodyModalOpen();
    }

    function closeFilterModal(){
      filterOverlay.classList.remove("open");
      filterOverlay.setAttribute("aria-hidden", "true");
      syncBodyModalOpen();
      currentFilterScope = null;
      updateAllFilterBadges();
    }
    

    filterOverlay.addEventListener("click", (e) => {
      if (e.target === filterOverlay) closeFilterModal();
    });
    filterClose.addEventListener("click", closeFilterModal);
    filterCancel.addEventListener("click", closeFilterModal);

    filterClear.addEventListener("click", () => {
      [filterPlatforms, filterGenres, filterPriorities, filterTags]
        .filter(Boolean)
        .forEach(container => container.querySelectorAll('input[type="checkbox"]')
          .forEach(c => c.checked = false));
      if (filterMyPlatforms) filterMyPlatforms.checked = false;
      if (filterFavorites) filterFavorites.checked = false;
    });

    filterApply.addEventListener("click", () => {
      if (!currentFilterScope) return;
    
      const scope = currentFilterScope;
    
      const next = {
        platforms: readChecked(filterPlatforms),
        genres: readChecked(filterGenres),
        priorities: readChecked(filterPriorities).map(label =>
          ({Alta:"alta",Media:"media",Baja:"baja"})[label] || label),
        tags: readChecked(filterTags),
        myPlatformsOnly: Boolean(filterMyPlatforms?.checked),
        favoritesOnly: Boolean(filterFavorites?.checked),
      };
    
      setFilter(scope, next);
      updateFilterBadge(scope);
    
      // ✅ al filtrar, volver a página 1
      if (typeof pageState === "object" && pageState[scope] != null) {
        setPageState(scope, 1);
      }
    
      closeFilterModal();
      refreshScope(scope);
    });

    // Aplica filtros a un array de items (NO muta el original)
    function applyFilter(items, scope){
      const f = getFilter(scope);
      const platforms = f.platforms || [];
      const genres = f.genres || [];
      const priorities = f.priorities || [];
      const tags = f.tags || [];
      const myPlatformsOnly = Boolean(f.myPlatformsOnly);
      const favoritesOnly = Boolean(f.favoritesOnly);

      let arr = [...items];

      if (platforms.length){
        arr = arr.filter(x => platforms.includes((x?.platform || "").toString().trim()));
      }
      if (genres.length){
        const selectedGenreKeys = new Set(genres.map(normalizeGenreKey));

        arr = arr.filter(item => {
          const itemGenreKeys = splitGenres(item?.genre)
            .map(normalizeGenreKey);

          return [...selectedGenreKeys].every(genre =>
            itemGenreKeys.includes(genre)
          );
        });
      }
      if (priorities.length) arr = arr.filter(x => priorities.includes(x?.priority || ""));
      if (tags.length) {
        arr = arr.filter(x => {
          const itemTags = String(x?.tags || "").split(",").map(tag => tag.trim());
          return tags.some(tag => itemTags.includes(tag));
        });
      }
      if (myPlatformsOnly) {
        arr = arr.filter(item => Boolean(window.PlatformAvailabilityMatch?.matches(item)));
      }
      if (favoritesOnly) arr = arr.filter(x => Boolean(x?.favorite));
      return arr;
    }
    
    // ===== Badge "Filtrar" activo =====
    function hasActiveFilters(scope) {
      const f = getFilter(scope);
      return (Array.isArray(f.platforms) && f.platforms.length > 0) ||
        (Array.isArray(f.genres) && f.genres.length > 0) ||
        (Array.isArray(f.priorities) && f.priorities.length > 0) ||
        (Array.isArray(f.tags) && f.tags.length > 0) ||
        Boolean(f.myPlatformsOnly) ||
        Boolean(f.favoritesOnly);
    }
    
    function updateFilterBadge(scope) {
      const btn = document.querySelector(`button.toolBtn[data-action="filter"][data-scope="${scope}"]`);
      if (!btn) return;
      btn.classList.toggle("hasBadge", hasActiveFilters(scope));

    }
    
    function updateAllFilterBadges() {
      ["series-pendientes", "series-vistas", "peliculas-pendientes", "peliculas-vistas"].forEach(updateFilterBadge);
    }
    
    
    // ===== Buscar por título (estado + lógica) =====
    const SEARCH_KEY = "inv_search_state_v1";
    let searchState = {};
    try { searchState = JSON.parse(localStorage.getItem(SEARCH_KEY) || "{}"); } catch(e){ searchState = {}; }
    
    function getSearch(scope){
      return (searchState?.[scope] || "").toString();
    }
    function setSearch(scope, value){
      searchState[scope] = (value || "").toString();
      localStorage.setItem(SEARCH_KEY, JSON.stringify(searchState));
    }
    
    function applySearch(items, scope){
      const q = getSearch(scope).trim().toLocaleLowerCase("es");
      if (!q) return [...items];
      return [...items].filter(x => ((x?.title || "").toString().toLocaleLowerCase("es")).includes(q));
    }
    
    function syncSearchInput(scope){
      const input = document.querySelector(`input.searchInput[data-search="${scope}"]`);
      const clearBtn = document.querySelector(`button.searchClear[data-search-clear="${scope}"]`);
      if (!input) return;
    
      const v = getSearch(scope);
      input.value = v;
      if (clearBtn) clearBtn.style.display = v.trim() ? "inline-flex" : "none";
    }
    
    function syncAllSearchInputs(){
      ["series-pendientes","series-vistas","peliculas-pendientes","peliculas-vistas"].forEach(syncSearchInput);
    }
    
    // Input (delegado)
    document.addEventListener("input", (e) => {
      const inp = e.target.closest("input.searchInput[data-search]");
      if (!inp) return;
    
      const scope = inp.dataset.search;
      setSearch(scope, inp.value);
    
      // volver a página 1 al buscar
      if (typeof pageState === "object" && pageState[scope] != null) setPageState(scope, 1);
    
      syncSearchInput(scope);
      refreshScope(scope);
    });
    
    // Clear (delegado)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("button.searchClear[data-search-clear]");
      if (!btn) return;
    
      const scope = btn.dataset.searchClear;
      setSearch(scope, "");
    
      if (typeof pageState === "object" && pageState[scope] != null) setPageState(scope, 1);
    
      syncSearchInput(scope);
      refreshScope(scope);
    });


// Abre una biblioteca pendiente con el filtro dinámico de Mis plataformas.
// Reutiliza el estado existente de filtros y limpia únicamente búsqueda y página.
window.openLibraryWithMyPlatformsFilter = function(scope) {
  if (!["series-pendientes", "peliculas-pendientes"].includes(scope)) return;

  const current = getFilter(scope);
  setFilter(scope, { ...current, myPlatformsOnly: true });
  setSearch(scope, "");
  setPageState(scope, 1);
  updateFilterBadge(scope);
  syncSearchInput(scope);

  setMainTab(scope.startsWith("series-") ? "series" : "peliculas");
  showScreen(scope);
};

// Sincroniza al cargar los indicadores visuales de filtros persistidos.
updateAllFilterBadges();
