/*
 * Field Shift : moteur de suggestions de rotations (v1, prototype)
 *
 * Ce fichier contient toute la logique de l'algorithme, séparée de l'interface.
 * Les effets de rotation documentés viennent d'études publiées (voir SOURCES.md).
 * Les prix, coûts et paramètres de score sont FICTIFS : ils servent à démontrer la logique.
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
  // (comparé à la même culture répétée chaque année)
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
    { name: "SoilGrids", what: "Texture et matière organique du sol" }
  ];

  function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

  function effect(a, b) {
    var d = DOC[a + ">" + b];
    if (d) return { v: d.v, src: d.src, doc: true };
    if (a === b) return { v: -0.05, src: "Estimation : même culture répétée", doc: false };
    if (CROPS[a].fam === CROPS[b].fam) return { v: -0.02, src: "Estimation : même famille", doc: false };
    return { v: 0.03, src: "Estimation : rotation générique", doc: false };
  }

  function cycle(seq, h) { var out = []; for (var i = 0; i < h; i++) out.push(seq[i % seq.length]); return out; }

  function nameOf(seq, cover) {
    var s = seq.map(function (id) { return CROPS[id].name; }).join(" → ");
    return cover ? s + " + trèfle" : s;
  }

  // Forme canonique : une rotation et ses décalages (A→B→C, B→C→A...) sont la même rotation
  function canon(seq) {
    var best = null;
    for (var i = 0; i < seq.length; i++) {
      var k = seq.slice(i).concat(seq.slice(0, i)).join(",");
      if (best === null || k < best) best = k;
    }
    return best;
  }

  /*
   * Évalue une rotation (cyclique) pour un scénario : "normal", "sec" ou "chaud".
   * ctx = { area (ha), cover, texture, irrig }
   */
  function evaluate(seq, ctx, scen) {
    var n = seq.length, fams = {}, nf = 0, repeats = 0, docN = 0, trans = [];
    var multSum = 0, cash = 0, need = 0, tol = 0, soil = 0, leg = 0, i, c;
    for (i = 0; i < n; i++) {
      c = CROPS[seq[i]];
      if (!fams[c.fam]) { fams[c.fam] = 1; nf++; }
      need += c.need; tol += c.tol; soil += c.soil; if (c.leg) leg++;
    }
    need /= n; tol /= n; soil /= n; leg /= n;

    for (i = 0; i < n; i++) {
      var prev = seq[(i - 1 + n) % n], cur = seq[i], e = effect(prev, cur), ev = e.v;
      // Chaleur : l'avantage de la rotation baisse pour le maïs, augmente pour le soya (Kluger et al. 2022)
      if (scen === "chaud" && ev > 0) { if (cur === "mais") ev *= 0.71; if (cur === "soya") ev *= 1.25; }
      if (prev === cur) repeats++;
      if (e.doc) docN++;
      trans.push({ prev: prev, cur: cur, v: e.v, src: e.src, doc: e.doc });
      var m = 1 + ev;
      // Sécheresse : perte réduite par la diversité (Bowles et al. 2020) et par l'irrigation
      if (scen === "sec") m *= 1 - 0.3 * (CROPS[cur].need / 5) * (1 - Math.min(0.6, 0.2 * (nf - 1))) * (ctx.irrig ? 0.5 : 1);
      if (scen === "chaud") m *= 1 - 0.15 * ((6 - CROPS[cur].tol) / 5);
      if (ctx.cover) m *= 0.995; // couverture : léger coût de rendement possible
      multSum += m;
      cash += (CROPS[cur].gross * m - CROPS[cur].cost) * ctx.area;
    }

    var tex = TEXTURES[ctx.texture];
    return {
      eau: clamp(112 - need * 15 + tex.w + (ctx.irrig ? 8 : 0) - (scen === "sec" ? 14 : 0) - (scen === "chaud" ? 6 : 0)),
      sol: clamp(54 + soil * 16 + leg * 22 + (ctx.cover ? 14 : 0) - repeats * 12 + tex.s),
      res: clamp(26 + (nf - 1) * 22 + tol * 7 - repeats * 10),
      rend: clamp((multSum / n) * 82),
      rev: cash / n,
      revHa: cash / n / ctx.area,
      trans: trans,
      docShare: docN / n,
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

  function confOf(share) {
    if (share >= 0.66) return { label: "Moyenne", why: "Chaque enchaînement est couvert par une étude, mais mesurée aux États-Unis : il faudra calibrer pour le Québec." };
    if (share >= 0.33) return { label: "Moyenne-faible", why: "Une partie des enchaînements repose sur des études, le reste sur des estimations génériques." };
    return { label: "Faible", why: "Aucune étude ne couvre directement ces enchaînements : valeurs estimées." };
  }

  /*
   * Étapes 2 à 5 : énumère toutes les rotations possibles, garde le top 3,
   * ajoute la rotation actuelle et évalue chacune dans les 3 scénarios.
   */
  function rank(opts) {
    var sel = IDS.filter(function (id) { return opts.crops[id]; });
    var best = {}, h = opts.horizon, ctx = opts.ctx;
    if (sel.length >= 2) {
      var total = Math.pow(sel.length, h);
      for (var k = 0; k < total; k++) {
        var seq = [], x = k;
        for (var j = 0; j < h; j++) { seq.push(sel[x % sel.length]); x = Math.floor(x / sel.length); }
        var cn = canon(seq);
        if (best[cn]) continue;
        best[cn] = { seq: cn.split(","), score: globalScore(evaluate(seq, ctx, "normal"), opts.prio) };
      }
    }
    var ranked = Object.keys(best).map(function (k2) { return best[k2]; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
    var items = ranked.map(function (r, i) { return { seq: r.seq, kind: "rec", rank: i }; });
    items.push({ seq: cycle(CURRENTS[opts.current].seq, h), kind: "cur", rank: 3 });
    items.forEach(function (it) {
      it.normal = evaluate(it.seq, ctx, "normal");
      it.sec = evaluate(it.seq, ctx, "sec");
      it.chaud = evaluate(it.seq, ctx, "chaud");
      it.global = globalScore(it.normal, opts.prio);
      it.name = nameOf(it.seq, ctx.cover);
    });
    return items;
  }

  global.FieldShift = {
    CROPS: CROPS, IDS: IDS, DOC: DOC, TEXTURES: TEXTURES, CURRENTS: CURRENTS, SOURCES: SOURCES,
    effect: effect, evaluate: evaluate, globalScore: globalScore, confOf: confOf,
    rank: rank, canon: canon, nameOf: nameOf, cycle: cycle
  };
})(window);
