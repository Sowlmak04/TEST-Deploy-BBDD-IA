const SmartCollectionsUI = (() => {
  "use strict";

  const PAGE_SIZE = 4;

  const state = {
    type: "all",
    collection: null,
    page: 1
  };

  const definitions = [
    {
      id: "favorites",
      title: "Favoritos",
      description: "Películas y series marcadas como favoritas.",
      icon: "★",
      matches: item => Boolean(item.favorite)
    },
    {
      id: "high-priority",
      title: "Prioridad alta",
      description: "Pendientes que has marcado como prioritarias.",
      icon: "!",
      matches: item => item.status === "pendientes" && item.priority === "alta"
    },
    {
      id: "in-progress",
      title: "Series en curso",
      description: "Series pendientes que ya has empezado.",
      icon: "▶",
      matches: item =>
        item.kind === "series" &&
        item.status === "pendientes" &&
        (
          Number.parseInt(item.currentEpisode || "0", 10) > 0 ||
          Number.parseInt(item.currentSeason || "0", 10) > 1
        )
    },
    {
      id: "not-started",
      title: "Sin empezar",
      description: "Pendientes que todavía no tienen progreso.",
      icon: "○",
      matches: item => {
        if (item.status !== "pendientes") return false;
        if (item.kind === "peliculas") return true;
        const season = Number.parseInt(item.currentSeason || "0", 10);
        const episode = Number.parseInt(item.currentEpisode || "0", 10);
        return season <= 1 && episode <= 0;
      }
    },
    {
      id: "top-rated",
      title: "Mejor valoradas",
      description: "Contenido visto con nota media igual o superior a 9.",
      icon: "9+",
      matches: item => {
        if (item.status !== "vistas") return false;
        const adri = Number(item.ratingAdri);
        const laura = Number(item.ratingLaura);
        return Number.isFinite(adri) &&
          Number.isFinite(laura) &&
          ((adri + laura) / 2) >= 9;
      }
    },
    {
      id: "tagged",
      title: "Con etiquetas",
      description: "Elementos organizados con etiquetas personales.",
      icon: "#",
      matches: item => String(item.tags || "").trim().length > 0
    }
  ];

  function escape(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeItem(item, kind, status) {
    return {
      ...item,
      kind,
      status
    };
  }

  function getAllItems() {
    return [
      ...loadArray(KEY.seriesPendientes)
        .map(item => normalizeItem(item, "series", "pendientes")),
      ...loadArray(KEY.seriesVistas)
        .map(item => normalizeItem(item, "series", "vistas")),
      ...loadArray(KEY.peliculasPendientes)
        .map(item => normalizeItem(item, "peliculas", "pendientes")),
      ...loadArray(KEY.peliculasVistas)
        .map(item => normalizeItem(item, "peliculas", "vistas"))
    ];
  }

  function applyType(items) {
    if (state.type === "series") {
      return items.filter(item => item.kind === "series");
    }
    if (state.type === "peliculas") {
      return items.filter(item => item.kind === "peliculas");
    }
    return items;
  }

  function getDefinition() {
    if (!state.collection) return null;
    return definitions.find(item => item.id === state.collection) || null;
  }

  function getCollectionItems() {
    const definition = getDefinition();
    if (!definition) return [];
    return applyType(getAllItems()).filter(definition.matches);
  }

  function averageRating(item) {
    const adri = Number(item.ratingAdri);
    const laura = Number(item.ratingLaura);
    if (!Number.isFinite(adri) || !Number.isFinite(laura)) return null;
    return (adri + laura) / 2;
  }

  function formatAverage(value) {
    if (!Number.isFinite(value)) return "";
    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(1).replace(".", ",");
  }

  function buildMeta(item) {
    const meta = [];

    meta.push(
      `<span>${item.kind === "series" ? "Serie" : "Película"}</span>`
    );
    meta.push(
      `<span>${item.status === "vistas" ? "Vista" : "Pendiente"}</span>`
    );

    if (window.PlatformAvailabilityMatch?.matches(item)) {
      meta.push(`<span class="myPlatformsMatch" aria-label="Disponible en una de mis plataformas" title="Disponible en una de mis plataformas"><span class="myPlatformsMatchTick" aria-hidden="true">✓</span> Disponible en mis plataformas</span>`);
    }
    if (item.genre) meta.push(`<span>🏷️ ${escape(item.genre)}</span>`);
    if (item.year) meta.push(`<span>📅 ${escape(item.year)}</span>`);

    if (
      item.kind === "series" &&
      (item.currentSeason || item.currentEpisode)
    ) {
      const progress = [
        item.currentSeason ? `T${item.currentSeason}` : "",
        item.currentEpisode ? `E${item.currentEpisode}` : ""
      ].filter(Boolean).join(" · ");
      if (progress) meta.push(`<span>▶️ ${escape(progress)}</span>`);
    }

    const average = averageRating(item);
    if (item.status === "vistas" && average !== null) {
      meta.push(
        `<span class="metaAvg">⭐ NOTA: ${escape(formatAverage(average))}</span>`
      );
    }

    return meta;
  }

  function buildBadges(item) {
    const badges = [];

    if (item.favorite) {
      badges.push(
        '<span class="personalBadge favoriteBadge">★ Favorito</span>'
      );
    }

    if (item.priority) {
      badges.push(
        `<span class="personalBadge priority-${escape(item.priority)}">` +
        `Prioridad ${escape(item.priority)}</span>`
      );
    }

    String(item.tags || "")
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 3)
      .forEach(tag => {
        badges.push(
          `<span class="personalBadge tagBadge">${escape(tag)}</span>`
        );
      });

    return badges;
  }

  function positionResultsContainer(resultsElement = null) {
    const grid = document.getElementById("smart-collection-grid");
    const results = resultsElement || document.getElementById("smart-collection-results");
    if (!grid || !results) return;

    if (!state.collection) {
      results.hidden = true;
      grid.appendChild(results);
      return;
    }

    results.hidden = false;
    const cards = Array.from(grid.querySelectorAll("[data-smart-collection]"));
    const activeIndex = cards.findIndex(card =>
      card.dataset.smartCollection === state.collection
    );
    if (activeIndex < 0) {
      grid.appendChild(results);
      return;
    }

    const columns = window.matchMedia("(max-width: 560px)").matches ? 1 : 2;
    const rowEndIndex = Math.min(
      cards.length - 1,
      (Math.floor(activeIndex / columns) + 1) * columns - 1
    );

    cards[rowEndIndex].insertAdjacentElement("afterend", results);
  }

  function renderCollectionCards() {
    const container = document.getElementById("smart-collection-grid");
    if (!container) return;

    const results = document.getElementById("smart-collection-results");
    if (results?.parentElement) results.remove();

    const typedItems = applyType(getAllItems());

    container.innerHTML = definitions.map(definition => {
      const count = typedItems.filter(definition.matches).length;
      const selected = definition.id === state.collection;

      return `
        <button
          class="smartCollectionCard${selected ? " active" : ""}"
          type="button"
          data-smart-collection="${escape(definition.id)}"
          aria-pressed="${selected ? "true" : "false"}"
        >
          <span class="smartCollectionIcon">${escape(definition.icon)}</span>
          <span class="smartCollectionText">
            <strong>${escape(definition.title)}</strong>
            <small>${escape(definition.description)}</small>
          </span>
          <span class="smartCollectionCount">${count}</span>
        </button>
      `;
    }).join("");

    if (results) container.appendChild(results);
    positionResultsContainer(results);
  }

  function renderTypeButtons() {
    document.querySelectorAll("[data-smart-type]").forEach(button => {
      const active = button.dataset.smartType === state.type;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderPager(total) {
    const container = document.getElementById("smart-collection-pager");
    if (!container) return;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.max(1, Math.min(state.page, totalPages));

    if (totalPages <= 1) {
      container.style.display = "none";
      container.innerHTML = "";
      return;
    }

    container.style.display = "flex";
    container.innerHTML = `
      <button
        class="pagerBtn"
        type="button"
        data-smart-page="${state.page - 1}"
        ${state.page === 1 ? "disabled" : ""}
      >
        Anterior
      </button>

      <div class="pagerSelectWrap">
        <select
          class="pagerSelect"
          data-smart-page-select
          aria-label="Seleccionar página"
        >
          ${Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            return `
              <option value="${page}" ${page === state.page ? "selected" : ""}>
                Página ${page}
              </option>
            `;
          }).join("")}
        </select>
      </div>

      <button
        class="pagerBtn"
        type="button"
        data-smart-page="${state.page + 1}"
        ${state.page === totalPages ? "disabled" : ""}
      >
        Siguiente
      </button>
    `;
  }

  function renderResults() {
    const title = document.getElementById("smart-collection-title");
    const subtitle = document.getElementById("smart-collection-subtitle");
    const count = document.getElementById("smart-collection-count");
    const list = document.getElementById("smart-collection-list");
    const empty = document.getElementById("smart-collection-empty");

    const results = document.getElementById("smart-collection-results");
    if (!title || !subtitle || !count || !list || !empty || !results) return;

    const definition = getDefinition();
    if (!definition) {
      results.hidden = true;
      list.innerHTML = "";
      empty.style.display = "none";
      renderPager(0);
      return;
    }

    results.hidden = false;
    const items = getCollectionItems();
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    state.page = Math.max(1, Math.min(state.page, totalPages));

    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);

    title.textContent = definition.title;
    subtitle.textContent = definition.description;
    count.textContent =
      `${items.length} ${items.length === 1 ? "elemento" : "elementos"}`;

    if (!items.length) {
      list.innerHTML = "";
      empty.style.display = "block";
      empty.textContent =
        "Esta colección no contiene elementos con el tipo seleccionado.";
      renderPager(0);
      return;
    }

    empty.style.display = "none";
    list.innerHTML = pageItems.map(item => {
      const meta = buildMeta(item);
      const badges = buildBadges(item);

      return `
        <div
          class="itemCard clickable"
          data-kind="${escape(item.kind)}"
          data-status="${escape(item.status)}"
          data-id="${escape(item.id)}"
          role="button"
          tabindex="0"
        >
          <div class="itemCardContent">
            ${
              item.posterUrl
                ? `<img class="itemPoster" src="${escape(item.posterUrl)}" alt="" loading="lazy">`
                : ""
            }
            <div class="itemCardText">
              <div class="itemTop">
                <p class="itemTitle">${escape(item.title)}</p>
              </div>
              ${
                badges.length
                  ? `<div class="personalBadges">${badges.join("")}</div>`
                  : ""
              }
              ${
                meta.length
                  ? `<div class="meta">${meta.join("")}</div>`
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    }).join("");

    renderPager(items.length);
  }

  function render() {
    renderTypeButtons();
    renderCollectionCards();
    renderResults();
  }

  function resetView() {
    state.collection = null;
    state.page = 1;
    render();
  }

  document.addEventListener("click", event => {
    const collectionButton = event.target.closest("[data-smart-collection]");
    if (collectionButton) {
      const requestedCollection = collectionButton.dataset.smartCollection;
      state.collection = state.collection === requestedCollection
        ? null
        : requestedCollection;
      state.page = 1;
      render();
      return;
    }

    const typeButton = event.target.closest("[data-smart-type]");
    if (typeButton) {
      state.type = typeButton.dataset.smartType;
      state.page = 1;
      render();
      return;
    }

    const pageButton = event.target.closest("[data-smart-page]");
    if (pageButton && !pageButton.disabled) {
      state.page = Number(pageButton.dataset.smartPage || "1");
      renderResults();
    }
  });

  document.addEventListener("change", event => {
    const select = event.target.closest("[data-smart-page-select]");
    if (!select) return;
    state.page = Number(select.value || "1");
    renderResults();
  });

  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(positionResultsContainer);
  });

  return Object.freeze({
    render,
    resetView,
    getAllItems,
    getCollectionItems
  });
})();
