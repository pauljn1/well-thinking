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

// Gestion des Connexions
let isDrawingLine = false;
let tempLine = null;
let startSocket = null;
let connections = []; // Tableau stockant { id, from, to, element }

// Historique pour l'aperçu
let previewHistory = []; 

// Variables pour le décalage automatique (cascade)
let spawnX = 50;
let spawnY = 50;

/* =========================================
   1. CRÉATION & GESTION DES SLIDES
========================================= */

function createSlide(x = null, y = null) {
    slideCount++;
    const slideId = `slide-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Calcul position (Cascade si pas de x/y fourni)
    if (x === null || y === null) {
        spawnX += 30;
        spawnY += 20;
        // Reset si on va trop loin
        if (spawnX > 300) { spawnX = 50; spawnY = 50; }
        x = spawnX;
        y = spawnY;
    }

    const div = document.createElement("div");
    div.classList.add("slide");
    div.id = slideId;
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

// Initialisation : Création de 2 slides au démarrage
setTimeout(() => { 
    if(document.querySelectorAll('.slide').length === 0) {
        createSlide(100, 150); 
        createSlide(350, 150); 
    }
}, 100);

/* --- BOUTONS D'ACTION --- */

// Ajout
const btnAdd = document.getElementById("btn-add");
if(btnAdd) btnAdd.addEventListener("click", () => createSlide());

const btnAddSidebar = document.getElementById("btn-add-sidebar");
if(btnAddSidebar) btnAddSidebar.addEventListener("click", () => createSlide());

// Suppression
const btnDelete = document.getElementById("btn-delete");
if (btnDelete) {
    btnDelete.addEventListener("click", () => {
        if (!selectedSlide) {
            alert("Sélectionne une slide à supprimer !");
            return;
        }
        
        const slideId = selectedSlide.id;

        // 1. Supprimer les connexions visuelles liées
        connections = connections.filter(c => {
            if (c.from === slideId || c.to === slideId) {
                if (c.element) c.element.remove(); 
                return false; 
            }
            return true;
        });

        // 2. Supprimer la slide HTML
        selectedSlide.remove();
        selectedSlide = null;
    });
}

// Tout vider
const btnClear = document.getElementById("btn-clear-all");
if(btnClear) btnClear.addEventListener("click", () => {
    if(confirm("Tout effacer ?")) {
        document.querySelectorAll(".slide").forEach(s => s.remove());
        svgLayer.innerHTML = "";
        connections = [];
        slideCount = 0;
        spawnX = 50; spawnY = 50;
    }
});

// Dupliquer (CORRIGÉ)
const btnDuplicate = document.getElementById("btn-duplicate");
if (btnDuplicate) {
    btnDuplicate.addEventListener("click", () => {
        if (!selectedSlide) {
            alert("Sélectionne une slide à dupliquer !");
            return;
        }

        // 1. Cloner le HTML
        const clone = selectedSlide.cloneNode(true);
        
        // 2. Générer un nouvel ID unique
        const newId = `slide-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        clone.id = newId;

        // 3. Décaler la position
        const currentLeft = parseInt(selectedSlide.style.left) || 0;
        const currentTop = parseInt(selectedSlide.style.top) || 0;
        clone.style.left = (currentLeft + 40) + "px";
        clone.style.top = (currentTop + 40) + "px";

        // 4. Nettoyage visuel
        clone.classList.remove("selected");
        clone.style.zIndex = "";
        
        // Modifier le titre pour indiquer la copie (optionnel)
        const titleSpan = clone.querySelector(".slide-header span");
        if(titleSpan) titleSpan.innerText += " (Copie)";

        // 5. Ajouter au DOM
        canvas.appendChild(clone);

        // 6. Réactiver les événements (Drag & Liens)
        makeDraggable(clone);
        const newSocket = clone.querySelector('.socket');
        if(newSocket) setupSocket(newSocket, newId);
        
        // Sélectionner la copie
        document.querySelectorAll(".slide").forEach(s => s.classList.remove("selected"));
        selectedSlide = clone;
        clone.classList.add("selected");
    });
}

/* =========================================
   2. DRAG & DROP SLIDES
========================================= */
function makeDraggable(slide) {
    const handle = slide.querySelector('.handle');
    handle.addEventListener("mousedown", (e) => {
        isDraggingSlide = true;
        selectedSlide = slide;
        
        // Gestion de la sélection visuelle
        document.querySelectorAll(".slide").forEach(s => s.classList.remove("selected"));
        slide.classList.add("selected");
        slide.style.zIndex = "100"; // Passe devant

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = slide.offsetLeft;
        initialTop = slide.offsetTop;
        document.body.style.cursor = "grabbing";
    });
}

document.addEventListener("mousedown", (e) => {
    // Si on clique dans le vide, on désélectionne
    if (e.target.id === "canvas-container" || e.target.id === "svg-layer") {
        document.querySelectorAll(".slide").forEach(s => s.classList.remove("selected"));
        selectedSlide = null;
    }
});

document.addEventListener("mousemove", (e) => {
    // A. Déplacement Slide
    if (isDraggingSlide && selectedSlide) {
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        selectedSlide.style.left = `${initialLeft + dx}px`;
        selectedSlide.style.top = `${initialTop + dy}px`;
        updateAllLines(); // Met à jour les lignes en temps réel
    }

    // B. Déplacement Ligne (Tirage)
    if (isDrawingLine && tempLine) {
        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;
        const startX = parseFloat(tempLine.dataset.startX);
        const startY = parseFloat(tempLine.dataset.startY);
        
        // Ligne droite pendant le tirage
        const d = `M ${startX} ${startY} L ${mouseX} ${mouseY}`;
        tempLine.setAttribute("d", d);
    }
});

document.addEventListener("mouseup", (e) => {
    if (isDraggingSlide) {
        isDraggingSlide = false;
        if(selectedSlide) selectedSlide.style.zIndex = "";
        document.body.style.cursor = "default";
    }
    if (isDrawingLine) {
        stopDrawingLine(e.target);
    }
});

/* =========================================
   3. GESTION DES CONNEXIONS (LIENS)
========================================= */
function setupSocket(socketElement, sourceId) {
    socketElement.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        startDrawing(socketElement);
    });
}

function startDrawing(socketElement) {
    isDrawingLine = true;
    startSocket = socketElement;

    const rect = socketElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - canvasRect.left;
    const y = rect.top + rect.height / 2 - canvasRect.top;

    tempLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tempLine.setAttribute("stroke", "#cc6699");
    tempLine.setAttribute("stroke-width", "3");
    tempLine.setAttribute("fill", "none");
    tempLine.setAttribute("stroke-dasharray", "5,5"); // Pointillés
    tempLine.dataset.startX = x;
    tempLine.dataset.startY = y;
    svgLayer.appendChild(tempLine);
}

function stopDrawingLine(targetElement) {
    isDrawingLine = false;
    const targetSlide = targetElement.closest('.slide');
    
    // Si on lâche sur une slide différente de l'origine
    if (targetSlide && startSocket) {
        const sourceSlideId = startSocket.closest('.slide').id;
        if (targetSlide.id !== sourceSlideId) {
            createConnection(sourceSlideId, targetSlide.id);
        }
    }
    
    // Nettoyage ligne temporaire
    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }
    startSocket = null;
}

function createConnection(fromId, toId) {
    // Eviter doublons
    if (connections.find(c => c.from === fromId && c.to === toId)) return;

    const connection = {
        id: `conn-${Date.now()}`,
        from: fromId,
        to: toId,
        element: null
    };
    connections.push(connection);
    drawConnection(connection);
}

function drawConnection(connection) {
    const fromEl = document.getElementById(connection.from);
    const toEl = document.getElementById(connection.to);
    
    // Si une slide a été supprimée, on ne dessine pas
    if (!fromEl || !toEl) return;

    if (!connection.element) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("connection-line");
        path.id = connection.id;
        svgLayer.appendChild(path);
        connection.element = path;

        // Événement : Reprendre la ligne au clic
        path.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();

            // 1. Supprimer la connexion logique
            connections = connections.filter(c => c.id !== connection.id);
            path.remove(); 

            // 2. Relancer le dessin depuis la source
            const sourceSlide = document.getElementById(connection.from);
            const sourceSocket = sourceSlide.querySelector('.socket');
            startDrawing(sourceSocket);
            
            // Mise à jour immédiate position souris pour éviter saut
            const canvasRect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - canvasRect.left;
            const mouseY = e.clientY - canvasRect.top;
            const startX = parseFloat(tempLine.dataset.startX);
            const startY = parseFloat(tempLine.dataset.startY);
            tempLine.setAttribute("d", `M ${startX} ${startY} L ${mouseX} ${mouseY}`);
        });
    }

    // Calcul courbe de Bézier
    const canvasRect = canvas.getBoundingClientRect();
    const socketRect = fromEl.querySelector('.socket').getBoundingClientRect();
    const x1 = socketRect.left + socketRect.width / 2 - canvasRect.left;
    const y1 = socketRect.top + socketRect.height / 2 - canvasRect.top;

    const toRect = toEl.getBoundingClientRect();
    const x2 = toRect.left - canvasRect.left;
    const y2 = toRect.top + toRect.height / 2 - canvasRect.top;

    const cp1x = x1 + Math.abs(x2 - x1) / 2;
    // Courbe plus fluide
    const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;
    
    connection.element.setAttribute("d", d);
}

function updateAllLines() {
    connections.forEach(conn => drawConnection(conn));
}


/* =========================================
   4. SYSTÈME D'APERÇU & HISTORIQUE
========================================= */
const previewOverlay = document.getElementById("preview-overlay");
const pTitle = document.getElementById("p-title");
const pBody = document.getElementById("p-body");
const pChoices = document.getElementById("p-choices");
const btnBack = document.getElementById("btn-preview-back");

const btnPreview = document.getElementById("btn-preview");
if (btnPreview) {
    btnPreview.addEventListener("click", () => {
        const slides = document.querySelectorAll(".slide");
        if (slides.length === 0) return alert("Rien à afficher !");

        // Trouver la première slide (la plus à gauche)
        let firstSlide = Array.from(slides).sort((a, b) => parseInt(a.style.left) - parseInt(b.style.left))[0];
        
        // Reset historique
        previewHistory = [];
        updateBackButton();
        
        loadPreviewSlide(firstSlide.id);
        previewOverlay.classList.remove("hidden");
    });
}

function loadPreviewSlide(slideId) {
    const slideEl = document.getElementById(slideId);
    if (!slideEl) return;

    // Charger Contenu
    pTitle.innerText = slideEl.querySelector(".slide-header span").innerText;
    pBody.innerHTML = slideEl.querySelector(".slide-body").innerHTML;
    
    // Charger Choix
    pChoices.innerHTML = "";
    const myLinks = connections.filter(c => c.from === slideId);

    if (myLinks.length === 0) {
        const endBtn = document.createElement("button");
        endBtn.className = "choice-btn";
        endBtn.innerText = "Fin (Recommencer)";
        endBtn.onclick = () => document.getElementById("btn-preview").click();
        pChoices.appendChild(endBtn);
    } else {
        myLinks.forEach((link, index) => {
            const targetSlide = document.getElementById(link.to);
            if(targetSlide) {
                const targetTitle = targetSlide.querySelector(".slide-header span").innerText;
                
                const btn = document.createElement("button");
                btn.className = "choice-btn";
                btn.innerText = `Option ${index + 1}: ${targetTitle}`;
                
                btn.onclick = () => {
                    // Ajout Historique
                    previewHistory.push(slideId);
                    updateBackButton();
                    
                    loadPreviewSlide(link.to);
                };
                pChoices.appendChild(btn);
            }
        });
    }
}

// Bouton Retour
if (btnBack) {
    btnBack.addEventListener("click", () => {
        if (previewHistory.length > 0) {
            const previousSlideId = previewHistory.pop(); 
            updateBackButton();
            loadPreviewSlide(previousSlideId);
        }
    });
}

function updateBackButton() {
    if (previewHistory.length > 0) {
        btnBack.style.display = "inline-block";
    } else {
        btnBack.style.display = "none";
    }
}

document.getElementById("close-preview").addEventListener("click", () => {
    previewOverlay.classList.add("hidden");
});