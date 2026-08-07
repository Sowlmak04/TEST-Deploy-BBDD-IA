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
    
    
    function importReplaceAll(parsedWrap) {
      const data = parsedWrap?.data || parsedWrap; // soporta llamada antigua
      
      // Helpers
      const pickArray = (obj, keyList) => {
        for (const k of keyList) {
          if (Array.isArray(obj?.[k])) return obj[k];
        }
        return null;
      };
      
      // 1) Detectar listas en formato NUEVO o LEGACY
      // Nuevo (tu app actual): claves storage reales
      const spNew = pickArray(data, [KEY.seriesPendientes]);
      const svNew = pickArray(data, [KEY.seriesVistas]);
      const ppNew = pickArray(data, [KEY.peliculasPendientes]);
      const pvNew = pickArray(data, [KEY.peliculasVistas]);
      
      // Legacy comunes (por si exportaste antes con nombres “humanos”)
      const spOld = pickArray(data, ["seriesPendientes", "series_pendientes", "sp"]);
      const svOld = pickArray(data, ["seriesVistas", "series_vistas", "sv"]);
      const ppOld = pickArray(data, ["peliculasPendientes", "peliculas_pendientes", "pp", "moviesPendientes"]);
      const pvOld = pickArray(data, ["peliculasVistas", "peliculas_vistas", "pv", "moviesVistas"]);
      
      const sp = spNew ?? spOld ?? [];
      const sv = svNew ?? svOld ?? [];
      const pp = ppNew ?? ppOld ?? [];
      const pv = pvNew ?? pvOld ?? [];
      
      // Si NO ha encontrado nada en ningún formato, lo decimos claro (no “importación fantasma”)
      const foundAny =
        (spNew || svNew || ppNew || pvNew || spOld || svOld || ppOld || pvOld);
      
      if (!foundAny) {
        throw new Error(
          "El JSON no contiene listas compatibles. " +
          "Asegúrate de importar un archivo exportado desde esta app."
        );
      }
      
      // 2) Reemplazar datos
      saveArray(KEY.seriesPendientes, sp);
      saveArray(KEY.seriesVistas, sv);
      saveArray(KEY.peliculasPendientes, pp);
      saveArray(KEY.peliculasVistas, pv);

      // Configuración del usuario: REEMPLAZAR restaura exactamente la selección exportada.
      // Los backups antiguos no incluyen este bloque y conservan la selección actual.
      restoreImportedMyPlatforms(parsedWrap);
      
      // 3) Preferencias: aceptamos tu formato actual (propiedades SORT_KEY/FILTER_KEY/SEARCH_KEY)
      // y también el formato “directo” por si alguna vez lo guardaste así.
      const sortStr = (typeof data?.SORT_KEY === "string") ? data.SORT_KEY : localStorage.getItem(SORT_KEY) || "{}";
      const filterStr = (typeof data?.FILTER_KEY === "string") ? data.FILTER_KEY : localStorage.getItem(FILTER_KEY) || "{}";
      const searchStr = (typeof data?.SEARCH_KEY === "string") ? data.SEARCH_KEY : localStorage.getItem(SEARCH_KEY) || "{}";
      
      if (typeof data?.SORT_KEY === "string") localStorage.setItem(SORT_KEY, sortStr);
      if (typeof data?.FILTER_KEY === "string") localStorage.setItem(FILTER_KEY, filterStr);
      if (typeof data?.SEARCH_KEY === "string") localStorage.setItem(SEARCH_KEY, searchStr);
      
      // 4) Modo REEMPLAZAR: quitamos búsqueda/filtros para que NO parezca vacío
      try {
        localStorage.removeItem(SEARCH_KEY);
        localStorage.removeItem(FILTER_KEY);
      } catch (e) {}
      
      // 5) IMPORTANTÍSIMO: resync estados en memoria (si no, se quedan “viejos”)
      try { sortState = JSON.parse(localStorage.getItem(SORT_KEY) || "{}"); } catch (e) { sortState = {}; }
      try { filterState = JSON.parse(localStorage.getItem(FILTER_KEY) || "{}"); } catch (e) { filterState = {}; }
      try { searchState = JSON.parse(localStorage.getItem(SEARCH_KEY) || "{}"); } catch (e) { searchState = {}; }
      
      // 6) Reset paginación
      try {
        if (typeof pageState === "object" && pageState) {
          Object.keys(pageState).forEach(k => setPageState(k, 1));
        }
      } catch (e) {}
      
      // 7) Migraciones + UI
      migrateWatchLog();
      updateAllFilterBadges();
      syncAllSearchInputs();
      
      // 8) Repintar la pantalla ACTIVA (y por seguridad, las 4 listas)
      const activeScreen = document.querySelector(".screen.active")?.dataset?.screen || null;
      
      renderPendientes("series");
      renderPendientes("peliculas");
      renderVistas("series");
      renderVistas("peliculas");
      
      if (activeScreen) showScreen(activeScreen);
      
      showToast("Importado ✓");
    }
    
    
    function importMergeAll(parsedWrap) {
      const data = parsedWrap?.data || parsedWrap;
      
      const pickArray = (obj, keyList) => {
        for (const k of keyList) {
          if (Array.isArray(obj?.[k])) return obj[k];
        }
        return null;
      };
      
      // Importado: formato nuevo o legacy
      const spImported = pickArray(data, [KEY.seriesPendientes, "seriesPendientes", "series_pendientes", "sp"]) || [];
      const svImported = pickArray(data, [KEY.seriesVistas, "seriesVistas", "series_vistas", "sv"]) || [];
      const ppImported = pickArray(data, [KEY.peliculasPendientes, "peliculasPendientes", "peliculas_pendientes", "pp", "moviesPendientes"]) || [];
      const pvImported = pickArray(data, [KEY.peliculasVistas, "peliculasVistas", "peliculas_vistas", "pv", "moviesVistas"]) || [];
      
      const normalize = (v) => (v || "").toString().trim().toLocaleLowerCase("es");
      
      const dedupeMerged = (currentArr, importedArr, kind) => {
        const byId = new Map();
        
        // 1) meter actuales
        currentArr.forEach(item => {
          if (item?.id) byId.set(item.id, item);
          else byId.set(`noid_current_${Math.random()}`, item);
        });
        
        // 2) importar: si coincide id, gana el importado
        importedArr.forEach(item => {
          if (item?.id && byId.has(item.id)) {
            byId.set(item.id, item);
          } else if (item?.id) {
            byId.set(item.id, item);
          } else {
            byId.set(`noid_import_${Math.random()}`, item);
          }
        });
        
        // 3) dedupe lógico por tipo + title + platform
        const logical = new Map();
        
        [...byId.values()].forEach(item => {
          const title = normalize(item?.title);
          const platform = normalize(item?.platform);
          const logicalKey = `${kind}__${title}__${platform}`;
          
          if (!logical.has(logicalKey)) {
            logical.set(logicalKey, item);
            return;
          }
          
          const existing = logical.get(logicalKey);
          
          // regla simple: nos quedamos con el más "completo"
          const score = (x) => {
            let s = 0;
            if (x?.genre) s += 1;
            if (x?.duration) s += 1;
            if (x?.synopsis) s += 1;
            if (x?.notes) s += 1;
            if (x?.notesAdri) s += 1;
            if (x?.notesLaura) s += 1;
            if (x?.seasons) s += 1;
            if (x?.episodes) s += 1;
            if (Array.isArray(x?.watchLog)) s += x.watchLog.length * 2;
            if (x?.ratingAdri != null && x?.ratingAdri !== "") s += 2;
            if (x?.ratingLaura != null && x?.ratingLaura !== "") s += 2;
            return s;
          };
          
          const existingScore = score(existing);
          const candidateScore = score(item);
          
          if (candidateScore > existingScore) {
            logical.set(logicalKey, item);
          } else if (candidateScore === existingScore) {
            const existingDate = Number(existing?.updatedAt || existing?.createdAt || 0);
            const candidateDate = Number(item?.updatedAt || item?.createdAt || 0);
            if (candidateDate > existingDate) {
              logical.set(logicalKey, item);
            }
          }
        });
        
        return [...logical.values()];
      };
      
      const spCurrent = loadArray(KEY.seriesPendientes);
      const svCurrent = loadArray(KEY.seriesVistas);
      const ppCurrent = loadArray(KEY.peliculasPendientes);
      const pvCurrent = loadArray(KEY.peliculasVistas);
      
      const spFinal = dedupeMerged(spCurrent, spImported, "series-pendientes");
      const svFinal = dedupeMerged(svCurrent, svImported, "series-vistas");
      const ppFinal = dedupeMerged(ppCurrent, ppImported, "peliculas-pendientes");
      const pvFinal = dedupeMerged(pvCurrent, pvImported, "peliculas-vistas");
      
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
