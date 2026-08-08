// ---------- KB1.2.2 · Perfil externo y descubrimientos de personas ----------
const TMDbPersonService = (() => {
  const sessionCache = new Map();
  const PROFILE_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";
  const POSTER_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

  function clean(value) {
    return value == null ? "" : String(value).trim();
  }

  function personId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  function mediaTypeOf(item) {
    if (item?.media_type === "movie" || item?.media_type === "tv") return item.media_type;
    return "";
  }

  function libraryTmdbKeys() {
    const keys = new Set();
    [
      KEY.peliculasPendientes,
      KEY.peliculasVistas,
      KEY.seriesPendientes,
      KEY.seriesVistas
    ].forEach(key => {
      LibraryRepository.getAll(key).forEach(item => {
        const id = Number(item?.tmdbId);
        if (!Number.isInteger(id) || id <= 0) return;
        const type = item?.tmdbType === "tv" || key === KEY.seriesPendientes || key === KEY.seriesVistas
          ? "tv"
          : "movie";
        keys.add(`${type}:${id}`);
      });
    });
    return keys;
  }

  function profileFrom(data) {
    return Object.freeze({
      id: personId(data?.id),
      name: clean(data?.name),
      biography: clean(data?.biography),
      birthday: clean(data?.birthday),
      deathday: clean(data?.deathday),
      placeOfBirth: clean(data?.place_of_birth),
      knownForDepartment: clean(data?.known_for_department),
      profilePath: clean(data?.profile_path),
      profileUrl: data?.profile_path ? `${PROFILE_IMAGE_BASE}${data.profile_path}` : ""
    });
  }

  function normalizedCredit(item, source) {
    const type = mediaTypeOf(item);
    const id = Number(item?.id);
    if (!type || !Number.isInteger(id) || id <= 0 || item?.adult === true) return null;

    const title = clean(type === "tv" ? item?.name : item?.title);
    if (!title) return null;

    const date = clean(type === "tv" ? item?.first_air_date : item?.release_date);
    const year = date.slice(0, 4);
    const voteCount = Math.max(0, Number(item?.vote_count) || 0);
    const voteAverage = Math.max(0, Number(item?.vote_average) || 0);
    const popularity = Math.max(0, Number(item?.popularity) || 0);
    const order = Number.isFinite(Number(item?.order)) ? Number(item.order) : null;

    return {
      id,
      mediaType: type,
      title,
      year,
      posterPath: clean(item?.poster_path),
      posterUrl: item?.poster_path ? `${POSTER_IMAGE_BASE}${item.poster_path}` : "",
      source,
      character: clean(item?.character),
      job: clean(item?.job),
      department: clean(item?.department),
      order,
      voteCount,
      voteAverage,
      popularity
    };
  }

  function rolePreferences(roles) {
    const values = (Array.isArray(roles) ? roles : []).map(role => clean(role?.job).toLowerCase());
    return {
      acting: values.some(value => value === "actor"),
      directing: values.some(value => value === "director"),
      writing: values.some(value => value === "writer" || value === "screenplay"),
      creating: values.some(value => value === "creador"),
      producing: values.some(value => value === "executive producer"),
      music: values.some(value => value.includes("music") || value.includes("composer"))
    };
  }

  function relevance(credit, preferences) {
    const job = credit.job.toLowerCase();
    const department = credit.department.toLowerCase();
    let score = 0;

    if (credit.source === "cast") {
      score += preferences.acting ? 180 : 25;
      if (credit.order != null) score += Math.max(0, 35 - Math.min(credit.order, 35));
    } else {
      if (preferences.directing && job === "director") score += 190;
      if (preferences.writing && (job === "writer" || job === "screenplay" || department === "writing")) score += 175;
      if (preferences.creating && (job.includes("creator") || job.includes("created"))) score += 190;
      if (preferences.producing && job === "executive producer") score += 145;
      if (preferences.music && (job.includes("music") || job.includes("composer") || department === "sound")) score += 155;
      if (!preferences.acting && !preferences.directing && !preferences.writing && !preferences.creating && !preferences.producing && !preferences.music) score += 35;
    }

    score += Math.min(55, Math.log10(credit.voteCount + 1) * 15);
    score += Math.min(28, credit.voteAverage * 3);
    score += Math.min(30, Math.log10(credit.popularity + 1) * 12);
    if (credit.posterPath) score += 8;
    if (credit.year) score += 4;

    return score;
  }

  function relationship(credit) {
    if (credit.source === "cast") return credit.character ? `Interpretación · ${credit.character}` : "Interpretación";
    return credit.job || credit.department || "Participación";
  }

  function selectDiscoveries(data, roles, limit = 3) {
    const existing = libraryTmdbKeys();
    const preferences = rolePreferences(roles);
    const candidates = [
      ...(Array.isArray(data?.cast) ? data.cast.map(item => normalizedCredit(item, "cast")) : []),
      ...(Array.isArray(data?.crew) ? data.crew.map(item => normalizedCredit(item, "crew")) : [])
    ].filter(Boolean)
      .filter(item => !existing.has(`${item.mediaType}:${item.id}`))
      .filter(item => item.voteCount >= 10 || item.popularity >= 2);

    const bestByTitle = new Map();
    candidates.forEach(item => {
      const key = `${item.mediaType}:${item.id}`;
      const scored = { ...item, score: relevance(item, preferences) };
      const current = bestByTitle.get(key);
      if (!current || scored.score > current.score) bestByTitle.set(key, scored);
    });

    return [...bestByTitle.values()]
      .sort((a, b) => b.score - a.score || b.voteCount - a.voteCount || b.popularity - a.popularity)
      .slice(0, Math.max(0, Number(limit) || 3))
      .map(item => Object.freeze({
        id: item.id,
        mediaType: item.mediaType,
        title: item.title,
        year: item.year,
        posterUrl: item.posterUrl,
        relationship: relationship(item)
      }));
  }

  async function get(personIdentity, roles = []) {
    const id = personId(personIdentity?.tmdbId);
    if (!id) {
      return Object.freeze({
        available: false,
        reason: "PROVISIONAL_IDENTITY",
        profile: null,
        discoveries: Object.freeze([])
      });
    }

    const cacheKey = String(id);
    if (sessionCache.has(cacheKey)) return sessionCache.get(cacheKey);

    const pending = Promise.all([
      TMDbClient.personDetails(id),
      TMDbClient.personCombinedCredits(id)
    ]).then(([profileData, creditsData]) => Object.freeze({
      available: true,
      reason: "",
      profile: profileFrom(profileData),
      discoveries: Object.freeze(selectDiscoveries(creditsData, roles))
    })).catch(error => {
      sessionCache.delete(cacheKey);
      throw error;
    });

    sessionCache.set(cacheKey, pending);
    return pending;
  }


  function invalidate(id) {
    const normalized = personId(id);
    if (!normalized) return false;
    return sessionCache.delete(String(normalized));
  }

  return Object.freeze({ get, invalidate });
})();
