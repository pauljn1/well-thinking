# ANALYSE - Partie Présentation & Aperçu

## Vue d'ensemble

La section **Présentation & Aperçu** (lignes 1280-1460) gère le mode lecture/présentation de l'application. C'est un système de **navigation interactive** qui permet de visualiser les slides en plein écran avec support des liens de navigation (navlinks).

---

## Architecture du Système

### Les 3 Modes de Navigation

Le système propose trois façons différentes de parcourir les slides :

**1. Navigation Linéaire (par défaut)**
- Les slides sont parcourues dans l'ordre séquentiel
- De la slide 1 à la slide N, une après l'autre

**2. Navigation par Chemin (avec connexions)**
- Le système suit les connexions définies dans l'arborescence
- Il construit un chemin logique entre les slides connectées

**3. Navigation Interactive (navlinks)**
- L'utilisateur choisit son propre parcours
- Il clique sur les boutons de navigation présents dans les slides

---

## État de la Présentation

```javascript
// Variables d'état global
state = {
    presentationPath: null,              // Chemin de navigation calculé
    presentationStep: 0,                 // Étape actuelle dans le chemin
    presentationCurrentSlideIndex: 0,    // Index réel de la slide affichée
    presentationHistory: []              // Historique pour le bouton "Retour"
}
```

**Point Important :** Le système utilise deux index différents :
- `presentationStep` : position dans le **chemin** de navigation
- `presentationCurrentSlideIndex` : **vrai index** de la slide dans le tableau global

---

## Flux d'Exécution

### 1. Démarrage de la Présentation

Lorsque l'utilisateur démarre la présentation, voici ce qui se passe :

```javascript
function startPresentation() {
    // Afficher le mode plein écran
    presentationMode.classList.add('active');
    
    // Construire le chemin de navigation
    state.presentationPath = buildPresentationPath();
    
    // Démarrer à la première slide
    state.presentationStep = 0;
    state.presentationCurrentSlideIndex = state.presentationPath[0];
    
    // Vider l'historique de navigation
    state.presentationHistory = [];
    
    // Cacher le bouton Retour (pas d'historique au départ)
    updatePresBackButtonVisibility();
    
    // Afficher la première slide
    renderPresentationSlide();
    
    // Activer les raccourcis clavier
    document.addEventListener('keydown', handlePresentationKeys);
}
```

**Déclencheurs :**
- Clic sur le bouton de présentation principal
- Démarrage depuis l'arborescence via `startPresentationFromTree()`

---

### 2. Construction du Chemin de Navigation

Cette fonction détermine l'ordre dans lequel les slides seront affichées :

```javascript
function buildPresentationPath() {
    // CAS 1 : Pas de connexions définies
    // Retourner un ordre séquentiel simple (0, 1, 2, 3...)
    if (!treeState.connections || treeState.connections.length === 0) {
        return state.slides.map((s, i) => i);
    }
    
    // CAS 2 : Des connexions existent
    const path = [];                      // Le chemin à construire
    const visited = new Set();            // Slides déjà visitées
    let currentSlideId = state.slides[0]?.id;  // Démarrer à la première slide
    
    // ALGORITHME DE PARCOURS
    // Suivre les connexions tant qu'on peut
    while (currentSlideId && !visited.has(currentSlideId)) {
        // Marquer cette slide comme visitée
        visited.add(currentSlideId);
        
        // Trouver l'index de cette slide
        const slideIndex = state.slides.findIndex(s => s.id === currentSlideId);
        if (slideIndex !== -1) {
            path.push(slideIndex);  // Ajouter au chemin
        }
        
        // Chercher la prochaine slide connectée
        const nextConnection = treeState.connections.find(c => c.from == currentSlideId);
        
        if (nextConnection) {
            currentSlideId = nextConnection.to;  // Continuer vers la prochaine
        } else {
            currentSlideId = null;  // Fin du chemin connecté
        }
    }
    
    // Ajouter les slides orphelines (non connectées) à la fin
    state.slides.forEach((slide, index) => {
        if (!visited.has(slide.id)) {
            path.push(index);
        }
    });
    
    // Retourner le chemin ou l'ordre séquentiel par défaut
    return path.length > 0 ? path : state.slides.map((s, i) => i);
}
```

**Logique de l'algorithme :**
1. Démarre toujours à la première slide (slides[0])
2. Suit les connexions une par une depuis l'arborescence
3. Évite les boucles infinies grâce au Set "visited"
4. Ajoute toutes les slides non visitées à la fin du chemin

---

### 3. Rendu de la Slide en Mode Présentation

Cette fonction affiche la slide courante en plein écran :

```javascript
function renderPresentationSlide() {
    // Récupérer l'index de la slide à afficher
    const slideIndex = state.presentationPath 
        ? state.presentationPath[state.presentationStep] 
        : state.presentationStep;
    
    // Récupérer les données de la slide
    const slide = state.slides[slideIndex];
    if (!slide) return;  // Sécurité : slide inexistante
    
    // IMPORTANT : Mettre à jour l'index réel de la slide affichée
    state.presentationCurrentSlideIndex = slideIndex;
    
    const container = document.getElementById('presentationSlide');
    
    // CALCUL DU SCALING RESPONSIVE
    // Pour s'adapter à toutes les tailles d'écran
    const scaleX = window.innerWidth / 960;      // Largeur de référence : 960px
    const scaleY = (window.innerHeight - 60) / 540;  // Hauteur de référence : 540px
    const scale = Math.min(scaleX, scaleY);      // Garder le ratio d'aspect
    
    // Générer le HTML de la slide
    let html = `<div class="presentation-slide-content" 
                     style="background:${slide.backgroundColor};
                            width:${960*scale}px;
                            height:${540*scale}px;">`;
    html += renderPresentationContent(slide, scale);
    html += '</div>';
    
    container.innerHTML = html;
    
    // FEATURE CLÉ : Rendre les liens de navigation cliquables
    container.querySelectorAll('.navlink-element').forEach(navElement => {
        navElement.style.cursor = 'pointer';
        
        navElement.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Récupérer l'ID de la slide cible
            const targetSlideId = parseInt(navElement.dataset.targetSlideId);
            
            if (targetSlideId) {
                // Sauvegarder la slide actuelle dans l'historique
                // pour permettre de revenir en arrière
                const current = state.slides[state.presentationCurrentSlideIndex];
                if (current) {
                    state.presentationHistory.push(current.id);
                }
                
                updatePresBackButtonVisibility();
                navigateToSlideById(targetSlideId);  // Aller vers la slide cible
            }
        });
    });
}
```

**Points clés :**
- Le scaling est calculé automatiquement pour s'adapter à l'écran
- Tous les éléments de la slide sont redimensionnés proportionnellement
- Les navlinks deviennent interactifs pour permettre la navigation

---

### 4. Rendu du Contenu avec Scaling

Cette fonction génère le HTML de tous les éléments de la slide :

```javascript
function renderPresentationContent(slide, scale = 1) {
    // Vérifier que la slide a des éléments
    if (!slide.elements || !Array.isArray(slide.elements)) return '';
    
    // Transformer chaque élément en HTML
    return slide.elements.map(elem => {
        // Calculer la position et taille avec le scaling
        const style = `position:absolute;
                       left:${elem.x * scale}px;
                       top:${elem.y * scale}px;
                       width:${elem.width * scale}px;
                       height:${elem.height * scale}px;`;
        
        // Générer le HTML selon le type d'élément
        switch(elem.type) {
            case 'text':
                // Calculer la taille de police avec le scaling
                const scaledFontSize = (elem.fontSize || 24) * scale;
                
                return `<div class="slide-element text-element" 
                             style="${style}
                                    font-family:${elem.fontFamily};
                                    font-size:${scaledFontSize}px;
                                    color:${elem.color};
                                    font-weight:${elem.bold ? 'bold' : 'normal'};
                                    font-style:${elem.italic ? 'italic' : 'normal'};
                                    text-decoration:${elem.underline ? 'underline' : 'none'};
                                    text-align:${elem.textAlign || 'left'};">
                            ${elem.content}
                        </div>`;
            
            case 'image':
                return `<div class="slide-element image-element" 
                             style="${style}">
                            <img src="${elem.src}" 
                                 alt="Image" 
                                 style="width:100%;height:100%;object-fit:contain;">
                        </div>`;
            
            case 'shape':
                return `<div class="slide-element shape-element" 
                             style="${style}">
                            ${renderShape(elem.shape, elem.color || '#7c3aed')}
                        </div>`;
            
            case 'navlink':
                // CRITICAL : Stocker l'ID de la slide cible dans data-target-slide-id
                const targetIndex = state.slides.findIndex(s => s.id === elem.targetSlideId);
                const targetLabel = targetIndex !== -1 ? `Slide ${targetIndex + 1}` : 'Non défini';
                const scaledNavFontSize = 14 * scale;
                
                return `<div class="slide-element navlink-element" 
                             data-target-slide-id="${elem.targetSlideId}"
                             style="${style}
                                    background-color:${elem.color};
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    color:white;
                                    font-size:${scaledNavFontSize}px;
                                    box-shadow:0 4px 15px rgba(0,0,0,0.1);
                                    border-radius:8px;
                                    cursor:pointer;
                                    transition:transform 0.2s, box-shadow 0.2s;" 
                             onmouseover="this.style.transform='scale(1.05)';
                                         this.style.boxShadow='0 6px 20px rgba(0,0,0,0.2)';" 
                             onmouseout="this.style.transform='scale(1)';
                                        this.style.boxShadow='0 4px 15px rgba(0,0,0,0.1)';">
                            <i class="fas fa-arrow-right" style="margin-right:5px"></i>
                            ${elem.label || targetLabel}
                        </div>`;
        }
        
        return '';  // Type d'élément inconnu
        
    }).join('');  // Joindre tous les éléments en une seule chaîne HTML
}
```

**Caractéristiques :**
- Chaque élément est positionné de manière absolue
- La taille de police et les dimensions sont multipliées par le facteur de scaling
- Les navlinks ont des effets de survol (hover) pour indiquer qu'ils sont cliquables
- L'attribut `data-target-slide-id` permet de stocker la destination du lien

---

## Système de Navigation

### A. Navigation par Navlink (Téléportation Directe)

Cette méthode permet de sauter directement à n'importe quelle slide :

```javascript
function navigateToSlideById(targetSlideId) {
    // Trouver l'index de la slide cible dans le tableau
    const targetSlideIndex = state.slides.findIndex(s => s.id === targetSlideId);
    
    // Vérifier que la slide existe
    if (targetSlideIndex === -1) return;
    
    // Afficher directement cette slide (ignore le chemin défini)
    renderPresentationSlideByIndex(targetSlideIndex);
}
```

**Fonctionnement :**
- Cherche la slide par son ID unique
- Affiche la slide immédiatement, sans suivre le chemin prédéfini
- Permet une navigation non-linéaire totalement libre

---

```javascript
function renderPresentationSlideByIndex(slideIndex) {
    const slide = state.slides[slideIndex];
    if (!slide) return;
    
    // Mettre à jour l'index de la slide actuellement affichée
    state.presentationCurrentSlideIndex = slideIndex;
    
    // Tenter de synchroniser avec le chemin prédéfini
    if (state.presentationPath) {
        const stepInPath = state.presentationPath.indexOf(slideIndex);
        if (stepInPath !== -1) {
            // Cette slide fait partie du chemin, mettre à jour le step
            state.presentationStep = stepInPath;
        }
        // Sinon, on ne touche pas au step (désynchronisation)
    }
    
    const container = document.getElementById('presentationSlide');
    container.innerHTML = ''; 
    
    // Calculer le scaling pour l'écran
    const scaleX = window.innerWidth / 960;
    const scaleY = (window.innerHeight - 60) / 540;
    const scale = Math.min(scaleX, scaleY);
    
    // Générer le HTML de la slide
    let html = `<div class="presentation-slide-content" 
                     style="background:${slide.backgroundColor};
                            width:${960*scale}px;
                            height:${540*scale}px;">`;
    html += renderPresentationContent(slide, scale);
    html += '</div>';
    
    container.innerHTML = html;
    
    // Rendre les navlinks cliquables
    container.querySelectorAll('.navlink-element').forEach(navElement => {
        navElement.style.cursor = 'pointer';
        
        navElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetSlideId = parseInt(navElement.dataset.targetSlideId);
            
            if (targetSlideId) {
                // Sauvegarder la slide actuelle dans l'historique
                const current = state.slides[state.presentationCurrentSlideIndex];
                if (current) {
                    state.presentationHistory.push(current.id);
                }
                
                updatePresBackButtonVisibility();
                navigateToSlideById(targetSlideId);
            }
        });
    });
}
```

**Point clé :** Cette fonction permet la "téléportation" - sauter n'importe où dans la présentation, même vers des slides qui ne sont pas dans le chemin prédéfini.

---

### B. Navigation Linéaire (Touches Fléchées)

Cette méthode permet d'avancer ou reculer d'une slide :

```javascript
function navigatePresentation(direction) {  // direction: +1 (suivant) ou -1 (précédent)
    // Utiliser l'index de la slide actuellement affichée
    const currentIndex = state.presentationCurrentSlideIndex;
    const newIndex = currentIndex + direction;
    
    // Vérifier qu'on ne sort pas des limites du tableau
    if (newIndex >= 0 && newIndex < state.slides.length) {
        
        // Tenter de synchroniser avec le chemin prédéfini
        if (state.presentationPath) {
            const stepInPath = state.presentationPath.indexOf(newIndex);
            if (stepInPath !== -1) {
                state.presentationStep = stepInPath;
            }
        } else {
            state.presentationStep = newIndex;
        }
        
        // Mettre à jour l'index et afficher la slide
        state.presentationCurrentSlideIndex = newIndex;
        renderPresentationSlideByIndex(newIndex);
    }
}
```

**Utilisation :**
- `navigatePresentation(1)` : aller à la slide suivante
- `navigatePresentation(-1)` : revenir à la slide précédente

---

### C. Système de Retour Arrière (Historique)

Ce système permet de revenir en arrière après avoir cliqué sur des navlinks :

```javascript
// Lors du clic sur un navlink (dans renderPresentationSlide)
// On sauvegarde la slide actuelle avant de sauter
state.presentationHistory.push(current.id);
updatePresBackButtonVisibility();
```

```javascript
// Fonction de retour en arrière
function presentationGoBack() {
    // Vérifier qu'il y a un historique
    if (!state.presentationHistory || state.presentationHistory.length === 0) {
        return;
    }
    
    // Récupérer la dernière slide visitée (dépiler)
    const lastSlideId = state.presentationHistory.pop();
    
    // Trouver l'index de cette slide
    const lastIndex = state.slides.findIndex(s => s.id === lastSlideId);
    
    // Afficher cette slide
    if (lastIndex !== -1) {
        renderPresentationSlideByIndex(lastIndex);
    }
    
    // Mettre à jour la visibilité du bouton
    updatePresBackButtonVisibility();
}
```

```javascript
// Gestion de la visibilité du bouton Retour
function updatePresBackButtonVisibility() {
    const btn = document.getElementById('presPrev');
    if (!btn) return;
    
    // Afficher le bouton seulement si l'historique n'est pas vide
    if (state.presentationHistory && state.presentationHistory.length > 0) {
        btn.style.display = '';  // Afficher
    } else {
        btn.style.display = 'none';  // Cacher
    }
}
```

**Fonctionnement du système d'historique :**
1. C'est une pile (stack) LIFO : Last In, First Out
2. Chaque clic sur un navlink = ajout de la slide actuelle dans la pile
3. Le bouton Retour = retrait du dernier élément et navigation vers cette slide
4. Le bouton n'est visible que si l'historique n'est pas vide

**Exemple de parcours :**
```
Utilisateur sur Slide 1
→ Clique navlink vers Slide 5
  Histoire = [1]
→ Clique navlink vers Slide 3
  Histoire = [1, 5]
→ Clique Retour
  Retour à Slide 5, Histoire = [1]
→ Clique Retour
  Retour à Slide 1, Histoire = []
```

---

## Raccourcis Clavier

```javascript
function handlePresentationKeys(e) {
    if (e.key === 'ArrowLeft') {
        // Flèche gauche : retour en arrière dans l'historique
        presentationGoBack();
        
    } else if (e.key === 'Escape') {
        // Touche Échap : sortir du mode présentation
        exitPresentation();
    }
}
```

**Raccourcis disponibles :**
- **Flèche Gauche** : Revenir à la slide précédente (selon l'historique)
- **Échap** : Quitter le mode présentation

---

## Sortie et Export

### Quitter le Mode Présentation

```javascript
function exitPresentation() {
    // Masquer l'overlay de présentation
    presentationMode.classList.remove('active');
    
    // Désactiver les raccourcis clavier
    document.removeEventListener('keydown', handlePresentationKeys);
    
    // Réinitialiser complètement l'état de la présentation
    state.presentationPath = null;
    state.presentationStep = 0;
    state.presentationCurrentSlideIndex = 0;
}
```

---

### Exporter la Présentation

```javascript
function exportPresentation() {
    // Convertir toutes les slides en JSON
    const data = JSON.stringify(state.slides, null, 2);
    
    // Créer un fichier Blob
    const blob = new Blob([data], {type:'application/json'});
    
    // Créer une URL temporaire
    const url = URL.createObjectURL(blob);
    
    // Créer un lien de téléchargement invisible
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation.json';
    
    // Déclencher le téléchargement
    a.click();
    
    // Nettoyer l'URL temporaire
    URL.revokeObjectURL(url);
}
```

**Résultat :** Un fichier JSON contenant toutes les données des slides est téléchargé.

---

## Schéma de Fonctionnement

```
┌─────────────────────────────────────────────────────────────┐
│                    DÉMARRAGE PRÉSENTATION                    │
│                 startPresentation()                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │  buildPresentationPath│
                │  ┌─────────────────┐  │
                │  │ Connexions OK?  │  │
                │  └────┬────────┬───┘  │
                │       │OUI     │NON   │
                │   ┌───▼──┐ ┌──▼───┐  │
                │   │Chemin│ │Ordre │  │
                │   │Graphe│ │Séquen│  │
                │   └──────┘ │tiel  │  │
                │            └──────┘  │
                └───────────┬───────────┘
                            │
                ┌───────────▼────────────┐
                │ renderPresentationSlide│
                │  ┌─────────────────┐   │
                │  │  Scaling        │   │
                │  │  Génération HTML│   │
                │  │  Event Listeners│   │
                │  └─────────────────┘   │
                └───────────┬────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ┌───▼────┐       ┌──────▼──────┐      ┌────▼─────┐
    │Navlink │       │  Flèches    │      │  Escape  │
    │  Clic  │       │  Clavier    │      │   Key    │
    └───┬────┘       └──────┬──────┘      └────┬─────┘
        │                   │                   │
┌───────▼──────────┐ ┌──────▼──────┐    ┌──────▼──────┐
│navigateToSlideById│ │navigatePresent│ │exitPresenta│
│ (Téléportation)   │ │(+1/-1)       │ │tion        │
└───────┬──────────┘ └──────┬──────┘    └────────────┘
        │                   │
        │  ┌────────────────▼───────────────────┐
        │  │   renderPresentationSlideByIndex   │
        │  │    (Mise à jour + Re-render)       │
        │  └────────────────────────────────────┘
        │
┌───────▼──────────┐
│ Historique       │
│ .push(currentId) │
└──────────────────┘
```

---

## Récapitulatif des Fonctions Clés

| Fonction | Rôle | Déclencheur |
|----------|------|-------------|
| `startPresentation()` | Initialiser le mode présentation | Bouton Présentation |
| `buildPresentationPath()` | Construire le chemin de navigation | Au démarrage |
| `renderPresentationSlide()` | Afficher la slide courante | À chaque changement de slide |
| `renderPresentationContent()` | Générer le HTML des éléments | Appelée par renderPresentationSlide |
| `navigateToSlideById()` | Aller directement à une slide (téléportation) | Clic sur navlink |
| `renderPresentationSlideByIndex()` | Afficher une slide par son index | Appelée par les fonctions de navigation |
| `navigatePresentation()` | Avancer/reculer d'une slide | Touches fléchées |
| `presentationGoBack()` | Retour arrière dans l'historique | Touche Flèche Gauche |
| `updatePresBackButtonVisibility()` | Afficher/masquer le bouton Retour | Après chaque navigation |
| `handlePresentationKeys()` | Gérer les raccourcis clavier | Appui sur une touche |
| `exitPresentation()` | Quitter le mode présentation | Touche Échap |
| `exportPresentation()` | Exporter au format JSON | Bouton Export |

---

## Différence entre les Variables d'État

**presentationStep** :
- Représente la position dans le chemin calculé
- Utilisé uniquement si un chemin a été construit via `buildPresentationPath()`
- Peut être désynchronisé si l'utilisateur utilise les navlinks

**presentationCurrentSlideIndex** :
- Représente toujours l'index réel de la slide affichée
- C'est la source de vérité principale
- Mis à jour à chaque changement de slide, quelle que soit la méthode de navigation

**Exemple de désynchronisation** :
```
Chemin calculé : [0, 2, 5, 3]
- presentationStep = 0 → presentationCurrentSlideIndex = 0 (slide 1)
- presentationStep = 1 → presentationCurrentSlideIndex = 2 (slide 3)
- Clic navlink vers slide 7 → presentationCurrentSlideIndex = 7
  (presentationStep reste à 1 car slide 7 n'est pas dans le chemin)
```

---

## Responsive Scaling

Le système utilise un algorithme de scaling intelligent pour s'adapter à tous les écrans :

```javascript
// Dimensions de référence de la slide
const REFERENCE_WIDTH = 960;
const REFERENCE_HEIGHT = 540;

// Taille disponible à l'écran
const availableWidth = window.innerWidth;
const availableHeight = window.innerHeight - 60;  // Moins la barre de navigation

// Calcul des ratios
const scaleX = availableWidth / REFERENCE_WIDTH;
const scaleY = availableHeight / REFERENCE_HEIGHT;

// Utiliser le plus petit ratio pour tout rentrer dans l'écran
const scale = Math.min(scaleX, scaleY);
```

**Résultat :**
- Sur un écran large (16:9), utilise toute la largeur
- Sur un écran étroit, utilise toute la hauteur
- Le ratio d'aspect est toujours préservé
- Pas de déformation des éléments