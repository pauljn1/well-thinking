
# Analyse du fichier js/script.js

Ce document présente un découpage des grandes parties de `js/script.js` (≈1732 lignes) et un résumé fonctionnel de chaque section.

Sommaire
- 1. Imports & Configuration
- 2. Démarrage & Cloud
- 3. Événements (bindings UI / clavier / souris)
- 4. Logique métier (historique, navigation de slides, rendu éditeur)
- 5. Outils d’édition (création d’éléments)
- 6. Propriétés & Manipulation (panneau de propriétés, drag/resize, interactions canvas)
- 7. Arborescence avancée (vue scénario, zoom/pan, connexions)
- 8. Présentation & Aperçu (mode lecture)

Note: Les numéros de lignes indiqués sont approximatifs (repères principaux).

---

1. Imports & Configuration (~1-63)
- Importe les fonctions cloud: `sauvegarderProjet`, `chargerProjet`, `surveillerSession` (depuis `database.js`).
- Déclare l’état global `state` (slides, sélection, flags d’interaction, état de présentation) avec une slide par défaut pour éviter les erreurs au démarrage.
- Déclare l’état d’arborescence `treeState` (connexions, zoom, variables de drag de nœuds et pan de vue).
- Pile d’historique `history` pour undo/redo.
- Références DOM de l’éditeur (canvas, liste des slides, modales, conteneurs, etc.).

2. Démarrage & Cloud (~64-156)
- `DOMContentLoaded`: initialise les écouteurs (`setupEventListeners`), rend la slide courante, met à jour la liste des slides.
- `surveillerSession` (Firebase/Cloud): charge le projet si l’utilisateur est connecté (`loadProjectFromCloud`).
- `loadProjectFromCloud`:
  - Récupère le nom de projet courant (localStorage).
  - Charge via `chargerProjet`, restaure slides, index courant et `treeState.connections`.
  - À défaut, conserve une slide par défaut et réinitialise les connexions.
  - Synchronise les connexions depuis les navlinks (`syncConnectionsFromNavLinks`), rafraîchit l’UI et pousse un snapshot dans l’historique.
- `saveProject`: sérialise l’état (slides, connexions, index courant, version, timestamp) et appelle `sauvegarderProjet`; fournit un feedback visuel sur le bouton de sauvegarde.

3. Événements (~158-282)
- `setupEventListeners` attache les handlers UI:
  - Sauvegarde (saveBtn), outils du panneau droit (ajout texte/image/forme/navlink), menu d’ajout de slide via templates.
  - Navigation (précédent/suivant + flèches du canvas), bascule de vues (liste, arborescence plein écran), outils arbo (ajout slide, reset layout), zoom (in/out/reset).
  - Aperçu scénario (preview depuis l’arborescence), boutons de présentation (start/exit/prev/next), export (bouton export, fonction correspondante dans le script).
  - Événements souris sur le canvas (mousedown/click), écouteurs globaux pour `mousemove`/`mouseup`.
  - Fermeture des modales (shape/image) par clic en dehors, raccourcis clavier (Ctrl+Z/Y).

4. Logique métier (~283-476)
- Historique: `saveToHistory`, `undo`, `redo`, `restoreFromHistory` (snapshot slides + index courant; ré-affichage complet et sauvegarde après restauration).
- Gestion des slides: ajouter/supprimer/sélectionner, navigation précédente/suivante, mise à jour du compteur et de l’état des boutons.
- Rendu éditeur:
  - `updateSlidesList`: génère les vignettes avec miniature de slide et bouton supprimer.
  - `renderCurrentSlide`: peint la slide courante dans le canvas avec sélection et events d’éléments.
  - `renderSlideContent`: HTML des éléments (texte/image/forme/navlink), avec poignées de redimensionnement lorsque sélectionné.
  - Helpers: `renderShape`, `findElementById`, `getSlideTitle`.

5. Outils d’édition (~477-556)
- Création d’éléments:
  - `addTextElement`, `addShapeElement`, `addImageElement`, `addNavLinkElement`.
  - L’ajout d’un navlink synchronise aussi l’arborescence via `syncConnectionsFromNavLinks`.
  - Upload d’image via FileReader (`handleImageUpload`) et ajout par URL (`addImageFromUrl`).

6. Propriétés & Manipulation (~557-895+)
- `showElementProperties`/`hideElementProperties`: affichage conditionnel des champs du panneau selon le type (texte, navlink, forme…).
- Mise à jour des propriétés (ex.: texte, alignement, style gras/italique/souligné, couleurs, rotation des formes, libellé/couleur des navlinks, cible de navlink, etc.).
- Sélection et édition de texte inline (bascules entre état d’édition et de sélection, protection contre rendu pendant l’édition).
- Gestion du drag & resize:
  - `setupElementEvents` rattache les handlers à chaque élément.
  - `handleMouseMove`/`handleMouseUp` gèrent les déplacements et redimensionnements en maintenant les contraintes; sauvegarde à la fin du geste.
  - `handleCanvasClick`/`handleCanvasMouseDown` désélectionnent lorsqu’on clique sur le fond.

7. Arborescence avancée (~896-1514)
- Plein écran: `openTreeFullscreen`/`closeTreeFullscreen` + gestion centralisée des écouteurs `setupScenarioEvents`/`cleanupScenarioEvents`.
- Pan & Zoom:
  - Pan via `handleScenarioMouseDown`/`handleScenarioMouseMove`/`handleScenarioMouseUp` (cursor grab/grabbing, scroll du conteneur).
  - Zoom avec la molette (Ctrl+wheel) via `handleScenarioWheel`, `zoomTree(delta)`, `applyZoom()`, `resetZoom()`.
- Rendu des nœuds: `renderTreeNodes` génère une carte par slide avec aperçu (`createScenarioSlideCard`, `generateScenarioPreview`).
- Interactions des cartes: drag par poignée pour repositionner (mise à jour `treeX/treeY`), double-clic pour ouvrir la slide dans l’éditeur, simple clic pour sélectionner.
- Connexions (liens entre slides):
  - `syncConnectionsFromNavLinks`: construit/actualise `treeState.connections` à partir des navlinks (couleur/label hérités du navlink), suppression via `removeNavLinkConnection`.
  - `drawConnections`: dessine les flèches entre cartes dans un `<svg>` avec marqueurs par couleur, labels, ombres/halo.
  - Helpers géométriques pour calculer points d’ancrage, segments, courbes (dans la même section).
- Actions arborescence: `addSlideFromTree` (ajout d’une slide voisine), `resetTreeLayout` (grille automatique).

8. Présentation & Aperçu (mode lecture) (~1515-fin)
- Entrée depuis l’arborescence: `startPresentationFromTree`.
- Démarrage: `startPresentation` calcule le chemin (`buildPresentationPath`) depuis les connexions; positionne le step et l’index courant.
- Rendu slide de présentation: `renderPresentationSlide` + `renderPresentationContent` (mise à l’échelle à la taille fenêtre; navlinks cliquables avec hover).
- Navigation:
  - `navigateToSlideById` (téléportation lors d’un clic navlink), `renderPresentationSlideByIndex` (rendu direct par index), `navigatePresentation` (prev/next en se basant sur l’index courant), `handlePresentationKeys` (flèches / Échap pour quitter).
- Sortie: `exitPresentation` nettoie les écouteurs et réinitialise l’état de présentation.

Flux global (résumé)
- Au chargement, l’UI est prête immédiatement avec une slide par défaut. Après authentification, on charge le projet cloud; on synchronise les connexions depuis les navlinks; l’éditeur et la liste de slides sont rafraîchis.
- L’utilisateur édite des slides via le canvas (drag/resize, édition de texte), manipule les propriétés à droite, et ajoute divers éléments. Les modifications sont historisées (Ctrl+Z/Ctrl+Y) et sauvegardées.
- La vue « Arborescence » affiche les slides comme des nœuds reliés automatiquement par les navlinks; elle supporte le pan/zoom et le repositionnement des nœuds.
- Le mode « Présentation » affiche les slides en plein écran, permet la navigation séquentielle et via navlinks cliquables.

Points notables
- Les connexions de l’arborescence sont dérivées des éléments navlink (couleur/label synchronisés), limitant la duplication de sources de vérité.
- Le rendu est centralisé (éditeur vs présentation) avec deux fonctions dédiées (`renderSlideContent` vs `renderPresentationContent`).
- Des garde-fous évitent les rendus pendant l’édition de texte et empêchent la suppression de la dernière slide.

Fin du document.