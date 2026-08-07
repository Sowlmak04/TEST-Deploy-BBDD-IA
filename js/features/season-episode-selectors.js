const SeasonEpisodeSelectors = (() => {
  "use strict";

  const FORM_SELECTOR = 'form:has([name="currentSeason"]):has([name="currentEpisode"])';

  function toPositiveInt(value) {
    const number = Number.parseInt(String(value ?? "").trim(), 10);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function parseJsonArray(value) {
    try {
      const parsed = JSON.parse(String(value || "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function parseEpisodeDistribution(value) {
    return String(value || "")
      .split(/[,\s;|/]+/)
      .map(toPositiveInt)
      .filter(Boolean);
  }

  function getStructure(form) {
    const seasonsData = parseJsonArray(
      form.elements.namedItem("seasonsData")?.value
    )
      .map(season => ({
        seasonNumber: toPositiveInt(
          season?.seasonNumber ?? season?.season_number
        ),
        episodeCount: toPositiveInt(
          season?.episodeCount ?? season?.episode_count
        )
      }))
      .filter(season => season.seasonNumber > 0)
      .sort((a, b) => a.seasonNumber - b.seasonNumber);

    if (seasonsData.length) {
      return { source: "tmdb", exact: true, seasons: seasonsData };
    }

    const distribution = parseEpisodeDistribution(
      form.elements.namedItem("episodesBySeason")?.value
    );

    if (distribution.length) {
      return {
        source: "distribution",
        exact: true,
        seasons: distribution.map((episodeCount, index) => ({
          seasonNumber: index + 1,
          episodeCount
        }))
      };
    }

    const seasonCount = toPositiveInt(
      form.elements.namedItem("seasons")?.value
    );
    const episodesPerSeason = toPositiveInt(
      form.elements.namedItem("episodesPerSeason")?.value
    );

    if (seasonCount) {
      return {
        source: episodesPerSeason ? "uniform" : "seasons-only",
        exact: Boolean(episodesPerSeason),
        seasons: Array.from({ length: seasonCount }, (_, index) => ({
          seasonNumber: index + 1,
          episodeCount: episodesPerSeason
        }))
      };
    }

    return { source: "none", exact: false, seasons: [] };
  }

  function addOption(select, value, label) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = label;
    select.appendChild(option);
  }

  function setHint(form, structure, selectedSeason = 0) {
    const hint = form.querySelector("[data-season-episode-hint]");
    if (!hint) return;

    if (!structure.seasons.length) {
      hint.textContent =
        "Indica las temporadas y su distribución, o selecciona la serie desde TMDb.";
      hint.dataset.state = "empty";
      return;
    }

    const season = structure.seasons.find(
      item => item.seasonNumber === selectedSeason
    );

    if (!selectedSeason) {
      hint.textContent = structure.exact
        ? "Selecciona una temporada para cargar sus capítulos."
        : "Selecciona una temporada. Falta indicar cuántos capítulos contiene.";
      hint.dataset.state = structure.exact ? "ready" : "warning";
      return;
    }

    if (season?.episodeCount) {
      hint.textContent =
        `Temporada ${selectedSeason}: ${season.episodeCount} capítulo` +
        `${season.episodeCount === 1 ? "" : "s"} disponibles.`;
      hint.dataset.state = "ready";
      return;
    }

    hint.textContent =
      "No se conoce el número de capítulos de esta temporada. Completa la distribución.";
    hint.dataset.state = "warning";
  }

  function populateSeasonSelect(form, preferredValue = "") {
    const select = form.elements.namedItem("currentSeason");
    if (!(select instanceof HTMLSelectElement)) return getStructure(form);

    const structure = getStructure(form);
    const previous = String(preferredValue || select.value || "");
    select.innerHTML = "";
    addOption(select, "", "Sin seleccionar");

    structure.seasons.forEach(season => {
      addOption(select, season.seasonNumber, `Temporada ${season.seasonNumber}`);
    });

    if (
      previous &&
      !structure.seasons.some(
        season => String(season.seasonNumber) === previous
      )
    ) {
      addOption(
        select,
        previous,
        `Temporada ${previous} · fuera de la estructura`
      );
    }

    select.disabled = structure.seasons.length === 0;
    select.value = previous;
    if (!select.value) select.value = "";
    return structure;
  }

  function populateEpisodeSelect(form, preferredValue = "") {
    const seasonSelect = form.elements.namedItem("currentSeason");
    const episodeSelect = form.elements.namedItem("currentEpisode");

    if (
      !(seasonSelect instanceof HTMLSelectElement) ||
      !(episodeSelect instanceof HTMLSelectElement)
    ) return;

    const structure = getStructure(form);
    const seasonNumber = toPositiveInt(seasonSelect.value);
    const previous = String(preferredValue || episodeSelect.value || "");
    const season = structure.seasons.find(
      item => item.seasonNumber === seasonNumber
    );
    const episodeCount = toPositiveInt(season?.episodeCount);

    episodeSelect.innerHTML = "";
    addOption(episodeSelect, "", "Sin seleccionar");

    if (seasonNumber && episodeCount) {
      addOption(episodeSelect, "0", "Sin empezar");
      for (let episode = 1; episode <= episodeCount; episode += 1) {
        addOption(episodeSelect, episode, `Capítulo ${episode}`);
      }
    }

    if (
      previous &&
      previous !== "0" &&
      (!episodeCount || toPositiveInt(previous) > episodeCount)
    ) {
      addOption(
        episodeSelect,
        previous,
        `Capítulo ${previous} · fuera de la estructura`
      );
    }

    episodeSelect.disabled = !seasonNumber || !episodeCount;
    episodeSelect.value = previous;
    if (!episodeSelect.value) episodeSelect.value = "";
    setHint(form, structure, seasonNumber);
  }

  function refreshForm(form, values = {}) {
    if (!form) return;

    const preferredSeason = String(
      values.currentSeason ??
      form.elements.namedItem("currentSeason")?.value ??
      ""
    );
    const preferredEpisode = String(
      values.currentEpisode ??
      form.elements.namedItem("currentEpisode")?.value ??
      ""
    );

    populateSeasonSelect(form, preferredSeason);
    populateEpisodeSelect(form, preferredEpisode);
  }

  function validateForm(form) {
    if (!form) return { valid: true };

    const seasonField = form.elements.namedItem("currentSeason");
    const episodeField = form.elements.namedItem("currentEpisode");

    if (
      !(seasonField instanceof HTMLSelectElement) ||
      !(episodeField instanceof HTMLSelectElement)
    ) {
      return { valid: true };
    }

    const season = toPositiveInt(seasonField.value);
    const episodeRaw = String(episodeField.value || "");
    const episode = Number.parseInt(episodeRaw, 10);
    const hasEpisode = episodeRaw !== "" && Number.isFinite(episode);

    if (!season && hasEpisode) {
      return {
        valid: false,
        message: "Selecciona primero la temporada actual.",
        field: seasonField
      };
    }

    if (season && !hasEpisode) {
      return {
        valid: false,
        message: "Selecciona el capítulo actual o la opción «Sin empezar».",
        field: episodeField
      };
    }

    if (!season && !hasEpisode) return { valid: true };

    const structure = getStructure(form);
    const seasonData = structure.seasons.find(
      item => item.seasonNumber === season
    );

    if (!seasonData) {
      return {
        valid: false,
        message: "La temporada seleccionada no existe en la estructura actual.",
        field: seasonField
      };
    }

    if (!seasonData.episodeCount) {
      return {
        valid: false,
        message:
          "No se conoce el número de capítulos de esa temporada. Completa la distribución antes de guardar.",
        field: episodeField
      };
    }

    if (episode < 0 || episode > seasonData.episodeCount) {
      return {
        valid: false,
        message:
          `La temporada ${season} solo tiene ${seasonData.episodeCount} capítulos.`,
        field: episodeField
      };
    }

    return { valid: true };
  }

  function initForm(form) {
    if (!form || form.dataset.seasonEpisodeReady === "1") return;
    form.dataset.seasonEpisodeReady = "1";

    const seasonField = form.elements.namedItem("currentSeason");
    const episodeField = form.elements.namedItem("currentEpisode");
    if (
      !(seasonField instanceof HTMLSelectElement) ||
      !(episodeField instanceof HTMLSelectElement)
    ) return;

    seasonField.addEventListener("change", () => {
      populateEpisodeSelect(form, "");
    });

    ["seasons", "episodesPerSeason", "episodesBySeason", "seasonsData"]
      .forEach(name => {
        const field = form.elements.namedItem(name);
        if (!field) return;
        field.addEventListener("input", () => refreshForm(form));
        field.addEventListener("change", () => refreshForm(form));
      });

    form.addEventListener("reset", () => {
      setTimeout(() => refreshForm(form, {
        currentSeason: "",
        currentEpisode: ""
      }), 0);
    });

    form.addEventListener("season-episode-refresh", event => {
      refreshForm(form, event.detail || {});
    });

    refreshForm(form);
  }

  function initAll() {
    document.querySelectorAll(FORM_SELECTOR).forEach(initForm);
  }

  document.addEventListener("DOMContentLoaded", initAll);

  return { getStructure, refreshForm, validateForm, initAll };
})();
