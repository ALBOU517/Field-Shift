/*
 * Field Shift : interface du prototype (9 écrans)
 * Toute la logique de calcul vient de js/engine.js (window.FieldShift).
 */
(function () {
  "use strict";
  var FS = window.FieldShift;
  var CROPS = FS.CROPS, IDS = FS.IDS, TEXTURES = FS.TEXTURES, CURRENTS = FS.CURRENTS, SOURCES = FS.SOURCES;

  var TITLES = ["Profil", "Localisation", "Délimiter le champ", "Mon champ", "Cultures et priorités", "Résultats", "Explorer et modifier", "Stress test", "Détail et sources"];
  var EXAMPLE_FIELD = [[96, 118], [236, 98], [258, 236], [118, 262]];
  var MAP_W = 342, MAP_H = 372, WORLD = 900;
  var M2_PER_PX2 = 16; // 1 px = 4 m sur la carte d'illustration
  var PRIOS = [["eau", "Économiser l'eau"], ["sol", "Améliorer le sol"], ["risque", "Réduire le risque"], ["revenu", "Maximiser le revenu"]];
  var BADGES = ["Recommandée", "Option B", "Option C", "Votre rotation actuelle"];

  var S = {
    screen: 1, farm: "", prod: "gc", loc: "", locQuery: "",
    offX: -60, offY: -170, frozen: false, pts: [],
    loadStep: 0, texture: "loam", irrig: false,
    crops: { mais: true, soya: true, bleP: false, bleH: true, orge: false },
    cover: false, current: "ms",
    prio: { eau: 3, sol: 3, risque: 3, revenu: 4 },
    horizon: 3, sel: 0, edit: null, scen: "sec"
  };

  var scr = document.getElementById("scr");
  var foot = document.getElementById("foot");
  var timer = null, cacheKey = null, cacheRes = null, drag = null;

  // ---------- Utilitaires ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function lim(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function money(n) { return (Math.round(n / 100) * 100).toLocaleString("fr-CA") + " $"; }
  function pct(v) {
    var s = Math.abs(v * 100).toFixed(1).replace(".0", "").replace(".", ",");
    return (v > 0 ? "+" : v < 0 ? "−" : "") + s + " %";
  }
  function dec1(n) { return n.toFixed(1).replace(".", ","); }
  function polyArea(p) {
    if (p.length < 3) return 0;
    var s = 0;
    for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s) / 2;
  }
  function areaHa() { return polyArea(S.pts) * M2_PER_PX2 / 10000; }
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

  var ICON = {
    leaf: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/></svg>',
    pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
    pen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'
  };

  // Carte d'illustration : parcelles générées une seule fois (pseudo-aléatoire stable)
  var PARCELS = (function () {
    var pal = [["#7C9A4E", "#6E8B43"], ["#A4A15A", "#958F4D"], ["#5E7F3B", "#527033"], ["#B39A62", "#A08955"], ["#8DAA5A", "#7E9A4E"], ["#6D8F45", "#61803C"], ["#9E8B5A", "#8C7B4F"]];
    var seed = 7, html = "";
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) {
      var col = pal[Math.floor(rnd() * pal.length)], ang = rnd() > 0.5 ? 0 : 90, forest = rnd() > 0.86;
      var bg = forest ? "#33502A" : "repeating-linear-gradient(" + ang + "deg," + col[0] + " 0 5px," + col[1] + " 5px 10px)";
      html += '<div class="parcel" style="left:' + (c * 100 + 2) + "px;top:" + (r * 100 + 2) + "px;background:" + bg + '"></div>';
    }
    return html;
  })();

  // ---------- Navigation ----------
  function go(n) {
    S.screen = n;
    if (n === 4 && S.loadStep < SOURCES.length) {
      S.loadStep = 0;
      clearInterval(timer);
      timer = setInterval(function () {
        S.loadStep++;
        if (S.loadStep >= SOURCES.length) { clearInterval(timer); timer = null; }
        if (S.screen === 4) render();
      }, 420);
    }
    render();
    scr.scrollTop = 0;
  }
  function set(patch) { for (var k in patch) S[k] = patch[k]; render(); }

  // ---------- Écrans ----------
  function scrProfil() {
    var prods = [["gc", "Grandes cultures"], ["mixte", "Mixte"], ["mar", "Maraîchage"]].map(function (p) {
      var on = S.prod === p[0];
      return '<button type="button" class="chip' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-a="prod" data-v="' + p[0] + '">' + p[1] + "</button>";
    }).join("");
    return {
      body:
        '<div class="welcome-icon">' + ICON.leaf + "</div>" +
        '<h1 class="h">Bienvenue sur Field Shift</h1>' +
        '<p class="p">Deux questions, puis on s\'occupe du reste avec les données satellites de la NASA.</p>' +
        '<label class="lbl" for="farm">Nom de la ferme</label>' +
        '<input id="farm" class="inp" data-i="farm" value="' + esc(S.farm) + '" placeholder="Ex. Ferme des Érables" autocomplete="off">' +
        '<p class="lbl mt">Type de production</p><div class="chips">' + prods + "</div>" +
        '<div class="card soft" style="margin-top:24px"><p class="cb" style="color:var(--accent-dark)">On ne vous demande ni votre niveau d\'eau ni l\'état de votre sol : l\'appli les estime à partir des satellites, et vous corrigez si vous savez mieux.</p></div>',
      foot: '<button type="button" class="primary" data-a="go" data-v="2">Continuer</button>'
    };
  }

  function scrLieu() {
    return {
      body:
        '<h1 class="h">Où est votre ferme ?</h1>' +
        '<p class="p">On centre la carte sur votre terre à l\'étape suivante.</p>' +
        '<button type="button" class="ghost" data-a="gps">' + ICON.pin + "Utiliser ma position</button>" +
        '<div class="row divider"><span>ou</span></div>' +
        '<label class="lbl" for="q">Adresse, ville ou rang</label>' +
        '<div style="display:flex;gap:8px"><input id="q" class="inp" data-i="locQuery" value="' + esc(S.locQuery) + '" placeholder="Ex. Saint-Hyacinthe" autocomplete="off">' +
        '<button type="button" class="chip on" style="border-radius:12px;flex:none" data-a="search">Chercher</button></div>' +
        (S.loc ?
          '<div class="card" style="margin-top:20px;display:flex;gap:12px;align-items:center"><div class="welcome-icon" style="width:40px;height:40px;border-radius:12px;margin:0;flex:none">' + ICON.check + '</div><div><div style="font-weight:600">Position trouvée</div><div class="small" style="margin-top:2px">' + esc(S.loc) + "</div></div></div>" : ""),
      foot: '<button type="button" class="primary" data-a="go" data-v="3"' + (S.loc ? "" : " disabled") + ">Continuer</button>"
    };
  }

  function scrCarte() {
    var n = S.pts.length, a = areaHa();
    var pts = S.pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
    var dots = S.pts.map(function (p) { return '<div class="vertex" style="left:' + p[0] + "px;top:" + p[1] + 'px"></div>'; }).join("");
    var badge = S.frozen ? "Mode tracé · " + n + " point" + (n > 1 ? "s" : "") : "Carte satellite (illustration)";
    var controls = S.frozen ?
      '<div class="btns" style="margin-top:14px"><button type="button" class="mapbtn" data-a="undo">Annuler le point</button><button type="button" class="mapbtn" data-a="clear">Recommencer</button><button type="button" class="mapbtn" data-a="unfreeze">Déplacer la carte</button></div>' :
      '<div style="margin-top:14px"><button type="button" class="ghost dark" data-a="freeze">' + ICON.pen + "Délimiter</button></div>";
    return {
      body:
        '<h1 class="h">Délimitez votre champ</h1>' +
        '<p class="p" style="margin-bottom:14px">' + (S.frozen ? "Touchez la carte pour placer chaque coin de votre champ." : "Glissez la carte pour trouver votre terre, puis appuyez sur Délimiter.") + "</p>" +
        '<div class="map' + (S.frozen ? " frozen" : "") + '" id="map" role="application" aria-label="Carte du champ. ' + (S.frozen ? "Cliquez pour placer les coins." : "Glissez pour déplacer.") + '">' +
          '<div class="map-inner" id="mapInner" style="transform:translate(' + Math.round(S.offX) + "px," + Math.round(S.offY) + 'px)">' +
            PARCELS +
            '<div class="road-h"></div><div class="road-v"></div>' +
            '<svg width="900" height="900" viewBox="0 0 900 900" style="position:absolute;left:0;top:0" aria-hidden="true"><path d="M-10 640 C 120 600, 210 700, 330 650 S 560 560, 680 620 S 860 700, 910 660" fill="none" stroke="#3E7CA8" stroke-width="16" stroke-linecap="round"/></svg>' +
            '<div style="position:absolute;left:540px;top:430px;width:22px;height:16px;background:#D9D4C7;border:2px solid #8E887B"></div>' +
            '<div style="position:absolute;left:568px;top:436px;width:14px;height:12px;background:#B5463A;border:2px solid #7A2E25"></div>' +
          "</div>" +
          '<svg class="map-overlay" width="' + MAP_W + '" height="' + MAP_H + '" viewBox="0 0 ' + MAP_W + " " + MAP_H + '" aria-hidden="true"><polygon points="' + pts + '" fill="rgba(255,221,87,0.28)" stroke="#FFDD57" stroke-width="3" stroke-linejoin="round"/></svg>' +
          dots +
          '<div class="map-badge">' + badge + "</div>" +
          (n >= 3 ? '<div class="map-area">' + dec1(a) + " ha</div>" : "") +
        "</div>" +
        controls +
        '<button type="button" class="textlink" data-a="example">Utiliser un champ d\'exemple</button>',
      foot: '<button type="button" class="primary" data-a="go" data-v="4"' + (n >= 3 ? "" : " disabled") + ">Valider ce champ</button>"
    };
  }

  function scrChamp() {
    var loading = S.loadStep < SOURCES.length;
    if (loading) {
      var rows = SOURCES.map(function (src, i) {
        var done = S.loadStep > i, now = S.loadStep === i;
        var col = done ? "var(--accent)" : now ? "var(--warn)" : "var(--subtle)";
        return '<div class="row list-row"><div><div style="font-weight:600;font-size:14px">' + src.name + '</div><div class="small">' + src.what + '</div></div><div style="font-size:12px;font-weight:700;color:' + col + ';white-space:nowrap">' + (done ? "Reçu" : now ? "En cours…" : "En attente") + "</div></div>";
      }).join("");
      return {
        body: '<h1 class="h">On interroge les satellites…</h1><p class="p">Les données de votre champ arrivent automatiquement. Vous n\'avez rien à remplir.</p><div class="card" style="padding:6px 16px">' + rows + "</div>",
        foot: '<button type="button" class="primary" disabled>Continuer</button>'
      };
    }
    var a = dec1(ctx().area);
    var data = [
      ["Superficie délimitée", a + " ha", "Votre tracé"],
      ["Pluie de saison (mai à sept.)", "≈ 470 mm · tendance stable", "POWER / IMERG"],
      ["Température moyenne de saison", "≈ 17,8 °C · en hausse", "NASA POWER"],
      ["Humidité du sol", "Moyenne · creux en août", "SMAP"],
      ["Stress hydrique des plantes", S.irrig ? "Faible" : "Faible à moyen", "ECOSTRESS"]
    ].map(function (r) {
      return '<div class="list-row"><div class="row"><div style="font-size:13px;color:var(--muted)">' + r[0] + '</div><span class="src">' + r[2] + '</span></div><div class="val">' + r[1] + "</div></div>";
    }).join("");
    var tex = Object.keys(TEXTURES).map(function (k) { return '<option value="' + k + '"' + (S.texture === k ? " selected" : "") + ">" + TEXTURES[k].name + "</option>"; }).join("");
    return {
      body:
        '<h1 class="h">Votre champ</h1>' +
        '<p class="p" style="margin-bottom:12px">Pré-rempli à partir de ' + a + " ha délimités. Corrigez ce que vous connaissez mieux.</p>" +
        '<div class="notice">Valeurs d\'exemple pour la maquette. Dans l\'appli, elles viendront des API de la NASA.</div>' +
        '<div class="card" style="padding:4px 16px">' + data +
          '<div class="list-row"><div class="row"><div style="font-size:13px;color:var(--muted)">Vigueur de la végétation (NDVI, 3 saisons)</div><span class="src">HLS</span></div>' +
          '<svg width="100%" height="54" viewBox="0 0 294 54" preserveAspectRatio="none" role="img" aria-label="Courbe NDVI d\'exemple sur trois saisons" style="margin-top:8px"><path d="M0 48 C 30 46, 50 10, 80 8 S 110 44, 98 48 C 128 46, 148 12, 178 10 S 208 44, 196 48 C 226 46, 246 14, 270 16 S 290 40, 294 46" fill="none" stroke="#2E6B3B" stroke-width="2.5" stroke-linecap="round"/></svg></div>' +
          '<div class="list-row"><div class="row" style="margin-bottom:8px"><label for="tex" style="font-size:13px;color:var(--muted)">Texture du sol</label><span class="src">SoilGrids</span></div><select id="tex" class="inp" data-c="texture">' + tex + "</select></div>" +
          '<div class="row list-row"><div><div style="font-size:13px;color:var(--muted)">Irrigation disponible</div><div class="val">' + (S.irrig ? "Oui" : "Non") + '</div></div><button type="button" class="chip' + (S.irrig ? " on" : "") + '" aria-pressed="' + S.irrig + '" data-a="irrig">' + (S.irrig ? "Oui" : "Non") + "</button></div>" +
        "</div>",
      foot: '<button type="button" class="primary" data-a="go" data-v="5">Continuer</button>'
    };
  }

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
    var hz = [3, 4, 5].map(function (h) { var on = S.horizon === h; return '<button type="button" class="segb' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-a="horizon" data-v="' + h + '">' + h + " ans</button>"; }).join("");
    return {
      body:
        '<h1 class="h">Cultures et priorités</h1><p class="p">Choisissez les cultures possibles et ce qui compte le plus pour vous.</p>' +
        '<p class="lbl">Cultures que vous avez ou envisagez</p><div class="chips">' + chips + "</div>" +
        (fewCrops() ? '<p class="small" style="color:#8A4A0E;margin:8px 0 0">Choisissez au moins 2 cultures.</p>' : "") +
        '<div class="row card" style="margin-top:14px;padding:12px 16px"><div><div style="font-weight:600;font-size:14px">Trèfle en culture de couverture</div><div class="small">Protège le sol entre deux saisons</div></div>' +
        '<button type="button" class="chip' + (S.cover ? " on" : "") + '" aria-pressed="' + S.cover + '" data-a="cover">' + (S.cover ? "Inclus" : "Non") + "</button></div>" +
        '<label class="lbl mt" for="cur">Votre rotation actuelle</label><select id="cur" class="inp" data-c="current">' + cur + "</select>" +
        '<p class="lbl mt">Horizon de planification</p><div class="seg">' + hz + "</div>" +
        '<p class="lbl" style="margin-top:24px">Vos priorités</p><div class="card" style="padding:8px 16px">' + prioSliders("p-") + "</div>",
      foot: '<button type="button" class="primary" data-a="go" data-v="6"' + (fewCrops() ? " disabled" : "") + ">Voir les suggestions</button>"
    };
  }

  function bars(ev, ref) {
    return [["Eau", "eau"], ["Sol", "sol"], ["Résilience", "res"], ["Rendement", "rend"]].map(function (b) {
      var v = ev[b[1]], delta = "";
      if (ref) { var d = v - ref[b[1]]; if (d) delta = ' <span class="' + (d > 0 ? "pos" : "neg") + '">' + (d > 0 ? "+" + d : "−" + Math.abs(d)) + "</span>"; }
      return '<div class="row metric"><div class="lab">' + b[0] + '</div><div class="bar"><div class="fill" style="width:' + v + '%"></div></div><div class="num2">' + v + delta + "</div></div>";
    }).join("");
  }

  function scrResultats() {
    var res = results();
    var cards = res.map(function (it, i) {
      var lo = Math.min(it.sec.rev, it.chaud.rev), hi = it.normal.rev;
      var years = it.seq.map(function (id, y) { return '<div style="background:' + CROPS[id].col + '">A' + (y + 1) + " · " + CROPS[id].short + "</div>"; }).join("");
      var cls = i === 0 ? " best" : it.kind === "cur" ? " cur" : "";
      return '<article class="card rcard' + cls + '">' +
        '<div class="row" style="align-items:flex-start"><div class="badge">' + BADGES[it.kind === "cur" ? 3 : it.rank] + '</div><div class="score">' + it.global + "/100</div></div>" +
        '<div class="years">' + years + "</div>" +
        '<div style="font-weight:600;font-size:14px;margin:8px 0 12px">' + it.name + "</div>" +
        bars(it.normal) +
        '<div class="row sep"><div><div class="small">Revenu net estimé / an</div><div style="font-weight:700;font-size:15px">' + money(lo) + " à " + money(hi) + '</div></div><div style="text-align:right"><div class="small">Confiance</div><div style="font-weight:600;font-size:13px">' + FS.confOf(it.normal.docShare).label + "</div></div></div>" +
        '<div class="btns" style="margin-top:12px"><button type="button" class="mapbtn" data-a="why" data-v="' + i + '">Pourquoi ?</button><button type="button" class="mapbtn" data-a="edit" data-v="' + i + '">Modifier</button><button type="button" class="mapbtn" data-a="stress" data-v="' + i + '">Stress test</button></div>' +
        "</article>";
    }).join("");
    if (res.length === 1) cards = '<div class="notice">Choisissez au moins 2 cultures à l\'écran 5 pour obtenir des suggestions.</div>' + cards;
    return {
      body: '<h1 class="h">Vos rotations</h1><p class="p" style="margin-bottom:16px">Classées selon vos priorités, sur ' + S.horizon + " ans, comparées à votre rotation actuelle.</p>" + cards,
      foot: '<button type="button" class="primary" data-a="go" data-v="8">Comparer en stress test</button>'
    };
  }

  function scrExplorer() {
    var sel = selected(), c = ctx();
    var seq = S.edit || sel.seq.slice();
    var ev = FS.evaluate(seq, c, "normal");
    var g = FS.globalScore(ev, S.prio), dg = g - sel.global;
    var rows = seq.map(function (id, y) {
      var opts = IDS.map(function (cid) { return '<option value="' + cid + '"' + (cid === id ? " selected" : "") + ">" + CROPS[cid].name + "</option>"; }).join("");
      return '<div class="row list-row"><label for="y' + y + '" style="font-size:13px;color:var(--muted);width:92px;flex:none">Année ' + (y + 1) + '</label><select id="y' + y + '" class="inp" style="height:44px" data-c="year" data-y="' + y + '">' + opts + "</select></div>";
    }).join("");
    var seen = {}, hints = [];
    ev.trans.forEach(function (t) {
      var k = t.prev + ">" + t.cur; if (seen[k]) return; seen[k] = 1;
      var a = CROPS[t.prev].name, b = CROPS[t.cur].name;
      if (t.prev === t.cur) hints.push(["bad", "!", b + " après " + b + " : risque accru de maladies et de ravageurs (" + pct(t.v) + ").", t.src]);
      else if (t.v < 0) hints.push(["bad", "!", a + " puis " + b + " : rendement " + pct(t.v) + ".", t.src]);
      else if (t.doc) hints.push(["good", "✓", a + " puis " + b + " : rendement " + pct(t.v) + ".", t.src]);
    });
    if (!hints.length) hints.push(["info", "i", "Pas d'étude directe pour ces enchaînements : l'appli utilise des estimations génériques.", "Confiance faible"]);
    var hintHtml = hints.map(function (h) { return '<div class="hint ' + h[0] + '"><div class="ic">' + h[1] + "</div><div>" + h[2] + '<div class="small" style="margin-top:2px">' + h[3] + "</div></div></div>"; }).join("");
    return {
      body:
        '<h1 class="h">Explorer et modifier</h1><p class="p" style="margin-bottom:14px">Changez une culture : les scores se recalculent en direct.</p>' +
        '<div class="card" style="padding:6px 16px">' + rows + "</div>" +
        '<div class="card" style="margin-top:14px"><div class="row" style="margin-bottom:12px"><div style="font-weight:600">Score global</div><div class="score" style="font-size:22px">' + g + (dg ? ' <span class="' + (dg > 0 ? "pos" : "neg") + '" style="font-size:13px">(' + (dg > 0 ? "+" + dg : "−" + Math.abs(dg)) + ")</span>" : "") + "</div></div>" +
        bars(ev, sel.normal) +
        '<div class="row sep"><div class="small">Revenu net estimé / an</div><div style="font-weight:700">' + money(ev.rev) + "</div></div></div>" +
        '<p class="lbl" style="margin-top:20px">Ce que la science en dit</p>' + hintHtml +
        '<p class="lbl" style="margin-top:20px">Ajuster les priorités</p><div class="card" style="padding:4px 16px">' + prioSliders("e-") + "</div>",
      foot: '<button type="button" class="primary" data-a="go" data-v="8">Lancer le stress test</button>'
    };
  }

  function scrStress() {
    var res = results().slice(), c = ctx(), sel = selected();
    if (S.edit && FS.canon(S.edit) !== FS.canon(sel.seq)) {
      res.push({ name: "Votre version modifiée", kind: "edit", normal: FS.evaluate(S.edit, c, "normal"), sec: FS.evaluate(S.edit, c, "sec"), chaud: FS.evaluate(S.edit, c, "chaud") });
    }
    var maxRev = Math.max.apply(null, res.map(function (it) { return it.normal.rev; }).concat([1]));
    var bestLoss = null, bestName = "";
    var rows = res.map(function (it) {
      var ev = it[S.scen], loss = (ev.rev - it.normal.rev) / Math.abs(it.normal.rev || 1);
      if (S.scen !== "normal" && (bestLoss === null || loss > bestLoss)) { bestLoss = loss; bestName = it.name; }
      var tag = it.kind === "cur" ? "Votre rotation actuelle" : it.kind === "edit" ? "Modifiée à l'écran 7" : BADGES[it.rank] + " · résilience " + it.normal.res + "/100";
      var w = Math.max(4, Math.round(Math.max(0, ev.rev) / maxRev * 100));
      return '<div class="card" style="margin-top:10px"><div class="row"><div style="font-weight:600;font-size:14px">' + it.name + '</div><div style="font-weight:700;font-size:14px" class="' + (loss < -0.12 ? "neg" : "pos") + '">' + (S.scen === "normal" ? "Référence" : pct(loss)) + "</div></div>" +
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
        '<div class="seg">' + tabs + "</div>" +
        '<div class="card dark" style="margin-top:14px"><div style="font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mint)">À retenir</div><div style="font-size:15px;line-height:1.5;margin-top:6px">' + msg + "</div></div>" +
        rows +
        '<p class="small" style="margin-top:12px;line-height:1.5">Une rotation plus diversifiée réduit les pertes en année sèche (Bowles et al. 2020). En année chaude, l\'avantage de la rotation baisse pour le maïs et augmente pour le soya (Kluger et al. 2022).</p>',
      foot: '<button type="button" class="primary" data-a="go" data-v="9">Voir le détail et les sources</button>'
    };
  }

  function scrDetail() {
    var sel = selected(), conf = FS.confOf(sel.normal.docShare);
    var trans = sel.normal.trans.map(function (t) {
      return '<div class="list-row"><div class="row"><div style="font-weight:600;font-size:14px">' + CROPS[t.prev].name + " → " + CROPS[t.cur].name + '</div><div style="font-weight:700" class="' + (t.v >= 0 ? "pos" : "neg") + '">' + pct(t.v) + '</div></div><div class="small" style="margin-top:3px">' + (t.doc ? "Étude : " : "") + t.src + "</div></div>";
    }).join("");
    var data = ["NASA POWER", "GPM IMERG", "SMAP", "ECOSTRESS", "HLS · NDVI", "SoilGrids · " + TEXTURES[S.texture].name].map(function (d) { return '<span class="src" style="font-size:12px;padding:5px 9px">' + d + "</span>"; }).join("");
    return {
      body:
        '<h1 class="h">Pourquoi cette rotation ?</h1><p class="p" style="margin-bottom:14px">' + sel.name + " · score " + sel.global + "/100</p>" +
        '<div class="card"><div class="row"><div style="font-weight:600">Niveau de confiance</div><div style="font-weight:700;color:var(--accent)">' + conf.label + '</div></div><p class="cb" style="font-size:13px;margin-top:6px">' + conf.why + "</p></div>" +
        '<p class="lbl" style="margin-top:20px">Effet de chaque enchaînement sur le rendement</p><div class="card" style="padding:4px 16px">' + trans + "</div>" +
        '<p class="lbl" style="margin-top:20px">Données utilisées</p><div class="chips" style="gap:6px">' + data + "</div>" +
        '<p class="lbl" style="margin-top:20px">Limites</p><ul class="clean sm"><li>Les études viennent surtout du Midwest américain : à calibrer pour le Québec.</li><li>Les prix, coûts et données du champ de ce prototype sont fictifs.</li><li>Field Shift aide à décider : il ne remplace pas l\'avis d\'un agronome.</li></ul>' +
        '<p class="lbl" style="margin-top:20px">Études</p><ul class="clean sm"><li>Kluger, Di Tommaso, Lobell (2025) · rotations dans le monde, Landsat</li><li>Kluger, Owen, Lobell (2022) · effet de la chaleur</li><li>Seifert, Roberts, Lobell (2017) · pénalité de la monoculture</li><li>Bowles et al. (2020) · diversité et sécheresse</li><li>Peltonen-Sainio et al. (2019) · précédent cultural par NDVI</li></ul>',
      foot: '<div class="btns"><button type="button" class="ghost" data-a="restart">Recommencer</button><button type="button" class="primary" data-a="go" data-v="6">Résultats</button></div>'
    };
  }

  var SCREENS = [null, scrProfil, scrLieu, scrCarte, scrChamp, scrCultures, scrResultats, scrExplorer, scrStress, scrDetail];

  function render() {
    var out = SCREENS[S.screen]();
    scr.innerHTML = out.body;
    foot.innerHTML = out.foot + '<div class="small note">Prototype · chiffres fictifs, logique réelle</div>';
    document.getElementById("stepTxt").textContent = "Étape " + S.screen + " sur 9";
    document.getElementById("titleTxt").textContent = TITLES[S.screen - 1];
    document.getElementById("progressFill").style.width = Math.round(S.screen / 9 * 100) + "%";
    document.getElementById("backBtn").style.visibility = S.screen > 1 ? "visible" : "hidden";
    if (S.screen === 3) bindMap();
  }

  // ---------- Carte : déplacement et tracé ----------
  function bindMap() {
    var map = document.getElementById("map"), inner = document.getElementById("mapInner");
    function scale() { var r = map.getBoundingClientRect(); return { r: r, k: r.width / MAP_W || 1 }; }
    map.addEventListener("pointerdown", function (e) {
      if (S.frozen) return;
      drag = { x: e.clientX, y: e.clientY, ox: S.offX, oy: S.offY };
      try { map.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    map.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var k = scale().k;
      S.offX = lim(drag.ox + (e.clientX - drag.x) / k, -(WORLD - MAP_W), 0);
      S.offY = lim(drag.oy + (e.clientY - drag.y) / k, -(WORLD - MAP_H), 0);
      inner.style.transform = "translate(" + Math.round(S.offX) + "px," + Math.round(S.offY) + "px)";
    });
    function end() { drag = null; }
    map.addEventListener("pointerup", end);
    map.addEventListener("pointercancel", end);
    map.addEventListener("click", function (e) {
      if (!S.frozen) return;
      var s = scale();
      S.pts.push([Math.round((e.clientX - s.r.left) / s.k), Math.round((e.clientY - s.r.top) / s.k)]);
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
    example: function () { set({ frozen: true, pts: EXAMPLE_FIELD.map(function (p) { return p.slice(); }) }); },
    irrig: function () { set({ irrig: !S.irrig }); },
    crop: function (v) { S.crops[v] = !S.crops[v]; S.edit = null; render(); },
    cover: function () { set({ cover: !S.cover }); },
    horizon: function (v) { set({ horizon: parseInt(v, 10), edit: null }); },
    why: function (v) { S.sel = +v; go(9); },
    edit: function (v) { S.sel = +v; S.edit = selected().seq.slice(); go(7); },
    stress: function (v) { S.sel = +v; go(8); },
    scen: function (v) { set({ scen: v }); },
    restart: function () { S.pts = []; S.frozen = false; S.edit = null; S.sel = 0; S.loadStep = 0; go(1); }
  };

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-a]");
    if (!el || el.disabled) return;
    var fn = ACTIONS[el.getAttribute("data-a")];
    if (fn) fn(el.getAttribute("data-v"));
  });

  // Champs texte : on met à jour l'état sans re-dessiner (pour garder le focus)
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-i")) S[t.getAttribute("data-i")] = t.value;
    if (t.hasAttribute("data-prio")) {
      var lbl = document.getElementById(t.id + "-v");
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
