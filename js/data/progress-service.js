// ---------- Servicio de progreso de series ----------
const SeriesProgressService = (() => {
  function toInt(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : fallback;
  }

  function normalizeLog(log) {
    return (Array.isArray(log) ? log : [])
      .map(entry => ({
        at: Number(entry?.at) || Date.now(),
        season: toInt(entry?.season),
        episode: toInt(entry?.episode),
        action: String(entry?.action || "actualizado")
      }))
      .filter(entry => entry.season > 0 || entry.episode > 0);
  }

  function parseEpisodesBySeason(value) {
    if (Array.isArray(value)) return value.map(entry => toInt(entry, 0));
    const text = String(value || "").trim();
    if (!text) return [];
    return text.split(/[,\s;|/]+/).map(entry => toInt(entry, 0));
  }

  function resolveSeasonLengths(item) {
    const seasons = toInt(item?.seasons, 0);
    const detailed = parseEpisodesBySeason(item?.episodesBySeason);
    const uniform = toInt(item?.episodesPerSeason, 0);
    if (detailed.some(value => value > 0)) {
      const length = Math.max(seasons, detailed.length);
      return Array.from({ length }, (_, index) => detailed[index] || 0);
    }
    if (uniform > 0 && seasons > 0) return Array.from({ length: seasons }, () => uniform);
    return [];
  }

  function snapshot(item) {
    const season = Math.max(1, toInt(item?.currentSeason, 1));
    const episode = toInt(item?.currentEpisode, 0);
    const seasons = toInt(item?.seasons, 0);
    const declaredTotalEpisodes = toInt(item?.episodes, 0);
    const episodesPerSeason = toInt(item?.episodesPerSeason, 0);
    const seasonLengths = resolveSeasonLengths(item);

    const knownPreviousSeasons = seasonLengths.length >= season - 1 &&
      seasonLengths.slice(0, season - 1).every(value => value > 0);

    let watchedEpisodes = episode;
    if (knownPreviousSeasons) {
      watchedEpisodes = seasonLengths.slice(0, season - 1).reduce((sum, value) => sum + value, 0) + episode;
    } else if (episodesPerSeason > 0) {
      watchedEpisodes = ((season - 1) * episodesPerSeason) + episode;
    }

    const detailedTotal = seasonLengths.length > 0 && seasonLengths.every(value => value > 0)
      ? seasonLengths.reduce((sum, value) => sum + value, 0)
      : 0;
    const estimatedUniformTotal = !declaredTotalEpisodes && episodesPerSeason > 0 && seasons > 0
      ? episodesPerSeason * seasons
      : 0;
    const effectiveTotalEpisodes = detailedTotal || declaredTotalEpisodes || estimatedUniformTotal;
    const canCalculatePercentage = effectiveTotalEpisodes > 0 &&
      (season === 1 || knownPreviousSeasons || episodesPerSeason > 0);
    const percentage = canCalculatePercentage
      ? Math.min(100, Math.max(0, Math.round((watchedEpisodes / effectiveTotalEpisodes) * 100)))
      : null;

    const currentSeasonLength = seasonLengths[season - 1] || episodesPerSeason || 0;
    const previousSeasonLength = season > 1 ? seasonLengths[season - 2] || episodesPerSeason || 0 : 0;

    return {
      season, episode, seasons,
      totalEpisodes: declaredTotalEpisodes,
      effectiveTotalEpisodes,
      episodesPerSeason,
      episodesBySeason: seasonLengths,
      currentSeasonLength,
      previousSeasonLength,
      watchedEpisodes,
      percentage,
      lastProgressAt: Number(item?.lastProgressAt) || null,
      progressLog: normalizeLog(item?.progressLog)
    };
  }

  function change(id, direction) {
    const key = KEY.seriesPendientes;
    const current = LibraryService.getById(key, id);
    if (!current) return null;

    const progress = snapshot(current);
    let season = progress.season;
    let episode = progress.episode;
    let action = direction === "back" ? "retroceso" : "avance";

    if (direction === "back") {
      if (episode > 1) {
        episode -= 1;
      } else if (season > 1 && progress.previousSeasonLength > 0) {
        season -= 1;
        episode = progress.previousSeasonLength;
      } else {
        episode = Math.max(0, episode - 1);
      }
    } else if (
      progress.currentSeasonLength > 0 &&
      episode >= progress.currentSeasonLength &&
      (!progress.seasons || season < progress.seasons)
    ) {
      season += 1;
      episode = 1;
      action = "nueva temporada";
    } else {
      episode += 1;
    }

    if (
      progress.seasons > 0 &&
      progress.currentSeasonLength > 0 &&
      season >= progress.seasons &&
      episode > progress.currentSeasonLength
    ) {
      episode = progress.currentSeasonLength;
    }

    const at = Date.now();
    return LibraryService.update(key, id, item => ({
      ...item,
      currentSeason: String(season),
      currentEpisode: String(episode),
      lastProgressAt: at,
      progressLog: [
        ...normalizeLog(item.progressLog),
        { at, season, episode, action }
      ].slice(-100),
      updatedAt: at
    }));
  }

  function formatDate(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(timestamp));
  }

  return Object.freeze({
    snapshot,
    parseEpisodesBySeason,
    resolveSeasonLengths,
    advance: id => change(id, "advance"),
    back: id => change(id, "back"),
    formatDate,
    normalizeLog
  });
})();