/*
 * Field Shift : moteur de suggestions de rotations (v1.1, prototype)
 *
 * Toute la logique de l'algorithme, séparée de l'interface.
 * Les effets de rotation documentés viennent d'études publiées (voir SOURCES.md).
 * Les prix, coûts, la tendance climatique et les paramètres de score sont FICTIFS :
 * ils servent à démontrer la logique.
 *
 * Une rotation est un CYCLE de 1 à 4 ans, répété sur tout l'horizon choisi (3 à 30 ans).
 *
 * Chargé comme script classique (pas de module) pour fonctionner aussi en file://.
 */
(function (global) {
  "use strict";

  // Base de cultures (attributs simplifiés, valeurs de démonstration)
  var CROPS = {
    mais: { name: "Maïs", short: "Maïs", fam: "Graminée de saison chaude", need: 5, tol: 2, soil: -1, leg: false, gross: 1900, cost: 1100, col: "#EBC55E" },
    soya: { name: "Soya", short: "Soya", fam: "Légumineuse", need: 3, tol: 3, soil: 1, leg: true, gross: 1350, cost: 650, col: "#A5C77E" },
    bleP: { name: "Blé de printemps", short: "Blé P.", fam: "Céréale à paille", need: 3, tol: 3, soil: 0, leg: false, gross: 1000, cost: 600, col: "#DCC08F" },
    bleH: { name: "Blé d'hiver", short: "Blé H.", fam: "Céréale à paille", need: 3, tol: 4, soil: 1, leg: false, gross: 1150, cost: 650, col: "#C9A56E" },
    orge: { name: "Orge", short: "Orge", fam: "Céréale à paille", need: 2, tol: 4, soil: 0, leg: false, gross: 850, cost: 500, col: "#E6D8A8" }
  };
  var IDS = ["mais", "soya", "bleP", "bleH", "orge"];

  // Effets documentés du précédent cultural sur le rendement
  // (comparé à la même culture répétée chaque année). La source n'est jamais
  // affichée dans les suggestions : elle sert au registre des sources.
  var DOC = {
    "mais>soya": { v: 0.08, src: "Kluger et al. 2025 (Landsat)" },
    "soya>bleP": { v: 0.08, src: "Kluger et al. 2025 (Landsat)" },
    "soya>mais": { v: 0.025, src: "Kluger et al. 2025 (Landsat)" },
    "bleH>mais": { v: 0.009, src: "Kluger et al. 2025 (Landsat)" },
    "soya>bleH": { v: -0.12, src: "Kluger et al. 2025 · semis tardif du blé" },
    "mais>mais": { v: -0.043, src: "Seifert et al. 2017" }
  };

  var TEXTURES = {
    loam: { name: "Loam (limoneux)", w: 0, s: 3 },
    argile: { name: "Argileux", w: 5, s: 0 },
    sable: { name: "Sableux", w: -10, s: -4 }
  };

  var CURRENTS = {
    mc: { label: "Maïs en continu", seq: ["mais"] },
    ms: { label: "Maïs → Soya", seq: ["mais", "soya"] },
    msb: { label: "Maïs → Soya → Blé d'hiver", seq: ["mais", "soya", "bleH"] }
  };

  var SOURCES = [
    { name: "NASA POWER", what: "Température, pluie, ensoleillement" },
    { name: "GPM IMERG", what: "Précipitations quotidiennes" },
    { name: "SMAP", what: "Humidité du sol" },
    { name: "ECOSTRESS", what: "Consommation d'eau des plantes" },
    { name: "HLS (Landsat + Sentinel-2)", what: "Vigueur de la végétation (NDVI)" },
    { name: "NEX-GDDP-CMIP6", what: "Projections climatiques (horizons longs)" },
    { name: "SoilGrids", what: "Texture et matière organique du sol" }
  ];

  var HORIZONS = [3, 4, 5, 10, 15, 30];
  var MAX_CYCLE = 4;
  // Tendance de réchauffement ILLUSTRATIVE : stress thermique supplémentaire par année.
  // Dans la vraie appli, elle viendra des projections NEX-GDDP-CMIP6 pour le champ.
  var TREND = 0.006;

  function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

  function effect(a, b) {
    var d = DOC[a + ">" + b];
    if (d) return { v: d.v, src: d.src, doc: true };
    if (a === b) return { v: -0.05, src: "Estimation : même culture répétée", doc: false };
    if (CROPS[a].fam === CROPS[b].fam) return { v: -0.02, src: "Estimation : même famille", doc: false };
    return { v: 0.03, src: "Estimation : rotation générique", doc: false };
  }

  function nameOf(seq, cover) {
    var s = seq.map(function (id) { return CROPS[id].name; }).join(" → ");
    return cover ? s + " + trèfle" : s;
  }

  // Forme canonique : A→B→C, B→C→A et C→A→B sont le même cycle
  function canon(seq) {
    var best = null;
    for (var i = 0; i < seq.length; i++) {
      var k = seq.slice(i).concat(seq.slice(0, i)).join(",");
      if (best === null || k < best) best = k;
    }
    return best;
  }

  // Un cycle « maïs, soya, maïs, soya » est en fait le cycle de 2 ans « maïs, soya »
  function isPrimitive(seq) {
    var L = seq.length;
    for (var p = 1; p < L; p++) {
      if (L % p) continue;
      var rep = true;
      for (var i = p; i < L; i++) if (seq[i] !== seq[i - p]) { rep = false; break; }
      if (rep) return false;
    }
    return true;
  }

  /*
   * Évalue un cycle répété sur H années, pour un scénario : "normal", "sec" ou "chaud".
   * ctx = { area (ha), cover, texture, irrig }
   */
  function evaluate(seq, ctx, scen, H) {
    var L = seq.length;
    H = H || L;
    var fams = {}, nf = 0, repeats = 0, docN = 0, trans = [], effs = [];
    var need = 0, tol = 0, soil = 0, leg = 0, i, c;
    for (i = 0; i < L; i++) {
      c = CROPS[seq[i]];
      if (!fams[c.fam]) { fams[c.fam] = 1; nf++; }
      need += c.need; tol += c.tol; soil += c.soil; if (c.leg) leg++;
    }
    need /= L; tol /= L; soil /= L; leg /= L;

    // Enchaînements du cycle (régime permanent : la 1re culture suit la dernière)
    for (i = 0; i < L; i++) {
      var prev = seq[(i - 1 + L) % L], cur = seq[i], e = effect(prev, cur);
      if (prev === cur) repeats++;
      if (e.doc) docN++;
      trans.push({ prev: prev, cur: cur, v: e.v, src: e.src, doc: e.doc });
      effs.push(e.v);
    }

    var div = Math.min(0.6, 0.2 * (nf - 1)); // effet protecteur de la diversité
    var years = [], multSum = 0, cashSum = 0, driftSum = 0;
    for (var y = 0; y < H; y++) {
      var k = y % L, id = seq[k], C = CROPS[id], ev = effs[k];
      // Chaleur : l'avantage de la rotation baisse pour le maïs, augmente pour le soya
      if (scen === "chaud" && ev > 0) { if (id === "mais") ev *= 0.71; if (id === "soya") ev *= 1.25; }
      var m = 1 + ev;
      // Sécheresse : perte réduite par la diversité et par l'irrigation
      if (scen === "sec") m *= 1 - 0.3 * (C.need / 5) * (1 - div) * (ctx.irrig ? 0.5 : 1);
      if (scen === "chaud") m *= 1 - 0.15 * ((6 - C.tol) / 5);
      // Tendance de réchauffement sur l'horizon (pèse surtout sur les cultures peu tolérantes)
      var drift = TREND * (y + 1);
      m *= 1 - drift * ((6 - C.tol) / 5) * (1 - div * 0.5);
      if (ctx.cover) m *= 0.995; // couverture : léger coût de rendement possible
      var cash = (C.gross * m - C.cost) * ctx.area;
      years.push(cash);
      multSum += m; cashSum += cash; driftSum += drift;
    }
    var avgDrift = driftSum / H;

    var tex = TEXTURES[ctx.texture];
    return {
      eau: clamp(112 - need * 15 + tex.w + (ctx.irrig ? 8 : 0) - (scen === "sec" ? 14 : 0) - (scen === "chaud" ? 6 : 0) - avgDrift * need * 12),
      sol: clamp(54 + soil * 16 + leg * 22 + (ctx.cover ? 14 : 0) - repeats * 12 + tex.s),
      res: clamp(26 + (nf - 1) * 22 + tol * 7 - repeats * 10),
      rend: clamp((multSum / H) * 82),
      rev: cashSum / H,
      revHa: cashSum / H / ctx.area,
      total: cashSum,
      years: years,
      trans: trans,
      docShare: docN / L,
      nf: nf
    };
  }

  // Étape 4 : pondération selon les priorités du fermier (curseurs 0 à 5)
  function globalScore(ev, prio) {
    var tot = prio.eau + prio.sol + prio.risque + prio.revenu;
    var econ = clamp(ev.revHa / 800 * 100) * 0.7 + ev.rend * 0.3;
    if (tot === 0) return Math.round((ev.eau + ev.sol + ev.res + econ) / 4);
    return Math.round((prio.eau * ev.eau + prio.sol * ev.sol + prio.risque * ev.res + prio.revenu * econ) / tot);
  }

  // Niveau de confiance : part des enchaînements documentés, moins un niveau au-delà de 15 ans
  function confOf(share, H) {
    var lvl = share >= 0.66 ? 2 : share >= 0.33 ? 1 : 0;
    var why = lvl === 2 ? "Chaque enchaînement est couvert par une étude publiée, mais mesurée aux États-Unis : il faudra calibrer pour le Québec."
      : lvl === 1 ? "Une partie des enchaînements repose sur des études publiées, le reste sur des estimations."
      : "Aucune étude ne couvre directement ces enchaînements : valeurs estimées.";
    if (H >= 15) {
      lvl = Math.max(0, lvl - 1);
      why += " Sur " + H + " ans, les projections climatiques ajoutent de l'incertitude.";
    }
    return { label: ["Faible", "Moyenne-faible", "Moyenne"][lvl], why: why };
  }

  /*
   * Étapes 2 à 5 : énumère tous les cycles de 1 à 4 ans, retire les doublons,
   * garde le top 3, ajoute la rotation actuelle et évalue chacun dans les 3 scénarios.
   * Avec 5 cultures : 5 + 25 + 125 + 625 = 780 séquences testées, instantané.
   */
  function rank(opts) {
    var sel = IDS.filter(function (id) { return opts.crops[id]; });
    var best = {}, H = opts.horizon, ctx = opts.ctx, maxL = Math.min(MAX_CYCLE, H);
    if (sel.length >= 2) {
      for (var L = 1; L <= maxL; L++) {
        var total = Math.pow(sel.length, L);
        for (var k = 0; k < total; k++) {
          var seq = [], x = k;
          for (var j = 0; j < L; j++) { seq.push(sel[x % sel.length]); x = Math.floor(x / sel.length); }
          if (!isPrimitive(seq)) continue;
          var cn = canon(seq);
          if (best[cn]) continue;
          best[cn] = { seq: cn.split(","), score: globalScore(evaluate(seq, ctx, "normal", H), opts.prio) };
        }
      }
    }
    var ranked = Object.keys(best).map(function (k2) { return best[k2]; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
    var items = ranked.map(function (r, i) { return { seq: r.seq, kind: "rec", rank: i }; });
    items.push({ seq: CURRENTS[opts.current].seq.slice(), kind: "cur", rank: 3 });
    items.forEach(function (it) {
      it.normal = evaluate(it.seq, ctx, "normal", H);
      it.sec = evaluate(it.seq, ctx, "sec", H);
      it.chaud = evaluate(it.seq, ctx, "chaud", H);
      it.global = globalScore(it.normal, opts.prio);
      it.name = nameOf(it.seq, ctx.cover);
    });
    return items;
  }

  global.FieldShift = {
    CROPS: CROPS, IDS: IDS, DOC: DOC, TEXTURES: TEXTURES, CURRENTS: CURRENTS, SOURCES: SOURCES,
    HORIZONS: HORIZONS, MAX_CYCLE: MAX_CYCLE, TREND: TREND,
    effect: effect, evaluate: evaluate, globalScore: globalScore, confOf: confOf,
    rank: rank, canon: canon, nameOf: nameOf, isPrimitive: isPrimitive
  };
})(window);
