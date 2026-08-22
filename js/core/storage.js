// ---------- Storage ----------
    const KEY = {
      seriesPendientes: "inv_series_pendientes",
      peliculasPendientes: "inv_peliculas_pendientes",
      seriesVistas: "inv_series_vistas",
      peliculasVistas: "inv_peliculas_vistas",
    };

// ---------- Esquema y migración de almacenamiento ----------
const STORAGE_SCHEMA_KEY = "inv_storage_schema_version";
const STORAGE_SCHEMA_VERSION = 3;

const LEGACY_STORAGE_KEYS = {
  seriesPendientes: [
    "seriesPendientes", "series_pendientes", "sp",
    "pendingSeries", "series_pending"
  ],
  peliculasPendientes: [
    "peliculasPendientes", "peliculas_pendientes", "pp",
    "moviesPendientes", "pendingMovies", "movies_pending"
  ],
  seriesVistas: [
    "seriesVistas", "series_vistas", "sv",
    "watchedSeries", "series_watched"
  ],
  peliculasVistas: [
    "peliculasVistas", "peliculas_vistas", "pv",
    "moviesVistas", "watchedMovies", "movies_watched"
  ]
};

function safeParseArray(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function migrateLegacyArray(targetKey, aliases) {
  const current = safeParseArray(localStorage.getItem(targetKey));

  // Nunca sobrescribimos datos válidos que ya existan en la clave actual.
  if (current && current.length > 0) {
    return { migrated: false, source: null, count: current.length };
  }

  for (const alias of aliases) {
    if (alias === targetKey) continue;
    const legacy = safeParseArray(localStorage.getItem(alias));
    if (legacy && legacy.length > 0) {
      localStorage.setItem(targetKey, JSON.stringify(legacy));
      return { migrated: true, source: alias, count: legacy.length };
    }
  }

  // Si la clave actual todavía no existe, la inicializamos sin borrar nada.
  if (localStorage.getItem(targetKey) === null) {
    localStorage.setItem(targetKey, "[]");
  }

  return { migrated: false, source: null, count: current?.length || 0 };
}

function initStorageSchema() {
  const report = {
    origin: location.origin,
    pathname: location.pathname,
    previousVersion: Number(localStorage.getItem(STORAGE_SCHEMA_KEY) || 0),
    currentVersion: STORAGE_SCHEMA_VERSION,
    migrations: []
  };

  report.migrations.push({
    target: KEY.seriesPendientes,
    ...migrateLegacyArray(KEY.seriesPendientes, LEGACY_STORAGE_KEYS.seriesPendientes)
  });
  report.migrations.push({
    target: KEY.peliculasPendientes,
    ...migrateLegacyArray(KEY.peliculasPendientes, LEGACY_STORAGE_KEYS.peliculasPendientes)
  });
  report.migrations.push({
    target: KEY.seriesVistas,
    ...migrateLegacyArray(KEY.seriesVistas, LEGACY_STORAGE_KEYS.seriesVistas)
  });
  report.migrations.push({
    target: KEY.peliculasVistas,
    ...migrateLegacyArray(KEY.peliculasVistas, LEGACY_STORAGE_KEYS.peliculasVistas)
  });

  localStorage.setItem(STORAGE_SCHEMA_KEY, String(STORAGE_SCHEMA_VERSION));
  localStorage.setItem("inv_storage_last_check", String(Date.now()));

  console.info("[Storage 2.1]", report);
  return report;
}



// ---------- Diagnóstico integrado ----------
const DIAGNOSTIC_MAIN_KEYS = [
  KEY.seriesPendientes,
  KEY.peliculasPendientes,
  KEY.seriesVistas,
  KEY.peliculasVistas
];

function inspectStorageValue(raw) {
  if (raw === null) return { type: "ausente", count: 0, preview: "" };

  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) {
      return { type: "array", count: value.length, preview: JSON.stringify(value.slice(0, 2)) };
    }
    return {
      type: value === null ? "null" : typeof value,
      count: null,
      preview: JSON.stringify(value).slice(0, 300)
    };
  } catch {
    return { type: "texto", count: null, preview: String(raw).slice(0, 300) };
  }
}

function parseDiagnosticCollection(key) {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return { key, valid: false, issue: "ausente", items: [], count: 0 };
  }

  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) {
      return { key, valid: false, issue: "formato inválido", items: [], count: 0 };
    }
    return { key, valid: true, issue: null, items: value, count: value.length };
  } catch {
    return { key, valid: false, issue: "JSON inválido", items: [], count: 0 };
  }
}

function diagnosticTmdbId(item) {
  const id = Number(item?.tmdbId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function buildLibraryIntegrityReport() {
  const collections = DIAGNOSTIC_MAIN_KEYS.map(parseDiagnosticCollection);
  const byKey = new Map(collections.map(collection => [collection.key, collection]));
  const allItems = collections.flatMap(collection =>
    collection.items.map(item => ({ key: collection.key, item }))
  );

  const internalIdGroups = new Map();
  allItems.forEach(({ key, item }) => {
    const id = String(item?.id ?? "").trim();
    if (!id) return;
    if (!internalIdGroups.has(id)) internalIdGroups.set(id, []);
    internalIdGroups.get(id).push(key);
  });
  const duplicateInternalIds = [...internalIdGroups.entries()]
    .filter(([, keys]) => keys.length > 1)
    .map(([id, keys]) => ({ id, keys }));

  const duplicateTmdbWithin = [];
  collections.forEach(collection => {
    const groups = new Map();
    collection.items.forEach(item => {
      const tmdbId = diagnosticTmdbId(item);
      if (tmdbId === null) return;
      if (!groups.has(tmdbId)) groups.set(tmdbId, []);
      groups.get(tmdbId).push(item);
    });
    groups.forEach((items, tmdbId) => {
      if (items.length > 1) {
        duplicateTmdbWithin.push({
          key: collection.key,
          tmdbId,
          count: items.length,
          titles: items.map(item => item?.title || "Sin título")
        });
      }
    });
  });

  const contradictions = [];
  [
    [KEY.seriesPendientes, KEY.seriesVistas, "series"],
    [KEY.peliculasPendientes, KEY.peliculasVistas, "películas"]
  ].forEach(([pendingKey, watchedKey, kind]) => {
    const pending = byKey.get(pendingKey)?.items || [];
    const watched = byKey.get(watchedKey)?.items || [];
    const pendingIds = new Map();

    pending.forEach(item => {
      const tmdbId = diagnosticTmdbId(item);
      if (tmdbId !== null && !pendingIds.has(tmdbId)) pendingIds.set(tmdbId, item);
    });

    watched.forEach(item => {
      const tmdbId = diagnosticTmdbId(item);
      if (tmdbId === null || !pendingIds.has(tmdbId)) return;
      contradictions.push({
        kind,
        tmdbId,
        pendingTitle: pendingIds.get(tmdbId)?.title || "Sin título",
        watchedTitle: item?.title || "Sin título"
      });
    });
  });

  const withoutTmdb = allItems.filter(({ item }) => diagnosticTmdbId(item) === null);
  const invalidCollections = collections.filter(collection => !collection.valid);

  const incidentCount =
    invalidCollections.length +
    duplicateInternalIds.length +
    duplicateTmdbWithin.length +
    contradictions.length;

  return {
    generatedAt: new Date().toISOString(),
    collections: collections.map(({ key, valid, issue, count }) => ({ key, valid, issue, count })),
    totalRecords: collections.reduce((sum, collection) => sum + collection.count, 0),
    invalidCollections,
    duplicateInternalIds,
    duplicateTmdbWithin,
    contradictions,
    withoutTmdb: {
      count: withoutTmdb.length,
      records: withoutTmdb.map(({ key, item }) => ({
        key,
        id: item?.id ?? null,
        title: item?.title || "Sin título"
      }))
    },
    incidentCount,
    status: incidentCount === 0 ? "ok" : "review"
  };
}

function buildStorageDiagnosticReport() {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator.standalone === true;

  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const raw = localStorage.getItem(key);
    entries.push({ key, raw, ...inspectStorageValue(raw) });
  }
  entries.sort((a, b) => a.key.localeCompare(b.key, "es"));

  return {
    generatedAt: new Date().toISOString(),
    origin: location.origin,
    href: location.href,
    pathname: location.pathname,
    mode: standalone ? "Aplicación instalada (standalone)" : "Navegador",
    standalone,
    schemaVersion: localStorage.getItem(STORAGE_SCHEMA_KEY),
    mainKeys: DIAGNOSTIC_MAIN_KEYS.map(key =>
      entries.find(item => item.key === key) ||
      { key, raw: null, type: "ausente", count: 0, preview: "" }
    ),
    integrity: buildLibraryIntegrityReport(),
    entries
  };
}

function diagnosticCell(value) {
  const td = document.createElement("td");
  td.textContent = value ?? "—";
  return td;
}

function renderStorageDiagnostic() {
  const report = buildStorageDiagnosticReport();
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "—";
  };

  setText("diagOrigin", report.origin);
  setText("diagPathname", report.pathname);
  setText("diagHref", report.href);
  setText("diagMode", report.mode);
  setText("diagSchema", report.schemaVersion || "no registrada");

  const integrity = report.integrity;
  const integrityStatus = document.getElementById("diagIntegrityStatus");
  if (integrityStatus) {
    const ok = integrity.status === "ok";
    integrityStatus.className = `diagnosticIntegrityStatus ${ok ? "ok" : "warning"}`;
    integrityStatus.textContent = ok
      ? "Sin incidencias detectadas"
      : `${integrity.incidentCount} ${integrity.incidentCount === 1 ? "incidencia detectada" : "incidencias detectadas"} para revisar`;
  }

  const integrityValues = {
    diagIntegritySeriesPending: integrity.collections.find(item => item.key === KEY.seriesPendientes)?.count ?? 0,
    diagIntegritySeriesWatched: integrity.collections.find(item => item.key === KEY.seriesVistas)?.count ?? 0,
    diagIntegrityMoviesPending: integrity.collections.find(item => item.key === KEY.peliculasPendientes)?.count ?? 0,
    diagIntegrityMoviesWatched: integrity.collections.find(item => item.key === KEY.peliculasVistas)?.count ?? 0,
    diagIntegrityInternalIds: integrity.duplicateInternalIds.length,
    diagIntegrityTmdbWithin: integrity.duplicateTmdbWithin.length,
    diagIntegrityContradictions: integrity.contradictions.length,
    diagIntegrityWithoutTmdb: integrity.withoutTmdb.count,
    diagIntegrityInvalidCollections: integrity.invalidCollections.length
  };
  Object.entries(integrityValues).forEach(([id, value]) => setText(id, value));

  const mainBody = document.getElementById("diagMainKeys");
  if (mainBody) {
    mainBody.replaceChildren();
    report.mainKeys.forEach(item => {
      const tr = document.createElement("tr");
      tr.append(
        diagnosticCell(item.key),
        diagnosticCell(item.type),
        diagnosticCell(item.count ?? "—")
      );
      mainBody.append(tr);
    });
  }

  const allBody = document.getElementById("diagAllKeys");
  if (allBody) {
    allBody.replaceChildren();
    if (!report.entries.length) {
      const tr = document.createElement("tr");
      const td = diagnosticCell("No hay claves en localStorage para este origen.");
      td.colSpan = 4;
      tr.append(td);
      allBody.append(tr);
    } else {
      report.entries.forEach(item => {
        const tr = document.createElement("tr");
        tr.append(
          diagnosticCell(item.key),
          diagnosticCell(item.type),
          diagnosticCell(item.count ?? "—"),
          diagnosticCell(item.preview || "")
        );
        allBody.append(tr);
      });
    }
  }

  window.currentStorageDiagnosticReport = report;
  return report;
}

function diagnosticReportAsText(report = buildStorageDiagnosticReport()) {
  const lines = [
    "DIAGNÓSTICO DE ALMACENAMIENTO",
    `Generado: ${report.generatedAt}`,
    `Origen: ${report.origin}`,
    `Ruta: ${report.pathname}`,
    `URL: ${report.href}`,
    `Modo: ${report.mode}`,
    `Versión del esquema: ${report.schemaVersion || "no registrada"}`,
    "",
    "ESTADO DE INTEGRIDAD",
    `Estado general: ${report.integrity.status === "ok" ? "Sin incidencias detectadas" : `${report.integrity.incidentCount} incidencias para revisar`}`,
    `IDs internos duplicados: ${report.integrity.duplicateInternalIds.length}`,
    `Duplicados TMDb dentro de colecciones: ${report.integrity.duplicateTmdbWithin.length}`,
    `Contradicciones Pendientes/Vistas: ${report.integrity.contradictions.length}`,
    `Colecciones principales inválidas: ${report.integrity.invalidCollections.length}`,
    `Registros sin TMDb (informativo): ${report.integrity.withoutTmdb.count}`,
    "",
    "DATOS PRINCIPALES"
  ];

  report.mainKeys.forEach(item => {
    lines.push(`${item.key}: tipo=${item.type}; cantidad=${item.count ?? "—"}`);
  });

  lines.push("", "TODAS LAS CLAVES");
  report.entries.forEach(item => {
    lines.push(`${item.key}: tipo=${item.type}; cantidad=${item.count ?? "—"}; vista=${item.preview || ""}`);
  });
  return lines.join("\n");
}

async function copyStorageDiagnostic() {
  const text = diagnosticReportAsText(renderStorageDiagnostic());

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) throw new Error("No se pudo copiar.");
}

function downloadStorageDiagnostic() {
  const report = renderStorageDiagnostic();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `diagnostico_almacenamiento_${Date.now()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


    function loadArray(key){
      return LibraryRepository.getAll(key);
    }

    function saveArray(key, arr){
      return LibraryRepository.replaceAll(key, arr);
    }

    // ===============================
    // ===== Exportar / Importar =====
    // ===============================
    
    // Qué guardamos en el JSON (biblioteca + preferencias de interfaz + configuración).
    // `data` se mantiene intacto para conservar compatibilidad con backups antiguos.
    // `settings` queda versionado y preparado para futuras preferencias del usuario.
    function buildExportObject() {
      const myPlatforms = (typeof UserPlatformsRepository !== "undefined")
        ? UserPlatformsRepository.loadSelection()
        : { schemaVersion: 1, region: "ES", providers: [], savedAt: null };

      return {
        app: "Inventario Series&Películas",
        version: 2,
        exportedAt: Date.now(),
        data: {
          // Listas principales
          [KEY.seriesPendientes]: loadArray(KEY.seriesPendientes),
          [KEY.seriesVistas]: loadArray(KEY.seriesVistas),
          [KEY.peliculasPendientes]: loadArray(KEY.peliculasPendientes),
          [KEY.peliculasVistas]: loadArray(KEY.peliculasVistas),

          // Preferencias (orden/filtro/búsqueda)
          SORT_KEY: localStorage.getItem(SORT_KEY) || "{}",
          FILTER_KEY: localStorage.getItem(FILTER_KEY) || "{}",
          SEARCH_KEY: localStorage.getItem(SEARCH_KEY) || "{}",
        },
        settings: {
          schemaVersion: 1,
          myPlatforms
        }
      };
    }

    function readImportedMyPlatforms(parsedWrap) {
      const raw = parsedWrap?.raw || parsedWrap || {};
      const data = parsedWrap?.data || raw?.data || raw;

      const candidates = [
        raw?.settings?.myPlatforms,
        data?.settings?.myPlatforms,
        data?.myPlatforms,
        raw?.myPlatforms
      ];

      const source = candidates.find(value => value !== undefined);
      if (source === undefined) return { present: false, valid: false, providers: [] };

      const providers = Array.isArray(source)
        ? source
        : (source && typeof source === "object" && Array.isArray(source.providers))
          ? source.providers
          : null;

      // Si el bloque existe pero está corrupto, preservamos la selección actual.
      if (!providers) return { present: true, valid: false, providers: [] };

      const safeProviders = providers.filter(provider => {
        const providerId = Number(provider?.providerId ?? provider?.id);
        const name = String(provider?.name ?? provider?.providerName ?? "").trim();
        return Number.isSafeInteger(providerId) && providerId > 0 && Boolean(name);
      });

      const normalized = (typeof UserPlatformsRepository !== "undefined")
        ? UserPlatformsRepository.normalizeProviders(safeProviders)
        : [];

      return { present: true, valid: true, providers: normalized };
    }

    function restoreImportedMyPlatforms(parsedWrap) {
      const imported = readImportedMyPlatforms(parsedWrap);
      if (!imported.present) return { restored: false, reason: "absent" };
      if (!imported.valid) {
        console.warn("[Importación] Bloque myPlatforms inválido; se conserva la selección actual.");
        return { restored: false, reason: "invalid" };
      }
      if (typeof UserPlatformsRepository === "undefined") {
        console.warn("[Importación] Repositorio de plataformas no disponible.");
        return { restored: false, reason: "repository-unavailable" };
      }

      UserPlatformsRepository.saveSelection(imported.providers);
      return { restored: true, count: imported.providers.length };
    }
    
    function downloadJson(obj, filename) {
      const json = JSON.stringify(obj, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      setTimeout(() => URL.revokeObjectURL(url), 800);
    }
    
    async function exportAllData() {
      const obj = buildExportObject();
      
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const stamp = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
      const filename = `inventario_backup_${stamp}.json`;
      
      const json = JSON.stringify(obj, null, 2);
      
      // ✅ iPhone-friendly: hoja de compartir si está disponible
      try {
        const file = new File([json], filename, { type: "application/json" });
        
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          await navigator.share({
            title: "Backup Inventario",
            text: "Backup JSON del inventario",
            files: [file],
          });
          showToast("Exportado ✓");
          return;
        }
      } catch (e) {
        // Si falla share, caemos al método clásico
      }
      
      // Fallback: descarga normal
      downloadJson(obj, filename);
      showToast("Exportado ✓ (mira Archivos/Descargas)");
    }
    
    function parseImportJson(text) {
      const cleaned = String(text || "").replace(/^\uFEFF/, "").trim();
      
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        throw new Error("No se pudo parsear el JSON (archivo corrupto o no es JSON válido).");
      }
      
      if (!parsed || typeof parsed !== "object") {
        throw new Error("JSON inválido.");
      }
      
      // Permitimos formatos:
      // A) { data: { ... } }  (nuevo)
      // B) { ... }            (legacy)
      const data = (parsed.data && typeof parsed.data === "object") ? parsed.data : parsed;
      
      if (!data || typeof data !== "object") {
        throw new Error("Este JSON no tiene la estructura esperada.");
      }
      
      // devolvemos SIEMPRE { raw, data }
      return { raw: parsed, data };
    }
    
    
    function prepareImportReplace(parsedWrap) {
      const data = parsedWrap?.data || parsedWrap;

      const definitions = [
        {
          key: KEY.seriesPendientes,
          names: [KEY.seriesPendientes, "seriesPendientes", "series_pendientes", "sp"],
          label: "series pendientes"
        },
        {
          key: KEY.seriesVistas,
          names: [KEY.seriesVistas, "seriesVistas", "series_vistas", "sv"],
          label: "series vistas"
        },
        {
          key: KEY.peliculasPendientes,
          names: [KEY.peliculasPendientes, "peliculasPendientes", "peliculas_pendientes", "pp", "moviesPendientes"],
          label: "películas pendientes"
        },
        {
          key: KEY.peliculasVistas,
          names: [KEY.peliculasVistas, "peliculasVistas", "peliculas_vistas", "pv", "moviesVistas"],
          label: "películas vistas"
        }
      ];

      const findPresentArray = (obj, names) => {
        for (const name of names) {
          if (!Object.prototype.hasOwnProperty.call(obj || {}, name)) continue;
          return {
            present: true,
            valid: Array.isArray(obj[name]),
            value: obj[name]
          };
        }
        return { present: false, valid: false, value: null };
      };

      const found = definitions.map(definition => ({
        ...definition,
        imported: findPresentArray(data, definition.names)
      }));

      const missing = found
        .filter(entry => !entry.imported.present)
        .map(entry => entry.label);

      if (missing.length) {
        throw new Error(
          "REEMPLAZAR requiere un backup completo con las cuatro colecciones principales. " +
          "Faltan: " + missing.join(", ") + ". " +
          "Si el archivo es parcial, utiliza MEZCLAR."
        );
      }

      const invalid = found
        .filter(entry => entry.imported.present && !entry.imported.valid)
        .map(entry => entry.label);

      if (invalid.length) {
        throw new Error(
          "El backup contiene colecciones con formato inválido: " +
          invalid.join(", ") + "."
        );
      }

      // Normalizamos las cuatro colecciones antes de realizar ninguna escritura.
      // Un array vacío es válido; una colección ausente no lo es en REEMPLAZAR.
      const usedIds = new Set();
      const collections = {};
      found.forEach(entry => {
        const normalized = LibraryModel.normalizeCollection(
          entry.imported.value,
          entry.key,
          usedIds
        );
        collections[entry.key] = normalized.items;
      });

      return {
        data,
        collections,
        myPlatforms: readImportedMyPlatforms(parsedWrap)
      };
    }


    function importReplaceAll(parsedWrap) {
      // Fase 1: preparar y validar TODO antes de tocar la biblioteca.
      const prepared = prepareImportReplace(parsedWrap);
      const data = prepared.data;

      // Snapshot defensivo para poder restaurar si una escritura excepcional falla.
      const previous = {
        [KEY.seriesPendientes]: loadArray(KEY.seriesPendientes),
        [KEY.seriesVistas]: loadArray(KEY.seriesVistas),
        [KEY.peliculasPendientes]: loadArray(KEY.peliculasPendientes),
        [KEY.peliculasVistas]: loadArray(KEY.peliculasVistas)
      };

      try {
        saveArray(KEY.seriesPendientes, prepared.collections[KEY.seriesPendientes]);
        saveArray(KEY.seriesVistas, prepared.collections[KEY.seriesVistas]);
        saveArray(KEY.peliculasPendientes, prepared.collections[KEY.peliculasPendientes]);
        saveArray(KEY.peliculasVistas, prepared.collections[KEY.peliculasVistas]);
      } catch (error) {
        // localStorage no ofrece transacciones multi-clave. Intentamos rollback
        // inmediato para evitar dejar una importación parcialmente aplicada.
        try {
          saveArray(KEY.seriesPendientes, previous[KEY.seriesPendientes]);
          saveArray(KEY.seriesVistas, previous[KEY.seriesVistas]);
          saveArray(KEY.peliculasPendientes, previous[KEY.peliculasPendientes]);
          saveArray(KEY.peliculasVistas, previous[KEY.peliculasVistas]);
        } catch (rollbackError) {
          console.error("[Importación] También falló la restauración defensiva.", rollbackError);
        }
        throw new Error(
          "La importación no pudo completarse y se intentó restaurar la biblioteca anterior. " +
          (error?.message || error)
        );
      }

      // Configuración del usuario: solo se restaura después de que las cuatro
      // colecciones hayan sido validadas y escritas correctamente.
      const platformsRestore = restoreImportedMyPlatforms(parsedWrap);

      // Preferencias: aceptamos el formato actual y conservamos compatibilidad legacy.
      const sortStr = (typeof data?.SORT_KEY === "string")
        ? data.SORT_KEY
        : localStorage.getItem(SORT_KEY) || "{}";
      const filterStr = (typeof data?.FILTER_KEY === "string")
        ? data.FILTER_KEY
        : localStorage.getItem(FILTER_KEY) || "{}";
      const searchStr = (typeof data?.SEARCH_KEY === "string")
        ? data.SEARCH_KEY
        : localStorage.getItem(SEARCH_KEY) || "{}";

      if (typeof data?.SORT_KEY === "string") localStorage.setItem(SORT_KEY, sortStr);
      if (typeof data?.FILTER_KEY === "string") localStorage.setItem(FILTER_KEY, filterStr);
      if (typeof data?.SEARCH_KEY === "string") localStorage.setItem(SEARCH_KEY, searchStr);

      // Modo REEMPLAZAR: quitamos búsqueda/filtros para que no parezca vacío.
      try {
        localStorage.removeItem(SEARCH_KEY);
        localStorage.removeItem(FILTER_KEY);
      } catch (e) {}

      try { sortState = JSON.parse(localStorage.getItem(SORT_KEY) || "{}"); } catch (e) { sortState = {}; }
      try { filterState = JSON.parse(localStorage.getItem(FILTER_KEY) || "{}"); } catch (e) { filterState = {}; }
      try { searchState = JSON.parse(localStorage.getItem(SEARCH_KEY) || "{}"); } catch (e) { searchState = {}; }

      try {
        if (typeof pageState === "object" && pageState) {
          Object.keys(pageState).forEach(k => setPageState(k, 1));
        }
      } catch (e) {}

      migrateWatchLog();
      updateAllFilterBadges();
      syncAllSearchInputs();

      const activeScreen = document.querySelector(".screen.active")?.dataset?.screen || null;

      renderPendientes("series");
      renderPendientes("peliculas");
      renderVistas("series");
      renderVistas("peliculas");

      // Si el backup restauró Mis plataformas, sincronizamos inmediatamente
      // los componentes que dependen de esa selección, sin esperar a navegar
      // ni a realizar una nueva consulta a TMDb.
      if (platformsRestore?.restored) {
        try {
          if (typeof UserPlatformsUI !== "undefined" &&
              typeof UserPlatformsUI.syncFromStorage === "function") {
            UserPlatformsUI.syncFromStorage();
          }
        } catch (error) {
          console.warn("[Importación] No se pudo refrescar Mis plataformas.", error);
        }

        try {
          if (typeof renderHomeDashboard === "function") {
            renderHomeDashboard();
          }
        } catch (error) {
          console.warn("[Importación] No se pudo refrescar Inicio.", error);
        }

        try {
          if (typeof renderStatisticsDashboard === "function") {
            renderStatisticsDashboard();
          }
        } catch (error) {
          console.warn("[Importación] No se pudo refrescar Resumen.", error);
        }
      }

      if (activeScreen) showScreen(activeScreen);

      showToast("Importado ✓");
    }

    
    function getImportMergePreview(parsedWrap) {
      const data = parsedWrap?.data || parsedWrap;

      const pickArray = (obj, keyList) => {
        for (const k of keyList) {
          if (Array.isArray(obj?.[k])) return obj[k];
        }
        return null;
      };

      const imported = [
        pickArray(data, [KEY.seriesPendientes, "seriesPendientes", "series_pendientes", "sp"]) || [],
        pickArray(data, [KEY.seriesVistas, "seriesVistas", "series_vistas", "sv"]) || [],
        pickArray(data, [KEY.peliculasPendientes, "peliculasPendientes", "peliculas_pendientes", "pp", "moviesPendientes"]) || [],
        pickArray(data, [KEY.peliculasVistas, "peliculasVistas", "peliculas_vistas", "pv", "moviesVistas"]) || []
      ];

      const currentCount =
        loadArray(KEY.seriesPendientes).length +
        loadArray(KEY.seriesVistas).length +
        loadArray(KEY.peliculasPendientes).length +
        loadArray(KEY.peliculasVistas).length;

      return {
        currentCount,
        importedCount: imported.reduce((sum, list) => sum + list.length, 0)
      };
    }


    function importMergeAll(parsedWrap) {
      const data = parsedWrap?.data || parsedWrap;

      const pickArray = (obj, keyList) => {
        for (const k of keyList) {
          if (Array.isArray(obj?.[k])) return obj[k];
        }
        return null;
      };

      const spImported = pickArray(data, [KEY.seriesPendientes, "seriesPendientes", "series_pendientes", "sp"]) || [];
      const svImported = pickArray(data, [KEY.seriesVistas, "seriesVistas", "series_vistas", "sv"]) || [];
      const ppImported = pickArray(data, [KEY.peliculasPendientes, "peliculasPendientes", "peliculas_pendientes", "pp", "moviesPendientes"]) || [];
      const pvImported = pickArray(data, [KEY.peliculasVistas, "peliculasVistas", "peliculas_vistas", "pv", "moviesVistas"]) || [];

      const normalize = (v) => (v || "").toString().trim().toLocaleLowerCase("es");
      const tmdbIdOf = (item) => {
        const id = Number(item?.tmdbId);
        return Number.isFinite(id) && id > 0 ? id : null;
      };

      const dedupeMerged = (currentArr, importedArr) => {
        const result = [...currentArr];

        const findStrongMatch = (candidate) => {
          // 1) Mismo ID interno: identidad fuerte.
          if (candidate?.id) {
            const byId = result.findIndex(item => item?.id === candidate.id);
            if (byId !== -1) return byId;
          }

          // 2) Mismo TMDb dentro de la misma colección/tipo: identidad fuerte.
          const candidateTmdbId = tmdbIdOf(candidate);
          if (candidateTmdbId) {
            const byTmdb = result.findIndex(item => tmdbIdOf(item) === candidateTmdbId);
            if (byTmdb !== -1) return byTmdb;

            // TMDb diferente nunca se resuelve por simple coincidencia de título.
            return -1;
          }

          // 3) Compatibilidad legacy conservadora:
          // solo registros SIN TMDb y con plataforma legacy explícita.
          // El título por sí solo nunca es identidad suficiente.
          const title = normalize(candidate?.title);
          const platform = normalize(candidate?.platform);
          if (!title || !platform) return -1;

          return result.findIndex(item =>
            !tmdbIdOf(item) &&
            normalize(item?.title) === title &&
            normalize(item?.platform) === platform
          );
        };

        importedArr.forEach(item => {
          const matchIndex = findStrongMatch(item);
          if (matchIndex === -1) {
            result.push(item);
          } else {
            // Ante identidad segura, gana el registro importado.
            // No se hace fusión campo a campo.
            result[matchIndex] = item;
          }
        });

        return result;
      };

      const spCurrent = loadArray(KEY.seriesPendientes);
      const svCurrent = loadArray(KEY.seriesVistas);
      const ppCurrent = loadArray(KEY.peliculasPendientes);
      const pvCurrent = loadArray(KEY.peliculasVistas);

      const spFinal = dedupeMerged(spCurrent, spImported);
      const svFinal = dedupeMerged(svCurrent, svImported);
      const ppFinal = dedupeMerged(ppCurrent, ppImported);
      const pvFinal = dedupeMerged(pvCurrent, pvImported);

      saveArray(KEY.seriesPendientes, spFinal);
      saveArray(KEY.seriesVistas, svFinal);
      saveArray(KEY.peliculasPendientes, ppFinal);
      saveArray(KEY.peliculasVistas, pvFinal);

      // Preferencias: NO las pisamos en mezclar
      try {
        if (typeof pageState === "object" && pageState) {
          Object.keys(pageState).forEach(k => setPageState(k, 1));
        }
      } catch (e) {}

      migrateWatchLog();
      updateAllFilterBadges();
      syncAllSearchInputs();

      renderPendientes("series");
      renderPendientes("peliculas");
      renderVistas("series");
      renderVistas("peliculas");

      const activeScreen = document.querySelector(".screen.active")?.dataset?.screen || null;
      if (activeScreen) showScreen(activeScreen);

      showToast("Importado y mezclado ✓");
    }

    
    function newId(){
      return LibraryModel.createId();
    }

    function escapeHtml(str){
      return String(str)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
    }

    function setMsg(el, text, type){
      el.textContent = text || "";
      el.className = "msg" + (type ? " " + type : "");
      if(type === "ok"){
        setTimeout(() => { el.textContent=""; el.className="msg"; }, 1600);
      }
    }
    
    
    function formatAvg(n) {
      const v = Math.round(Number(n) * 100) / 100; // 2 decimales reales
      let s = v.toFixed(2); // "9.75"
      s = s.replace(/\.?0+$/, ""); // "9.75" / "9.5" / "10"
      return s.replace(".", ","); // "9,75"
    }
