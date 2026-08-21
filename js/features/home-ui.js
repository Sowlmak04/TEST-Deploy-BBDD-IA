// ---------- HOME2 · Inicio accionable y dinámico ----------
function homeEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let homeRecommendationId = null;
let homeRecommendations = [];

function pickHomeRecommendation(recommendations, excludeId = null) {
  const entries = Array.isArray(recommendations) ? recommendations.filter(entry => entry?.item) : [];
  if (!entries.length) return null;

  const alternatives = excludeId == null
    ? entries
    : entries.filter(entry => String(entry.item.id) !== String(excludeId));
  const pool = alternatives.length ? alternatives : entries;
  return pool[Math.floor(Math.random() * pool.length)] || null;
}

function renderHomeDashboard() {
  const root = document.getElementById("home-dashboard");
  if (!root || typeof StatisticsService === "undefined") return;

  const dashboard = StatisticsService.buildDashboard();
  homeRecommendations = Array.isArray(dashboard.availableRecommendations)
    ? dashboard.availableRecommendations
    : [];
  const continuing = (dashboard.productivity?.continuing || []).slice(0, 3);
  const recommendation = pickHomeRecommendation(homeRecommendations, homeRecommendationId);
  homeRecommendationId = recommendation?.item?.id ?? null;
  const available = dashboard.availableNow || {};
  const hasPlatforms = Number(available.configuredPlatforms || 0) > 0;
  const hasPersonalAvailability = Number(available.total || 0) > 0;

  root.innerHTML = `
    ${continuing.length ? `
      <section class="homeSection">
        <div class="homeSectionHead">
          <span class="statsEyebrow">Retoma donde estabas</span>
          <h2>Continuar viendo</h2>
        </div>
        <div class="homeContinueList">
          ${continuing.map(({ item, season, episode, nextSeason, nextEpisode }) => `
            <button
              class="homeContinueCard"
              type="button"
              data-stats-open-kind="${homeEscape(item.kind)}"
              data-stats-open-status="${homeEscape(item.status)}"
              data-stats-open-id="${homeEscape(item.id)}"
            >
              ${item.posterUrl
                ? `<img class="homeContinuePoster" src="${homeEscape(item.posterUrl)}" alt="" loading="lazy">`
                : `<span class="homeContinuePoster homePosterFallback">Sin imagen</span>`}
              <span class="homeContinueBody">
                <strong>${homeEscape(item.title || "Sin título")}</strong>
                <small>Vas por T${homeEscape(season)} · E${homeEscape(episode)}</small>
                <b>Siguiente: T${homeEscape(nextSeason)} · E${homeEscape(nextEpisode)} ›</b>
              </span>
            </button>
          `).join("")}
        </div>
      </section>
    ` : ""}

    ${hasPersonalAvailability ? `
      <section class="homeSection">
        <div class="homeSectionHead">
          <span class="statsEyebrow">Lo que puedes ver</span>
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

    ${recommendation
      ? renderHomeRecommendation(recommendation)
      : renderHomeRecommendationEmpty({ hasPlatforms, hasPersonalAvailability })}

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

function renderHomeRecommendationEmpty({ hasPlatforms, hasPersonalAvailability }) {
  let message = "Ahora mismo no tienes pendientes disponibles para ti.";
  if (!hasPlatforms && !hasPersonalAvailability) {
    message = "Configura Mis plataformas o marca títulos de tu colección propia para que Inicio pueda proponerte algo que puedas ver ahora.";
  }
  return `
    <section class="homeSection homeRecommendationSection">
      <div class="homeSectionHead"><span>
        <span class="statsEyebrow">Disponible para ti</span><h2>Qué ver ahora</h2>
      </span></div>
      <div class="statsEmpty">${homeEscape(message)}</div>
    </section>`;
}

function renderHomeRecommendation(entry) {
  const item = entry.item || {};
  const reasons = (entry.reasons || []).slice(0, 2);
  return `
    <section class="homeSection homeRecommendationSection">
      <div class="homeSectionHead homeRecommendationHead">
        <span>
          <span class="statsEyebrow">Disponible para ti</span>
          <h2>Qué ver ahora</h2>
        </span>
        <button class="homeRefreshRecommendation" type="button" data-home-refresh-recommendation>Otra opción ↻</button>
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
  const refreshRecommendation = event.target.closest("[data-home-refresh-recommendation]");
  if (refreshRecommendation) {
    const root = document.getElementById("home-dashboard");
    if (!root) return;
    const recommendation = pickHomeRecommendation(homeRecommendations, homeRecommendationId);
    if (!recommendation) return;
    homeRecommendationId = recommendation.item?.id ?? null;
    const current = root.querySelector(".homeRecommendationSection");
    if (current) current.outerHTML = renderHomeRecommendation(recommendation);
    return;
  }

  const shortcut = event.target.closest("[data-home-main][data-home-screen]");
  if (!shortcut) return;
  setMainTab(shortcut.dataset.homeMain);
  showScreen(shortcut.dataset.homeScreen);
});
