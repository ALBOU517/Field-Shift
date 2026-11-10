/*
 * Field Shift : interface de l'application web (9 étapes)
 * Toute la logique de calcul vient de js/engine.js (window.FieldShift).
 * Règle d'équipe : aucun nom d'étude dans les suggestions ; les études sont
 * regroupées dans « Détail et sources » et dans SOURCES.md.
 */
(function () {
  "use strict";
  var FS = window.FieldShift;
  var CROPS = FS.CROPS, IDS = FS.IDS, TEXTURES = FS.TEXTURES, CURRENTS = FS.CURRENTS, SOURCES = FS.SOURCES;

  var TITLES = ["Profil", "Localisation", "Délimiter le champ", "Mon champ", "Cultures et priorités", "Résultats", "Explorer et modifier", "Stress test", "Détail et sources"];
  var EXAMPLE_REL = [[0.30, 0.24], [0.60, 0.20], [0.66, 0.62], [0.34, 0.68]];
  var WORLD_W = 1200, WORLD_H = 1000, M_PER_PX = 3; // carte d'illustration : 1 px = 3 m
  var PRIOS = [["eau", "Économiser l'eau"], ["sol", "Améliorer le sol"], ["risque", "Réduire le risque"], ["revenu", "Maximiser le revenu"]];
  var BADGES = ["Recommandée", "Option B", "Option C", "Votre rotation actuelle"];
  var SERIES = [{ col: "#2E6B3B", dash: "" }, { col: "#3E7CA8", dash: "" }, { col: "#C77D2E", dash: "" }, { col: "#8A9488", dash: "6 5" }];

  var S = {
    screen: 1, maxReached: 1, farm: "", prod: "gc", loc: "", locQuery: "",
    offX: -150, offY: -250, frozen: false, pts: [],
    loadStep: 0, texture: "loam", irrig: false, sensors: false,
    crops: { mais: true, soya: true, bleP: false, bleH: true, orge: false },
    cover: false, current: "ms",
    prio: { eau: 3, sol: 3, risque: 3, revenu: 4 },
    horizon: 10, sel: 0, edit: null, scen: "sec"
  };

  var $ = function (id) { return document.getElementById(id); };
  var scr = $("scr"), foot = $("foot"), stepsEl = $("steps");
  var timer = null, cacheKey = null, cacheRes = null, drag = null;

  // ---------- Utilitaires ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function lim(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function money(n) { return (Math.round(n / 100) * 100).toLocaleString("fr-CA") + " $"; }
  function kmoney(n) { return Math.round(n / 1000).toLocaleString("fr-CA") + " k$"; }
  function pct(v) {
    var s = Math.abs(v * 100).toFixed(1).replace(".0", "").replace(".", ",");
    return (v > 0 ? "+" : v < 0 ? "−" : "") + s + " %";
  }
  function dec1(n) { return n.toFixed(1).replace(".", ","); }
  function years(n) { return n + (n > 1 ? " ans" : " an"); }
  function polyArea(p) {
    if (p.length < 3) return 0;
    var s = 0;
    for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s) / 2;
  }
  function areaHa() { return polyArea(S.pts) * M_PER_PX * M_PER_PX / 10000; }
  function ctx() {
    var a = areaHa();
    return { area: a > 0.5 ? a : 24, cover: S.cover, texture: S.texture, irrig: S.irrig };
  }
  function results() {
    var c = ctx();
    var key = JSON.stringify([S.crops, S.horizon, S.cover, S.texture, S.irrig, Math.round(c.area * 10), S.prio, S.current]);
    if (key !== cacheKey) { cacheKey = key; cacheRes = FS.rank({ crops: S.crops, horizon: S.horizon, prio: S.prio, current: S.current, ctx: c }); }
    return cacheRes;
  }
  function selected() { var r = results(); return r[Math.min(S.sel, r.length - 1)]; }
  function fewCrops() { return IDS.filter(function (id) { return S.crops[id]; }).length < 2; }
  function seriesOf(it) { return it.kind === "cur" ? SERIES[3] : SERIES[it.rank]; }

  var ICON = {
    leaf: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/></svg>',
    pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
    pen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    sensor: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20v-6"/><path d="M8.5 10.5a5 5 0 0 1 7 0"/><path d="M5.6 7.6a9 9 0 0 1 12.8 0"/><circle cx="12" cy="14" r="1"/></svg>'
  };

  // Carte d'illustration : parcelles générées une seule fois (pseudo-aléatoire stable)
  var PARCELS = (function () {
    var pal = [["#7C9A4E", "#6E8B43"], ["#A4A15A", "#958F4D"], ["#5E7F3B", "#527033"], ["#B39A62", "#A08955"], ["#8DAA5A", "#7E9A4E"], ["#6D8F45", "#61803C"], ["#9E8B5A", "#8C7B4F"]];
    var seed = 7, html = "";
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var r = 0; r < WORLD_H / 100; r++) for (var c = 0; c < WORLD_W / 100; c++) {
      var col = pal[Math.floor(rnd() * pal.length)], ang = rnd() > 0.5 ? 0 : 90, forest = rnd() > 0.86;
      var bg = forest ? "#33502A" : "repeating-linear-gradient(" + ang + "deg," + col[0] + " 0 5px," + col[1] + " 5px 10px)";
      html += '<div class="parcel" style="left:' + (c * 100 + 2) + "px;top:" + (r * 100 + 2) + "px;background:" + bg + '"></div>';
    }
    return html;
  })();

  // ---------- Navigation ----------
  function go(n) {
    S.screen = n;
    S.maxReached = Math.max(S.maxReached, n);
    if (n === 4 && S.loadStep < SOURCES.length) {
      S.loadStep = 0;
      clearInterval(timer);
      timer = setInterval(function () {
        S.loadStep++;
        if (S.loadStep >= SOURCES.length) { clearInterval(timer); timer = null; }
        if (S.screen === 4) render();
      }, 380);
    }
    render();
    window.scrollTo(0, 0);
  }
  function set(patch) { for (var k in patch) S[k] = patch[k]; render(); }

  // ---------- Étape 1 : profil ----------
  function scrProfil() {
    var prods = [["gc", "Grandes cultures"], ["mixte", "Mixte"], ["mar", "Maraîchage"]].map(function (p) {
      var on = S.prod === p[0];
      return '<button type="button" class="chip' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-a="prod" data-v="' + p[0] + '">' + p[1] + "</button>";
    }).join("");
    return {
      body:
        '<div class="narrow">' +
        '<div class="welcome-icon">' + ICON.leaf + "</div>" +
        '<h1 class="h">Bienvenue sur Field Shift</h1>' +
        '<p class="p">Deux questions, puis on s\'occupe du reste avec les données satellites de la NASA.</p>' +
        '<label class="lbl" for="farm">Nom de la ferme</label>' +
        '<input id="farm" class="inp" data-i="farm" value="' + esc(S.farm) + '" placeholder="Ex. Ferme des Érables" autocomplete="off">' +
        '<p class="lbl mt">Type de production</p><div class="chips">' + prods + "</div>" +
        '<div class="card soft" style="margin-top:24px"><p class="cb" style="color:var(--accent-dark)">On ne vous demande ni votre niveau d\'eau ni l\'état de votre sol : l\'appli les estime à partir des satellites, et vous corrigez si vous savez mieux.</p></div>' +
        "</div>",
      foot: '<button type="button" class="primary" data-a="go" data-v="2">Continuer</button>'
    };
  }

  // ---------- Étape 2 : localisation ----------
  function scrLieu() {
    return {
      body:
        '<div class="narrow">' +
        '<h1 class="h">Où est votre ferme ?</h1>' +
        '<p class="p">On centre la carte sur votre terre à l\'étape suivante.</p>' +
        '<button type="button" class="ghost" data-a="gps">' + ICON.pin + "Utiliser ma position</button>" +
        '<div class="row divider"><span>ou</span></div>' +
        '<label class="lbl" for="q">Adresse, ville ou rang</label>' +
        '<div style="display:flex;gap:8px"><input id="q" class="inp" data-i="locQuery" value="' + esc(S.locQuery) + '" placeholder="Ex. Saint-Hyacinthe" autocomplete="off">' +
        '<button type="button" class="chip on" style="border-radius:12px;flex:none" data-a="search">Chercher</button></div>' +
        (S.loc ?
          '<div class="card" style="margin-top:20px;display:flex;gap:12px;align-items:center"><div class="welcome-icon" style="width:40px;height:40px;border-radius:12px;margin:0;flex:none">' + ICON.check + '</div><div><div style="font-weight:600">Position trouvée</div><div class="small" style="margin-top:2px">' + esc(S.loc) + "</div></div></div>" : "") +
        "</div>",
      foot: '<button type="button" class="primary" data-a="go" data-v="3"' + (S.loc ? "" : " disabled") + ">Continuer</button>"
    };
  }

  // ---------- Étape 3 : délimitation ----------
  function scrCarte() {
    var n = S.pts.length, a = areaHa();
    var pts = S.pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
    var dots = S.pts.map(function (p) { return '<div class="vertex" style="left:' + p[0] + "px;top:" + p[1] + 'px"></div>'; }).join("");
    var badge = S.frozen ? "Mode tracé · " + n + " point" + (n > 1 ? "s" : "") : "Carte satellite (illustration)";
    var controls = S.frozen ?
      '<div class="btns" style="margin-top:14px;max-width:560px"><button type="button" class="mapbtn" data-a="undo">Annuler le point</button><button type="button" class="mapbtn" data-a="clear">Recommencer</button><button type="button" class="mapbtn" data-a="unfreeze">Déplacer la carte</button></div>' :
      '<div style="margin-top:14px;max-width:280px"><button type="button" class="ghost dark" data-a="freeze">' + ICON.pen + "Délimiter</button></div>";
    return {
      body:
        '<h1 class="h">Délimitez votre champ</h1>' +
        '<p class="p" style="margin-bottom:14px">' + (S.frozen ? "Cliquez sur la carte pour placer chaque coin de votre champ." : "Glissez la carte pour trouver votre terre, puis cliquez sur Délimiter.") + "</p>" +
        '<div class="map' + (S.frozen ? " frozen" : "") + '" id="map" role="application" aria-label="Carte du champ. ' + (S.frozen ? "Cliquez pour placer les coins." : "Glissez pour déplacer.") + '">' +
          '<div class="map-inner" id="mapInner" style="transform:translate(' + Math.round(S.offX) + "px," + Math.round(S.offY) + 'px)">' +
            PARCELS +
            '<div class="road-h"></div><div class="road-v"></div>' +
            '<svg width="' + WORLD_W + '" height="' + WORLD_H + '" style="position:absolute;left:0;top:0" aria-hidden="true"><path d="M-10 700 C 160 650, 300 760, 440 700 S 740 600, 900 670 S 1140 760, 1210 720" fill="none" stroke="#3E7CA8" stroke-width="16" stroke-linecap="round"/></svg>' +
            '<div style="position:absolute;left:640px;top:530px;width:22px;height:16px;background:#D9D4C7;border:2px solid #8E887B"></div>' +
            '<div style="position:absolute;left:668px;top:536px;width:14px;height:12px;background:#B5463A;border:2px solid #7A2E25"></div>' +
          "</div>" +
          '<svg class="map-overlay" width="100%" height="100%" aria-hidden="true"><polygon points="' + pts + '" fill="rgba(255,221,87,0.28)" stroke="#FFDD57" stroke-width="3" stroke-linejoin="round"/></svg>' +
          dots +
          '<div class="map-badge">' + badge + "</div>" +
          (n >= 3 ? '<div class="map-area">' + dec1(a) + " ha</div>" : "") +
        "</div>" +
        controls +
        '<button type="button" class="textlink" style="width:auto" data-a="example">Utiliser un champ d\'exemple</button>',
      foot: '<button type="button" class="primary" data-a="go" data-v="4"' + (n >= 3 ? "" : " disabled") + ">Valider ce champ</button>"
    };
  }

  // ---------- Étape 4 : mon champ ----------
  function scrChamp() {
    var loading = S.loadStep < SOURCES.length;
    if (loading) {
      var rows = SOURCES.map(function (src, i) {
        var done = S.loadStep > i, now = S.loadStep === i;
        var col = done ? "var(--accent)" : now ? "var(--warn)" : "var(--subtle)";
        return '<div class="row list-row"><div><div style="font-weight:600;font-size:14px">' + src.name + '</div><div class="small">' + src.what + '</div></div><div style="font-size:12px;font-weight:700;color:' + col + ';white-space:nowrap">' + (done ? "Reçu" : now ? "En cours…" : "En attente") + "</div></div>";
      }).join("");
      return {
        body: '<div class="narrow"><h1 class="h">On interroge les satellites…</h1><p class="p">Les données de votre champ arrivent automatiquement. Vous n\'avez rien à remplir.</p><div class="card" style="padding:6px 16px">' + rows + "</div></div>",
        foot: '<button type="button" class="primary" disabled>Continuer</button>'
      };
    }
    var a = dec1(ctx().area);
    var data = [
      ["Superficie délimitée", a + " ha", "Votre tracé"],
      ["Pluie de saison (mai à sept.)", "≈ 470 mm · tendance stable", "POWER / IMERG"],
      ["Température moyenne de saison", "≈ 17,8 °C · en hausse", "NASA POWER"],
      ["Humidité du sol", S.sensors ? "28 % · mesurée en continu" : "Moyenne · creux en août", S.sensors ? "Capteurs" : "SMAP"],
      ["Stress hydrique des plantes", S.irrig ? "Faible" : "Faible à moyen", "ECOSTRESS"],
      ["Réchauffement projeté (30 ans)", "≈ +1,5 °C en saison", "NEX-GDDP-CMIP6"]
    ].map(function (r) {
      return '<div class="list-row"><div class="row"><div style="font-size:13px;color:var(--muted)">' + r[0] + '</div><span class="src">' + r[2] + '</span></div><div class="val">' + r[1] + "</div></div>";
    }).join("");
    var tex = Object.keys(TEXTURES).map(function (k) { return '<option value="' + k + '"' + (S.texture === k ? " selected" : "") + ">" + TEXTURES[k].name + "</option>"; }).join("");
    var sensorList = S.sensors ?
      '<div style="margin-top:12px">' +
        '<div class="row list-row"><div style="font-size:14px">6 sondes d\'humidité du sol</div><span class="src">En ligne</span></div>' +
        '<div class="row list-row"><div style="font-size:14px">1 station météo à la ferme</div><span class="src">En ligne</span></div>' +
        '<p class="small" style="margin:8px 0 0">Capteurs simulés pour la démo.</p></div>' : "";
    return {
      body:
        '<h1 class="h">Votre champ</h1>' +
        '<p class="p" style="margin-bottom:12px">Pré-rempli à partir de ' + a + " ha délimités. Corrigez ce que vous connaissez mieux.</p>" +
        '<div class="notice" style="max-width:760px">Valeurs d\'exemple pour le prototype. Dans l\'appli, elles viendront des API de la NASA.</div>' +
        '<div class="cols">' +
          '<div class="card" style="padding:4px 16px">' + data +
            '<div class="list-row"><div class="row"><div style="font-size:13px;color:var(--muted)">Vigueur de la végétation (NDVI, 3 saisons)</div><span class="src">HLS</span></div>' +
            '<svg width="100%" height="54" viewBox="0 0 294 54" preserveAspectRatio="none" role="img" aria-label="Courbe NDVI d\'exemple sur trois saisons" style="margin-top:8px"><path d="M0 48 C 30 46, 50 10, 80 8 S 110 44, 98 48 C 128 46, 148 12, 178 10 S 208 44, 196 48 C 226 46, 246 14, 270 16 S 290 40, 294 46" fill="none" stroke="#2E6B3B" stroke-width="2.5" stroke-linecap="round"/></svg></div>' +
          "</div>" +
          '<div style="display:flex;flex-direction:column;gap:16px">' +
            '<div class="card" style="padding:4px 16px">' +
              '<div class="list-row"><div class="row" style="margin-bottom:8px"><label for="tex" style="font-size:13px;color:var(--muted)">Texture du sol</label><span class="src">SoilGrids</span></div><select id="tex" class="inp" data-c="texture">' + tex + "</select></div>" +
              '<div class="row list-row"><div><div style="font-size:13px;color:var(--muted)">Irrigation disponible</div><div class="val">' + (S.irrig ? "Oui" : "Non") + '</div></div><button type="button" class="chip' + (S.irrig ? " on" : "") + '" aria-pressed="' + S.irrig + '" data-a="irrig">' + (S.irrig ? "Oui" : "Non") + "</button></div>" +
            "</div>" +
            '<div class="card' + (S.sensors ? " soft" : "") + '">' +
              '<div class="row"><div style="display:flex;gap:10px;align-items:center"><span style="color:var(--accent)">' + ICON.sensor + '</span><div><div style="font-weight:600">Capteurs au champ</div><div class="small">Option pour les grandes fermes</div></div></div>' +
              '<button type="button" class="chip' + (S.sensors ? " on" : "") + '" aria-pressed="' + S.sensors + '" data-a="sensors">' + (S.sensors ? "Connectés" : "Connecter") + "</button></div>" +
              '<p class="cb" style="margin-top:12px"><strong>Formule de base :</strong> satellites seulement, aucun matériel. <strong>Avec capteurs :</strong> l\'humidité du sol et la météo sont mesurées en continu sur la ferme et remplacent les estimations satellites.</p>' +
              sensorList +
            "</div>" +
          "</div>" +
        "</div>",
      foot: '<button type="button" class="primary" data-a="go" data-v="5">Continuer</button>'
    };
  }

  // ---------- Étape 5 : cultures et priorités ----------
  function prioSliders(prefix) {
    return PRIOS.map(function (p) {
      var id = prefix + p[0], v = S.prio[p[0]];
      return '<div style="padding:10px 0"><div class="row"><label for="' + id + '" style="font-size:14px;font-weight:500">' + p[1] + '</label><span style="font-weight:700;font-size:14px;color:var(--accent)" id="' + id + '-v">' + v + '/5</span></div>' +
        '<input id="' + id + '" type="range" min="0" max="5" step="1" value="' + v + '" data-prio="' + p[0] + '"></div>';
    }).join("");
  }

  function scrCultures() {
    var chips = IDS.map(function (id) {
      var on = !!S.crops[id];
      return '<button type="button" class="chip' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-a="crop" data-v="' + id + '"><span class="dot" style="background:' + CROPS[id].col + '"></span>' + CROPS[id].name + "</button>";
    }).join("");
    var cur = Object.keys(CURRENTS).map(function (k) { return '<option value="' + k + '"' + (S.current === k ? " selected" : "") + ">" + CURRENTS[k].label + "</option>"; }).join("");
    var hz = FS.HORIZONS.map(function (h) { var on = S.horizon === h; return '<button type="button" class="segb' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-a="horizon" data-v="' + h + '">' + h + " ans</button>"; }).join("");
    return {
      body:
        '<h1 class="h">Cultures et priorités</h1><p class="p">Choisissez les cultures possibles, l\'horizon et ce qui compte le plus pour vous.</p>' +
        '<div class="cols">' +
          "<div>" +
            '<p class="lbl">Cultures que vous avez ou envisagez</p><div class="chips">' + chips + "</div>" +
            (fewCrops() ? '<p class="small" style="color:#8A4A0E;margin:8px 0 0">Choisissez au moins 2 cultures.</p>' : "") +
            '<div class="row card" style="margin-top:14px;padding:12px 16px"><div><div style="font-weight:600;font-size:14px">Trèfle en culture de couverture</div><div class="small">Protège le sol entre deux saisons</div></div>' +
            '<button type="button" class="chip' + (S.cover ? " on" : "") + '" aria-pressed="' + S.cover + '" data-a="cover">' + (S.cover ? "Inclus" : "Non") + "</button></div>" +
            '<label class="lbl mt" for="cur">Votre rotation actuelle</label><select id="cur" class="inp" data-c="current">' + cur + "</select>" +
            '<p class="lbl mt">Horizon de planification</p><div class="seg seg-wrap">' + hz + "</div>" +
            '<p class="small" style="margin:8px 0 0;line-height:1.5">La rotation proposée est un cycle de 1 à ' + FS.MAX_CYCLE + " ans, répété sur tout l'horizon. Plus l'horizon est long, plus la tendance au réchauffement pèse dans le calcul.</p>" +
            (S.horizon >= 15 ? '<div class="notice" style="margin:10px 0 0">Projection sur ' + S.horizon + " ans : les résultats deviennent plus incertains.</div>" : "") +
          "</div>" +
          '<div><p class="lbl">Vos priorités</p><div class="card" style="padding:8px 16px">' + prioSliders("p-") + "</div></div>" +
        "</div>",
      foot: '<button type="button" class="primary" data-a="go" data-v="6"' + (fewCrops() ? " disabled" : "") + ">Voir les suggestions</button>"
    };
  }

  // ---------- Graphique : revenu projeté sur l'horizon ----------
  // Moyenne sur un cycle complet autour de chaque année (évite les dents de scie maïs/soya)
  function smooth(arr, L) {
    var n = arr.length;
    if (L >= n) { var m = arr.reduce(function (a, b) { return a + b; }, 0) / n; return arr.map(function () { return m; }); }
    return arr.map(function (_, i) {
      var a = Math.max(0, Math.min(n - L, i - Math.floor(L / 2))), s = 0;
      for (var j = a; j < a + L; j++) s += arr[j];
      return s / L;
    });
  }
  function chart(res) {
    var W = 760, Hh = 240, pl = 60, pr = 16, pt = 14, pb = 30, H = S.horizon;
    var series = res.map(function (it) { return smooth(it.normal.years, it.seq.length); });
    var all = [].concat.apply([], series);
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all);
    var span = (mx - mn) || Math.abs(mx) || 1;
    mn -= span * 0.1; mx += span * 0.1;
    function X(i) { return pl + i / (H - 1) * (W - pl - pr); }
    function Y(v) { return pt + (1 - (v - mn) / (mx - mn)) * (Hh - pt - pb); }
    var g = "";
    for (var t = 0; t <= 3; t++) {
      var v = mn + (mx - mn) * t / 3, y = Y(v).toFixed(1);
      g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '" stroke="#E3E7DE"/>' +
        '<text x="' + (pl - 8) + '" y="' + (+y + 4) + '" text-anchor="end" font-size="11" fill="#5A6559">' + kmoney(v) + "</text>";
    }
    var step = H <= 10 ? 1 : H <= 15 ? 3 : 5;
    for (var i = 0; i < H; i++) {
      if (i !== 0 && (i + 1) % step !== 0) continue;
      g += '<text x="' + X(i).toFixed(1) + '" y="' + (Hh - 8) + '" text-anchor="middle" font-size="11" fill="#5A6559">' + (i + 1) + "</text>";
    }
    var paths = series.map(function (s, k) {
      var sty = seriesOf(res[k]);
      var d = s.map(function (val, idx) { return (idx ? "L" : "M") + X(idx).toFixed(1) + " " + Y(val).toFixed(1); }).join(" ");
      return '<path d="' + d + '" fill="none" stroke="' + sty.col + '" stroke-width="' + (k === 0 ? 3 : 2) + '" stroke-linejoin="round" stroke-linecap="round"' + (sty.dash ? ' stroke-dasharray="' + sty.dash + '"' : "") + "/>";
    }).reverse().join("");
    var legend = res.map(function (it) {
      var sty = seriesOf(it);
      var mark = sty.dash ? "background:repeating-linear-gradient(90deg," + sty.col + " 0 5px,transparent 5px 9px)" : "background:" + sty.col;
      return '<span><i style="' + mark + '"></i>' + (it.kind === "cur" ? "Actuelle" : BADGES[it.rank]) + "</span>";
    }).join("");
    return '<div class="card chartcard" style="margin-bottom:20px">' +
      '<div class="row" style="margin-bottom:8px;flex-wrap:wrap"><div style="font-weight:600">Revenu net projeté sur ' + H + ' ans</div><div class="small">Moyenne par cycle · année normale + tendance au réchauffement</div></div>' +
      '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Revenu net projeté par année pour chaque rotation">' + g + paths + "</svg>" +
      '<div class="row" style="flex-wrap:wrap"><div class="legend">' + legend + '</div><div class="small">Année</div></div></div>';
  }

  // ---------- Étape 6 : résultats ----------
  function bars(ev, ref) {
    return [["Eau", "eau"], ["Sol", "sol"], ["Résilience", "res"], ["Rendement", "rend"]].map(function (b) {
      var v = ev[b[1]], delta = "";
      if (ref) { var d = v - ref[b[1]]; if (d) delta = ' <span class="' + (d > 0 ? "pos" : "neg") + '">' + (d > 0 ? "+" + d : "−" + Math.abs(d)) + "</span>"; }
      return '<div class="row metric"><div class="lab">' + b[0] + '</div><div class="bar"><div class="fill" style="width:' + v + '%"></div></div><div class="num2">' + v + delta + "</div></div>";
    }).join("");
  }

  function scrResultats() {
    var res = results(), H = S.horizon;
    var cards = res.map(function (it, i) {
      var lo = Math.min(it.sec.rev, it.chaud.rev), hi = it.normal.rev, L = it.seq.length;
      var yrs = it.seq.map(function (id, y) { return '<div style="background:' + CROPS[id].col + '" title="Année ' + (y + 1) + " du cycle : " + CROPS[id].name + '">' + (L < 4 ? "An " + (y + 1) + " · " : "") + CROPS[id].short + "</div>"; }).join("");
      var cls = i === 0 ? " best" : it.kind === "cur" ? " cur" : "";
      return '<article class="card rcard' + cls + '" style="border-top:4px solid ' + seriesOf(it).col + '">' +
        '<div class="row" style="align-items:flex-start"><div class="badge">' + BADGES[it.kind === "cur" ? 3 : it.rank] + '</div><div class="score">' + it.global + "/100</div></div>" +
        '<div class="years">' + yrs + "</div>" +
        '<div class="small">Cycle de ' + years(L) + ", répété sur " + H + " ans</div>" +
        '<div style="font-weight:600;font-size:14px;margin:8px 0 12px">' + it.name + "</div>" +
        bars(it.normal) +
        '<div class="row sep"><div><div class="small">Revenu net / an</div><div style="font-weight:700;font-size:15px">' + money(lo) + " à " + money(hi) + '</div></div><div style="text-align:right"><div class="small">Sur ' + H + ' ans</div><div style="font-weight:600;font-size:13px">' + money(it.normal.total) + "</div></div></div>" +
        '<div class="row" style="margin-top:8px"><div class="small">Confiance</div><div style="font-weight:600;font-size:13px">' + FS.confOf(it.normal.docShare, H).label + "</div></div>" +
        '<div class="btns" style="margin-top:12px"><button type="button" class="mapbtn" data-a="why" data-v="' + i + '">Pourquoi ?</button><button type="button" class="mapbtn" data-a="edit" data-v="' + i + '">Modifier</button><button type="button" class="mapbtn" data-a="stress" data-v="' + i + '">Stress test</button></div>' +
        "</article>";
    }).join("");
    if (res.length === 1) cards = '<div class="notice">Choisissez au moins 2 cultures à l\'étape 5 pour obtenir des suggestions.</div>' + cards;
    return {
      body:
        '<h1 class="h">Vos rotations</h1><p class="p" style="margin-bottom:16px">Classées selon vos priorités, sur ' + H + " ans, comparées à votre rotation actuelle.</p>" +
        (res.length > 1 ? chart(res) : "") +
        '<div class="rgrid">' + cards + "</div>",
      foot: '<button type="button" class="primary" data-a="go" data-v="8">Comparer en stress test</button>'
    };
  }

  // ---------- Étape 7 : explorer et modifier ----------
  function scrExplorer() {
    var sel = selected(), c = ctx(), H = S.horizon;
    var seq = S.edit || sel.seq.slice();
    var ev = FS.evaluate(seq, c, "normal", H);
    var g = FS.globalScore(ev, S.prio), dg = g - sel.global;
    var rows = seq.map(function (id, y) {
      var opts = IDS.map(function (cid) { return '<option value="' + cid + '"' + (cid === id ? " selected" : "") + ">" + CROPS[cid].name + "</option>"; }).join("");
      return '<div class="row list-row"><label for="y' + y + '" style="font-size:13px;color:var(--muted);width:92px;flex:none">Année ' + (y + 1) + '</label><select id="y' + y + '" class="inp" style="height:44px" data-c="year" data-y="' + y + '">' + opts + "</select></div>";
    }).join("");
    var canAdd = seq.length < FS.MAX_CYCLE && seq.length < H, canDel = seq.length > 1;
    var seen = {}, hints = [];
    ev.trans.forEach(function (t) {
      var k = t.prev + ">" + t.cur; if (seen[k]) return; seen[k] = 1;
      var a = CROPS[t.prev].name, b = CROPS[t.cur].name;
      if (t.prev === t.cur) hints.push(["bad", "!", b + " après " + b + " : risque accru de maladies et de ravageurs (rendement " + pct(t.v) + ")."]);
      else if (t.v < 0) hints.push(["bad", "!", a + " puis " + b + " : rendement " + pct(t.v) + "."]);
      else if (t.doc) hints.push(["good", "✓", a + " puis " + b + " : rendement " + pct(t.v) + "."]);
    });
    if (!hints.length) hints.push(["info", "i", "Pas de donnée publiée pour ces enchaînements : l'appli utilise des estimations."]);
    if (H >= 15) hints.push(["info", "i", "Sur " + H + " ans, la tendance au réchauffement pèse surtout sur les cultures peu tolérantes à la chaleur, comme le maïs."]);
    var hintHtml = hints.map(function (h) { return '<div class="hint ' + h[0] + '"><div class="ic">' + h[1] + "</div><div>" + h[2] + "</div></div>"; }).join("");
    return {
      body:
        '<h1 class="h">Explorer et modifier</h1><p class="p" style="margin-bottom:14px">Changez une culture du cycle : les scores se recalculent en direct, sur ' + H + " ans.</p>" +
        '<div class="cols">' +
          "<div>" +
            '<p class="lbl">Votre cycle</p>' +
            '<div class="card" style="padding:6px 16px">' + rows +
              '<div class="btns" style="padding:12px 0"><button type="button" class="mapbtn" data-a="addYear"' + (canAdd ? "" : " disabled") + '>+ Ajouter une année</button><button type="button" class="mapbtn" data-a="delYear"' + (canDel ? "" : " disabled") + ">− Retirer une année</button></div>" +
            "</div>" +
            '<p class="lbl" style="margin-top:20px">Ajuster les priorités</p><div class="card" style="padding:4px 16px">' + prioSliders("e-") + "</div>" +
          "</div>" +
          "<div>" +
            '<p class="lbl">Résultat</p>' +
            '<div class="card"><div class="row" style="margin-bottom:12px"><div style="font-weight:600">Score global</div><div class="score" style="font-size:22px">' + g + (dg ? ' <span class="' + (dg > 0 ? "pos" : "neg") + '" style="font-size:13px">(' + (dg > 0 ? "+" + dg : "−" + Math.abs(dg)) + ")</span>" : "") + "</div></div>" +
              bars(ev, sel.normal) +
              '<div class="row sep"><div class="small">Revenu net estimé / an</div><div style="font-weight:700">' + money(ev.rev) + "</div></div>" +
              '<div class="row" style="margin-top:6px"><div class="small">Sur ' + H + " ans</div><div style=\"font-weight:600;font-size:13px\">" + money(ev.total) + "</div></div></div>" +
            '<p class="lbl" style="margin-top:20px">Points d\'attention</p>' + hintHtml +
          "</div>" +
        "</div>",
      foot: '<button type="button" class="primary" data-a="go" data-v="8">Lancer le stress test</button>'
    };
  }

  // ---------- Étape 8 : stress test ----------
  function scrStress() {
    var res = results().slice(), c = ctx(), sel = selected(), H = S.horizon;
    if (S.edit && FS.canon(S.edit) !== FS.canon(sel.seq)) {
      res.push({ name: FS.nameOf(S.edit, S.cover) + " (modifiée)", kind: "edit", normal: FS.evaluate(S.edit, c, "normal", H), sec: FS.evaluate(S.edit, c, "sec", H), chaud: FS.evaluate(S.edit, c, "chaud", H) });
    }
    var maxRev = Math.max.apply(null, res.map(function (it) { return it.normal.rev; }).concat([1]));
    var bestLoss = null, bestName = "";
    var rows = res.map(function (it) {
      var ev = it[S.scen], loss = (ev.rev - it.normal.rev) / Math.abs(it.normal.rev || 1);
      if (S.scen !== "normal" && (bestLoss === null || loss > bestLoss)) { bestLoss = loss; bestName = it.name; }
      var tag = it.kind === "cur" ? "Votre rotation actuelle" : it.kind === "edit" ? "Modifiée à l'étape 7" : BADGES[it.rank] + " · résilience " + it.normal.res + "/100";
      var w = Math.max(4, Math.round(Math.max(0, ev.rev) / maxRev * 100));
      return '<div class="card"><div class="row"><div style="font-weight:600;font-size:14px">' + it.name + '</div><div style="font-weight:700;font-size:14px" class="' + (loss < -0.12 ? "neg" : "pos") + '">' + (S.scen === "normal" ? "Référence" : pct(loss)) + "</div></div>" +
        '<div class="small" style="margin:2px 0 8px">' + tag + "</div>" +
        '<div class="bar" style="height:10px"><div class="fill" style="width:' + w + "%;background:" + (it.kind === "cur" ? "#8A9488" : "var(--accent)") + '"></div></div>' +
        '<div class="row" style="margin-top:8px"><div class="small">Revenu net / an</div><div style="font-weight:600;font-size:13px">' + money(ev.rev) + "</div></div></div>";
    }).join("");
    var msg = S.scen === "normal" ? "Année normale : c'est la référence. Choisissez « Sèche » ou « Chaude » pour voir quelle rotation résiste le mieux." :
      "En année " + (S.scen === "sec" ? "sèche" : "chaude") + ", « " + bestName + " » perd le moins de revenu (" + pct(bestLoss) + ").";
    var tabs = [["normal", "Normale"], ["sec", "Sèche"], ["chaud", "Chaude"]].map(function (x) { var on = S.scen === x[0]; return '<button type="button" class="segb' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-a="scen" data-v="' + x[0] + '">' + x[1] + "</button>"; }).join("");
    return {
      body:
        '<h1 class="h">Stress test</h1><p class="p" style="margin-bottom:14px">Comment chaque rotation résiste à une mauvaise année ?</p>' +
        '<div class="seg" style="max-width:420px">' + tabs + "</div>" +
        '<div class="card dark" style="margin:14px 0 16px"><div style="font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mint)">À retenir</div><div style="font-size:16px;line-height:1.5;margin-top:6px">' + msg + "</div></div>" +
        '<div class="rgrid">' + rows + "</div>" +
        '<p class="small" style="margin-top:14px;line-height:1.5;max-width:760px">Une rotation plus diversifiée perd moins en année sèche. En année chaude, l\'avantage de la rotation baisse pour le maïs et augmente pour le soya.</p>',
      foot: '<button type="button" class="primary" data-a="go" data-v="9">Voir le détail et les sources</button>'
    };
  }

  // ---------- Étape 9 : détail et sources ----------
  function scrDetail() {
    var sel = selected(), H = S.horizon, conf = FS.confOf(sel.normal.docShare, H);
    var trans = sel.normal.trans.map(function (t) {
      return '<div class="list-row"><div class="row"><div style="font-weight:600;font-size:14px">' + CROPS[t.prev].name + " → " + CROPS[t.cur].name + '</div><div style="font-weight:700" class="' + (t.v >= 0 ? "pos" : "neg") + '">' + pct(t.v) + '</div></div><div class="small" style="margin-top:3px">' + (t.doc ? "Effet documenté par une étude publiée" : "Estimation, sans étude directe") + "</div></div>";
    }).join("");
    var data = ["NASA POWER", "GPM IMERG", S.sensors ? "Capteurs au champ" : "SMAP", "ECOSTRESS", "HLS · NDVI", "NEX-GDDP-CMIP6", "SoilGrids · " + TEXTURES[S.texture].name].map(function (d) { return '<span class="src" style="font-size:12px;padding:5px 9px">' + d + "</span>"; }).join("");
    return {
      body:
        '<h1 class="h">Pourquoi cette rotation ?</h1><p class="p" style="margin-bottom:14px">' + sel.name + " · score " + sel.global + "/100 · sur " + H + " ans</p>" +
        '<div class="cols">' +
          "<div>" +
            '<div class="card"><div class="row"><div style="font-weight:600">Niveau de confiance</div><div style="font-weight:700;color:var(--accent)">' + conf.label + '</div></div><p class="cb" style="font-size:13px;margin-top:6px">' + conf.why + "</p></div>" +
            '<p class="lbl" style="margin-top:20px">Effet de chaque enchaînement sur le rendement</p><div class="card" style="padding:4px 16px">' + trans + "</div>" +
          "</div>" +
          "<div>" +
            '<p class="lbl">Données utilisées</p><div class="chips" style="gap:6px">' + data + "</div>" +
            '<p class="lbl" style="margin-top:20px">Limites</p><ul class="clean sm"><li>Les effets de rotation viennent surtout d\'études américaines : à calibrer pour le Québec.</li><li>Les prix, coûts, données du champ et tendance climatique de ce prototype sont fictifs.</li><li>Field Shift aide à décider : il ne remplace pas l\'avis d\'un agronome.</li></ul>' +
            '<details class="card srcs" style="margin-top:20px"><summary>Sources scientifiques</summary><ul class="clean sm" style="margin-top:8px">' +
              "<li>Kluger, Di Tommaso, Lobell (2025) · rotations dans le monde, Landsat</li>" +
              "<li>Kluger, Owen, Lobell (2022) · effet de la chaleur</li>" +
              "<li>Seifert, Roberts, Lobell (2017) · pénalité de la monoculture</li>" +
              "<li>Bowles et al. (2020) · diversité et sécheresse</li>" +
              "<li>Peltonen-Sainio et al. (2019) · précédent cultural par NDVI</li>" +
            '</ul><p class="small" style="margin:10px 0 0"><a href="algorithme.html">Comment ces études sont utilisées →</a></p></details>' +
          "</div>" +
        "</div>",
      foot: '<div class="btns"><button type="button" class="ghost" data-a="restart">Recommencer</button><button type="button" class="primary" data-a="go" data-v="6">Résultats</button></div>'
    };
  }

  var SCREENS = [null, scrProfil, scrLieu, scrCarte, scrChamp, scrCultures, scrResultats, scrExplorer, scrStress, scrDetail];

  function renderSteps() {
    var h = '<p class="steps-title">' + (S.farm ? esc(S.farm) : "Nouvelle ferme") + '</p><p class="steps-sub">' + (S.loc ? esc(S.loc.split(" · ")[0]) : "Configuration du champ") + "</p>";
    TITLES.forEach(function (t, i) {
      var n = i + 1, cur = n === S.screen, done = !cur && n < S.maxReached;
      var dis = n > S.maxReached;
      h += '<button type="button" class="stepbtn' + (cur ? " current" : done ? " done" : "") + '" data-a="go" data-v="' + n + '"' + (dis ? " disabled" : "") + (cur ? ' aria-current="step"' : "") + '><span class="sn">' + (done ? "✓" : n) + '</span><span class="st">' + t + "</span></button>";
    });
    h += '<div class="steps-foot">Prototype v1.1 · données du champ, prix et revenus fictifs ; logique réelle.<br><a href="algorithme.html">Comment ça marche →</a></div>';
    stepsEl.innerHTML = h;
  }

  function render() {
    var out = SCREENS[S.screen]();
    scr.innerHTML = out.body;
    foot.innerHTML = '<div class="inner">' + (S.screen > 1 ? '<button type="button" class="ghost" data-a="back">← Retour</button>' : "<span></span>") + out.foot + "</div>";
    $("stepTxt").textContent = "Étape " + S.screen + " sur 9 · " + TITLES[S.screen - 1];
    $("progressFill").style.width = Math.round(S.screen / 9 * 100) + "%";
    renderSteps();
    if (S.screen === 3) bindMap();
  }

  // ---------- Carte : déplacement et tracé ----------
  function bindMap() {
    var map = $("map"), inner = $("mapInner");
    map.addEventListener("pointerdown", function (e) {
      if (S.frozen) return;
      drag = { x: e.clientX, y: e.clientY, ox: S.offX, oy: S.offY };
      try { map.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    map.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var r = map.getBoundingClientRect();
      S.offX = lim(drag.ox + (e.clientX - drag.x), Math.min(0, r.width - WORLD_W), 0);
      S.offY = lim(drag.oy + (e.clientY - drag.y), Math.min(0, r.height - WORLD_H), 0);
      inner.style.transform = "translate(" + Math.round(S.offX) + "px," + Math.round(S.offY) + "px)";
    });
    function end() { drag = null; }
    map.addEventListener("pointerup", end);
    map.addEventListener("pointercancel", end);
    map.addEventListener("click", function (e) {
      if (!S.frozen) return;
      var r = map.getBoundingClientRect();
      S.pts.push([Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)]);
      render();
    });
  }

  // ---------- Actions ----------
  var ACTIONS = {
    go: function (v) { go(parseInt(v, 10)); },
    back: function () { go(Math.max(1, S.screen - 1)); },
    prod: function (v) { set({ prod: v }); },
    gps: function () { set({ loc: "45,63° N, 72,96° O · position simulée" }); },
    search: function () { set({ loc: (S.locQuery || "Saint-Hyacinthe") + " · recherche simulée" }); },
    freeze: function () { set({ frozen: true }); },
    unfreeze: function () { set({ frozen: false, pts: [] }); },
    undo: function () { S.pts.pop(); render(); },
    clear: function () { set({ pts: [] }); },
    example: function () {
      var r = $("map").getBoundingClientRect();
      set({ frozen: true, pts: EXAMPLE_REL.map(function (p) { return [Math.round(p[0] * r.width), Math.round(p[1] * r.height)]; }) });
    },
    irrig: function () { set({ irrig: !S.irrig }); },
    sensors: function () { set({ sensors: !S.sensors }); },
    crop: function (v) { S.crops[v] = !S.crops[v]; S.edit = null; render(); },
    cover: function () { set({ cover: !S.cover }); },
    horizon: function (v) { set({ horizon: parseInt(v, 10), edit: null }); },
    why: function (v) { S.sel = +v; go(9); },
    edit: function (v) { S.sel = +v; S.edit = selected().seq.slice(); go(7); },
    stress: function (v) { S.sel = +v; go(8); },
    scen: function (v) { set({ scen: v }); },
    addYear: function () { var s = (S.edit || selected().seq).slice(); s.push(s[0]); set({ edit: s }); },
    delYear: function () { var s = (S.edit || selected().seq).slice(); s.pop(); set({ edit: s }); },
    restart: function () { S.pts = []; S.frozen = false; S.edit = null; S.sel = 0; S.loadStep = 0; S.maxReached = 1; go(1); }
  };

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-a]");
    if (!el || el.disabled) return;
    var fn = ACTIONS[el.getAttribute("data-a")];
    if (fn) fn(el.getAttribute("data-v"));
  });

  // Champs texte : on met à jour l'état sans tout redessiner (pour garder le focus)
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-i")) {
      S[t.getAttribute("data-i")] = t.value;
      if (t.id === "farm") renderSteps();
    }
    if (t.hasAttribute("data-prio")) {
      var lbl = $(t.id + "-v");
      if (lbl) lbl.textContent = t.value + "/5";
    }
  });

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-prio")) { S.prio[t.getAttribute("data-prio")] = parseInt(t.value, 10); render(); return; }
    var c = t.getAttribute("data-c");
    if (c === "texture") set({ texture: t.value });
    else if (c === "current") set({ current: t.value });
    else if (c === "year") {
      var seq = (S.edit || selected().seq).slice();
      seq[parseInt(t.getAttribute("data-y"), 10)] = t.value;
      set({ edit: seq });
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.id === "q") ACTIONS.search();
  });

  render();
})();
