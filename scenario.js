/* =========================================
   FLOWPOINT - ÉDITEUR DE SCÉNARIOS
   Groupe Arborescences : DUMAS Philippe, HALLIEZ Axel, CAPPELLE Adélie
========================================= */

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
let connections = [];

// Historique pour l'aperçu
let previewHistory = [];

// Variables pour le décalage automatique
let spawnX = 50;
let spawnY = 50;

// Clé localStorage pour ce projet
const STORAGE_KEY = 'flowpoint_scenario';

/* =========================================
   1. CRÉATION & GESTION DES SLIDES
========================================= */

function createSlide(x = null, y = null, title = null, content = null) {
    slideCount++;
    const slideId = `slide-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (x === null || y === null) {
        spawnX += 30;
        spawnY += 20;
        if (spawnX > 300) { spawnX = 50; spawnY = 50; }
        x = spawnX;
        y = spawnY;
    }

    const div = document.createElement("div");
    div.classList.add("slide");
    div.id = slideId;
    div.style.left = x + "px";
    div.style.top = y + "px";

    const slideTitle = title || `Slide ${slideCount}`;
    const slideContent = content || '<h3>Titre...</h3><p>Texte...</p>';

    div.innerHTML = `
        <div class="slide-header">
            <span contenteditable="true">${slideTitle}</span>
            <i class="fa-solid fa-grip-lines handle"></i>
        </div>
        <div class="slide-body" contenteditable="true">
            ${slideContent}
        </div>
        <div class="socket" title="Tirer pour relier"></div>
    `;

    canvas.appendChild(div);
    makeDraggable(div);
    setupSocket(div.querySelector('.socket'), slideId);
    
    // Sauvegarder après création
    saveToLocalStorage();
    
    return slideId;
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
});

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

        connections = connections.filter(c => {
            if (c.from === slideId || c.to === slideId) {
                if (c.element) c.element.remove();
                return false;
            }
            return true;
        });

        selectedSlide.remove();
        selectedSlide = null;
        saveToLocalStorage();
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
        saveToLocalStorage();
    }
});

// Dupliquer
const btnDuplicate = document.getElementById("btn-duplicate");
if (btnDuplicate) {
    btnDuplicate.addEventListener("click", () => {
        if (!selectedSlide) {
            alert("Sélectionne une slide à dupliquer !");
            return;
        }

        const clone = selectedSlide.cloneNode(true);
        const newId = `slide-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        clone.id = newId;

        const currentLeft = parseInt(selectedSlide.style.left) || 0;
        const currentTop = parseInt(selectedSlide.style.top) || 0;
        clone.style.left = (currentLeft + 40) + "px";
        clone.style.top = (currentTop + 40) + "px";

        clone.classList.remove("selected");
        clone.style.zIndex = "";
        
        const titleSpan = clone.querySelector(".slide-header span");
        if(titleSpan) titleSpan.innerText += " (Copie)";

        canvas.appendChild(clone);
        makeDraggable(clone);
        const newSocket = clone.querySelector('.socket');
        if(newSocket) setupSocket(newSocket, newId);
        
        document.querySelectorAll(".slide").forEach(s => s.classList.remove("selected"));
        selectedSlide = clone;
        clone.classList.add("selected");
        saveToLocalStorage();
    });
}

// Export
const btnExport = document.getElementById("btn-export");
if(btnExport) {
    btnExport.addEventListener("click", () => {
        const data = {
            slides: [],
            connections: connections.map(c => ({ from: c.from, to: c.to }))
        };
        
        document.querySelectorAll(".slide").forEach(slide => {
            data.slides.push({
                id: slide.id,
                x: parseInt(slide.style.left),
                y: parseInt(slide.style.top),
                title: slide.querySelector(".slide-header span").innerText,
                content: slide.querySelector(".slide-body").innerHTML
            });
        });
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scenario.json';
        a.click();
        URL.revokeObjectURL(url);
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
        
        document.querySelectorAll(".slide").forEach(s => s.classList.remove("selected"));
        slide.classList.add("selected");
        slide.style.zIndex = "100";

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = slide.offsetLeft;
        initialTop = slide.offsetTop;
        document.body.style.cursor = "grabbing";
    });
    
    // Clic pour sélectionner
    slide.addEventListener("mousedown", (e) => {
        if (!e.target.closest('.socket')) {
            document.querySelectorAll(".slide").forEach(s => s.classList.remove("selected"));
            slide.classList.add("selected");
            selectedSlide = slide;
        }
    });
}

document.addEventListener("mousedown", (e) => {
    if (e.target.id === "canvas-container" || e.target.id === "svg-layer") {
        document.querySelectorAll(".slide").forEach(s => s.classList.remove("selected"));
        selectedSlide = null;
    }
});

document.addEventListener("mousemove", (e) => {
    if (isDraggingSlide && selectedSlide) {
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        selectedSlide.style.left = `${initialLeft + dx}px`;
        selectedSlide.style.top = `${initialTop + dy}px`;
        updateAllLines();
    }

    if (isDrawingLine && tempLine) {
        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;
        const lineStartX = parseFloat(tempLine.dataset.startX);
        const lineStartY = parseFloat(tempLine.dataset.startY);
        
        const d = `M ${lineStartX} ${lineStartY} L ${mouseX} ${mouseY}`;
        tempLine.setAttribute("d", d);
    }
});

document.addEventListener("mouseup", (e) => {
    if (isDraggingSlide) {
        isDraggingSlide = false;
        if(selectedSlide) selectedSlide.style.zIndex = "";
        document.body.style.cursor = "default";
        saveToLocalStorage();
    }
    if (isDrawingLine) {
        stopDrawingLine(e.target);
    }
});

/* =========================================
   3. GESTION DES CONNEXIONS
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
    tempLine.setAttribute("stroke-dasharray", "5,5");
    tempLine.dataset.startX = x;
    tempLine.dataset.startY = y;
    svgLayer.appendChild(tempLine);
}

function stopDrawingLine(targetElement) {
    isDrawingLine = false;
    const targetSlide = targetElement.closest('.slide');
    
    if (targetSlide && startSocket) {
        const sourceSlideId = startSocket.closest('.slide').id;
        if (targetSlide.id !== sourceSlideId) {
            createConnection(sourceSlideId, targetSlide.id);
        }
    }
    
    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }
    startSocket = null;
}

function createConnection(fromId, toId) {
    if (connections.find(c => c.from === fromId && c.to === toId)) return;

    const connection = {
        id: `conn-${Date.now()}`,
        from: fromId,
        to: toId,
        element: null
    };
    connections.push(connection);
    drawConnection(connection);
    saveToLocalStorage();
}

function drawConnection(connection) {
    const fromEl = document.getElementById(connection.from);
    const toEl = document.getElementById(connection.to);
    
    if (!fromEl || !toEl) return;

    if (!connection.element) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("connection-line");
        path.id = connection.id;
        svgLayer.appendChild(path);
        connection.element = path;

        path.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();

            connections = connections.filter(c => c.id !== connection.id);
            path.remove();

            const sourceSlide = document.getElementById(connection.from);
            if (sourceSlide) {
                const sourceSocket = sourceSlide.querySelector('.socket');
                startDrawing(sourceSocket);
                
                const canvasRect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - canvasRect.left;
                const mouseY = e.clientY - canvasRect.top;
                const lineStartX = parseFloat(tempLine.dataset.startX);
                const lineStartY = parseFloat(tempLine.dataset.startY);
                tempLine.setAttribute("d", `M ${lineStartX} ${lineStartY} L ${mouseX} ${mouseY}`);
            }
            saveToLocalStorage();
        });
    }

    const canvasRect = canvas.getBoundingClientRect();
    const socketRect = fromEl.querySelector('.socket').getBoundingClientRect();
    const x1 = socketRect.left + socketRect.width / 2 - canvasRect.left;
    const y1 = socketRect.top + socketRect.height / 2 - canvasRect.top;

    const toRect = toEl.getBoundingClientRect();
    const x2 = toRect.left - canvasRect.left;
    const y2 = toRect.top + toRect.height / 2 - canvasRect.top;

    const cp1x = x1 + Math.abs(x2 - x1) / 2;
    const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;
    
    connection.element.setAttribute("d", d);
}

function updateAllLines() {
    connections.forEach(conn => drawConnection(conn));
}

/* =========================================
   4. SYSTÈME D'APERÇU
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

        let firstSlide = Array.from(slides).sort((a, b) => 
            parseInt(a.style.left) - parseInt(b.style.left)
        )[0];
        
        previewHistory = [];
        updateBackButton();
        
        loadPreviewSlide(firstSlide.id);
        previewOverlay.classList.remove("hidden");
    });
}

function loadPreviewSlide(slideId) {
    const slideEl = document.getElementById(slideId);
    if (!slideEl) return;

    pTitle.innerText = slideEl.querySelector(".slide-header span").innerText;
    pBody.innerHTML = slideEl.querySelector(".slide-body").innerHTML;
    
    pChoices.innerHTML = "";
    const myLinks = connections.filter(c => c.from === slideId);

    if (myLinks.length === 0) {
        const endBtn = document.createElement("button");
        endBtn.className = "choice-btn";
        endBtn.innerText = "🔄 Recommencer";
        endBtn.onclick = () => document.getElementById("btn-preview").click();
        pChoices.appendChild(endBtn);
    } else {
        myLinks.forEach((link, index) => {
            const targetSlide = document.getElementById(link.to);
            if(targetSlide) {
                const targetTitle = targetSlide.querySelector(".slide-header span").innerText;
                
                const btn = document.createElement("button");
                btn.className = "choice-btn";
                btn.innerText = `➡️ ${targetTitle}`;
                
                btn.onclick = () => {
                    previewHistory.push(slideId);
                    updateBackButton();
                    loadPreviewSlide(link.to);
                };
                pChoices.appendChild(btn);
            }
        });
    }
}

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

// Raccourci clavier Echap
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !previewOverlay.classList.contains("hidden")) {
        previewOverlay.classList.add("hidden");
    }
});

/* =========================================
   5. SAUVEGARDE LOCALE
========================================= */
function saveToLocalStorage() {
    const data = {
        slideCount: slideCount,
        spawnX: spawnX,
        spawnY: spawnY,
        slides: [],
        connections: connections.map(c => ({ from: c.from, to: c.to }))
    };
    
    document.querySelectorAll(".slide").forEach(slide => {
        data.slides.push({
            id: slide.id,
            x: parseInt(slide.style.left),
            y: parseInt(slide.style.top),
            title: slide.querySelector(".slide-header span").innerText,
            content: slide.querySelector(".slide-body").innerHTML
        });
    });
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    
    if (saved) {
        try {
            const data = JSON.parse(saved);
            
            slideCount = data.slideCount || 0;
            spawnX = data.spawnX || 50;
            spawnY = data.spawnY || 50;
            
            // Recréer les slides
            data.slides.forEach(slideData => {
                const div = document.createElement("div");
                div.classList.add("slide");
                div.id = slideData.id;
                div.style.left = slideData.x + "px";
                div.style.top = slideData.y + "px";

                div.innerHTML = `
                    <div class="slide-header">
                        <span contenteditable="true">${slideData.title}</span>
                        <i class="fa-solid fa-grip-lines handle"></i>
                    </div>
                    <div class="slide-body" contenteditable="true">
                        ${slideData.content}
                    </div>
                    <div class="socket" title="Tirer pour relier"></div>
                `;

                canvas.appendChild(div);
                makeDraggable(div);
                setupSocket(div.querySelector('.socket'), slideData.id);
            });
            
            // Recréer les connexions
            data.connections.forEach(connData => {
                const connection = {
                    id: `conn-${Date.now()}-${Math.random()}`,
                    from: connData.from,
                    to: connData.to,
                    element: null
                };
                connections.push(connection);
                drawConnection(connection);
            });
            
        } catch(e) {
            console.error("Erreur chargement:", e);
            createDefaultSlides();
        }
    } else {
        createDefaultSlides();
    }
}

function createDefaultSlides() {
    // Créer 2 slides par défaut si rien n'existe
    setTimeout(() => {
        if(document.querySelectorAll('.slide').length === 0) {
            createSlide(100, 150, "Slide 1", "<h3>Bienvenue</h3><p>Première slide de votre scénario</p>");
            createSlide(450, 150, "Slide 2", "<h3>Suite</h3><p>Ajoutez du contenu ici</p>");
        }
    }, 100);
}
