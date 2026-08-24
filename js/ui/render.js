// ---------- Render pendientes ----------
    function renderPendientes(type){
      const isSeries = type === "series";
      const key = isSeries ? KEY.seriesPendientes : KEY.peliculasPendientes;
    
      const listEl  = document.getElementById(isSeries ? "list-series-pendientes" : "list-peliculas-pendientes");
      const emptyEl = document.getElementById(isSeries ? "empty-series-pendientes" : "empty-peliculas-pendientes");
      const countEl = document.getElementById(isSeries ? "count-series-pendientes" : "count-peliculas-pendientes");
    
      const screenName = isSeries ? "series-pendientes" : "peliculas-pendientes";
      const pagerEl = document.getElementById(`pager-${screenName}`);
    
      const items = loadArray(key);
      if (countEl) countEl.textContent = items.length + (items.length === 1 ? " elemento" : " elementos");
    
      // Si no hay items en storage
      if(items.length === 0){
        listEl.innerHTML = "";
        if (emptyEl){
          emptyEl.style.display = "block";
          emptyEl.innerHTML = `No tienes ${isSeries ? "series" : "películas"} pendientes todavía. Ve a <b>Añadir</b> para guardar una.`;
        }
        if(pagerEl){ pagerEl.style.display = "none"; pagerEl.innerHTML = ""; }
        return;
      }
    
      if (emptyEl) emptyEl.style.display = "none";
    
      // ✅ Primero filtrar y ordenar (ANTES de usar "sorted")
      const searched = applySearch(items, screenName);
      const filtered = applyFilter(searched, screenName);
      const sorted = applySort(filtered, screenName);
    
      // Si tras filtrar no hay resultados
      if (sorted.length === 0) {
        listEl.innerHTML = "";
        if (emptyEl){
          emptyEl.style.display = "block";
          emptyEl.innerHTML = `No hay resultados con los filtros actuales.`;
        }
        if(pagerEl){ pagerEl.style.display = "none"; pagerEl.innerHTML = ""; }
        return;
      }
    
      // ✅ paginación: tamaño definido por PAGE_SIZE en navigation.js
      const { slice } = getPaged(sorted, screenName);
      renderPager(screenName, sorted.length);
    
      listEl.innerHTML = slice.map(item => {
        const meta = [];
        if (window.PlatformAvailabilityMatch?.matches(item)) {
          meta.push(`<span class="myPlatformsMatch" aria-label="Disponible en una de mis plataformas" title="Disponible en una de mis plataformas"><span class="myPlatformsMatchTick" aria-hidden="true">✓</span> Disponible en mis plataformas</span>`);
        }
        if(item.genre) meta.push(`<span>🏷️ ${escapeHtml(item.genre)}</span>`);
        if (item.seasons) meta.push(`<span>📚 ${escapeHtml(item.seasons)} temporadas</span>`);
        if (item.episodes) meta.push(`<span>📄 ${escapeHtml(item.episodes)} capítulos</span>`);
        if(item.duration) meta.push(`<span>⏱️ ${escapeHtml(item.duration)}</span>`);
        if(item.year) meta.push(`<span>📅 ${escapeHtml(item.year)}</span>`);
        if(item.plannedDate) meta.push(`<span>🗓️ ${escapeHtml(item.plannedDate)}</span>`);
        if(isSeries && (item.currentSeason || item.currentEpisode)) {
          meta.push(`<span>▶️ ${escapeHtml([
            item.currentSeason ? `T${item.currentSeason}` : "",
            item.currentEpisode ? `E${item.currentEpisode}` : ""
          ].filter(Boolean).join(" · "))}</span>`);
        }

        const personalBadges = [];
        if (item.favorite) {
          personalBadges.push(`<span class="personalBadge favoriteBadge">★ Favorito</span>`);
        }
        if (item.ownedPhysical) {
          personalBadges.push(`<span class="personalBadge ownedPhysicalBadge">▣ Colección propia</span>`);
        }
        if (item.priority) {
          personalBadges.push(
            `<span class="personalBadge priority-${escapeHtml(item.priority)}">Prioridad ${escapeHtml(item.priority)}</span>`
          );
        }
        String(item.tags || "")
          .split(",")
          .map(tag => tag.trim())
          .filter(Boolean)
          .slice(0, 3)
          .forEach(tag =>
            personalBadges.push(
              `<span class="personalBadge tagBadge">${escapeHtml(tag)}</span>`
            )
          );
    
        const progress = isSeries
          ? SeriesProgressService.snapshot(item)
          : null;

        const progressPanel = isSeries && progress && (progress.episode > 0 || progress.season > 1)
          ? `
            <div class="seriesProgressPanel">
              <div class="seriesProgressHead">
                <strong>T${progress.season} · E${progress.episode}</strong>
                ${progress.percentage !== null ? `<span>${progress.percentage}%</span>` : `<span class="progressUnavailable">Sin cálculo exacto</span>`}
              </div>
              ${progress.percentage !== null ? `
                <div class="seriesProgressTrack" aria-label="Progreso ${progress.percentage}%">
                  <div class="seriesProgressFill" style="width:${progress.percentage}%"></div>
                </div>
              ` : ``}
              <div class="seriesProgressActions">
                <button type="button" data-progress-action="back" data-progress-id="${escapeHtml(item.id)}">−1</button>
                <button type="button" class="progressAdvance" data-progress-action="advance" data-progress-id="${escapeHtml(item.id)}">+1 episodio</button>
                <button type="button" class="progressFinish" data-progress-action="finish" data-progress-id="${escapeHtml(item.id)}">Finalizar</button>
              </div>
              ${progress.lastProgressAt ? `
                <small class="seriesProgressDate">Último avance: ${escapeHtml(SeriesProgressService.formatDate(progress.lastProgressAt))}</small>
              ` : ``}
            </div>
          `
          : ``;

        return `
          <div class="itemCard clickable"
              data-kind="${isSeries ? "series" : "peliculas"}"
              data-id="${escapeHtml(item.id)}"
              role="button" tabindex="0">
            <div class="itemCardContent">
              ${
                item.posterUrl
                  ? `<img class="itemPoster" src="${escapeHtml(item.posterUrl)}" alt="" loading="lazy">`
                  : ``
              }
              <div class="itemCardText">
                <div class="itemTop">
                  <p class="itemTitle">${escapeHtml(item.title)}</p>
                </div>
                ${personalBadges.length ? `<div class="personalBadges">${personalBadges.join("")}</div>` : ``}
                ${meta.length ? `<div class="meta">${meta.join("")}</div>` : ``}
                ${progressPanel}
              </div>
            </div>
          </div>
        `;
      }).join("");
    }
    

    // ---------- Render vistas ----------
    function renderVistas(type){
      const isSeries = type === "series";
      const key = isSeries ? KEY.seriesVistas : KEY.peliculasVistas;
    
      const listEl  = document.getElementById(isSeries ? "list-series-vistas" : "list-peliculas-vistas");
      const emptyEl = document.getElementById(isSeries ? "empty-series-vistas" : "empty-peliculas-vistas");
      const countEl = document.getElementById(isSeries ? "count-series-vistas" : "count-peliculas-vistas");
    
      const screenName = isSeries ? "series-vistas" : "peliculas-vistas";
      const pagerEl = document.getElementById(`pager-${screenName}`);
    
      const items = loadArray(key);
      if (countEl) countEl.textContent = items.length + (items.length === 1 ? " elemento" : " elementos");
    
      // Si no hay items en storage
      if(items.length === 0){
        listEl.innerHTML = "";
        if (emptyEl){
          emptyEl.style.display = "block";
          emptyEl.innerHTML = `No tienes ${isSeries ? "series" : "películas"} vistas todavía. Ve a <b>Añadir</b> para guardar una.`;
        }
        if(pagerEl){ pagerEl.style.display = "none"; pagerEl.innerHTML = ""; }
        return;
      }
    
      if (emptyEl) emptyEl.style.display = "none";
    
      // ✅ Primero filtrar y ordenar (ANTES de usar "sorted")
      const searched = applySearch(items, screenName);
      const filtered = applyFilter(searched, screenName);
      const sorted = applySort(filtered, screenName);
    
      // Si tras filtrar no hay resultados
      if (sorted.length === 0) {
        listEl.innerHTML = "";
        if (emptyEl){
          emptyEl.style.display = "block";
          emptyEl.innerHTML = `No hay resultados con los filtros actuales.`;
        }
        if(pagerEl){ pagerEl.style.display = "none"; pagerEl.innerHTML = ""; }
        return;
      }
    
      const { slice } = getPaged(sorted, screenName);
      renderPager(screenName, sorted.length);
    
      listEl.innerHTML = slice.map(raw => {
        const item = applyLastWatchToView(raw);
        const meta = [];
    
        const raters = typeof LibraryModel !== "undefined" && LibraryModel.getRaters ? LibraryModel.getRaters(item) : null;
        const avg = typeof LibraryModel !== "undefined" && LibraryModel.getAverageRating ? LibraryModel.getAverageRating(item) : null;
        if (Number.isFinite(avg)) meta.push(`<span class="metaAvg">⭐ NOTA: ${escapeHtml(formatAvg(avg))}</span>`);
        const raterLabel = (id, name) => {
          const state = raters?.[id];
          if (state?.watched === false) return `${name}: No la ha visto`;
          if (state && (state.rating === "" || state.rating == null)) return `${name}: Sin valorar`;
          return `${name}: ${state?.rating ?? item[`rating${name}`] ?? ""}`;
        };
        meta.push(`<span>${escapeHtml(raterLabel("adri", "Adri"))}</span>`);
        meta.push(`<span>${escapeHtml(raterLabel("laura", "Laura"))}</span>`);
        if(item.year) meta.push(`<span>📅 ${escapeHtml(item.year)}</span>`);
        if(item.plannedDate) meta.push(`<span>🗓️ ${escapeHtml(item.plannedDate)}</span>`);
        if(isSeries && (item.currentSeason || item.currentEpisode)) {
          meta.push(`<span>▶️ ${escapeHtml([
            item.currentSeason ? `T${item.currentSeason}` : "",
            item.currentEpisode ? `E${item.currentEpisode}` : ""
          ].filter(Boolean).join(" · "))}</span>`);
        }

        const personalBadges = [];
        if (item.favorite) {
          personalBadges.push(`<span class="personalBadge favoriteBadge">★ Favorito</span>`);
        }
        if (item.ownedPhysical) {
          personalBadges.push(`<span class="personalBadge ownedPhysicalBadge">▣ Colección propia</span>`);
        }
        if (item.priority) {
          personalBadges.push(
            `<span class="personalBadge priority-${escapeHtml(item.priority)}">Prioridad ${escapeHtml(item.priority)}</span>`
          );
        }
        String(item.tags || "")
          .split(",")
          .map(tag => tag.trim())
          .filter(Boolean)
          .slice(0, 3)
          .forEach(tag =>
            personalBadges.push(
              `<span class="personalBadge tagBadge">${escapeHtml(tag)}</span>`
            )
          );
    
        return `
          <div class="itemCard clickable"
              data-kind="${isSeries ? "series" : "peliculas"}"
              data-status="vistas"
              data-id="${escapeHtml(item.id)}"
              role="button" tabindex="0">
            <div class="itemCardContent">
              ${
                item.posterUrl
                  ? `<img class="itemPoster" src="${escapeHtml(item.posterUrl)}" alt="" loading="lazy">`
                  : ``
              }
              <div class="itemCardText">
                <div class="itemTop">
                  <p class="itemTitle">${escapeHtml(item.title)}</p>
                </div>
                ${personalBadges.length ? `<div class="personalBadges">${personalBadges.join("")}</div>` : ``}
                <div class="meta">${meta.join("")}</div>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }
