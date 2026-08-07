// ---------- KB1.2 · Primera interfaz de Person Insights ----------
const PersonInsightsUI = (() => {
  const screen = document.getElementById("personInsightsScreen");
  const content = document.getElementById("personInsightsContent");
  const title = document.getElementById("personInsightsTitle");
  const back = document.getElementById("personInsightsBack");
  const escape = value => escapeHtml(String(value ?? ""));

  let currentIdentity = null;

  const ROLE_LABELS = {
    Actor: "Interpretación",
    Director: "Dirección",
    Writer: "Guion",
    Screenplay: "Guion",
    "Executive Producer": "Producción ejecutiva",
    "Original Music Composer": "Música / Compositor",
    Music: "Música / Compositor",
    "Music Composer": "Música / Compositor",
    Composer: "Música / Compositor",
    "Main Title Theme Composer": "Música / Compositor",
    "Theme Song Performance": "Música / Compositor",
    Creador: "Creación"
  };

  function roleLabel(role) {
    return ROLE_LABELS[role?.job] || String(role?.job || "Participación").trim();
  }

  function uniqueRoleLabels(roles) {
    return [...new Set((Array.isArray(roles) ? roles : []).map(roleLabel).filter(Boolean))];
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(number)
      : "—";
  }

  function formatDateReference(reference, type) {
    if (!reference?.timestamp) return "";
    const date = new Date(reference.timestamp);
    if (Number.isNaN(date.getTime())) return "";

    if (type === "release" && reference.precision === "year") {
      return String(reference.value || date.getUTCFullYear());
    }

    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function metric(label, value, helper = "") {
    return `<article class="personInsightMetric">
      <span>${escape(label)}</span>
      <strong>${escape(value)}</strong>
      ${helper ? `<small>${escape(helper)}</small>` : ""}
    </article>`;
  }

  function chronologyRow(label, reference, type) {
    if (!reference) return "";
    const date = formatDateReference(reference, type);
    if (!date) return "";
    return `<div class="personInsightChronologyRow">
      <dt>${escape(label)}</dt>
      <dd><strong>${escape(reference.item?.title || "Sin título")}</strong><span>${escape(date)}</span></dd>
    </div>`;
  }

  function appearanceLabels(titleItem) {
    const appearances = Array.isArray(titleItem?.appearances) ? titleItem.appearances : [];
    const labels = [];
    appearances.forEach(appearance => {
      const role = roleLabel(appearance);
      const character = String(appearance?.character || "").trim();
      labels.push(character && appearance.type === "cast" ? `${role}: ${character}` : role);
    });
    return [...new Set(labels.filter(Boolean))];
  }

  function titleCard(item) {
    const labels = appearanceLabels(item);
    const kind = item.kind === "series" ? "Serie" : "Película";
    const status = item.status === "vistas" ? "Vista" : "Pendiente";
    const year = String(item.year || "").trim();
    return `<article class="personInsightTitleCard">
      <div>
        <strong>${escape(item.title || "Sin título")}</strong>
        <span>${escape([kind, year, status].filter(Boolean).join(" · "))}</span>
      </div>
      ${labels.length ? `<p>${labels.map(label => `<span class="personInsightRoleTag">${escape(label)}</span>`).join("")}</p>` : ""}
    </article>`;
  }

  function renderNotFound() {
    title.textContent = "Person Insights";
    content.innerHTML = '<div class="detailViewError">No se ha podido localizar esta persona en tu biblioteca.</div>';
  }

  function render() {
    const insight = PersonInsightsService.getByIdentity(currentIdentity);
    if (!insight) {
      renderNotFound();
      return;
    }

    const roles = uniqueRoleLabels(insight.roles);
    const average = Number.isFinite(insight.ratings?.average)
      ? formatNumber(insight.ratings.average)
      : "Sin valorar";
    const ratedHelper = insight.ratings?.ratedTitles
      ? `Basada en ${insight.ratings.ratedTitles} título${insight.ratings.ratedTitles === 1 ? "" : "s"} valorado${insight.ratings.ratedTitles === 1 ? "" : "s"}.`
      : "No hay títulos con valoración personal.";

    title.textContent = insight.identity.name || "Person Insights";
    content.innerHTML = `<article class="personInsightHero">
      <p class="detailHeroEyebrow">Presencia en tu biblioteca</p>
      <h2>${escape(insight.identity.name)}</h2>
      ${roles.length ? `<p>${escape(roles.join(" · "))}</p>` : ""}
      ${insight.identity.provisional ? '<small>Identidad provisional basada en el nombre almacenado.</small>' : ""}
    </article>

    <section class="personInsightSection" aria-labelledby="personInsightSummaryHeading">
      <h3 id="personInsightSummaryHeading">Resumen</h3>
      <div class="personInsightMetrics">
        ${metric("Títulos", insight.totals.titles)}
        ${metric("Películas", insight.totals.movies)}
        ${metric("Series", insight.totals.series)}
        ${metric("Vistos", insight.totals.watched)}
        ${metric("Pendientes", insight.totals.pending)}
        ${metric("Tu valoración media", average, ratedHelper)}
      </div>
    </section>

    <section class="personInsightSection" aria-labelledby="personInsightTimelineHeading">
      <h3 id="personInsightTimelineHeading">Trayectoria en tu biblioteca</h3>
      <dl class="personInsightChronology">
        ${chronologyRow("Obra más antigua", insight.dates.firstRelease, "release")}
        ${chronologyRow("Obra más reciente", insight.dates.lastRelease, "release")}
        ${chronologyRow("Primera incorporación", insight.dates.firstAdded, "added")}
        ${chronologyRow("Última incorporación", insight.dates.lastAdded, "added")}
        ${chronologyRow("Primer visionado", insight.dates.firstWatched, "watched")}
        ${chronologyRow("Último visionado", insight.dates.lastWatched, "watched")}
      </dl>
      ${Object.values(insight.dates || {}).some(Boolean) ? "" : '<p class="detailEmpty">No hay fechas fiables disponibles.</p>'}
    </section>

    <section class="personInsightSection" aria-labelledby="personInsightTitlesHeading">
      <div class="personInsightSectionHeading">
        <h3 id="personInsightTitlesHeading">Títulos relacionados</h3>
        <span>${escape(`${insight.totals.titles} título${insight.totals.titles === 1 ? "" : "s"}`)}</span>
      </div>
      <div class="personInsightTitles">
        ${insight.titles.length ? insight.titles.map(titleCard).join("") : '<p class="detailEmpty">No hay títulos relacionados.</p>'}
      </div>
    </section>`;
  }

  function open(identity) {
    const normalized = typeof identity === "string"
      ? identity
      : PersonInsightsService.identityOf(identity)?.key;
    if (!normalized) return;
    currentIdentity = normalized;
    render();
    document.body.classList.add("person-insights-open");
    screen.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function close() {
    document.body.classList.remove("person-insights-open");
    currentIdentity = null;
  }

  back?.addEventListener("click", close);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains("person-insights-open")) {
      close();
    }
  });

  return Object.freeze({ open, close, render });
})();
