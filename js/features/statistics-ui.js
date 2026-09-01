// ---------- Interfaz de estadísticas, recomendaciones y productividad ----------
let activeStatisticsTab = "library";
const temporalHistoryNow = new Date();
let temporalHistoryState = {
  mode: "month",
  year: temporalHistoryNow.getFullYear(),
  month: temporalHistoryNow.getMonth() + 1
};
let temporalHistorySort = "rating";
let temporalHistoryMonthVisible = 10;
let temporalHistoryYearVisible = 10;
let recentActivityMonths = 6;

function initStatisticsDashboard() {
  const refresh = document.getElementById("btnStatsRefresh");
  refresh?.addEventListener("click", renderStatisticsDashboard);
}

function renderStatisticsDashboard() {
  const root = document.getElementById("statistics-dashboard");
  const updated = document.getElementById("statistics-updated");
  if (!root) return;

  const dashboard = StatisticsService.buildDashboard({ activityMonths: recentActivityMonths });

  if (updated) {
    updated.textContent = `Actualizado ${new Intl.DateTimeFormat(
      "es-ES",
      { hour: "2-digit", minute: "2-digit" }
    ).format(new Date(dashboard.generatedAt))}`;
  }

  if (!dashboard.hasData) {
    root.innerHTML = `
      <div class="statsEmpty">
        <strong>Todavía no hay datos suficientes</strong>
        <p>Añade películas o series para generar tu panel personal.</p>
        <button class="btnPrimary" type="button" data-dashboard-screen="anadir-home">
          Añadir un título
        </button>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    ${renderStatisticsTabs(activeStatisticsTab)}
    <div class="statsTabPanel" data-stats-tab-panel>
      ${renderStatisticsTab(activeStatisticsTab, dashboard)}
    </div>
  `;
}

function renderStatisticsTabs(activeTab) {
  const tabs = [
    ["library", "Biblioteca"],
    ["activity", "Actividad"],
    ["ratings", "Valoraciones"]
  ];

  return `
    <div class="statsTabsWrap">
      <div class="statsTabs" role="tablist" aria-label="Secciones de Resumen">
        ${tabs.map(([id, label]) => `
          <button
            class="statsTab ${activeTab === id ? "isActive" : ""}"
            type="button"
            role="tab"
            aria-selected="${activeTab === id ? "true" : "false"}"
            data-stats-tab="${id}"
          >${label}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderStatisticsTab(tab, dashboard) {
  const methodNote = `
    <p class="statsMethodNote">
      El panel se calcula en el dispositivo. No utiliza IA ni envía tu biblioteca
      a servicios externos.
    </p>
  `;

  if (tab === "activity") {
    return `
      ${renderActivity(dashboard.monthlyActivity, dashboard.activityCoverage)}
      ${renderRecentActivitySummary(dashboard.recentActivity)}
      ${renderTemporalHistoryExplorer()}
      ${renderActivityHistory(dashboard)}
      ${renderWatchedByType(dashboard.watchedByType)}
      ${renderWatchTime(dashboard)}
      ${renderRanking("Géneros más vistos", dashboard.topGenres, "No hay géneros vistos todavía.", { expandable: true, rankingId: "watched-genres" })}
      ${methodNote}
    `;
  }

  if (tab === "ratings") {
    return `
      ${renderRatingsSummary(dashboard)}
      ${renderRatingsByType(dashboard.ratings)}
      ${renderRatingDistribution(dashboard.ratings)}
      ${renderRatingAffinity(dashboard.ratings)}
      ${renderGenreRatings(dashboard.ratings)}
      ${methodNote}
    `;
  }

  return `
    ${renderSummary(dashboard)}
    ${renderLibraryState(dashboard.libraryState)}
    ${renderLibraryProfile(dashboard.libraryProfile)}
    ${renderAvailableNow(dashboard.availableNow)}
    <div class="statsTwoColumns">
      ${renderRanking("Géneros más presentes", dashboard.topLibraryGenres, "No hay géneros registrados todavía.", { expandable: true, rankingId: "library-genres" })}
      ${renderRanking("Disponibilidad en tus plataformas", dashboard.availabilityByPlatform, "No hay títulos pendientes disponibles en tus plataformas contratadas.")}
    </div>
    ${renderTracking(dashboard.productivity)}
    ${methodNote}
  `;
}

function renderAvailableNow(availableNow) {
  const configured = Number(availableNow?.configuredPlatforms || 0) > 0;
  const movies = Number(availableNow?.movies || 0);
  const series = Number(availableNow?.series || 0);
  const total = Number(availableNow?.total || 0);

  return `
    <section class="statsSection statsAvailableNow" aria-labelledby="stats-available-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Lo que puedes ver</span>
          <h2 id="stats-available-title">Disponible ahora</h2>
        </div>
      </div>
      <div class="statsAvailableGrid">
        ${availableActionCard({
          value: movies,
          label: "Películas pendientes",
          detail: movies > 0 ? "Abrir disponibles" : "Sin títulos disponibles",
          scope: "peliculas-pendientes",
          disabled: movies <= 0
        })}
        ${availableActionCard({
          value: series,
          label: "Series pendientes",
          detail: series > 0 ? "Abrir disponibles" : "Sin títulos disponibles",
          scope: "series-pendientes",
          disabled: series <= 0
        })}
        <article class="statsAvailableCard statsAvailableTotal">
          <strong>${escapeHtml(total)}</strong>
          <span>Total pendiente</span>
          <small>Disponible para ti</small>
        </article>
      </div>
      ${total <= 0 ? `
        <p class="statsAvailableHint">
          Configura <strong>Mis plataformas</strong> o marca títulos de tu <strong>Colección propia</strong> para ver aquí lo que tienes disponible.
        </p>
      ` : ""}
    </section>
  `;
}

function availableActionCard({ value, label, detail, scope, disabled }) {
  return `
    <button
      class="statsAvailableCard statsAvailableAction"
      type="button"
      data-stats-available-scope="${escapeHtml(scope)}"
      ${disabled ? "disabled" : ""}
    >
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
      <small>${escapeHtml(detail)} <b aria-hidden="true">›</b></small>
    </button>
  `;
}

function renderTracking(productivity) {
  const upcoming = Array.isArray(productivity?.upcoming) ? productivity.upcoming : [];
  const priority = Array.isArray(productivity?.priority) ? productivity.priority : [];

  if (!upcoming.length && !priority.length) return "";

  return `
    <section class="statsTracking" aria-labelledby="stats-tracking-title">
      <div class="statsSectionHead statsTrackingHead">
        <div>
          <span class="statsEyebrow">Tus pendientes</span>
          <h2 id="stats-tracking-title">Seguimiento</h2>
        </div>
      </div>
      <div class="dashboardProductivityGrid">
        ${upcoming.length ? renderUpcoming(upcoming) : ""}
        ${priority.length ? renderPriorityReminders(priority) : ""}
      </div>
    </section>
  `;
}

function renderContinueWatching(items) {
  return `
    <section class="statsSection productivitySection" aria-labelledby="continue-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Series empezadas</span>
          <h2 id="continue-title">Continuar viendo</h2>
        </div>
      </div>
      ${
        items.length
          ? `<div class="productivityList">
              ${items.map(({ item, season, episode, nextEpisode }) => {
                const progress = SeriesProgressService.snapshot(item);
                return `
                  <article class="productivityItem productivityProgressItem">
                    <button
                      class="productivityOpen"
                      type="button"
                      data-stats-open-kind="${escapeHtml(item.kind)}"
                      data-stats-open-status="${escapeHtml(item.status)}"
                      data-stats-open-id="${escapeHtml(item.id)}"
                    >
                      <span class="productivityMain">
                        <strong>${escapeHtml(item.title || "Sin título")}</strong>
                        <small>Vas por T${season} · E${episode}</small>
                      </span>
                      <span class="productivityCallout">Siguiente: E${nextEpisode}</span>
                    </button>
                    ${progress.percentage !== null ? `
                      <div class="seriesProgressTrack compact">
                        <div class="seriesProgressFill" style="width:${progress.percentage}%"></div>
                      </div>
                    ` : `<small class="progressUnavailable compactNotice">Sin cálculo exacto</small>`}
                    <div class="productivityProgressActions">
                      <button type="button" data-progress-action="back" data-progress-id="${escapeHtml(item.id)}">−1</button>
                      <button type="button" data-progress-action="advance" data-progress-id="${escapeHtml(item.id)}">+1 episodio</button>
                      <button type="button" data-progress-action="finish" data-progress-id="${escapeHtml(item.id)}">Finalizar</button>
                    </div>
                  </article>
                `;
              }).join("")}
            </div>`
          : `<p class="statsNoData">
              Añade temporada y capítulo actual a una serie pendiente.
            </p>`
      }
    </section>
  `;
}

function trackingPoster(item) {
  return item?.posterUrl
    ? `<img class="productivityPoster" src="${escapeHtml(item.posterUrl)}" alt="" loading="lazy">`
    : `<span class="productivityPoster productivityPosterFallback" aria-hidden="true">Sin imagen</span>`;
}

function renderUpcoming(items) {
  return `
    <section class="statsSection productivitySection" aria-labelledby="upcoming-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Agenda personal</span>
          <h2 id="upcoming-title">Próximamente</h2>
        </div>
      </div>
      ${
        items.length
          ? `<div class="productivityList">
              ${items.map(({ item, days }) => `
                ${productivityButton(item, `
                  ${trackingPoster(item)}
                  <span class="productivityMain">
                    <strong>${escapeHtml(item.title || "Sin título")}</strong>
                    <small>${escapeHtml(formatPlannedDate(item.plannedDate))}</small>
                  </span>
                  <span class="productivityCallout ${days < 0 ? "isOverdue" : ""}">
                    ${escapeHtml(plannedTimingLabel(days))}
                  </span>
                `)}
              `).join("")}
            </div>`
          : `<p class="statsNoData">
              Añade una fecha prevista a cualquier título pendiente.
            </p>`
      }
    </section>
  `;
}

function plannedTimingLabel(days) {
  if (!Number.isFinite(days)) return "";
  if (days === 0) return "Prevista para hoy";
  if (days === 1) return "Prevista para mañana";
  if (days > 1) return `Prevista para dentro de ${days} días`;
  if (days === -1) return "Prevista para ayer";
  return `Prevista hace ${Math.abs(days)} días`;
}

function renderPriorityReminders(items) {
  return `
    <section class="statsSection productivitySection" aria-labelledby="priority-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Recordatorios</span>
          <h2 id="priority-title">Prioridad alta</h2>
        </div>
      </div>
      ${
        items.length
          ? `<div class="productivityList">
              ${items.map(({ item, plannedDays }) => `
                ${productivityButton(item, `
                  ${trackingPoster(item)}
                  <span class="productivityMain">
                    <strong>${escapeHtml(item.title || "Sin título")}</strong>
                    <small>${escapeHtml(item.kind === "series" ? "Serie" : "Película")}</small>
                  </span>
                  ${Number.isFinite(plannedDays) ? `
                    <span class="productivityCallout ${plannedDays < 0 ? "isOverdue" : ""}">
                      ${escapeHtml(plannedTimingLabel(plannedDays))}
                    </span>
                  ` : ""}
                `)}
              `).join("")}
            </div>`
          : `<p class="statsNoData">
              No hay títulos pendientes con prioridad alta.
            </p>`
      }
    </section>
  `;
}

function productivityButton(item, body) {
  return `
    <button
      class="productivityItem"
      type="button"
      data-stats-open-kind="${escapeHtml(item.kind)}"
      data-stats-open-status="${escapeHtml(item.status)}"
      data-stats-open-id="${escapeHtml(item.id)}"
    >
      <span class="productivityContent">${body}</span>
      <span class="productivityArrow" aria-hidden="true">›</span>
    </button>
  `;
}

function formatPlannedDate(value) {
  const date = StatisticsService.parsePlannedDate(value);
  return date
    ? new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(date)
    : value;
}

function relativeDayLabel(days) {
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days > 1) return `En ${days} días`;
  if (days === -1) return "Ayer";
  return `Hace ${Math.abs(days)} días`;
}

function renderSummary(dashboard) {
  return `
    <section class="statsSection" aria-labelledby="stats-summary-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Tu biblioteca</span>
          <h2 id="stats-summary-title">Resumen general</h2>
        </div>
      </div>
      <div class="statsCards">
        ${statCard(dashboard.totals.all, "Títulos totales", `${dashboard.totals.series} series · ${dashboard.totals.movies} películas`)}
        ${statCard(dashboard.totals.watched, "Ya vistos", `${dashboard.totals.pending} pendientes`)}
      </div>
    </section>
  `;
}

function renderLibraryState(state) {
  const watched = Number(state?.watched || 0);
  const pending = Number(state?.pending || 0);
  const watchedPercentage = Number(state?.watchedPercentage || 0);
  const pendingPercentage = Number(state?.pendingPercentage || 0);

  return `
    <section class="statsSection" aria-labelledby="stats-library-state-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Estado actual</span>
          <h2 id="stats-library-state-title">Estado de la biblioteca</h2>
        </div>
      </div>
      <div class="statsLibraryStateNumbers">
        <div>
          <strong>${escapeHtml(watchedPercentage)}%</strong>
          <span>Vistos · ${escapeHtml(watched)}</span>
        </div>
        <div>
          <strong>${escapeHtml(pendingPercentage)}%</strong>
          <span>Pendientes · ${escapeHtml(pending)}</span>
        </div>
      </div>
      <div
        class="statsLibraryStateTrack"
        role="img"
        aria-label="${escapeHtml(watchedPercentage)}% vistos y ${escapeHtml(pendingPercentage)}% pendientes"
      >
        <span class="statsLibraryStateWatched" style="width:${escapeHtml(watchedPercentage)}%"></span>
      </div>
    </section>
  `;
}

function renderLibraryProfile(profile) {
  const items = [
    [profile?.favorites || 0, "Favoritos", "favorites"],
    [profile?.ownedPhysical || 0, "Colección propia", "owned-physical"],
    [profile?.availableForMe || 0, "Disponibles para ti", "available-for-me"]
  ];

  return `
    <section class="statsSection" aria-labelledby="stats-library-profile-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Características</span>
          <h2 id="stats-library-profile-title">Perfil de la biblioteca</h2>
        </div>
      </div>
      <div class="statsLibraryProfile">
        ${items.map(([value, label, collectionId]) => `
          <button
            class="statsLibraryProfileItem statsLibraryProfileAction"
            type="button"
            data-stats-smart-collection="${escapeHtml(collectionId)}"
            ${Number(value) <= 0 ? "disabled" : ""}
          >
            <strong>${escapeHtml(value)}</strong>
            <span>${escapeHtml(label)}</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function formatActivityAverage(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toFixed(1).replace(".", ",");
}

function recentActivityPeriodLabel(months) {
  const value = Number(months) || 6;
  return value === 1 ? "Último mes" : `Últimos ${value} meses`;
}

function renderRecentActivitySummary(activity) {
  const total = Number(activity?.total || 0);
  const movies = Number(activity?.movies || 0);
  const series = Number(activity?.series || 0);
  const months = Number(activity?.months || 6);
  const mostActive = activity?.mostActive;

  return `
    <section class="statsSection" aria-labelledby="stats-recent-summary-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">${escapeHtml(recentActivityPeriodLabel(months))}</span>
          <h2 id="stats-recent-summary-title">Resumen del periodo</h2>
        </div>
      </div>
      <div class="statsActivityMetricGrid${months === 1 ? " isSingleMonth" : ""}">
        ${statCard(total, "Visionados", `${movies} películas · ${series} series`)}
        ${months === 1 ? "" : statCard(
          mostActive ? mostActive.count : "—",
          "Mes más activo",
          mostActive ? mostActive.label : "Sin actividad registrada en el periodo"
        )}
      </div>
    </section>
  `;
}

function formatHistoryDate(timestamp) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(timestamp));
}

function renderTemporalHistoryExplorer() {
  const result = StatisticsService.temporalHistoryQuery(temporalHistoryState);
  const years = StatisticsService.temporalHistoryOptions();
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Intl.DateTimeFormat("es-ES", { month: "long" })
      .format(new Date(2026, index, 1))
      .replace(/^./, char => char.toLocaleUpperCase("es-ES"))
  }));

  return `
    <section class="statsSection historyExplorer" aria-labelledby="history-explorer-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Consulta temporal</span>
          <h2 id="history-explorer-title">Explorar actividad</h2>
        </div>
      </div>

      <div class="historyExplorerControls">
        <div class="historyMode" role="group" aria-label="Tipo de periodo">
          <button type="button" class="${result.mode === "month" ? "isActive" : ""}" data-history-mode="month">Mes</button>
          <button type="button" class="${result.mode === "year" ? "isActive" : ""}" data-history-mode="year">Año</button>
        </div>
        <div class="historySelectors">
          ${result.mode === "month" ? `
            <label>Mes
              <select data-history-month>
                ${months.map(entry => `<option value="${entry.value}" ${entry.value === result.month ? "selected" : ""}>${escapeHtml(entry.label)}</option>`).join("")}
              </select>
            </label>
          ` : ""}
          <label>Año
            <select data-history-year>
              ${years.map(year => `<option value="${year}" ${year === result.year ? "selected" : ""}>${year}</option>`).join("")}
            </select>
          </label>
          <label>Ordenar por
            <select data-history-sort>
              <option value="rating" ${temporalHistorySort === "rating" ? "selected" : ""}>Valoración</option>
              <option value="date" ${temporalHistorySort === "date" ? "selected" : ""}>Fecha</option>
              <option value="title" ${temporalHistorySort === "title" ? "selected" : ""}>Título</option>
            </select>
          </label>
        </div>
      </div>

      <div data-history-results>
        ${renderTemporalHistoryResults(result)}
      </div>
    </section>
  `;
}

function sortedTemporalHistoryRows(rows) {
  const safeRows = Array.isArray(rows) ? [...rows] : [];
  if (temporalHistorySort === "date") {
    return safeRows.sort((a, b) =>
      b.latestAt - a.latestAt ||
      String(a.item?.title || "").localeCompare(String(b.item?.title || ""), "es")
    );
  }

  if (temporalHistorySort === "title") {
    return safeRows.sort((a, b) =>
      String(a.item?.title || "").localeCompare(String(b.item?.title || ""), "es", { sensitivity: "base" }) ||
      b.latestAt - a.latestAt
    );
  }

  return safeRows.sort((a, b) => {
    const aHasRating = Number.isFinite(a.rating);
    const bHasRating = Number.isFinite(b.rating);
    if (aHasRating !== bHasRating) return aHasRating ? -1 : 1;
    if (aHasRating && bHasRating && b.rating !== a.rating) return b.rating - a.rating;
    return b.latestAt - a.latestAt ||
      String(a.item?.title || "").localeCompare(String(b.item?.title || ""), "es");
  });
}

function renderTemporalHistoryResults(result) {
  if (!result.titleCount) {
    return `
      <div class="historyEmpty">
        <strong>${escapeHtml(result.label)}</strong>
        <p>No hay visionados registrados en este periodo.</p>
      </div>
    `;
  }

  const repeatDetail = result.eventCount > result.titleCount
    ? `${result.eventCount} visionados registrados`
    : "Sin visionados repetidos en el periodo";

  return `
    <div class="historyPeriodHead">
      <strong>${escapeHtml(result.label)}</strong>
      <span>${escapeHtml(result.titleCount)} ${result.titleCount === 1 ? "título" : "títulos"} · ${escapeHtml(result.movies)} películas · ${escapeHtml(result.series)} series</span>
    </div>
    <div class="statsActivityMetricGrid historyMetrics">
      ${statCard(result.titleCount, "Títulos vistos", repeatDetail)}
      ${statCard(formatRating(result.averageRating), "Valoración media", "De los títulos con valoración disponible")}
      ${statCard(result.topGenre?.label || "—", "Género más presente", result.topGenre ? `${result.topGenre.count} títulos del periodo` : "Sin géneros registrados")}
    </div>
    <div class="historyLibraryActions" aria-label="Abrir este periodo en biblioteca">
      <span class="historyLibraryActionsLabel">Abrir este periodo en biblioteca</span>
      <div class="historyLibraryActionChips">
        ${result.movies > 0 ? `<button type="button" class="historyLibraryAction isMovie" data-history-library="peliculas">Películas <span>${escapeHtml(result.movies)}</span></button>` : ""}
        ${result.series > 0 ? `<button type="button" class="historyLibraryAction isSeries" data-history-library="series">Series <span>${escapeHtml(result.series)}</span></button>` : ""}
      </div>
    </div>
    ${result.mode === "year"
      ? renderTemporalHistoryYearList(result)
      : `
        ${renderTemporalHistoryMonthList(result)}
      `
    }
    <p class="statsSectionDetail">
      Las series se asignan al periodo por sus fechas de visionado registradas; no se infieren fechas por temporada.
    </p>
  `;
}

function renderTemporalHistoryMonthList(result) {
  const sortedRows = sortedTemporalHistoryRows(result.rows);
  const visibleCount = Math.min(temporalHistoryMonthVisible, sortedRows.length);
  const rows = sortedRows.slice(0, visibleCount);
  const hasMore = visibleCount < sortedRows.length;
  const canCollapse = visibleCount > 10;

  return `
    <div class="historyMonthList">
      ${rows.map(row => {
        const item = row.item;
        const repeat = row.eventCount > 1 ? `${row.eventCount} visionados` : "";
        return `
          <button
            class="historyMonthRow ${item.kind === "series" ? "isSeries" : "isMovie"}"
            type="button"
            data-history-open="true"
            data-stats-open-kind="${escapeHtml(item.kind || "peliculas")}"
            data-stats-open-status="${escapeHtml(item.status || "vistas")}"
            data-stats-open-id="${escapeHtml(item.id || "")}"
          >
            <span class="historyMonthDate">${escapeHtml(new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(new Date(row.latestAt)))}</span>
            <span class="historyMonthKind">${escapeHtml(item.kind === "series" ? "Serie" : "Película")}</span>
            <strong class="historyMonthTitle">${escapeHtml(item.title || "Sin título")}</strong>
            ${repeat ? `<small class="historyMonthRepeat">${escapeHtml(repeat)}</small>` : ""}
            <span class="historyMonthRating">${escapeHtml(formatRating(row.rating))}</span>
          </button>
        `;
      }).join("")}
    </div>
    ${(hasMore || canCollapse) ? `
      <div class="historyMonthActions">
        ${hasMore ? `
          <button class="historyYearToggle" type="button" data-history-month-more>
            Mostrar 10 más
          </button>
        ` : ""}
        ${canCollapse ? `
          <button class="historyYearToggle historyYearToggleSecondary" type="button" data-history-month-less>
            Mostrar menos
          </button>
        ` : ""}
      </div>
    ` : ""}
  `;
}

function renderTemporalHistoryYearList(result) {
  const sortedRows = sortedTemporalHistoryRows(result.rows);
  const visibleCount = Math.min(temporalHistoryYearVisible, sortedRows.length);
  const rows = sortedRows.slice(0, visibleCount);
  const hasMore = visibleCount < sortedRows.length;
  const canCollapse = visibleCount > 10;

  return `
    <div class="historyYearList">
      ${rows.map(row => {
        const item = row.item;
        const repeat = row.eventCount > 1 ? `${row.eventCount} visionados` : "";
        return `
          <button
            class="historyYearRow ${item.kind === "series" ? "isSeries" : "isMovie"}"
            type="button"
            data-history-open="true"
            data-stats-open-kind="${escapeHtml(item.kind || "peliculas")}"
            data-stats-open-status="${escapeHtml(item.status || "vistas")}"
            data-stats-open-id="${escapeHtml(item.id || "")}"
          >
            <span class="historyYearDate">${escapeHtml(new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(new Date(row.latestAt)))}</span>
            <span class="historyYearKind">${escapeHtml(item.kind === "series" ? "Serie" : "Película")}</span>
            <strong class="historyYearTitle">${escapeHtml(item.title || "Sin título")}</strong>
            ${repeat ? `<small class="historyYearRepeat">${escapeHtml(repeat)}</small>` : ""}
            <span class="historyYearRating">${escapeHtml(formatRating(row.rating))}</span>
          </button>
        `;
      }).join("")}
    </div>
    ${(hasMore || canCollapse) ? `
      <div class="historyYearActions">
        ${hasMore ? `
          <button class="historyYearToggle" type="button" data-history-year-more>
            Mostrar 10 más
          </button>
        ` : ""}
        ${canCollapse ? `
          <button class="historyYearToggle historyYearToggleSecondary" type="button" data-history-year-less>
            Mostrar menos
          </button>
        ` : ""}
      </div>
    ` : ""}
  `;
}

function renderActivityHistory(dashboard) {
  const coverage = dashboard.activityCoverage || {};
  const years = Array.isArray(dashboard.annualActivity) ? dashboard.annualActivity : [];
  const topYear = dashboard.topActivityYear;
  const withoutDate = Number(coverage.withoutDate || 0);

  return `
    <section class="statsSection statsActivityHistorySection" aria-labelledby="stats-history-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Fechas registradas</span>
          <h2 id="stats-history-title">Histórico de actividad</h2>
        </div>
      </div>
      <div class="statsCards statsCardsSingle">
        ${statCard(
          topYear ? topYear.label : "—",
          "Año con más actividad",
          topYear ? `${topYear.count} títulos registrados` : "Sin histórico suficiente"
        )}
      </div>
      ${years.length ? `
        <div class="statsActivityYears">
          ${renderRanking(
            "Actividad por año",
            years,
            "No hay años con actividad registrada.",
            { expandable: true, rankingId: "activity-years" }
          )}
        </div>
      ` : ""}
      ${withoutDate > 0 ? `
        <p class="statsDataWarning">
          ${escapeHtml(withoutDate)} ${withoutDate === 1 ? "título visto no tiene" : "títulos vistos no tienen"} fecha registrada y no ${withoutDate === 1 ? "se incluye" : "se incluyen"} en este histórico.
        </p>
      ` : ""}
      <p class="statsSectionDetail statsActivityHistoryNote">
        El histórico utiliza las fechas de visionado registradas; no reconstruye sesiones ni episodios históricos.
      </p>
    </section>
  `;
}

function renderWatchedByType(summary) {
  const movies = Number(summary?.movies || 0);
  const series = Number(summary?.series || 0);
  const moviesPercentage = Number(summary?.moviesPercentage || 0);
  const seriesPercentage = Number(summary?.seriesPercentage || 0);

  return `
    <section class="statsSection" aria-labelledby="stats-type-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Histórico global</span>
          <h2 id="stats-type-title">Películas vs Series vistas</h2>
        </div>
      </div>
      <div class="statsActivityTypeNumbers">
        <div>
          <strong>${escapeHtml(moviesPercentage)}%</strong>
          <span>Películas · ${escapeHtml(movies)}</span>
        </div>
        <div>
          <strong>${escapeHtml(seriesPercentage)}%</strong>
          <span>Series · ${escapeHtml(series)}</span>
        </div>
      </div>
      <div
        class="statsActivityTypeTrack"
        role="img"
        aria-label="${escapeHtml(moviesPercentage)}% películas y ${escapeHtml(seriesPercentage)}% series"
      >
        <span class="statsActivityTypeMovies" style="width:${escapeHtml(moviesPercentage)}%"></span>
      </div>
    </section>
  `;
}

function renderWatchTime(dashboard) {
  return `
    <section class="statsSection" aria-labelledby="stats-watch-time-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Cobertura de duración</span>
          <h2 id="stats-watch-time-title">Tiempo estimado de contenido visto</h2>
        </div>
      </div>
      <div class="statsCards statsCardsSingle">
        ${statCard(
          formatWatchTime(dashboard.totalMinutes),
          "Contenido visto estimado",
          dashboard.totalMinutes
            ? `${dashboard.durationCoverage.withEstimate} de ${dashboard.durationCoverage.watched} vistos con duración`
            : "Sin duraciones suficientes"
        )}
      </div>
      <p class="statsSectionDetail">
        Estimación basada en las duraciones disponibles de películas y episodios; no es un registro real de horas de visionado.
      </p>
    </section>
  `;
}

function formatRating(value) {
  return Number.isFinite(value)
    ? value.toFixed(1).replace(".", ",")
    : "—";
}

function renderRatingsSummary(dashboard) {
  const ratings = dashboard.ratings?.summary || {};

  return `
    <section class="statsSection" aria-labelledby="stats-ratings-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Tus valoraciones</span>
          <h2 id="stats-ratings-title">Resumen de valoraciones</h2>
        </div>
      </div>
      <div class="statsActivityMetricGrid statsRatingsSummaryGrid">
        ${statCard(formatRating(ratings.jointAverage), "Media conjunta", `${Number(ratings.ratedTitles || 0)} títulos valorados`)}
        ${statCard(formatRating(ratings.adriAverage), `Media ${getRaterDisplayName("adri")}`, "")}
        ${statCard(formatRating(ratings.lauraAverage), `Media ${getRaterDisplayName("laura")}`, "")}
      </div>
    </section>
  `;
}

function renderRatingsByType(ratings) {
  const movies = ratings?.byType?.movies || {};
  const series = ratings?.byType?.series || {};

  return `
    <section class="statsSection" aria-labelledby="stats-ratings-type-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Por tipo de contenido</span>
          <h2 id="stats-ratings-type-title">Películas vs Series</h2>
        </div>
      </div>
      <div class="statsCards">
        ${statCard(formatRating(movies.average), "Películas", `${Number(movies.count || 0)} títulos valorados`)}
        ${statCard(formatRating(series.average), "Series", `${Number(series.count || 0)} títulos valorados`)}
      </div>
    </section>
  `;
}

function renderRatingDistribution(ratings) {
  const items = Array.isArray(ratings?.distribution) ? ratings.distribution : [];
  const max = Math.max(1, ...items.map(item => Number(item.count || 0)));

  return `
    <section class="statsSection" aria-labelledby="stats-rating-distribution-title">
      <div class="statsSectionHead">
        <div>
          <h2 id="stats-rating-distribution-title">Distribución de notas</h2>
        </div>
      </div>
      <div class="statsRatingDistribution">
        ${items.map(item => `
          <div class="statsRatingBand">
            <div class="statsRatingBandLabels">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.count)} títulos</span>
            </div>
            <div class="statsRankingTrack">
              <div class="statsRankingFill" style="width:${Math.round((Number(item.count || 0) / max) * 100)}%"></div>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAffinityList(title, items, emptyMessage, listId) {
  const safeItems = Array.isArray(items) ? items : [];
  const visibleItems = safeItems.slice(0, 10);
  const initial = visibleItems.slice(0, 5);
  const extra = visibleItems.slice(5, 10);

  const rows = list => list.map(item => `
    <div class="statsAffinityRow">
      <div class="statsAffinityMain">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(getRaterDisplayName("adri"))} ${escapeHtml(formatRating(item.adri))} · ${escapeHtml(getRaterDisplayName("laura"))} ${escapeHtml(formatRating(item.laura))}</small>
      </div>
      <span class="statsAffinityDifference">Δ ${escapeHtml(formatRating(item.difference))}</span>
    </div>
  `).join("");

  return `
    <section class="statsAffinityBlock" aria-labelledby="${escapeHtml(listId)}">
      <h3 id="${escapeHtml(listId)}">${escapeHtml(title)}</h3>
      ${safeItems.length ? `
        <div class="statsAffinityList">
          ${rows(initial)}
          ${extra.length ? `
            <details class="statsRankingMore">
              <summary>
                <span class="statsRankingShowMore">Ver más</span>
                <span class="statsRankingShowLess">Ver menos</span>
              </summary>
              <div class="statsAffinityExtra">${rows(extra)}</div>
            </details>
          ` : ""}
        </div>
      ` : `<p class="statsNoData">${escapeHtml(emptyMessage)}</p>`}
    </section>
  `;
}

function renderRatingAffinity(ratings) {
  const affinity = ratings?.affinity || {};
  const paired = Number(affinity.pairedTitles || 0);

  return `
    <section class="statsSection" aria-labelledby="stats-affinity-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">${escapeHtml(getRaterDisplayName("adri"))} y ${escapeHtml(getRaterDisplayName("laura"))}</span>
          <h2 id="stats-affinity-title">Afinidad de valoraciones</h2>
        </div>
      </div>
      <div class="statsCards statsCardsSingle">
        ${statCard(
          formatRating(affinity.averageDifference),
          "Diferencia media",
          paired ? `${paired} títulos con ambas valoraciones` : "Sin títulos comparables"
        )}
      </div>
      <div class="statsAffinityColumns">
        ${renderAffinityList("Mayor discrepancia", affinity.disagreements, "No hay valoraciones comparables.", "stats-disagreements-title")}
      </div>
    </section>
  `;
}

function renderGenreRatings(ratings) {
  const items = Array.isArray(ratings?.genreRatings) ? ratings.genreRatings : [];
  const max = Math.max(1, ...items.map(item => Number(item.average || 0)));
  const initial = items.slice(0, 5);
  const extra = items.slice(5);

  const rows = (list, offset = 0) => list.map((item, index) => `
    <div class="statsRankingRow">
      <span class="statsRankingPosition">${offset + index + 1}</span>
      <div class="statsRankingMain">
        <div class="statsRankingLabels">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(formatRating(item.average))} · ${escapeHtml(item.count)} títulos</span>
        </div>
        <div class="statsRankingTrack">
          <div class="statsRankingFill" style="width:${Math.round((Number(item.average || 0) / max) * 100)}%"></div>
        </div>
      </div>
    </div>
  `).join("");

  return `
    <section class="statsSection statsRanking" aria-labelledby="stats-genre-ratings-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Mínimo 3 títulos valorados</span>
          <h2 id="stats-genre-ratings-title">Géneros mejor valorados</h2>
        </div>
      </div>
      ${items.length ? `
        <div class="statsRankingList">
          ${rows(initial)}
          ${extra.length ? `
            <details class="statsRankingMore">
              <summary>
                <span class="statsRankingShowMore">Ver todos (${items.length})</span>
                <span class="statsRankingShowLess">Ver menos</span>
              </summary>
              <div class="statsRankingExtra">${rows(extra, 5)}</div>
            </details>
          ` : ""}
        </div>
      ` : `
        <p class="statsNoData">
          Aún no hay géneros con al menos 3 títulos valorados.
        </p>
      `}
    </section>
  `;
}

function statCard(value, label, detail) {
  return `
    <article class="statsCard">
      <strong class="statsCardValue">${escapeHtml(value)}</strong>
      <span class="statsCardLabel">${escapeHtml(label)}</span>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function renderActivity(items, coverage) {
  const max = Math.max(1, ...items.map(item => item.count));
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const months = items.length || recentActivityMonths;

  return `
    <section class="statsSection" aria-labelledby="stats-activity-title">
      <div class="statsSectionHead statsActivityHead">
        <div>
          <span class="statsEyebrow">${escapeHtml(recentActivityPeriodLabel(months))}</span>
          <h2 id="stats-activity-title">Actividad de visionado</h2>
        </div>
        <span class="statsSectionMetric">${total} visionado${total === 1 ? "" : "s"}</span>
      </div>
      <div class="statsActivityPeriod" role="group" aria-label="Periodo de actividad reciente">
        ${[1, 3, 6, 12].map(value => `
          <button type="button" class="${recentActivityMonths === value ? "isActive" : ""}" data-activity-months="${value}" aria-pressed="${recentActivityMonths === value ? "true" : "false"}">
            ${value} ${value === 1 ? "mes" : "meses"}
          </button>
        `).join("")}
      </div>
      <p class="statsSectionDetail">
        ${Number(coverage?.withDate || 0)} títulos con fecha registrada de ${Number(coverage?.watched || 0)} vistos
        · ${Number(coverage?.percentage || 0)}% de cobertura temporal
      </p>
      <div class="statsBars statsBarsDynamic" style="--activity-columns:${Math.min(months, 12)}" aria-label="Visionados por mes durante el periodo seleccionado">
        ${items.map(item => `
          <button class="statsBarColumn statsBarAction" type="button" data-activity-bucket="${escapeHtml(item.key)}" data-activity-year="${item.year}" data-activity-month="${item.month}" aria-label="${escapeHtml(item.fullLabel)}: ${item.count} visionado${item.count === 1 ? "" : "s"}. Explorar este mes.">
            <span class="statsBarValue">${item.count}</span>
            <span class="statsBarTrack">
              <span class="statsBarFill" style="height:${Math.max(item.count ? 12 : 2, Math.round((item.count / max) * 100))}%"></span>
            </span>
            <span class="statsBarLabel">${escapeHtml(item.label)}</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderRanking(title, items, emptyMessage, options = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const max = Math.max(1, ...safeItems.map(item => item.count));
  const initialItems = options.expandable ? safeItems.slice(0, 5) : safeItems;
  const extraItems = options.expandable ? safeItems.slice(5) : [];

  const rows = (rankingItems, offset = 0) => rankingItems.map((item, index) => `
    <div class="statsRankingRow">
      <span class="statsRankingPosition">${offset + index + 1}</span>
      <div class="statsRankingMain">
        <div class="statsRankingLabels">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${item.count}</span>
        </div>
        <div class="statsRankingTrack">
          <div class="statsRankingFill"
            style="width:${Math.round((item.count / max) * 100)}%">
          </div>
        </div>
      </div>
    </div>
  `).join("");

  return `
    <section class="statsSection statsRanking">
      <div class="statsSectionHead"><h2>${escapeHtml(title)}</h2></div>
      ${
        safeItems.length
          ? `<div class="statsRankingList">
              ${rows(initialItems)}
              ${extraItems.length ? `
                <details class="statsRankingMore">
                  <summary>
                    <span class="statsRankingShowMore">Ver todos (${safeItems.length})</span>
                    <span class="statsRankingShowLess">Ver menos</span>
                  </summary>
                  <div class="statsRankingExtra">
                    ${rows(extraItems, 5)}
                  </div>
                </details>
              ` : ""}
            </div>`
          : `<p class="statsNoData">${escapeHtml(emptyMessage)}</p>`
      }
    </section>
  `;
}

function renderRecommendations(dashboard) {
  return `
    <section class="statsSection" aria-labelledby="stats-rec-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Entre tus pendientes</span>
          <h2 id="stats-rec-title">Qué ver a continuación</h2>
        </div>
      </div>
      ${
        dashboard.recommendations.length
          ? `<div class="recommendationGrid">
              ${dashboard.recommendations.map(({ item, reasons }) => `
                <button
                  class="recommendationCard"
                  type="button"
                  data-stats-open-kind="${escapeHtml(item.kind)}"
                  data-stats-open-status="${escapeHtml(item.status)}"
                  data-stats-open-id="${escapeHtml(item.id)}"
                >
                  ${
                    item.posterUrl
                      ? `<img src="${escapeHtml(item.posterUrl)}" alt="" loading="lazy">`
                      : `<span class="recommendationPosterFallback">Sin imagen</span>`
                  }
                  <span class="recommendationBody">
                    <strong>${escapeHtml(item.title || "Sin título")}</strong>
                    <small>${escapeHtml([
                      item.year,
                      item.kind === "series" ? "Serie" : "Película"
                    ].filter(Boolean).join(" · "))}</small>
                    <span class="recommendationReasons">
                      ${reasons.map(reason => `<em>${escapeHtml(reason)}</em>`).join("")}
                    </span>
                  </span>
                </button>
              `).join("")}
            </div>`
          : `<p class="statsNoData">No tienes títulos pendientes para recomendar.</p>`
      }
    </section>
  `;
}

function formatWatchTime(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "—";

  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours ? `${days} d ${remainingHours} h` : `${days} d`;
  }

  if (hours) return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  return `${minutes} min`;
}

function prepareRecommendationTargetPage(screenName, id) {
  const keyByScreen = {
    "series-pendientes": KEY.seriesPendientes,
    "series-vistas": KEY.seriesVistas,
    "peliculas-pendientes": KEY.peliculasPendientes,
    "peliculas-vistas": KEY.peliculasVistas
  };

  const key = keyByScreen[screenName];
  if (!key) return false;

  const getVisibleItems = () =>
    applySort(
      applyFilter(
        applySearch(loadArray(key), screenName),
        screenName
      ),
      screenName
    );

  let visibleItems = getVisibleItems();
  let targetIndex = visibleItems.findIndex(item => String(item?.id || "") === String(id));

  // Un clic sobre un título concreto debe llegar al registro. Si la búsqueda o
  // los filtros guardados lo ocultan, se eliminan solo esos criterios incompatibles.
  if (targetIndex < 0) {
    setSearch(screenName, "");
    setFilter(screenName, {
      platforms: [],
      genres: [],
      priorities: [],
      tags: [],
      myPlatformsOnly: false,
      favoritesOnly: false
    });
    updateFilterBadge(screenName);
    syncSearchInput(screenName);

    visibleItems = getVisibleItems();
    targetIndex = visibleItems.findIndex(item => String(item?.id || "") === String(id));
  }

  if (targetIndex < 0) return false;

  setPageState(screenName, Math.floor(targetIndex / PAGE_SIZE) + 1);
  return true;
}

window.addEventListener("ratersconfigchange", () => {
  const root = document.getElementById("statistics-dashboard");
  if (!root || !root.closest(".screen.active")) return;
  renderStatisticsDashboard();
});

function scrollHistoryExplorerToStart() {
  const explorer = document.querySelector(".historyExplorer");
  const screen = explorer?.closest('.screen[data-screen="resumen-home"]');
  if (!explorer || !screen) return;
  const top = Math.max(0, explorer.offsetTop - 10);
  requestAnimationFrame(() => screen.scrollTo({ top, behavior: "auto" }));
}

function historyReturnSnapshot(id) {
  return {
    mode: temporalHistoryState.mode,
    year: temporalHistoryState.year,
    month: temporalHistoryState.month,
    sort: temporalHistorySort,
    monthVisible: temporalHistoryMonthVisible,
    yearVisible: temporalHistoryYearVisible,
    id: String(id || "")
  };
}

window.restoreStatisticsHistoryReturn = function restoreStatisticsHistoryReturn(snapshot) {
  if (!snapshot) return false;
  activeStatisticsTab = "activity";
  temporalHistoryState.mode = snapshot.mode === "year" ? "year" : "month";
  temporalHistoryState.year = Number(snapshot.year) || new Date().getFullYear();
  temporalHistoryState.month = Number(snapshot.month) || new Date().getMonth() + 1;
  temporalHistorySort = ["rating", "date", "title"].includes(snapshot.sort) ? snapshot.sort : "rating";
  temporalHistoryMonthVisible = Math.max(10, Number(snapshot.monthVisible) || 10);
  temporalHistoryYearVisible = Math.max(10, Number(snapshot.yearVisible) || 10);

  setMainTab("resumen");
  requestAnimationFrame(() => {
    const root = document.getElementById("statistics-dashboard");
    if (!root) return;
    const target = snapshot.id
      ? root.querySelector(`[data-history-open="true"][data-stats-open-id="${CSS.escape(snapshot.id)}"]`)
      : null;
    const explorer = root.querySelector(".historyExplorer");
    (target || explorer)?.scrollIntoView({ behavior: "auto", block: target ? "center" : "start" });
  });
  return true;
};

document.addEventListener("click", event => {
  const libraryButton = event.target.closest("[data-history-library]");
  if (libraryButton && typeof window.openLibraryFromStatisticsHistory === "function") {
    const kind = libraryButton.dataset.historyLibrary === "series" ? "series" : "peliculas";
    window.openLibraryFromStatisticsHistory({
      kind,
      mode: temporalHistoryState.mode,
      year: temporalHistoryState.year,
      month: temporalHistoryState.month,
      returnSnapshot: historyReturnSnapshot("")
    });
    return;
  }

  const tabButton = event.target.closest("[data-stats-tab]");
  if (tabButton) {
    const nextTab = tabButton.dataset.statsTab;
    if (!["library", "activity", "ratings"].includes(nextTab)) return;
    if (nextTab === activeStatisticsTab) return;

    activeStatisticsTab = nextTab;
    const dashboard = StatisticsService.buildDashboard({ activityMonths: recentActivityMonths });
    const root = document.getElementById("statistics-dashboard");
    if (!root) return;

    root.querySelectorAll("[data-stats-tab]").forEach(button => {
      const active = button.dataset.statsTab === nextTab;
      button.classList.toggle("isActive", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    const panel = root.querySelector("[data-stats-tab-panel]");
    if (panel) panel.innerHTML = renderStatisticsTab(nextTab, dashboard);

    requestAnimationFrame(() => {
      const screen = root.closest('.screen[data-screen="resumen-home"]');
      if (!screen) return;
      const targetTop = Math.max(0, root.offsetTop - 8);
      screen.scrollTo({ top: targetTop, behavior: "auto" });
    });
    return;
  }

  const emptyAction = event.target.closest(".statsEmpty [data-dashboard-screen]");
  if (emptyAction) {
    setMainTab("anadir");
    showScreen("anadir-home");
    return;
  }

  const profileCard = event.target.closest("[data-stats-smart-collection]");
  if (profileCard && !profileCard.disabled) {
    const collectionId = profileCard.dataset.statsSmartCollection;
    if (collectionId && typeof window.openSmartCollectionFromSummary === "function") {
      window.openSmartCollectionFromSummary(collectionId);
    }
    return;
  }

  const availableCard = event.target.closest("[data-stats-available-scope]");
  if (availableCard) {
    const scope = availableCard.dataset.statsAvailableScope;
    if (scope && typeof window.openLibraryWithPersonalAvailabilityFilter === "function") {
      window.openLibraryWithPersonalAvailabilityFilter(scope);
    }
    return;
  }

  const activityPeriod = event.target.closest("[data-activity-months]");
  if (activityPeriod) {
    const nextMonths = Number(activityPeriod.dataset.activityMonths);
    if (![1, 3, 6, 12].includes(nextMonths) || nextMonths === recentActivityMonths) return;
    recentActivityMonths = nextMonths;
    const panel = document.querySelector("[data-stats-tab-panel]");
    if (panel) panel.innerHTML = renderStatisticsTab("activity", StatisticsService.buildDashboard({ activityMonths: recentActivityMonths }));
    return;
  }

  const activityBucket = event.target.closest("[data-activity-bucket]");
  if (activityBucket) {
    temporalHistoryState.mode = "month";
    temporalHistoryState.year = Number(activityBucket.dataset.activityYear);
    temporalHistoryState.month = Number(activityBucket.dataset.activityMonth);
    temporalHistoryMonthVisible = 10;
    temporalHistoryYearVisible = 10;
    const panel = document.querySelector("[data-stats-tab-panel]");
    if (panel) panel.innerHTML = renderStatisticsTab("activity", StatisticsService.buildDashboard({ activityMonths: recentActivityMonths }));
    requestAnimationFrame(() => document.querySelector(".historyExplorer")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return;
  }

  const historyMode = event.target.closest("[data-history-mode]");
  if (historyMode) {
    temporalHistoryState.mode = historyMode.dataset.historyMode === "year" ? "year" : "month";
    temporalHistoryMonthVisible = 10;
    temporalHistoryYearVisible = 10;
    const panel = document.querySelector("[data-stats-tab-panel]");
    if (panel) panel.innerHTML = renderStatisticsTab("activity", StatisticsService.buildDashboard({ activityMonths: recentActivityMonths }));
    return;
  }

  const monthMore = event.target.closest("[data-history-month-more]");
  if (monthMore) {
    temporalHistoryMonthVisible += 10;
    const results = document.querySelector("[data-history-results]");
    if (results) {
      results.innerHTML = renderTemporalHistoryResults(
        StatisticsService.temporalHistoryQuery(temporalHistoryState)
      );
    }
    return;
  }

  const monthLess = event.target.closest("[data-history-month-less]");
  if (monthLess) {
    temporalHistoryMonthVisible = 10;
    const results = document.querySelector("[data-history-results]");
    if (results) {
      results.innerHTML = renderTemporalHistoryResults(
        StatisticsService.temporalHistoryQuery(temporalHistoryState)
      );
      scrollHistoryExplorerToStart();
    }
    return;
  }

  const yearMore = event.target.closest("[data-history-year-more]");
  if (yearMore) {
    temporalHistoryYearVisible += 10;
    const results = document.querySelector("[data-history-results]");
    if (results) {
      results.innerHTML = renderTemporalHistoryResults(
        StatisticsService.temporalHistoryQuery(temporalHistoryState)
      );
    }
    return;
  }

  const yearLess = event.target.closest("[data-history-year-less]");
  if (yearLess) {
    temporalHistoryYearVisible = 10;
    const results = document.querySelector("[data-history-results]");
    if (results) {
      results.innerHTML = renderTemporalHistoryResults(
        StatisticsService.temporalHistoryQuery(temporalHistoryState)
      );
      scrollHistoryExplorerToStart();
    }
    return;
  }

  const historyCard = event.target.closest('[data-history-open="true"][data-stats-open-id]');
  if (historyCard && typeof DetailView !== "undefined") {
    const kind = historyCard.dataset.statsOpenKind;
    const status = historyCard.dataset.statsOpenStatus;
    const id = historyCard.dataset.statsOpenId;
    if (kind && status && id) {
      DetailView.open({
        kind,
        status,
        id,
        returnScreen: "resumen-home",
        historyReturn: historyReturnSnapshot(id)
      });
      return;
    }
  }

  const card = event.target.closest("[data-stats-open-id]");
  if (!card) return;

  const kind = card.dataset.statsOpenKind;
  const status = card.dataset.statsOpenStatus;
  const id = card.dataset.statsOpenId;
  if (!kind || !status || !id) return;

  const targetScreen =
    kind === "series"
      ? status === "vistas" ? "series-vistas" : "series-pendientes"
      : status === "vistas" ? "peliculas-vistas" : "peliculas-pendientes";

  prepareRecommendationTargetPage(targetScreen, id);
  setMainTab(kind === "series" ? "series" : "peliculas");
  showScreen(targetScreen);

  window.setTimeout(() => {
    const target = document.querySelector(`.itemCard[data-id="${CSS.escape(id)}"]`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("itemCardHighlighted");
    window.setTimeout(() => target.classList.remove("itemCardHighlighted"), 1600);
  }, 50);
});

document.addEventListener("change", event => {
  if (event.target.matches("[data-history-month]")) {
    temporalHistoryState.month = Number(event.target.value);
  } else if (event.target.matches("[data-history-year]")) {
    temporalHistoryState.year = Number(event.target.value);
  } else if (event.target.matches("[data-history-sort]")) {
    temporalHistorySort = ["rating", "date", "title"].includes(event.target.value)
      ? event.target.value
      : "rating";
  } else {
    return;
  }

  temporalHistoryMonthVisible = 10;
  temporalHistoryYearVisible = 10;
  const results = document.querySelector("[data-history-results]");
  if (results) {
    results.innerHTML = renderTemporalHistoryResults(
      StatisticsService.temporalHistoryQuery(temporalHistoryState)
    );
  }
});
