// ---------- Modal detalle (pendientes + vistas) ----------
    const detailOverlay = document.getElementById("detailOverlay");
    const detailClose = document.getElementById("detailClose");
    const detailTitle = document.getElementById("detailTitle");
    const detailBody = document.getElementById("detailBody");
    const detailFullBtn = document.getElementById("detailFull");
    
    // Estado del detalle abierto (para acciones tipo eliminar)
    let currentDetail = { kind: null, id: null, status: null, listKey: null, returnScreen: null };
    
    let editMode = { active: false, kind: null, id: null, returnScreen: null };

    function setFormEditUI(form, screenName, labelText) {
      const screen = document.querySelector(`.screen[data-screen="${screenName}"]`);
      const pill = screen?.querySelector(".backRow .pill");
      if (pill) pill.textContent = labelText;
  
      const saveBtn = form.querySelector(".btnPrimary");
      if (saveBtn) saveBtn.textContent = "Guardar cambios";
    }

    function resetFormEditUI(form, screenName, defaultPillText) {
      const screen = document.querySelector(`.screen[data-screen="${screenName}"]`);
      const pill = screen?.querySelector(".backRow .pill");
      if (pill) pill.textContent = defaultPillText;
  
      const saveBtn = form.querySelector(".btnPrimary");
      if (saveBtn) saveBtn.textContent = "Guardar";
    }

    
    function startEditFromDetail() {
      const { kind, id, returnScreen, status, listKey } = currentDetail;
      if (!kind || !id) return;
  
      const isSeries = kind === "series";
      const isVistas = status === "vistas";
  
      const key = listKey || (
        isSeries ?
        (isVistas ? KEY.seriesVistas : KEY.seriesPendientes) :
        (isVistas ? KEY.peliculasVistas : KEY.peliculasPendientes)
      );
  
      const items = loadArray(key);
      let item = items.find(x => x.id === id);
      if (!item) return;
  
      // ✅ Siempre aseguramos estructura
      item = ensureWatchLog(item);
  
      // Si es vistas, la edición debe basarse en el ÚLTIMO visionado
      if (isVistas) {
        item = applyLastWatchToView(item);
      }   
  
      // Elegir pantalla + form según tipo y estado
      const screenName = isSeries ?
        (isVistas ? "anadir-series-vistas" : "anadir-series-pendientes") :
        (isVistas ? "anadir-peliculas-vistas" : "anadir-peliculas-pendientes");
  
      const form = isSeries ?
        (isVistas ? formSV : formSP) :
        (isVistas ? formPV : formPP);
  
      // Marcar modo edición
      editMode = { active: true, kind, id, returnScreen };
      form.dataset.editId = id;
      form.dataset.editKind = kind;
      form.dataset.returnScreen = returnScreen;
  
      // Prefill campos comunes
      form.querySelector('input[name="title"]').value = item.title || "";
      form.querySelector('input[name="genre"]').value = item.genre || "";
      form.querySelector('input[name="duration"]').value = item.duration || "";
  
      // Series: temporadas / capítulos
      const sField = form.querySelector('input[name="seasons"]');
      if (sField) sField.value = item.seasons ?? "";
  
      const eField = form.querySelector('input[name="episodes"]');
      if (eField) eField.value = item.episodes ?? "";
  
      // Pendientes: sinopsis
      const synField = form.querySelector('textarea[name="synopsis"]');
      if (synField) synField.value = (item.synopsis || item.notes || "");

      [
        "priority",
        "tags",
        "privateNote",
        "plannedDate",
        "currentSeason",
        "currentEpisode",
        "episodesPerSeason",
        "episodesBySeason"
      ].forEach(name => {
        const field = form.elements.namedItem(name);
        if (!field) return;
        field.value = name === "episodesBySeason" && Array.isArray(item[name])
          ? item[name].join(", ")
          : item[name] ?? "";
      });

      const favoriteField = form.elements.namedItem("favorite");
      if (favoriteField) favoriteField.checked = Boolean(item.favorite);

      [
        "tmdbId",
        "tmdbType",
        "year",
        "posterPath",
        "posterUrl",
        "backdropPath",
        "originalTitle",
        "originalLanguage",
        "originCountries",
        "spokenLanguages",
        "productionCompanies",
        "productionStatus",
        "tagline",
        "releaseDate",
        "lastAirDate",
        "adult",
        "inProduction",
        "cast",
        "crew",
        "creators",
        "trailer",
        "watchRegion",
        "watchProviders",
        "watchProvidersLink",
        "watchProvidersUpdatedAt",
        "tmdbVoteAverage",
        "tmdbUpdatedAt",
        "seasonsData",
        "specialsData",
        "tmdbStatus",
        "tmdbSeasonsUpdatedAt"
      ].forEach(name => {
        const field = form.elements.namedItem(name);
        if (!field) return;

        if ([
          "seasonsData", "specialsData", "originCountries",
          "spokenLanguages", "productionCompanies", "cast", "crew",
          "creators", "watchProviders"
        ].includes(name)) {
          field.value = JSON.stringify(Array.isArray(item[name]) ? item[name] : []);
        } else if (name === "trailer") {
          field.value = JSON.stringify(item.trailer || null);
        } else if (name === "adult") {
          field.value = item.adult ? "1" : "";
        } else if (name === "inProduction") {
          field.value = item.inProduction === null || item.inProduction === undefined
            ? ""
            : item.inProduction ? "1" : "0";
        } else {
          field.value = item[name] ?? "";
        }
      });
  
      if (isSeries && typeof SeasonEpisodeSelectors !== "undefined") {
        SeasonEpisodeSelectors.refreshForm(form, {
          currentSeason: item.currentSeason ?? "",
          currentEpisode: item.currentEpisode ?? ""
        });
      }

      // Vistas: notas + estrellas desde último watchLog
      if (isVistas) {
        const notesA = form.querySelector('textarea[name="notesAdri"]');
        if (notesA) notesA.value = item.notesAdri || "";
    
        const notesL = form.querySelector('textarea[name="notesLaura"]');
        if (notesL) notesL.value = item.notesLaura || "";
    
        // Set estrellas usando el widget
        form.querySelectorAll('[data-widget="rating"]').forEach(w => {
          const target = w.dataset.target;
          if (!target) return;
      
          if (target.includes("rating-adri") && typeof w._setRating === "function") {
            w._setRating(item.ratingAdri);
          }
      
          if (target.includes("rating-laura") && typeof w._setRating === "function") {
            w._setRating(item.ratingLaura);
          }
        });
      }
  
      // Cambiar botón volver para regresar a la lista
      const backBtn = document.querySelector(`.screen[data-screen="${screenName}"] .backBtn[type="button"][data-screen]`);
      if (backBtn) {
        backBtn.dataset.prevScreen = backBtn.dataset.screen;
        backBtn.dataset.screen = returnScreen;
      }
  
      // Actualizar UI del formulario
      const label = isVistas ?
        (isSeries ? "Editar · Serie vista" : "Editar · Película vista") :
        (isSeries ? "Editar · Serie pendiente" : "Editar · Película pendiente");
  
      setFormEditUI(form, screenName, label);

      if (typeof window.prepareListReturn === "function") {
        window.prepareListReturn(returnScreen, id);
      }
  
      closeDetailModal();
      showScreen(screenName);
    }
    
    
    function clearEditModeIfAny() {
      if (!editMode.active) return;
  
      const isSeries = editMode.kind === "series";
      const isVistas =
        editMode.returnScreen === "series-vistas" ||
        editMode.returnScreen === "peliculas-vistas";
  
      const screenName = isSeries ?
        (isVistas ? "anadir-series-vistas" : "anadir-series-pendientes") :
        (isVistas ? "anadir-peliculas-vistas" : "anadir-peliculas-pendientes");
  
      const form = isSeries ?
        (isVistas ? formSV : formSP) :
        (isVistas ? formPV : formPP);
  
      // Restaurar botón volver
      const backBtn = document.querySelector(`.screen[data-screen="${screenName}"] .backBtn[type="button"][data-screen]`);
      if (backBtn && backBtn.dataset.prevScreen) {
        backBtn.dataset.screen = backBtn.dataset.prevScreen;
        delete backBtn.dataset.prevScreen;
      }
  
      // Restaurar UI (pill + texto botón)
      resetFormEditUI(
        form,
        screenName,
        isVistas ?
        (isSeries ? "Formulario · Serie vista" : "Formulario · Película vista") :
        (isSeries ? "Formulario · Serie pendiente" : "Formulario · Película pendiente")
      );
  
      // Limpiar estado dataset
      delete form.dataset.editId;
      delete form.dataset.editKind;
      delete form.dataset.returnScreen;
  
      editMode = { active: false, kind: null, id: null, returnScreen: null };
    }
    
    
    
    function renderDetailAsForm(item, { isSeries, isVistas }) {
      const rows = [];
  
      const field = (label, value) => `
        <div class="field">
          <label>${escapeHtml(label)}</label>
          <input value="${escapeHtml(value ?? "")}" readonly />
        </div>
      `;
  
      const area = (label, value) => `
        <div class="field" style="grid-column:1/-1;">
          <label>${escapeHtml(label)}</label>
          <textarea readonly>${escapeHtml(value ?? "")}</textarea>
        </div>
      `;
  
      if (item.posterUrl) {
        rows.push(`
          <div class="detailPosterWrap">
            <img
              class="detailPoster"
              src="${escapeHtml(item.posterUrl)}"
              alt="Póster de ${escapeHtml(item.title || "")}"
            >
          </div>
        `);
      }

      // --- TÍTULO ---
      rows.push(field("Título", item.title || ""));

      if (item.year) {
        rows.push(field("Año", item.year));
      }
  
      const synopsis = (item.synopsis || item.notes || "").toString().trim();
  
      // ✅ PENDIENTES: Sinopsis justo debajo del título (siempre visible)
      if (!isVistas && synopsis) {
        rows.push(area("Sinopsis", synopsis));
      }
  
      // --- VISTAS: valoraciones + sinopsis + notas justo tras título ---
      if (isVistas) {
        rows.push(field("Valoración Adri", item.ratingAdri ?? ""));
        rows.push(field("Valoración Laura", item.ratingLaura ?? ""));
    
        // Sinopsis siempre visible (en vistas va aquí)
        rows.push(area("Sinopsis", synopsis));
    
        rows.push(`
          <div class="twoNotes">
            <div class="field">
              <label>Notas Adri</label>
              <textarea readonly>${escapeHtml(item.notesAdri ?? "")}</textarea>
            </div>
            <div class="field">
              <label>Notas Laura</label>
              <textarea readonly>${escapeHtml(item.notesLaura ?? "")}</textarea>
            </div>
          </div>
        `);
      }
  
      // --- ORGANIZACIÓN PERSONAL ---
      if (item.favorite) rows.push(field("Favorito", "Sí"));
      if (item.priority) {
        rows.push(field("Prioridad", {
          alta: "Alta", media: "Media", baja: "Baja"
        }[item.priority] || item.priority));
      }
      if (item.tags) rows.push(field("Etiquetas", item.tags));
      if (item.plannedDate) rows.push(field("Fecha prevista", item.plannedDate));
      if (isSeries && (item.currentSeason || item.currentEpisode)) {
        const progress = SeriesProgressService.snapshot(item);
        rows.push(field("Progreso", [
          item.currentSeason ? `T${item.currentSeason}` : "",
          item.currentEpisode ? `E${item.currentEpisode}` : "",
          progress.percentage !== null ? `${progress.percentage}%` : ""
        ].filter(Boolean).join(" · ")));

        if (item.episodesPerSeason) {
          rows.push(field("Capítulos por temporada", item.episodesPerSeason));
        }

        if (progress.episodesBySeason.length) {
          rows.push(field(
            "Distribución por temporadas",
            progress.episodesBySeason.map((episodes, index) => `T${index + 1}: ${episodes || "?"}`).join(" · ")
          ));
        }

        if (item.lastProgressAt) {
          rows.push(field(
            "Último episodio registrado",
            SeriesProgressService.formatDate(item.lastProgressAt)
          ));
        }

        const progressLog = SeriesProgressService.normalizeLog(item.progressLog);
        if (progressLog.length) {
          const visibleProgressLog = [...progressLog].reverse().slice(0, 8);

          rows.push(`
            <div class="field progressHistoryField" style="grid-column:1/-1;">
              <details class="progressHistoryDisclosure">
                <summary>
                  <span>Historial de progreso</span>
                  <span class="progressHistoryCount">
                    ${visibleProgressLog.length}
                    ${visibleProgressLog.length === 1 ? "movimiento" : "movimientos"}
                  </span>
                </summary>
                <div class="progressHistory">
                  ${visibleProgressLog.map(entry => `
                    <div class="progressHistoryItem">
                      <strong>T${escapeHtml(entry.season)} · E${escapeHtml(entry.episode)}</strong>
                      <span>${escapeHtml(entry.action || "actualizado")}</span>
                      <small>${escapeHtml(SeriesProgressService.formatDate(entry.at))}</small>
                    </div>
                  `).join("")}
                </div>
              </details>
            </div>
          `);
        }
      }
      if (isSeries && item.tmdbId) {
        const updatedLabel = TMDbSeasonService.formatUpdatedAt(
          item.tmdbSeasonsUpdatedAt
        );

        if (item.tmdbStatus) {
          rows.push(field("Estado en TMDb", item.tmdbStatus));
        }

        if (updatedLabel) {
          rows.push(field("Temporadas actualizadas", updatedLabel));
        }

        if (Array.isArray(item.specialsData) && item.specialsData.length) {
          const specialEpisodes = item.specialsData.reduce(
            (sum, season) => sum + (Number(season.episodeCount) || 0),
            0
          );

          rows.push(field(
            "Especiales excluidos del progreso",
            `${specialEpisodes} capítulo${specialEpisodes === 1 ? "" : "s"}`
          ));
        }

        rows.push(`
          <div class="tmdbSeasonSyncPanel" style="grid-column:1/-1;">
            <div>
              <strong>Estructura de temporadas TMDb</strong>
              <span>
                Actualiza temporadas y capítulos sin modificar tu progreso,
                valoraciones ni notas.
              </span>
            </div>
            <button
              class="toolBtn"
              type="button"
              data-tmdb-sync-current
            >
              Actualizar temporadas
            </button>
            <div
              class="tmdbSeasonSyncMessage"
              data-tmdb-sync-message
              aria-live="polite"
            ></div>
          </div>
        `);
      }

      if (item.privateNote) rows.push(area("Nota privada", item.privateNote));

      // --- RESTO CAMPOS ---
      rows.push(field("Género", item.genre || ""));
  
      if (isSeries) {
        rows.push(field("Temporadas", item.seasons || ""));
        rows.push(field("Capítulos", item.episodes || ""));
        rows.push(field("Duración Cap.", item.duration || ""));
      } else {
        rows.push(field("Duración", item.duration || ""));
      }
  
      return `
        <div class="formCard" style="box-shadow:none; padding:14px;">
          <div class="formGrid">
            ${rows.join("")}
          </div>
        </div>
      `;
    }
    
    
    function openDetailModal({ kind, id, status = "pendientes" }) {
      const isSeries = kind === "series";
      const isVistas = status === "vistas";
  
      const key = isSeries ?
        (isVistas ? KEY.seriesVistas : KEY.seriesPendientes) :
        (isVistas ? KEY.peliculasVistas : KEY.peliculasPendientes);
  
      const items = loadArray(key);
      let item = items.find(x => x.id === id);
      if (!item) return;
  
      // ✅ asegurar estructura watchLog
      item = ensureWatchLog(item);
  
      // ✅ si es vistas, reflejar último visionado en UI
      if (isVistas) item = applyLastWatchToView(item);
  
      // Guardar contexto para acciones
      currentDetail.kind = kind;
      currentDetail.id = id;
      currentDetail.status = status;
      currentDetail.listKey = key;
      currentDetail.returnScreen = isSeries ?
        (isVistas ? "series-vistas" : "series-pendientes") :
        (isVistas ? "peliculas-vistas" : "peliculas-pendientes");
  
      detailTitle.textContent = item.title || "Detalle";
  
      // Render estilo formulario
      detailBody.innerHTML = renderDetailAsForm(item, { isSeries, isVistas });
  
      // Acciones visibles
      const actions = detailOverlay.querySelector(".modalActions");
      if (actions) actions.style.display = "flex";
  
      // Botón central cambia según estado
      if (detailSeenBtn) detailSeenBtn.textContent = isVistas ? "Volver a ver" : "Visto";
  
      // ✅ Mostrar/ocultar botón Historial según watchLog
      if (typeof detailHistoryBtn !== "undefined" && detailHistoryBtn) {
        const base = ensureWatchLog(item);
        const hasLog = Array.isArray(base.watchLog) && base.watchLog.length > 0;
        detailHistoryBtn.style.display = hasLog ? "inline-flex" : "none";
      }
  
      detailBody.scrollTop = 0;
      detailOverlay.classList.add("open");
      detailOverlay.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => { detailBody.scrollTop = 0; });
      syncBodyModalOpen();
    }
    
    

    if (detailFullBtn) {
      detailFullBtn.addEventListener("click", () => {
        if (typeof DetailView === "undefined") return;
        const context = { ...currentDetail };
        closeDetailModal();
        DetailView.open(context);
      });
    }

    function closeDetailModal() {
      detailOverlay.classList.remove("open");
      detailOverlay.setAttribute("aria-hidden", "true");
      syncBodyModalOpen();
    }

    // Cerrar modal: botones / click fuera / ESC
    detailClose.addEventListener("click", closeDetailModal);
    

    detailOverlay.addEventListener("click", (e) => {
      if (e.target === detailOverlay) closeDetailModal();
    });

    detailBody.addEventListener("click", async event => {
      const button = event.target.closest("[data-tmdb-sync-current]");
      if (!button) return;

      const message = detailBody.querySelector("[data-tmdb-sync-message]");
      const originalText = button.textContent;

      button.disabled = true;
      button.textContent = "Actualizando…";
      if (message) {
        message.textContent = "Consultando la estructura actual en TMDb…";
        message.className = "tmdbSeasonSyncMessage";
      }

      try {
        await TMDbSeasonService.syncItem(
          currentDetail.listKey,
          currentDetail.id
        );

        if (message) {
          message.textContent = "Temporadas actualizadas correctamente.";
          message.className = "tmdbSeasonSyncMessage ok";
        }

        if (currentDetail.status === "vistas") {
          renderVistas("series");
        } else {
          renderPendientes("series");
        }

        if (typeof renderStatisticsDashboard === "function") {
          renderStatisticsDashboard();
        }

        const context = { ...currentDetail };
        setTimeout(() => {
          openDetailModal({
            kind: context.kind,
            id: context.id,
            status: context.status
          });
        }, 450);
      } catch (error) {
        if (message) {
          message.textContent =
            error.message === "TMDB_TOKEN_MISSING"
              ? "Configura primero el token de TMDb."
              : error.message === "TMDB_TOKEN_INVALID"
                ? "El token de TMDb no es válido."
                : "No se pudieron actualizar las temporadas.";
          message.className = "tmdbSeasonSyncMessage error";
        }

        button.disabled = false;
        button.textContent = originalText;
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && detailOverlay.classList.contains("open")) closeDetailModal();
    });

    // Click en cards de pendientes (delegación)
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-progress-action]")) return;
      const card = e.target.closest(".itemCard.clickable");
      if (!card) return;
      openDetailModal({
        kind: card.dataset.kind,
        id: card.dataset.id,
        status: card.dataset.status || "pendientes"
      });
    });

    // Teclado: Enter / Space abre el modal si el foco está en una card
    document.addEventListener ("keydown", (e) => {
      const card = document.activeElement?.closest?.(".itemCard.clickable");
      if (!card) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetailModal({
          kind: card.dataset.kind,
          id: card.dataset.id,
          status: card.dataset.status || "pendientes"
        });
      }
    });
    
    
    // ---------- Confirmación eliminar + Toast ----------
    const detailDeleteBtn = document.getElementById("detailDelete");
    
    const detailEditBtn = document.getElementById("detailEdit");
    if (detailEditBtn) detailEditBtn.addEventListener("click", startEditFromDetail);
    
    // ---------- Modal Historial (watchLog) ----------
    const detailHistoryBtn = document.getElementById("detailHistory");

    const historyOverlay = document.getElementById("historyOverlay");
    const historyClose = document.getElementById("historyClose");
    const historyOk = document.getElementById("historyOk");
    const historyBody = document.getElementById("historyBody");

    function fmtDate(ts) {
      try {
        const d = new Date(ts);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, "0");
        const mi = String(d.getMinutes()).padStart(2, "0");
        return `${dd}/${mm}/${yy} ${hh}:${mi}`;
      } catch {
        return "";
      }
    }

    function openHistoryModal() {
      const { kind, id, status, listKey } = currentDetail;
      if (!kind || !id) return;
  
      const isSeries = kind === "series";
      const isVistas = status === "vistas";
  
      const key = listKey || (
        isSeries ?
        (isVistas ? KEY.seriesVistas : KEY.seriesPendientes) :
        (isVistas ? KEY.peliculasVistas : KEY.peliculasPendientes)
      );
  
      const items = loadArray(key);
      const raw = items.find(x => x.id === id);
      if (!raw) return;
  
      const base = ensureWatchLog(raw);
      const log = Array.isArray(base.watchLog) ? base.watchLog : [];
  
      if (log.length === 0) {
        historyBody.innerHTML = `<div class="empty" style="margin-top:0;">No hay visionados guardados todavía.</div>`;
      } else {
        // Más nuevo primero
        const ordered = [...log].sort((a, b) => (b.at || 0) - (a.at || 0));
    
        historyBody.innerHTML = `
          <div class="historyList">
            ${ordered.map((w) => {
              const ra = Number(w.ratingAdri);
              const rl = Number(w.ratingLaura);
              const hasAvg = Number.isFinite(ra) && Number.isFinite(rl);
              const avg = hasAvg ? formatAvg((ra + rl) / 2) : "";

              const na = (w.notesAdri || "").trim();
              const nl = (w.notesLaura || "").trim();

              const hasNotes = !!(na || nl);

              return `
                <div class="historyItem">
                  <div class="historyTop">
                    <div class="historyDate">${escapeHtml(fmtDate(w.at || Date.now()))}</div>
                  </div>

                  <div class="historyMeta">
                    ${hasAvg ? `<span class="metaAvg">⭐ NOTA: ${escapeHtml(avg)}</span>` : ``}
                    <span>Adri: ${escapeHtml(w.ratingAdri ?? "")}</span>
                    <span>Laura: ${escapeHtml(w.ratingLaura ?? "")}</span>
                  </div>

                  ${hasNotes ? `
                    <div class="historyNotes">
                      <div class="field" style="grid-column:1/-1;">
                        <label>Notas Adri</label>
                        <textarea readonly>${escapeHtml(na)}</textarea>
                      </div>
                      <div class="field" style="grid-column:1/-1;">
                        <label>Notas Laura</label>
                        <textarea readonly>${escapeHtml(nl)}</textarea>
                      </div>
                    </div>
                    <div style="margin-top:10px; color: rgba(233,237,255,.72); font-size:12.5px;">
                  Toca esta tarjeta para ver/ocultar notas
                    </div>
                  ` : `
                    <div style="margin-top:10px; color: rgba(233,237,255,.72); font-size:12.5px;">
                  Sin notas en este visionado
                    </div>
                  `}
                </div>
              `;
            }).join("")}
          </div>
        `;
      }
  
      historyOverlay.classList.add("open");
      historyOverlay.setAttribute("aria-hidden", "false");
      syncBodyModalOpen();
    }

    function closeHistoryModal() {
      historyOverlay.classList.remove("open");
      historyOverlay.setAttribute("aria-hidden", "true");
      syncBodyModalOpen();
    }

    // Toggle notas tocando una tarjeta
    historyBody.addEventListener("click", (e) => {
      const it = e.target.closest(".historyItem");
      if (!it) return;
      it.classList.toggle("open");
    });

    if (detailHistoryBtn) {
      detailHistoryBtn.addEventListener("click", openHistoryModal);
    }

    historyClose.addEventListener("click", closeHistoryModal);
    historyOk.addEventListener("click", closeHistoryModal);

    historyOverlay.addEventListener("click", (e) => {
      if (e.target === historyOverlay) closeHistoryModal();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && historyOverlay.classList.contains("open")) closeHistoryModal();
    });
    
    // --- VISTO: mini modal ---
    const detailSeenBtn = document.getElementById("detailSeen");

    const seenOverlay = document.getElementById("seenOverlay");
    const seenClose = document.getElementById("seenClose");
    const seenSave = document.getElementById("seenSave");

    const seenRatingAdri = document.getElementById("seen-rating-adri");
    const seenRatingLaura = document.getElementById("seen-rating-laura");
    const seenNotesAdri = document.getElementById("seen-notes-adri");
    const seenNotesLaura = document.getElementById("seen-notes-laura");
    const msgSeen = document.getElementById("msg-seen");

    function openSeenModal() {
      // Limpia campos
      setMsg(msgSeen, "", "");
      if (seenNotesAdri) seenNotesAdri.value = "";
      if (seenNotesLaura) seenNotesLaura.value = "";
  
      // Resetea estrellas (usa tu helper ya existente)
      const f = document.getElementById("seenForm");
      if (f) resetRatingsInside(f);
  
      seenOverlay.classList.add("open");
      seenOverlay.setAttribute("aria-hidden", "false");
      syncBodyModalOpen();
    }

    function closeSeenModal() {
      seenOverlay.classList.remove("open");
      seenOverlay.setAttribute("aria-hidden", "true");
      syncBodyModalOpen();
    }

    window.openSeriesCompletion = function(id) {
      const item = loadArray(KEY.seriesPendientes).find(entry => entry.id === id);
      if (!item) return;

      currentDetail = {
        kind: "series",
        id,
        status: "pendientes",
        listKey: KEY.seriesPendientes,
        returnScreen: "series-pendientes"
      };

      openSeenModal();
    };

    
    function saveSeenFromDetail() {
      const { kind, id } = currentDetail;
      if (!kind || !id) return;
  
      // Ratings (obligatorias)
      const ra = (seenRatingAdri?.value || "").toString().trim();
      const rl = (seenRatingLaura?.value || "").toString().trim();
  
      if (!ra || !rl) {
        setMsg(msgSeen, "Faltan valoraciones obligatorias.", "error");
        return;
      }
  
      const ratingAdri = Number(ra);
      const ratingLaura = Number(rl);
  
      if (!Number.isFinite(ratingAdri) || !Number.isFinite(ratingLaura)) {
        setMsg(msgSeen, "Las valoraciones no son válidas.", "error");
        return;
      }
  
      // Origen: pendientes
      const fromKey = (kind === "series") ? KEY.seriesPendientes : KEY.peliculasPendientes;
      const fromArr = loadArray(fromKey);
      const item = fromArr.find(x => x.id === id);
      if (!item) return;
  
      // Quitar de pendientes
      const nextFrom = fromArr.filter(x => x.id !== id);
      saveArray(fromKey, nextFrom);
  
      // Entrada historial
      const entry = makeWatchEntry({
        ratingAdri,
        ratingLaura,
        notesAdri: (seenNotesAdri?.value || "").trim(),
        notesLaura: (seenNotesLaura?.value || "").trim(),
        at: Date.now()
      });
  
      // Asegurar watchLog en el item base
      const base = ensureWatchLog(item);
  
      // Item destino (vistas)
      const moved = {
        ...base,
        ratingAdri: entry.ratingAdri,
        ratingLaura: entry.ratingLaura,
        notesAdri: entry.notesAdri,
        notesLaura: entry.notesLaura,
        watchedAt: entry.at,
        watchLog: [...(base.watchLog || []), entry],
        createdAt: Date.now()
      };
  
      // Destino: vistas
      const toKey = (kind === "series") ? KEY.seriesVistas : KEY.peliculasVistas;
      const toArr = loadArray(toKey);
      toArr.unshift(moved);
      saveArray(toKey, toArr);
  
      // Cerrar modales + feedback
      closeSeenModal();
      closeDetailModal();
  
      showToast("Marcado como visto ✓");
      setTimeout(() => {
        showScreen(kind === "series" ? "series-vistas" : "peliculas-vistas");
      }, 1000);
    }
    

    // Listeners
    if (detailSeenBtn) detailSeenBtn.addEventListener("click", () => {
      if (currentDetail.status === "vistas") {
        openConfirmRewatch(); // ✅ Volver a ver
      } else {
        openSeenModal(); // ✅ Marcar como visto (pendientes)
      }
    });

    seenClose.addEventListener("click", closeSeenModal);

    // Click fuera
    seenOverlay.addEventListener("click", (e) => {
      if (e.target === seenOverlay) closeSeenModal();
    });

    // Guardar
    seenSave.addEventListener("click", saveSeenFromDetail);

    // ESC (solo cierra el mini modal si está abierto)
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && seenOverlay.classList.contains("open")) closeSeenModal();
    });

    const confirmOverlay = document.getElementById("confirmOverlay");
    const confirmClose = document.getElementById("confirmClose");
    const confirmCancel = document.getElementById("confirmCancel");
    const confirmDelete = document.getElementById("confirmDelete");
    
    let confirmMode = "delete"; // "delete" | "rewatch"

    function openConfirmDelete() {
      confirmMode = "delete";
      const confirmTitle = document.getElementById("confirmTitle");
      const confirmBody = document.getElementById("confirmBody");
  
      if (confirmTitle) confirmTitle.textContent = "Confirmar eliminación";
      if (confirmBody) confirmBody.innerHTML = `
        <div style="font-weight:800; margin-bottom:8px;">¿Seguro que quieres eliminarlo?</div>
        <div style="color: rgba(233,237,255,.78); line-height:1.4;">
          Esta acción eliminará la película o serie <b>permanentemente</b>.
        </div>
      `;
  
      if (confirmDelete) confirmDelete.textContent = "Eliminar";
      openConfirm();
    }

    function openConfirmRewatch() {
      confirmMode = "rewatch";
      const confirmTitle = document.getElementById("confirmTitle");
      const confirmBody = document.getElementById("confirmBody");
  
      if (confirmTitle) confirmTitle.textContent = "Volver a ver";
      if (confirmBody) confirmBody.innerHTML = `
        <div style="font-weight:800; margin-bottom:8px;">¿Quieres pasar este registro a “Pendientes”?</div>
        <div style="color: rgba(233,237,255,.78); line-height:1.4;">
          Volverá a aparecer en pendientes. No perderás la información guardada (notas/valoraciones).
        </div>
      `;
  
      if (confirmDelete) confirmDelete.textContent = "Pasar a pendientes";
      openConfirm();
    }

    const toast = document.getElementById("toast");
    
    function syncBodyModalOpen() {
      const anyOpen = document.querySelector(".modalOverlay.open") !== null;
      document.body.classList.toggle("modalOpen", anyOpen);
    }

    function openConfirm() {
      confirmOverlay.classList.add("open");
      confirmOverlay.setAttribute("aria-hidden", "false");
      syncBodyModalOpen();
    }

    function closeConfirm() {
      confirmOverlay.classList.remove("open");
      confirmOverlay.setAttribute("aria-hidden", "true");
      syncBodyModalOpen();
    }
    
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 1000);
    }

    
    function deleteCurrentItem() {
      const { kind, id, returnScreen, status, listKey } = currentDetail;
      if (!kind || !id) return;
  
      const isSeries = kind === "series";
      const isVistas = status === "vistas";
  
      // ✅ Key robusta: si no hay listKey, deducimos por kind+status
      const key =
        listKey ||
        (isSeries ?
          (isVistas ? KEY.seriesVistas : KEY.seriesPendientes) :
          (isVistas ? KEY.peliculasVistas : KEY.peliculasPendientes));
  
      const items = loadArray(key);
      const next = items.filter(x => x.id !== id);
      saveArray(key, next);
  
      closeConfirm();
      closeDetailModal();
  
      showToast("Eliminado ✓");
      setTimeout(() => {
        showScreen(returnScreen || (isSeries ? (isVistas ? "series-vistas" : "series-pendientes") :
          (isVistas ? "peliculas-vistas" : "peliculas-pendientes")));
      }, 1000);
    }
    
    
    function moveBackToPendientes() {
      const { kind, id, listKey } = currentDetail;
      if (!kind || !id) return;
  
      // Origen: VISTAS (por seguridad, usa listKey si viene)
      const fromKey = listKey || (kind === "series" ? KEY.seriesVistas : KEY.peliculasVistas);
      const fromArr = loadArray(fromKey);
      const item = fromArr.find(x => x.id === id);
      if (!item) return;
  
      // Quitar de vistas
      const nextFrom = fromArr.filter(x => x.id !== id);
      saveArray(fromKey, nextFrom);
  
      // Destino: PENDIENTES
      const toKey = (kind === "series") ? KEY.seriesPendientes : KEY.peliculasPendientes;
      const toArr = loadArray(toKey);
  
      // ✅ Mantener createdAt original; usamos movedBackAt para ordenar "reciente"
      const moved = {
        ...item,
        movedBackAt: Date.now()
      };
  
      // Lo añadimos arriba para que se vea el primero (y además renderPendientes ordenará bien)
      toArr.unshift(moved);
      saveArray(toKey, toArr);
  
      closeConfirm();
      closeDetailModal();
  
      showToast("Pasado a pendientes ✓");
      setTimeout(() => {
        showScreen(kind === "series" ? "series-pendientes" : "peliculas-pendientes");
      }, 1000);
    }
    
    
    // Abrir confirmación desde el botón Eliminar del detalle
    if (detailDeleteBtn) detailDeleteBtn.addEventListener("click", openConfirmDelete);

    // Cerrar confirm modal
    confirmClose.addEventListener("click", closeConfirm);
    confirmCancel.addEventListener("click", closeConfirm);

    // Click fuera para cerrar confirm
    confirmOverlay.addEventListener("click", (e) => {
      if (e.target === confirmOverlay) closeConfirm();
    });

    // Confirmar eliminación
    confirmDelete.addEventListener("click", () => {
      if (confirmMode === "delete") deleteCurrentItem();
      if (confirmMode === "rewatch") moveBackToPendientes();
});

    // ESC: si está abierto confirm, cierra confirm (sin cerrar el detalle)
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && confirmOverlay.classList.contains("open")) closeConfirm();
    });
