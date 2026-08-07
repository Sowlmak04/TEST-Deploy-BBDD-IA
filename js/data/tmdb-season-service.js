// ---------- Sincronización de temporadas TMDb ----------
const TMDbSeasonService = (() => {
  function isSeriesLinked(item) {
    return Boolean(
      item &&
      Number(item.tmdbId) > 0 &&
      (item.tmdbType === "tv" || item.kind === "series")
    );
  }

  function structurePatch(details) {
    const seasonsData = Array.isArray(details?.seasonsData)
      ? details.seasonsData
      : [];

    const specialsData = Array.isArray(details?.specialsData)
      ? details.specialsData
      : [];

    return {
      seasons: details?.seasons || String(seasonsData.length || ""),
      episodes: details?.episodes || "",
      episodesBySeason: Array.isArray(details?.episodesBySeason)
        ? details.episodesBySeason
        : seasonsData.map(season => String(season.episodeCount || 0)),
      seasonsData,
      specialsData,
      tmdbStatus: String(details?.tmdbStatus || "").trim(),
      tmdbSeasonsUpdatedAt:
        Number(details?.tmdbSeasonsUpdatedAt) || Date.now(),
      tmdbUpdatedAt: Number(details?.tmdbUpdatedAt) || Date.now()
    };
  }

  async function fetchStructure(tmdbId) {
    const details = await TMDbClient.details(tmdbId, "series");
    return {
      details,
      patch: structurePatch(details)
    };
  }

  async function syncItem(key, id) {
    const item = LibraryService.getById(key, id);

    if (!item) {
      throw new Error("SERIES_ITEM_NOT_FOUND");
    }

    if (!isSeriesLinked(item)) {
      throw new Error("SERIES_TMDB_NOT_LINKED");
    }

    const { details, patch } = await fetchStructure(item.tmdbId);

    const updated = LibraryService.update(key, id, current => ({
      ...current,
      ...patch,
      // Se conservan expresamente los datos personales y el progreso.
      currentSeason: current.currentSeason,
      currentEpisode: current.currentEpisode,
      lastProgressAt: current.lastProgressAt,
      progressLog: current.progressLog,
      favorite: current.favorite,
      priority: current.priority,
      tags: current.tags,
      privateNote: current.privateNote,
      plannedDate: current.plannedDate,
      ratingAdri: current.ratingAdri,
      ratingLaura: current.ratingLaura,
      notesAdri: current.notesAdri,
      notesLaura: current.notesLaura,
      watchLog: current.watchLog,
      updatedAt: Date.now()
    }));

    return { item: updated, details };
  }

  function formatUpdatedAt(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return "";

    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(timestamp));
  }

  return Object.freeze({
    isSeriesLinked,
    structurePatch,
    fetchStructure,
    syncItem,
    formatUpdatedAt
  });
})();
