// ---------- KB1.2.2 · Person Insights + perfil externo ----------
const PersonInsightsUI = (() => {
  const screen = document.getElementById("personInsightsScreen");
  const content = document.getElementById("personInsightsContent");
  const title = document.getElementById("personInsightsTitle");
  const back = document.getElementById("personInsightsBack");
  const escape = value => escapeHtml(String(value ?? ""));

  let currentIdentity = null;
  let renderSequence = 0;

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

  function formatDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const [year, month, day] = raw.split("-").map(Number);
    if (!year || !month || !day) return raw;
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" })
      .format(new Date(Date.UTC(year, month - 1, day)));
  }

  function metric(label, value, helper = "") {
    return `<article class="personInsightMetric">
      <span>${escape(label)}</span>
      <strong>${escape(value)}</strong>
      ${helper ? `<small>${escape(helper)}</small>` : ""}
    </article>`;
  }

  function libraryBreakdown(totals) {
    const parts = [];
    if (totals.movies) parts.push(`${totals.movies} película${totals.movies === 1 ? "" : "s"}`);
    if (totals.series) parts.push(`${totals.series} serie${totals.series === 1 ? "" : "s"}`);
    return parts.join(" · ");
  }

  function appearanceLabels(titleItem) {
    const labels = [];
    (Array.isArray(titleItem?.appearances) ? titleItem.appearances : []).forEach(appearance => {
      const character = String(appearance?.character || "").trim();
      labels.push(appearance?.type === "cast" && character ? character : roleLabel(appearance));
    });
    return [...new Set(labels.filter(Boolean))];
  }

  function titleCard(item) {
    const labels = appearanceLabels(item);
    const kind = item.kind === "series" ? "Serie" : "Película";
    const status = item.status === "vistas" ? "Vista" : "Pendiente";
    return `<article class="personInsightTitleCard">
      <div>
        <strong>${escape(item.title || "Sin título")}</strong>
        <span>${escape([String(item.year || "").trim(), kind, status].filter(Boolean).join(" · "))}</span>
      </div>
      ${labels.length ? `<p>${labels.map(label => `<span class="personInsightRoleTag">${escape(label)}</span>`).join("")}</p>` : ""}
    </article>`;
  }

  function localMarkup(insight) {
    const roles = uniqueRoleLabels(insight.roles);
    const average = Number.isFinite(insight.ratings?.average) ? formatNumber(insight.ratings.average) : "Sin valorar";
    const ratedHelper = insight.ratings?.ratedTitles
      ? `${insight.ratings.ratedTitles} título${insight.ratings.ratedTitles === 1 ? "" : "s"} valorado${insight.ratings.ratedTitles === 1 ? "" : "s"}`
      : "Sin títulos valorados";
    const breakdown = libraryBreakdown(insight.totals);

    return `${roles.length || insight.identity.provisional ? `<div class="personInsightIdentityMeta">
      ${roles.length ? `<p>${escape(roles.join(" · "))}</p>` : ""}
      ${insight.identity.provisional ? '<small>Identidad provisional basada en el nombre almacenado.</small>' : ""}
    </div>` : ""}

    <div id="personInsightExternal" class="personInsightExternal" aria-live="polite"></div>

    <section class="personInsightSection" aria-labelledby="personInsightSummaryHeading">
      <div class="personInsightSectionHeading">
        <h3 id="personInsightSummaryHeading">En tu biblioteca</h3>
        ${breakdown ? `<span>${escape(breakdown)}</span>` : ""}
      </div>
      <div class="personInsightMetrics">
        ${metric("Títulos", insight.totals.titles)}
        ${metric("Vistos", insight.totals.watched)}
        ${metric("Pendientes", insight.totals.pending)}
        ${metric("Tu valoración media", average, ratedHelper)}
      </div>
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

  function biographyMarkup(text) {
    const biography = String(text || "").trim();
    if (!biography) return "";
    const long = biography.length > 420;
    return `<div class="personInsightBiography${long ? " is-collapsed" : ""}" data-person-biography>
      <p>${escape(biography)}</p>
      ${long ? '<button type="button" class="personInsightBiographyToggle" data-person-biography-toggle>Ver más</button>' : ""}
    </div>`;
  }

  function profileMarkup(profile) {
    if (!profile) return "";
    const facts = [
      profile.birthday ? `Nacimiento: ${formatDate(profile.birthday)}` : "",
      profile.deathday ? `Fallecimiento: ${formatDate(profile.deathday)}` : "",
      profile.placeOfBirth ? `Lugar: ${profile.placeOfBirth}` : "",
      profile.knownForDepartment ? `Área principal: ${profile.knownForDepartment}` : ""
    ].filter(Boolean);

    return `<section class="personInsightSection personInsightProfile" aria-labelledby="personInsightProfileHeading">
      <div class="personInsightProfileTop">
        ${profile.profileUrl
          ? `<img class="personInsightProfileImage" src="${escape(profile.profileUrl)}" alt="" loading="lazy">`
          : '<div class="personInsightProfileFallback" aria-hidden="true">👤</div>'}
        <div>
          <h3 id="personInsightProfileHeading">Perfil</h3>
          ${facts.length ? `<ul>${facts.map(fact => `<li>${escape(fact)}</li>`).join("")}</ul>` : '<p class="detailEmpty">TMDb no ofrece datos biográficos adicionales.</p>'}
        </div>
      </div>
      ${biographyMarkup(profile.biography)}
    </section>`;
  }

  function discoveryCard(item) {
    const kind = item.mediaType === "tv" ? "Serie" : "Película";
    return `<article class="personInsightDiscoveryCard">
      ${item.posterUrl
        ? `<img src="${escape(item.posterUrl)}" alt="" loading="lazy">`
        : '<div class="personInsightDiscoveryPosterFallback">Sin póster</div>'}
      <div>
        <strong>${escape(item.title)}</strong>
        <span>${escape([item.year, kind].filter(Boolean).join(" · "))}</span>
        ${item.relationship ? `<small>${escape(item.relationship)}</small>` : ""}
      </div>
    </article>`;
  }

  function discoveriesMarkup(items) {
    return `<section class="personInsightSection" aria-labelledby="personInsightDiscoverHeading">
      <div class="personInsightSectionHeading">
        <h3 id="personInsightDiscoverHeading">Para descubrir</h3>
        <span>Fuera de tu biblioteca</span>
      </div>
      ${items.length
        ? `<div class="personInsightDiscoveries">${items.map(discoveryCard).join("")}</div>`
        : '<p class="detailEmpty">No hemos encontrado otros títulos relevantes para descubrir.</p>'}
    </section>`;
  }

  function externalMessage(message) {
    return `<section class="personInsightSection personInsightExternalState"><p>${escape(message)}</p></section>`;
  }

  async function renderExternal(insight, sequence) {
    const target = document.getElementById("personInsightExternal");
    if (!target) return;

    if (insight.identity.provisional || !insight.identity.tmdbId) {
      target.innerHTML = externalMessage("Información externa no disponible para esta persona.");
      return;
    }

    if (!TMDbClient.hasToken()) {
      target.innerHTML = externalMessage("Configura TMDb para consultar el perfil y títulos para descubrir.");
      return;
    }

    target.innerHTML = externalMessage("Consultando perfil y títulos en TMDb…");

    try {
      const external = await TMDbPersonService.get(insight.identity, insight.roles);
      if (sequence !== renderSequence || currentIdentity !== insight.identity.key) return;
      const currentTarget = document.getElementById("personInsightExternal");
      if (!currentTarget) return;

      currentTarget.innerHTML = `${profileMarkup(external.profile)}${discoveriesMarkup(external.discoveries)}`;
    } catch (error) {
      if (sequence !== renderSequence || currentIdentity !== insight.identity.key) return;
      const currentTarget = document.getElementById("personInsightExternal");
      if (!currentTarget) return;
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      currentTarget.innerHTML = externalMessage(
        offline
          ? "Sin conexión: la información de tu biblioteca sigue disponible."
          : "No se ha podido consultar TMDb. La información de tu biblioteca sigue disponible."
      );
      console.warn("No se pudo cargar el perfil externo de la persona.", error);
    }
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

    const sequence = ++renderSequence;
    title.textContent = insight.identity.name || "Person Insights";
    content.innerHTML = localMarkup(insight);
    renderExternal(insight, sequence);
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
    renderSequence += 1;
    document.body.classList.remove("person-insights-open");
    currentIdentity = null;
  }

  back?.addEventListener("click", close);

  content?.addEventListener("click", event => {
    const toggle = event.target.closest("[data-person-biography-toggle]");
    if (!toggle) return;
    const biography = toggle.closest("[data-person-biography]");
    if (!biography) return;
    const collapsed = biography.classList.toggle("is-collapsed");
    toggle.textContent = collapsed ? "Ver más" : "Ver menos";
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains("person-insights-open")) close();
  });

  return Object.freeze({ open, close, render });
})();
