/* =========================================
   VARIABLES GLOBALES
========================================= */
const canvas = document.getElementById("canvas-container");
let slideCount = document.querySelectorAll('.slide').length;
let selectedSlide = null;
let isDragging = false;
let startX, startY, initialLeft, initialTop;

// --- VARIABLES POUR L'APERÇU ---
let previewIndex = 0;
let slidesData = []; // Va stocker les infos des slides pour la lecture

/* =========================================
   PARTIE 1 : ÉDITEUR (Drag & Drop, Création)
========================================= */

// ... (Garde ton code précédent pour le Drag & Drop ici, je le remets pour être sûr) ...

document.addEventListener("mousedown", (e) => {
    if (e.target.closest("button") || e.target.isContentEditable) return;
    const clickedSlide = e.target.closest(".slide");
    document.querySelectorAll(".slide").forEach(s => s.classList.remove("selected"));
    selectedSlide = null;
    if (clickedSlide) {
        selectedSlide = clickedSlide;
        selectedSlide.classList.add("selected");
    }
});

document.addEventListener("mousedown", (e) => {
    if (!e.target.classList.contains('handle')) return;
    const slide = e.target.closest(".slide");
    isDragging = true;
    selectedSlide = slide;
    slide.classList.add("selected");
    slide.style.zIndex = 1000;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = slide.offsetLeft;
    initialTop = slide.offsetTop;
    document.body.style.cursor = "grabbing";
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging || !selectedSlide) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    selectedSlide.style.left = `${initialLeft + dx}px`;
    selectedSlide.style.top = `${initialTop + dy}px`;
});

document.addEventListener("mouseup", () => {
    if (isDragging && selectedSlide) selectedSlide.style.zIndex = "";
    isDragging = false;
    document.body.style.cursor = "default";
});

function createSlide(x = 150, y = 150) {
    slideCount++;
    const div = document.createElement("div");
    div.classList.add("slide");
    div.style.left = x + "px"; div.style.top = y + "px";
    div.innerHTML = `
        <div class="slide-header"><span contenteditable="true">Slide ${slideCount}</span><i class="fa-solid fa-grip-lines handle"></i></div>
        <div class="slide-body" contenteditable="true"><h3>Titre</h3><p>Contenu...</p></div>`;
    canvas.appendChild(div);
}

document.getElementById("btn-add").addEventListener("click", () => createSlide());
document.getElementById("btn-add-sidebar").addEventListener("click", () => createSlide());
document.getElementById("btn-delete").addEventListener("click", () => { if(selectedSlide) selectedSlide.remove(); });
document.getElementById("btn-duplicate").addEventListener("click", () => {
    if(selectedSlide) {
        const clone = selectedSlide.cloneNode(true);
        slideCount++;
        clone.style.left = (parseInt(selectedSlide.style.left)+40)+"px";
        clone.style.top = (parseInt(selectedSlide.style.top)+40)+"px";
        clone.classList.remove("selected");
        canvas.appendChild(clone);
    }
});
document.getElementById("btn-clear-all").addEventListener("click", () => {
    if(confirm("Tout effacer ?")) { document.querySelectorAll(".slide").forEach(s => s.remove()); slideCount = 0; }
});


/* =========================================
   PARTIE 2 : SYSTÈME D'APERÇU (PREVIEW)
========================================= */

const previewOverlay = document.getElementById("preview-overlay");
const pTitle = document.getElementById("p-title");
const pBody = document.getElementById("p-body");
const indicator = document.getElementById("slide-indicator");

// 1. LANCER L'APERÇU
document.getElementById("btn-preview").addEventListener("click", () => {
    // Récupérer toutes les slides de l'éditeur
    const slideElements = document.querySelectorAll(".slide");
    
    if (slideElements.length === 0) {
        alert("Ajoutez des slides avant de lancer l'aperçu ! 🎬");
        return;
    }

    // On vide le tableau de données et on le remplit avec le contenu actuel
    slidesData = [];
    slideElements.forEach(slide => {
        // On récupère le texte du titre (span dans header) et du corps
        const title = slide.querySelector(".slide-header span").innerText;
        const bodyHTML = slide.querySelector(".slide-body").innerHTML;
        
        // On récupère aussi la position (left) pour les trier visuellement de gauche à droite !
        // (Sinon l'ordre de création compte, ce qui peut être bizarre si on les déplace)
        const positionX = parseInt(slide.style.left) || 0;
        const positionY = parseInt(slide.style.top) || 0;

        slidesData.push({ title, body: bodyHTML, x: positionX, y: positionY });
    });

    // Optionnel : Trier les slides par leur position (de haut en bas, puis gauche à droite)
    // Cela permet de lire les slides dans l'ordre visuel et non l'ordre de création
    slidesData.sort((a, b) => {
        // Marge d'erreur de 50px pour considérer qu'elles sont sur la même ligne
        if (Math.abs(a.y - b.y) > 50) return a.y - b.y; 
        return a.x - b.x;
    });

    // Initialiser
    previewIndex = 0;
    updatePreview();
    
    // Afficher l'overlay
    previewOverlay.classList.remove("hidden");
});

// 2. METTRE À JOUR L'AFFICHAGE
function updatePreview() {
    const currentSlide = slidesData[previewIndex];
    
    // Injecter les données
    pTitle.innerText = currentSlide.title;
    pBody.innerHTML = currentSlide.body;
    
    // Mettre à jour le compteur (1 / 5)
    indicator.innerText = `${previewIndex + 1} / ${slidesData.length}`;
}

// 3. BOUTONS SUIVANT / PRÉCÉDENT
document.getElementById("next-slide").addEventListener("click", () => {
    if (previewIndex < slidesData.length - 1) {
        previewIndex++;
        updatePreview();
    }
});

document.getElementById("prev-slide").addEventListener("click", () => {
    if (previewIndex > 0) {
        previewIndex--;
        updatePreview();
    }
});

// 4. FERMER L'APERÇU
document.getElementById("close-preview").addEventListener("click", () => {
    previewOverlay.classList.add("hidden");
});

// Bonus : Navigation au clavier (Flèches)
document.addEventListener("keydown", (e) => {
    if (previewOverlay.classList.contains("hidden")) return;
    
    if (e.key === "ArrowRight") document.getElementById("next-slide").click();
    if (e.key === "ArrowLeft") document.getElementById("prev-slide").click();
    if (e.key === "Escape") document.getElementById("close-preview").click();
});