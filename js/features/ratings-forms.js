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
      const targetId = container.dataset.target;
      const outId = container.dataset.out;

      const hidden = document.getElementById(targetId);
      const out = document.getElementById(outId);

      let value = 0; // 0 means none selected

      function render(){
        container.innerHTML = "";
        for(let i=1;i<=10;i++){
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "starBtn";
          btn.setAttribute("aria-label", `Estrella ${i}`);

          // Determine fill for this star: full, half, empty
          const starVal = i;         // full threshold
          const halfVal = i - 0.5;   // half threshold

          if(value >= starVal){
            btn.appendChild(createStarSVG({fillClass:"starFillFull"}));
          }else if(value >= halfVal){
            // half fill: clip to 12px (half of 24)
            const clipId = `${targetId}_clip_${i}_${Math.random().toString(36).slice(2,7)}`;
            btn.appendChild(createStarSVG({fillClass:"starFillHalf", clip:{id:clipId, width:"12"}}));
          }else{
            btn.appendChild(createStarSVG());
          }

          // click: left half => i-0.5, right half => i
          btn.addEventListener("click", (e)=>{
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const half = x < rect.width/2 ? 0.5 : 1.0;
            value = (i - 1) + half; // because i is 1..10
            value = Math.round(value * 2) / 2;

            hidden.value = String(value);
            out.textContent = `${value}`;
            render();
          });

          container.appendChild(btn);
        }

        if (!hidden.value) {
          out.textContent = "—";
        } else {
          out.textContent = `${hidden.value}`;
        }
      }

      function reset(){
        value = 0;
        hidden.value = "";
        out.textContent = "—";
        render();
      }
      
      function set(val) {
        const n = Number(val);
        if (!Number.isFinite(n) || n <= 0) {
          value = 0;
          hidden.value = "";
          out.textContent = "—";
          render();
          return;
        }
        value = Math.round(n * 2) / 2;
        hidden.value = String(value);
        out.textContent = `${value}`;
        render();
      }

      container._setRating = set;

      // first render
      render();
      container._resetRating = reset;
    }

    // Crear widgets para todos los ratings
    document.querySelectorAll('[data-widget="rating"]').forEach(initRatingWidget);

    function resetRatingsInside(form){
      form.querySelectorAll('[data-widget="rating"]').forEach(w => {
        if(typeof w._resetRating === "function") w._resetRating();
      });
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
  
      form.reset();
      setMsg(msgEl, "Guardado ✓", "ok");
    }
    
    
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
  
      const ratingAdriRaw = (data.get("ratingAdri") || "").toString().trim();
      const ratingLauraRaw = (data.get("ratingLaura") || "").toString().trim();
  
      const notesAdri = (data.get("notesAdri") || "").toString().trim();
      const notesLaura = (data.get("notesLaura") || "").toString().trim();
  
      if (!title) {
        setMsg(msgEl, "El título es obligatorio.", "error");
        const inputTitle = form.querySelector('input[name="title"]');
        if (inputTitle) inputTitle.focus();
        return;
      }
      if (!ratingAdriRaw) {
        setMsg(msgEl, "La valoración de Adri es obligatoria.", "error");
        return;
      }
      if (!ratingLauraRaw) {
        setMsg(msgEl, "La valoración de Laura es obligatoria.", "error");
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

      const ratingAdri = Number(ratingAdriRaw);
      const ratingLaura = Number(ratingLauraRaw);
  
      if (!Number.isFinite(ratingAdri) || !Number.isFinite(ratingLaura)) {
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
            nextLog = [makeWatchEntry({ ratingAdri, ratingLaura, notesAdri, notesLaura, at: base.watchedAt || Date.now() })];
          } else {
            nextLog[nextLog.length - 1] = {
              ...nextLog[nextLog.length - 1],
              ratingAdri,
              ratingLaura,
              notesAdri,
              notesLaura
            };
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
            ratingAdri,
            ratingLaura,
            notesAdri,
            notesLaura,
            watchLog: nextLog,
            updatedAt: Date.now(),
          };
        });
    
        saveArray(key, updated);
    
        form.reset();
        resetRatingsInside(form);
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
      const entry = makeWatchEntry({ ratingAdri, ratingLaura, notesAdri, notesLaura, at: Date.now() });
  
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
        watchedAt: entry.at,
        watchLog: [entry],
        createdAt: Date.now(),
      };
  
      arr.push(item);
      saveArray(key, arr);
  
      form.reset();
      resetRatingsInside(form);
      setMsg(msgEl, "Guardado ✓", "ok");
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
