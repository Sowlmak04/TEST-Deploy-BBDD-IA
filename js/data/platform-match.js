(function () {
  "use strict";

  const ALIASES = new Map([
    ["amazon", "prime-video"],
    ["amazon-prime", "prime-video"],
    ["amazon-prime-video", "prime-video"],
    ["prime", "prime-video"],
    ["prime-video", "prime-video"],
    ["disney", "disney-plus"],
    ["disney-plus", "disney-plus"],
    ["hbo", "max"],
    ["hbo-max", "max"],
    ["max", "max"],
    ["movistar", "movistar-plus"],
    ["movistar-plus", "movistar-plus"],
    ["movistar-plus-plus", "movistar-plus"],
    ["netflix", "netflix"],
    ["netflix-standard-with-ads", "netflix"],
    ["apple-tv", "apple-tv-plus"],
    ["apple-tv-plus", "apple-tv-plus"],
    ["appletv", "apple-tv-plus"],
    ["appletv-plus", "apple-tv-plus"],
    ["skyshowtime", "skyshowtime"],
    ["filmin", "filmin"],
    ["crunchyroll", "crunchyroll"],
    ["atresplayer", "atresplayer"],
    ["mitele", "mitele"],
    ["rakuten-tv", "rakuten-tv"],
    ["flixole", "flixole"]
  ]);

  function normalize(value) {
    const normalized = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " y ")
      .replace(/\+/g, " plus ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");

    return ALIASES.get(normalized) || normalized;
  }

  function providerId(provider) {
    const id = Number(provider?.providerId ?? provider?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  function providerName(provider) {
    return String(
      typeof provider === "string"
        ? provider
        : provider?.name || provider?.providerName || ""
    ).trim();
  }

  function selectedProviders() {
    if (typeof UserPlatformsRepository === "undefined") return [];

    try {
      const selection = UserPlatformsRepository.loadSelection();
      return Array.isArray(selection?.providers) ? selection.providers : [];
    } catch {
      return [];
    }
  }

  function matchingProviders(item) {
    const available = Array.isArray(item?.watchProviders)
      ? item.watchProviders
      : [];
    const selected = selectedProviders();

    if (!selected.length || !available.length) return [];

    const availableIds = new Set(
      available.map(providerId).filter(Boolean)
    );
    const availableNames = new Set(
      available.map(provider => normalize(providerName(provider))).filter(Boolean)
    );

    return selected.filter(provider => {
      const id = providerId(provider);
      if (id && availableIds.has(id)) return true;

      const name = normalize(providerName(provider));
      return Boolean(name && availableNames.has(name));
    });
  }

  function matches(item) {
    return matchingProviders(item).length > 0;
  }

  window.PlatformAvailabilityMatch = Object.freeze({
    normalize,
    matches,
    matchingProviders
  });
})();
