// ==========================================
// 1. IMPORTS & CONFIGURATION
// ==========================================

import { sauvegarderProjet, chargerProjet, surveillerSession } from './database.js';

// État Global de l'application
const state = {
    // On met une slide par défaut pour éviter le crash "undefined" au démarrage
    slides: [{ 
        id: Date.now(), 
        backgroundColor: '#ffffff', 
        elements: [],
        treeX: 100,
        treeY: 100
    }],
    currentSlideIndex: 0,
    selectedElement: null,
    isDragging: false,
    isResizing: false,
    isEditing: false,
    dragOffset: { x: 0, y: 0 },
    resizeHandle: null,
    presentationPath: null,
    presentationStep: 0,
    presentationCurrentSlideIndex: 0, // Index de la slide actuellement affichée en présentation
    presentationHistory: [] 
};

// État de l'Arborescence
let treeState = {
    connections: [],          // Liste des connexions (générées automatiquement depuis les navlinks)
    zoom: 1,                  // Niveau de zoom (1 = 100%)
    
    // Variables pour le déplacement des nœuds
    isDraggingSlide: false,
    currentDragSlide: null,
    currentDragSlideId: null,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
    
    // Variables pour le pan (déplacement de la vue)
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panScrollLeft: 0,
    panScrollTop: 0
};

const history = { stack: [], index: -1, maxSize: 50 };

// Références DOM
const slideCanvas = document.getElementById('slideCanvas');
const slidesList = document.getElementById('slidesList');
const slideCounter = document.getElementById('slideCounter');
const elementProperties = document.getElementById('elementProperties');
const shapeModal = document.getElementById('shapeModal');
const imageModal = document.getElementById('imageModal');
const presentationMode = document.getElementById('presentationMode');

// ==========================================
// 2. DÉMARRAGE & CLOUD
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. On active les boutons tout de suite
    setupEventListeners();
    
    // 2. On affiche la slide par défaut (pour éviter l'écran vide)
    renderCurrentSlide();
    updateSlidesList();

    // 3. On attend la connexion Firebase pour charger les vraies données
    surveillerSession((user) => {
        if (user) {
            console.log("✅ Utilisateur connecté :", user.email);
            loadProjectFromCloud();
        } else {
            console.warn("⚠️ Utilisateur non connecté.");
        }
    });
});

async function loadProjectFromCloud() {
    const currentProjectName = localStorage.getItem('current_project_name');

    if (!currentProjectName) {
        console.warn("Aucun projet sélectionné.");
        return;
    }

    try {
        console.log("🔄 Chargement...", currentProjectName);
        const projectData = await chargerProjet(currentProjectName);

        if (projectData && projectData.slides && projectData.slides.length > 0) {
            // Restauration
            state.slides = projectData.slides;
            state.currentSlideIndex = projectData.currentSlideIndex || 0;
            treeState.connections = projectData.connections || [];

            console.log("✅ Données chargées !");
        } else {
            console.log("✨ Projet vide, on garde la slide par défaut.");
            state.slides[0].id = Date.now(); // Nouvel ID frais
            treeState.connections = [];
        }

    } catch (e) {
        console.error("❌ Erreur chargement :", e);
        alert("Erreur de chargement Cloud.");
    }

    // Synchroniser les connexions depuis les éléments navlink existants
    syncConnectionsFromNavLinks();

    // Rafraichir toute l'interface
    updateSlidesList();
    renderCurrentSlide();
    updateSlideCounter();
    updateNavButtons();
    saveToHistory();
}

async function saveProject() {
    const currentProjectName = localStorage.getItem('current_project_name');
    if (!currentProjectName) return;

    const dataToSave = {
        slides: state.slides,
        connections: treeState.connections,
        currentSlideIndex: state.currentSlideIndex,
        version: "2.0",
        lastSaved: Date.now()
    };

    try {
        await sauvegarderProjet(currentProjectName, dataToSave);
        
        // Feedback visuel
        const btn = document.getElementById('saveBtn');
        if(btn) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Sauvegardé';
            btn.style.color = '#4CAF50'; 
            setTimeout(() => { 
                btn.innerHTML = originalHTML; 
                btn.style.color = '';
            }, 2000);
        }
    } catch (e) {
        console.error("❌ Erreur sauvegarde :", e);
    }
}

// ==========================================
// 3. ÉVÉNEMENTS
// ==========================================

function setupEventListeners(){
    // Bouton Sauvegarder
    const btnSave = document.getElementById('saveBtn');
    if(btnSave) btnSave.addEventListener('click', saveProject);

    // Outils panneau droit
    document.getElementById('addTextBtnSide')?.addEventListener('click',addTextElement);
    document.getElementById('addImageBtnSide')?.addEventListener('click',()=>imageModal.classList.add('active'));
    document.getElementById('addShapeBtnSide')?.addEventListener('click',()=>shapeModal.classList.add('active'));
    document.getElementById('addNavLinkBtnSide')?.addEventListener('click',addNavLinkElement);
    
    // Menu Slides
    const addSlideBtn = document.getElementById('addSlideBtn');
    if(addSlideBtn) addSlideBtn.addEventListener('click', toggleAddSlideDropdown);
    
    document.querySelectorAll('#addSlideDropdown .dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            addSlideFromTemplate(item.dataset.template);
            closeAddSlideDropdown();
        });
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.add-slide-wrapper')) closeAddSlideDropdown();
    });

    // Navigation
    document.getElementById('prevSlide')?.addEventListener('click',previousSlide);
    document.getElementById('nextSlide')?.addEventListener('click',nextSlide);
    document.getElementById('canvasArrowLeft')?.addEventListener('click',previousSlide);
    document.getElementById('canvasArrowRight')?.addEventListener('click',nextSlide);
    
    // Vues
    document.getElementById('listViewBtn')?.addEventListener('click',()=>switchView('list'));
    document.getElementById('treeFullscreenBtn')?.addEventListener('click',openTreeFullscreen);
    document.getElementById('closeTreeBtn')?.addEventListener('click',closeTreeFullscreen);
    
    // ARBORESCENCE
    document.getElementById('addSlideTreeBtn')?.addEventListener('click', addSlideFromTree);
    document.getElementById('resetTreeBtn')?.addEventListener('click', resetTreeLayout);
    
    // Zoom
    document.getElementById('zoomInBtn')?.addEventListener('click', () => zoomTree(0.1));
    document.getElementById('zoomOutBtn')?.addEventListener('click', () => zoomTree(-0.1));
    document.getElementById('zoomResetBtn')?.addEventListener('click', resetZoom);

    // Aperçu
    document.getElementById('previewTreeBtn')?.addEventListener('click', startPresentationFromTree);
    document.getElementById('scenarioPreviewBack')?.addEventListener('click', goBackInPreview);
    document.getElementById('closeScenarioPreview')?.addEventListener('click', closeScenarioPreview);

    // Formatage & Inputs
    document.getElementById('boldBtn')?.addEventListener('click',()=>toggleFormat('bold'));
    document.getElementById('italicBtn')?.addEventListener('click',()=>toggleFormat('italic'));
    document.getElementById('underlineBtn')?.addEventListener('click',()=>toggleFormat('underline'));
    document.getElementById('alignLeftBtn')?.addEventListener('click',()=>setTextAlign('left'));
    document.getElementById('alignCenterBtn')?.addEventListener('click',()=>setTextAlign('center'));
    document.getElementById('alignRightBtn')?.addEventListener('click',()=>setTextAlign('right'));
    
    document.getElementById('textColorPicker')?.addEventListener('input',e=>setTextColor(e.target.value));
    document.getElementById('slideBgColor')?.addEventListener('input',e=>setSlideBgColor(e.target.value));
    document.getElementById('fontSelect')?.addEventListener('change',e=>setFont(e.target.value));
    document.getElementById('fontSizeSelect')?.addEventListener('change',e=>setFontSize(e.target.value));
    
    // Modales
    document.querySelectorAll('.shape-option').forEach(btn=>{
        btn.addEventListener('click',()=>{
            addShapeElement(btn.dataset.shape);
            shapeModal.classList.remove('active');
        });
    });
    document.getElementById('closeShapeModal')?.addEventListener('click',()=>shapeModal.classList.remove('active'));
    document.getElementById('imageInput')?.addEventListener('change',handleImageUpload);
    document.getElementById('addImageFromUrl')?.addEventListener('click',addImageFromUrl);
    document.getElementById('closeImageModal')?.addEventListener('click',()=>imageModal.classList.remove('active'));
    
    // Propriétés Élément
    document.getElementById('elemX')?.addEventListener('input',updateElementPosition);
    document.getElementById('elemY')?.addEventListener('input',updateElementPosition);
    document.getElementById('elemWidth')?.addEventListener('input',updateElementSize);
    document.getElementById('elemHeight')?.addEventListener('input',updateElementSize);
    document.getElementById('elemTextContent')?.addEventListener('input',updateElementTextContent);
    document.getElementById('targetSlideSelect')?.addEventListener('change',updateNavLinkTarget);
    document.getElementById('navLinkLabel')?.addEventListener('input',updateNavLinkLabel);
    document.getElementById('navLinkColor')?.addEventListener('input',updateNavLinkColor);
    document.getElementById('shapeColor')?.addEventListener('input',updateShapeColor);
    document.getElementById('shapeRotation')?.addEventListener('input',updateShapeRotation);
    document.getElementById('deleteElement')?.addEventListener('click',deleteSelectedElement);
    
    // Color presets pour navlink
    document.querySelectorAll('#navLinkColorPresets .color-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            document.getElementById('navLinkColor').value = color;
            updateNavLinkColor();
            // Mettre à jour la classe active
            document.querySelectorAll('#navLinkColorPresets .color-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Présentation & Export/Import
    document.getElementById('presentBtn')?.addEventListener('click',startPresentation);
    document.getElementById('presExit')?.addEventListener('click',exitPresentation);
    document.getElementById('presPrev')?.addEventListener('click', presentationGoBack);
    document.getElementById('presNext')?.addEventListener('click',()=>navigatePresentation(1));
    document.getElementById('exportBtn')?.addEventListener('click',exportPresentation);
    document.getElementById('importBtn')?.addEventListener('click',importPresentation);
    document.getElementById('importFileInput')?.addEventListener('change',handleImportFile);
    
    // Souris Canvas
    if(slideCanvas) {
        slideCanvas.addEventListener('mousedown',handleCanvasMouseDown);
        slideCanvas.addEventListener('click',handleCanvasClick);
    }
    document.addEventListener('mousemove',handleMouseMove);
    document.addEventListener('mouseup',handleMouseUp);
    
    if(shapeModal) shapeModal.addEventListener('click',e=>{if(e.target===shapeModal)shapeModal.classList.remove('active')});
    if(imageModal) imageModal.addEventListener('click',e=>{if(e.target===imageModal)imageModal.classList.remove('active')});
    
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ==========================================
// 4. LOGIQUE MÉTIER
// ==========================================

function handleKeyboardShortcuts(e) {
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) { e.preventDefault(); redo(); }
}

function saveToHistory() {
    if (history.index < history.stack.length - 1) history.stack = history.stack.slice(0, history.index + 1);
    const snapshot = { slides: JSON.parse(JSON.stringify(state.slides)), currentSlideIndex: state.currentSlideIndex };
    history.stack.push(snapshot);
    if (history.stack.length > history.maxSize) history.stack.shift(); else history.index++;
}

function undo() { if (history.index > 0) { history.index--; restoreFromHistory(); } }
function redo() { if (history.index < history.stack.length - 1) { history.index++; restoreFromHistory(); } }

function restoreFromHistory() {
    const snapshot = history.stack[history.index];
    if (snapshot) {
        state.slides = JSON.parse(JSON.stringify(snapshot.slides));
        state.currentSlideIndex = snapshot.currentSlideIndex;
        state.selectedElement = null;
        updateSlidesList();
        renderCurrentSlide();
        updateSlideCounter();
        saveProject();
    }
}

function toggleAddSlideDropdown(e){ e.stopPropagation(); document.getElementById('addSlideDropdown').classList.toggle('active'); }
function closeAddSlideDropdown(){ document.getElementById('addSlideDropdown').classList.remove('active'); }

function addSlideFromTemplate(template){
    saveToHistory();
    const slide = {id: Date.now(), backgroundColor: '#ffffff', elements: [], treeX: null, treeY: null};
    
    // Logique simplifiée des templates pour l'exemple
    if(template === 'title') {
        slide.elements.push({id: Date.now(), type: 'text', x: 80, y: 200, width: 800, height: 80, content: 'Titre', fontFamily: 'Inter', fontSize: 48, color: '#1e1e1e', bold: true});
    } else if(template === 'titleText') {
        slide.elements.push({id: Date.now(), type: 'text', x: 80, y: 60, width: 800, height: 60, content: 'Titre', fontFamily: 'Inter', fontSize: 40, color: '#1e1e1e', bold: true});
        slide.elements.push({id: Date.now()+1, type: 'text', x: 80, y: 150, width: 800, height: 300, content: 'Contenu...', fontFamily: 'Inter', fontSize: 20, color: '#333'});
    }
    
    state.slides.push(slide);
    state.currentSlideIndex = state.slides.length - 1;
    updateSlidesList();
    renderCurrentSlide();
    updateSlideCounter();
    saveProject();
}

function addSlide(){
    const slide={id:Date.now(),backgroundColor:'#ffffff',elements:[],treeX:null,treeY:null};
    state.slides.push(slide);
    state.currentSlideIndex=state.slides.length-1;
    updateSlidesList();
    renderCurrentSlide();
    updateSlideCounter();
    saveProject();
}

function deleteSlide(index){
    if(state.slides.length<=1)return;
    saveToHistory();
    state.slides.splice(index,1);
    if(state.currentSlideIndex>=state.slides.length) state.currentSlideIndex=state.slides.length-1;
    updateSlidesList();
    renderCurrentSlide();
    updateSlideCounter();
    saveProject();
}

function selectSlide(index){
    state.currentSlideIndex=index;
    state.selectedElement=null;
    updateSlidesList();
    renderCurrentSlide();
    updateSlideCounter();
    updateNavButtons();
    hideElementProperties();
}

function previousSlide(){ if(state.currentSlideIndex>0)selectSlide(state.currentSlideIndex-1); }
function nextSlide(){ if(state.currentSlideIndex<state.slides.length-1)selectSlide(state.currentSlideIndex+1); }
function updateSlideCounter(){ slideCounter.textContent=`${state.currentSlideIndex+1} / ${state.slides.length}`; }

function updateNavButtons(){
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    const canvasLeft = document.getElementById('canvasArrowLeft');
    const canvasRight = document.getElementById('canvasArrowRight');
    const isFirst = state.currentSlideIndex === 0;
    const isLast = state.currentSlideIndex === state.slides.length - 1;
    if(prevBtn) prevBtn.disabled = isFirst;
    if(nextBtn) nextBtn.disabled = isLast;
    if(canvasLeft) canvasLeft.disabled = isFirst;
    if(canvasRight) canvasRight.disabled = isLast;
}

function switchView(view){
    const listBtn = document.getElementById('listViewBtn');
    const treeBtn = document.getElementById('treeFullscreenBtn');
    const listView = document.getElementById('slidesList');
    if(view === 'list'){
        listBtn.classList.add('active');
        if(treeBtn) treeBtn.classList.remove('active');
        listView.style.display = 'flex';
    }
}

function updateSlidesList(){
    slidesList.innerHTML='';
    state.slides.forEach((slide,index)=>{
        const thumbnail=document.createElement('div');
        thumbnail.className=`slide-thumbnail ${index===state.currentSlideIndex?'active':''}`;
        thumbnail.innerHTML=`
            <div class="slide-thumbnail-content" style="background:${slide.backgroundColor};width:500%;height:500%;transform:scale(0.2);transform-origin:top left;">
                ${renderSlideContent(slide,true)}
            </div>
            <span class="slide-number">${index+1}</span>
            <button class="slide-delete-btn" title="Supprimer"><i class="fas fa-times"></i></button>
        `;
        thumbnail.addEventListener('click',e=>{ if(!e.target.closest('.slide-delete-btn'))selectSlide(index); });
        thumbnail.querySelector('.slide-delete-btn').addEventListener('click',e=>{ e.stopPropagation(); deleteSlide(index); });
        slidesList.appendChild(thumbnail);
    });
}

function renderCurrentSlide(){
    if(state.isEditing) return;
    // Protection : si pas de slide, on ne fait rien
    const slide=state.slides[state.currentSlideIndex];
    if(!slide) return;

    slideCanvas.style.backgroundColor=slide.backgroundColor;
    slideCanvas.innerHTML=renderSlideContent(slide);
    slideCanvas.querySelectorAll('.slide-element').forEach(elem=>{ setupElementEvents(elem); });
}

function renderSlideContent(slide,isThumbnail=false){
    if(!slide || !slide.elements) return '';
    return slide.elements.map(elem=>{
        const selected=!isThumbnail&&state.selectedElement?.id===elem.id?'selected':'';
        const style=`left:${elem.x}px;top:${elem.y}px;width:${elem.width}px;height:${elem.height}px;`;
        let resizeHandles = (!isThumbnail&&selected) ? `<div class="resize-handle nw"></div><div class="resize-handle ne"></div><div class="resize-handle sw"></div><div class="resize-handle se"></div>` : '';
        
        switch(elem.type){
            case'text':
                return`<div class="slide-element text-element ${selected}" data-id="${elem.id}" style="${style}font-family:${elem.fontFamily};font-size:${elem.fontSize}px;color:${elem.color};font-weight:${elem.bold?'bold':'normal'};font-style:${elem.italic?'italic':'normal'};text-decoration:${elem.underline?'underline':'none'};text-align:${elem.textAlign||'left'};">${elem.content}${resizeHandles}</div>`;
            case'image':
                return`<div class="slide-element image-element ${selected}" data-id="${elem.id}" style="${style}"><img src="${elem.src}" alt="Image" style="width:100%;height:100%;object-fit:contain;">${resizeHandles}</div>`;
            case'shape':
                const rotation = elem.rotation || 0;
                return`<div class="slide-element shape-element ${selected}" data-id="${elem.id}" style="${style}transform:rotate(${rotation}deg);">${renderShape(elem.shape,elem.color||'#7c3aed')}${resizeHandles}</div>`;
            case'navlink':
                const targetIndex = state.slides.findIndex(s => s.id === elem.targetSlideId);
                const targetLabel = targetIndex !== -1 ? `Slide ${targetIndex + 1}` : 'Non défini';
                return`<div class="slide-element navlink-element ${selected}" data-id="${elem.id}" style="${style}background-color:${elem.color};display:flex;align-items:center;justify-content:center;color:white;font-size:14px;box-shadow:0 4px 15px rgba(0,0,0,0.1);"><i class="fas fa-arrow-right" style="margin-right:5px"></i>${elem.label||targetLabel}${resizeHandles}</div>`;
        }
        return '';
    }).join('');
}

function renderShape(shape,color){
    switch(shape){
        case'rectangle':return`<div style="width:100%;height:100%;background:${color};border-radius:4px;"></div>`;
        case'circle':return`<div style="width:100%;height:100%;background:${color};border-radius:50%;"></div>`;
        case'triangle':return`<svg viewBox="0 0 100 100" style="width:100%;height:100%;"><polygon points="50,5 5,95 95,95" fill="${color}"/></svg>`;
        case'star':return`<svg viewBox="0 0 100 100" style="width:100%;height:100%;"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="${color}"/></svg>`;
        case'arrow':return`<svg viewBox="0 0 100 100" style="width:100%;height:100%;"><polygon points="0,35 60,35 60,10 100,50 60,90 60,65 0,65" fill="${color}"/></svg>`;
        case'line':return`<div style="width:100%;height:4px;background:${color};position:absolute;top:50%;transform:translateY(-50%);"></div>`;
        default:return'';
    }
}

function findElementById(id){
    const slide=state.slides[state.currentSlideIndex];
    if(!slide) return null;
    return slide.elements.find(e=>e.id===id);
}

function getSlideTitle(slide){
    if(!slide) return 'Inconnu';
    const textElement = slide.elements.find(el => el.type === 'text');
    if(textElement){
        return textElement.content.replace(/<[^>]*>/g, '').substring(0, 25) || 'Sans titre';
    }
    return 'Slide vide';
}

// ==========================================
// 5. OUTILS D'ÉDITION
// ==========================================

function addTextElement(){
    saveToHistory();
    const element={id:Date.now(),type:'text',x:100,y:100,width:300,height:60,content:'Cliquez pour editer',fontFamily:'Inter',fontSize:24,color:'#1e1e1e',bold:false,italic:false,underline:false};
    state.slides[state.currentSlideIndex].elements.push(element);
    state.selectedElement=element;
    renderCurrentSlide();
    showElementProperties();
    saveProject();
}

function addShapeElement(shape){
    saveToHistory();
    const element={id:Date.now(),type:'shape',shape:shape,x:200,y:150,width:150,height:150,color:'#7c3aed'};
    state.slides[state.currentSlideIndex].elements.push(element);
    state.selectedElement=element;
    renderCurrentSlide();
    showElementProperties();
    saveProject();
}

function addNavLinkElement(){
    saveToHistory();
    const targetIndex = state.currentSlideIndex < state.slides.length - 1 ? state.currentSlideIndex + 1 : 0;
    const targetSlide = state.slides[targetIndex];
    const element = {
        id: Date.now(),
        type: 'navlink',
        x: 150,
        y: 200,
        width: 200,
        height: 60,
        targetSlideId: targetSlide ? targetSlide.id : null,
        label: 'Aller à la slide ' + (targetIndex + 1),
        color: '#cc6699'
    };
    state.slides[state.currentSlideIndex].elements.push(element);
    state.selectedElement = element;
    
    // Synchroniser automatiquement les connexions de l'arborescence
    syncConnectionsFromNavLinks();
    
    renderCurrentSlide();
    showElementProperties();
    saveProject();
}

function addImageElement(src){
    saveToHistory();
    const element={id:Date.now(),type:'image',x:150,y:100,width:300,height:200,src:src};
    state.slides[state.currentSlideIndex].elements.push(element);
    state.selectedElement=element;
    renderCurrentSlide();
    showElementProperties();
    saveProject();
}

function handleImageUpload(e){
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(event)=>{
        addImageElement(event.target.result);
        imageModal.classList.remove('active');
    };
    reader.readAsDataURL(file);
}

function addImageFromUrl(){
    const url=document.getElementById('imageUrlInput').value.trim();
    if(url) {
        addImageElement(url);
        document.getElementById('imageUrlInput').value = '';
        imageModal.classList.remove('active');
    }
}

// ==========================================
// 6. PROPRIÉTÉS & MANIPULATION
// ==========================================

function showElementProperties(){
    if(!state.selectedElement)return;
    elementProperties.style.display='block';
    
    const textContentRow = document.getElementById('textContentRow');
    const navLinkRow = document.getElementById('navLinkRow');
    const navLinkLabelRow = document.getElementById('navLinkLabelRow');
    const navLinkColorRow = document.getElementById('navLinkColorRow');
    const shapeColorRow = document.getElementById('shapeColorRow');
    const shapeRotationRow = document.getElementById('shapeRotationRow');
    
    if(textContentRow) textContentRow.style.display = 'none';
    if(navLinkRow) navLinkRow.style.display = 'none';
    if(navLinkLabelRow) navLinkLabelRow.style.display = 'none';
    if(navLinkColorRow) navLinkColorRow.style.display = 'none';
    if(shapeColorRow) shapeColorRow.style.display = 'none';
    if(shapeRotationRow) shapeRotationRow.style.display = 'none';
    
    if(state.selectedElement.type === 'text'){
        if(textContentRow) textContentRow.style.display = 'flex';
        showTextTools();
    } else {
        hideTextTools();
        if(state.selectedElement.type === 'navlink'){
            if(navLinkRow) navLinkRow.style.display = 'flex';
            if(navLinkLabelRow) navLinkLabelRow.style.display = 'flex';
            if(navLinkColorRow) navLinkColorRow.style.display = 'flex';
            populateTargetSlideSelect();
        } else if(state.selectedElement.type === 'shape'){
            if(shapeColorRow) shapeColorRow.style.display = 'flex';
            if(shapeRotationRow) shapeRotationRow.style.display = 'flex';
        }
    }
    updatePropertiesInputs();
}

function hideElementProperties(){ 
    elementProperties.style.display='none'; 
    hideTextTools();
}

function showTextTools(){
    const tools = document.getElementById('textTools');
    if(tools) {
        tools.style.display = 'flex';
        updateTextToolsState();
    }
}

function hideTextTools(){
    const tools = document.getElementById('textTools');
    if(tools) tools.style.display = 'none';
}

function updateTextToolsState(){
    if(!state.selectedElement || state.selectedElement.type !== 'text') return;
    document.getElementById('boldBtn').classList.toggle('active', state.selectedElement.bold);
    document.getElementById('italicBtn').classList.toggle('active', state.selectedElement.italic);
    document.getElementById('underlineBtn').classList.toggle('active', state.selectedElement.underline);
    document.getElementById('fontSelect').value = state.selectedElement.fontFamily;
    document.getElementById('fontSizeSelect').value = state.selectedElement.fontSize;
    document.getElementById('textColorPicker').value = state.selectedElement.color;
}

function updatePropertiesInputs(){
    if(!state.selectedElement)return;
    document.getElementById('elemX').value=state.selectedElement.x;
    document.getElementById('elemY').value=state.selectedElement.y;
    document.getElementById('elemWidth').value=state.selectedElement.width;
    document.getElementById('elemHeight').value=state.selectedElement.height;
    
    if(state.selectedElement.type === 'text'){
        const content = state.selectedElement.content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
        document.getElementById('elemTextContent').value = content;
    }
    if(state.selectedElement.type === 'navlink'){
        document.getElementById('targetSlideSelect').value = state.selectedElement.targetSlideId || '';
        document.getElementById('navLinkLabel').value = state.selectedElement.label || '';
        const navColor = state.selectedElement.color || '#cc6699';
        document.getElementById('navLinkColor').value = navColor;
        // Mettre à jour le preset actif
        document.querySelectorAll('#navLinkColorPresets .color-preset').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color.toLowerCase() === navColor.toLowerCase());
        });
    }
    if(state.selectedElement.type === 'shape'){
        document.getElementById('shapeColor').value = state.selectedElement.color || '#7c3aed';
        document.getElementById('shapeRotation').value = state.selectedElement.rotation || 0;
        document.getElementById('rotationValue').textContent = (state.selectedElement.rotation || 0) + '°';
    }
}

function populateTargetSlideSelect(){
    const select = document.getElementById('targetSlideSelect');
    if(!select) return;
    select.innerHTML = '';
    state.slides.forEach((slide, index) => {
        if(index !== state.currentSlideIndex){
            const option = document.createElement('option');
            option.value = slide.id;
            option.textContent = `Slide ${index + 1} - ${getSlideTitle(slide)}`;
            select.appendChild(option);
        }
    });
}

function updateElementPosition(){
    if(!state.selectedElement)return;
    state.selectedElement.x=parseInt(document.getElementById('elemX').value)||0;
    state.selectedElement.y=parseInt(document.getElementById('elemY').value)||0;
    renderCurrentSlide();
    saveProject();
}

function updateElementSize(){
    if(!state.selectedElement)return;
    state.selectedElement.width=parseInt(document.getElementById('elemWidth').value)||50;
    state.selectedElement.height=parseInt(document.getElementById('elemHeight').value)||50;
    renderCurrentSlide();
    saveProject();
}

function updateElementTextContent(){
    if(!state.selectedElement)return;
    state.selectedElement.content = document.getElementById('elemTextContent').value.replace(/\n/g, '<br>');
    renderCurrentSlide();
    saveProject();
}

function updateNavLinkTarget(){
    if(state.selectedElement?.type === 'navlink'){
        const currentSlideId = state.slides[state.currentSlideIndex].id;
        const oldTargetId = state.selectedElement.targetSlideId;
        const newTargetId = parseInt(document.getElementById('targetSlideSelect').value);
        
        // Supprimer l'ancienne connexion si elle existe
        if(oldTargetId) {
            removeNavLinkConnection(currentSlideId, oldTargetId);
        }
        
        state.selectedElement.targetSlideId = newTargetId;
        
        // Créer la nouvelle connexion automatiquement
        syncConnectionsFromNavLinks();
        
        saveProject();
    }
}
function updateNavLinkLabel(){
    if(state.selectedElement?.type === 'navlink'){
        state.selectedElement.label = document.getElementById('navLinkLabel').value;
        renderCurrentSlide();
        saveProject();
    }
}
function updateNavLinkColor(){
    if(state.selectedElement?.type === 'navlink'){
        state.selectedElement.color = document.getElementById('navLinkColor').value;
        // Mettre à jour la couleur de la connexion correspondante
        syncConnectionsFromNavLinks();
        renderCurrentSlide();
        saveProject();
    }
}

function updateShapeColor(){
    if(state.selectedElement?.type === 'shape'){
        state.selectedElement.color = document.getElementById('shapeColor').value;
        renderCurrentSlide();
        saveProject();
    }
}

function updateShapeRotation(){
    if(state.selectedElement?.type === 'shape'){
        const rotation = parseInt(document.getElementById('shapeRotation').value) || 0;
        state.selectedElement.rotation = rotation;
        document.getElementById('rotationValue').textContent = rotation + '°';
        renderCurrentSlide();
        saveProject();
    }
}

function deleteSelectedElement(){
    if(!state.selectedElement)return;
    saveToHistory();
    const slide=state.slides[state.currentSlideIndex];
    const index=slide.elements.findIndex(e=>e.id===state.selectedElement.id);
    if(index!==-1){
        // Si c'est un navlink, supprimer la connexion correspondante
        if(state.selectedElement.type === 'navlink' && state.selectedElement.targetSlideId) {
            removeNavLinkConnection(slide.id, state.selectedElement.targetSlideId);
        }
        
        slide.elements.splice(index,1);
        state.selectedElement=null;
        renderCurrentSlide();
        hideElementProperties();
        saveProject();
    }
}

function toggleFormat(format){
    if(!state.selectedElement)return;
    state.selectedElement[format]=!state.selectedElement[format];
    renderCurrentSlide();
    saveProject();
}
function setTextAlign(align){
    if(!state.selectedElement)return;
    state.selectedElement.textAlign = align;
    renderCurrentSlide();
    saveProject();
}
function setTextColor(color){
    if(!state.selectedElement)return;
    state.selectedElement.color=color;
    renderCurrentSlide();
    saveProject();
}
function setFont(font){
    if(!state.selectedElement)return;
    state.selectedElement.fontFamily=font;
    renderCurrentSlide();
    saveProject();
}
function setFontSize(size){
    if(!state.selectedElement)return;
    state.selectedElement.fontSize=parseInt(size);
    renderCurrentSlide();
    saveProject();
}
function setSlideBgColor(color){
    state.slides[state.currentSlideIndex].backgroundColor=color;
    renderCurrentSlide();
    saveProject();
}

// Drag & Drop / Resize
function setupElementEvents(elem){
    elem.addEventListener('mousedown',e=>{
        if(e.target.classList.contains('resize-handle')){
            startResize(e);
        } else if(!state.isEditing) {
            startDrag(e);
        }
    });
    
    elem.addEventListener('dblclick',e=>{
        if(elem.classList.contains('text-element')){
            e.stopPropagation();
            state.isEditing = true;
            elem.setAttribute('contenteditable', 'true');
            elem.focus();
        }
    });
}

function startDrag(e){
    const elem=e.target.closest('.slide-element');
    if(!elem || state.isEditing)return;
    e.preventDefault();
    const id=parseInt(elem.dataset.id);
    state.selectedElement=findElementById(id);
    state.isDragging=true;
    const rect=elem.getBoundingClientRect();
    state.dragOffset={x:e.clientX-rect.left,y:e.clientY-rect.top};
    renderCurrentSlide();
    showElementProperties();
}

function startResize(e){
    e.stopPropagation();
    state.isResizing=true;
    state.resizeHandle=e.target.classList[1];
    state.startX=e.clientX;
    state.startY=e.clientY;
    state.startWidth=state.selectedElement.width;
    state.startHeight=state.selectedElement.height;
    state.startLeft=state.selectedElement.x;
    state.startTop=state.selectedElement.y;
}

function handleMouseMove(e){
    if(state.isDragging&&state.selectedElement&&!state.isEditing){
        const canvasRect=slideCanvas.getBoundingClientRect();
        let newX=e.clientX-canvasRect.left-state.dragOffset.x;
        let newY=e.clientY-canvasRect.top-state.dragOffset.y;
        state.selectedElement.x=Math.round(newX);
        state.selectedElement.y=Math.round(newY);
        renderCurrentSlide();
        updatePropertiesInputs();
    }
    if(state.isResizing&&state.selectedElement){
        const dx=e.clientX-state.startX;
        const dy=e.clientY-state.startY;
        const handle=state.resizeHandle;
        let newWidth=state.startWidth;
        let newHeight=state.startHeight;
        
        if(handle.includes('e'))newWidth=Math.max(20,state.startWidth+dx);
        if(handle.includes('s'))newHeight=Math.max(20,state.startHeight+dy);
        
        state.selectedElement.width=Math.round(newWidth);
        state.selectedElement.height=Math.round(newHeight);
        renderCurrentSlide();
        updatePropertiesInputs();
    }
}

function handleMouseUp(){
    if(state.isDragging||state.isResizing){
        saveProject();
    }
    state.isDragging=false;
    state.isResizing=false;
    state.resizeHandle=null;
}

function handleCanvasClick(e){
    if(e.target===slideCanvas && !state.isEditing){
        state.selectedElement=null;
        renderCurrentSlide();
        hideElementProperties();
    }
}

function handleCanvasMouseDown(e){
    if(e.target===slideCanvas && !state.isEditing){
        state.selectedElement=null;
        renderCurrentSlide();
        hideElementProperties();
    }
}

// ==========================================
// 7. ARBORESCENCE AVANCÉE (Correction toggleConnectMode)
// ==========================================

function openTreeFullscreen() {
    document.getElementById('treeFullscreen').classList.add('active');
    
    // Synchroniser les connexions depuis les éléments navlink avant d'afficher
    syncConnectionsFromNavLinks();
    
    // Réinitialiser le zoom
    treeState.zoom = 1;
    applyZoom();
    
    renderTreeNodes();
    drawConnections();
    setupScenarioEvents();
}

function closeTreeFullscreen() {
    document.getElementById('treeFullscreen').classList.remove('active');
    cleanupScenarioEvents();
}

let scenarioMouseMoveHandler = null;
let scenarioMouseUpHandler = null;
let scenarioWheelHandler = null;
let scenarioMouseDownHandler = null;

function setupScenarioEvents() {
    scenarioMouseMoveHandler = handleScenarioMouseMove;
    scenarioMouseUpHandler = handleScenarioMouseUp;
    scenarioWheelHandler = handleScenarioWheel;
    scenarioMouseDownHandler = handleScenarioMouseDown;
    document.addEventListener('mousemove', scenarioMouseMoveHandler);
    document.addEventListener('mouseup', scenarioMouseUpHandler);
    
    const treeCanvas = document.getElementById('treeCanvas');
    if (treeCanvas) {
        // Zoom avec la molette (Ctrl + scroll)
        treeCanvas.addEventListener('wheel', scenarioWheelHandler, { passive: false });
        // Pan avec clic sur le fond
        treeCanvas.addEventListener('mousedown', scenarioMouseDownHandler);
        treeCanvas.style.cursor = 'grab';
    }
}

function cleanupScenarioEvents() {
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

// Démarrer le pan quand on clique sur le fond du canvas
function handleScenarioMouseDown(e) {
    const treeCanvas = document.getElementById('treeCanvas');
    
    // Ne pas démarrer le pan si on clique sur une slide ou un élément interactif
    if (e.target.closest('.scenario-slide-card') || e.target.closest('.tree-tool-btn')) {
        return;
    }
    
    // Démarrer le pan (clic gauche ou molette)
    if (e.button === 0 || e.button === 1) {
        e.preventDefault();
        treeState.isPanning = true;
        treeState.panStartX = e.clientX;
        treeState.panStartY = e.clientY;
        treeState.panScrollLeft = treeCanvas.scrollLeft;
        treeState.panScrollTop = treeCanvas.scrollTop;
        treeCanvas.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
    }
}

// Gestion du zoom avec la molette
function handleScenarioWheel(e) {
    if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoomTree(delta);
    }
}

// Zoomer / Dézoomer l'arborescence
function zoomTree(delta) {
    treeState.zoom = Math.min(2, Math.max(0.3, treeState.zoom + delta));
    applyZoom();
}

// Réinitialiser le zoom
function resetZoom() {
    treeState.zoom = 1;
    applyZoom();
}

// Appliquer le zoom
function applyZoom() {
    const treeNodes = document.getElementById('treeNodes');
    const treeSvg = document.getElementById('treeSvg');
    const zoomLabel = document.getElementById('zoomLevel');
    
    if (treeNodes) {
        treeNodes.style.transform = `scale(${treeState.zoom})`;
        treeNodes.style.transformOrigin = 'top left';
    }
    if (treeSvg) {
        treeSvg.style.transform = `scale(${treeState.zoom})`;
        treeSvg.style.transformOrigin = 'top left';
    }
    if (zoomLabel) {
        zoomLabel.textContent = Math.round(treeState.zoom * 100) + '%';
    }
}

function handleScenarioMouseMove(e) {
    const canvas = document.getElementById('treeCanvas');
    if (!canvas) return;

    // Pan (déplacement de la vue)
    if (treeState.isPanning) {
        e.preventDefault();
        const dx = e.clientX - treeState.panStartX;
        const dy = e.clientY - treeState.panStartY;
        canvas.scrollLeft = treeState.panScrollLeft - dx;
        canvas.scrollTop = treeState.panScrollTop - dy;
        return;
    }

    // Déplacement d'une slide
    if (treeState.isDraggingSlide && treeState.currentDragSlide) {
        e.preventDefault();
        
        // Compenser le zoom : le mouvement écran doit être divisé par le zoom
        const zoom = treeState.zoom || 1;
        const dx = (e.clientX - treeState.startX) / zoom;
        const dy = (e.clientY - treeState.startY) / zoom;
        
        let newX = treeState.initialLeft + dx;
        let newY = treeState.initialTop + dy;
        
        // Limiter aux bords
        newX = Math.max(20, newX);
        newY = Math.max(20, newY);
        
        treeState.currentDragSlide.style.left = newX + 'px';
        treeState.currentDragSlide.style.top = newY + 'px';
        
        // Mettre à jour la position dans state.slides
        const slideData = state.slides.find(s => s.id == treeState.currentDragSlideId);
        if (slideData) {
            slideData.treeX = newX;
            slideData.treeY = newY;
        }
        
        drawConnections();
    }
}

function handleScenarioMouseUp(e) {
    // Fin du pan
    if (treeState.isPanning) {
        treeState.isPanning = false;
        document.body.style.cursor = 'default';
        const canvas = document.getElementById('treeCanvas');
        if (canvas) canvas.style.cursor = 'grab';
    }
    
    // Fin du drag d'une slide
    if (treeState.isDraggingSlide) {
        treeState.isDraggingSlide = false;
        if (treeState.currentDragSlide) {
            treeState.currentDragSlide.style.zIndex = '';
            treeState.currentDragSlide.classList.remove('dragging');
        }
        treeState.currentDragSlide = null;
        document.body.style.cursor = 'default';
        saveProject();
    }
}

function renderTreeNodes() {
    const container = document.getElementById('treeNodes');
    if (!container) return;
    container.innerHTML = '';
    
    state.slides.forEach((slide, index) => {
        if (slide.treeX === null || slide.treeX === undefined) {
            const cols = Math.ceil(Math.sqrt(state.slides.length * 1.5));
            slide.treeX = 100 + (index % cols) * 300;
            slide.treeY = 100 + Math.floor(index / cols) * 200;
        }
        
        const card = createScenarioSlideCard(slide, index);
        container.appendChild(card);
    });
}

function createScenarioSlideCard(slide, index) {
    const card = document.createElement('div');
    const isCurrent = index === state.currentSlideIndex;
    
    card.className = 'scenario-slide-card' + (isCurrent ? ' current' : '');
    card.dataset.slideId = slide.id;
    card.dataset.index = index;
    card.style.left = slide.treeX + 'px';
    card.style.top = slide.treeY + 'px';
    
    const previewContent = generateScenarioPreview(slide);
    
    card.innerHTML = `
        <div class="scenario-card-header">
            <span class="scenario-card-title">Slide ${index + 1}</span>
            <i class="fas fa-grip-lines scenario-handle"></i>
        </div>
        <div class="scenario-card-body">
            ${previewContent}
        </div>
    `;
    
    setupScenarioCardEvents(card, slide, index);
    
    return card;
}

function generateScenarioPreview(slide) {
    let html = '<div class="scenario-preview" style="background:' + slide.backgroundColor + ';">';
    
    slide.elements.slice(0, 4).forEach(elem => {
        const scale = 0.12;
        const style = `position:absolute;left:${elem.x * scale}px;top:${elem.y * scale}px;width:${elem.width * scale}px;height:${elem.height * scale}px;overflow:hidden;`;
        
        switch(elem.type) {
            case 'text':
                html += `<div style="${style}font-size:${Math.max(3, elem.fontSize * scale)}px;color:${elem.color};">${elem.content.substring(0, 20)}</div>`;
                break;
            case 'image':
                html += `<div style="${style}"><img src="${elem.src}" style="width:100%;height:100%;object-fit:cover;border-radius:2px;"></div>`;
                break;
            case 'shape':
                html += `<div style="${style}">${renderShape(elem.shape, elem.color || '#cc6699')}</div>`;
                break;
        }
    });
    
    html += '</div>';
    return html;
}

function setupScenarioCardEvents(card, slide, index) {
    const handle = card.querySelector('.scenario-handle');
    
    // Drag par la poignée
    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        treeState.isDraggingSlide = true;
        treeState.currentDragSlide = card;
        treeState.currentDragSlideId = slide.id;
        
        treeState.startX = e.clientX;
        treeState.startY = e.clientY;
        treeState.initialLeft = card.offsetLeft;
        treeState.initialTop = card.offsetTop;
        
        card.style.zIndex = '100';
        card.classList.add('dragging');
        document.body.style.cursor = 'grabbing';
    });
    
    // Double-clic pour éditer la slide
    card.addEventListener('dblclick', () => {
        state.currentSlideIndex = index;
        updateSlidesList();
        renderCurrentSlide();
        updateSlideCounter();
        closeTreeFullscreen();
    });
    
    // Clic simple pour sélectionner
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.scenario-handle')) {
            document.querySelectorAll('.scenario-slide-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        }
    });
}

// Synchronisation automatique des connexions depuis les éléments navlink
function syncConnectionsFromNavLinks() {
    // Parcourir toutes les slides et leurs éléments navlink
    state.slides.forEach(slide => {
        const navlinks = slide.elements.filter(el => el.type === 'navlink' && el.targetSlideId);
        
        navlinks.forEach(navlink => {
            const fromId = slide.id;
            const toId = navlink.targetSlideId;
            
            // Vérifier si la connexion existe déjà
            const existingIndex = treeState.connections.findIndex(c => 
                c.from == fromId && c.to == toId && c.navLinkId == navlink.id
            );
            
            if (existingIndex !== -1) {
                // Mettre à jour la couleur si elle a changé
                treeState.connections[existingIndex].color = navlink.color || '#cc6699';
                treeState.connections[existingIndex].label = navlink.label || '';
            } else if (fromId != toId) {
                // Créer la connexion si elle n'existe pas
                const connection = {
                    id: `navlink-conn-${navlink.id}`,
                    from: fromId,
                    to: toId,
                    label: navlink.label || '',
                    color: navlink.color || '#cc6699',  // Utiliser la couleur du navlink
                    fromNavLink: true,  // Marqueur pour identifier les connexions auto
                    navLinkId: navlink.id
                };
                treeState.connections.push(connection);
            }
        });
    });
    
    // Redessiner les connexions si la vue arborescence est ouverte
    if (document.getElementById('treeFullscreen')?.classList.contains('active')) {
        drawConnections();
    }
}

// Supprimer une connexion liée à un navlink spécifique
function removeNavLinkConnection(slideId, targetSlideId) {
    treeState.connections = treeState.connections.filter(c => 
        !(c.from == slideId && c.to == targetSlideId && c.fromNavLink)
    );
    
    if (document.getElementById('treeFullscreen')?.classList.contains('active')) {
        drawConnections();
    }
}

function drawConnections() {
    const svg = document.getElementById('treeSvg');
    if (!svg) return;
    
    svg.innerHTML = '';
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    // Créer les filtres et styles de base
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
    
    // Créer des marqueurs dynamiques pour chaque couleur de connexion
    const usedColors = new Set();
    treeState.connections.forEach(conn => {
        const color = conn.color || '#cc6699';
        usedColors.add(color);
    });
    
    usedColors.forEach(color => {
        const colorId = color.replace('#', '');
        defsContent += `
            <marker id="arrowhead-${colorId}" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 12 4 L 0 8 L 2 4 Z" fill="${color}"/>
            </marker>
        `;
    });
    
    defs.innerHTML = defsContent;
    svg.appendChild(defs);
    
    treeState.connections.forEach((conn, index) => {
        const fromSlide = state.slides.find(s => s.id == conn.from);
        const toSlide = state.slides.find(s => s.id == conn.to);
        
        if (!fromSlide || !toSlide) return;
        
        const fromCard = document.querySelector(`.scenario-slide-card[data-slide-id="${conn.from}"]`);
        const toCard = document.querySelector(`.scenario-slide-card[data-slide-id="${conn.to}"]`);
        
        if (!fromCard || !toCard) return;
        
        // Utiliser les positions stockées dans les données des slides (pas affectées par le zoom)
        const zoom = treeState.zoom || 1;
        
        // Obtenir les dimensions des cartes (sans zoom) - correspond au CSS
        const cardWidth = 260;  // Largeur fixe des cartes scenario
        const cardHeight = 150; // Hauteur minimale des cartes scenario
        
        // Positions des cartes depuis les données (coordonnées dans l'espace non-zoomé)
        const fromX = fromSlide.treeX;
        const fromY = fromSlide.treeY;
        const toX = toSlide.treeX;
        const toY = toSlide.treeY;
        
        // Calculer les centres des cartes
        const fromCenterX = fromX + cardWidth / 2;
        const fromCenterY = fromY + cardHeight / 2;
        const toCenterX = toX + cardWidth / 2;
        const toCenterY = toY + cardHeight / 2;
        
        // Calculer la différence de position
        const dx = toCenterX - fromCenterX;
        const dy = toCenterY - fromCenterY;
        
        // Déterminer le meilleur côté pour la connexion
        let x1, y1, x2, y2;
        let exitSide, entrySide;
        
        // Calculer les bords des cartes (dans l'espace non-zoomé)
        const fromLeft = fromX;
        const fromRight = fromX + cardWidth;
        const fromTop = fromY;
        const fromBottom = fromY + cardHeight;
        
        const toLeft = toX;
        const toRight = toX + cardWidth;
        const toTop = toY;
        const toBottom = toY + cardHeight;
        
        // Déterminer la direction principale (horizontale ou verticale)
        if (Math.abs(dx) > Math.abs(dy)) {
            // Connexion principalement horizontale
            if (dx > 0) {
                // La cible est à droite
                x1 = fromRight;
                y1 = fromCenterY;
                x2 = toLeft;
                y2 = toCenterY;
                exitSide = 'right';
                entrySide = 'left';
            } else {
                // La cible est à gauche
                x1 = fromLeft;
                y1 = fromCenterY;
                x2 = toRight;
                y2 = toCenterY;
                exitSide = 'left';
                entrySide = 'right';
            }
        } else {
            // Connexion principalement verticale
            if (dy > 0) {
                // La cible est en bas
                x1 = fromCenterX;
                y1 = fromBottom;
                x2 = toCenterX;
                y2 = toTop;
                exitSide = 'bottom';
                entrySide = 'top';
            } else {
                // La cible est en haut
                x1 = fromCenterX;
                y1 = fromTop;
                x2 = toCenterX;
                y2 = toBottom;
                exitSide = 'top';
                entrySide = 'bottom';
            }
        }
        
        // Couleur de la connexion
        const connColor = conn.color || '#cc6699';
        const colorId = connColor.replace('#', '');
        
        // Créer un groupe pour la connexion
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('connection-group');
        group.dataset.connectionId = conn.id;
        
        // Calculer les points de contrôle pour une courbe de Bézier élégante
        let cp1x, cp1y, cp2x, cp2y;
        const curveStrength = Math.min(Math.abs(dx), Math.abs(dy), 80) + 40;
        
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
        
        const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
        
        // Créer une ligne d'arrière-plan pour l'effet de glow
        const pathBg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathBg.setAttribute('d', d);
        pathBg.setAttribute('stroke', connColor);
        pathBg.setAttribute('stroke-width', '10');
        pathBg.setAttribute('fill', 'none');
        pathBg.setAttribute('stroke-linecap', 'round');
        pathBg.setAttribute('opacity', '0.15');
        pathBg.classList.add('connection-bg');
        group.appendChild(pathBg);
        
        // Créer la ligne principale avec la couleur complète
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
            // Calculer le point milieu de la courbe de Bézier
            const t = 0.5;
            const midX = Math.pow(1-t,3)*x1 + 3*Math.pow(1-t,2)*t*cp1x + 3*(1-t)*Math.pow(t,2)*cp2x + Math.pow(t,3)*x2;
            const midY = Math.pow(1-t,3)*y1 + 3*Math.pow(1-t,2)*t*cp1y + 3*(1-t)*Math.pow(t,2)*cp2y + Math.pow(t,3)*y2 - 12;
            
            // Fond du label
            const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            const textLength = conn.label.length * 7 + 16;
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
    });
}

function addSlideFromTree() {
    addSlide();
    const lastSlide = state.slides[state.slides.length - 2];
    const newSlide = state.slides[state.slides.length - 1];
    
    if (lastSlide && lastSlide.treeX !== undefined) {
        newSlide.treeX = lastSlide.treeX + 300;
        newSlide.treeY = lastSlide.treeY;
    }
    
    renderTreeNodes();
    drawConnections();
    saveProject();
}

function resetTreeLayout() {
    const cols = Math.ceil(Math.sqrt(state.slides.length * 1.5));
    state.slides.forEach((slide, index) => {
        slide.treeX = 100 + (index % cols) * 300;
        slide.treeY = 100 + Math.floor(index / cols) * 200;
    });
    
    renderTreeNodes();
    drawConnections();
    saveProject();
}

// ==========================================
// 8. PRÉSENTATION & APERÇU (MODE LECTURE)
// ==========================================

function startPresentationFromTree() {
    closeTreeFullscreen();
    startPresentation();
}

function startPresentation(){
    presentationMode.classList.add('active');
    state.presentationPath = buildPresentationPath();
    state.presentationStep = 0;
    state.presentationCurrentSlideIndex = state.presentationPath ? state.presentationPath[0] : 0;
    state.presentationHistory = []; // Reset de l'historique des choix
    updateBackButtonVisibility();
    renderPresentationSlide();
    document.addEventListener('keydown',handlePresentationKeys);
}

function buildPresentationPath() {
    if (!treeState.connections || treeState.connections.length === 0) {
        return state.slides.map((s, i) => i);
    }
    
    const path = [];
    const visited = new Set();
    let currentSlideId = state.slides[0]?.id;
    
    while (currentSlideId && !visited.has(currentSlideId)) {
        visited.add(currentSlideId);
        const slideIndex = state.slides.findIndex(s => s.id === currentSlideId);
        if (slideIndex !== -1) path.push(slideIndex);
        
        const nextConnection = treeState.connections.find(c => c.from == currentSlideId);
        if (nextConnection) currentSlideId = nextConnection.to;
        else currentSlideId = null;
    }
    
    state.slides.forEach((slide, index) => {
        if (!visited.has(slide.id)) path.push(index);
    });
    
    return path.length > 0 ? path : state.slides.map((s, i) => i);
}

function exitPresentation(){
    presentationMode.classList.remove('active');
    document.removeEventListener('keydown',handlePresentationKeys);
    state.presentationPath = null;
    state.presentationStep = 0;
    state.presentationCurrentSlideIndex = 0;
}

function renderPresentationSlide(){
    const slideIndex = state.presentationPath ? state.presentationPath[state.presentationStep] : state.presentationStep;
    const slide = state.slides[slideIndex];
    if (!slide) return;
    
    // Mettre à jour l'index de la slide actuellement affichée
    state.presentationCurrentSlideIndex = slideIndex;
    
    const container = document.getElementById('presentationSlide');
    container.innerHTML = ''; 
    
    const scaleX = window.innerWidth / 960;
    const scaleY = (window.innerHeight - 60) / 540;
    const scale = Math.min(scaleX, scaleY);
    
    let html = `<div class="presentation-slide-content" style="background:${slide.backgroundColor};width:${960*scale}px;height:${540*scale}px;">`;
    html += renderPresentationContent(slide, scale).replace(/<div class="resize-handle[^>]*><\/div>/g, ''); 
    html += '</div>';
    
    container.innerHTML = html;
    
    // Ajouter les écouteurs de clic sur les navlinks
    container.querySelectorAll('.navlink-element').forEach(navElement => {
        navElement.style.cursor = 'pointer';
        navElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetSlideId = parseInt(navElement.dataset.targetSlideId);
            if (targetSlideId) {
                // Sauvegarder la slide actuelle dans l'historique avant de naviguer
                const currentSlide = state.slides[state.presentationCurrentSlideIndex];
                if (currentSlide) {
                    state.presentationHistory.push(currentSlide.id);
                    updateBackButtonVisibility();
                }
                navigateToSlideById(targetSlideId);
            }
        });
    });
    
    document.getElementById('presCounter').textContent = (slideIndex + 1) + ' / ' + state.slides.length;
}

// Rendu spécifique pour le mode présentation avec support des navlinks cliquables
function renderPresentationContent(slide, scale = 1) {
    if (!slide.elements || !Array.isArray(slide.elements)) return '';
    
    return slide.elements.map(elem => {
        const style = `position:absolute;left:${elem.x * scale}px;top:${elem.y * scale}px;width:${elem.width * scale}px;height:${elem.height * scale}px;`;
        
        switch(elem.type) {
            case 'text':
                const scaledFontSize = (elem.fontSize || 24) * scale;
                return `<div class="slide-element text-element" data-id="${elem.id}" style="${style}font-family:${elem.fontFamily};font-size:${scaledFontSize}px;color:${elem.color};font-weight:${elem.bold?'bold':'normal'};font-style:${elem.italic?'italic':'normal'};text-decoration:${elem.underline?'underline':'none'};text-align:${elem.textAlign||'left'};">${elem.content}</div>`;
            case 'image':
                return `<div class="slide-element image-element" data-id="${elem.id}" style="${style}"><img src="${elem.src}" alt="Image" style="width:100%;height:100%;object-fit:contain;"></div>`;
            case 'shape':
                return `<div class="slide-element shape-element" data-id="${elem.id}" style="${style}">${renderShape(elem.shape, elem.color || '#7c3aed')}</div>`;
            case 'navlink':
                const targetIndex = state.slides.findIndex(s => s.id === elem.targetSlideId);
                const targetLabel = targetIndex !== -1 ? `Slide ${targetIndex + 1}` : 'Non défini';
                const scaledNavFontSize = 14 * scale;
                return `<div class="slide-element navlink-element" data-id="${elem.id}" data-target-slide-id="${elem.targetSlideId}" style="${style}background-color:${elem.color};display:flex;align-items:center;justify-content:center;color:white;font-size:${scaledNavFontSize}px;box-shadow:0 4px 15px rgba(0,0,0,0.1);border-radius:8px;transition:transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.2)';" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 4px 15px rgba(0,0,0,0.1)';"><i class="fas fa-arrow-right" style="margin-right:5px"></i>${elem.label || targetLabel}</div>`;
        }
        return '';
    }).join('');
}

// Naviguer vers une slide spécifique par son ID (téléportation directe)
function navigateToSlideById(targetSlideId) {
    // Trouver l'index de la slide cible
    const targetSlideIndex = state.slides.findIndex(s => s.id === targetSlideId);
    
    if (targetSlideIndex === -1) return;
    
    // Afficher directement la slide cible sans modifier le chemin
    renderPresentationSlideByIndex(targetSlideIndex);
}

// Afficher une slide spécifique par son index (pour la navigation par navlink)
function renderPresentationSlideByIndex(slideIndex) {
    const slide = state.slides[slideIndex];
    if (!slide) return;
    
    // Mettre à jour l'index de la slide actuellement affichée
    state.presentationCurrentSlideIndex = slideIndex;
    
    // Mettre à jour le step pour refléter la position actuelle
    // On cherche si cette slide est dans le path, sinon on garde l'index direct
    if (state.presentationPath) {
        const stepInPath = state.presentationPath.indexOf(slideIndex);
        if (stepInPath !== -1) {
            state.presentationStep = stepInPath;
        }
    }
    
    const container = document.getElementById('presentationSlide');
    container.innerHTML = ''; 
    
    const scaleX = window.innerWidth / 960;
    const scaleY = (window.innerHeight - 60) / 540;
    const scale = Math.min(scaleX, scaleY);
    
    let html = `<div class="presentation-slide-content" style="background:${slide.backgroundColor};width:${960*scale}px;height:${540*scale}px;">`;
    html += renderPresentationContent(slide, scale).replace(/<div class="resize-handle[^>]*><\/div>/g, ''); 
    html += '</div>';
    
    container.innerHTML = html;
    
    // Ajouter les écouteurs de clic sur les navlinks
    container.querySelectorAll('.navlink-element').forEach(navElement => {
        navElement.style.cursor = 'pointer';
        navElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetSlideId = parseInt(navElement.dataset.targetSlideId);
            if (targetSlideId) {
                // Sauvegarder la slide actuelle dans l'historique avant de naviguer
                const currentSlide = state.slides[state.presentationCurrentSlideIndex];
                if (currentSlide) {
                    state.presentationHistory.push(currentSlide.id);
                    updateBackButtonVisibility();
                }
                navigateToSlideById(targetSlideId);
            }
        });
    });
    
    // Mettre à jour le compteur avec la position réelle
    const displayIndex = slideIndex + 1;
    const total = state.slides.length;
    document.getElementById('presCounter').textContent = `${displayIndex} / ${total}`;
}

function navigatePresentation(direction){
    // Utiliser l'index de la slide actuellement affichée
    const currentIndex = state.presentationCurrentSlideIndex;
    const newIndex = currentIndex + direction;
    
    // Vérifier les limites
    if (newIndex >= 0 && newIndex < state.slides.length) {
        // Mettre à jour le step si on est dans un path
        if (state.presentationPath) {
            const stepInPath = state.presentationPath.indexOf(newIndex);
            if (stepInPath !== -1) {
                state.presentationStep = stepInPath;
            }
        } else {
            state.presentationStep = newIndex;
        }
        
        // Afficher directement la slide suivante/précédente
        state.presentationCurrentSlideIndex = newIndex;
        renderPresentationSlideByIndex(newIndex);
    }
}

function handlePresentationKeys(e){
    if(e.key==='ArrowRight'||e.key===' '||e.key==='Enter'){
        navigatePresentation(1);
    }else if(e.key==='ArrowLeft'){
        presentationGoBack(); // Utilise le retour par historique
    }else if(e.key==='Escape'){
        exitPresentation();
    }
}

// Fonction pour revenir en arrière dans l'historique des choix
function presentationGoBack() {
    if (!state.presentationHistory || state.presentationHistory.length === 0) {
        // Si pas d'historique, navigation simple en arrière
        navigatePresentation(-1);
        return;
    }
    
    // Récupérer la dernière slide de l'historique
    const lastSlideId = state.presentationHistory.pop();
    const lastIndex = state.slides.findIndex(s => s.id === lastSlideId);
    
    if (lastIndex !== -1) {
        state.presentationCurrentSlideIndex = lastIndex;
        renderPresentationSlideByIndex(lastIndex);
    }
    
    updateBackButtonVisibility();
}

// Afficher/Cacher le bouton retour selon l'historique
function updateBackButtonVisibility() {
    const btn = document.getElementById('presPrev');
    if (!btn) return;
    
    // Toujours visible mais avec un style différent si historique vide
    if (state.presentationHistory && state.presentationHistory.length > 0) {
        btn.style.opacity = '1';
        btn.title = 'Revenir au choix précédent';
    } else if (state.presentationCurrentSlideIndex > 0) {
        btn.style.opacity = '0.6';
        btn.title = 'Slide précédente';
    } else {
        btn.style.opacity = '0.3';
        btn.title = 'Début de la présentation';
    }
}

function exportPresentation(){
    const projectName = localStorage.getItem('current_project_name') || 'presentation';
    const data=JSON.stringify(state.slides,null,2);
    const blob=new Blob([data],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`${projectName}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Importer une présentation depuis un fichier JSON
function importPresentation() {
    const fileInput = document.getElementById('importFileInput');
    fileInput.click();
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedSlides = JSON.parse(e.target.result);
            
            // Vérifier que c'est un tableau valide
            if (!Array.isArray(importedSlides)) {
                alert('Fichier invalide : le format attendu est un tableau de slides.');
                return;
            }
            
            // Vérifier la structure basique des slides
            const isValid = importedSlides.every(slide => 
                slide.id !== undefined && 
                Array.isArray(slide.elements)
            );
            
            if (!isValid) {
                alert('Fichier invalide : structure de slides incorrecte.');
                return;
            }
            
            // Remplacer les slides actuelles par les slides importées
            state.slides = importedSlides;
            state.currentSlideIndex = 0;
            state.selectedElement = null;
            
            // Synchroniser les connexions depuis les navlinks importés
            treeState.connections = [];
            syncConnectionsFromNavLinks();
            
            // Mettre à jour l'interface
            updateSlidesList();
            renderCurrentSlide();
            updateSlideCounter();
            hideElementProperties();
            
            // Sauvegarder le projet importé
            saveProject();
            
            alert(`Présentation importée avec succès ! ${importedSlides.length} slide(s) chargée(s).`);
            
        } catch (error) {
            console.error('Erreur lors de l\'import:', error);
            alert('Erreur lors de l\'importation du fichier. Vérifiez que c\'est un fichier JSON valide.');
        }
    };
    
    reader.readAsText(file);
    
    // Reset l'input pour permettre de réimporter le même fichier
    event.target.value = '';
}

function goBackInPreview() {}
function closeScenarioPreview() {}