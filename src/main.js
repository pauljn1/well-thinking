/* =========================================
   VARIABLES GLOBALES
========================================= */
const canvas = document.getElementById("canvas-container");
const svgLayer = document.getElementById("svg-layer");
let slideCount = 0;
let selectedSlide = null;

// Gestion du Drag & Drop des slides
let isDraggingSlide = false;
let startX, startY, initialLeft, initialTop;

// Gestion des Connexions (Lignes)
let isDrawingLine = false;
let tempLine = null; // La ligne qu'on est en train de tirer
let startSocket = null; // D'où part la ligne
let connections = []; // Stocke { id: "link-1", from: "slide-1", to: "slide-2", label: "Choix 1" }

/* =========================================
   1. CRÉATION DES SLIDES
========================================= */
function createSlide(x = 150, y = 150) {
    slideCount++;
    const slideId = `slide-${Date.now()}`; // ID unique basé sur l'heure

    const div = document.createElement("div");
    div.classList.add("slide");
    div.id = slideId; // On donne l'ID au HTML
    div.style.left = x + "px";
    div.style.top = y + "px";

    div.innerHTML = `
        <div class="slide-header">
            <span contenteditable="true">Slide ${slideCount}</span>
            <i class="fa-solid fa-grip-lines handle"></i>
        </div>
        <div class="slide-body" contenteditable="true">
            <h3>Titre...</h3>
            <p>Texte...</p>
        </div>
        <div class="socket" title="Tirer pour relier"></div>
    `;

    canvas.appendChild(div);
    makeDraggable(div);
    setupSocket(div.querySelector('.socket'), slideId);
}

// Initialisation : créer 2 slides par défaut
createSlide(100, 150);
createSlide(500, 250);

// Boutons d'ajout
document.getElementById("btn-add").addEventListener("click", () => createSlide());
document.getElementById("btn-add-sidebar").addEventListener("click", () => createSlide());

/* =========================
   DUPLIQUER LA SLIDE SELECTIONNÉE
========================= */

document.getElementById("btn-duplicate").addEventListener("click", () => {
    if (!selectedSlide) {
        alert("Sélectionne une slide à dupliquer 🙂");
        return;
    }

    // Clone la slide
    const clone = selectedSlide.cloneNode(true);

    // Décaler légèrement la position pour qu'on voie le clone
    const left = parseInt(selectedSlide.style.left || 0);
    const top = parseInt(selectedSlide.style.top || 0);
    clone.style.left = (left + 40) + "px";
    clone.style.top = (top + 40) + "px";

    // Ajouter le clone au canvas
    document.getElementById("canvas-container").appendChild(clone);

    // Mettre à jour la sélection pour le clone
    document.querySelectorAll(".slide").forEach(s => s.style.outline = "none");
    selectedSlide = clone;
    clone.style.outline = "3px solid var(--primary)";
});

/* =========================================
   2. LOGIQUE DE DÉPLACEMENT (DRAG SLIDE)
========================================= */
function makeDraggable(slide) {
    const handle = slide.querySelector('.handle');

    handle.addEventListener("mousedown", (e) => {
        isDraggingSlide = true;
        selectedSlide = slide;
        
        // Mettre au premier plan
        document.querySelectorAll(".slide").forEach(s => s.style.zIndex = "10");
        slide.style.zIndex = "100";
        slide.classList.add("selected");

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = slide.offsetLeft;
        initialTop = slide.offsetTop;
        document.body.style.cursor = "grabbing";
    });
}

document.addEventListener("mousemove", (e) => {
    // Cas 1 : On déplace une slide
    if (isDraggingSlide && selectedSlide) {
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        selectedSlide.style.left = `${initialLeft + dx}px`;
        selectedSlide.style.top = `${initialTop + dy}px`;
        
        // IMPORTANT : Mettre à jour les lignes connectées à cette slide !
        updateAllLines();
    }

    // Cas 2 : On tire une ligne (création de lien)
    if (isDrawingLine && tempLine) {
        // La fin de la ligne suit la souris
        // On convertit les coord souris relative au canvas
        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;
        
        // On met à jour l'attribut 'd' du path SVG
        const startX = parseFloat(tempLine.dataset.startX);
        const startY = parseFloat(tempLine.dataset.startY);
        tempLine.setAttribute("d", `M ${startX} ${startY} L ${mouseX} ${mouseY}`);
    }
});

document.addEventListener("mouseup", (e) => {
    // Fin du drag slide
    if (isDraggingSlide) {
        isDraggingSlide = false;
        document.body.style.cursor = "default";
    }

    // Fin du drag ligne (Relâchement)
    if (isDrawingLine) {
        stopDrawingLine(e.target);
    }
});

/* =========================================
   3. LOGIQUE DE CONNEXION (LIENS)
========================================= */

function setupSocket(socketElement, sourceId) {
    socketElement.addEventListener("mousedown", (e) => {
        e.stopPropagation(); // Empêche de sélectionner la slide en dessous
        isDrawingLine = true;
        startSocket = socketElement;

        // Calcul position de départ (Centre du socket)
        const rect = socketElement.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const x = rect.left + rect.width / 2 - canvasRect.left;
        const y = rect.top + rect.height / 2 - canvasRect.top;

        // Créer une ligne temporaire SVG
        tempLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
        tempLine.setAttribute("stroke", "#cc6699");
        tempLine.setAttribute("stroke-width", "3");
        tempLine.setAttribute("fill", "none");
        tempLine.setAttribute("stroke-dasharray", "5,5"); // Pointillés pendant qu'on tire
        tempLine.dataset.startX = x;
        tempLine.dataset.startY = y;
        
        svgLayer.appendChild(tempLine);
    });
}

function stopDrawingLine(targetElement) {
    isDrawingLine = false;
    
    // Vérifier si on a lâché sur une slide (et pas la même que le départ)
    const targetSlide = targetElement.closest('.slide');
    const sourceSlideId = startSocket.closest('.slide').id;

    if (targetSlide && targetSlide.id !== sourceSlideId) {
        // CRÉER LE LIEN DÉFINITIF
        createConnection(sourceSlideId, targetSlide.id);
    }

    // Supprimer la ligne temporaire
    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }
    startSocket = null;
}

function createConnection(fromId, toId) {
    // Vérifier doublons
    const exists = connections.find(c => c.from === fromId && c.to === toId);
    if (exists) return;

    // Ajouter aux données
    const connection = {
        id: `conn-${Date.now()}`,
        from: fromId,
        to: toId,
        element: null // Stockera l'élément SVG
    };
    connections.push(connection);

    // Dessiner la ligne
    drawConnection(connection);
}

function drawConnection(connection) {
    const fromEl = document.getElementById(connection.from);
    const toEl = document.getElementById(connection.to);
    if (!fromEl || !toEl) return;

    // Créer le path SVG s'il n'existe pas
    if (!connection.element) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("connection-line");
        path.id = connection.id;
        svgLayer.appendChild(path);
        connection.element = path;
        
        // Double clic sur la ligne pour la supprimer
        path.addEventListener("dblclick", () => {
             if(confirm("Supprimer ce lien ?")) {
                 path.remove();
                 connections = connections.filter(c => c.id !== connection.id);
             }
        });
        
        // Curseur main sur la ligne
        path.style.cursor = "pointer";
        path.style.pointerEvents = "stroke"; // Important pour pouvoir cliquer dessus
    }

    // Calculer les coordonnées (Centre socket droit -> Centre slide gauche)
    const canvasRect = canvas.getBoundingClientRect();
    
    // Départ : Socket de droite de la slide 'from'
    const socketRect = fromEl.querySelector('.socket').getBoundingClientRect();
    const x1 = socketRect.left + socketRect.width / 2 - canvasRect.left;
    const y1 = socketRect.top + socketRect.height / 2 - canvasRect.top;

    // Arrivée : Centre gauche de la slide 'to'
    const toRect = toEl.getBoundingClientRect();
    const x2 = toRect.left - canvasRect.left;
    const y2 = toRect.top + toRect.height / 2 - canvasRect.top;

    // Dessiner une courbe de Bézier (C) pour faire joli
    // M x1 y1 C (control1_x) (control1_y), (control2_x) (control2_y), x2 y2
    const cp1x = x1 + Math.abs(x2 - x1) / 2; // Point de contrôle 1
    const cp2x = x2 - Math.abs(x2 - x1) / 2; // Point de contrôle 2
    
    const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
    connection.element.setAttribute("d", d);
}

function updateAllLines() {
    connections.forEach(conn => drawConnection(conn));
}

// Fonction pour vider tout
document.getElementById("btn-clear-all").addEventListener("click", () => {
    if(confirm("Tout effacer ?")) {
        document.querySelectorAll(".slide").forEach(s => s.remove());
        svgLayer.innerHTML = ""; // Vide les lignes
        connections = [];
        slideCount = 0;
    }
});


/* =========================================
   4. SYSTÈME D'APERÇU INTERACTIF
========================================= */
const previewOverlay = document.getElementById("preview-overlay");
const pTitle = document.getElementById("p-title");
const pBody = document.getElementById("p-body");
const pChoices = document.getElementById("p-choices");

document.getElementById("btn-preview").addEventListener("click", () => {
    // Vérification
    const slides = document.querySelectorAll(".slide");
    if (slides.length === 0) return alert("Rien à afficher !");

    // Trouver la première slide (la plus à gauche)
    let firstSlide = Array.from(slides).sort((a, b) => parseInt(a.style.left) - parseInt(b.style.left))[0];
    
    loadPreviewSlide(firstSlide.id);
    previewOverlay.classList.remove("hidden");
});

function loadPreviewSlide(slideId) {
    const slideEl = document.getElementById(slideId);
    if (!slideEl) return;

    // 1. Charger le contenu
    pTitle.innerText = slideEl.querySelector(".slide-header span").innerText;
    pBody.innerHTML = slideEl.querySelector(".slide-body").innerHTML;

    // 2. Générer les Choix (boutons)
    pChoices.innerHTML = ""; // Vider les anciens choix
    
    // Trouver toutes les connexions qui partent de cette slide
    const myLinks = connections.filter(c => c.from === slideId);

    if (myLinks.length === 0) {
        // C'est une fin de parcours
        const endBtn = document.createElement("button");
        endBtn.className = "choice-btn";
        endBtn.innerText = "Fin du scénario (Recommencer)";
        endBtn.onclick = () => document.getElementById("btn-preview").click(); // Relance
        pChoices.appendChild(endBtn);
    } else {
        // Créer un bouton pour chaque lien
        myLinks.forEach((link, index) => {
            const targetSlide = document.getElementById(link.to);
            const targetTitle = targetSlide.querySelector(".slide-header span").innerText;
            
            const btn = document.createElement("button");
            btn.className = "choice-btn";
            // Par défaut le texte est "Aller vers..." mais on pourrait le personnaliser
            btn.innerText = `Option ${index + 1} : Vers ${targetTitle}`;
            
            btn.onclick = () => {
                // Animation de transition
                document.getElementById("preview-card").animate([
                    { opacity: 1, transform: 'scale(1)' },
                    { opacity: 0, transform: 'scale(0.95)' }
                ], { duration: 150 }).onfinish = () => {
                    loadPreviewSlide(link.to); // Charger la suivante
                    document.getElementById("preview-card").animate([
                        { opacity: 0, transform: 'scale(0.95)' },
                        { opacity: 1, transform: 'scale(1)' }
                    ], { duration: 150 });
                };
            };
            
            pChoices.appendChild(btn);
        });
    }
}

document.getElementById("close-preview").addEventListener("click", () => {
    previewOverlay.classList.add("hidden");
});