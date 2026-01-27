// ==========================================
// 1. IMPORTS & CONFIGURATION
// ==========================================

import { sauvegarderProjet, chargerProjet, surveillerSession } from '../database.js';

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
    presentationHistory: [] 
};

// État de l'Arborescence (Fusionné)
let treeState = {
    connections: [],          // Liste des connexions
    connectMode: false,       // Mode "tracer des traits" activé ou non
    connectFrom: null,        // Point de départ d'une connexion
    
    // Variables pour le déplacement des nœuds
    isDraggingSlide: false,
    currentDragSlide: null,
    currentDragSlideId: null,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
    
    // Variables pour le tracé de ligne
    isDrawingLine: false,
    tempLine: null,
    startSocket: null,
    startSocketSlideId: null
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
    
    // ARBORESCENCE (Les boutons qui posaient problème)
    document.getElementById('addSlideTreeBtn')?.addEventListener('click', addSlideFromTree);
    document.getElementById('resetTreeBtn')?.addEventListener('click', resetTreeLayout);
    document.getElementById('clearConnectionsBtn')?.addEventListener('click', clearAllConnections);
    
    // IMPORTANT : On attache toggleConnectMode ici
    const btnConnect = document.getElementById('connectModeBtn');
    if(btnConnect) btnConnect.addEventListener('click', toggleConnectMode);

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
    document.getElementById('deleteElement')?.addEventListener('click',deleteSelectedElement);
    
    // Présentation & Export
    document.getElementById('presentBtn')?.addEventListener('click',startPresentation);
    document.getElementById('presExit')?.addEventListener('click',exitPresentation);
    document.getElementById('presPrev')?.addEventListener('click',()=>navigatePresentation(-1));
    document.getElementById('presNext')?.addEventListener('click',()=>navigatePresentation(1));
    document.getElementById('exportBtn')?.addEventListener('click',exportPresentation);
    
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
                return`<div class="slide-element shape-element ${selected}" data-id="${elem.id}" style="${style}">${renderShape(elem.shape,elem.color||'#7c3aed')}${resizeHandles}</div>`;
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
        case'triangle':return`<div style="width:0;height:0;border-left:50% solid transparent;border-right:50% solid transparent;border-bottom:100% solid ${color};"></div>`;
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
    
    if(textContentRow) textContentRow.style.display = 'none';
    if(navLinkRow) navLinkRow.style.display = 'none';
    if(navLinkLabelRow) navLinkLabelRow.style.display = 'none';
    if(navLinkColorRow) navLinkColorRow.style.display = 'none';
    
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
        document.getElementById('navLinkColor').value = state.selectedElement.color || '#cc6699';
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
        state.selectedElement.targetSlideId = parseInt(document.getElementById('targetSlideSelect').value);
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

function setupScenarioEvents() {
    scenarioMouseMoveHandler = handleScenarioMouseMove;
    scenarioMouseUpHandler = handleScenarioMouseUp;
    document.addEventListener('mousemove', scenarioMouseMoveHandler);
    document.addEventListener('mouseup', scenarioMouseUpHandler);
}

function cleanupScenarioEvents() {
    if (scenarioMouseMoveHandler) {
        document.removeEventListener('mousemove', scenarioMouseMoveHandler);
    }
    if (scenarioMouseUpHandler) {
        document.removeEventListener('mouseup', scenarioMouseUpHandler);
    }
}

// C'EST ICI QUE LE BUG ÉTAIT : La fonction manquait
function toggleConnectMode() {
    treeState.connectMode = !treeState.connectMode;
    treeState.connectFrom = null;
    
    const btn = document.getElementById('connectModeBtn');
    if(btn) {
        if(treeState.connectMode) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-times"></i> Annuler';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fas fa-link"></i> Connecter';
        }
    }
}

function handleScenarioMouseMove(e) {
    const canvas = document.getElementById('treeCanvas');
    if (!canvas) return;

    // Déplacement d'une slide
    if (treeState.isDraggingSlide && treeState.currentDragSlide) {
        e.preventDefault();
        const dx = e.clientX - treeState.startX;
        const dy = e.clientY - treeState.startY;
        
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

    // Tracé d'une ligne temporaire
    if (treeState.isDrawingLine && treeState.tempLine) {
        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left + canvas.scrollLeft;
        const mouseY = e.clientY - canvasRect.top + canvas.scrollTop;
        const lineStartX = parseFloat(treeState.tempLine.dataset.startX);
        const lineStartY = parseFloat(treeState.tempLine.dataset.startY);
        
        const d = `M ${lineStartX} ${lineStartY} L ${mouseX} ${mouseY}`;
        treeState.tempLine.setAttribute('d', d);
    }
}

function handleScenarioMouseUp(e) {
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

    // Fin du tracé d'une connexion
    if (treeState.isDrawingLine) {
        const targetSlide = e.target.closest('.scenario-slide-card');
        
        if (targetSlide && treeState.startSocketSlideId) {
            const targetSlideId = targetSlide.dataset.slideId;
            if (targetSlideId != treeState.startSocketSlideId) {
                createScenarioConnection(treeState.startSocketSlideId, targetSlideId);
            }
        }
        
        // Nettoyer la ligne temporaire
        if (treeState.tempLine) {
            treeState.tempLine.remove();
            treeState.tempLine = null;
        }
        treeState.isDrawingLine = false;
        treeState.startSocket = null;
        treeState.startSocketSlideId = null;
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
        <div class="scenario-socket" title="Tirer pour relier à une autre slide"></div>
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
    const socket = card.querySelector('.scenario-socket');
    
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
    
    // Clic sur le socket pour créer une connexion
    socket.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startDrawingConnection(socket, slide.id);
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
        if (!e.target.closest('.scenario-socket') && !e.target.closest('.scenario-handle')) {
            document.querySelectorAll('.scenario-slide-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        }
    });
}

function startDrawingConnection(socketElement, slideId) {
    const canvas = document.getElementById('treeCanvas');
    const svg = document.getElementById('treeSvg');
    if (!canvas || !svg) return;
    
    treeState.isDrawingLine = true;
    treeState.startSocket = socketElement;
    treeState.startSocketSlideId = slideId;
    
    const rect = socketElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - canvasRect.left + canvas.scrollLeft;
    const y = rect.top + rect.height / 2 - canvasRect.top + canvas.scrollTop;
    
    const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempLine.setAttribute('stroke', '#cc6699');
    tempLine.setAttribute('stroke-width', '3');
    tempLine.setAttribute('fill', 'none');
    tempLine.setAttribute('stroke-dasharray', '5,5');
    tempLine.dataset.startX = x;
    tempLine.dataset.startY = y;
    
    svg.appendChild(tempLine);
    treeState.tempLine = tempLine;
}

function createScenarioConnection(fromId, toId) {
    const exists = treeState.connections.some(c => c.from == fromId && c.to == toId);
    if (exists || fromId == toId) return;
    
    const connection = {
        id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: fromId,
        to: toId,
        label: '' 
    };
    
    treeState.connections.push(connection);
    drawConnections();
    saveProject();
}

function drawConnections() {
    const svg = document.getElementById('treeSvg');
    if (!svg) return;
    
    const tempLine = treeState.tempLine;
    svg.innerHTML = '';
    if (tempLine) svg.appendChild(tempLine);
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#cc6699"/>
        </marker>
        <marker id="arrowhead-labeled" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#9b59b6"/>
        </marker>
    `;
    svg.appendChild(defs);
    
    treeState.connections.forEach((conn, index) => {
        const fromSlide = state.slides.find(s => s.id == conn.from);
        const toSlide = state.slides.find(s => s.id == conn.to);
        
        if (!fromSlide || !toSlide) return;
        
        const fromCard = document.querySelector(`.scenario-slide-card[data-slide-id="${conn.from}"]`);
        const toCard = document.querySelector(`.scenario-slide-card[data-slide-id="${conn.to}"]`);
        
        if (!fromCard || !toCard) return;
        
        const fromSocket = fromCard.querySelector('.scenario-socket');
        const canvasRect = slideCanvas.getBoundingClientRect(); // Use consistent ref if possible or treeCanvas
        
        // Note: Ici on recalcule positions par rapport au treeCanvas
        const tCanvas = document.getElementById('treeCanvas');
        const tRect = tCanvas.getBoundingClientRect();
        
        const fRect = fromSocket.getBoundingClientRect();
        const tCardRect = toCard.getBoundingClientRect();
        
        const x1 = fRect.left + fRect.width / 2 - tRect.left + tCanvas.scrollLeft;
        const y1 = fRect.top + fRect.height / 2 - tRect.top + tCanvas.scrollTop;
        
        const x2 = tCardRect.left - tRect.left + tCanvas.scrollLeft;
        const y2 = tCardRect.top + tCardRect.height / 2 - tRect.top + tCanvas.scrollTop;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const cp1x = x1 + Math.abs(x2 - x1) / 2;
        const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;
        
        path.setAttribute('d', d);
        path.setAttribute('stroke', conn.label ? '#9b59b6' : '#cc6699');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('marker-end', conn.label ? 'url(#arrowhead-labeled)' : 'url(#arrowhead)');
        path.classList.add('scenario-connection-line');
        path.style.cursor = 'pointer';
        path.dataset.connectionId = conn.id;
        
        svg.appendChild(path);
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

function clearAllConnections() {
    if (treeState.connections.length === 0) return;
    if (confirm('Supprimer toutes les connexions ?')) {
        treeState.connections = [];
        drawConnections();
        saveProject();
    }
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
}

function renderPresentationSlide(){
    const slideIndex = state.presentationPath ? state.presentationPath[state.presentationStep] : state.presentationStep;
    const slide = state.slides[slideIndex];
    if (!slide) return;
    
    const container = document.getElementById('presentationSlide');
    container.innerHTML = ''; 
    
    const scaleX = window.innerWidth / 960;
    const scaleY = (window.innerHeight - 60) / 540;
    const scale = Math.min(scaleX, scaleY);
    
    let html = `<div class="presentation-slide-content" style="background:${slide.backgroundColor};width:${960*scale}px;height:${540*scale}px;">`;
    html += renderSlideContent(slide).replace(/<div class="resize-handle[^>]*><\/div>/g, ''); 
    html += '</div>';
    
    container.innerHTML = html;
    
    document.getElementById('presCounter').textContent = (state.presentationStep + 1) + ' / ' + (state.presentationPath ? state.presentationPath.length : state.slides.length);
}

function navigatePresentation(direction){
    const totalSteps = state.presentationPath ? state.presentationPath.length : state.slides.length;
    const newStep = state.presentationStep + direction;
    if (newStep >= 0 && newStep < totalSteps) {
        state.presentationStep = newStep;
        renderPresentationSlide();
    }
}

function handlePresentationKeys(e){
    if(e.key==='ArrowRight'||e.key===' '||e.key==='Enter'){
        navigatePresentation(1);
    }else if(e.key==='ArrowLeft'){
        navigatePresentation(-1);
    }else if(e.key==='Escape'){
        exitPresentation();
    }
}

function exportPresentation(){
    const data=JSON.stringify(state.slides,null,2);
    const blob=new Blob([data],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='presentation.json';
    a.click();
    URL.revokeObjectURL(url);
}

function goBackInPreview() {}
function closeScenarioPreview() {}