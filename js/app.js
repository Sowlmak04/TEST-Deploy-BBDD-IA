// SOLO botones (evita el bug de burbujeo)
document.querySelectorAll("button[data-screen]").forEach(btn => {
  btn.addEventListener("click", (e) => {
    // En modo edición, el botón Volver lo gestiona ratings-forms.js.
    // Evita que la navegación genérica compita con el destino de retorno.
    if (btn.dataset.prevScreen) return;

    e.preventDefault();
    showScreen(btn.dataset.screen);
  });
});


// ===== Botones Exportar / Importar =====
const btnExport = document.getElementById("btnExport");
const importFileReplace = document.getElementById("importFileReplace");
const importFileMerge = document.getElementById("importFileMerge");

if (btnExport) {
  btnExport.addEventListener("click", () => exportAllData());
}

async function readImportFile(file) {
  return await (typeof file.text === "function" ?
    file.text() :
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(r.error || new Error("No se pudo leer el archivo."));
      r.readAsText(file);
    })
  );
}

// ===== IMPORTAR REEMPLAZAR =====
if (importFileReplace) {
  importFileReplace.addEventListener("click", () => {
    importFileReplace.value = "";
  });
  
  importFileReplace.addEventListener("change", async () => {
    const file = importFileReplace.files && importFileReplace.files[0];
    if (!file) {
      alert("No se detectó archivo (REEMPLAZAR).");
      return;
    }
    
    
    
    try {
      const text = await readImportFile(file);
      const parsed = parseImportJson(text);
      
      importReplaceAll(parsed);

      importFileReplace.value = "";
    } catch (err) {
      console.error(err);
      importFileReplace.value = "";
      alert("No se pudo importar.\n\nDetalle: " + (err?.message || err));
    }
  });
}

// ===== IMPORTAR MEZCLAR =====
if (importFileMerge) {
  importFileMerge.addEventListener("click", () => {
    importFileMerge.value = "";
  });
  
  importFileMerge.addEventListener("change", async () => {
    const file = importFileMerge.files && importFileMerge.files[0];
    if (!file) {
      alert("No se detectó archivo (MEZCLAR).");
      return;
    }
    
    
    
    try {
      const text = await readImportFile(file);
      const parsed = parseImportJson(text);
      
      importMergeAll(parsed);

      importFileMerge.value = "";
    } catch (err) {
      console.error(err);
      importFileMerge.value = "";
      alert("No se pudo importar.\n\nDetalle: " + (err?.message || err));
    }
  });
}



// ===== Diagnóstico integrado =====
const btnOpenDiagnostic = document.getElementById("btnOpenDiagnostic");
const btnDiagnosticRefresh = document.getElementById("btnDiagnosticRefresh");
const btnDiagnosticCopy = document.getElementById("btnDiagnosticCopy");
const btnDiagnosticDownload = document.getElementById("btnDiagnosticDownload");
const diagnosticMessage = document.getElementById("diagnosticMessage");

function setDiagnosticMessage(message, isError = false) {
  if (!diagnosticMessage) return;
  diagnosticMessage.textContent = message;
  diagnosticMessage.classList.toggle("error", isError);
}

if (btnOpenDiagnostic) {
  btnOpenDiagnostic.addEventListener("click", () => {
    renderStorageDiagnostic();
    setDiagnosticMessage("");
  });
}

if (btnDiagnosticRefresh) {
  btnDiagnosticRefresh.addEventListener("click", () => {
    renderStorageDiagnostic();
    setDiagnosticMessage("Diagnóstico actualizado.");
  });
}

if (btnDiagnosticCopy) {
  btnDiagnosticCopy.addEventListener("click", async () => {
    try {
      await copyStorageDiagnostic();
      setDiagnosticMessage("Informe copiado al portapapeles.");
    } catch (error) {
      console.error(error);
      setDiagnosticMessage("No se pudo copiar. Usa Descargar JSON.", true);
    }
  });
}

if (btnDiagnosticDownload) {
  btnDiagnosticDownload.addEventListener("click", () => {
    try {
      downloadStorageDiagnostic();
      setDiagnosticMessage("Archivo JSON preparado.");
    } catch (error) {
      console.error(error);
      setDiagnosticMessage("No se pudo descargar el diagnóstico.", true);
    }
  });
}


// Toolbar (Filtrar / Ordenar)
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action][data-scope]");
  if (!btn) return;

  const action = btn.dataset.action; // "filter" | "sort"
  const scope  = btn.dataset.scope;  // pantalla

  if (action === "filter") openFilterModal(scope);
  if (action === "sort") openSortModal(scope);
});


// ===== Toggle buscador (🔎 abre/cierra en fila inferior) =====
document.addEventListener("click", (e) => {
  const toggle = e.target.closest("button[data-search-toggle]");
  if (!toggle) return;
  
  const scope = toggle.dataset.searchToggle;
  const box = document.querySelector(`.searchBox[data-search-box="${scope}"]`);
  const screen = document.querySelector(`.screen[data-screen="${scope}"]`);
  if (!box || !screen) return;
  
  const willOpen = !box.classList.contains("open");
  
  // Cerrar todos los buscadores abiertos (opcional pero recomendado)
  document.querySelectorAll(".searchBox.open").forEach(b => b.classList.remove("open"));
  document.querySelectorAll(".screen.searchOpen").forEach(s => s.classList.remove("searchOpen"));
  
  if (willOpen) {
    box.classList.add("open");
    screen.classList.add("searchOpen");
    const input = box.querySelector("input.searchInput");
    if (input) input.focus();
  } else {
    box.classList.remove("open");
    screen.classList.remove("searchOpen");
  }
});



function initFromHash() {
  const h = (location.hash || "").replace("#", "").trim().toLowerCase();
  if (
    h === "peliculas" ||
    h === "resumen" ||
    h === "anadir" ||
    h === "series"
  ) {
    setMainTab(h);
  }
  else setMainTab("series");
}
window.addEventListener("hashchange", initFromHash);
// Inicializa y migra el almacenamiento antes de pintar la aplicación.
const storageInitReport = initStorageSchema();
const modelMigrationReport = LibraryRepository.migrateAll();
LibraryRepository.loadAll();

console.info(
  "[Sprint 4: modelo normalizado]",
  modelMigrationReport
);

if (storageInitReport.migrations.some(item => item.migrated)) {
  console.info("Se recuperaron datos desde claves antiguas.", storageInitReport.migrations);
}

updateAllFilterBadges();
syncAllSearchInputs();
initFromHash();
    
 
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js")
        .then(reg => console.log("Service Worker registrado"))
        .catch(err => console.log("Error Service Worker", err));
    });
  }


// Sprint 5: búsqueda y configuración de TMDb
initTMDbIntegration();


// Sprint 14.2: preferencias globales de plataformas contratadas
UserPlatformsUI.init();


// Sprint 6: estadísticas y recomendaciones locales
initStatisticsDashboard();


// ===== Sprint 11 · Colecciones inteligentes =====
let smartCollectionsReturnScreen = "series-home";

document.addEventListener("click", event => {
  const openButton = event.target.closest("[data-smart-open]");
  if (openButton) {
    smartCollectionsReturnScreen =
      openButton.dataset.smartOpen === "peliculas"
        ? "peliculas-home"
        : "series-home";

    showScreen("colecciones-inteligentes");

    const requestedType = openButton.dataset.smartOpen;
    const typeButton = document.querySelector(
      `[data-smart-type="${requestedType}"]`
    );
    typeButton?.click();
    return;
  }

  const backButton = event.target.closest("[data-smart-back]");
  if (backButton) {
    showScreen(smartCollectionsReturnScreen);
  }
});
