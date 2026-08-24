const RaterNamesUI = (() => {
  const fallback = Object.freeze({ adri: "Adri", laura: "Laura" });

  function getName(id) {
    const key = String(id || "").toLowerCase();
    if (typeof RatersConfigRepository !== "undefined" && RatersConfigRepository.getRaterName) {
      return RatersConfigRepository.getRaterName(key) || fallback[key] || key;
    }
    return fallback[key] || key;
  }

  function pairText(template) {
    return String(template || "")
      .replaceAll("{adri}", getName("adri"))
      .replaceAll("{laura}", getName("laura"));
  }

  function sync(root = document) {
    root.querySelectorAll("[data-rater-name]").forEach(el => {
      el.textContent = getName(el.dataset.raterName);
    });

    root.querySelectorAll("[data-rater-label]").forEach(el => {
      const id = el.dataset.raterLabel;
      const kind = el.dataset.raterLabelKind || "";
      const name = getName(id);
      if (kind === "rating") el.textContent = `Valoración ${name}`;
      else if (kind === "notes") el.textContent = `Notas ${name}`;
      else if (kind === "unseen") el.textContent = `${name} no la ha visto`;
      else el.textContent = name;
    });

    root.querySelectorAll("[data-rater-placeholder]").forEach(el => {
      el.setAttribute("placeholder", `Notas de ${getName(el.dataset.raterPlaceholder)}...`);
    });

    root.querySelectorAll("[data-rater-aria-rating]").forEach(el => {
      el.setAttribute("aria-label", `Valoración ${getName(el.dataset.raterAriaRating)}`);
    });

    root.querySelectorAll("[data-rater-pair-template]").forEach(el => {
      el.textContent = pairText(el.dataset.raterPairTemplate);
    });
  }

  function init() {
    sync();
    window.addEventListener("ratersconfigchange", () => sync());
  }

  return Object.freeze({ getName, pairText, sync, init });
})();

window.getRaterDisplayName = id => RaterNamesUI.getName(id);
document.addEventListener("DOMContentLoaded", () => RaterNamesUI.init());
