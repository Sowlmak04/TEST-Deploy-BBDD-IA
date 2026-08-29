// ---------- WatchLog (historial de visionados) ----------
    function makeWatchEntry({ ratingAdri, ratingLaura, notesAdri, notesLaura, at, raters }) {
      const source = {
        at: at || Date.now(),
        ratingAdri,
        ratingLaura,
        notesAdri,
        notesLaura,
        raters
      };

      if (typeof LibraryModel !== "undefined" && LibraryModel.normalizeWatchEntry) {
        return LibraryModel.normalizeWatchEntry(source, source.at);
      }

      return source;
    }

    // Garantiza que item.watchLog exista y sea un array.
    // Si no existe pero el item tiene rating/notes, crea una entrada inicial.
    function ensureWatchLog(item) {
      if (!item || typeof item !== "object") return item;
  
      if (Array.isArray(item.watchLog)) {
        return {
          ...item,
          watchLog: item.watchLog.map(entry =>
            typeof LibraryModel !== "undefined" && LibraryModel.normalizeWatchEntry
              ? LibraryModel.normalizeWatchEntry(entry, item.watchedAt || item.createdAt || Date.now())
              : entry
          )
        };
      }
  
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
        return hasAnything ? makeWatchEntry({ at: base.watchedAt || base.createdAt || Date.now(), ratingAdri: ra, ratingLaura: rl, notesAdri: na, notesLaura: nl, raters: base.raters }) : null;
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
        raters: last.raters,
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
        const average = typeof LibraryModel !== "undefined" && LibraryModel.getAverageRating
          ? LibraryModel.getAverageRating(item)
          : null;
        return Number.isFinite(average) ? average : -1;
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
    const filterGenres    = document.getElementById("filterGenres");
    const filterGenresSection = document.getElementById("filterGenresSection");
    const filterGenresToggle = document.getElementById("filterGenresToggle");
    const filterPriorities = document.getElementById("filterPriorities");
    const filterPrioritiesSection = document.getElementById("filterPrioritiesSection");
    const filterTags       = document.getElementById("filterTags");
    const filterTagsSection = document.getElementById("filterTagsSection");
    const filterMyPlatforms = document.getElementById("filterMyPlatforms");
    const filterPlatforms = document.getElementById("filterPlatforms");
    const filterPlatformsSection = document.getElementById("filterPlatformsSection");
    const filterPersonalAvailability = document.getElementById("filterPersonalAvailability");
    const filterOwnedPhysical = document.getElementById("filterOwnedPhysical");
    const filterFavorites  = document.getElementById("filterFavorites");
    const filterWatchedDateSection = document.getElementById("filterWatchedDateSection");
    const filterWatchedDateMode = document.getElementById("filterWatchedDateMode");
    const filterWatchedDateSelectors = document.getElementById("filterWatchedDateSelectors");
    const filterWatchedMonthLabel = document.getElementById("filterWatchedMonthLabel");
    const filterWatchedMonth = document.getElementById("filterWatchedMonth");
    const filterWatchedYear = document.getElementById("filterWatchedYear");

    let currentFilterScope = null;
    let pendingFilter = {
      genres: [], priorities: [], tags: [], platforms: [],
      myPlatformsOnly: false, personalAvailabilityOnly: false, ownedPhysicalOnly: false, favoritesOnly: false,
      watchedDateMode: "any", watchedMonth: null, watchedYear: null
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
        genres: Array.isArray(f?.genres) ? uniqueGenres(f.genres) : [],
        priorities: Array.isArray(f?.priorities) ? f.priorities : [],
        tags: Array.isArray(f?.tags) ? f.tags : [],
        platforms: Array.isArray(f?.platforms) ? f.platforms.map(String).filter(Boolean) : [],
        myPlatformsOnly: Boolean(f?.myPlatformsOnly),
        personalAvailabilityOnly: Boolean(f?.personalAvailabilityOnly),
        ownedPhysicalOnly: Boolean(f?.ownedPhysicalOnly),
        favoritesOnly: Boolean(f?.favoritesOnly),
        watchedDateMode: ["any", "current_month", "month", "year"].includes(f?.watchedDateMode) ? f.watchedDateMode : "any",
        watchedMonth: Number.isInteger(Number(f?.watchedMonth)) ? Number(f.watchedMonth) : null,
        watchedYear: Number.isInteger(Number(f?.watchedYear)) ? Number(f.watchedYear) : null,
      };
    }

    const normalizedFilterState = Object.fromEntries(
      Object.entries(filterState || {}).map(([scope, filter]) => [scope, {
        genres: Array.isArray(filter?.genres) ? uniqueGenres(filter.genres) : [],
        priorities: Array.isArray(filter?.priorities) ? filter.priorities : [],
        tags: Array.isArray(filter?.tags) ? filter.tags : [],
        platforms: Array.isArray(filter?.platforms) ? filter.platforms.map(String).filter(Boolean) : [],
        myPlatformsOnly: Boolean(filter?.myPlatformsOnly),
        personalAvailabilityOnly: Boolean(filter?.personalAvailabilityOnly),
        ownedPhysicalOnly: Boolean(filter?.ownedPhysicalOnly),
        favoritesOnly: Boolean(filter?.favoritesOnly),
        watchedDateMode: ["any", "current_month", "month", "year"].includes(filter?.watchedDateMode) ? filter.watchedDateMode : "any",
        watchedMonth: Number.isInteger(Number(filter?.watchedMonth)) ? Number(filter.watchedMonth) : null,
        watchedYear: Number.isInteger(Number(filter?.watchedYear)) ? Number(filter.watchedYear) : null
      }])
    );

    if (JSON.stringify(normalizedFilterState) !== JSON.stringify(filterState)) {
      filterState = normalizedFilterState;
      localStorage.setItem(FILTER_KEY, JSON.stringify(filterState));
    }

    function setFilter(scope, filter){
      filterState[scope] = {
        genres: Array.isArray(filter?.genres) ? uniqueGenres(filter.genres) : [],
        priorities: Array.isArray(filter?.priorities) ? filter.priorities : [],
        tags: Array.isArray(filter?.tags) ? filter.tags : [],
        platforms: Array.isArray(filter?.platforms) ? filter.platforms.map(String).filter(Boolean) : [],
        myPlatformsOnly: Boolean(filter?.myPlatformsOnly),
        personalAvailabilityOnly: Boolean(filter?.personalAvailabilityOnly),
        ownedPhysicalOnly: Boolean(filter?.ownedPhysicalOnly),
        favoritesOnly: Boolean(filter?.favoritesOnly),
        watchedDateMode: ["any", "current_month", "month", "year"].includes(filter?.watchedDateMode) ? filter.watchedDateMode : "any",
        watchedMonth: Number.isInteger(Number(filter?.watchedMonth)) ? Number(filter.watchedMonth) : null,
        watchedYear: Number.isInteger(Number(filter?.watchedYear)) ? Number(filter.watchedYear) : null,
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
        containerEl.innerHTML = "";
        return;
      }

      containerEl.innerHTML = values.map(v => `
        <label class="optRow">
          <input type="checkbox" value="${escapeHtml(v)}" ${selected.includes(v) ? "checked" : ""}>
          <span>${escapeHtml(v)}</span>
        </label>
      `).join("");
    }

    function relevantConfiguredPlatforms(items){
      if (typeof UserPlatformsRepository === "undefined" ||
          typeof window.PlatformAvailabilityMatch === "undefined") return [];

      const selected = UserPlatformsRepository.loadSelection()?.providers || [];
      return selected.filter(provider =>
        items.some(item => window.PlatformAvailabilityMatch.matchesProvider?.(item, provider))
      );
    }

    function renderPlatformFilters(providers, selectedIds){
      if (!filterPlatforms) return;
      const selected = new Set((selectedIds || []).map(String));
      filterPlatforms.innerHTML = providers.map(provider => `
        <label class="optRow">
          <input type="checkbox" value="${escapeHtml(String(provider.providerId))}" ${selected.has(String(provider.providerId)) ? "checked" : ""}>
          <span>${escapeHtml(provider.name)}</span>
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

    function setFilterSectionVisible(sectionEl, visible){
      if (!sectionEl) return;
      sectionEl.hidden = !visible;
    }

    let genresExpanded = false;

    function syncGenresPreview(expanded = genresExpanded){
      if (!filterGenres || !filterGenresToggle) return;

      const rows = Array.from(filterGenres.querySelectorAll(".optRow"));
      const selectedRows = rows.filter(row => Boolean(row.querySelector('input[type="checkbox"]')?.checked));
      genresExpanded = expanded || selectedRows.length > 3;

      let visibleRows = rows;
      if (!genresExpanded && rows.length > 3) {
        const visible = [];
        selectedRows.forEach(row => {
          if (!visible.includes(row) && visible.length < 3) visible.push(row);
        });
        rows.forEach(row => {
          if (!visible.includes(row) && visible.length < 3) visible.push(row);
        });
        visibleRows = visible;
      }

      rows.forEach(row => {
        row.hidden = !visibleRows.includes(row);
      });

      const canToggle = rows.length > 3;
      filterGenresToggle.hidden = !canToggle;
      filterGenresToggle.setAttribute("aria-expanded", genresExpanded ? "true" : "false");
      filterGenresToggle.textContent = genresExpanded
        ? "Mostrar menos"
        : `Ver todos (${rows.length})`;
    }

    function watchedEventsForFilter(item){
      const log = Array.isArray(item?.watchLog) ? item.watchLog : [];
      const events = log.map(entry => Number(entry?.at)).filter(at => Number.isFinite(at) && at > 0);
      if (events.length) return events;
      const fallback = Number(item?.watchedAt);
      return Number.isFinite(fallback) && fallback > 0 ? [fallback] : [];
    }

    function availableWatchedYears(items){
      const years = new Set([new Date().getFullYear()]);
      items.forEach(item => watchedEventsForFilter(item).forEach(at => years.add(new Date(at).getFullYear())));
      return [...years].filter(Number.isFinite).sort((a,b) => b-a);
    }

    function syncWatchedDateControls(){
      if (!filterWatchedDateMode || !filterWatchedDateSelectors) return;
      const mode = filterWatchedDateMode.value;
      const needsSelectors = mode === "month" || mode === "year";
      filterWatchedDateSelectors.hidden = !needsSelectors;
      if (filterWatchedMonthLabel) filterWatchedMonthLabel.hidden = mode !== "month";
    }

    function watchedDateRange(filter){
      const now = new Date();
      const mode = filter?.watchedDateMode || "any";
      if (mode === "any") return null;
      let year = now.getFullYear();
      let month = now.getMonth() + 1;
      if (mode === "month") {
        year = Number(filter.watchedYear) || year;
        month = Number(filter.watchedMonth) || month;
      } else if (mode === "year") {
        year = Number(filter.watchedYear) || year;
      }
      const start = mode === "year" ? new Date(year,0,1) : new Date(year,month-1,1);
      const end = mode === "year" ? new Date(year+1,0,1) : new Date(year,month,1);
      return { start: start.getTime(), end: end.getTime(), mode, year, month };
    }

    function temporalMatches(item, filter){
      const range = watchedDateRange(filter);
      if (!range) return true;
      return watchedEventsForFilter(item).some(at => at >= range.start && at < range.end);
    }

    window.getLibraryTemporalFilterMeta = function(item, scope){
      if (!["series-vistas","peliculas-vistas"].includes(scope)) return null;
      const filter = getFilter(scope);
      const range = watchedDateRange(filter);
      if (!range) return null;
      const matches = watchedEventsForFilter(item).filter(at => at >= range.start && at < range.end).sort((a,b)=>b-a);
      if (!matches.length) return null;
      const periodLabel = range.mode === "year"
        ? String(range.year)
        : new Intl.DateTimeFormat("es-ES", {month:"long", year:"numeric"}).format(new Date(range.start));
      if (matches.length > 1) return `${matches.length} visionados en ${periodLabel}`;
      return `Visto: ${new Intl.DateTimeFormat("es-ES", {day:"numeric", month:"short", year:"numeric"}).format(new Date(matches[0]))}`;
    };

    window.getLibraryTemporalEmptyMessage = function(scope){
      if (!["series-vistas","peliculas-vistas"].includes(scope)) return null;
      const f = getFilter(scope);
      const range = watchedDateRange(f);
      if (!range) return null;
      const period = range.mode === "year" ? String(range.year) : new Intl.DateTimeFormat("es-ES", {month:"long", year:"numeric"}).format(new Date(range.start));
      const other = (f.genres?.length || f.priorities?.length || f.tags?.length || f.platforms?.length || f.myPlatformsOnly || f.personalAvailabilityOnly || f.ownedPhysicalOnly || f.favoritesOnly || getSearch(scope).trim());
      return other ? `No hay resultados para los filtros seleccionados en ${period}.` : `No hay títulos vistos en ${period}.`;
    };

    function openFilterModal(scope){
      currentFilterScope = scope;
      pendingFilter = getFilter(scope);

      const items = getItemsForScope(scope);
      const isWatchedScope = scope === "series-vistas" || scope === "peliculas-vistas";
      setFilterSectionVisible(filterWatchedDateSection, isWatchedScope);
      if (isWatchedScope && filterWatchedDateMode && filterWatchedMonth && filterWatchedYear) {
        const now = new Date();
        const years = availableWatchedYears(items);
        filterWatchedDateMode.value = pendingFilter.watchedDateMode || "any";
        filterWatchedMonth.innerHTML = Array.from({length:12}, (_,i) => `<option value="${i+1}">${new Intl.DateTimeFormat("es-ES", {month:"long"}).format(new Date(2026,i,1)).replace(/^./, c => c.toLocaleUpperCase("es-ES"))}</option>`).join("");
        filterWatchedYear.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join("");
        filterWatchedMonth.value = String(pendingFilter.watchedMonth || now.getMonth()+1);
        filterWatchedYear.value = String(pendingFilter.watchedYear || now.getFullYear());
        syncWatchedDateControls();
      }

      const genres = uniqueGenres(items.map(item => item?.genre || ""));

      const priorities = [
        ["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]
      ].filter(([value]) => items.some(item => item?.priority === value));
      const tags = [...new Set(items.flatMap(item =>
        String(item?.tags || "").split(",").map(tag => tag.trim()).filter(Boolean)
      ))].sort((a,b) => a.localeCompare(b, "es", { sensitivity:"base" }));
      const platforms = relevantConfiguredPlatforms(items);

      renderFilterGroup(filterGenres, genres, pendingFilter.genres);
      renderFilterGroup(filterPriorities, priorities.map(x => x[1]),
        pendingFilter.priorities.map(v => ({alta:"Alta",media:"Media",baja:"Baja"})[v] || v));
      renderFilterGroup(filterTags, tags, pendingFilter.tags);
      renderPlatformFilters(platforms, pendingFilter.platforms);

      setFilterSectionVisible(filterGenresSection, genres.length > 0);
      setFilterSectionVisible(filterPrioritiesSection, priorities.length > 0);
      setFilterSectionVisible(filterTagsSection, tags.length > 0);
      setFilterSectionVisible(filterPlatformsSection, platforms.length > 0);
      genresExpanded = pendingFilter.genres.length > 3;
      syncGenresPreview(genresExpanded);

      if (filterMyPlatforms) filterMyPlatforms.checked = pendingFilter.myPlatformsOnly;
      if (filterPersonalAvailability) filterPersonalAvailability.checked = pendingFilter.personalAvailabilityOnly;
      if (filterOwnedPhysical) filterOwnedPhysical.checked = pendingFilter.ownedPhysicalOnly;
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
    filterGenresToggle?.addEventListener("click", () => {
      syncGenresPreview(!genresExpanded);
    });
    filterGenres?.addEventListener("change", () => {
      syncGenresPreview(genresExpanded);
    });
    filterWatchedDateMode?.addEventListener("change", syncWatchedDateControls);

    filterClear.addEventListener("click", () => {
      [filterGenres, filterPriorities, filterTags, filterPlatforms]
        .filter(Boolean)
        .forEach(container => container.querySelectorAll('input[type="checkbox"]')
          .forEach(c => c.checked = false));
      if (filterMyPlatforms) filterMyPlatforms.checked = false;
      if (filterPersonalAvailability) filterPersonalAvailability.checked = false;
      if (filterOwnedPhysical) filterOwnedPhysical.checked = false;
      if (filterFavorites) filterFavorites.checked = false;
      if (filterWatchedDateMode) filterWatchedDateMode.value = "any";
      syncWatchedDateControls();
      genresExpanded = false;
      syncGenresPreview(false);
    });

    filterApply.addEventListener("click", () => {
      if (!currentFilterScope) return;
    
      const scope = currentFilterScope;
    
      const next = {
        genres: readChecked(filterGenres),
        priorities: readChecked(filterPriorities).map(label =>
          ({Alta:"alta",Media:"media",Baja:"baja"})[label] || label),
        tags: readChecked(filterTags),
        platforms: readChecked(filterPlatforms),
        myPlatformsOnly: Boolean(filterMyPlatforms?.checked),
        personalAvailabilityOnly: Boolean(filterPersonalAvailability?.checked),
        ownedPhysicalOnly: Boolean(filterOwnedPhysical?.checked),
        favoritesOnly: Boolean(filterFavorites?.checked),
        watchedDateMode: ["series-vistas", "peliculas-vistas"].includes(scope) ? (filterWatchedDateMode?.value || "any") : "any",
        watchedMonth: Number(filterWatchedMonth?.value) || null,
        watchedYear: Number(filterWatchedYear?.value) || null,
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
      const genres = f.genres || [];
      const priorities = f.priorities || [];
      const tags = f.tags || [];
      const platforms = f.platforms || [];
      const myPlatformsOnly = Boolean(f.myPlatformsOnly);
      const personalAvailabilityOnly = Boolean(f.personalAvailabilityOnly);
      const ownedPhysicalOnly = Boolean(f.ownedPhysicalOnly);
      const favoritesOnly = Boolean(f.favoritesOnly);

      let arr = [...items];
      if (["series-vistas", "peliculas-vistas"].includes(scope) && f.watchedDateMode !== "any") {
        arr = arr.filter(item => temporalMatches(item, f));
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
      if (platforms.length) {
        const selectedIds = new Set(platforms.map(String));
        const configured = typeof UserPlatformsRepository !== "undefined"
          ? UserPlatformsRepository.loadSelection()?.providers || []
          : [];
        const selectedProviders = configured.filter(provider =>
          selectedIds.has(String(provider.providerId))
        );

        arr = arr.filter(item => selectedProviders.some(provider =>
          Boolean(window.PlatformAvailabilityMatch?.matchesProvider?.(item, provider))
        ));
      }
      if (myPlatformsOnly) {
        arr = arr.filter(item => Boolean(window.PlatformAvailabilityMatch?.matches(item)));
      }
      if (personalAvailabilityOnly) {
        arr = arr.filter(item => Boolean(window.PersonalAvailability?.matches(item)));
      }
      if (ownedPhysicalOnly) {
        arr = arr.filter(item => item?.ownedPhysical === true);
      }
      if (favoritesOnly) arr = arr.filter(x => Boolean(x?.favorite));
      return arr;
    }
    
    // ===== Badge "Filtrar" activo =====
    function hasActiveFilters(scope) {
      const f = getFilter(scope);
      return (Array.isArray(f.genres) && f.genres.length > 0) ||
        (Array.isArray(f.priorities) && f.priorities.length > 0) ||
        (Array.isArray(f.tags) && f.tags.length > 0) ||
        (Array.isArray(f.platforms) && f.platforms.length > 0) ||
        Boolean(f.myPlatformsOnly) ||
        Boolean(f.personalAvailabilityOnly) ||
        Boolean(f.ownedPhysicalOnly) ||
        Boolean(f.favoritesOnly) ||
        (["series-vistas", "peliculas-vistas"].includes(scope) && f.watchedDateMode !== "any");
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

window.openLibraryWithPersonalAvailabilityFilter = function(scope) {
  if (!["series-pendientes", "peliculas-pendientes"].includes(scope)) return;
  const current = getFilter(scope);
  setFilter(scope, {
    ...current,
    myPlatformsOnly: false,
    personalAvailabilityOnly: true,
    ownedPhysicalOnly: false
  });
  setSearch(scope, "");
  setPageState(scope, 1);
  updateFilterBadge(scope);
  syncSearchInput(scope);
  setMainTab(scope.startsWith("series-") ? "series" : "peliculas");
  showScreen(scope);
};

// Sincroniza al cargar los indicadores visuales de filtros persistidos.
updateAllFilterBadges();
