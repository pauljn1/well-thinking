# ANALYSE - Partie Arborescence Avancée

## Vue d'ensemble

La section **Arborescence Avancée** (lignes 918-1278) gère la visualisation et la manipulation d'un graphe interactif représentant les slides et leurs connexions. C'est un système de **cartographie visuelle** qui permet de voir et d'organiser l'ensemble du scénario dans une vue en plein écran.

---

## Architecture du Système

### Composants Principaux

Le système d'arborescence se compose de quatre éléments essentiels :

**1. Les Nœuds (Scenario Slide Cards)**
- Représentations visuelles miniatures de chaque slide
- Positionnables librement dans l'espace 2D
- Affichent un aperçu du contenu de la slide

**2. Les Connexions (SVG Paths)**
- Lignes courbes reliant les slides entre elles
- Générées automatiquement depuis les éléments navlink
- Colorées selon la couleur du navlink source

**3. Le Canevas Interactif (Tree Canvas)**
- Espace de travail infini avec scroll
- Supporte le zoom et le déplacement (pan)
- Gère les interactions souris

**4. Les Outils de Contrôle**
- Boutons de zoom (in/out/reset)
- Bouton d'ajout de slide
- Bouton de réorganisation automatique

---

## État de l'Arborescence

```javascript
let treeState = {
    connections: [],          // Liste des connexions entre slides
    zoom: 1,                  // Niveau de zoom (1 = 100%)
    
    // Variables pour le déplacement des nœuds
    isDraggingSlide: false,   // Indique si on déplace une slide
    currentDragSlide: null,   // Élément DOM de la slide en déplacement
    currentDragSlideId: null, // ID de la slide en déplacement
    startX: 0,                // Position X initiale du curseur
    startY: 0,                // Position Y initiale du curseur
    initialLeft: 0,           // Position left initiale de la slide
    initialTop: 0,            // Position top initiale de la slide
    
    // Variables pour le pan (déplacement de la vue)
    isPanning: false,         // Indique si on déplace la vue
    panStartX: 0,             // Position X de départ du pan
    panStartY: 0,             // Position Y de départ du pan
    panScrollLeft: 0,         // ScrollLeft initial du canvas
    panScrollTop: 0           // ScrollTop initial du canvas
};
```

**Structure d'une Connexion :**
```javascript
const connection = {
    id: 'navlink-conn-123',      // Identifiant unique
    from: 456,                    // ID de la slide source
    to: 789,                      // ID de la slide cible
    label: 'Choix A',             // Texte affiché sur la connexion
    color: '#cc6699',             // Couleur de la ligne
    fromNavLink: true,            // Indique si générée depuis un navlink
    navLinkId: 123                // ID du navlink source
};
```

---

## Flux d'Exécution

### 1. Ouverture de l'Arborescence

Lorsque l'utilisateur ouvre la vue arborescence en plein écran :

```javascript
function openTreeFullscreen() {
    // Afficher l'overlay plein écran
    document.getElementById('treeFullscreen').classList.add('active');
    
    // Synchroniser les connexions depuis les éléments navlink
    // IMPORTANT : Toujours fait avant d'afficher pour avoir les données à jour
    syncConnectionsFromNavLinks();
    
    // Réinitialiser le zoom à 100%
    treeState.zoom = 1;
    applyZoom();
    
    // Créer les cartes de slides et les positionner
    renderTreeNodes();
    
    // Dessiner les connexions SVG
    drawConnections();
    
    // Activer les gestionnaires d'événements
    setupScenarioEvents();
}
```

**Déclencheur :** Clic sur le bouton "Vue Arborescence"

---

### 2. Gestion des Événements

Le système utilise des gestionnaires d'événements globaux qui sont créés et supprimés dynamiquement :

```javascript
// Variables globales pour stocker les handlers
let scenarioMouseMoveHandler = null;
let scenarioMouseUpHandler = null;
let scenarioWheelHandler = null;
let scenarioMouseDownHandler = null;

function setupScenarioEvents() {
    // Créer les handlers
    scenarioMouseMoveHandler = handleScenarioMouseMove;
    scenarioMouseUpHandler = handleScenarioMouseUp;
    scenarioWheelHandler = handleScenarioWheel;
    scenarioMouseDownHandler = handleScenarioMouseDown;
    
    // Attacher les événements globaux
    document.addEventListener('mousemove', scenarioMouseMoveHandler);
    document.addEventListener('mouseup', scenarioMouseUpHandler);
    
    const treeCanvas = document.getElementById('treeCanvas');
    if (treeCanvas) {
        // Zoom avec Ctrl + molette
        treeCanvas.addEventListener('wheel', scenarioWheelHandler, { passive: false });
        
        // Pan avec clic sur le fond
        treeCanvas.addEventListener('mousedown', scenarioMouseDownHandler);
        
        // Changer le curseur pour indiquer la possibilité de pan
        treeCanvas.style.cursor = 'grab';
    }
}
```

**Pourquoi cette approche ?**
- Permet de supprimer proprement les événements lors de la fermeture
- Évite les fuites mémoire
- Permet de référencer les handlers pour les supprimer

```javascript
function cleanupScenarioEvents() {
    // Supprimer les événements globaux
    if (scenarioMouseMoveHandler) {
        document.removeEventListener('mousemove', scenarioMouseMoveHandler);
    }
    if (scenarioMouseUpHandler) {
        document.removeEventListener('mouseup', scenarioMouseUpHandler);
    }
    
    const treeCanvas = document.getElementById('treeCanvas');
    if (treeCanvas) {
        if (scenarioWheelHandler) {
            treeCanvas.removeEventListener('wheel', scenarioWheelHandler);
        }
        if (scenarioMouseDownHandler) {
            treeCanvas.removeEventListener('mousedown', scenarioMouseDownHandler);
        }
        treeCanvas.style.cursor = '';
    }
}
```

---

### 3. Rendu des Nœuds (Slides)

Création et positionnement des cartes représentant les slides :

```javascript
function renderTreeNodes() {
    const container = document.getElementById('treeNodes');
    if (!container) return;
    
    // Vider le conteneur
    container.innerHTML = '';
    
    // Parcourir toutes les slides
    state.slides.forEach((slide, index) => {
        // Initialiser la position si elle n'existe pas
        if (slide.treeX === null || slide.treeX === undefined) {
            // Calcul automatique d'une grille
            const cols = Math.ceil(Math.sqrt(state.slides.length * 1.5));
            slide.treeX = 100 + (index % cols) * 300;        // Espacement horizontal
            slide.treeY = 100 + Math.floor(index / cols) * 200;  // Espacement vertical
        }
        
        // Créer la carte de la slide
        const card = createScenarioSlideCard(slide, index);
        container.appendChild(card);
    });
}
```

**Logique de positionnement automatique :**
- Calcule le nombre de colonnes selon la racine carrée du nombre de slides
- Organise les slides en grille avec 300px d'espacement horizontal
- 200px d'espacement vertical entre les lignes

**Exemple avec 9 slides :**
```
cols = ceil(sqrt(9 * 1.5)) = ceil(3.67) = 4 colonnes

Slide 0: x=100, y=100
Slide 1: x=400, y=100
Slide 2: x=700, y=100
Slide 3: x=1000, y=100
Slide 4: x=100, y=300
...
```

---

### 4. Création d'une Carte de Slide

Génération du HTML et configuration des événements pour chaque slide :

```javascript
function createScenarioSlideCard(slide, index) {
    const card = document.createElement('div');
    const isCurrent = index === state.currentSlideIndex;
    
    // Classes CSS
    card.className = 'scenario-slide-card' + (isCurrent ? ' current' : '');
    
    // Attributs data pour l'identification
    card.dataset.slideId = slide.id;
    card.dataset.index = index;
    
    // Positionnement absolu
    card.style.left = slide.treeX + 'px';
    card.style.top = slide.treeY + 'px';
    
    // Générer l'aperçu du contenu
    const previewContent = generateScenarioPreview(slide);
    
    // Structure HTML de la carte
    card.innerHTML = `
        <div class="scenario-card-header">
            <span class="scenario-card-title">Slide ${index + 1}</span>
            <i class="fas fa-grip-lines scenario-handle"></i>
        </div>
        <div class="scenario-card-body">
            ${previewContent}
        </div>
    `;
    
    // Configurer les événements interactifs
    setupScenarioCardEvents(card, slide, index);
    
    return card;
}
```

**Éléments visuels :**
- En-tête avec numéro de slide et poignée de déplacement
- Corps avec aperçu miniature du contenu
- Classe "current" pour mettre en évidence la slide active

---

### 5. Génération de l'Aperçu

Création d'une miniature du contenu de la slide :

```javascript
function generateScenarioPreview(slide) {
    let html = '<div class="scenario-preview" style="background:' + slide.backgroundColor + ';">';
    
    // Afficher seulement les 4 premiers éléments pour éviter la surcharge
    slide.elements.slice(0, 4).forEach(elem => {
        // Facteur de réduction à 12% de la taille originale
        const scale = 0.12;
        
        // Position et taille scaled
        const style = `position:absolute;
                       left:${elem.x * scale}px;
                       top:${elem.y * scale}px;
                       width:${elem.width * scale}px;
                       height:${elem.height * scale}px;
                       overflow:hidden;`;
        
        switch(elem.type) {
            case 'text':
                // Réduire la taille de police, minimum 3px
                const fontSize = Math.max(3, elem.fontSize * scale);
                html += `<div style="${style}
                                     font-size:${fontSize}px;
                                     color:${elem.color};">
                            ${elem.content.substring(0, 20)}
                         </div>`;
                break;
                
            case 'image':
                html += `<div style="${style}">
                            <img src="${elem.src}" 
                                 style="width:100%;
                                        height:100%;
                                        object-fit:cover;
                                        border-radius:2px;">
                         </div>`;
                break;
                
            case 'shape':
                html += `<div style="${style}">
                            ${renderShape(elem.shape, elem.color || '#cc6699')}
                         </div>`;
                break;
        }
    });
    
    html += '</div>';
    return html;
}
```

**Optimisations :**
- Limite à 4 éléments pour la performance
- Scaling à 12% pour tenir dans la carte
- Tronque le texte à 20 caractères
- Taille de police minimale de 3px pour la lisibilité

---

## Interactions Utilisateur

### A. Déplacement d'une Slide (Drag & Drop)

Configuration des événements sur chaque carte :

```javascript
function setupScenarioCardEvents(card, slide, index) {
    const handle = card.querySelector('.scenario-handle');
    
    // Démarrer le drag par la poignée (icône grip-lines)
    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();  // Empêcher le pan du canvas
        
        // Activer l'état de drag
        treeState.isDraggingSlide = true;
        treeState.currentDragSlide = card;
        treeState.currentDragSlideId = slide.id;
        
        // Sauvegarder les positions initiales
        treeState.startX = e.clientX;
        treeState.startY = e.clientY;
        treeState.initialLeft = card.offsetLeft;
        treeState.initialTop = card.offsetTop;
        
        // Effets visuels
        card.style.zIndex = '100';         // Mettre au premier plan
        card.classList.add('dragging');     // Classe CSS pour le style
        document.body.style.cursor = 'grabbing';
    });
    
    // Double-clic pour éditer la slide
    card.addEventListener('dblclick', () => {
        state.currentSlideIndex = index;
        updateSlidesList();
        renderCurrentSlide();
        updateSlideCounter();
        closeTreeFullscreen();  // Fermer l'arborescence et retourner à l'éditeur
    });
    
    // Clic simple pour sélectionner
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.scenario-handle')) {
            // Désélectionner toutes les cartes
            document.querySelectorAll('.scenario-slide-card')
                .forEach(c => c.classList.remove('selected'));
            
            // Sélectionner cette carte
            card.classList.add('selected');
        }
    });
}
```

**Gestion du mouvement (dans handleScenarioMouseMove) :**

```javascript
if (treeState.isDraggingSlide && treeState.currentDragSlide) {
    e.preventDefault();
    
    // Compenser le zoom
    // Si zoom = 2x, un mouvement de 100px souris = 50px dans l'espace non-zoomé
    const zoom = treeState.zoom || 1;
    const dx = (e.clientX - treeState.startX) / zoom;
    const dy = (e.clientY - treeState.startY) / zoom;
    
    // Calculer la nouvelle position
    let newX = treeState.initialLeft + dx;
    let newY = treeState.initialTop + dy;
    
    // Limiter aux bords (minimum 20px du bord gauche/haut)
    newX = Math.max(20, newX);
    newY = Math.max(20, newY);
    
    // Appliquer visuellement
    treeState.currentDragSlide.style.left = newX + 'px';
    treeState.currentDragSlide.style.top = newY + 'px';
    
    // Mettre à jour les données de la slide
    const slideData = state.slides.find(s => s.id == treeState.currentDragSlideId);
    if (slideData) {
        slideData.treeX = newX;
        slideData.treeY = newY;
    }
    
    // Redessiner les connexions en temps réel
    drawConnections();
}
```

**Fin du drag (dans handleScenarioMouseUp) :**

```javascript
if (treeState.isDraggingSlide) {
    treeState.isDraggingSlide = false;
    
    if (treeState.currentDragSlide) {
        treeState.currentDragSlide.style.zIndex = '';
        treeState.currentDragSlide.classList.remove('dragging');
    }
    
    treeState.currentDragSlide = null;
    document.body.style.cursor = 'default';
    
    // Sauvegarder la nouvelle position
    saveProject();
}
```

---

### B. Pan (Déplacement de la Vue)

Permet de naviguer dans l'espace infini du canvas :

```javascript
function handleScenarioMouseDown(e) {
    const treeCanvas = document.getElementById('treeCanvas');
    
    // Ne pas démarrer le pan si on clique sur un élément interactif
    if (e.target.closest('.scenario-slide-card') || 
        e.target.closest('.tree-tool-btn')) {
        return;
    }
    
    // Démarrer le pan (clic gauche ou bouton molette)
    if (e.button === 0 || e.button === 1) {
        e.preventDefault();
        
        // Activer l'état de pan
        treeState.isPanning = true;
        
        // Sauvegarder les positions initiales
        treeState.panStartX = e.clientX;
        treeState.panStartY = e.clientY;
        treeState.panScrollLeft = treeCanvas.scrollLeft;
        treeState.panScrollTop = treeCanvas.scrollTop;
        
        // Changer le curseur
        treeCanvas.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
    }
}
```

**Gestion du mouvement (dans handleScenarioMouseMove) :**

```javascript
if (treeState.isPanning) {
    e.preventDefault();
    
    // Calculer le déplacement depuis le début du pan
    const dx = e.clientX - treeState.panStartX;
    const dy = e.clientY - treeState.panStartY;
    
    // Appliquer le déplacement inverse sur le scroll
    // (mouvement souris vers droite = scroll vers gauche)
    canvas.scrollLeft = treeState.panScrollLeft - dx;
    canvas.scrollTop = treeState.panScrollTop - dy;
    
    return;  // Empêcher le traitement d'autres interactions
}
```

**Fin du pan (dans handleScenarioMouseUp) :**

```javascript
if (treeState.isPanning) {
    treeState.isPanning = false;
    document.body.style.cursor = 'default';
    
    const canvas = document.getElementById('treeCanvas');
    if (canvas) canvas.style.cursor = 'grab';
}
```

---

### C. Zoom

Système de zoom avec la molette de la souris :

```javascript
function handleScenarioWheel(e) {
    // Zoom seulement si Ctrl est enfoncé
    if (e.ctrlKey) {
        e.preventDefault();  // Empêcher le zoom du navigateur
        
        // Déterminer la direction
        const delta = e.deltaY > 0 ? -0.1 : 0.1;  // Molette bas = zoom out
        
        zoomTree(delta);
    }
}

function zoomTree(delta) {
    // Calculer le nouveau niveau de zoom
    // Limité entre 30% et 200%
    treeState.zoom = Math.min(2, Math.max(0.3, treeState.zoom + delta));
    
    // Appliquer visuellement
    applyZoom();
}

function applyZoom() {
    const treeNodes = document.getElementById('treeNodes');
    const treeSvg = document.getElementById('treeSvg');
    const zoomLabel = document.getElementById('zoomLevel');
    
    if (treeNodes) {
        // Appliquer le transform scale
        treeNodes.style.transform = `scale(${treeState.zoom})`;
        treeNodes.style.transformOrigin = 'top left';  // Point fixe en haut à gauche
    }
    
    if (treeSvg) {
        // Zoomer aussi le SVG des connexions
        treeSvg.style.transform = `scale(${treeState.zoom})`;
        treeSvg.style.transformOrigin = 'top left';
    }
    
    if (zoomLabel) {
        // Afficher le pourcentage
        zoomLabel.textContent = Math.round(treeState.zoom * 100) + '%';
    }
}
```

**Boutons de zoom :**

```javascript
// Zoom In (bouton +)
document.getElementById('zoomInBtn')?.addEventListener('click', () => zoomTree(0.1));

// Zoom Out (bouton -)
document.getElementById('zoomOutBtn')?.addEventListener('click', () => zoomTree(-0.1));

// Reset (bouton 100%)
document.getElementById('zoomResetBtn')?.addEventListener('click', resetZoom);

function resetZoom() {
    treeState.zoom = 1;
    applyZoom();
}
```

---

## Synchronisation des Connexions

### Génération Automatique depuis les Navlinks

La fonction clé qui crée les connexions à partir des éléments de type navlink :

```javascript
function syncConnectionsFromNavLinks() {
    // Parcourir toutes les slides
    state.slides.forEach(slide => {
        // Filtrer les éléments navlink qui ont une cible définie
        const navlinks = slide.elements.filter(el => 
            el.type === 'navlink' && el.targetSlideId
        );
        
        navlinks.forEach(navlink => {
            const fromId = slide.id;
            const toId = navlink.targetSlideId;
            
            // Vérifier si une connexion existe déjà pour ce navlink
            const existingIndex = treeState.connections.findIndex(c => 
                c.from == fromId && 
                c.to == toId && 
                c.navLinkId == navlink.id
            );
            
            if (existingIndex !== -1) {
                // MISE À JOUR : La connexion existe, mettre à jour ses propriétés
                treeState.connections[existingIndex].color = navlink.color || '#cc6699';
                treeState.connections[existingIndex].label = navlink.label || '';
            } 
            else if (fromId != toId) {
                // CRÉATION : Nouvelle connexion
                const connection = {
                    id: `navlink-conn-${navlink.id}`,
                    from: fromId,
                    to: toId,
                    label: navlink.label || '',
                    color: navlink.color || '#cc6699',
                    fromNavLink: true,          // Marqueur important
                    navLinkId: navlink.id       // Référence au navlink source
                };
                treeState.connections.push(connection);
            }
            // Note : On ignore les navlinks qui pointent vers eux-mêmes (fromId == toId)
        });
    });
    
    // Redessiner si l'arborescence est ouverte
    if (document.getElementById('treeFullscreen')?.classList.contains('active')) {
        drawConnections();
    }
}
```

**Quand cette fonction est appelée :**
- À l'ouverture de l'arborescence
- Lors de l'ajout d'un navlink
- Lors de la modification d'un navlink (cible, couleur, label)

---

### Suppression de Connexion

```javascript
function removeNavLinkConnection(slideId, targetSlideId) {
    // Filtrer les connexions pour retirer celle qui correspond
    treeState.connections = treeState.connections.filter(c => 
        !(c.from == slideId && 
          c.to == targetSlideId && 
          c.fromNavLink)  // Seulement les connexions auto-générées
    );
    
    // Redessiner si l'arborescence est ouverte
    if (document.getElementById('treeFullscreen')?.classList.contains('active')) {
        drawConnections();
    }
}
```

**Quand cette fonction est appelée :**
- Lors de la suppression d'un élément navlink
- Lors du changement de cible d'un navlink

---

## Dessin des Connexions SVG

La fonction la plus complexe du système, qui dessine toutes les connexions :

```javascript
function drawConnections() {
    const svg = document.getElementById('treeSvg');
    if (!svg) return;
    
    // Vider complètement le SVG
    svg.innerHTML = '';
    
    // Créer l'élément <defs> pour les définitions réutilisables
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    // Définir les filtres SVG
    let defsContent = `
        <filter id="arrow-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
        <filter id="arrow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
    `;
    
    // Créer un marqueur de flèche pour chaque couleur utilisée
    const usedColors = new Set();
    treeState.connections.forEach(conn => {
        const color = conn.color || '#cc6699';
        usedColors.add(color);
    });
    
    usedColors.forEach(color => {
        const colorId = color.replace('#', '');  // Supprimer le # pour l'ID
        defsContent += `
            <marker id="arrowhead-${colorId}" 
                    markerWidth="12" 
                    markerHeight="8" 
                    refX="10" 
                    refY="4" 
                    orient="auto" 
                    markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 12 4 L 0 8 L 2 4 Z" fill="${color}"/>
            </marker>
        `;
    });
    
    defs.innerHTML = defsContent;
    svg.appendChild(defs);
    
    // Dessiner chaque connexion
    treeState.connections.forEach((conn, index) => {
        drawSingleConnection(svg, conn);
    });
}
```

### Dessin d'une Connexion Individuelle

```javascript
function drawSingleConnection(svg, conn) {
    // Récupérer les données des slides
    const fromSlide = state.slides.find(s => s.id == conn.from);
    const toSlide = state.slides.find(s => s.id == conn.to);
    
    if (!fromSlide || !toSlide) return;  // Slides supprimées
    
    // Dimensions des cartes (définies dans le CSS)
    const cardWidth = 260;
    const cardHeight = 150;
    
    // Positions des cartes (coordonnées non-zoomées)
    const fromX = fromSlide.treeX;
    const fromY = fromSlide.treeY;
    const toX = toSlide.treeX;
    const toY = toSlide.treeY;
    
    // Calculer les centres
    const fromCenterX = fromX + cardWidth / 2;
    const fromCenterY = fromY + cardHeight / 2;
    const toCenterX = toX + cardWidth / 2;
    const toCenterY = toY + cardHeight / 2;
    
    // Calculer la différence
    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;
    
    // Calculer les bords des cartes
    const fromLeft = fromX;
    const fromRight = fromX + cardWidth;
    const fromTop = fromY;
    const fromBottom = fromY + cardHeight;
    
    const toLeft = toX;
    const toRight = toX + cardWidth;
    const toTop = toY;
    const toBottom = toY + cardHeight;
    
    // Déterminer les points de départ et d'arrivée selon la direction
    let x1, y1, x2, y2;
    let exitSide, entrySide;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        // Connexion principalement HORIZONTALE
        if (dx > 0) {
            // Cible à DROITE
            x1 = fromRight;
            y1 = fromCenterY;
            x2 = toLeft;
            y2 = toCenterY;
            exitSide = 'right';
            entrySide = 'left';
        } else {
            // Cible à GAUCHE
            x1 = fromLeft;
            y1 = fromCenterY;
            x2 = toRight;
            y2 = toCenterY;
            exitSide = 'left';
            entrySide = 'right';
        }
    } else {
        // Connexion principalement VERTICALE
        if (dy > 0) {
            // Cible en BAS
            x1 = fromCenterX;
            y1 = fromBottom;
            x2 = toCenterX;
            y2 = toTop;
            exitSide = 'bottom';
            entrySide = 'top';
        } else {
            // Cible en HAUT
            x1 = fromCenterX;
            y1 = fromTop;
            x2 = toCenterX;
            y2 = toBottom;
            exitSide = 'top';
            entrySide = 'bottom';
        }
    }
    
    // Calculer les points de contrôle pour une courbe de Bézier cubique
    const curveStrength = Math.min(Math.abs(dx), Math.abs(dy), 80) + 40;
    
    let cp1x, cp1y, cp2x, cp2y;
    
    // Point de contrôle 1 (sortie)
    if (exitSide === 'right') {
        cp1x = x1 + curveStrength;
        cp1y = y1;
    } else if (exitSide === 'left') {
        cp1x = x1 - curveStrength;
        cp1y = y1;
    } else if (exitSide === 'bottom') {
        cp1x = x1;
        cp1y = y1 + curveStrength;
    } else { // top
        cp1x = x1;
        cp1y = y1 - curveStrength;
    }
    
    // Point de contrôle 2 (entrée)
    if (entrySide === 'left') {
        cp2x = x2 - curveStrength;
        cp2y = y2;
    } else if (entrySide === 'right') {
        cp2x = x2 + curveStrength;
        cp2y = y2;
    } else if (entrySide === 'top') {
        cp2x = x2;
        cp2y = y2 - curveStrength;
    } else { // bottom
        cp2x = x2;
        cp2y = y2 + curveStrength;
    }
    
    // Construire le chemin SVG (courbe de Bézier cubique)
    const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    
    // Créer un groupe pour cette connexion
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('connection-group');
    group.dataset.connectionId = conn.id;
    
    const connColor = conn.color || '#cc6699';
    const colorId = connColor.replace('#', '');
    
    // Ligne d'arrière-plan (effet glow)
    const pathBg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathBg.setAttribute('d', d);
    pathBg.setAttribute('stroke', connColor);
    pathBg.setAttribute('stroke-width', '10');
    pathBg.setAttribute('fill', 'none');
    pathBg.setAttribute('stroke-linecap', 'round');
    pathBg.setAttribute('opacity', '0.15');
    pathBg.classList.add('connection-bg');
    group.appendChild(pathBg);
    
    // Ligne principale
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', connColor);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('marker-end', `url(#arrowhead-${colorId})`);
    path.classList.add('scenario-connection-line');
    
    if (conn.fromNavLink) {
        path.classList.add('navlink-connection');
    }
    
    group.appendChild(path);
    
    // Ajouter un label si présent
    if (conn.label) {
        // Calculer le point milieu de la courbe (formule de Bézier à t=0.5)
        const t = 0.5;
        const midX = Math.pow(1-t, 3) * x1 + 
                     3 * Math.pow(1-t, 2) * t * cp1x + 
                     3 * (1-t) * Math.pow(t, 2) * cp2x + 
                     Math.pow(t, 3) * x2;
        const midY = Math.pow(1-t, 3) * y1 + 
                     3 * Math.pow(1-t, 2) * t * cp1y + 
                     3 * (1-t) * Math.pow(t, 2) * cp2y + 
                     Math.pow(t, 3) * y2 - 12;  // -12 pour centrer verticalement
        
        // Fond du label (rectangle arrondi)
        const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const textLength = conn.label.length * 7 + 16;  // Estimation de la largeur
        labelBg.setAttribute('x', midX - textLength / 2);
        labelBg.setAttribute('y', midY - 10);
        labelBg.setAttribute('width', textLength);
        labelBg.setAttribute('height', '20');
        labelBg.setAttribute('rx', '10');
        labelBg.setAttribute('ry', '10');
        labelBg.setAttribute('fill', connColor);
        labelBg.setAttribute('opacity', '0.9');
        labelBg.classList.add('connection-label-bg');
        group.appendChild(labelBg);
        
        // Texte du label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', midX);
        label.setAttribute('y', midY + 4);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', 'white');
        label.setAttribute('font-size', '11');
        label.setAttribute('font-weight', '600');
        label.setAttribute('font-family', 'Inter, Segoe UI, sans-serif');
        label.textContent = conn.label;
        label.classList.add('connection-label');
        group.appendChild(label);
    }
    
    svg.appendChild(group);
}
```

**Points clés du dessin :**
1. Détection intelligente du côté de sortie et d'entrée
2. Courbes de Bézier pour un rendu élégant
3. Double ligne (fond + principale) pour l'effet glow
4. Marqueurs de flèche dynamiques par couleur
5. Labels positionnés au milieu de la courbe

---

## Outils Supplémentaires

### Ajouter une Slide depuis l'Arborescence

```javascript
function addSlideFromTree() {
    // Ajouter une slide normale
    addSlide();
    
    // Récupérer les références
    const lastSlide = state.slides[state.slides.length - 2];  // Avant-dernière
    const newSlide = state.slides[state.slides.length - 1];   // Dernière (nouvelle)
    
    // Positionner à côté de la dernière slide si elle existe
    if (lastSlide && lastSlide.treeX !== undefined) {
        newSlide.treeX = lastSlide.treeX + 300;  // 300px à droite
        newSlide.treeY = lastSlide.treeY;        // Même hauteur
    }
    
    // Rafraîchir l'affichage
    renderTreeNodes();
    drawConnections();
    saveProject();
}
```

---

### Réorganiser Automatiquement

```javascript
function resetTreeLayout() {
    // Calculer le nombre de colonnes optimal
    const cols = Math.ceil(Math.sqrt(state.slides.length * 1.5));
    
    // Repositionner toutes les slides en grille
    state.slides.forEach((slide, index) => {
        slide.treeX = 100 + (index % cols) * 300;
        slide.treeY = 100 + Math.floor(index / cols) * 200;
    });
    
    // Rafraîchir l'affichage
    renderTreeNodes();
    drawConnections();
    saveProject();
}
```

**Utilité :** Réorganise toutes les slides en grille propre, utile quand l'arborescence devient désordonnée.

---

## Schéma de Fonctionnement

```
┌─────────────────────────────────────────────────────────┐
│              OUVERTURE ARBORESCENCE                      │
│              openTreeFullscreen()                        │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────▼──────────┐
        │ syncConnectionsFromNavLinks │
        │  (Génération auto des      │
        │   connexions)              │
        └───────────┬──────────┘
                    │
        ┌───────────▼──────────┐
        │   renderTreeNodes()  │
        │   ┌──────────────┐   │
        │   │Positionner   │   │
        │   │Créer cartes  │   │
        │   │Aperçus       │   │
        │   └──────────────┘   │
        └───────────┬──────────┘
                    │
        ┌───────────▼──────────┐
        │   drawConnections()  │
        │   ┌──────────────┐   │
        │   │Calcul points │   │
        │   │Courbes Bézier│   │
        │   │SVG + Labels  │   │
        │   └──────────────┘   │
        └───────────┬──────────┘
                    │
        ┌───────────▼──────────┐
        │ setupScenarioEvents()│
        │   ┌──────────────┐   │
        │   │Drag slides   │   │
        │   │Pan canvas    │   │
        │   │Zoom          │   │
        │   └──────────────┘   │
        └──────────────────────┘

INTERACTIONS UTILISATEUR:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Drag Poignée │  │  Pan Canvas  │  │ Ctrl+Molette │
│   (souris)   │  │ (clic fond)  │  │    (zoom)    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│handleScenario│  │handleScenario│  │handleScenario│
│MouseMove     │  │MouseMove     │  │Wheel         │
│ (déplace)    │  │ (scroll)     │  │ (scale)      │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│Mise à jour   │  │Mise à jour   │  │applyZoom()   │
│position slide│  │scroll canvas │  │transform:    │
│drawConnections│  │             │  │scale()       │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Récapitulatif des Fonctions Clés

| Fonction | Rôle | Complexité |
|----------|------|------------|
| `openTreeFullscreen()` | Ouvrir la vue arborescence | Simple |
| `closeTreeFullscreen()` | Fermer et nettoyer | Simple |
| `setupScenarioEvents()` | Attacher les événements | Moyen |
| `cleanupScenarioEvents()` | Détacher les événements | Simple |
| `renderTreeNodes()` | Créer toutes les cartes de slides | Moyen |
| `createScenarioSlideCard()` | Créer une carte individuelle | Moyen |
| `generateScenarioPreview()` | Générer l'aperçu miniature | Moyen |
| `setupScenarioCardEvents()` | Configurer les interactions carte | Moyen |
| `handleScenarioMouseMove()` | Gérer drag et pan | Complexe |
| `handleScenarioMouseUp()` | Fin drag/pan | Simple |
| `handleScenarioMouseDown()` | Démarrer pan | Simple |
| `handleScenarioWheel()` | Gérer le zoom | Simple |
| `zoomTree()` | Calculer nouveau zoom | Simple |
| `applyZoom()` | Appliquer transform scale | Simple |
| `syncConnectionsFromNavLinks()` | Générer connexions auto | Complexe |
| `removeNavLinkConnection()` | Supprimer connexion | Simple |
| `drawConnections()` | Dessiner toutes les connexions | Très complexe |
| `addSlideFromTree()` | Ajouter slide depuis arborescence | Simple |
| `resetTreeLayout()` | Réorganiser en grille | Simple |

---

## Gestion du Zoom et Compensation

Le système de zoom est particulièrement intelligent car il compense automatiquement :

**Sans compensation :**
- Zoom 200% → mouvement souris de 100px = déplacement de 200px (trop rapide)

**Avec compensation :**
```javascript
const zoom = treeState.zoom || 1;
const dx = (e.clientX - treeState.startX) / zoom;
const dy = (e.clientY - treeState.startY) / zoom;
```
- Zoom 200% → mouvement souris de 100px ÷ 2 = déplacement de 50px (correct)

**Résultat :** La vitesse de déplacement des slides reste constante quel que soit le niveau de zoom.

---

## Courbes de Bézier Expliquées

Une courbe de Bézier cubique nécessite 4 points :
- P0 (x1, y1) : Point de départ
- P1 (cp1x, cp1y) : Premier point de contrôle
- P2 (cp2x, cp2y) : Deuxième point de contrôle
- P3 (x2, y2) : Point d'arrivée

**Formule mathématique (pas dans le code) :**
```
B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
avec t ∈ [0, 1]
```

**En SVG (utilisé dans le code) :**
```svg
<path d="M x1 y1 C cp1x cp1y, cp2x cp2y, x2 y2" />
```

**Calcul des points de contrôle :**
- Sortent perpendiculairement du côté de la carte (right/left/top/bottom)
- Distance contrôlée par `curveStrength`
- Adaptée à la distance entre les cartes

**Résultat :** Des connexions qui contournent élégamment les cartes.

---

## Optimisations et Performance

**1. Limitation des aperçus :**
```javascript
slide.elements.slice(0, 4)  // Maximum 4 éléments par aperçu
```

**2. Génération dynamique des marqueurs :**
```javascript
const usedColors = new Set();  // Seulement les couleurs utilisées
```

**3. Événements délégués :**
- Un seul handler global `mousemove` au lieu d'un par carte

**4. Coordonnées dans l'espace non-zoomé :**
- Les calculs utilisent `slide.treeX/treeY` (coordonnées réelles)
- Le zoom est appliqué via CSS `transform: scale()`
- Évite les recalculs lors du zoom

**5. Redessinage sélectif :**
```javascript
if (document.getElementById('treeFullscreen')?.classList.contains('active')) {
    drawConnections();  // Seulement si l'arborescence est visible
}
```