# Field Shift 🌱

**Un outil d'aide à la décision qui utilise les données de la NASA pour proposer aux fermiers des rotations de cultures résilientes au climat.**

Projet de l'équipe **NASA-LARPERS** pour le [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/) (14 et 15 novembre), défi *Field Shift: Adapting Farms with NASA Data*.

> **Version 1 : prototype.** L'interface et l'algorithme fonctionnent. Les données du champ, les prix et les revenus sont **fictifs** ; les effets de rotation viennent d'études publiées.

---

## L'idée

Le fermier trace son champ sur une carte. L'appli récupère automatiquement les données NASA de ce champ et lui propose des rotations de cultures, avec leur effet sur l'eau, le sol, la résilience et le revenu. Il peut les modifier et voir les prédictions changer en direct.

**Notre angle :** pas seulement « quoi planter l'an prochain », mais **quelle rotation résiste aux prochaines années sur ce champ précis**.

## Ce que contient la v1

| Page | Contenu |
|---|---|
| [`index.html`](index.html) | Vue d'ensemble : défi, exigences, jugement, prix visés, niveaux, communication, risques |
| [`app.html`](app.html) | **Prototype cliquable** en 9 écrans |
| [`algorithme.html`](algorithme.html) | Le pipeline, les données, les 5 scores, les paramètres scientifiques |

### Le prototype (9 écrans)

1. **Profil** · 2. **Localisation** · 3. **Délimiter le champ** · 4. **Mon champ** (pré-rempli par les satellites) · 5. **Cultures et priorités** · 6. **Résultats** · 7. **Explorer et modifier** · 8. **Stress test** · 9. **Détail et sources**

Ce qui fonctionne vraiment :
- **Carte :** on la glisse, on appuie sur « Délimiter », puis on place les coins du champ ; la superficie se calcule en direct.
- **Suggestions :** toutes les rotations possibles sont énumérées, notées et classées selon les priorités du fermier.
- **Études branchées dans le calcul :** effets de rotation de Kluger et al. (2025) et Seifert et al. (2017), effet de la chaleur de Kluger et al. (2022), effet de la diversité en sécheresse inspiré de Bowles et al. (2020).
- **Modification en direct :** changer une culture ou une priorité recalcule les scores et affiche des avertissements sourcés.
- **Stress test :** compare les rotations en année normale, sèche et chaude.

## Lancer le projet

Aucune installation, aucune dépendance : c'est du HTML, du CSS et du JavaScript pur.

- **Le plus simple :** double-cliquez sur `index.html`.
- **Avec un serveur local** (recommandé) :
  ```bash
  python3 -m http.server 8000
  ```
  puis ouvrez <http://localhost:8000>.

## Mettre en ligne avec GitHub Pages

1. Poussez le dépôt sur GitHub.
2. Allez dans **Settings → Pages**.
3. Sous **Source**, choisissez **Deploy from a branch**, la branche `main` et le dossier `/ (root)`.
4. Après une minute, le site est en ligne sur `https://<votre-nom>.github.io/<nom-du-depot>/`.

Ce lien public répond à l'exigence de soumission « lien vers le projet accessible sans compte ».

## Structure

```
field-shift/
├── index.html         Vue d'ensemble du projet
├── app.html           Prototype cliquable
├── algorithme.html    Explication de l'algorithme
├── css/
│   └── style.css      Styles partagés
├── js/
│   ├── engine.js      Moteur de suggestions (logique pure, sans interface)
│   └── app.js         Interface du prototype
├── SOURCES.md         Registre des sources
└── README.md
```

`js/engine.js` est volontairement séparé de l'interface : c'est la base de l'algorithme qu'on pourra porter côté serveur (Python) ou brancher sur les vraies données NASA.

## L'algorithme en bref

1. **Conditions du champ** à partir des données NASA (POWER, IMERG, SMAP, ECOSTRESS, HLS) et du sol.
2. **Génération** de toutes les rotations possibles (les décalages d'une même rotation comptent pour une).
3. **5 scores sur 100 :** rendement, résilience, sol, eau, revenu.
4. **Pondération** selon les priorités du fermier.
5. **Scénarios** normal, sec et chaud, qui donnent des fourchettes.
6. **Explications** et niveau de confiance selon les études qui couvrent chaque enchaînement.

Détails : [`algorithme.html`](algorithme.html).

## Feuille de route

- [x] **v1** : prototype cliquable, moteur de suggestions, documentation
- [ ] Brancher NASA POWER (aucun compte nécessaire) pour la région de démo
- [ ] Ajouter IMERG, SMAP, ECOSTRESS et HLS via `earthaccess`
- [ ] Vraie carte satellite avec outil de dessin (Leaflet ou Mapbox)
- [ ] Prix et coûts réels à partir de budgets de production régionaux
- [ ] Calibration pour le Québec et validation par un agronome
- [ ] Rapport méthodologique (3 à 5 pages, en anglais)

## Limites

- Les effets de rotation viennent surtout d'études menées aux États-Unis : ils devront être calibrés pour le Québec.
- Les données du champ, les prix et les revenus de la v1 sont fictifs.
- Field Shift aide à décider ; il ne remplace pas l'avis d'un agronome.

## Sources

Toutes les études, données et ressources utilisées sont listées dans [`SOURCES.md`](SOURCES.md).

## Utilisation de l'IA

Des outils d'IA (Claude) ont servi à la recherche d'études, à la structuration de l'architecture et à la génération du code de cette v1. Les paramètres scientifiques proviennent d'études citées, et le code a été relu par l'équipe. Le journal détaillé sera tenu à jour pendant le hackathon pour la déclaration de soumission.

## Équipe

NASA-LARPERS · NASA Space Apps Challenge 2026
