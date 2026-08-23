// ---------- Interfaz de estadísticas, recomendaciones y productividad ----------
let activeStatisticsTab = "library";

function initStatisticsDashboard() {
  const refresh = document.getElementById("btnStatsRefresh");
  refresh?.addEventListener("click", renderStatisticsDashboard);
}

function renderStatisticsDashboard() {
  const root = document.getElementById("statistics-dashboard");
  const updated = document.getElementById("statistics-updated");
  if (!root) return;

  const dashboard = StatisticsService.buildDashboard();

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
      ${renderWatchTime(dashboard)}
      ${methodNote}
    `;
  }

  if (tab === "ratings") {
    return `
      ${renderRatingsSummary(dashboard)}
      ${methodNote}
    `;
  }

  return `
    ${renderSummary(dashboard)}
    ${renderAvailableNow(dashboard.availableNow)}
    <div class="statsTwoColumns">
      ${renderRanking("Géneros más vistos", dashboard.topGenres, "No hay géneros registrados todavía.")}
      ${renderRanking("Disponibilidad en tus plataformas", dashboard.availabilityByPlatform, "No hay plataformas seleccionadas todavía.")}
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
  return `
    <section class="statsTracking" aria-labelledby="stats-tracking-title">
      <div class="statsSectionHead statsTrackingHead">
        <div>
          <span class="statsEyebrow">Tus pendientes</span>
          <h2 id="stats-tracking-title">Seguimiento</h2>
        </div>
      </div>
      <div class="dashboardProductivityGrid">
        ${renderUpcoming(productivity.upcoming)}
        ${renderPriorityReminders(productivity.priority)}
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
                  <span class="productivityMain">
                    <strong>${escapeHtml(item.title || "Sin título")}</strong>
                    <small>${escapeHtml(formatPlannedDate(item.plannedDate))}</small>
                  </span>
                  <span class="productivityCallout ${days < 0 ? "isOverdue" : ""}">
                    ${escapeHtml(relativeDayLabel(days))}
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
              ${items.map(({ item, ageDays }) => `
                ${productivityButton(item, `
                  <span class="productivityMain">
                    <strong>${escapeHtml(item.title || "Sin título")}</strong>
                    <small>${escapeHtml(item.kind === "series" ? "Serie" : "Película")}</small>
                  </span>
                  <span class="productivityCallout">
                    ${ageDays ? `${ageDays} d pendiente` : "Recién añadido"}
                  </span>
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

function renderWatchTime(dashboard) {
  return `
    <section class="statsSection" aria-labelledby="stats-watch-time-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Cobertura de duración</span>
          <h2 id="stats-watch-time-title">Tiempo estimado</h2>
        </div>
      </div>
      <div class="statsCards statsCardsSingle">
        ${statCard(
          formatWatchTime(dashboard.totalMinutes),
          "Tiempo estimado visto",
          dashboard.totalMinutes
            ? `${dashboard.durationCoverage.withEstimate} de ${dashboard.durationCoverage.watched} vistos con duración`
            : "Sin duraciones suficientes"
        )}
      </div>
    </section>
  `;
}

function renderRatingsSummary(dashboard) {
  const rating = Number.isFinite(dashboard.averageRating)
    ? dashboard.averageRating.toFixed(1).replace(".", ",")
    : "—";

  return `
    <section class="statsSection" aria-labelledby="stats-ratings-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Tus valoraciones</span>
          <h2 id="stats-ratings-title">Valoraciones</h2>
        </div>
      </div>
      <div class="statsCards statsCardsSingle">
        ${statCard(
          rating,
          "Nota media",
          dashboard.hasWatched ? "Media de Adri y Laura" : "Añade valoraciones"
        )}
      </div>
      <p class="statsSectionDetail statsRatingsFuture">
        Esta sección se ampliará con estadísticas de valoración en una fase posterior.
      </p>
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

  return `
    <section class="statsSection" aria-labelledby="stats-activity-title">
      <div class="statsSectionHead">
        <div>
          <span class="statsEyebrow">Últimos 6 meses</span>
          <h2 id="stats-activity-title">Actividad de visionado</h2>
        </div>
        <span class="statsSectionMetric">${total} título${total === 1 ? "" : "s"}</span>
      </div>
      <p class="statsSectionDetail">
        ${Number(coverage?.withDate || 0)} títulos con fecha registrada de ${Number(coverage?.watched || 0)} vistos
      </p>
      <div class="statsBars" role="img" aria-label="Títulos vistos por mes durante los últimos seis meses">
        ${items.map(item => `
          <div class="statsBarColumn">
            <span class="statsBarValue">${item.count}</span>
            <div class="statsBarTrack">
              <div class="statsBarFill"
                style="height:${Math.max(item.count ? 12 : 2, Math.round((item.count / max) * 100))}%">
              </div>
            </div>
            <span class="statsBarLabel">${escapeHtml(item.label)}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderRanking(title, items, emptyMessage) {
  const max = Math.max(1, ...items.map(item => item.count));

  return `
    <section class="statsSection statsRanking">
      <div class="statsSectionHead"><h2>${escapeHtml(title)}</h2></div>
      ${
        items.length
          ? `<div class="statsRankingList">
              ${items.map((item, index) => `
                <div class="statsRankingRow">
                  <span class="statsRankingPosition">${index + 1}</span>
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
              `).join("")}
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

document.addEventListener("click", event => {
  const tabButton = event.target.closest("[data-stats-tab]");
  if (tabButton) {
    const nextTab = tabButton.dataset.statsTab;
    if (!["library", "activity", "ratings"].includes(nextTab)) return;

    activeStatisticsTab = nextTab;
    const dashboard = StatisticsService.buildDashboard();
    const root = document.getElementById("statistics-dashboard");
    if (!root) return;

    root.querySelectorAll("[data-stats-tab]").forEach(button => {
      const active = button.dataset.statsTab === nextTab;
      button.classList.toggle("isActive", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    const panel = root.querySelector("[data-stats-tab-panel]");
    if (panel) panel.innerHTML = renderStatisticsTab(nextTab, dashboard);
    return;
  }

  const emptyAction = event.target.closest(".statsEmpty [data-dashboard-screen]");
  if (emptyAction) {
    setMainTab("anadir");
    showScreen("anadir-home");
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