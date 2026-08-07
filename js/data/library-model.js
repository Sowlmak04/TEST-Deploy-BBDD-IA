// ---------- Modelo normalizado de biblioteca ----------
const LibraryModel = (() => {
  const VALID_KINDS = new Set(["series", "peliculas"]);
  const VALID_STATUSES = new Set(["pendientes", "vistas"]);

  function createId() {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    return "id_" +
      Date.now().toString(36) + "_" +
      Math.random().toString(36).slice(2, 10);
  }

  function normalizeText(value) {
    return value == null ? "" : String(value).trim();
  }

  function normalizeTimestamp(value, fallback = null) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0
      ? Math.trunc(number)
      : fallback;
  }

  function normalizeRating(value) {
    if (value === "" || value == null) return "";

    const number = Number(value);
    if (!Number.isFinite(number)) return "";

    return Math.min(10, Math.max(0, Math.round(number * 2) / 2));
  }

  function normalizeWatchEntry(entry, fallbackAt) {
    const source = entry && typeof entry === "object" ? entry : {};

    return {
      ...source,
      at: normalizeTimestamp(source.at, fallbackAt || Date.now()),
      ratingAdri: normalizeRating(source.ratingAdri),
      ratingLaura: normalizeRating(source.ratingLaura),
      notesAdri: normalizeText(source.notesAdri),
      notesLaura: normalizeText(source.notesLaura)
    };
  }

  function contextFromKey(key) {
    const contexts = {
      [KEY.seriesPendientes]: {
        kind: "series",
        status: "pendientes"
      },
      [KEY.peliculasPendientes]: {
        kind: "peliculas",
        status: "pendientes"
      },
      [KEY.seriesVistas]: {
        kind: "series",
        status: "vistas"
      },
      [KEY.peliculasVistas]: {
        kind: "peliculas",
        status: "vistas"
      }
    };

    return contexts[key] || { kind: "", status: "" };
  }

  function normalizeId(value, usedIds) {
    let id = normalizeText(value);

    if (!id || usedIds?.has(id)) {
      do {
        id = createId();
      } while (usedIds?.has(id));
    }

    usedIds?.add(id);
    return id;
  }

  function normalizeItem(item, context = {}, usedIds = null) {
    const source =
      item && typeof item === "object" && !Array.isArray(item)
        ? item
        : {};

    const now = Date.now();

    const kind = VALID_KINDS.has(context.kind)
      ? context.kind
      : VALID_KINDS.has(source.kind)
        ? source.kind
        : "";

    const status = VALID_STATUSES.has(context.status)
      ? context.status
      : VALID_STATUSES.has(source.status)
        ? source.status
        : "";

    const createdAt = normalizeTimestamp(
      source.createdAt,
      normalizeTimestamp(source.watchedAt, now)
    );

    const normalized = {
      ...source,
      id: normalizeId(source.id, usedIds),
      kind,
      status,
      title: normalizeText(source.title),
      platform: normalizeText(source.platform),
      dubbingUrl: normalizeText(source.dubbingUrl),
      genre: typeof GenreNormalizer !== "undefined"
        ? GenreNormalizer.normalize(source.genre)
        : normalizeText(source.genre),
      duration: normalizeText(source.duration),
      synopsis: normalizeText(source.synopsis ?? source.notes),
      originalLanguage: normalizeText(source.originalLanguage),
      originCountries: Array.isArray(source.originCountries)
        ? source.originCountries.map(value => normalizeText(value)).filter(Boolean)
        : [],
      spokenLanguages: Array.isArray(source.spokenLanguages)
        ? source.spokenLanguages.map(value => normalizeText(value)).filter(Boolean)
        : [],
      productionCompanies: Array.isArray(source.productionCompanies)
        ? source.productionCompanies.map(company => ({
            id: Number(company?.id) || null,
            name: normalizeText(company?.name),
            originCountry: normalizeText(company?.originCountry),
            logoPath: normalizeText(company?.logoPath)
          })).filter(company => company.name)
        : [],
      productionStatus: normalizeText(source.productionStatus),
      tagline: normalizeText(source.tagline),
      releaseDate: normalizeText(source.releaseDate),
      lastAirDate: normalizeText(source.lastAirDate),
      adult: Boolean(source.adult),
      inProduction: source.inProduction === null || source.inProduction === undefined ? null : Boolean(source.inProduction),
      cast: Array.isArray(source.cast)
        ? source.cast.map(person => ({
            id: Number(person?.id) || null,
            name: normalizeText(person?.name),
            character: normalizeText(person?.character),
            billingOrder: Number.isFinite(Number(person?.billingOrder)) ? Number(person.billingOrder) : null,
            profilePath: normalizeText(person?.profilePath),
            profileUrl: normalizeText(person?.profileUrl)
          })).filter(person => person.name).slice(0, 15)
        : [],
      crew: Array.isArray(source.crew)
        ? source.crew.map(person => ({
            id: Number(person?.id) || null,
            name: normalizeText(person?.name),
            job: normalizeText(person?.job),
            department: normalizeText(person?.department)
          })).filter(person => person.name)
        : [],
      creators: Array.isArray(source.creators)
        ? source.creators.map(person => ({
            id: Number(person?.id) || null,
            name: normalizeText(person?.name)
          })).filter(person => person.name)
        : [],
      trailer: source.trailer && typeof source.trailer === "object" && !Array.isArray(source.trailer)
        ? {
            site: normalizeText(source.trailer.site),
            key: normalizeText(source.trailer.key),
            name: normalizeText(source.trailer.name),
            language: normalizeText(source.trailer.language).toLowerCase(),
            country: normalizeText(source.trailer.country).toUpperCase(),
            official: Boolean(source.trailer.official),
            publishedAt: normalizeText(source.trailer.publishedAt),
            size: Math.max(0, Number(source.trailer.size) || 0)
          }
        : null,
      watchRegion: normalizeText(source.watchRegion || "ES").toUpperCase() || "ES",
      watchProviders: Array.isArray(source.watchProviders)
        ? source.watchProviders.map(provider => ({
            id: Number(provider?.id) || null,
            name: normalizeText(provider?.name),
            displayPriority: Number.isFinite(Number(provider?.displayPriority))
              ? Number(provider.displayPriority)
              : 9999,
            logoPath: normalizeText(provider?.logoPath),
            logoUrl: normalizeText(provider?.logoUrl)
          })).filter(provider => provider.name)
        : [],
      watchProvidersLink: normalizeText(source.watchProvidersLink),
      watchProvidersUpdatedAt: normalizeTimestamp(source.watchProvidersUpdatedAt, null),
      favorite: Boolean(source.favorite),
      priority: ["alta", "media", "baja"].includes(source.priority)
        ? source.priority
        : "",
      tags: normalizeText(source.tags),
      privateNote: normalizeText(source.privateNote),
      plannedDate: normalizeText(source.plannedDate),
      createdAt,
      updatedAt: normalizeTimestamp(source.updatedAt, null)
    };

    if (kind === "series") {
      normalized.seasons = normalizeText(source.seasons);
      normalized.episodes = normalizeText(source.episodes);
      normalized.currentSeason = normalizeText(source.currentSeason);
      normalized.currentEpisode = normalizeText(source.currentEpisode);
      normalized.episodesPerSeason = normalizeText(source.episodesPerSeason);
      normalized.episodesBySeason = Array.isArray(source.episodesBySeason)
        ? source.episodesBySeason.map(value => normalizeText(value))
        : String(source.episodesBySeason || "").split(/[,\s;|/]+/).map(value => normalizeText(value)).filter(Boolean);

      const normalizeSeasonData = season => ({
        seasonNumber: Math.max(0, Number(season?.seasonNumber) || 0),
        episodeCount: Math.max(0, Number(season?.episodeCount) || 0),
        name: normalizeText(season?.name),
        airDate: normalizeText(season?.airDate),
        posterPath: normalizeText(season?.posterPath),
        tmdbId: Number(season?.tmdbId) || null
      });

      normalized.seasonsData = Array.isArray(source.seasonsData)
        ? source.seasonsData
            .map(normalizeSeasonData)
            .filter(season => season.seasonNumber > 0)
            .sort((a, b) => a.seasonNumber - b.seasonNumber)
        : [];

      normalized.specialsData = Array.isArray(source.specialsData)
        ? source.specialsData
            .map(normalizeSeasonData)
            .filter(season => season.seasonNumber === 0)
        : [];

      normalized.tmdbStatus = normalizeText(source.tmdbStatus);
      normalized.tmdbSeasonsUpdatedAt = normalizeTimestamp(
        source.tmdbSeasonsUpdatedAt,
        null
      );
      normalized.lastProgressAt = normalizeTimestamp(source.lastProgressAt, null);
      normalized.progressLog = Array.isArray(source.progressLog)
        ? source.progressLog.map(entry => ({
            at: normalizeTimestamp(entry?.at, Date.now()),
            season: normalizeText(entry?.season),
            episode: normalizeText(entry?.episode),
            action: normalizeText(entry?.action)
          }))
        : [];
    } else {
      delete normalized.seasons;
      delete normalized.episodes;
      delete normalized.currentSeason;
      delete normalized.currentEpisode;
      delete normalized.episodesPerSeason;
      delete normalized.episodesBySeason;
      delete normalized.seasonsData;
      delete normalized.specialsData;
      delete normalized.tmdbStatus;
      delete normalized.tmdbSeasonsUpdatedAt;
      delete normalized.lastProgressAt;
      delete normalized.progressLog;
    }

    if (status === "vistas") {
      const watchedAt = normalizeTimestamp(source.watchedAt, createdAt);
      const rawLog = Array.isArray(source.watchLog)
        ? source.watchLog
        : [];

      let watchLog = rawLog.map(entry =>
        normalizeWatchEntry(entry, watchedAt)
      );

      const hasLegacyWatchData =
        source.ratingAdri !== undefined ||
        source.ratingLaura !== undefined ||
        source.notesAdri !== undefined ||
        source.notesLaura !== undefined;

      if (!watchLog.length && hasLegacyWatchData) {
        watchLog = [
          normalizeWatchEntry({
            at: watchedAt,
            ratingAdri: source.ratingAdri,
            ratingLaura: source.ratingLaura,
            notesAdri: source.notesAdri,
            notesLaura: source.notesLaura
          }, watchedAt)
        ];
      }

      const lastWatch = watchLog.length
        ? watchLog[watchLog.length - 1]
        : normalizeWatchEntry({}, watchedAt);

      normalized.watchedAt = lastWatch.at;
      normalized.watchLog = watchLog;
      normalized.ratingAdri = lastWatch.ratingAdri;
      normalized.ratingLaura = lastWatch.ratingLaura;
      normalized.notesAdri = lastWatch.notesAdri;
      normalized.notesLaura = lastWatch.notesLaura;
    } else {
      normalized.watchLog = Array.isArray(source.watchLog)
        ? source.watchLog.map(entry =>
            normalizeWatchEntry(entry, createdAt)
          )
        : [];

      normalized.movedBackAt = normalizeTimestamp(
        source.movedBackAt,
        null
      );
    }

    return normalized;
  }

  function normalizeCollection(items, key, usedIds = new Set()) {
    const source = Array.isArray(items) ? items : [];
    const context = contextFromKey(key);

    const normalized = source.map(item =>
      normalizeItem(item, context, usedIds)
    );

    return {
      items: normalized,
      changed:
        JSON.stringify(source) !== JSON.stringify(normalized)
    };
  }

  function duplicateCandidates(items) {
    const groups = new Map();

    (Array.isArray(items) ? items : []).forEach(item => {
      const title = normalizeText(item?.title)
        .toLocaleLowerCase("es-ES")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (!title) return;

      const signature = [
        item?.kind || "",
        item?.status || "",
        title,
        normalizeText(item?.platform)
          .toLocaleLowerCase("es-ES")
      ].join("|");

      if (!groups.has(signature)) groups.set(signature, []);
      groups.get(signature).push(item);
    });

    return [...groups.values()]
      .filter(group => group.length > 1);
  }

  return Object.freeze({
    createId,
    contextFromKey,
    normalizeItem,
    normalizeCollection,
    duplicateCandidates
  });
})();
