# Registre des sources

Règle d'équipe : les noms d'études n'apparaissent pas dans les suggestions de l'application. Ils sont regroupés ici et dans l'étape « Détail et sources ».

Chaque source est notée **au moment où on l'utilise**. Types à inclure : études, jeux de données, bibliothèques de code, API, images, icônes, polices, musique de la vidéo, outils d'IA.

## Études scientifiques

| # | Source | Ce qu'on en utilise | Où dans le projet |
|---|---|---|---|
| 1 | Kluger, D. M., Di Tommaso, S., Lobell, D. B. (2025). *Evaluating crop rotations around the world using satellite imagery and causal machine learning.* arXiv. Résumé : [NASA Earth Observatory](https://science.nasa.gov/earth/earth-observatory/how-to-rotate-crops-154601/) | Effets par séquence : maïs → soya et soya → blé de printemps ~ +8 %, soya → maïs ~ +2,5 %, blé d'hiver → maïs ~ +0,9 %, soya → blé d'hiver ~ −12 % ; plus d'effet en conditions pluvieuses | `js/engine.js` (DOC), score rendement |
| 2 | Kluger, D. M., Owen, A. B., Lobell, D. B. (2022). *Combining randomized field experiments with observational satellite data to assess the benefits of crop rotations on yields.* Environmental Research Letters 17(4). [arXiv:2112.13700](https://arxiv.org/abs/2112.13700v1) | Avantage de la rotation pour le maïs : ~1,18 t/ha années fraîches contre ~0,84 t/ha années chaudes ; avantage plus grand pour le soya quand il fait chaud | Scénario « chaud » |
| 3 | Zhou et al. *Changes in the Yield Effect of the Preceding Crop in the US Corn Belt Under a Warming Climate.* [Résumé](https://www.eurekalert.org/news-releases/1070427) | Effet du précédent cultural sous réchauffement | Contexte, scénario futur |
| 4 | Seifert, C. A., Roberts, M. J., Lobell, D. B. (2017). *Continuous Corn and Soybean Yield Penalties across Hundreds of Thousands of Fields.* [Notice](https://agris.fao.org/search/zh/records/65df2e2663b8185d9cab64c7) | Pénalité de 4,3 % pour le maïs en continu | `js/engine.js` (DOC) |
| 5 | Peltonen-Sainio, P. et al. (2019). *Pre-crop Values from Satellite Images for Various Previous and Subsequent Crop Combinations.* Frontiers in Plant Science. DOI 10.3389/fpls.2019.00462 · [Notice](https://agris.fao.org/search/ru/records/6748a03c8834da021e380628) | Méthode NDVI pour estimer la valeur du précédent cultural (+16 % à −16 %) | Niveau 4 (NDVI via HLS) |
| 6 | Bowles, T. M. et al. (2020). *Long-Term Evidence Shows that Crop-Rotation Diversification Increases Agricultural Resilience to Adverse Growing Conditions in North America.* One Earth 2(3), 284–293. DOI 10.1016/j.oneear.2020.02.007 · [Notice](https://lter.kbs.msu.edu/citations/3830) | Rotation diversifiée : pertes en sécheresse réduites de 14 % à 90 % (11 sites É.-U. et Canada) | Score résilience, scénario « sec » |
| 7 | Lin, Y., Won, S., Taylor, M. (2026). *Impacts of Crop Rotation on Corn Yields and Production Risks: Evidence from Remote Sensing Data.* AAEA. [Notice](https://ideas.repec.org/p/ags/aaea26/404696.html) | La rotation réduit la variance du rendement | Score résilience |
| 8 | Seifert, C. A., Azzari, G., Lobell, D. B. (2018). *Satellite detection of cover crops and their effects on crop yield in the Midwestern United States.* Environmental Research Letters. [Résumé NASA Harvest](https://www.nasaharvest.org/news/new-stanford-research-on-satellite-detection-of-cover-crops-in-the-midwest) | Effet des cultures de couverture sur le rendement | Score sol, option trèfle |
| 9 | Deines et al. *Midwest Farmers Using Cover Crops Take Small Yield Hit.* [NASA Earth Observatory](https://earthobservatory.nasa.gov/images/150887/midwest-farmers-using-cover-crops-take-small-yield-hit?size=large) | Coût de rendement possible des couvertures | Compromis affiché |
| 10 | NASA DEVELOP (2024). *Alabama Agriculture : cover crops and soil water retention.* [Rapport](https://ntrs.nasa.gov/api/citations/20250002857/downloads/2024Fall_MSFC_AlabamaAg_TechPaper_FD-final.pdf) | Couvertures et rétention d'eau (Landsat, Sentinel, IMERG, NDVI) | Score eau et sol |
| 11 | Deines, J. M., Wang, S., Lobell, D. B. (2019). *Satellites reveal a small positive yield effect from conservation tillage across the US Corn Belt.* Environmental Research Letters 14(12). | Travail réduit du sol | Contexte |
| 12 | Volk, J. et al. (2024). *Assessing the accuracy of OpenET satellite-based evapotranspiration data.* Nature Water. DOI 10.1038/s44221-023-00181-7 · [Résumé NASA](https://science.nasa.gov/?p=1058754) | Erreur de ~10 à 20 % sur l'évapotranspiration des cultures annuelles | Incertitude du score eau |
| 13 | Wu, J. et al. (2022). *Assessing evapotranspiration observed from ECOSTRESS using flux measurements in agroecosystems.* Agricultural Water Management 269. | Validation d'ECOSTRESS sur 15 sites agricoles | Score eau |

## Données (prévues pour le hackathon)

| # | Source | Accès | Usage |
|---|---|---|---|
| D1 | [NASA POWER](https://power.larc.nasa.gov/docs/services/api/) | Aucun compte | Température, pluie, ensoleillement |
| D2 | GPM IMERG (`GPM_3IMERGDF`) | Compte Earthdata | Précipitations |
| D3 | SMAP (`SPL3SMP_E`) | Compte Earthdata | Humidité du sol |
| D4 | ECOSTRESS (`ECO_L3T_JET`) | Compte Earthdata | Évapotranspiration |
| D5 | HLS (`HLSL30`, `HLSS30`) | Compte Earthdata | NDVI |
| D6 | GRACE-FO Mascon | Compte Earthdata | Stockage d'eau (option) |
| D6b | NEX-GDDP-CMIP6 (NASA Earth Exchange) | Ouvert | Projections climatiques pour les horizons de 10 à 30 ans |
| D7 | SoilGrids | Ouvert | Texture et matière organique du sol |

[Créer un compte Earthdata](https://urs.earthdata.nasa.gov/users/new) · [Space Data Atlas, page Field Shift](https://spacedata.swapniltamse.com/challenges/field-shift-adapting-farms/) (site non officiel, utilisé pour repérer les jeux de données)

## Code, polices et ressources

| # | Source | Licence | Usage |
|---|---|---|---|
| R1 | [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts | SIL Open Font License | Police du texte |
| R2 | [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) via Google Fonts | SIL Open Font License | Police des titres |
| R3 | [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) via Google Fonts | SIL Open Font License | Police du code |
| R4 | Icônes SVG dessinées dans le style de [Lucide](https://lucide.dev) | ISC | Icônes de l'interface |

## Jugement et règles

- [NASA Space Apps 2026](https://www.spaceappschallenge.org/2026/)
- [Guide d'évaluation et des prix (édition 2024)](https://spaceappschallenge.org/resources/judging-awards-guide)
- [Guide de soumission (édition 2024)](https://spaceappschallenge.org/resources/project-submission-guide)

## Outils d'IA (journal)

| Date | Outil | Utilisé pour | Partie du projet | Vérifié par un humain ? |
|---|---|---|---|---|
| 2026-11-08 | Claude | Recherche d'études, architecture, maquettes, code de la v1 | Préparation, prototype | À compléter |
