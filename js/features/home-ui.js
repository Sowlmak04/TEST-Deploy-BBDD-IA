// ---------- HOME1 · Inicio accionable ----------
function homeEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderHomeDashboard() {
  const root = document.getElementById("home-dashboard");
  if (!root || typeof StatisticsService === "undefined") return;

  const dashboard = StatisticsService.buildDashboard();
  const continuing = (dashboard.productivity?.continuing || []).slice(0, 3);
  const recommendation = dashboard.recommendations?.[0] || null;
  const available = dashboard.availableNow || {};
  const hasPlatforms = Number(available.configuredPlatforms || 0) > 0;

  root.innerHTML = `
    ${continuing.length ? `
      <section class="homeSection">
        <div class="homeSectionHead">
          <span class="statsEyebrow">Retoma donde estabas</span>
          <h2>Continuar viendo</h2>
        </div>
        <div class="homeContinueList">
          ${continuing.map(({ item, season, episode, nextEpisode }) => `
            <button
              class="homeContinueCard"
              type="button"
              data-stats-open-kind="${homeEscape(item.kind)}"
              data-stats-open-status="${homeEscape(item.status)}"
              data-stats-open-id="${homeEscape(item.id)}"
            >
              <span>
                <strong>${homeEscape(item.title || "Sin título")}</strong>
                <small>Vas por T${homeEscape(season)} · E${homeEscape(episode)}</small>
              </span>
              <b>Siguiente: E${homeEscape(nextEpisode)} ›</b>
            </button>
          `).join("")}
        </div>
      </section>
    ` : ""}

    ${hasPlatforms && Number(available.total || 0) > 0 ? `
      <section class="homeSection">
        <div class="homeSectionHead">
          <span class="statsEyebrow">Tus plataformas contratadas</span>
          <h2>Disponible ahora</h2>
        </div>
        <div class="homeAvailability">
          <button type="button" data-stats-available-scope="peliculas-pendientes">
            <strong>${homeEscape(available.movies || 0)}</strong>
            <span>Películas</span>
          </button>
          <button type="button" data-stats-available-scope="series-pendientes">
            <strong>${homeEscape(available.series || 0)}</strong>
            <span>Series</span>
          </button>
          <div>
            <strong>${homeEscape(available.total || 0)}</strong>
            <span>Total disponible</span>
          </div>
        </div>
      </section>
    ` : ""}

    ${recommendation ? renderHomeRecommendation(recommendation) : ""}

    <section class="homeSection">
      <div class="homeSectionHead">
        <span class="statsEyebrow">Ir directamente</span>
        <h2>Accesos rápidos</h2>
      </div>
      <div class="homeQuickGrid">
        <button type="button" data-home-main="peliculas" data-home-screen="peliculas-pendientes">
          <strong>Películas pendientes</strong><span>Ver biblioteca ›</span>
        </button>
        <button type="button" data-home-main="series" data-home-screen="series-pendientes">
          <strong>Series pendientes</strong><span>Ver biblioteca ›</span>
        </button>
        <button type="button" data-home-main="anadir" data-home-screen="anadir-home">
          <strong>Añadir título</strong><span>Serie o película ＋</span>
        </button>
      </div>
    </section>
  `;
}

function renderHomeRecommendation(entry) {
  const item = entry.item || {};
  const reasons = (entry.reasons || []).slice(0, 2);
  return `
    <section class="homeSection">
      <div class="homeSectionHead">
        <span class="statsEyebrow">Una opción entre tus pendientes</span>
        <h2>Qué ver ahora</h2>
      </div>
      <button
        class="homeRecommendation"
        type="button"
        data-stats-open-kind="${homeEscape(item.kind)}"
        data-stats-open-status="${homeEscape(item.status)}"
        data-stats-open-id="${homeEscape(item.id)}"
      >
        ${item.posterUrl
          ? `<img src="${homeEscape(item.posterUrl)}" alt="" loading="lazy">`
          : `<span class="homePosterFallback">Sin imagen</span>`}
        <span class="homeRecommendationBody">
          <strong>${homeEscape(item.title || "Sin título")}</strong>
          <small>${homeEscape([
            item.year,
            item.kind === "series" ? "Serie" : "Película"
          ].filter(Boolean).join(" · "))}</small>
          ${reasons.length ? `<span>${reasons.map(reason => `<em>${homeEscape(reason)}</em>`).join("")}</span>` : ""}
          <b>Ver ficha ›</b>
        </span>
      </button>
    </section>
  `;
}

document.addEventListener("click", event => {
  const shortcut = event.target.closest("[data-home-main][data-home-screen]");
  if (!shortcut) return;
  setMainTab(shortcut.dataset.homeMain);
  showScreen(shortcut.dataset.homeScreen);
});
