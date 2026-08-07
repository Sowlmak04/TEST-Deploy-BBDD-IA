// ---------- Interfaz TMDb ----------
function initTMDbIntegration() {
  const tokenInput = document.getElementById("tmdb-token");
  const statusEl = document.getElementById("tmdb-status");
  const saveBtn = document.getElementById("btnTmdbSave");
  const testBtn = document.getElementById("btnTmdbTest");
  const clearBtn = document.getElementById("btnTmdbClear");

  function setStatus(message, type = "") {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `msg ${type}`.trim();
  }

  function paintTokenState() {
    if (!tokenInput) return;

    const hasToken = TMDbClient.hasToken();
    tokenInput.value = "";

    if (hasToken) {
      tokenInput.placeholder =
        "Token guardado. Escribe otro para sustituirlo.";
      setStatus("Token guardado en este dispositivo.", "ok");
    } else {
      tokenInput.placeholder = "Pega aquí el API Read Access Token";
      setStatus("Todavía no hay ningún token guardado.", "");
    }
  }

  saveBtn?.addEventListener("click", () => {
    const token = (tokenInput?.value || "").trim();

    if (!token) {
      setStatus("Escribe un token antes de guardarlo.", "error");
      tokenInput?.focus();
      return;
    }

    TMDbClient.setToken(token);
    paintTokenState();
  });

  testBtn?.addEventListener("click", async () => {
    setStatus("Comprobando conexión…");

    try {
      await TMDbClient.testConnection();
      setStatus("Conexión con TMDb correcta ✓", "ok");
    } catch (error) {
      if (error.message === "TMDB_TOKEN_MISSING") {
        setStatus("Primero debes guardar el token.", "error");
      } else if (error.message === "TMDB_TOKEN_INVALID") {
        setStatus("El token no es válido o no tiene acceso.", "error");
      } else {
        setStatus(
          "No se ha podido conectar. Comprueba Internet y vuelve a intentarlo.",
          "error"
        );
      }
    }
  });

  clearBtn?.addEventListener("click", () => {
    TMDbClient.clearToken();
    paintTokenState();
  });

  paintTokenState();

  document.querySelectorAll("[data-tmdb-search]").forEach(block => {
    initTMDbSearchBlock(block);
  });
}

function initTMDbSearchBlock(block) {
  const form = block.closest("form");
  const kind = block.dataset.tmdbKind;
  const input = block.querySelector("[data-tmdb-query]");
  const button = block.querySelector("[data-tmdb-submit]");
  const message = block.querySelector("[data-tmdb-message]");
  const results = block.querySelector("[data-tmdb-results]");

  if (!form || !kind || !input || !button || !results) return;

  function setMessage(text, type = "") {
    if (!message) return;
    message.textContent = text;
    message.className = `tmdbSearchMessage ${type}`.trim();
  }

  function clearResults() {
    results.innerHTML = "";
    results.hidden = true;
  }

  async function executeSearch() {
    const query = input.value.trim();
    clearResults();

    if (!query) {
      setMessage("Escribe un título para buscar.", "error");
      input.focus();
      return;
    }

    if (!TMDbClient.hasToken()) {
      setMessage(
        "Configura primero el token desde Añadir → Mantenimiento → Configurar TMDb.",
        "error"
      );
      return;
    }

    button.disabled = true;
    setMessage("Buscando en TMDb…");

    try {
      const items = await TMDbClient.search(query, kind);

      if (!items.length) {
        setMessage("No se han encontrado resultados.");
        return;
      }

      setMessage(`${items.length} resultado${items.length === 1 ? "" : "s"}.`);

      const urls = await Promise.all(
        items.map(item => TMDbClient.posterUrl(item.posterPath))
      );

      results.innerHTML = items.map((item, index) => {
        const poster = urls[index];
        const title = escapeHtml(item.title || "Sin título");
        const original =
          item.originalTitle &&
          item.originalTitle !== item.title
            ? `<div class="tmdbResultOriginal">${escapeHtml(item.originalTitle)}</div>`
            : "";

        return `
          <button
            class="tmdbResult"
            type="button"
            data-tmdb-result-id="${escapeHtml(item.id)}"
          >
            ${
              poster
                ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy">`
                : `<div class="tmdbPosterFallback">Sin imagen</div>`
            }
            <span class="tmdbResultText">
              <strong>${title}</strong>
              ${original}
              <small>${escapeHtml(item.year || "Año desconocido")}</small>
            </span>
          </button>
        `;
      }).join("");

      results.hidden = false;
    } catch (error) {
      if (error.message === "TMDB_TOKEN_INVALID") {
        setMessage(
          "El token no es válido. Revísalo en Configuración TMDb.",
          "error"
        );
      } else {
        setMessage(
          "No se pudo completar la búsqueda. Comprueba la conexión.",
          "error"
        );
      }
    } finally {
      button.disabled = false;
    }
  }

  button.addEventListener("click", executeSearch);

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      executeSearch();
    }
  });

  results.addEventListener("click", async event => {
    const selected = event.target.closest("[data-tmdb-result-id]");
    if (!selected) return;

    const id = selected.dataset.tmdbResultId;
    results.querySelectorAll("button").forEach(item => {
      item.disabled = true;
    });

    setMessage("Cargando ficha completa, tráiler y disponibilidad…");

    try {
      const details = await TMDbClient.details(id, kind);
      let availability = null;
      let availabilityError = null;

      try {
        availability = await TMDbClient.watchProviders(id, kind);
      } catch (error) {
        availabilityError = error;
        console.warn("No se pudo precargar la disponibilidad de TMDb.", error);
      }

      fillFormFromTMDb(form, {
        ...details,
        watchRegion: "ES",
        watchProviders: [],
        watchProvidersLink: "",
        watchProvidersUpdatedAt: "",
        ...(availability || {})
      });
      clearResults();
      setMessage(
        availabilityError
          ? "Ficha completa cargada. La disponibilidad no pudo consultarse y podrás actualizarla después."
          : "Ficha completa, tráiler y disponibilidad cargados. Puedes revisarlos antes de guardar.",
        availabilityError ? "" : "ok"
      );
    } catch {
      setMessage(
        "No se pudo cargar la ficha seleccionada.",
        "error"
      );

      results.querySelectorAll("button").forEach(item => {
        item.disabled = false;
      });
    }
  });
}

function resetTMDbFormState(form) {
  if (!form) return;

  const metadataNames = [
    "tmdbId", "tmdbType", "year", "posterPath", "posterUrl",
    "originalTitle", "originalLanguage", "originCountries",
    "spokenLanguages", "productionCompanies", "productionStatus",
    "tmdbVoteAverage", "tmdbUpdatedAt", "seasonsData", "specialsData",
    "tmdbStatus", "tmdbSeasonsUpdatedAt", "backdropPath", "tagline",
    "releaseDate", "lastAirDate", "adult", "inProduction", "cast", "crew",
    "creators", "trailer", "watchRegion", "watchProviders", "watchProvidersLink",
    "watchProvidersUpdatedAt"
  ];

  metadataNames.forEach(name => {
    const field = form.elements.namedItem(name);
    if (!field) return;
    field.value = [
      "originCountries", "spokenLanguages", "productionCompanies",
      "seasonsData", "specialsData", "cast", "crew", "creators",
      "watchProviders"
    ].includes(name) ? "[]" : "";
  });

  form.querySelectorAll("[data-tmdb-search]").forEach(block => {
    const query = block.querySelector("[data-tmdb-query]");
    const message = block.querySelector("[data-tmdb-message]");
    const results = block.querySelector("[data-tmdb-results]");
    if (query) query.value = "";
    if (message) {
      message.textContent = "";
      message.className = "tmdbSearchMessage";
    }
    if (results) {
      results.innerHTML = "";
      results.hidden = true;
    }
  });

  form.querySelectorAll("[data-tmdb-seasons-summary]").forEach(summary => {
    summary.textContent = "";
    summary.hidden = true;
  });
}

function fillFormFromTMDb(form, details) {
  const values = {
    title: details.title,
    genre: details.genre,
    duration: details.duration,
    synopsis: details.synopsis,
    seasons: details.seasons,
    episodes: details.episodes,
    episodesBySeason: Array.isArray(details.episodesBySeason)
      ? details.episodesBySeason.join(", ")
      : "",
    seasonsData: JSON.stringify(details.seasonsData || []),
    specialsData: JSON.stringify(details.specialsData || []),
    tmdbStatus: details.tmdbStatus || "",
    tmdbSeasonsUpdatedAt: details.tmdbSeasonsUpdatedAt || "",
    tmdbId: details.tmdbId,
    tmdbType: details.tmdbType,
    year: details.year,
    posterPath: details.posterPath,
    posterUrl: details.posterUrl,
    backdropPath: details.backdropPath || "",
    originalTitle: details.originalTitle,
    originalLanguage: details.originalLanguage,
    originCountries: JSON.stringify(details.originCountries || []),
    spokenLanguages: JSON.stringify(details.spokenLanguages || []),
    productionCompanies: JSON.stringify(details.productionCompanies || []),
    productionStatus: details.productionStatus || "",
    tagline: details.tagline || "",
    releaseDate: details.releaseDate || "",
    lastAirDate: details.lastAirDate || "",
    adult: details.adult ? "1" : "",
    inProduction: details.inProduction === null || details.inProduction === undefined
      ? ""
      : details.inProduction ? "1" : "0",
    cast: JSON.stringify(details.cast || []),
    crew: JSON.stringify(details.crew || []),
    creators: JSON.stringify(details.creators || []),
    trailer: JSON.stringify(details.trailer || null),
    watchRegion: details.watchRegion || "ES",
    watchProviders: JSON.stringify(details.watchProviders || []),
    watchProvidersLink: details.watchProvidersLink || "",
    watchProvidersUpdatedAt: details.watchProvidersUpdatedAt || "",
    tmdbVoteAverage: details.tmdbVoteAverage,
    tmdbUpdatedAt: details.tmdbUpdatedAt
  };

  Object.entries(values).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (!field || value === undefined || value === null) return;
    field.value = String(value);
  });

  const syncSummary = form.querySelector("[data-tmdb-seasons-summary]");

  if (syncSummary && details.tmdbType === "tv") {
    const mainCount = Array.isArray(details.seasonsData)
      ? details.seasonsData.length
      : 0;
    const specialCount = Array.isArray(details.specialsData)
      ? details.specialsData.reduce(
          (sum, season) => sum + (Number(season.episodeCount) || 0),
          0
        )
      : 0;

    syncSummary.hidden = false;
    syncSummary.textContent = [
      `${mainCount} temporada${mainCount === 1 ? "" : "s"} principal${mainCount === 1 ? "" : "es"}`,
      `${details.episodes || 0} capítulos`,
      specialCount ? `${specialCount} especiales excluidos` : "",
      details.tmdbStatus || ""
    ].filter(Boolean).join(" · ");
  }

  if (typeof SeasonEpisodeSelectors !== "undefined") {
    SeasonEpisodeSelectors.refreshForm(form, {
      currentSeason: form.elements.namedItem("currentSeason")?.value || "",
      currentEpisode: form.elements.namedItem("currentEpisode")?.value || ""
    });
  }

  const titleField = form.elements.namedItem("title");
  titleField?.focus();
}
