// ---------- Rating widget (10 estrellas, medias con click) ----------
    const STAR_PATH = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

    function createStarSVG({fillClass, clip} = {}){
      const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("viewBox","0 0 24 24");
      svg.classList.add("starSvg");

      const outline = document.createElementNS("http://www.w3.org/2000/svg","path");
      outline.setAttribute("d", STAR_PATH);
      outline.classList.add("starOutline");
      svg.appendChild(outline);

      if(fillClass){
        const fill = document.createElementNS("http://www.w3.org/2000/svg","path");
        fill.setAttribute("d", STAR_PATH);
        fill.classList.add(fillClass);

        if(clip){
          const defs = document.createElementNS("http://www.w3.org/2000/svg","defs");
          const clipPath = document.createElementNS("http://www.w3.org/2000/svg","clipPath");
          clipPath.setAttribute("id", clip.id);
          const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
          rect.setAttribute("x","0");
          rect.setAttribute("y","0");
          rect.setAttribute("width", clip.width);
          rect.setAttribute("height","24");
          clipPath.appendChild(rect);
          defs.appendChild(clipPath);
          svg.appendChild(defs);

          fill.setAttribute("clip-path", `url(#${clip.id})`);
        }

        svg.appendChild(fill);
      }

      return svg;
    }

    function initRatingWidget(container){
      if (!container || container.dataset.ratingInitialized === "1") return;

      const targetId = container.dataset.target;
      const outId = container.dataset.out;
      const hidden = document.getElementById(targetId);
      const out = document.getElementById(outId);
      if (!hidden || !out) return;

      container.dataset.ratingInitialized = "1";
      let value = 0;

      function parsePreciseRating(raw){
        const normalized = String(raw ?? "").trim().replace(",", ".");
        if (normalized === "") return null;
        if (!/^(?:\d{1,2})(?:\.\d{1,2})?$/.test(normalized)) return NaN;

        const number = Number(normalized);
        if (!Number.isFinite(number) || number < 0 || number > 10) return NaN;
        return Math.round((number + Number.EPSILON) * 100) / 100;
      }

      function formatRating(number){
        if (!Number.isFinite(number)) return "—";
        return String(number).replace(".", ",");
      }

      function ensurePreciseControl(){
        const block = container.closest(".ratingBlock");
        if (!block) return null;

        let control = block.querySelector(`[data-rating-precise-for="${targetId}"]`);
        if (control) return control;

        const row = document.createElement("div");
        row.className = "ratingPreciseRow";

        const label = document.createElement("label");
        label.className = "ratingPreciseLabel";
        label.htmlFor = `${targetId}-precise`;
        label.textContent = "Nota exacta";

        control = document.createElement("input");
        control.id = `${targetId}-precise`;
        control.type = "text";
        control.inputMode = "decimal";
        control.autocomplete = "off";
        control.className = "ratingPreciseInput";
        control.dataset.ratingPreciseFor = targetId;
        control.placeholder = "Ej. 8,25";
        control.setAttribute("aria-label", "Nota exacta de 0 a 10, máximo dos decimales");

        const hint = document.createElement("span");
        hint.className = "ratingPreciseHint";
        hint.textContent = "0–10 · máx. 2 decimales";

        row.append(label, control, hint);
        block.appendChild(row);

        const commit = () => {
          const parsed = parsePreciseRating(control.value);
          if (parsed === null) {
            reset();
            return;
          }
          if (!Number.isFinite(parsed)) {
            control.setCustomValidity("Introduce una nota entre 0 y 10 con máximo dos decimales.");
            control.reportValidity();
            control.value = hidden.value ? formatRating(Number(hidden.value)) : "";
            return;
          }

          control.setCustomValidity("");
          set(parsed);
        };

        control.addEventListener("change", commit);
        control.addEventListener("blur", () => {
          if (control.value.trim() !== "") commit();
        });
        control.addEventListener("input", () => control.setCustomValidity(""));

        return control;
      }

      function syncOutput(){
        const precise = ensurePreciseControl();
        if (!hidden.value) {
          out.textContent = "—";
          if (precise && document.activeElement !== precise) precise.value = "";
          return;
        }

        const stored = Number(hidden.value);
        out.textContent = formatRating(stored);
        if (precise && document.activeElement !== precise) {
          precise.value = formatRating(stored);
        }
      }

      function render(){
        container.innerHTML = "";
        const visualValue = Math.round(value * 2) / 2;

        for(let i=1;i<=10;i++){
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "starBtn";
          btn.setAttribute("aria-label", `Estrella ${i}`);

          const starVal = i;
          const halfVal = i - 0.5;

          if(visualValue >= starVal){
            btn.appendChild(createStarSVG({fillClass:"starFillFull"}));
          }else if(visualValue >= halfVal){
            const clipId = `${targetId}_clip_${i}_${Math.random().toString(36).slice(2,7)}`;
            btn.appendChild(createStarSVG({fillClass:"starFillHalf", clip:{id:clipId, width:"12"}}));
          }else{
            btn.appendChild(createStarSVG());
          }

          btn.addEventListener("click", (e)=>{
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const half = x < rect.width/2 ? 0.5 : 1.0;
            set((i - 1) + half);
          });

          container.appendChild(btn);
        }

        syncOutput();
      }

      function reset(){
        value = 0;
        hidden.value = "";
        const precise = ensurePreciseControl();
        if (precise) {
          precise.value = "";
          precise.setCustomValidity("");
        }
        out.textContent = "—";
        render();
      }

      function set(val) {
        const parsed = parsePreciseRating(val);
        if (parsed === null || !Number.isFinite(parsed)) {
          reset();
          return;
        }

        value = parsed;
        hidden.value = String(parsed);
        const precise = ensurePreciseControl();
        if (precise) {
          precise.value = formatRating(parsed);
          precise.setCustomValidity("");
        }
        out.textContent = formatRating(parsed);
        render();
      }

      container._setRating = set;
      container._resetRating = reset;
      ensurePreciseControl();
      render();
    }

    // Exponer inicializador para widgets de valoración insertados dinámicamente.
    window.initRatingWidget = initRatingWidget;

    // Crear widgets para todos los ratings
    document.querySelectorAll('[data-widget="rating"]').forEach(initRatingWidget);

    function resetRatingsInside(form){
      form.querySelectorAll('[data-widget="rating"]').forEach(w => {
        if(typeof w._resetRating === "function") w._resetRating();
      });
    }

    function duplicateLocationForKey(key, tmdbId) {
      const id = Number(tmdbId);
      if (!Number.isFinite(id) || id <= 0) return null;
      const isSeries = key === KEY.seriesPendientes || key === KEY.seriesVistas;
      const pendingKey = isSeries ? KEY.seriesPendientes : KEY.peliculasPendientes;
      const seenKey = isSeries ? KEY.seriesVistas : KEY.peliculasVistas;
      if (LibraryRepository.findByTmdbId(pendingKey, id)) {
        return { key: pendingKey, label: isSeries ? "Series pendientes" : "Películas pendientes" };
      }
      if (LibraryRepository.findByTmdbId(seenKey, id)) {
        return { key: seenKey, label: isSeries ? "Series vistas" : "Películas vistas" };
      }
      return null;
    }

    function duplicateMessageForNewItem(key, duplicate) {
      if (duplicate.key === key) return `Este título ya está en ${duplicate.label}.`;
      const addingToSeen = key === KEY.seriesVistas || key === KEY.peliculasVistas;
      return addingToSeen
        ? `Este título ya está en ${duplicate.label}. Márcalo como visto desde su registro para conservar sus datos.`
        : `Este título ya está en ${duplicate.label}. Usa “Volver a ver” desde su registro para conservar sus datos.`;
    }

    function readTMDbMetadata(formData) {
      const numberOrNull = value => {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      };

      const jsonArray = value => {
        try {
          const parsed = JSON.parse(String(value || "[]"));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      const jsonObject = value => {
        try {
          const parsed = JSON.parse(String(value || "null"));
          return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : null;
        } catch {
          return null;
        }
      };

      return {
        tmdbId: numberOrNull(formData.get("tmdbId")),
        tmdbType: (formData.get("tmdbType") || "").toString().trim(),
        year: (formData.get("year") || "").toString().trim(),
        posterPath: (formData.get("posterPath") || "").toString().trim(),
        posterUrl: (formData.get("posterUrl") || "").toString().trim(),
        backdropPath: (formData.get("backdropPath") || "").toString().trim(),
        originalTitle: (formData.get("originalTitle") || "").toString().trim(),
        originalLanguage: (formData.get("originalLanguage") || "").toString().trim(),
        originCountries: jsonArray(formData.get("originCountries"))
          .map(value => String(value || "").trim()).filter(Boolean),
        spokenLanguages: jsonArray(formData.get("spokenLanguages"))
          .map(value => String(value || "").trim()).filter(Boolean),
        productionCompanies: jsonArray(formData.get("productionCompanies"))
          .map(company => ({
            id: Number(company?.id) || null,
            name: String(company?.name || "").trim(),
            originCountry: String(company?.originCountry || "").trim(),
            logoPath: String(company?.logoPath || "").trim()
          })).filter(company => company.name),
        productionStatus: (formData.get("productionStatus") || "").toString().trim(),
        tagline: (formData.get("tagline") || "").toString().trim(),
        releaseDate: (formData.get("releaseDate") || "").toString().trim(),
        lastAirDate: (formData.get("lastAirDate") || "").toString().trim(),
        adult: formData.get("adult") === "1",
        inProduction: formData.get("inProduction") === ""
          ? null
          : formData.get("inProduction") === "1",
        cast: jsonArray(formData.get("cast")),
        crew: jsonArray(formData.get("crew")),
        creators: jsonArray(formData.get("creators")),
        trailer: jsonObject(formData.get("trailer")),
        watchRegion: (formData.get("watchRegion") || "ES").toString().trim().toUpperCase() || "ES",
        watchProviders: jsonArray(formData.get("watchProviders")),
        watchProvidersLink: (formData.get("watchProvidersLink") || "").toString().trim(),
        watchProvidersUpdatedAt: numberOrNull(formData.get("watchProvidersUpdatedAt")),
        tmdbVoteAverage: numberOrNull(formData.get("tmdbVoteAverage")),
        tmdbUpdatedAt: numberOrNull(formData.get("tmdbUpdatedAt")),
        seasonsData: jsonArray(formData.get("seasonsData")),
        specialsData: jsonArray(formData.get("specialsData")),
        tmdbStatus: (formData.get("tmdbStatus") || "").toString().trim(),
        tmdbSeasonsUpdatedAt: numberOrNull(
          formData.get("tmdbSeasonsUpdatedAt")
        )
      };
    }

    function readPersonalMetadata(formData) {
      return {
        favorite: formData.get("favorite") === "1",
        ownedPhysical: formData.get("ownedPhysical") === "1",
        priority: (formData.get("priority") || "").toString().trim(),
        tags: (formData.get("tags") || "").toString().trim(),
        privateNote: (formData.get("privateNote") || "").toString().trim(),
        plannedDate: (formData.get("plannedDate") || "").toString().trim(),
        currentSeason: (formData.get("currentSeason") || "").toString().trim(),
        currentEpisode: (formData.get("currentEpisode") || "").toString().trim(),
        episodesPerSeason: (formData.get("episodesPerSeason") || "").toString().trim(),
        episodesBySeason: (formData.get("episodesBySeason") || "").toString().split(/[,\s;|/]+/).map(value => value.trim()).filter(Boolean)
      };
    }

    // ---------- Guardado ----------
    function newItemDestination(key) {
      switch (key) {
        case KEY.seriesPendientes:
          return { screenName: "series-pendientes", toast: "Añadida a Series pendientes ✓" };
        case KEY.peliculasPendientes:
          return { screenName: "peliculas-pendientes", toast: "Añadida a Películas pendientes ✓" };
        case KEY.seriesVistas:
          return { screenName: "series-vistas", toast: "Añadida a Series vistas ✓" };
        case KEY.peliculasVistas:
          return { screenName: "peliculas-vistas", toast: "Añadida a Películas vistas ✓" };
        default:
          return null;
      }
    }

    function finishNewItemCreation({ key, item }) {
      const destination = newItemDestination(key);
      if (!destination || !item?.id) return;

      if (typeof LibraryTargetNavigation !== "undefined") {
        LibraryTargetNavigation.open({
          key,
          screenName: destination.screenName,
          itemId: item.id
        });
      } else if (typeof showScreen === "function") {
        showScreen(destination.screenName);
      }

      if (typeof showToast === "function") showToast(destination.toast);
    }


    function savePendiente({ form, key, msgEl }) {
      setMsg(msgEl, "", "");
      const data = new FormData(form);
  
      const title = (data.get("title") || "").toString().trim();
      const genre = typeof GenreNormalizer !== "undefined"
        ? GenreNormalizer.normalize(data.get("genre"))
        : (data.get("genre") || "").toString().trim();
      const duration = (data.get("duration") || "").toString().trim();
      const synopsis = (data.get("synopsis") || data.get("notes") || "").toString().trim();
      const tmdbMetadata = readTMDbMetadata(data);
      const personalMetadata = readPersonalMetadata(data);
  
      // ✅ nuevos campos (solo existen en series)
      const seasons = (data.get("seasons") || "").toString().trim();
      const episodes = (data.get("episodes") || "").toString().trim();
  
      if (!title) {
        setMsg(msgEl, "El título es obligatorio.", "error");
        const inputTitle = form.querySelector('input[name="title"]');
        if (inputTitle) inputTitle.focus();
        return;
      }
  
      if (
        form.querySelector('[name="currentSeason"]') &&
        typeof SeasonEpisodeSelectors !== "undefined"
      ) {
        const progressValidation = SeasonEpisodeSelectors.validateForm(form);
        if (!progressValidation.valid) {
          setMsg(msgEl, progressValidation.message, "error");
          progressValidation.field?.focus();
          return;
        }
      }

      const arr = loadArray(key);
  
      // ✅ MODO EDICIÓN: actualiza
      const editId = form.dataset.editId;
      if (editId) {
        const updated = arr.map((x) => {
          if (x.id !== editId) return x;
      
          // Guardar seasons/episodes solo si ese form los tiene
          const hasSE = !!form.querySelector('input[name="seasons"]');
      
          return {
            ...x,
            title,
            genre,
            duration,
            synopsis,
            ...(hasSE ? {
              seasons, episodes,
              currentSeason: personalMetadata.currentSeason,
              currentEpisode: personalMetadata.currentEpisode,
              episodesPerSeason: personalMetadata.episodesPerSeason,
              episodesBySeason: personalMetadata.episodesBySeason
            } : {}),
            ...tmdbMetadata,
            ...personalMetadata,
            updatedAt: Date.now(),
          };
        });
    
        saveArray(key, updated);
    
        form.reset();
        setMsg(msgEl, "Actualizado ✓", "ok");
    
        const returnScreen =
          form.dataset.returnScreen ||
          (form.dataset.editKind === "series" ? "series-pendientes" : "peliculas-pendientes");
    
        clearEditModeIfAny();
        showToast("Actualizado ✓");
        setTimeout(() => showScreen(returnScreen), 900);
        return;
      }
  
      // ✅ ALTA NUEVA: aquí es donde te faltaba el 2.A
      const duplicate = duplicateLocationForKey(key, tmdbMetadata.tmdbId);
      if (duplicate) {
        setMsg(msgEl, duplicateMessageForNewItem(key, duplicate), "error");
        return;
      }

      const hasSE = !!form.querySelector('input[name="seasons"]');
  
      const item = {
        id: newId(),
        title,
        genre,
        duration,
        synopsis,
        ...(hasSE ? {
          seasons, episodes,
          currentSeason: personalMetadata.currentSeason,
          currentEpisode: personalMetadata.currentEpisode,
          episodesPerSeason: personalMetadata.episodesPerSeason,
          episodesBySeason: personalMetadata.episodesBySeason
        } : {}),
        ...tmdbMetadata,
        ...personalMetadata,
        createdAt: Date.now(),
      };
  
      arr.push(item);
      saveArray(key, arr);

      const externalPreviewAdd = form.dataset.externalPreviewAdd === "1";
      const addedTmdbId = tmdbMetadata.tmdbId;
      const addedTmdbType = tmdbMetadata.tmdbType;

  
      form.reset();
      setMsg(msgEl, "Guardado ✓", "ok");
    
      if (externalPreviewAdd) {
        document.dispatchEvent(new CustomEvent("library:pending-added", {
          detail: {
            tmdbId: addedTmdbId,
            tmdbType: addedTmdbType,
            key,
            itemId: item.id,
            title: item.title
          }
        }));
      } else {
        finishNewItemCreation({ key, item });
      }
    }
    
    
    function raterFormState(form, id) {
      const suffix = id === "adri" ? "Adri" : "Laura";
      const ratingField = form.querySelector(`[name="rating${suffix}"]`);
      const notesField = form.querySelector(`[name="notes${suffix}"]`);
      const unseen = form.querySelector(`[data-rater-unseen="${id}"]`);
      const watched = !Boolean(unseen?.checked);
      const raw = (ratingField?.value || "").toString().trim();
      const parsed = raw === "" ? "" : Number(raw);
      return { watched, rating: watched && Number.isFinite(parsed) ? parsed : "", notes: (notesField?.value || "").trim() };
    }
    function syncRaterFormUI(form, id) {
      const suffix = id === "adri" ? "Adri" : "Laura";
      const unseen = form.querySelector(`[data-rater-unseen="${id}"]`);
      const ratingField = form.querySelector(`[name="rating${suffix}"]`);
      const notesField = form.querySelector(`[name="notes${suffix}"]`);
      const widget = ratingField ? form.querySelector(`[data-target="${ratingField.id}"]`) : null;
      const disabled = Boolean(unseen?.checked);
      if (notesField) notesField.disabled = disabled;
      if (widget) { widget.classList.toggle("raterDisabled", disabled); widget.setAttribute("aria-disabled", disabled ? "true" : "false"); }
      if (disabled && widget && typeof widget._setRating === "function") widget._setRating("");
      else if (disabled && ratingField) ratingField.value = "";
    }
    function resetRaterParticipation(form) {
      if (!form) return;
      form.querySelectorAll("[data-rater-unseen]").forEach(input => {
        input.checked = false;
      });
      ["adri", "laura"].forEach(id => {
        const suffix = id === "adri" ? "Adri" : "Laura";
        const notesField = form.querySelector(`[name="notes${suffix}"]`);
        if (notesField) {
          notesField.disabled = false;
          notesField.value = "";
        }
        const ratingField = form.querySelector(`[name="rating${suffix}"]`);
        const widget = ratingField
          ? form.querySelector(`[data-widget="rating"][data-target="${ratingField.id}"]`)
          : null;
        if (widget) {
          widget.classList.remove("raterDisabled");
          widget.setAttribute("aria-disabled", "false");
          if (typeof widget._setRating === "function") widget._setRating("");
        } else if (ratingField) {
          ratingField.value = "";
        }
      });
    }
    window.resetRaterParticipation = resetRaterParticipation;

    document.addEventListener("change", e => {
      const input=e.target.closest("[data-rater-unseen]"); if (!input) return;
      const form=input.closest("form"); if (form) syncRaterFormUI(form,input.dataset.raterUnseen);
    });

    function saveVista({ form, key, msgEl }) {
      setMsg(msgEl, "", "");
      const data = new FormData(form);
  
      const title = (data.get("title") || "").toString().trim();
      const genre = typeof GenreNormalizer !== "undefined"
        ? GenreNormalizer.normalize(data.get("genre"))
        : (data.get("genre") || "").toString().trim();
      const duration = (data.get("duration") || "").toString().trim();
      const synopsis = (data.get("synopsis") || "").toString().trim();
      const tmdbMetadata = readTMDbMetadata(data);
      const personalMetadata = readPersonalMetadata(data);
  
      const seasons = (data.get("seasons") || "").toString().trim();
      const episodes = (data.get("episodes") || "").toString().trim();
  
      const adriState = raterFormState(form, "adri");
      const lauraState = raterFormState(form, "laura");
      const ratingAdri = adriState.rating;
      const ratingLaura = lauraState.rating;
      const notesAdri = adriState.notes;
      const notesLaura = lauraState.notes;
      const raters = { adri: adriState, laura: lauraState };
  
      if (!title) {
        setMsg(msgEl, "El título es obligatorio.", "error");
        const inputTitle = form.querySelector('input[name="title"]');
        if (inputTitle) inputTitle.focus();
        return;
      }
      if (!adriState.watched && !lauraState.watched) {
        setMsg(
          msgEl,
          `Al menos ${getRaterDisplayName("adri")} o ${getRaterDisplayName("laura")} debe haber visto el título.`,
          "error"
        );
        return;
      }
  
      if (
        form.querySelector('[name="currentSeason"]') &&
        typeof SeasonEpisodeSelectors !== "undefined"
      ) {
        const progressValidation = SeasonEpisodeSelectors.validateForm(form);
        if (!progressValidation.valid) {
          setMsg(msgEl, progressValidation.message, "error");
          progressValidation.field?.focus();
          return;
        }
      }

      if (
        (ratingAdri !== "" && !Number.isFinite(ratingAdri)) ||
        (ratingLaura !== "" && !Number.isFinite(ratingLaura))
      ) {
        setMsg(msgEl, "Las valoraciones no son válidas.", "error");
        return;
      }
  
      const hasSE = !!form.querySelector('input[name="seasons"]');
      const arr = loadArray(key);
  
      // ✅ MODO EDICIÓN (Editar = corregir el ÚLTIMO visionado)
      const editId = form.dataset.editId;
      if (editId) {
        const updated = arr.map(x => {
          if (x.id !== editId) return x;
      
          const base = ensureWatchLog(x);
      
          let nextLog = Array.isArray(base.watchLog) ? [...base.watchLog] : [];
          if (nextLog.length === 0) {
            nextLog = [makeWatchEntry({ ratingAdri, ratingLaura, notesAdri, notesLaura, raters, at: base.watchedAt || Date.now() })];
          } else {
            nextLog[nextLog.length - 1] = makeWatchEntry({
              ...nextLog[nextLog.length - 1], ratingAdri, ratingLaura, notesAdri, notesLaura, raters,
              at: nextLog[nextLog.length - 1].at
            });
          }
      
          return {
            ...base,
            title,
            genre,
            duration,
            synopsis,
            ...(hasSE ? {
              seasons, episodes,
              currentSeason: personalMetadata.currentSeason,
              currentEpisode: personalMetadata.currentEpisode,
              episodesPerSeason: personalMetadata.episodesPerSeason,
              episodesBySeason: personalMetadata.episodesBySeason
            } : {}),
            ...tmdbMetadata,
            ...personalMetadata,
            ratingAdri: nextLog[nextLog.length - 1].ratingAdri,
            ratingLaura: nextLog[nextLog.length - 1].ratingLaura,
            notesAdri: nextLog[nextLog.length - 1].notesAdri,
            notesLaura: nextLog[nextLog.length - 1].notesLaura,
            raters: nextLog[nextLog.length - 1].raters,
            watchLog: nextLog,
            updatedAt: Date.now(),
          };
        });
    
        saveArray(key, updated);
    
        form.reset();
        resetRatingsInside(form);
        resetRaterParticipation(form);
        setMsg(msgEl, "Actualizado ✓", "ok");
    
        const returnScreen =
          form.dataset.returnScreen ||
          (form.dataset.editKind === "series" ? "series-vistas" : "peliculas-vistas");
    
        clearEditModeIfAny();
        showToast("Actualizado ✓");
        setTimeout(() => showScreen(returnScreen), 900);
        return;
      }
  
      // ✅ ALTA NUEVA (crear primera entrada de historial)
      const duplicate = duplicateLocationForKey(key, tmdbMetadata.tmdbId);
      if (duplicate) {
        setMsg(msgEl, duplicateMessageForNewItem(key, duplicate), "error");
        return;
      }

      const entry = makeWatchEntry({ ratingAdri, ratingLaura, notesAdri, notesLaura, raters, at: Date.now() });
  
      const item = {
        id: newId(),
        title,
        genre,
        duration,
        synopsis,
        ...(hasSE ? {
          seasons, episodes,
          currentSeason: personalMetadata.currentSeason,
          currentEpisode: personalMetadata.currentEpisode,
          episodesPerSeason: personalMetadata.episodesPerSeason,
          episodesBySeason: personalMetadata.episodesBySeason
        } : {}),
        ...tmdbMetadata,
        ...personalMetadata,
        ratingAdri: entry.ratingAdri,
        ratingLaura: entry.ratingLaura,
        notesAdri: entry.notesAdri,
        notesLaura: entry.notesLaura,
        raters: entry.raters,
        watchedAt: entry.at,
        watchLog: [entry],
        createdAt: Date.now(),
      };
  
      arr.push(item);
      saveArray(key, arr);
  
      form.reset();
      resetRatingsInside(form);
      resetRaterParticipation(form);
      setMsg(msgEl, "Guardado ✓", "ok");
      finishNewItemCreation({ key, item });
    }
    
    
    
    // ---------- Wire forms ----------
    const formSP = document.getElementById("form-series-pendientes");
    const formPP = document.getElementById("form-peliculas-pendientes");
    const formSV = document.getElementById("form-series-vistas");
    const formPV = document.getElementById("form-peliculas-vistas");

    formSP.addEventListener("submit", (e)=>{ e.preventDefault(); savePendiente({form:formSP, key:KEY.seriesPendientes, msgEl:document.getElementById("msg-sp")}); });
    formPP.addEventListener("submit", (e)=>{ e.preventDefault(); savePendiente({form:formPP, key:KEY.peliculasPendientes, msgEl:document.getElementById("msg-pp")}); });

    formSV.addEventListener("submit", (e)=>{ e.preventDefault(); saveVista({form:formSV, key:KEY.seriesVistas, msgEl:document.getElementById("msg-sv")}); });
    formPV.addEventListener("submit", (e)=>{ e.preventDefault(); saveVista({form:formPV, key:KEY.peliculasVistas, msgEl:document.getElementById("msg-pv")}); });

    migrateWatchLog();

    // Render inicial de contadores/listas (por si hay datos previos)
    renderPendientes("series");
    renderPendientes("peliculas");
    renderVistas("series");
    renderVistas("peliculas");
    
    
    // Si sales de una edición con "Volver", conserva primero el destino de la
    // biblioteca. clearEditModeIfAny() restaura después el destino normal del
    // formulario de alta, por lo que navegar tras limpiarlo enviaría a Añadir.
    function wireEditBackButton(button) {
      if (!button) return;

      button.addEventListener("click", event => {
        if (!button.dataset.prevScreen) return;

        const returnScreen = button.dataset.screen;
        event.preventDefault();
        event.stopImmediatePropagation();

        clearEditModeIfAny();
        showScreen(returnScreen);
      });
    }

    wireEditBackButton(document.querySelector('.screen[data-screen="anadir-series-pendientes"] .backBtn'));
    wireEditBackButton(document.querySelector('.screen[data-screen="anadir-peliculas-pendientes"] .backBtn'));
    wireEditBackButton(document.querySelector('.screen[data-screen="anadir-series-vistas"] .backBtn'));
    wireEditBackButton(document.querySelector('.screen[data-screen="anadir-peliculas-vistas"] .backBtn'));
  
  
tabs.forEach(t => t.addEventListener("click", () => setMainTab(t.dataset.main)));
