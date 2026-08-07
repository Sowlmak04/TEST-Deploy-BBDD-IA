// ---------- Cliente TMDb ----------
const TMDbClient = (() => {
  const TOKEN_KEY = "inv_tmdb_read_token_v1";
  const CONFIG_KEY = "inv_tmdb_image_config_v1";
  const API_BASE = "https://api.themoviedb.org/3";
  const DEFAULT_IMAGE_BASE = "https://image.tmdb.org/t/p/";
  const WATCH_REGION = "ES";

  function getToken() {
    return (localStorage.getItem(TOKEN_KEY) || "").trim();
  }

  function setToken(token) {
    const clean = String(token || "").trim();

    if (clean) {
      localStorage.setItem(TOKEN_KEY, clean);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }

    return clean;
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function hasToken() {
    return Boolean(getToken());
  }

  async function request(path, params = {}, options = {}) {
    const token = getToken();

    if (!token) {
      throw new Error("TMDB_TOKEN_MISSING");
    }

    const url = new URL(API_BASE + path);

    Object.entries({
      language: "es-ES",
      ...params
    }).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const timeoutMs = Number(options.timeoutMs) > 0
      ? Number(options.timeoutMs)
      : 0;
    const controller = timeoutMs ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    let response;

    try {
      response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        },
        signal: controller?.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("TMDB_REQUEST_TIMEOUT");
      }

      throw new Error("TMDB_NETWORK_ERROR");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (response.status === 401) {
      throw new Error("TMDB_TOKEN_INVALID");
    }

    if (!response.ok) {
      throw new Error(`TMDB_HTTP_${response.status}`);
    }

    try {
      const data = await response.json();

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("TMDB_INVALID_RESPONSE");
      }

      return data;
    } catch (error) {
      if (error?.message === "TMDB_INVALID_RESPONSE") throw error;
      throw new Error("TMDB_INVALID_JSON");
    }
  }

  async function testConnection() {
    await request("/configuration");
    return true;
  }

  async function getImageConfiguration() {
    const cachedRaw = localStorage.getItem(CONFIG_KEY);

    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);

        if (
          cached &&
          cached.secureBaseUrl &&
          Array.isArray(cached.posterSizes)
        ) {
          return cached;
        }
      } catch {
        localStorage.removeItem(CONFIG_KEY);
      }
    }

    const data = await request("/configuration");
    const config = {
      secureBaseUrl:
        data?.images?.secure_base_url || DEFAULT_IMAGE_BASE,
      posterSizes:
        Array.isArray(data?.images?.poster_sizes)
          ? data.images.poster_sizes
          : ["w342"]
    };

    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return config;
  }

  function choosePosterSize(sizes) {
    const preferred = ["w342", "w300", "w500", "original"];
    return preferred.find(size => sizes.includes(size)) || sizes[0] || "w342";
  }

  async function posterUrl(path) {
    if (!path) return "";

    try {
      const config = await getImageConfiguration();
      const size = choosePosterSize(config.posterSizes);
      return `${config.secureBaseUrl}${size}${path}`;
    } catch {
      return `${DEFAULT_IMAGE_BASE}w342${path}`;
    }
  }

  function mediaType(kind) {
    return kind === "series" ? "tv" : "movie";
  }

  async function search(query, kind) {
    const type = mediaType(kind);
    const data = await request(`/search/${type}`, {
      query,
      include_adult: false,
      page: 1,
      region: "ES"
    });

    return (Array.isArray(data?.results) ? data.results : [])
      .slice(0, 10)
      .map(item => ({
        id: item.id,
        mediaType: type,
        title: type === "tv" ? item.name : item.title,
        originalTitle:
          type === "tv" ? item.original_name : item.original_title,
        date:
          type === "tv" ? item.first_air_date : item.release_date,
        year:
          String(
            type === "tv"
              ? item.first_air_date || ""
              : item.release_date || ""
          ).slice(0, 4),
        overview: item.overview || "",
        posterPath: item.poster_path || "",
        popularity: Number(item.popularity) || 0
      }));
  }

  function normalizeTrailer(video) {
    if (!video || typeof video !== "object") return null;

    const site = String(video.site || "").trim();
    const key = String(video.key || "").trim();
    const type = String(video.type || "").trim();

    if (!site || !key || type.toLowerCase() !== "trailer") return null;

    return {
      site,
      key,
      name: String(video.name || "Tráiler").trim() || "Tráiler",
      language: String(video.iso_639_1 || "").trim().toLowerCase(),
      country: String(video.iso_3166_1 || "").trim().toUpperCase(),
      official: Boolean(video.official),
      publishedAt: String(video.published_at || "").trim(),
      size: Math.max(0, Number(video.size) || 0)
    };
  }

  function chooseTrailer(videos, preferredLanguage = "") {
    const preferred = String(preferredLanguage || "").trim().toLowerCase();

    return (Array.isArray(videos) ? videos : [])
      .map(normalizeTrailer)
      .filter(Boolean)
      .sort((a, b) => {
        const score = video => {
          const isSpanish = video.language === "es";
          const isOriginal = preferred && video.language === preferred;

          return (video.official && isSpanish ? 4000 : 0) +
            (video.official && isOriginal ? 3000 : 0) +
            (video.official ? 2000 : 0) +
            (isSpanish ? 1000 : 0) +
            (isOriginal ? 500 : 0) +
            Math.min(video.size, 2160) / 100;
        };

        const scoreDiff = score(b) - score(a);
        if (scoreDiff) return scoreDiff;

        return String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
      })[0] || null;
  }

  async function trailer(id, kind, originalLanguage = "") {
    const type = mediaType(kind);
    const responses = [];
    let successfulRequests = 0;

    try {
      responses.push(await request(`/${type}/${id}/videos`, { language: "es-ES" }));
      successfulRequests += 1;
    } catch (error) {
      console.warn("No se pudieron consultar los vídeos en español de TMDb.", error);
    }

    try {
      responses.push(await request(`/${type}/${id}/videos`, { language: undefined }));
      successfulRequests += 1;
    } catch (error) {
      console.warn("No se pudieron consultar los vídeos alternativos de TMDb.", error);
    }

    const videos = [];
    const seen = new Set();

    responses.forEach(response => {
      (Array.isArray(response?.results) ? response.results : []).forEach(video => {
        const identity = `${String(video?.site || "").toLowerCase()}:${String(video?.key || "")}`;
        if (!video?.key || seen.has(identity)) return;
        seen.add(identity);
        videos.push(video);
      });
    });

    if (!successfulRequests) return undefined;
    return chooseTrailer(videos, originalLanguage);
  }

  async function details(id, kind) {
    const type = mediaType(kind);
    const data = await request(`/${type}/${id}`, {
      append_to_response: type === "tv"
        ? "content_ratings,credits"
        : "release_dates,credits"
    });

    const genres = typeof GenreNormalizer !== "undefined"
      ? GenreNormalizer.normalizeList(data?.genres)
      : (Array.isArray(data?.genres)
          ? data.genres.map(genre => genre?.name).filter(Boolean)
          : []);

    let duration = "";

    if (type === "movie" && Number(data?.runtime) > 0) {
      const minutes = Number(data.runtime);
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      duration = hours
        ? `${hours}h${rest ? ` ${rest}m` : ""}`
        : `${rest} min`;
    }

    if (type === "tv") {
      const runtimes = Array.isArray(data?.episode_run_time)
        ? data.episode_run_time.filter(value => Number(value) > 0)
        : [];

      if (runtimes.length) {
        duration = `${runtimes[0]} min/ep`;
      }
    }

    const rawSeasons =
      type === "tv" && Array.isArray(data?.seasons)
        ? data.seasons
        : [];

    const normalizeSeason = season => ({
      seasonNumber: Number(season?.season_number) || 0,
      episodeCount: Math.max(0, Number(season?.episode_count) || 0),
      name: String(season?.name || "").trim(),
      airDate: String(season?.air_date || "").trim(),
      posterPath: String(season?.poster_path || "").trim(),
      tmdbId: Number(season?.id) || null
    });

    const seasonsData = rawSeasons
      .map(normalizeSeason)
      .filter(season => season.seasonNumber > 0)
      .sort((a, b) => a.seasonNumber - b.seasonNumber);

    const specialsData = rawSeasons
      .map(normalizeSeason)
      .filter(season => season.seasonNumber === 0);

    const episodesBySeason = seasonsData.map(season =>
      String(season.episodeCount)
    );

    const knownEpisodeTotal = seasonsData.reduce(
      (sum, season) => sum + season.episodeCount,
      0
    );

    const seasonsUpdatedAt = Date.now();
    const selectedTrailer = await trailer(id, kind, data.original_language || "");

    return {
      tmdbId: data.id,
      tmdbType: type,
      title: type === "tv" ? data.name : data.title,
      originalTitle:
        type === "tv" ? data.original_name : data.original_title,
      year: String(
        type === "tv"
          ? data.first_air_date || ""
          : data.release_date || ""
      ).slice(0, 4),
      synopsis: data.overview || "",
      genre: genres.join(", "),
      duration,
      seasons:
        type === "tv"
          ? String(seasonsData.length || Math.max(0, Number(data.number_of_seasons) || 0))
          : "",
      episodes:
        type === "tv"
          ? String(knownEpisodeTotal || Math.max(0, Number(data.number_of_episodes) || 0))
          : "",
      episodesBySeason,
      seasonsData,
      specialsData,
      tmdbStatus: type === "tv" ? String(data.status || "").trim() : "",
      tmdbSeasonsUpdatedAt: type === "tv" ? seasonsUpdatedAt : null,
      posterPath: data.poster_path || "",
      posterUrl: await posterUrl(data.poster_path),
      backdropPath: data.backdrop_path || "",
      originalLanguage: data.original_language || "",
      originCountries: (
        type === "tv"
          ? (Array.isArray(data.origin_country) ? data.origin_country : [])
          : (Array.isArray(data.production_countries) ? data.production_countries : [])
              .map(country => country?.name || country?.iso_3166_1 || "")
      )
        .map(value => String(value || "").trim())
        .filter(Boolean),
      spokenLanguages: (Array.isArray(data.spoken_languages) ? data.spoken_languages : [])
        .map(language => String(language?.name || language?.english_name || "").trim())
        .filter(Boolean),
      productionCompanies: (Array.isArray(data.production_companies) ? data.production_companies : [])
        .map(company => ({
          id: Number(company?.id) || null,
          name: String(company?.name || "").trim(),
          originCountry: String(company?.origin_country || "").trim(),
          logoPath: String(company?.logo_path || "").trim()
        }))
        .filter(company => company.name),
      productionStatus: String(data.status || "").trim(),
      tagline: String(data.tagline || "").trim(),
      releaseDate: String(type === "tv" ? data.first_air_date || "" : data.release_date || "").trim(),
      lastAirDate: String(type === "tv" ? data.last_air_date || "" : "").trim(),
      adult: Boolean(data.adult),
      inProduction: type === "tv" ? Boolean(data.in_production) : null,
      ...(selectedTrailer !== undefined ? { trailer: selectedTrailer } : {}),
      cast: (Array.isArray(data?.credits?.cast) ? data.credits.cast : [])
        .slice()
        .sort((a, b) => {
          // En TMDb el protagonista suele tener order = 0. No debe tratarse
          // como un valor vacío, porque eso lo enviaría al final del reparto.
          const orderA = Number.isFinite(Number(a?.order)) ? Number(a.order) : 9999;
          const orderB = Number.isFinite(Number(b?.order)) ? Number(b.order) : 9999;
          return orderA - orderB;
        })
        .slice(0, 15)
        .map(person => ({
          id: Number(person?.id) || null,
          name: String(person?.name || "").trim(),
          character: String(person?.character || "").trim(),
          billingOrder: Number.isFinite(Number(person?.order)) ? Number(person.order) : null,
          profilePath: String(person?.profile_path || "").trim(),
          profileUrl: person?.profile_path
            ? `${DEFAULT_IMAGE_BASE}w185${person.profile_path}`
            : ""
        }))
        .filter(person => person.name),
      crew: (Array.isArray(data?.credits?.crew) ? data.credits.crew : [])
        .filter(person => {
          const job = String(person?.job || "").toLowerCase();
          return [
            "director",
            "writer",
            "screenplay",
            "executive producer",
            "original music composer",
            "music",
            "music composer",
            "composer",
            "main title theme composer",
            "theme song performance"
          ].includes(job);
        })
        .map(person => ({
          id: Number(person?.id) || null,
          name: String(person?.name || "").trim(),
          job: String(person?.job || "").trim(),
          department: String(person?.department || "").trim()
        }))
        .filter(person => person.name),
      creators: (type === "tv" && Array.isArray(data?.created_by) ? data.created_by : [])
        .map(person => ({
          id: Number(person?.id) || null,
          name: String(person?.name || "").trim()
        }))
        .filter(person => person.name),
      tmdbVoteAverage: Number(data.vote_average) || null,
      tmdbUpdatedAt: Date.now()
    };
  }

  const WATCH_PROVIDER_ALIASES = Object.freeze({
    "amazon prime video": { key: "amazon-prime-video", name: "Amazon Prime Video" },
    "disney plus": { key: "disney-plus", name: "Disney+" },
    "disney+": { key: "disney-plus", name: "Disney+" },
    "hbo max": { key: "max", name: "Max" },
    "max": { key: "max", name: "Max" },
    "movistar plus+": { key: "movistar-plus", name: "Movistar Plus+" },
    "movistar plus": { key: "movistar-plus", name: "Movistar Plus+" }
  });

  function normalizeProviderText(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  function isAggregatorChannel(name) {
    // TMDb/JustWatch puede devolver add-ons contratados dentro de Amazon,
    // Apple TV u otros agregadores. Para esta aplicación no cuentan como
    // plataforma de suscripción directa.
    return /\bchannel\b/i.test(normalizeProviderText(name));
  }

  function stripCommercialVariant(name) {
    let clean = normalizeProviderText(name);

    // Planes con publicidad. La parte opcional cubre nombres como
    // "Netflix Standard with Ads" y "Netflix Basic with Ads".
    clean = clean.replace(
      /\s+(?:(?:standard|basic|premium|estandar|basico|premium)\s+)?(?:with ads|con anuncios|avec publicite|mit werbung)\s*$/i,
      ""
    );

    return clean.trim();
  }

  function canonicalProvider(normalizedName) {
    const exact = WATCH_PROVIDER_ALIASES[normalizedName];
    if (exact) return exact;

    // Movistar publica paquetes comerciales separados (por ejemplo,
    // "Movistar Plus+ Ficción Total"). Para el uso personal de la app todos
    // pertenecen a la misma plataforma principal.
    if (/^movistar plus\+?(?:\s|$)/i.test(normalizedName)) {
      return WATCH_PROVIDER_ALIASES["movistar plus+"];
    }

    // Las variantes de Netflix que queden después de retirar el sufijo de
    // publicidad se unifican bajo la plataforma principal.
    if (/^netflix(?:\s|$)/i.test(normalizedName)) {
      return { key: "netflix", name: "Netflix" };
    }

    if (/^amazon prime video(?:\s|$)/i.test(normalizedName)) {
      return WATCH_PROVIDER_ALIASES["amazon prime video"];
    }

    return null;
  }

  function normalizeWatchProvider(provider) {
    const originalName = String(provider?.provider_name || "").trim();

    if (!originalName || isAggregatorChannel(originalName)) {
      return null;
    }

    const normalizedName = normalizeProviderText(originalName);
    const strippedName = stripCommercialVariant(originalName);
    const canonical =
      canonicalProvider(normalizedName) ||
      canonicalProvider(strippedName) || {
        key: `provider-${Number(provider?.provider_id) || strippedName}`,
        name: originalName
      };

    return {
      id: Number(provider?.provider_id) || null,
      canonicalKey: canonical.key,
      name: canonical.name,
      originalName,
      isCommercialVariant: strippedName !== normalizedName || canonical.name !== originalName,
      displayPriority: Number.isFinite(Number(provider?.display_priority))
        ? Number(provider.display_priority)
        : 9999,
      logoPath: String(provider?.logo_path || "").trim(),
      logoUrl: provider?.logo_path
        ? `${DEFAULT_IMAGE_BASE}w92${provider.logo_path}`
        : ""
    };
  }

  function deduplicateWatchProviders(providers) {
    const unique = new Map();

    providers.filter(Boolean).forEach(provider => {
      const current = unique.get(provider.canonicalKey);

      if (!current) {
        unique.set(provider.canonicalKey, provider);
        return;
      }

      const providerScore =
        (provider.isCommercialVariant ? 10 : 0) +
        (provider.logoUrl ? 0 : 1);
      const currentScore =
        (current.isCommercialVariant ? 10 : 0) +
        (current.logoUrl ? 0 : 1);
      const preferred = providerScore < currentScore ? provider : current;

      unique.set(provider.canonicalKey, {
        ...preferred,
        displayPriority: Math.min(current.displayPriority, provider.displayPriority),
        logoPath: preferred.logoPath || current.logoPath || provider.logoPath,
        logoUrl: preferred.logoUrl || current.logoUrl || provider.logoUrl
      });
    });

    return Array.from(unique.values())
      .map(({ canonicalKey, originalName, isCommercialVariant, ...provider }) => provider)
      .sort((a, b) =>
        a.displayPriority - b.displayPriority ||
        a.name.localeCompare(b.name, "es")
      );
  }

  async function getWatchProviderCatalog(kind, region = WATCH_REGION) {
    const type = mediaType(kind);
    const cleanRegion = String(region || WATCH_REGION).trim().toUpperCase() || WATCH_REGION;
    const data = await request(`/watch/providers/${type}`, {
      watch_region: cleanRegion
    });

    return (Array.isArray(data?.results) ? data.results : [])
      .map(provider => ({
        id: Number(provider?.provider_id) || null,
        name: String(provider?.provider_name || "").trim(),
        displayPriority: Number.isFinite(Number(provider?.display_priority))
          ? Number(provider.display_priority)
          : 9999,
        logoPath: String(provider?.logo_path || "").trim(),
        logoUrl: provider?.logo_path
          ? `${DEFAULT_IMAGE_BASE}w92${provider.logo_path}`
          : ""
      }))
      .filter(provider => provider.name)
      .sort((a, b) =>
        a.displayPriority - b.displayPriority ||
        a.name.localeCompare(b.name, "es")
      );
  }

  async function watchProviders(id, kind, region = WATCH_REGION) {
    const type = mediaType(kind);
    const cleanRegion = String(region || WATCH_REGION).trim().toUpperCase() || WATCH_REGION;
    const data = await request(
      `/${type}/${id}/watch/providers`,
      { language: undefined },
      { timeoutMs: 15000 }
    );

    if (!data.results || typeof data.results !== "object" || Array.isArray(data.results)) {
      throw new Error("TMDB_INVALID_PROVIDERS_RESPONSE");
    }

    const hasRegionalResult = Object.prototype.hasOwnProperty.call(data.results, cleanRegion);
    const regional = hasRegionalResult ? data.results[cleanRegion] : null;

    if (hasRegionalResult && (!regional || typeof regional !== "object" || Array.isArray(regional))) {
      throw new Error("TMDB_INVALID_PROVIDERS_RESPONSE");
    }

    const flatrate = Array.isArray(regional?.flatrate) ? regional.flatrate : [];
    const providers = deduplicateWatchProviders(
      flatrate
        .map(normalizeWatchProvider)
        .filter(provider => provider.name)
    );

    return {
      availabilityStatus: !hasRegionalResult
        ? "NO_REGION_RESULT"
        : providers.length
          ? "AVAILABLE"
          : "NO_SUBSCRIPTION_PROVIDERS",
      watchRegion: cleanRegion,
      watchProviders: providers,
      watchProvidersLink: String(regional?.link || "").trim(),
      watchProvidersUpdatedAt: Date.now()
    };
  }

  return Object.freeze({
    TOKEN_KEY,
    WATCH_REGION,
    getToken,
    setToken,
    clearToken,
    hasToken,
    testConnection,
    search,
    details,
    trailer,
    watchProviders,
    getWatchProviderCatalog,
    posterUrl
  });
})();
