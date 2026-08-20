(() => {
  "use strict";

  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(",");

  const previousFocus = new WeakMap();

  function visibleFocusable(overlay) {
    return Array.from(overlay.querySelectorAll(selector)).filter(el => {
      if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function focusModal(overlay) {
    const active = document.activeElement;
    if (active && active !== document.body && !overlay.contains(active)) {
      previousFocus.set(overlay, active);
    }

    const card = overlay.querySelector('[role="dialog"]');
    const focusables = visibleFocusable(overlay);
    const target = focusables[0] || card;

    if (card && !card.hasAttribute("tabindex")) card.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  }

  function restoreFocus(overlay) {
    const target = previousFocus.get(overlay);
    previousFocus.delete(overlay);
    if (target && target.isConnected && typeof target.focus === "function") {
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  }

  function topOpenModal() {
    const open = Array.from(document.querySelectorAll(".modalOverlay.open"));
    return open[open.length - 1] || null;
  }

  function requestClose(overlay) {
    const close =
      overlay.querySelector(".modalClose:not([disabled])") ||
      overlay.querySelector('[id$="Cancel"]:not([disabled])');
    close?.click();
  }

  function onKeydown(event) {
    const overlay = topOpenModal();
    if (!overlay) return;

    if (event.key === "Escape") {
      const close = overlay.querySelector(".modalClose:not([disabled])");
      if (!close) return;
      event.preventDefault();
      event.stopPropagation();
      requestClose(overlay);
      return;
    }

    if (event.key !== "Tab") return;

    const focusables = visibleFocusable(overlay);
    if (!focusables.length) {
      event.preventDefault();
      overlay.querySelector('[role="dialog"]')?.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !overlay.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function init() {
    const overlays = document.querySelectorAll(".modalOverlay");

    overlays.forEach(overlay => {
      let wasOpen = overlay.classList.contains("open");

      const observer = new MutationObserver(() => {
        const isOpen = overlay.classList.contains("open");
        if (isOpen === wasOpen) return;
        wasOpen = isOpen;

        if (isOpen) focusModal(overlay);
        else restoreFocus(overlay);
      });

      observer.observe(overlay, { attributes: true, attributeFilter: ["class"] });
    });

    document.addEventListener("keydown", onKeydown, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
