// ---------- Servicio de estadísticas, recomendaciones y productividad ----------
const StatisticsService = (() => {
  const COLLECTIONS = Object.freeze({
    seriesPendientes: KEY.seriesPendientes,
    peliculasPendientes: KEY.peliculasPendientes,
    seriesVistas: KEY.seriesVistas,
    peliculasVistas: KEY.peliculasVistas
  });

  function allData() {
    return {
      seriesPendientes: LibraryRepository.getAll(COLLECTIONS.seriesPendientes),
      peliculasPendientes: LibraryRepository.getAll(COLLECTIONS.peliculasPendientes),
      seriesVistas: LibraryRepository.getAll(COLLECTIONS.seriesVistas),
      peliculasVistas: LibraryRepository.getAll(COLLECTIONS.peliculasVistas)
    };
  }

  function splitValues(value) {
    return String(value || "")
      .split(/[,/|;]+/)
      .map(part => part.trim())
      .filter(Boolean);
  }

  function normalizeLabel(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("es-ES")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function labelCounts(items, field) {
    const map = new Map();

    items.forEach(item => {
      splitValues(item?.[field]).forEach(label => {
        const key = normalizeLabel(label);
        if (!key) return;
        if (!map.has(key)) map.set(key, { label, count: 0 });
        map.get(key).count += 1;
      });
    });

    return [...map.values()].sort((a, b) =>
      b.count - a.count ||
      a.label.localeCompare(b.label, "es")
    );
  }

  function ratingPair(item) {
    const values = [Number(item?.ratingAdri), Number(item?.ratingLaura)]
      .filter(Number.isFinite);
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  }

  function average(values) {
    const valid = values.filter(Number.isFinite);
    return valid.length
      ? valid.reduce((sum, value) => sum + value, 0) / valid.length
      : null;
  }

  function parseMinutes(value) {
    const text = String(value || "").toLocaleLowerCase("es-ES");
    if (!text) return null;

    const hourMatch = text.match(/(\d+(?:[.,]\d+)?)\s*h/);
    const minuteMatch = text.match(/(\d+(?:[.,]\d+)?)\s*m(?:in)?/);
    let minutes = 0;

    if (hourMatch) minutes += Number(hourMatch[1].replace(",", ".")) * 60;
    if (minuteMatch) minutes += Number(minuteMatch[1].replace(",", "."));

    if (!hourMatch && !minuteMatch) {
      const plain = Number(text.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0]);
      if (Number.isFinite(plain)) minutes = plain;
    }

    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  }

  function estimatedMinutes(item) {
    const base = parseMinutes(item?.duration);
    if (!base) return null;

    if (item?.kind === "series") {
      const episodes = Number(item?.episodes);
      return Number.isFinite(episodes) && episodes > 0 ? base * episodes : base;
    }
    return base;
  }

  function watchedDate(item) {
    const candidates = [
      item?.watchedAt,
      Array.isArray(item?.watchLog) && item.watchLog.length
        ? item.watchLog[item.watchLog.length - 1]?.at
        : null
    ];

    for (const value of candidates) {
      const timestamp = Number(value);
      if (Number.isFinite(timestamp) && timestamp > 0) return new Date(timestamp);
    }
    return null;
  }

  function monthlyActivity(items, months = 6) {
    const now = new Date();
    const buckets = [];

    for (let offset = months - 1; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      buckets.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        label: new Intl.DateTimeFormat("es-ES", { month: "short" })
          .format(date).replace(".", ""),
        count: 0
      });
    }

    const map = new Map(buckets.map(bucket => [bucket.key, bucket]));
    items.forEach(item => {
      const date = watchedDate(item);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (map.has(key)) map.get(key).count += 1;
    });

    return buckets;
  }

  function preferenceWeights(watched) {
    const genreWeights = new Map();

    watched.forEach(item => {
      const rating = ratingPair(item);
      const weight = Number.isFinite(rating) ? Math.max(0.5, rating / 5) : 1;

      splitValues(item.genre).forEach(label => {
        const key = normalizeLabel(label);
        genreWeights.set(key, (genreWeights.get(key) || 0) + weight);
      });

    });

    return { genreWeights };
  }

  function recommendationScore(item, preferences) {
    let score = 0;
    const reasons = [];

    const matchingGenres = splitValues(item.genre)
      .map(label => ({
        label,
        weight: preferences.genreWeights.get(normalizeLabel(label)) || 0
      }))
      .filter(entry => entry.weight > 0)
      .sort((a, b) => b.weight - a.weight);

    if (matchingGenres.length) {
      score += matchingGenres.reduce((sum, entry) => sum + entry.weight, 0) * 3;
      reasons.push(`Te gusta ${matchingGenres[0].label}`);
    }

    const tmdbVote = Number(item.tmdbVoteAverage);
    if (Number.isFinite(tmdbVote) && tmdbVote > 0) {
      score += tmdbVote / 2;
      if (tmdbVote >= 7.5) reasons.push(`TMDb ${tmdbVote.toFixed(1)}/10`);
    }

    const year = Number(item.year);
    if (Number.isFinite(year) && year >= new Date().getFullYear() - 3) score += 0.5;
    if (item.posterUrl) score += 0.15;
    if (item.synopsis) score += 0.15;

    if (!reasons.length) {
      reasons.push(item.genre
        ? `Pendiente de ${splitValues(item.genre)[0]}`
        : "Pendiente en tu biblioteca");
    }

    return { score, reasons: reasons.slice(0, 2) };
  }

  function recommendations(data, limit = 6) {
    const watched = [...data.seriesVistas, ...data.peliculasVistas];
    const pending = [...data.seriesPendientes, ...data.peliculasPendientes];
    const preferences = preferenceWeights(watched);

    return pending
      .map(item => ({ item, ...recommendationScore(item, preferences) }))
      .sort((a, b) =>
        b.score - a.score ||
        Number(b.item.createdAt || 0) - Number(a.item.createdAt || 0)
      )
      .slice(0, limit);
  }

  function parsePlannedDate(value) {
    const text = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const date = new Date(`${text}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function dayDifference(date, reference = startOfToday()) {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - reference) / 86400000);
  }

  function continuingSeries(items, limit = 6) {
    return items
      .filter(item => {
        const season = Number(item.currentSeason);
        const episode = Number(item.currentEpisode);
        return Number.isFinite(season) && season > 0 &&
          Number.isFinite(episode) && episode >= 0;
      })
      .map(item => ({
        item,
        season: Number(item.currentSeason),
        episode: Number(item.currentEpisode),
        nextEpisode: Number(item.currentEpisode) + 1
      }))
      .sort((a, b) =>
        Number(b.item.updatedAt || b.item.createdAt || 0) -
        Number(a.item.updatedAt || a.item.createdAt || 0)
      )
      .slice(0, limit);
  }

  function upcomingTitles(items, limit = 6) {
    const today = startOfToday();

    return items
      .map(item => {
        const date = parsePlannedDate(item.plannedDate);
        return date ? { item, date, days: dayDifference(date, today) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.date - b.date)
      .slice(0, limit);
  }

  function priorityReminders(items, limit = 6) {
    const now = Date.now();

    return items
      .filter(item => item.priority === "alta")
      .map(item => {
        const created = Number(item.movedBackAt || item.createdAt || item.updatedAt || now);
        const ageDays = Math.max(0, Math.floor((now - created) / 86400000));
        return { item, ageDays };
      })
      .sort((a, b) =>
        b.ageDays - a.ageDays ||
        Number(a.item.createdAt || 0) - Number(b.item.createdAt || 0)
      )
      .slice(0, limit);
  }


  function availabilityByPlatform(items) {
    if (typeof UserPlatformsRepository === "undefined") return [];

    const selected = UserPlatformsRepository.loadSelection().providers;
    const counts = new Map(selected.map(provider => [Number(provider.providerId), 0]));

    items.forEach(item => {
      if (!window.PlatformAvailabilityMatch?.matches(item)) return;

      window.PlatformAvailabilityMatch.matchingProviders(item).forEach(provider => {
        const providerId = Number(provider?.providerId ?? provider?.id);
        if (counts.has(providerId)) counts.set(providerId, counts.get(providerId) + 1);
      });
    });

    return selected.map(provider => ({
      providerId: Number(provider.providerId),
      label: provider.name,
      count: counts.get(Number(provider.providerId)) || 0
    }));
  }

  function buildDashboard() {
    const data = allData();
    const watched = [...data.seriesVistas, ...data.peliculasVistas];
    const pending = [...data.seriesPendientes, ...data.peliculasPendientes];

    const minutes = watched.map(estimatedMinutes).filter(Number.isFinite);
    const totalMinutes = minutes.length
      ? minutes.reduce((sum, value) => sum + value, 0)
      : null;

    const availableMovies = data.peliculasPendientes.filter(item =>
      Boolean(window.PlatformAvailabilityMatch?.matches(item))
    ).length;
    const availableSeries = data.seriesPendientes.filter(item =>
      Boolean(window.PlatformAvailabilityMatch?.matches(item))
    ).length;
    const configuredPlatforms = typeof UserPlatformsRepository !== "undefined"
      ? UserPlatformsRepository.loadSelection().providers.length
      : 0;

    return {
      generatedAt: Date.now(),
      availableNow: {
        movies: availableMovies,
        series: availableSeries,
        total: availableMovies + availableSeries,
        configuredPlatforms
      },
      totals: {
        all: watched.length + pending.length,
        watched: watched.length,
        pending: pending.length,
        series: data.seriesVistas.length + data.seriesPendientes.length,
        movies: data.peliculasVistas.length + data.peliculasPendientes.length
      },
      averageRating: average(watched.map(ratingPair)),
      totalMinutes,
      durationCoverage: {
        withEstimate: minutes.length,
        watched: watched.length
      },
      topGenres: labelCounts(watched, "genre").slice(0, 6),
      availabilityByPlatform: availabilityByPlatform(pending),
      monthlyActivity: monthlyActivity(watched),
      activityCoverage: {
        withDate: watched.filter(item => Boolean(watchedDate(item))).length,
        watched: watched.length
      },
      recommendations: recommendations(data),
      productivity: {
        continuing: continuingSeries(data.seriesPendientes),
        upcoming: upcomingTitles(pending),
        priority: priorityReminders(pending)
      },
      hasData: watched.length + pending.length > 0,
      hasWatched: watched.length > 0
    };
  }

  return Object.freeze({
    buildDashboard,
    parseMinutes,
    estimatedMinutes,
    parsePlannedDate,
    dayDifference
  });
})();