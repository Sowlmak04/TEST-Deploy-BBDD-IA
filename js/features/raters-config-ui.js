const RatersConfigUI = (() => {
  function elements() {
    return {
      adri: document.getElementById("rater-name-adri"),
      laura: document.getElementById("rater-name-laura"),
      save: document.getElementById("btnRatersSave"),
      reset: document.getElementById("btnRatersReset"),
      status: document.getElementById("ratersConfigStatus")
    };
  }
  function setStatus(text, type = "") {
    const el = elements().status; if (!el) return;
    el.textContent = text || ""; el.className = `msg ratersConfigStatus${type ? ` ${type}` : ""}`;
  }
  function open() {
    const cfg = RatersConfigRepository.load(); const els = elements();
    const byId = Object.fromEntries(cfg.raters.map(r => [r.id, r.name]));
    if (els.adri) els.adri.value = byId.adri || "Adri";
    if (els.laura) els.laura.value = byId.laura || "Laura";
    setStatus("");
  }
  function save() {
    const els = elements();
    try {
      RatersConfigRepository.save({ raters: [
        { id: "adri", name: els.adri?.value }, { id: "laura", name: els.laura?.value }
      ]});
      open(); setStatus("Valoradores guardados ✓", "ok");
    } catch (error) { setStatus(error?.message || "No se pudo guardar.", "error"); }
  }
  function reset() {
    if (!window.confirm("¿Restaurar los nombres Adri y Laura? Las valoraciones guardadas no se modificarán.")) return;
    RatersConfigRepository.reset(); open(); setStatus("Nombres predeterminados restaurados ✓", "ok");
  }
  function init() {
    const els = elements();
    els.save?.addEventListener("click", save); els.reset?.addEventListener("click", reset);
  }
  return Object.freeze({ init, open });
})();
document.addEventListener("DOMContentLoaded", () => RatersConfigUI.init());
