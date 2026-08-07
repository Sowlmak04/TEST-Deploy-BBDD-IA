// ---------- Normalización centralizada de géneros ----------
const GenreNormalizer = (() => {
  const TRANSLATIONS = Object.freeze({
    "action": "Acción",
    "accion": "Acción",
    "adventure": "Aventura",
    "aventura": "Aventura",
    "animation": "Animación",
    "animacion": "Animación",
    "comedy": "Comedia",
    "comedia": "Comedia",
    "crime": "Crimen",
    "crimen": "Crimen",
    "documentary": "Documental",
    "documental": "Documental",
    "drama": "Drama",
    "family": "Familia",
    "familia": "Familia",
    "fantasy": "Fantasía",
    "fantasia": "Fantasía",
    "history": "Historia",
    "historia": "Historia",
    "horror": "Terror",
    "terror": "Terror",
    "music": "Música",
    "musica": "Música",
    "mystery": "Misterio",
    "misterio": "Misterio",
    "romance": "Romance",
    "science fiction": "Ciencia ficción",
    "ciencia ficcion": "Ciencia ficción",
    "tv movie": "Película de TV",
    "pelicula de tv": "Película de TV",
    "pelicula para tv": "Película de TV",
    "thriller": "Suspense",
    "suspense": "Suspense",
    "war": "Bélica",
    "belica": "Bélica",
    "western": "Western",
    "action & adventure": "Acción y aventura",
    "action and adventure": "Acción y aventura",
    "accion y aventura": "Acción y aventura",
    "kids": "Infantil",
    "infantil": "Infantil",
    "news": "Noticias",
    "noticias": "Noticias",
    "reality": "Reality",
    "sci-fi & fantasy": "Ciencia ficción y fantasía",
    "sci fi & fantasy": "Ciencia ficción y fantasía",
    "science fiction & fantasy": "Ciencia ficción y fantasía",
    "ciencia ficcion y fantasia": "Ciencia ficción y fantasía",
    "soap": "Telenovela",
    "telenovela": "Telenovela",
    "talk": "Talk show",
    "talk show": "Talk show",
    "war & politics": "Guerra y política",
    "war and politics": "Guerra y política",
    "guerra y politica": "Guerra y política"
  });

  function key(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("es-ES")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  function toValues(input) {
    if (Array.isArray(input)) {
      return input.flatMap(value => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return toValues(value.name);
        }
        return toValues(value);
      });
    }

    return String(input || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);
  }

  function normalizeList(input) {
    const result = [];
    const seen = new Set();

    toValues(input).forEach(rawValue => {
      const raw = String(rawValue || "").trim();
      if (!raw) return;

      const translated = TRANSLATIONS[key(raw)] || raw;
      const identity = key(translated);

      if (!identity || seen.has(identity)) return;
      seen.add(identity);
      result.push(translated);
    });

    return result;
  }

  function normalize(input) {
    return normalizeList(input).join(", ");
  }

  return Object.freeze({
    key,
    normalize,
    normalizeList
  });
})();
