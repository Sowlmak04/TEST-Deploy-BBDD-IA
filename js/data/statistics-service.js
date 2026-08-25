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
    if (typeof LibraryModel !== "undefined" && LibraryModel.getAverageRating) {
      return LibraryModel.getAverageRating(item);
    }
    const values = [item?.ratingAdri, item?.ratingLaura]
      .filter(value => value !== "" && value != null)
      .map(Number)
      .filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function average(values) {
    const valid = values.filter(Number.isFinite);
    return valid.length
      ? valid.reduce((sum, value) => sum + value, 0) / valid.length
      : null;
  }

  function numericRating(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function ratingAnalytics(watched, movies, series) {
    const rows = watched.map(item => {
      const adri = typeof LibraryModel !== "undefined" && LibraryModel.getRaterState
        ? numericRating(LibraryModel.getRaterState(item, "adri").watched ? LibraryModel.getRaterState(item, "adri").rating : null)
        : numericRating(item?.ratingAdri);
      const laura = typeof LibraryModel !== "undefined" && LibraryModel.getRaterState
        ? numericRating(LibraryModel.getRaterState(item, "laura").watched ? LibraryModel.getRaterState(item, "laura").rating : null)
        : numericRating(item?.ratingLaura);
      const joint = ratingPair(item);
      return { item, adri, laura, joint };
    });

    const jointRows = rows.filter(row => Number.isFinite(row.joint));
    const pairedRows = rows.filter(row =>
      Number.isFinite(row.adri) && Number.isFinite(row.laura)
    );

    const typeSummary = items => {
      const values = items.map(ratingPair).filter(Number.isFinite);
      return { average: average(values), count: values.length };
    };

    const bands = [
      { label: "9–10", min: 9, max: 10, count: 0 },
      { label: "8–8,9", min: 8, max: 9, count: 0 },
      { label: "7–7,9", min: 7, max: 8, count: 0 },
      { label: "6–6,9", min: 6, max: 7, count: 0 },
      { label: "<6", min: -Infinity, max: 6, count: 0 }
    ];

    jointRows.forEach(({ joint }) => {
      const band = bands.find(entry =>
        joint >= entry.min && (entry.max === 10 ? joint <= entry.max : joint < entry.max)
      );
      if (band) band.count += 1;
    });

    const affinityRows = pairedRows.map(row => ({
      id: row.item?.id,
      title: row.item?.title || "Sin título",
      kind: row.item?.kind,
      difference: Math.abs(row.adri - row.laura),
      adri: row.adri,
      laura: row.laura
    }));

    const coincidences = [...affinityRows]
      .sort((a, b) =>
        a.difference - b.difference ||
        a.title.localeCompare(b.title, "es")
      );

    const disagreements = [...affinityRows]
      .sort((a, b) =>
        b.difference - a.difference ||
        a.title.localeCompare(b.title, "es")
      );

    const genres = new Map();
    jointRows.forEach(({ item, joint }) => {
      splitValues(item?.genre).forEach(label => {
        const key = normalizeLabel(label);
        if (!key) return;
        if (!genres.has(key)) genres.set(key, { label, values: [] });
        genres.get(key).values.push(joint);
      });
    });

    const genreRatings = [...genres.values()]
      .map(entry => ({
        label: entry.label,
        count: entry.values.length,
        average: average(entry.values)
      }))
      .filter(entry => entry.count >= 3 && Number.isFinite(entry.average))
      .sort((a, b) =>
        b.average - a.average ||
        b.count - a.count ||
        a.label.localeCompare(b.label, "es")
      );

    return {
      summary: {
        jointAverage: average(jointRows.map(row => row.joint)),
        adriAverage: average(rows.map(row => row.adri)),
        lauraAverage: average(rows.map(row => row.laura)),
        ratedTitles: jointRows.length
      },
      byType: {
        movies: typeSummary(movies),
        series: typeSummary(series)
      },
      distribution: bands.map(({ label, count }) => ({ label, count })),
      affinity: {
        pairedTitles: pairedRows.length,
        averageDifference: average(affinityRows.map(row => row.difference)),
        coincidences,
        disagreements
      },
      genreRatings
    };
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

  function activityWindow(items, months = 6) {
    const now = new Date();
    const buckets = [];

    for (let offset = months - 1; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      buckets.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        label: new Intl.DateTimeFormat("es-ES", { month: "short" })
          .format(date).replace(".", ""),
        fullLabel: new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })
          .format(date),
        count: 0,
        movies: 0,
        series: 0
      });
    }

    const map = new Map(buckets.map(bucket => [bucket.key, bucket]));

    items.forEach(item => {
      const date = watchedDate(item);
      if (!date) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = map.get(key);
      if (!bucket) return;

      bucket.count += 1;
      if (item?.kind === "series") bucket.series += 1;
      else bucket.movies += 1;
    });

    const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    const movies = buckets.reduce((sum, bucket) => sum + bucket.movies, 0);
    const series = buckets.reduce((sum, bucket) => sum + bucket.series, 0);
    const mostActive = buckets.reduce((best, bucket) =>
      !best || bucket.count > best.count ? bucket : best
    , null);

    return {
      months,
      buckets,
      total,
      movies,
      series,
      averagePerMonth: months > 0 ? total / months : 0,
      mostActive: mostActive && mostActive.count > 0
        ? {
            key: mostActive.key,
            label: mostActive.fullLabel,
            count: mostActive.count
          }
        : null
    };
  }

  function annualActivity(items) {
    const counts = new Map();

    items.forEach(item => {
      const date = watchedDate(item);
      if (!date) return;
      const year = date.getFullYear();
      counts.set(year, (counts.get(year) || 0) + 1);
    });

    const years = [...counts.entries()]
      .map(([year, count]) => ({
        year,
        label: String(year),
        count
      }))
      .sort((a, b) => b.year - a.year);

    const topYear = years.reduce((best, entry) => {
      if (!best) return entry;
      if (entry.count > best.count) return entry;
      if (entry.count === best.count && entry.year > best.year) return entry;
      return best;
    }, null);

    return { years, topYear };
  }

  function contentTypeSummary(movies, series) {
    const movieCount = Number(movies) || 0;
    const seriesCount = Number(series) || 0;
    const total = movieCount + seriesCount;
    const moviePercentage = total ? Math.round((movieCount / total) * 100) : 0;

    return {
      movies: movieCount,
      series: seriesCount,
      total,
      moviesPercentage: moviePercentage,
      seriesPercentage: total ? 100 - moviePercentage : 0
    };
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

  function recommendations(data, limit = 6, pendingOverride = null) {
    const watched = [...data.seriesVistas, ...data.peliculasVistas];
    const pending = Array.isArray(pendingOverride)
      ? pendingOverride
      : [...data.seriesPendientes, ...data.peliculasPendientes];
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
      .map(item => {
        const progress = typeof SeriesProgressService !== "undefined"
          ? SeriesProgressService.snapshot(item)
          : null;
        const next = typeof SeriesProgressService !== "undefined"
          ? SeriesProgressService.nextPosition(item)
          : {
              season: Number(item.currentSeason),
              episode: Number(item.currentEpisode) + 1
            };

        return {
          item,
          season: Number(item.currentSeason),
          episode: Number(item.currentEpisode),
          nextSeason: Number(next.season),
          nextEpisode: Number(next.episode),
          progressPercentage: Number.isFinite(progress?.percentage)
            ? progress.percentage
            : null
        };
      })
      .sort((a, b) => {
        const aHasPercentage = Number.isFinite(a.progressPercentage);
        const bHasPercentage = Number.isFinite(b.progressPercentage);

        if (aHasPercentage !== bHasPercentage) {
          return bHasPercentage - aHasPercentage;
        }

        if (aHasPercentage && bHasPercentage &&
            a.progressPercentage !== b.progressPercentage) {
          return b.progressPercentage - a.progressPercentage;
        }

        return Number(b.item.updatedAt || b.item.createdAt || 0) -
          Number(a.item.updatedAt || a.item.createdAt || 0);
      })
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
    const today = startOfToday();

    return items
      .filter(item => item.priority === "alta")
      .map(item => {
        const created = Number(item.movedBackAt || item.createdAt || item.updatedAt || now);
        const ageDays = Math.max(0, Math.floor((now - created) / 86400000));
        const plannedDate = parsePlannedDate(item.plannedDate);
        const plannedDays = plannedDate ? dayDifference(plannedDate, today) : null;

        return { item, ageDays, plannedDate, plannedDays };
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

    return selected
      .map(provider => ({
        providerId: Number(provider.providerId),
        label: provider.name,
        count: counts.get(Number(provider.providerId)) || 0
      }))
      .filter(item => item.count > 0);
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
      Boolean(window.PersonalAvailability?.matches(item))
    ).length;
    const availableSeries = data.seriesPendientes.filter(item =>
      Boolean(window.PersonalAvailability?.matches(item))
    ).length;
    const configuredPlatforms = typeof UserPlatformsRepository !== "undefined"
      ? UserPlatformsRepository.loadSelection().providers.length
      : 0;

    const availablePending = pending.filter(item =>
      Boolean(window.PersonalAvailability?.matches(item))
    );
    const allItems = [...watched, ...pending];
    const favoriteCount = allItems.filter(item => item?.favorite === true).length;
    const ownedPhysicalCount = allItems.filter(item => item?.ownedPhysical === true).length;
    const watchedPercentage = allItems.length
      ? Math.round((watched.length / allItems.length) * 100)
      : 0;
    const pendingPercentage = allItems.length
      ? 100 - watchedPercentage
      : 0;

    // SUMMARY1.4: la UI sigue usando seis meses, pero el cálculo queda parametrizado
    // para permitir otros periodos en una evolución futura sin duplicar lógica.
    const recentActivity = activityWindow(watched, 6);
    const datedWatched = watched.filter(item => Boolean(watchedDate(item)));
    const annual = annualActivity(watched);
    const activityCoveragePercentage = watched.length
      ? Math.round((datedWatched.length / watched.length) * 100)
      : 0;
    const ratings = ratingAnalytics(
      watched,
      data.peliculasVistas,
      data.seriesVistas
    );

    return {
      generatedAt: Date.now(),
      availableNow: {
        movies: availableMovies,
        series: availableSeries,
        total: availableMovies + availableSeries,
        configuredPlatforms
      },
      totals: {
        all: allItems.length,
        watched: watched.length,
        pending: pending.length,
        series: data.seriesVistas.length + data.seriesPendientes.length,
        movies: data.peliculasVistas.length + data.peliculasPendientes.length
      },
      libraryState: {
        watched: watched.length,
        pending: pending.length,
        watchedPercentage,
        pendingPercentage
      },
      libraryProfile: {
        favorites: favoriteCount,
        ownedPhysical: ownedPhysicalCount,
        availableForMe: availablePending.length
      },
      averageRating: ratings.summary.jointAverage,
      ratings,
      totalMinutes,
      durationCoverage: {
        withEstimate: minutes.length,
        watched: watched.length
      },
      topGenres: labelCounts(watched, "genre"),
      topLibraryGenres: labelCounts(allItems, "genre"),
      availabilityByPlatform: availabilityByPlatform(pending),
      monthlyActivity: recentActivity.buckets,
      recentActivity: {
        months: recentActivity.months,
        total: recentActivity.total,
        movies: recentActivity.movies,
        series: recentActivity.series,
        averagePerMonth: recentActivity.averagePerMonth,
        mostActive: recentActivity.mostActive
      },
      activityCoverage: {
        withDate: datedWatched.length,
        withoutDate: watched.length - datedWatched.length,
        watched: watched.length,
        percentage: activityCoveragePercentage
      },
      annualActivity: annual.years,
      topActivityYear: annual.topYear,
      watchedByType: contentTypeSummary(
        data.peliculasVistas.length,
        data.seriesVistas.length
      ),
      recommendations: recommendations(data),
      availableRecommendations: recommendations(data, 6, availablePending),
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