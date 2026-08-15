// ---------- KB1.4.1 · Vista previa externa TMDb ----------
const ExternalTitlePreview = (() => {
  const screen = document.getElementById("externalTitlePreviewScreen");
  const content = document.getElementById("externalTitlePreviewContent");
  const title = document.getElementById("externalTitlePreviewTitle");
  const back = document.getElementById("externalTitlePreviewBack");
  const escape = value => escapeHtml(String(value ?? ""));

  let context = null;
  let requestSequence = 0;
  let loadedItem = null;
  let loadedAvailability = null;
  let addFlowActive = false;

  const list = value => Array.isArray(value) ? value.filter(Boolean) : [];

  function formatDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const [year, month, day] = raw.split("-").map(Number);
    if (!year || !month || !day) return raw;
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" })
      .format(new Date(Date.UTC(year, month - 1, day)));
  }

  function row(label, value) {
    const text = String(value ?? "").trim();
    return `<div class="externalPreviewMetaRow"><dt>${escape(label)}</dt><dd class="${text ? "" : "detailEmpty"}">${escape(text || "No disponible")}</dd></div>`;
  }

  function section(heading, body, open = false) {
    return `<details class="detailSection externalPreviewSection" ${open ? "open" : ""}>
      <summary><span>${escape(heading)}</span></summary>
      <div class="detailSectionBody">${body}</div>
    </details>`;
  }

  function castMarkup(item) {
    const cast = list(item.cast).slice(0, 10);
    if (!cast.length) return '<p class="detailEmpty">TMDb no ofrece información de reparto.</p>';
    return `<div class="externalPreviewCastGrid">${cast.map(person => `<article class="externalPreviewCastCard">
      ${person.profileUrl ? `<img src="${escape(person.profileUrl)}" alt="" loading="lazy">` : '<div class="detailCastPhotoEmpty" aria-hidden="true">👤</div>'}
      <div><strong>${escape(person.name)}</strong><span>${escape(person.character || "Personaje no disponible")}</span></div>
    </article>`).join("")}</div>`;
  }

  function crewMarkup(item, kind) {
    const creators = list(item.creators).map(person => person.name).filter(Boolean);
    const crew = list(item.crew);
    const directors = crew.filter(person => person.job === "Director").map(person => person.name);
    const writers = crew.filter(person => person.job === "Writer" || person.job === "Screenplay").map(person => person.name);
    const composers = crew.filter(person => /music|composer/i.test(person.job || "")).map(person => person.name);
    const rows = [];
    if (kind === "series" && creators.length) rows.push(["Creación", creators]);
    if (directors.length) rows.push(["Dirección", directors]);
    if (writers.length) rows.push(["Guion", writers]);
    if (composers.length) rows.push(["Música", composers]);
    if (!rows.length) return '<p class="detailEmpty">No hay equipo técnico principal disponible.</p>';
    return `<dl class="externalPreviewCrew">${rows.map(([label, names]) => `<div><dt>${escape(label)}</dt><dd>${escape([...new Set(names)].join(", "))}</dd></div>`).join("")}</dl>`;
  }

  function trailerMarkup(item) {
    const trailer = item?.trailer && typeof item.trailer === "object" ? item.trailer : null;
    const site = String(trailer?.site || "").trim().toLowerCase();
    const key = String(trailer?.key || "").trim();
    if (site !== "youtube" || !key) return '<p class="detailEmpty">No hay un tráiler compatible disponible.</p>';
    const embed = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?rel=0`;
    const watch = `https://www.youtube.com/watch?v=${encodeURIComponent(key)}`;
    return `<div class="detailTrailer"><div class="detailTrailerFrame"><iframe src="${escape(embed)}" title="${escape(trailer.name || "Tráiler")}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><a class="toolBtn detailTrailerLink" href="${escape(watch)}" target="_blank" rel="noopener noreferrer">Ver en YouTube</a></div>`;
  }

  function providerKey(provider) {
    const id = Number(provider?.providerId ?? provider?.id);
    if (Number.isFinite(id) && id > 0) return `id:${id}`;
    return `name:${typeof PlatformAvailabilityMatch !== "undefined" ? PlatformAvailabilityMatch.normalize(provider?.name || provider?.providerName || "") : String(provider?.name || "").toLowerCase()}`;
  }

  function availabilityMarkup(availability) {
    if (!availability || availability.error) {
      return '<p class="detailEmpty">No se ha podido consultar la disponibilidad en España.</p>';
    }
    const providers = list(availability.watchProviders);
    const matches = typeof PlatformAvailabilityMatch !== "undefined"
      ? PlatformAvailabilityMatch.matchingProviders(availability)
      : [];
    const matchingKeys = new Set(matches.map(providerKey));
    const selectedCount = typeof UserPlatformsRepository !== "undefined"
      ? list(UserPlatformsRepository.loadSelection()?.providers).length
      : 0;
    const matchNames = matches.map(provider => provider.name || provider.providerName).filter(Boolean);

    const summary = !selectedCount
      ? "No has seleccionado plataformas en Mis plataformas."
      : matchNames.length
        ? `Disponible en tus plataformas: ${matchNames.join(", ")}.`
        : "No coincide con ninguna de tus plataformas seleccionadas.";

    const grid = providers.length
      ? `<div class="externalPreviewProviderGrid">${providers.map(provider => {
          const match = matchingKeys.has(providerKey(provider));
          return `<article class="externalPreviewProviderCard${match ? " is-match" : ""}">
            ${provider.logoUrl ? `<img src="${escape(provider.logoUrl)}" alt="" loading="lazy">` : '<div class="detailProviderLogoEmpty" aria-hidden="true">▶</div>'}
            <strong>${escape(provider.name)}</strong>${match ? '<span>Tu plataforma</span>' : ''}
          </article>`;
        }).join("")}</div>`
      : '<p class="detailEmpty">No está disponible mediante suscripción en España.</p>';

    return `<div class="externalPreviewAvailability"><p class="externalPreviewAvailabilitySummary${matchNames.length ? " is-match" : ""}">${escape(summary)}</p>${grid}</div>`;
  }

  function libraryHasTmdbTitle(tmdbId, mediaType) {
    const id = Number(tmdbId);
    if (!Number.isInteger(id) || id <= 0) return false;
    const keys = mediaType === "tv"
      ? [KEY.seriesPendientes, KEY.seriesVistas]
      : [KEY.peliculasPendientes, KEY.peliculasVistas];
    return keys.some(key => LibraryRepository.getAll(key).some(item => Number(item?.tmdbId) === id));
  }

  function addTarget() {
    const isSeries = context?.mediaType === "tv";
    return {
      formId: isSeries ? "form-series-pendientes" : "form-peliculas-pendientes",
      screen: isSeries ? "anadir-series-pendientes" : "anadir-peliculas-pendientes",
      libraryScreen: isSeries ? "series-pendientes" : "peliculas-pendientes",
      label: isSeries ? "Añadir a Series pendientes" : "Añadir a Películas pendientes"
    };
  }

  function mergedDetails() {
    return {
      ...(loadedItem || {}),
      watchRegion: "ES",
      watchProviders: [],
      watchProvidersLink: "",
      watchProvidersUpdatedAt: "",
      ...(loadedAvailability && !loadedAvailability.error ? loadedAvailability : {})
    };
  }

  function startAddFlow() {
    if (!context || !loadedItem) return;
    if (libraryHasTmdbTitle(context.id, context.mediaType)) {
      alert("Este título ya está en tu biblioteca.");
      return;
    }

    const target = addTarget();
    const form = document.getElementById(target.formId);
    if (!form || typeof showScreen !== "function" || typeof fillFormFromTMDb !== "function") {
      alert("No se ha podido abrir el formulario de alta.");
      return;
    }

    addFlowActive = true;
    form.dataset.externalPreviewAdd = "1";
    form.dataset.externalPreviewTmdbId = String(context.id);
    form.dataset.externalPreviewMediaType = context.mediaType;

    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.blur === "function") activeElement.blur();

    document.body.classList.remove("external-title-preview-open");
    document.body.classList.remove("detail-view-open");
    showScreen(target.screen);
    fillFormFromTMDb(form, mergedDetails());

    const message = form.querySelector(".msg");
    if (message) {
      message.textContent = "Ficha cargada desde Para descubrir. Revisa los datos antes de guardar.";
      message.className = "msg ok";
    }
  }

  function restoreFromAddForm() {
    if (!addFlowActive || !context || !loadedItem) return false;
    const target = addTarget();
    const form = document.getElementById(target.formId);
    if (form) {
      delete form.dataset.externalPreviewAdd;
      delete form.dataset.externalPreviewTmdbId;
      delete form.dataset.externalPreviewMediaType;
    }
    addFlowActive = false;
    document.body.classList.add("detail-view-open");
    document.body.classList.add("external-title-preview-open");
    screen.scrollTop = 0;
    render(loadedItem, loadedAvailability);
    return true;
  }

  function personTmdbIdFromIdentity(identity) {
    const match = String(identity || "").match(/^tmdb:(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  function render(item, availability) {
    loadedItem = item;
    loadedAvailability = availability;
    const kind = context.mediaType === "tv" ? "series" : "movie";
    const kindLabel = kind === "series" ? "Serie" : "Película";
    const countries = list(item.originCountries).join(", ");
    const languages = list(item.spokenLanguages).join(", ");
    const synopsis = String(item.synopsis || "").trim();
    const rating = Number(item.tmdbVoteAverage);
    const heroBackground = item.backdropUrl ? ` style="--external-preview-backdrop:url('${escape(item.backdropUrl)}')"` : "";

    title.textContent = item.title || context.title || "Vista previa";
    content.innerHTML = `<article class="externalPreviewHero"${heroBackground}>
      <div class="externalPreviewHeroShade"></div>
      <div class="externalPreviewHeroContent">
        ${item.posterUrl ? `<img src="${escape(item.posterUrl)}" alt="Póster de ${escape(item.title)}" class="externalPreviewPoster">` : '<div class="externalPreviewPoster externalPreviewPosterEmpty">Sin póster</div>'}
        <div class="externalPreviewHeroText">
          <p class="detailHeroEyebrow">${escape(kindLabel)} · Fuera de tu biblioteca</p>
          <h2>${escape(item.title || context.title || "Sin título")}</h2>
          ${item.originalTitle && item.originalTitle !== item.title ? `<p class="externalPreviewOriginalTitle">${escape(item.originalTitle)}</p>` : ""}
          ${item.tagline ? `<p class="detailTagline">${escape(item.tagline)}</p>` : ""}
          <p>${escape([item.year, item.genre].filter(Boolean).join(" · "))}</p>
          ${Number.isFinite(rating) && rating > 0 ? `<div class="externalPreviewRating">TMDb <strong>${escape(rating.toFixed(1).replace(".", ","))}</strong>/10</div>` : ""}
          <span class="externalPreviewReadonly">Vista previa · Revisa antes de añadir</span>
          <button type="button" class="btnPrimary externalPreviewAddBtn" data-external-preview-add>${escape(addTarget().label)}</button>
        </div>
      </div>
    </article>

    <div class="detailSections externalPreviewSections">
      ${section("Resumen e información", `<div class="detailSynopsis ${synopsis ? "" : "detailEmpty"}">${escape(synopsis || "Sin sinopsis disponible.")}</div><dl class="externalPreviewMetaGrid">
        ${row("Título original", item.originalTitle)}
        ${row(kind === "series" ? "Primera emisión" : "Estreno", formatDate(item.releaseDate))}
        ${kind === "series" ? row("Última emisión", formatDate(item.lastAirDate)) : ""}
        ${row("Géneros", item.genre)}
        ${row("Duración", item.duration)}
        ${kind === "series" ? row("Temporadas", item.seasons) : ""}
        ${kind === "series" ? row("Episodios", item.episodes) : ""}
        ${row("Idiomas hablados", languages)}
        ${row("Países de origen", countries)}
        ${row("Estado", item.productionStatus || item.tmdbStatus)}
      </dl>`, true)}
      ${section("Reparto principal", castMarkup(item))}
      ${section("Equipo técnico", crewMarkup(item, kind))}
      ${section("Disponibilidad en España", availabilityMarkup(availability), true)}
      ${section("Tráiler", trailerMarkup(item))}
    </div>`;
  }

  function renderError(message) {
    title.textContent = context?.title || "Vista previa externa";
    content.innerHTML = `<div class="detailViewError">${escape(message)}</div>`;
  }

  async function load(sequence) {
    if (!TMDbClient.hasToken()) {
      renderError("Configura TMDb para consultar esta vista previa.");
      return;
    }
    content.innerHTML = '<div class="externalPreviewLoading">Consultando ficha y disponibilidad en TMDb…</div>';
    const kind = context.mediaType === "tv" ? "series" : "movie";
    try {
      const [detailsResult, availabilityResult] = await Promise.allSettled([
        TMDbClient.details(context.id, kind),
        TMDbClient.watchProviders(context.id, kind, "ES")
      ]);
      if (sequence !== requestSequence || !context) return;
      if (detailsResult.status !== "fulfilled") throw detailsResult.reason;
      render(detailsResult.value, availabilityResult.status === "fulfilled" ? availabilityResult.value : { error: true });
    } catch (error) {
      if (sequence !== requestSequence || !context) return;
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      renderError(offline ? "Sin conexión: esta ficha externa necesita TMDb." : "No se ha podido cargar esta ficha desde TMDb.");
      console.warn("No se pudo cargar la vista previa externa.", error);
    }
  }

  function open(value) {
    const id = Number(value?.id);
    if (!Number.isInteger(id) || id <= 0 || !value?.personIdentity) return;
    context = {
      id,
      mediaType: value.mediaType === "tv" ? "tv" : "movie",
      title: String(value.title || "").trim(),
      personIdentity: String(value.personIdentity || "").trim()
    };
    const sequence = ++requestSequence;
    loadedItem = null;
    loadedAvailability = null;
    addFlowActive = false;
    document.body.classList.remove("person-insights-open");
    document.body.classList.add("external-title-preview-open");
    screen.scrollTop = 0;
    title.textContent = context.title || "Vista previa externa";
    load(sequence);
  }

  function close() {
    if (!context) return;
    const personIdentity = context.personIdentity;
    requestSequence += 1;
    context = null;
    loadedItem = null;
    loadedAvailability = null;
    addFlowActive = false;
    document.body.classList.remove("external-title-preview-open");
    if (typeof PersonInsightsUI !== "undefined") PersonInsightsUI.open(personIdentity, { fromPreview: true });
  }

  content?.addEventListener("click", event => {
    const button = event.target.closest("[data-external-preview-add]");
    if (button) startAddFlow();
  });

  ["form-series-pendientes", "form-peliculas-pendientes"].forEach(formId => {
    const form = document.getElementById(formId);
    const backButton = form?.closest(".screen")?.querySelector(".backBtn");
    backButton?.addEventListener("click", event => {
      if (!form.dataset.externalPreviewAdd) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      restoreFromAddForm();
    });
  });

  document.addEventListener("library:pending-added", event => {
    if (!addFlowActive || !context) return;
    const addedId = Number(event.detail?.tmdbId);
    const addedType = event.detail?.tmdbType === "tv" ? "tv" : "movie";
    const addedItemId = String(event.detail?.itemId || "");
    if (addedId !== Number(context.id) || addedType !== context.mediaType) return;

    const personTmdbId = personTmdbIdFromIdentity(context.personIdentity);
    if (personTmdbId && typeof TMDbPersonService !== "undefined") {
      TMDbPersonService.invalidate(personTmdbId);
    }

    const target = addTarget();
    const form = document.getElementById(target.formId);
    if (form) {
      delete form.dataset.externalPreviewAdd;
      delete form.dataset.externalPreviewTmdbId;
      delete form.dataset.externalPreviewMediaType;
    }

    requestSequence += 1;
    context = null;
    loadedItem = null;
    loadedAvailability = null;
    addFlowActive = false;
    document.body.classList.remove("external-title-preview-open");
    document.body.classList.remove("person-insights-open");
    document.body.classList.remove("detail-view-open");

    if (typeof LibraryTargetNavigation !== "undefined") {
      LibraryTargetNavigation.open({
        key: event.detail?.key,
        screenName: target.libraryScreen,
        itemId: addedItemId
      });
    } else if (typeof showScreen === "function") {
      showScreen(target.libraryScreen);
    }

    if (typeof showToast === "function") {
      showToast(addedType === "tv"
        ? "Añadida a Series pendientes ✓"
        : "Añadida a Películas pendientes ✓");
    }
  });

  back?.addEventListener("click", close);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains("external-title-preview-open")) close();
  });

  return Object.freeze({ open, close });
})();
