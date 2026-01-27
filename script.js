const state={slides:[],currentSlideIndex:0,selectedElement:null,isDragging:false,isResizing:false,isEditing:false,dragOffset:{x:0,y:0},resizeHandle:null,projectIndex:null};
const history = { stack: [], index: -1, maxSize: 50 };
const slideCanvas=document.getElementById('slideCanvas');
const slidesList=document.getElementById('slidesList');
const slideCounter=document.getElementById('slideCounter');
const elementProperties=document.getElementById('elementProperties');
const shapeModal=document.getElementById('shapeModal');
const imageModal=document.getElementById('imageModal');
const presentationMode=document.getElementById('presentationMode');

document.addEventListener('DOMContentLoaded',()=>{
    loadProject();
    setupEventListeners();
});

// Charger le projet depuis localStorage
function loadProject() {
    const projectIndex = localStorage.getItem('slideflow_current_project');
    if (projectIndex !== null) {
        state.projectIndex = parseInt(projectIndex);
        const projects = JSON.parse(localStorage.getItem('slideflow_projects') || '[]');
        if (projects[state.projectIndex]) {
            state.slides = projects[state.projectIndex].slides;
            state.currentSlideIndex = 0;
        } else {
            state.slides = [{id: Date.now(), backgroundColor: '#ffffff', elements: []}];
        }
    } else {
        state.slides = [{id: Date.now(), backgroundColor: '#ffffff', elements: []}];
    }
    updateSlidesList();
    renderCurrentSlide();
    updateSlideCounter();
    updateNavButtons();
    // Initialiser l'historique avec l'état initial
    saveToHistory();
}

// Sauvegarder le projet dans localStorage
function saveProject() {
    if (state.projectIndex === null) return;
    const projects = JSON.parse(localStorage.getItem('slideflow_projects') || '[]');
    if (projects[state.projectIndex]) {
        projects[state.projectIndex].slides = state.slides;
        projects[state.projectIndex].updatedAt = Date.now();
        localStorage.setItem('slideflow_projects', JSON.stringify(projects));
    }
}


function setupEventListeners(){
    // Boutons du panneau latéral droit
    document.getElementById('addTextBtnSide').addEventListener('click',addTextElement);
    document.getElementById('addImageBtnSide').addEventListener('click',()=>imageModal.classList.add('active'));
    document.getElementById('addShapeBtnSide').addEventListener('click',()=>shapeModal.classList.add('active'));
    document.getElementById('addNavLinkBtnSide').addEventListener('click',addNavLinkElement);
    // Menu déroulant pour ajouter une slide
    document.getElementById('addSlideBtn').addEventListener('click', toggleAddSlideDropdown);
    document.querySelectorAll('#addSlideDropdown .dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            addSlideFromTemplate(item.dataset.template);
            closeAddSlideDropdown();
        });
    });
    // Fermer le dropdown si on clique ailleurs
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.add-slide-wrapper')) {
            closeAddSlideDropdown();
        }
    });
    document.getElementById('prevSlide').addEventListener('click',previousSlide);
    document.getElementById('nextSlide').addEventListener('click',nextSlide);
    document.getElementById('canvasArrowLeft').addEventListener('click',previousSlide);
    document.getElementById('canvasArrowRight').addEventListener('click',nextSlide);
    document.getElementById('listViewBtn').addEventListener('click',()=>switchView('list'));
    document.getElementById('treeFullscreenBtn').addEventListener('click',openTreeFullscreen);
    document.getElementById('closeTreeBtn').addEventListener('click',closeTreeFullscreen);
    document.getElementById('addSlideTreeBtn').addEventListener('click',addSlideFromTree);
    document.getElementById('resetTreeBtn').addEventListener('click',resetTreeLayout);
    document.getElementById('clearConnectionsBtn').addEventListener('click',clearAllConnections);
    document.getElementById('previewTreeBtn').addEventListener('click',startPresentationFromTree);
    document.getElementById('scenarioPreviewBack').addEventListener('click',goBackInPreview);
    document.getElementById('closeScenarioPreview').addEventListener('click',closeScenarioPreview);
    document.getElementById('boldBtn').addEventListener('click',()=>toggleFormat('bold'));
    document.getElementById('italicBtn').addEventListener('click',()=>toggleFormat('italic'));
    document.getElementById('underlineBtn').addEventListener('click',()=>toggleFormat('underline'));
    document.getElementById('alignLeftBtn').addEventListener('click',()=>setTextAlign('left'));
    document.getElementById('alignCenterBtn').addEventListener('click',()=>setTextAlign('center'));
    document.getElementById('alignRightBtn').addEventListener('click',()=>setTextAlign('right'));
    document.getElementById('textColorPicker').addEventListener('input',e=>setTextColor(e.target.value));
    document.getElementById('slideBgColor').addEventListener('input',e=>setSlideBgColor(e.target.value));
    document.getElementById('fontSelect').addEventListener('change',e=>setFont(e.target.value));
    document.getElementById('fontSizeSelect').addEventListener('change',e=>setFontSize(e.target.value));
    document.querySelectorAll('.shape-option').forEach(btn=>{
        btn.addEventListener('click',()=>{
            addShapeElement(btn.dataset.shape);
            shapeModal.classList.remove('active');
        });
    });
    document.getElementById('closeShapeModal').addEventListener('click',()=>shapeModal.classList.remove('active'));
    document.getElementById('imageInput').addEventListener('change',handleImageUpload);
    document.getElementById('addImageFromUrl').addEventListener('click',addImageFromUrl);
    document.getElementById('closeImageModal').addEventListener('click',()=>imageModal.classList.remove('active'));
    document.getElementById('elemX').addEventListener('input',updateElementPosition);
    document.getElementById('elemY').addEventListener('input',updateElementPosition);
    document.getElementById('elemWidth').addEventListener('input',updateElementSize);
    document.getElementById('elemHeight').addEventListener('input',updateElementSize);
    document.getElementById('elemTextContent').addEventListener('input',updateElementTextContent);
    document.getElementById('targetSlideSelect').addEventListener('change',updateNavLinkTarget);
    document.getElementById('navLinkLabel').addEventListener('input',updateNavLinkLabel);
    document.getElementById('navLinkColor').addEventListener('input',updateNavLinkColor);
    document.getElementById('deleteElement').addEventListener('click',deleteSelectedElement);
    document.getElementById('presentBtn').addEventListener('click',startPresentation);
    document.getElementById('presExit').addEventListener('click',exitPresentation);
    document.getElementById('presPrev').addEventListener('click',()=>navigatePresentation(-1));
    document.getElementById('presNext').addEventListener('click',()=>navigatePresentation(1));
    document.getElementById('exportBtn').addEventListener('click',exportPresentation);
    slideCanvas.addEventListener('mousedown',handleCanvasMouseDown);
    slideCanvas.addEventListener('click',handleCanvasClick);
    document.addEventListener('mousemove',handleMouseMove);
    document.addEventListener('mouseup',handleMouseUp);
    shapeModal.addEventListener('click',e=>{if(e.target===shapeModal)shapeModal.classList.remove('active')});
    imageModal.addEventListener('click',e=>{if(e.target===imageModal)imageModal.classList.remove('active')});
    
    // Raccourcis clavier globaux
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Gestion des raccourcis clavier
function handleKeyboardShortcuts(e) {
    // Ctrl+Z : Annuler
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    // Ctrl+Y ou Ctrl+Shift+Z : Rétablir
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
    }
}

// Sauvegarder l'état actuel dans l'historique
function saveToHistory() {
    // Supprimer les états futurs si on a fait des undo
    if (history.index < history.stack.length - 1) {
        history.stack = history.stack.slice(0, history.index + 1);
    }
    
    // Créer une copie profonde de l'état actuel
    const snapshot = {
        slides: JSON.parse(JSON.stringify(state.slides)),
        currentSlideIndex: state.currentSlideIndex
    };
    
    history.stack.push(snapshot);
    
    // Limiter la taille de l'historique
    if (history.stack.length > history.maxSize) {
        history.stack.shift();
    } else {
        history.index++;
    }
}

// Annuler la dernière action
function undo() {
    if (history.index > 0) {
        history.index--;
        restoreFromHistory();
    }
}

// Rétablir l'action annulée
function redo() {
    if (history.index < history.stack.length - 1) {
        history.index++;
        restoreFromHistory();
    }
}

// Restaurer l'état depuis l'historique
function restoreFromHistory() {
    const snapshot = history.stack[history.index];
    if (snapshot) {
        state.slides = JSON.parse(JSON.stringify(snapshot.slides));
        state.currentSlideIndex = snapshot.currentSlideIndex;
        state.selectedElement = null;
        updateSlidesList();
        renderCurrentSlide();
        updateSlideCounter();
        updateNavButtons();
        saveProject();
    }
}

function toggleAddSlideDropdown(e){
    e.stopPropagation();
    const dropdown = document.getElementById('addSlideDropdown');
    dropdown.classList.toggle('active');
}

function closeAddSlideDropdown(){
    const dropdown = document.getElementById('addSlideDropdown');
    dropdown.classList.remove('active');
}

function addSlideFromTemplate(template){
    saveToHistory();
    const slide = {id: Date.now(), backgroundColor: '#ffffff', elements: [], treeX: null, treeY: null};
    
    switch(template){
        case 'blank':
            // Slide vierge, pas d'éléments
            break;
        case 'title':
            slide.elements.push({
                id: Date.now(),
                type: 'text',
                x: 80,
                y: 200,
                width: 800,
                height: 80,
                content: 'Titre de la présentation',
                fontFamily: 'Inter',
                fontSize: 48,
                color: '#1e1e1e',
                bold: true,
                italic: false,
                underline: false
            });
            break;
        case 'titleText':
            slide.elements.push({
                id: Date.now(),
                type: 'text',
                x: 80,
                y: 60,
                width: 800,
                height: 60,
                content: 'Titre de la slide',
                fontFamily: 'Inter',
                fontSize: 40,
                color: '#1e1e1e',
                bold: true,
                italic: false,
                underline: false
            });
            slide.elements.push({
                id: Date.now() + 1,
                type: 'text',
                x: 80,
                y: 150,
                width: 800,
                height: 300,
                content: 'Ajoutez votre contenu ici...',
                fontFamily: 'Inter',
                fontSize: 20,
                color: '#333333',
                bold: false,
                italic: false,
                underline: false
            });
            break;
        case 'titleImage':
            slide.elements.push({
                id: Date.now(),
                type: 'text',
                x: 80,
                y: 40,
                width: 800,
                height: 50,
                content: 'Titre de la slide',
                fontFamily: 'Inter',
                fontSize: 36,
                color: '#1e1e1e',
                bold: true,
                italic: false,
                underline: false
            });
            slide.elements.push({
                id: Date.now() + 1,
                type: 'shape',
                shape: 'rectangle',
                x: 230,
                y: 120,
                width: 500,
                height: 350,
                color: '#e0e0e0'
            });
            break;
        case 'twoColumns':
            slide.elements.push({
                id: Date.now(),
                type: 'text',
                x: 80,
                y: 40,
                width: 800,
                height: 50,
                content: 'Titre de la slide',
                fontFamily: 'Inter',
                fontSize: 36,
                color: '#1e1e1e',
                bold: true,
                italic: false,
                underline: false
            });
            slide.elements.push({
                id: Date.now() + 1,
                type: 'text',
                x: 80,
                y: 120,
                width: 380,
                height: 350,
                content: 'Colonne gauche...',
                fontFamily: 'Inter',
                fontSize: 18,
                color: '#333333',
                bold: false,
                italic: false,
                underline: false
            });
            slide.elements.push({
                id: Date.now() + 2,
                type: 'text',
                x: 500,
                y: 120,
                width: 380,
                height: 350,
                content: 'Colonne droite...',
                fontFamily: 'Inter',
                fontSize: 18,
                color: '#333333',
                bold: false,
                italic: false,
                underline: false
            });
            break;
        case 'imageText':
            slide.elements.push({
                id: Date.now(),
                type: 'shape',
                shape: 'rectangle',
                x: 40,
                y: 70,
                width: 400,
                height: 400,
                color: '#e0e0e0'
            });
            slide.elements.push({
                id: Date.now() + 1,
                type: 'text',
                x: 480,
                y: 70,
                width: 440,
                height: 50,
                content: 'Titre',
                fontFamily: 'Inter',
                fontSize: 32,
                color: '#1e1e1e',
                bold: true,
                italic: false,
                underline: false
            });
            slide.elements.push({
                id: Date.now() + 2,
                type: 'text',
                x: 480,
                y: 140,
                width: 440,
                height: 330,
                content: 'Description ou contenu à côté de l\'image...',
                fontFamily: 'Inter',
                fontSize: 18,
                color: '#333333',
                bold: false,
                italic: false,
                underline: false
            });
            break;
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
    if(state.currentSlideIndex>=state.slides.length){
        state.currentSlideIndex=state.slides.length-1;
    }
    updateSlidesList();
    renderCurrentSlide();
    saveProject();
    updateSlideCounter();
}

function selectSlide(index){
    state.currentSlideIndex=index;
    state.selectedElement=null;
    updateSlidesList();
    updateTreeView();
    renderCurrentSlide();
    updateSlideCounter();
    updateNavButtons();
    hideElementProperties();
}

function previousSlide(){
    if(state.currentSlideIndex>0)selectSlide(state.currentSlideIndex-1);
}

function nextSlide(){
    if(state.currentSlideIndex<state.slides.length-1)selectSlide(state.currentSlideIndex+1);
}

function updateSlideCounter(){
    slideCounter.textContent=`${state.currentSlideIndex+1} / ${state.slides.length}`;
}

function updateNavButtons(){
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    const canvasLeft = document.getElementById('canvasArrowLeft');
    const canvasRight = document.getElementById('canvasArrowRight');
    
    const isFirst = state.currentSlideIndex === 0;
    const isLast = state.currentSlideIndex === state.slides.length - 1;
    
    prevBtn.disabled = isFirst;
    nextBtn.disabled = isLast;
    canvasLeft.disabled = isFirst;
    canvasRight.disabled = isLast;
}

function switchView(view){
    const listBtn = document.getElementById('listViewBtn');
    const treeBtn = document.getElementById('treeViewBtn');
    const listView = document.getElementById('slidesList');
    const treeView = document.getElementById('slidesTree');
    
    if(view === 'list'){
        listBtn.classList.add('active');
        treeBtn.classList.remove('active');
        listView.style.display = 'flex';
        treeView.style.display = 'none';
    } else {
        listBtn.classList.remove('active');
        treeBtn.classList.add('active');
        listView.style.display = 'none';
        treeView.style.display = 'flex';
        updateTreeView();
    }
}

function updateTreeView(){
    const treeView = document.getElementById('slidesTree');
    if(!treeView || treeView.style.display === 'none') return;
    
    let html = '';
    
    // Marqueur de début UML
    html += '<div class="tree-start-marker"><i class="fas fa-play"></i></div>';
    html += '<div class="tree-connector"><div class="tree-line"></div></div>';
    
    state.slides.forEach((slide, index) => {
        const isActive = index === state.currentSlideIndex;
        const title = getSlideTitle(slide);
        const elemCount = slide.elements.length;
        
        html += `
            <div class="tree-node ${isActive ? 'active' : ''}" data-index="${index}">
                <div class="tree-node-header">
                    <span class="tree-node-number">${index + 1}</span>
                    Slide ${index + 1}
                </div>
                <div class="tree-node-body">
                    <span class="tree-node-title">${title}</span>
                </div>
                <div class="tree-node-actions">
                    <button class="tree-action-btn" onclick="moveSlideUp(${index})" title="Monter" ${index === 0 ? 'disabled' : ''}>
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="tree-action-btn" onclick="moveSlideDown(${index})" title="Descendre" ${index === state.slides.length - 1 ? 'disabled' : ''}>
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button class="tree-action-btn delete" onclick="deleteSlide(${index})" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Ajouter connecteur entre les slides
        if(index < state.slides.length - 1){
            html += `
                <div class="tree-connector">
                    <div class="tree-line"></div>
                    <div class="tree-arrow" onclick="selectSlide(${index + 1})" title="Aller à la slide ${index + 2}"></div>
                    <div class="tree-line"></div>
                </div>
            `;
        }
    });
    
    // Marqueur de fin UML
    html += '<div class="tree-connector"><div class="tree-line"></div></div>';
    html += '<div class="tree-end-marker"></div>';
    
    treeView.innerHTML = html;
    
    // Ajouter les event listeners pour sélectionner les slides
    treeView.querySelectorAll('.tree-node').forEach(node => {
        node.addEventListener('click', (e) => {
            if(!e.target.closest('.tree-node-actions')){
                selectSlide(parseInt(node.dataset.index));
            }
        });
    });
}

function getSlideTitle(slide){
    const textElement = slide.elements.find(el => el.type === 'text');
    if(textElement){
        const text = textElement.content.replace(/<[^>]*>/g, '').substring(0, 25);
        return text || 'Sans titre';
    }
    return 'Slide vide';
}

function moveSlideUp(index){
    if(index <= 0) return;
    const temp = state.slides[index];
    state.slides[index] = state.slides[index - 1];
    state.slides[index - 1] = temp;
    if(state.currentSlideIndex === index) state.currentSlideIndex--;
    else if(state.currentSlideIndex === index - 1) state.currentSlideIndex++;
    updateSlidesList();
    updateTreeView();
    saveProject();
}

function moveSlideDown(index){
    if(index >= state.slides.length - 1) return;
    const temp = state.slides[index];
    state.slides[index] = state.slides[index + 1];
    state.slides[index + 1] = temp;
    if(state.currentSlideIndex === index) state.currentSlideIndex++;
    else if(state.currentSlideIndex === index + 1) state.currentSlideIndex--;
    updateSlidesList();
    updateTreeView();
    saveProject();
}

function updateSlidesList(){
    slidesList.innerHTML='';
    state.slides.forEach((slide,index)=>{
        const thumbnail=document.createElement('div');
        thumbnail.className=`slide-thumbnail ${index===state.currentSlideIndex?'active':''}`;
        thumbnail.innerHTML=`
            <div class="slide-thumbnail-content" style="background:${slide.backgroundColor};width:500%;height:500%;">
                ${renderSlideContent(slide,true)}
            </div>
            <span class="slide-number">${index+1}</span>
            <button class="slide-delete-btn" title="Supprimer"><i class="fas fa-times"></i></button>
        `;
        thumbnail.addEventListener('click',e=>{
            if(!e.target.closest('.slide-delete-btn'))selectSlide(index);
        });
        thumbnail.querySelector('.slide-delete-btn').addEventListener('click',e=>{
            e.stopPropagation();
            deleteSlide(index);
        });
        slidesList.appendChild(thumbnail);
    });
}

function renderCurrentSlide(){
    if(state.isEditing) return;
    const slide=state.slides[state.currentSlideIndex];
    slideCanvas.style.backgroundColor=slide.backgroundColor;
    slideCanvas.innerHTML=renderSlideContent(slide);
    slideCanvas.querySelectorAll('.slide-element').forEach(elem=>{
        setupElementEvents(elem);
    });
}

function renderSlideContent(slide,isThumbnail=false){
    return slide.elements.map(elem=>{
        const selected=!isThumbnail&&state.selectedElement?.id===elem.id?'selected':'';
        const style=`left:${elem.x}px;top:${elem.y}px;width:${elem.width}px;height:${elem.height}px;`;
        let content='';
        let resizeHandles='';
        if(!isThumbnail&&selected){
            resizeHandles=`<div class="resize-handle nw"></div><div class="resize-handle ne"></div><div class="resize-handle sw"></div><div class="resize-handle se"></div>`;
        }
        switch(elem.type){
            case'text':
                const textAlign = elem.textAlign || 'left';
                content=`<div class="slide-element text-element ${selected}" data-id="${elem.id}" style="${style}font-family:${elem.fontFamily};font-size:${elem.fontSize}px;color:${elem.color};font-weight:${elem.bold?'bold':'normal'};font-style:${elem.italic?'italic':'normal'};text-decoration:${elem.underline?'underline':'none'};text-align:${textAlign};">${elem.content}${resizeHandles}</div>`;
                break;
            case'image':
                content=`<div class="slide-element image-element ${selected}" data-id="${elem.id}" style="${style}"><img src="${elem.src}" alt="Image">${resizeHandles}</div>`;
                break;
            case'shape':
                content=`<div class="slide-element shape-element ${selected}" data-id="${elem.id}" style="${style}">${renderShape(elem.shape,elem.color||'#7c3aed')}${resizeHandles}</div>`;
                break;
            case'navlink':
                const targetIndex = state.slides.findIndex(s => s.id === elem.targetSlideId);
                const targetLabel = targetIndex !== -1 ? `Slide ${targetIndex + 1}` : 'Non défini';
                content=`<div class="slide-element navlink-element ${selected}" data-id="${elem.id}" data-target="${elem.targetSlideId}" style="${style}background-color:${elem.color};"><div class="navlink-content"><i class="fas fa-arrow-right"></i><span class="navlink-label">${elem.label || targetLabel}</span></div><div class="navlink-target-badge">${targetLabel}</div>${resizeHandles}</div>`;
                break;
        }
        return content;
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
    // Par défaut, cibler la slide suivante si elle existe, sinon la première
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

function updateNavLinkTarget(){
    if(!state.selectedElement || state.selectedElement.type !== 'navlink') return;
    const select = document.getElementById('targetSlideSelect');
    const targetSlideId = parseInt(select.value);
    state.selectedElement.targetSlideId = targetSlideId;
    const targetIndex = state.slides.findIndex(s => s.id === targetSlideId);
    if(targetIndex !== -1 && !document.getElementById('navLinkLabel').value.startsWith('Aller à la slide')){
        // Ne pas écraser si l'utilisateur a personnalisé
    }
    renderCurrentSlide();
    updateSlidesList();
    saveProject();
}

function updateNavLinkLabel(){
    if(!state.selectedElement || state.selectedElement.type !== 'navlink') return;
    state.selectedElement.label = document.getElementById('navLinkLabel').value || 'Lien';
    renderCurrentSlide();
    updateSlidesList();
    saveProject();
}

function updateNavLinkColor(){
    if(!state.selectedElement || state.selectedElement.type !== 'navlink') return;
    state.selectedElement.color = document.getElementById('navLinkColor').value;
    renderCurrentSlide();
    updateSlidesList();
    saveProject();
}

function populateTargetSlideSelect(){
    const select = document.getElementById('targetSlideSelect');
    select.innerHTML = '';
    state.slides.forEach((slide, index) => {
        // Ne pas afficher la slide actuelle comme option
        if(index !== state.currentSlideIndex){
            const option = document.createElement('option');
            option.value = slide.id;
            const title = getSlideTitle(slide);
            option.textContent = `Slide ${index + 1} - ${title}`;
            select.appendChild(option);
        }
    });
    // Sélectionner la valeur actuelle
    if(state.selectedElement && state.selectedElement.targetSlideId){
        select.value = state.selectedElement.targetSlideId;
    }
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
    if(!url)return;
    addImageElement(url);
    document.getElementById('imageUrlInput').value='';
    imageModal.classList.remove('active');
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
            document.execCommand('selectAll', false, null);
        }
    });
    
    if(elem.classList.contains('text-element')){
        elem.addEventListener('focus', ()=>{
            state.isEditing = true;
        });
        elem.addEventListener('blur',()=>{
            state.isEditing = false;
            elem.setAttribute('contenteditable', 'false');
            const id=parseInt(elem.dataset.id);
            const element=findElementById(id);
            if(element){
                let content = elem.innerHTML;
                content = content.replace(/<div class="resize-handle[^"]*"[^>]*><\/div>/g,'');
                element.content = content;
                updateSlidesList();
                saveProject();
            }
            renderCurrentSlide();
        });
        elem.addEventListener('input', ()=>{
            const id=parseInt(elem.dataset.id);
            const element=findElementById(id);
            if(element){
                let content = elem.innerHTML;
                content = content.replace(/<div class="resize-handle[^"]*"[^>]*><\/div>/g,'');
                element.content = content;
            }
        });
    }
}

function startDrag(e){
    const elem=e.target.closest('.slide-element');
    if(!elem || state.isEditing)return;
    e.preventDefault();
    saveToHistory();
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
    saveToHistory();
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
        newX=Math.max(0,Math.min(newX,canvasRect.width-state.selectedElement.width));
        newY=Math.max(0,Math.min(newY,canvasRect.height-state.selectedElement.height));
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
        let newX=state.startLeft;
        let newY=state.startTop;
        if(handle.includes('e'))newWidth=Math.max(50,state.startWidth+dx);
        if(handle.includes('w')){newWidth=Math.max(50,state.startWidth-dx);newX=state.startLeft+(state.startWidth-newWidth);}
        if(handle.includes('s'))newHeight=Math.max(50,state.startHeight+dy);
        if(handle.includes('n')){newHeight=Math.max(50,state.startHeight-dy);newY=state.startTop+(state.startHeight-newHeight);}
        state.selectedElement.width=Math.round(newWidth);
        state.selectedElement.height=Math.round(newHeight);
        state.selectedElement.x=Math.round(newX);
        state.selectedElement.y=Math.round(newY);
        renderCurrentSlide();
        updatePropertiesInputs();
    }
}

function handleMouseUp(){
    if(state.isDragging||state.isResizing){
        updateSlidesList();
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
        hideTextTools();
    }
}

function showTextTools(){
    document.getElementById('textTools').style.display = 'flex';
    updateTextToolsState();
}

function hideTextTools(){
    document.getElementById('textTools').style.display = 'none';
}

function updateTextToolsState(){
    if(!state.selectedElement || state.selectedElement.type !== 'text') return;
    
    // Mettre à jour l'état des boutons de formatage
    document.getElementById('boldBtn').classList.toggle('active', state.selectedElement.bold);
    document.getElementById('italicBtn').classList.toggle('active', state.selectedElement.italic);
    document.getElementById('underlineBtn').classList.toggle('active', state.selectedElement.underline);
    
    // Mettre à jour les boutons d'alignement
    const align = state.selectedElement.textAlign || 'left';
    document.getElementById('alignLeftBtn').classList.toggle('active', align === 'left');
    document.getElementById('alignCenterBtn').classList.toggle('active', align === 'center');
    document.getElementById('alignRightBtn').classList.toggle('active', align === 'right');
    
    // Mettre à jour les sélecteurs
    document.getElementById('fontSelect').value = state.selectedElement.fontFamily;
    document.getElementById('fontSizeSelect').value = state.selectedElement.fontSize;
    document.getElementById('textColorPicker').value = state.selectedElement.color;
}

function showElementProperties(){
    if(!state.selectedElement)return;
    elementProperties.style.display='block';
    const textContentRow = document.getElementById('textContentRow');
    const navLinkRow = document.getElementById('navLinkRow');
    const navLinkLabelRow = document.getElementById('navLinkLabelRow');
    const navLinkColorRow = document.getElementById('navLinkColorRow');
    
    // Masquer toutes les propriétés spécifiques par défaut
    textContentRow.style.display = 'none';
    navLinkRow.style.display = 'none';
    navLinkLabelRow.style.display = 'none';
    navLinkColorRow.style.display = 'none';
    
    if(state.selectedElement.type === 'text'){
        textContentRow.style.display = 'flex';
        showTextTools();
    } else {
        hideTextTools();
        if(state.selectedElement.type === 'navlink'){
            navLinkRow.style.display = 'flex';
            navLinkLabelRow.style.display = 'flex';
            navLinkColorRow.style.display = 'flex';
            populateTargetSlideSelect();
        }
    }
    updatePropertiesInputs();
}

function hideElementProperties(){
    elementProperties.style.display='none';
    document.getElementById('textContentRow').style.display = 'none';
    document.getElementById('navLinkRow').style.display = 'none';
    document.getElementById('navLinkLabelRow').style.display = 'none';
    document.getElementById('navLinkColorRow').style.display = 'none';
    hideTextTools();
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
        document.getElementById('targetSlideSelect').value = state.selectedElement.targetSlideId;
        document.getElementById('navLinkLabel').value = state.selectedElement.label || '';
        document.getElementById('navLinkColor').value = state.selectedElement.color || '#cc6699';
    }
}

function setTextAlign(align){
    if(!state.selectedElement || state.selectedElement.type !== 'text') return;
    state.selectedElement.textAlign = align;
    renderCurrentSlide();
    updateSlidesList();
    updateTextToolsState();
    saveProject();
}
function updateElementPosition(){
    if(!state.selectedElement)return;
    state.selectedElement.x=parseInt(document.getElementById('elemX').value)||0;
    state.selectedElement.y=parseInt(document.getElementById('elemY').value)||0;
    renderCurrentSlide();
    updateSlidesList();
    saveProject();
}

function updateElementSize(){
    if(!state.selectedElement)return;
    state.selectedElement.width=parseInt(document.getElementById('elemWidth').value)||50;
    state.selectedElement.height=parseInt(document.getElementById('elemHeight').value)||50;
    renderCurrentSlide();
    updateSlidesList();
    saveProject();
}

function updateElementTextContent(){
    if(!state.selectedElement || state.selectedElement.type !== 'text')return;
    const text = document.getElementById('elemTextContent').value;
    state.selectedElement.content = text.replace(/\n/g, '<br>');
    renderCurrentSlide();
    updateSlidesList();
    saveProject();
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
        updateSlidesList();
        saveProject();
    }
}

function toggleFormat(format){
    if(!state.selectedElement||state.selectedElement.type!=='text')return;
    state.selectedElement[format]=!state.selectedElement[format];
    renderCurrentSlide();
    updateSlidesList();
    saveProject();
}

function setTextColor(color){
    if(!state.selectedElement||state.selectedElement.type!=='text')return;
    state.selectedElement.color=color;
    renderCurrentSlide();
    updateSlidesList();
    saveProject();
}

function setFont(font){
    if(!state.selectedElement||state.selectedElement.type!=='text')return;
    state.selectedElement.fontFamily=font;
    renderCurrentSlide();
    updateSlidesList();
    saveProject();
}

function setFontSize(size){
    if(!state.selectedElement||state.selectedElement.type!=='text')return;
    state.selectedElement.fontSize=parseInt(size);
    renderCurrentSlide();
    updateSlidesList();
    saveProject();
}

function setSlideBgColor(color){
    state.slides[state.currentSlideIndex].backgroundColor=color;
    renderCurrentSlide();
    updateSlidesList();
    saveProject();
}

/* Lancer la présentation depuis l'arborescence */
function startPresentationFromTree() {
    closeTreeFullscreen();
    startPresentation();
}

function startPresentation(){
    presentationMode.classList.add('active');
    
    // Construire le parcours basé sur les connexions de l'arborescence
    loadConnections();
    state.presentationPath = buildPresentationPath();
    state.presentationStep = 0;
    
    renderPresentationSlide();
    document.addEventListener('keydown',handlePresentationKeys);
}

// Construit le chemin de présentation en suivant les connexions
function buildPresentationPath() {
    // Si pas de connexions, suivre l'ordre normal
    if (!scenarioState.connections || scenarioState.connections.length === 0) {
        return state.slides.map((s, i) => i);
    }
    
    const path = [];
    const visited = new Set();
    
    // Commencer par la slide 0 (première slide)
    let currentSlideId = state.slides[0]?.id;
    
    while (currentSlideId && !visited.has(currentSlideId)) {
        visited.add(currentSlideId);
        const slideIndex = state.slides.findIndex(s => s.id === currentSlideId);
        
        if (slideIndex !== -1) {
            path.push(slideIndex);
        }
        
        // Chercher la connexion sortante de cette slide (nouvelle structure)
        const nextConnection = scenarioState.connections.find(c => c.from == currentSlideId);
        
        if (nextConnection) {
            currentSlideId = nextConnection.to;
        } else {
            // Pas de connexion sortante, arrêter
            currentSlideId = null;
        }
    }
    
    // Ajouter les slides non visitées à la fin (si certaines ne sont pas connectées)
    state.slides.forEach((slide, index) => {
        if (!visited.has(slide.id)) {
            path.push(index);
        }
    });
    
    return path.length > 0 ? path : state.slides.map((s, i) => i);
}

function exitPresentation(){
    presentationMode.classList.remove('active');
    document.removeEventListener('keydown',handlePresentationKeys);
    state.presentationPath = null;
    state.presentationStep = 0;
    state.presentationHistory = [];
}

function renderPresentationSlide(){
    // Utiliser le chemin de présentation ou l'index direct
    const slideIndex = state.presentationPath ? state.presentationPath[state.presentationStep] : state.presentationStep;
    const slide = state.slides[slideIndex];
    
    if (!slide) return;
    
    const container = document.getElementById('presentationSlide');
    
    // Calculer l'échelle pour que la slide rentre bien avec de la place pour les boutons en dessous
    const maxSlideHeight = window.innerHeight - 180; // Réserver de l'espace pour les boutons de choix
    const scaleX = (window.innerWidth - 100) / 960;
    const scaleY = maxSlideHeight / 540;
    const scale = Math.min(scaleX, scaleY, 1.5); // Limiter le zoom max
    
    // Construire le contenu de la slide
    let slideHtml = '<div class="presentation-slide-wrapper">';
    slideHtml += '<div class="presentation-slide-content" style="background:' + slide.backgroundColor + ';width:' + (960 * scale) + 'px;height:' + (540 * scale) + 'px;">';
    
    slideHtml += slide.elements.map(elem => {
        const style = 'position:absolute;left:' + (elem.x * scale) + 'px;top:' + (elem.y * scale) + 'px;width:' + (elem.width * scale) + 'px;height:' + (elem.height * scale) + 'px;';
        switch(elem.type) {
            case 'text':
                const textAlign = elem.textAlign || 'left';
                return '<div style="' + style + 'font-family:' + elem.fontFamily + ';font-size:' + (elem.fontSize * scale) + 'px;color:' + elem.color + ';font-weight:' + (elem.bold ? 'bold' : 'normal') + ';font-style:' + (elem.italic ? 'italic' : 'normal') + ';text-decoration:' + (elem.underline ? 'underline' : 'none') + ';text-align:' + textAlign + ';">' + elem.content + '</div>';
            case 'image':
                return '<div style="' + style + '"><img src="' + elem.src + '" style="width:100%;height:100%;object-fit:contain;"></div>';
            case 'shape':
                return '<div style="' + style + '">' + renderShape(elem.shape, elem.color || '#7c3aed') + '</div>';
            case 'navlink':
                return '<div class="pres-navlink" data-target="' + elem.targetSlideId + '" style="' + style + 'background-color:' + elem.color + ';border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:white;font-size:' + (16 * scale) + 'px;font-weight:600;box-shadow:0 4px 15px rgba(0,0,0,0.2);"><i class="fas fa-arrow-right" style="margin-right:8px;"></i>' + (elem.label || 'Lien') + '</div>';
            default:
                return '';
        }
    }).join('');
    
    slideHtml += '</div>'; // Fin presentation-slide-content
    
    // Ajouter les boutons de choix basés sur les connexions du scénario
    loadConnections(); // S'assurer que les connexions sont chargées
    const outgoingConnections = scenarioState.connections.filter(c => c.from == slide.id);
    
    if (outgoingConnections.length > 0) {
        slideHtml += '<div class="presentation-choices">';
        slideHtml += '<div class="choices-label">Choisissez la suite :</div>';
        slideHtml += '<div class="choices-buttons">';
        
        outgoingConnections.forEach(conn => {
            const targetSlide = state.slides.find(s => s.id == conn.to);
            if (targetSlide) {
                const targetIndex = state.slides.indexOf(targetSlide);
                const targetTitle = getSlideTitle(targetSlide);
                // Utiliser le label personnalisé s'il existe, sinon le titre par défaut
                const buttonLabel = conn.label ? conn.label : 'Slide ' + (targetIndex + 1) + ' - ' + targetTitle;
                slideHtml += '<button class="pres-choice-btn" data-target="' + conn.to + '">';
                slideHtml += '<i class="fas fa-arrow-right"></i>';
                slideHtml += '<span>' + buttonLabel + '</span>';
                slideHtml += '</button>';
            }
        });
        
        slideHtml += '</div></div>';
    } else if (slideIndex < state.slides.length - 1 && !hasAnyOutgoingConnection(slide.id)) {
        // Pas de connexion définie mais pas la dernière slide : proposer de continuer
        // (ne rien afficher si on est à la fin)
    }
    
    slideHtml += '</div>'; // Fin presentation-slide-wrapper
    
    container.innerHTML = slideHtml;
    
    // Event listeners pour les navlinks intégrés à la slide
    container.querySelectorAll('.pres-navlink').forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetSlideId = parseInt(link.dataset.target);
            navigateToSlideByIdWithHistory(targetSlideId, slide.id);
        });
    });
    
    // Event listeners pour les boutons de choix en dessous
    container.querySelectorAll('.pres-choice-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetSlideId = parseInt(btn.dataset.target);
            navigateToSlideByIdWithHistory(targetSlideId, slide.id);
        });
    });
    
    // Afficher la position
    const totalSlides = state.slides.length;
    document.getElementById('presCounter').textContent = (slideIndex + 1) + ' / ' + totalSlides;
}

// Vérifie si une slide a des connexions sortantes
function hasAnyOutgoingConnection(slideId) {
    return scenarioState.connections.some(c => c.from == slideId);
}

// Navigation avec historique pour le bouton retour
function navigateToSlideByIdWithHistory(targetSlideId, fromSlideId) {
    if (!state.presentationHistory) state.presentationHistory = [];
    state.presentationHistory.push(fromSlideId);
    
    const targetIndex = state.slides.findIndex(s => s.id === targetSlideId);
    if (targetIndex === -1) return;
    
    state.presentationPath = null;
    state.presentationStep = targetIndex;
    renderPresentationSlide();
}

function navigateToSlideById(targetSlideId){
    const targetIndex = state.slides.findIndex(s => s.id === targetSlideId);
    if(targetIndex === -1) return;
    
    state.presentationPath = null;
    state.presentationStep = targetIndex;
    renderPresentationSlide();
}

function navigatePresentation(direction){
    // Si on a des connexions, naviguer via l'historique pour le retour
    if (direction === -1 && state.presentationHistory && state.presentationHistory.length > 0) {
        const previousSlideId = state.presentationHistory.pop();
        const prevIndex = state.slides.findIndex(s => s.id === previousSlideId);
        if (prevIndex !== -1) {
            state.presentationStep = prevIndex;
            renderPresentationSlide();
            return;
        }
    }
    
    // Navigation normale
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

function findElementById(id){
    const slide=state.slides[state.currentSlideIndex];
    return slide.elements.find(e=>e.id===id);
}

// ============ ARBORESCENCE - SYSTÈME DE SCÉNARIO (Groupe Arborescences) ============

/* Variables pour le système de scénario */
let scenarioState = {
    connections: [],          // Liste des connexions entre slides
    isDraggingSlide: false,   // Si une slide est en cours de déplacement
    startX: 0,                // Position X de départ du drag
    startY: 0,                // Position Y de départ du drag
    initialLeft: 0,           // Position left initiale
    initialTop: 0,            // Position top initiale
    currentDragSlide: null,   // L'élément slide en cours de drag
    currentDragSlideId: null, // L'id de la slide dans state.slides
    isDrawingLine: false,     // Si on trace une connexion
    tempLine: null,           // Ligne temporaire pendant le tracé
    startSocket: null,        // Socket de départ
    startSocketSlideId: null, // Slide de départ pour la connexion
    previewHistory: []        // Historique pour l'aperçu (bouton retour)
};

/* Ouvrir le mode arborescence plein écran */
function openTreeFullscreen() {
    document.getElementById('treeFullscreen').classList.add('active');
    loadConnections();
    renderTreeNodes();
    drawConnections();
    setupScenarioEvents();
}

/* Fermer le mode arborescence */
function closeTreeFullscreen() {
    document.getElementById('treeFullscreen').classList.remove('active');
    cleanupScenarioEvents();
}

/* Configuration des événements globaux pour le scénario */
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

/* Gestion du mouvement de la souris */
function handleScenarioMouseMove(e) {
    const canvas = document.getElementById('treeCanvas');
    const svg = document.getElementById('treeSvg');
    if (!canvas) return;

    // Déplacement d'une slide
    if (scenarioState.isDraggingSlide && scenarioState.currentDragSlide) {
        e.preventDefault();
        const dx = e.clientX - scenarioState.startX;
        const dy = e.clientY - scenarioState.startY;
        
        let newX = scenarioState.initialLeft + dx;
        let newY = scenarioState.initialTop + dy;
        
        // Limiter aux bords
        newX = Math.max(20, newX);
        newY = Math.max(20, newY);
        
        scenarioState.currentDragSlide.style.left = newX + 'px';
        scenarioState.currentDragSlide.style.top = newY + 'px';
        
        // Mettre à jour la position dans state.slides
        const slideData = state.slides.find(s => s.id == scenarioState.currentDragSlideId);
        if (slideData) {
            slideData.treeX = newX;
            slideData.treeY = newY;
        }
        
        drawConnections();
    }

    // Tracé d'une ligne temporaire
    if (scenarioState.isDrawingLine && scenarioState.tempLine) {
        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left + canvas.scrollLeft;
        const mouseY = e.clientY - canvasRect.top + canvas.scrollTop;
        const lineStartX = parseFloat(scenarioState.tempLine.dataset.startX);
        const lineStartY = parseFloat(scenarioState.tempLine.dataset.startY);
        
        const d = `M ${lineStartX} ${lineStartY} L ${mouseX} ${mouseY}`;
        scenarioState.tempLine.setAttribute('d', d);
    }
}

/* Gestion du relâchement de la souris */
function handleScenarioMouseUp(e) {
    // Fin du drag d'une slide
    if (scenarioState.isDraggingSlide) {
        scenarioState.isDraggingSlide = false;
        if (scenarioState.currentDragSlide) {
            scenarioState.currentDragSlide.style.zIndex = '';
            scenarioState.currentDragSlide.classList.remove('dragging');
        }
        scenarioState.currentDragSlide = null;
        document.body.style.cursor = 'default';
        saveProject();
    }

    // Fin du tracé d'une connexion
    if (scenarioState.isDrawingLine) {
        const targetSlide = e.target.closest('.scenario-slide-card');
        
        if (targetSlide && scenarioState.startSocketSlideId) {
            const targetSlideId = targetSlide.dataset.slideId;
            if (targetSlideId != scenarioState.startSocketSlideId) {
                createScenarioConnection(scenarioState.startSocketSlideId, targetSlideId);
            }
        }
        
        // Nettoyer la ligne temporaire
        if (scenarioState.tempLine) {
            scenarioState.tempLine.remove();
            scenarioState.tempLine = null;
        }
        scenarioState.isDrawingLine = false;
        scenarioState.startSocket = null;
        scenarioState.startSocketSlideId = null;
    }
}

/* Rendu des slides sous forme de cartes dans l'arborescence */
function renderTreeNodes() {
    const container = document.getElementById('treeNodes');
    if (!container) return;
    container.innerHTML = '';
    
    // Calculer les positions si pas définies
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

/* Créer une carte de slide style scénario */
function createScenarioSlideCard(slide, index) {
    const card = document.createElement('div');
    const isCurrent = index === state.currentSlideIndex;
    
    card.className = 'scenario-slide-card' + (isCurrent ? ' current' : '');
    card.dataset.slideId = slide.id;
    card.dataset.index = index;
    card.style.left = slide.treeX + 'px';
    card.style.top = slide.treeY + 'px';
    
    // Générer l'aperçu du contenu
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
    
    // Événements de la carte
    setupScenarioCardEvents(card, slide, index);
    
    return card;
}

/* Générer un aperçu du contenu de la slide */
function generateScenarioPreview(slide) {
    let html = '<div class="scenario-preview" style="background:' + slide.backgroundColor + ';">';
    
    // Afficher les premiers éléments en miniature
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

/* Configurer les événements d'une carte */
function setupScenarioCardEvents(card, slide, index) {
    const handle = card.querySelector('.scenario-handle');
    const socket = card.querySelector('.scenario-socket');
    
    // Drag par la poignée
    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        scenarioState.isDraggingSlide = true;
        scenarioState.currentDragSlide = card;
        scenarioState.currentDragSlideId = slide.id;
        
        scenarioState.startX = e.clientX;
        scenarioState.startY = e.clientY;
        scenarioState.initialLeft = card.offsetLeft;
        scenarioState.initialTop = card.offsetTop;
        
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

/* Commencer à tracer une connexion */
function startDrawingConnection(socketElement, slideId) {
    const canvas = document.getElementById('treeCanvas');
    const svg = document.getElementById('treeSvg');
    if (!canvas || !svg) return;
    
    scenarioState.isDrawingLine = true;
    scenarioState.startSocket = socketElement;
    scenarioState.startSocketSlideId = slideId;
    
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
    scenarioState.tempLine = tempLine;
}

/* Créer une connexion entre deux slides */
function createScenarioConnection(fromId, toId) {
    // Vérifier si la connexion existe déjà
    const exists = scenarioState.connections.some(c => c.from == fromId && c.to == toId);
    if (exists || fromId == toId) return;
    
    const connection = {
        id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: fromId,
        to: toId,
        label: '' // Label personnalisé (vide = utilise le titre par défaut)
    };
    
    scenarioState.connections.push(connection);
    drawConnections();
    saveProject();
}

/* Dessiner toutes les connexions */
function drawConnections() {
    const svg = document.getElementById('treeSvg');
    const canvas = document.getElementById('treeCanvas');
    if (!svg || !canvas) return;
    
    // Supprimer les anciens boutons d'édition HTML
    canvas.querySelectorAll('.connection-edit-btn-html').forEach(btn => btn.remove());
    
    // Garder seulement la ligne temporaire si elle existe
    const tempLine = scenarioState.tempLine;
    svg.innerHTML = '';
    if (tempLine) svg.appendChild(tempLine);
    
    // Ajouter les définitions pour les flèches
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
    
    // Dessiner chaque connexion
    scenarioState.connections.forEach((conn, index) => {
        const fromSlide = state.slides.find(s => s.id == conn.from);
        const toSlide = state.slides.find(s => s.id == conn.to);
        
        if (!fromSlide || !toSlide) return;
        
        const fromCard = document.querySelector(`.scenario-slide-card[data-slide-id="${conn.from}"]`);
        const toCard = document.querySelector(`.scenario-slide-card[data-slide-id="${conn.to}"]`);
        
        if (!fromCard || !toCard) return;
        
        // Coordonnées du socket de départ (côté droit)
        const fromSocket = fromCard.querySelector('.scenario-socket');
        const canvasRect = canvas.getBoundingClientRect();
        const fromRect = fromSocket.getBoundingClientRect();
        
        const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left + canvas.scrollLeft;
        const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top + canvas.scrollTop;
        
        // Coordonnées de la carte cible (côté gauche)
        const toRect = toCard.getBoundingClientRect();
        const x2 = toRect.left - canvasRect.left + canvas.scrollLeft;
        const y2 = toRect.top + toRect.height / 2 - canvasRect.top + canvas.scrollTop;
        
        // Créer une courbe de Bézier
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const cp1x = x1 + Math.abs(x2 - x1) / 2;
        const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;
        
        path.setAttribute('d', d);
        path.setAttribute('stroke', conn.label ? '#9b59b6' : '#cc6699'); // Couleur différente si label personnalisé
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('marker-end', conn.label ? 'url(#arrowhead-labeled)' : 'url(#arrowhead)');
        path.classList.add('scenario-connection-line');
        path.style.cursor = 'pointer';
        path.dataset.connectionId = conn.id;
        
        // Animation fluide
        path.setAttribute('stroke-dasharray', '8');
        
        svg.appendChild(path);
        
        // Calculer le point milieu pour le bouton d'édition
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        
        // Ajouter un label texte sur la connexion si personnalisé
        if (conn.label) {
            const labelY = midY - 25;
            
            const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            const labelText = conn.label.length > 20 ? conn.label.substring(0, 20) + '...' : conn.label;
            const textWidth = labelText.length * 7 + 16;
            textBg.setAttribute('x', midX - textWidth / 2);
            textBg.setAttribute('y', labelY - 12);
            textBg.setAttribute('width', textWidth);
            textBg.setAttribute('height', 22);
            textBg.setAttribute('rx', 4);
            textBg.setAttribute('fill', '#9b59b6');
            textBg.style.pointerEvents = 'none';
            svg.appendChild(textBg);
            
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', midX);
            text.setAttribute('y', labelY + 4);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', 'white');
            text.setAttribute('font-size', '11');
            text.setAttribute('font-family', 'Inter, sans-serif');
            text.setAttribute('font-weight', '500');
            text.textContent = labelText;
            text.style.pointerEvents = 'none';
            svg.appendChild(text);
        }
        
        // Ajouter un bouton d'édition HTML (plus fiable que SVG pour les clics)
        const editBtn = document.createElement('div');
        editBtn.className = 'connection-edit-btn-html';
        editBtn.innerHTML = '✎';
        editBtn.style.cssText = `
            position: absolute;
            left: ${midX - 12}px;
            top: ${midY - 12}px;
            width: 24px;
            height: 24px;
            background: white;
            border: 2px solid ${conn.label ? '#9b59b6' : '#cc6699'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 12px;
            color: ${conn.label ? '#9b59b6' : '#cc6699'};
            z-index: 100;
            user-select: none;
        `;
        editBtn.dataset.connId = conn.id;
        
        // Clic sur le bouton d'édition
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            editConnectionLabel(conn);
        });
        
        // Ajouter au canvas (pas au SVG)
        canvas.appendChild(editBtn);
        
        // Variables pour détecter le clic vs le drag
        let clickTimeout = null;
        let hasMoved = false;
        let startX, startY;
        
        // Clic sur la connexion - attendre pour voir si c'est un double-clic ou un drag
        path.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            
            // Fonction pour gérer le mouvement
            const onMouseMove = (moveE) => {
                const dx = Math.abs(moveE.clientX - startX);
                const dy = Math.abs(moveE.clientY - startY);
                if (dx > 5 || dy > 5) {
                    hasMoved = true;
                    // L'utilisateur a bougé - supprimer et redessiner
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    
                    scenarioState.connections = scenarioState.connections.filter(c => c.id !== conn.id);
                    path.remove();
                    
                    // Reprendre le tracé depuis la slide source
                    const sourceCard = document.querySelector(`.scenario-slide-card[data-slide-id="${conn.from}"]`);
                    if (sourceCard) {
                        const sourceSocket = sourceCard.querySelector('.scenario-socket');
                        startDrawingConnection(sourceSocket, conn.from);
                        
                        // Mettre à jour la ligne temporaire
                        const mouseX = moveE.clientX - canvasRect.left + canvas.scrollLeft;
                        const mouseY = moveE.clientY - canvasRect.top + canvas.scrollTop;
                        if (scenarioState.tempLine) {
                            const lineStartX = parseFloat(scenarioState.tempLine.dataset.startX);
                            const lineStartY = parseFloat(scenarioState.tempLine.dataset.startY);
                            scenarioState.tempLine.setAttribute('d', `M ${lineStartX} ${lineStartY} L ${mouseX} ${mouseY}`);
                        }
                    }
                    saveProject();
                }
            };
            
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                // Si pas de mouvement, ne rien faire (permettre le double-clic)
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
}

/* Ajouter une slide depuis l'arborescence */
function addSlideFromTree() {
    addSlide();
    
    const lastSlide = state.slides[state.slides.length - 2];
    const newSlide = state.slides[state.slides.length - 1];
    
    if (lastSlide && lastSlide.treeX !== undefined) {
        newSlide.treeX = lastSlide.treeX + 300;
        newSlide.treeY = lastSlide.treeY;
        
        if (newSlide.treeX > 1200) {
            newSlide.treeX = 100;
            newSlide.treeY = lastSlide.treeY + 200;
        }
    }
    
    renderTreeNodes();
    drawConnections();
}

/* Réorganiser automatiquement les slides */
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

/* Effacer toutes les connexions */
function clearAllConnections() {
    if (scenarioState.connections.length === 0) return;
    
    if (confirm('Supprimer toutes les connexions ?')) {
        scenarioState.connections = [];
        drawConnections();
        saveProject();
    }
}

/* Éditer le label d'une connexion */
/* Éditer le label d'une connexion */
function editConnectionLabel(conn) {
    // Trouver la connexion dans le tableau pour être sûr d'avoir la bonne référence
    const connectionToEdit = scenarioState.connections.find(c => c.id === conn.id);
    if (!connectionToEdit) {
        console.error('Connexion non trouvée:', conn.id);
        return;
    }
    
    const targetSlide = state.slides.find(s => s.id == connectionToEdit.to);
    const targetIndex = targetSlide ? state.slides.indexOf(targetSlide) + 1 : '?';
    const targetTitle = targetSlide ? getSlideTitle(targetSlide) : 'Inconnu';
    const defaultLabel = `Slide ${targetIndex} - ${targetTitle}`;
    
    const currentLabel = connectionToEdit.label || '';
    const newLabel = prompt(
        `Entrez un titre personnalisé pour cette connexion :\n(Laissez vide pour utiliser "${defaultLabel}")`,
        currentLabel
    );
    
    // null = annulé, on ne fait rien
    if (newLabel === null) return;
    
    // Mettre à jour le label (même si vide)
    connectionToEdit.label = newLabel.trim();
    drawConnections();
    saveProject();
}

/* ============ APERÇU DU SCÉNARIO ============ */

function openScenarioPreview() {
    if (state.slides.length === 0) {
        alert("Aucune slide à afficher !");
        return;
    }
    
    scenarioState.previewHistory = [];
    updatePreviewBackButton();
    
    // Commencer par la première slide (celle la plus à gauche)
    let firstSlide = state.slides.reduce((min, s) => 
        (s.treeX < min.treeX) ? s : min, state.slides[0]);
    
    loadScenarioPreviewSlide(firstSlide.id);
    document.getElementById('scenarioPreviewOverlay').classList.remove('hidden');
}

function loadScenarioPreviewSlide(slideId) {
    const slide = state.slides.find(s => s.id == slideId);
    if (!slide) return;
    
    const index = state.slides.indexOf(slide);
    
    // Titre
    document.getElementById('scenarioPreviewTitle').innerText = `Slide ${index + 1}`;
    
    // Contenu - générer un aperçu basé sur les éléments
    let bodyHtml = '';
    slide.elements.forEach(elem => {
        if (elem.type === 'text') {
            bodyHtml += `<p>${elem.content}</p>`;
        }
    });
    if (!bodyHtml) bodyHtml = '<p style="color:#999;">Cette slide ne contient pas de texte.</p>';
    document.getElementById('scenarioPreviewBody').innerHTML = bodyHtml;
    
    // Choix - les connexions sortantes
    const choicesContainer = document.getElementById('scenarioPreviewChoices');
    choicesContainer.innerHTML = '';
    
    const outgoingConnections = scenarioState.connections.filter(c => c.from == slideId);
    
    if (outgoingConnections.length === 0) {
        // Pas de connexion sortante = fin du scénario
        const endBtn = document.createElement('button');
        endBtn.className = 'scenario-choice-btn';
        endBtn.innerHTML = '🔄 Recommencer';
        endBtn.onclick = () => openScenarioPreview();
        choicesContainer.appendChild(endBtn);
    } else {
        // Afficher les choix
        outgoingConnections.forEach(conn => {
            const targetSlide = state.slides.find(s => s.id == conn.to);
            if (targetSlide) {
                const targetIndex = state.slides.indexOf(targetSlide);
                const btn = document.createElement('button');
                btn.className = 'scenario-choice-btn';
                btn.innerHTML = `➡️ Aller à Slide ${targetIndex + 1}`;
                btn.onclick = () => {
                    scenarioState.previewHistory.push(slideId);
                    updatePreviewBackButton();
                    loadScenarioPreviewSlide(conn.to);
                };
                choicesContainer.appendChild(btn);
            }
        });
    }
}

function updatePreviewBackButton() {
    const btn = document.getElementById('scenarioPreviewBack');
    if (scenarioState.previewHistory.length > 0) {
        btn.style.display = 'inline-flex';
    } else {
        btn.style.display = 'none';
    }
}

function goBackInPreview() {
    if (scenarioState.previewHistory.length > 0) {
        const previousId = scenarioState.previewHistory.pop();
        updatePreviewBackButton();
        loadScenarioPreviewSlide(previousId);
    }
}

function closeScenarioPreview() {
    document.getElementById('scenarioPreviewOverlay').classList.add('hidden');
}

/* ============ SAUVEGARDE DES CONNEXIONS ============ */

// Sauvegarder les connexions avec le projet
const originalSaveProject = saveProject;
saveProject = function() {
    const projectIndex = state.projectIndex;
    if (projectIndex !== null && projectIndex !== undefined) {
        const treeData = { connections: scenarioState.connections };
        localStorage.setItem('slideflow_tree_' + projectIndex, JSON.stringify(treeData));
    }
    originalSaveProject();
};

/* Charger les connexions */
function loadConnections() {
    const projectIndex = state.projectIndex;
    if (projectIndex !== null && projectIndex !== undefined) {
        const saved = localStorage.getItem('slideflow_tree_' + projectIndex);
        if (saved) {
            try {
                const treeData = JSON.parse(saved);
                scenarioState.connections = treeData.connections || [];
            } catch(e) {
                console.error('Erreur chargement arborescence:', e);
                scenarioState.connections = [];
            }
        } else {
            scenarioState.connections = [];
        }
    }
}
