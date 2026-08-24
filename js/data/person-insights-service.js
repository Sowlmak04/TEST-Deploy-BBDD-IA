// ---------- Conocimiento derivado activo sobre personas de la biblioteca ----------
const PersonInsightsService = (() => {
  const COLLECTION_DEFINITIONS = [
    { key: () => KEY.seriesPendientes, kind: "series", status: "pendientes" },
    { key: () => KEY.peliculasPendientes, kind: "peliculas", status: "pendientes" },
    { key: () => KEY.seriesVistas, kind: "series", status: "vistas" },
    { key: () => KEY.peliculasVistas, kind: "peliculas", status: "vistas" }
  ];

  function normalizeText(value) {
    return value == null ? "" : String(value).trim();
  }

  function normalizeNameKey(value) {
    return normalizeText(value)
      .normalize("NFKC")
      .toLocaleLowerCase("es-ES")
      .replace(/\s+/g, " ");
  }

  function normalizeTmdbId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  function identityOf(person) {
    const source = person && typeof person === "object" ? person : {};
    const name = normalizeText(source.name);
    if (!name) return null;

    const tmdbId = normalizeTmdbId(source.id ?? source.tmdbId);
    if (tmdbId) {
      return Object.freeze({
        key: `tmdb:${tmdbId}`,
        tmdbId,
        name,
        provisional: false
      });
    }

    const normalizedName = normalizeNameKey(name);
    if (!normalizedName) return null;

    return Object.freeze({
      key: `name:${normalizedName}`,
      tmdbId: null,
      name,
      provisional: true
    });
  }


  function titleRating(item) {
    if (typeof LibraryModel !== "undefined" && LibraryModel.getAverageRating) {
      return LibraryModel.getAverageRating(item);
    }
    const values = [item?.ratingAdri, item?.ratingLaura]
      .filter(value => value !== "" && value != null).map(Number).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }


  function reducedItem(item, context, appearances) {
    const rating = titleRating(item);

    return Object.freeze({
      id: normalizeText(item?.id),
      title: normalizeText(item?.title) || "Sin título",
      kind: context.kind,
      status: context.status,
      year: normalizeText(item?.year),
      releaseDate: normalizeText(item?.releaseDate),
      rating,
      appearances: Object.freeze(appearances.map(appearance => Object.freeze({ ...appearance })))
    });
  }

  function collectionEntries(collections) {
    const source = collections && typeof collections === "object" ? collections : {};
    const entries = [];

    COLLECTION_DEFINITIONS.forEach(definition => {
      let key = null;
      try {
        key = definition.key();
      } catch {
        key = null;
      }

      const candidates = [
        key ? source[key] : null,
        source[`${definition.kind}:${definition.status}`],
        source[definition.kind]?.[definition.status]
      ];
      const items = candidates.find(Array.isArray) || [];

      items.forEach((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return;
        entries.push({
          item,
          context: {
            key,
            kind: definition.kind,
            status: definition.status,
            index
          }
        });
      });
    });

    return entries;
  }

  function appearancesFor(item) {
    const appearances = [];

    if (Array.isArray(item?.cast)) {
      item.cast.forEach(person => {
        const identity = identityOf(person);
        if (!identity) return;
        appearances.push({
          identity,
          type: "cast",
          job: "Actor",
          department: "Acting",
          character: normalizeText(person?.character),
          billingOrder: Number.isFinite(Number(person?.billingOrder))
            ? Number(person.billingOrder)
            : null
        });
      });
    }

    if (Array.isArray(item?.crew)) {
      item.crew.forEach(person => {
        const identity = identityOf(person);
        if (!identity) return;
        appearances.push({
          identity,
          type: "crew",
          job: normalizeText(person?.job) || "Equipo técnico",
          department: normalizeText(person?.department),
          character: "",
          billingOrder: null
        });
      });
    }

    if (Array.isArray(item?.creators)) {
      item.creators.forEach(person => {
        const identity = identityOf(person);
        if (!identity) return;
        appearances.push({
          identity,
          type: "creator",
          job: "Creador",
          department: "Creator",
          character: "",
          billingOrder: null
        });
      });
    }

    return appearances;
  }


  function finalizePerson(bucket) {
    const titles = [...bucket.titles.values()]
      .sort((a, b) => a.title.localeCompare(b.title, "es", { sensitivity: "base" }));

    const totals = {
      titles: titles.length,
      movies: titles.filter(item => item.kind === "peliculas").length,
      series: titles.filter(item => item.kind === "series").length,
      pending: titles.filter(item => item.status === "pendientes").length,
      watched: titles.filter(item => item.status === "vistas").length,
      rated: titles.filter(item => Number.isFinite(item.rating)).length
    };

    const ratings = titles
      .map(item => item.rating)
      .filter(Number.isFinite);


    const roles = [...bucket.roles.values()]
      .map(role => Object.freeze({
        type: role.type,
        job: role.job,
        department: role.department,
        count: role.titleIds.size,
        titles: Object.freeze([...role.titleIds]
          .map(id => bucket.titles.get(id))
          .filter(Boolean)
          .map(item => Object.freeze({ id: item.id, title: item.title, kind: item.kind, status: item.status }))
          .sort((a, b) => a.title.localeCompare(b.title, "es", { sensitivity: "base" })))
      }))
      .sort((a, b) => b.count - a.count || a.job.localeCompare(b.job, "es", { sensitivity: "base" }));

    return Object.freeze({
      identity: Object.freeze({ ...bucket.identity }),
      totals: Object.freeze(totals),
      ratings: Object.freeze({
        average: ratings.length
          ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
          : null,
        ratedTitles: ratings.length
      }),
      roles: Object.freeze(roles),
      titles: Object.freeze(titles)
    });
  }

  function build(collections) {
    const people = new Map();

    collectionEntries(collections).forEach(({ item, context }) => {
      const appearances = appearancesFor(item);
      if (!appearances.length) return;

      const groupedByPerson = new Map();
      appearances.forEach(appearance => {
        const list = groupedByPerson.get(appearance.identity.key) || [];
        list.push(appearance);
        groupedByPerson.set(appearance.identity.key, list);
      });

      groupedByPerson.forEach((personAppearances, key) => {
        const identity = personAppearances[0].identity;
        let bucket = people.get(key);
        if (!bucket) {
          bucket = {
            identity: { ...identity },
            titles: new Map(),
            roles: new Map()
          };
          people.set(key, bucket);
        }

        const uniqueAppearances = [];
        const appearanceKeys = new Set();
        personAppearances.forEach(appearance => {
          const appearanceKey = [
            appearance.type,
            appearance.job,
            appearance.department,
            appearance.character,
            appearance.billingOrder
          ].join("|");
          if (appearanceKeys.has(appearanceKey)) return;
          appearanceKeys.add(appearanceKey);
          uniqueAppearances.push({
            type: appearance.type,
            job: appearance.job,
            department: appearance.department,
            character: appearance.character,
            billingOrder: appearance.billingOrder
          });
        });

        const itemKey = `${context.key || `${context.kind}:${context.status}`}::${normalizeText(item.id) || `index:${context.index}`}`;
        const title = reducedItem(item, context, uniqueAppearances);
        bucket.titles.set(itemKey, title);

        uniqueAppearances.forEach(appearance => {
          const roleKey = `${appearance.type}|${appearance.job}|${appearance.department}`;
          let role = bucket.roles.get(roleKey);
          if (!role) {
            role = {
              type: appearance.type,
              job: appearance.job,
              department: appearance.department,
              titleIds: new Set()
            };
            bucket.roles.set(roleKey, role);
          }
          role.titleIds.add(itemKey);
        });
      });
    });

    return Object.freeze([...people.values()]
      .map(finalizePerson)
      .sort((a, b) => a.identity.name.localeCompare(b.identity.name, "es", { sensitivity: "base" })));
  }

  function currentCollections() {
    const data = {};
    COLLECTION_DEFINITIONS.forEach(definition => {
      let key;
      try {
        key = definition.key();
      } catch {
        return;
      }
      data[key] = typeof LibraryRepository !== "undefined"
        ? LibraryRepository.getAll(key)
        : [];
    });
    return data;
  }

  function getAll() {
    return build(currentCollections());
  }

  function requestedKey(identity) {
    if (typeof identity === "string") {
      const value = normalizeText(identity);
      if (/^(tmdb|name):/.test(value)) return value;
      return null;
    }

    return identityOf(identity)?.key || null;
  }

  function getByIdentity(identity) {
    const key = requestedKey(identity);
    if (!key) return null;
    return getAll().find(person => person.identity.key === key) || null;
  }

  return Object.freeze({
    identityOf,
    build,
    getAll,
    getByIdentity
  });
})();
