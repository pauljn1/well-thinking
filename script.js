const state={slides:[],currentSlideIndex:0,selectedElement:null,isDragging:false,isResizing:false,isEditing:false,dragOffset:{x:0,y:0},resizeHandle:null,projectIndex:null};
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
    document.getElementById('addTextBtn').addEventListener('click',addTextElement);
    document.getElementById('addImageBtn').addEventListener('click',()=>imageModal.classList.add('active'));
    document.getElementById('addShapeBtn').addEventListener('click',()=>shapeModal.classList.add('active'));
    document.getElementById('addSlideBtn').addEventListener('click',addSlide);
    document.getElementById('prevSlide').addEventListener('click',previousSlide);
    document.getElementById('nextSlide').addEventListener('click',nextSlide);
    document.getElementById('canvasArrowLeft').addEventListener('click',previousSlide);
    document.getElementById('canvasArrowRight').addEventListener('click',nextSlide);
    document.getElementById('listViewBtn').addEventListener('click',()=>switchView('list'));
    document.getElementById('treeFullscreenBtn').addEventListener('click',openTreeFullscreen);
    document.getElementById('closeTreeBtn').addEventListener('click',closeTreeFullscreen);
    document.getElementById('addSlideTreeBtn').addEventListener('click',addSlideFromTree);
    document.getElementById('connectModeBtn').addEventListener('click',toggleConnectMode);
    document.getElementById('resetTreeBtn').addEventListener('click',resetTreeLayout);
    document.getElementById('clearConnectionsBtn').addEventListener('click',clearAllConnections);
    document.getElementById('boldBtn').addEventListener('click',()=>toggleFormat('bold'));
    document.getElementById('italicBtn').addEventListener('click',()=>toggleFormat('italic'));
    document.getElementById('underlineBtn').addEventListener('click',()=>toggleFormat('underline'));
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
                content=`<div class="slide-element text-element ${selected}" data-id="${elem.id}" style="${style}font-family:${elem.fontFamily};font-size:${elem.fontSize}px;color:${elem.color};font-weight:${elem.bold?'bold':'normal'};font-style:${elem.italic?'italic':'normal'};text-decoration:${elem.underline?'underline':'none'};">${elem.content}${resizeHandles}</div>`;
                break;
            case'image':
                content=`<div class="slide-element image-element ${selected}" data-id="${elem.id}" style="${style}"><img src="${elem.src}" alt="Image">${resizeHandles}</div>`;
                break;
            case'shape':
                content=`<div class="slide-element shape-element ${selected}" data-id="${elem.id}" style="${style}">${renderShape(elem.shape,elem.color||'#7c3aed')}${resizeHandles}</div>`;
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
    const element={id:Date.now(),type:'text',x:100,y:100,width:300,height:60,content:'Cliquez pour editer',fontFamily:'Inter',fontSize:24,color:'#1e1e1e',bold:false,italic:false,underline:false};
    state.slides[state.currentSlideIndex].elements.push(element);
    state.selectedElement=element;
    renderCurrentSlide();
    showElementProperties();
    saveProject();
}

function addShapeElement(shape){
    const element={id:Date.now(),type:'shape',shape:shape,x:200,y:150,width:150,height:150,color:'#7c3aed'};
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
    if(!url)return;
    addImageElement(url);
    document.getElementById('imageUrlInput').value='';
    imageModal.classList.remove('active');
}

function addImageElement(src){
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
    }
}

function showElementProperties(){
    if(!state.selectedElement)return;
    elementProperties.style.display='block';
    const textContentRow = document.getElementById('textContentRow');
    if(state.selectedElement.type === 'text'){
        textContentRow.style.display = 'flex';
    } else {
        textContentRow.style.display = 'none';
    }
    updatePropertiesInputs();
}

function hideElementProperties(){
    elementProperties.style.display='none';
    document.getElementById('textContentRow').style.display = 'none';
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
    if (!treeState.connections || treeState.connections.length === 0) {
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
        
        // Chercher la connexion sortante de cette slide
        const nextConnection = treeState.connections.find(c => c.from.slideId == currentSlideId);
        
        if (nextConnection) {
            currentSlideId = nextConnection.to.slideId;
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
}

function renderPresentationSlide(){
    // Utiliser le chemin de présentation
    const slideIndex = state.presentationPath ? state.presentationPath[state.presentationStep] : state.presentationStep;
    const slide = state.slides[slideIndex];
    
    if (!slide) return;
    
    const container=document.getElementById('presentationSlide');
    const scaleX=window.innerWidth/960;
    const scaleY=(window.innerHeight-60)/540;
    const scale=Math.min(scaleX,scaleY);
    container.innerHTML='<div class="presentation-slide-content" style="background:'+slide.backgroundColor+';width:'+(960*scale)+'px;height:'+(540*scale)+'px;">'+slide.elements.map(elem=>{
        const style='position:absolute;left:'+(elem.x*scale)+'px;top:'+(elem.y*scale)+'px;width:'+(elem.width*scale)+'px;height:'+(elem.height*scale)+'px;';
        switch(elem.type){
            case'text':return'<div style="'+style+'font-family:'+elem.fontFamily+';font-size:'+(elem.fontSize*scale)+'px;color:'+elem.color+';font-weight:'+(elem.bold?'bold':'normal')+';font-style:'+(elem.italic?'italic':'normal')+';text-decoration:'+(elem.underline?'underline':'none')+';">'+elem.content+'</div>';
            case'image':return'<div style="'+style+'"><img src="'+elem.src+'" style="width:100%;height:100%;object-fit:contain;"></div>';
            case'shape':return'<div style="'+style+'">'+renderShape(elem.shape,elem.color||'#7c3aed')+'</div>';
            default:return'';
        }
    }).join('')+'</div>';
    
    // Afficher la position dans le parcours
    const totalSteps = state.presentationPath ? state.presentationPath.length : state.slides.length;
    document.getElementById('presCounter').textContent = (state.presentationStep + 1) + ' / ' + totalSteps;
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

function findElementById(id){
    const slide=state.slides[state.currentSlideIndex];
    return slide.elements.find(e=>e.id===id);
}

// ============ ARBORESCENCE PLEIN ECRAN - SYSTÈME AVANCÉ ============

let treeState = {
    connections: [],
    connectMode: false,
    connectFrom: null,
    dragNode: null,
    dragOffset: { x: 0, y: 0 }
};

function openTreeFullscreen() {
    document.getElementById('treeFullscreen').classList.add('active');
    loadConnections();
    renderTreeNodes();
    drawConnections();
}

function closeTreeFullscreen() {
    document.getElementById('treeFullscreen').classList.remove('active');
    treeState.connectMode = false;
    treeState.connectFrom = null;
    updateConnectModeBtn();
}

function renderTreeNodes() {
    const container = document.getElementById('treeNodes');
    container.innerHTML = '';
    
    // Nœud de départ
    const startNode = document.createElement('div');
    startNode.className = 'tree-start-node';
    startNode.innerHTML = '<div class="start-icon"><i class="fas fa-play"></i></div><span>Début</span>';
    startNode.style.left = '50px';
    startNode.style.top = '50px';
    container.appendChild(startNode);
    
    // Calculer les positions si pas définies
    state.slides.forEach((slide, index) => {
        if (slide.treeX === null || slide.treeX === undefined) {
            const cols = Math.ceil(Math.sqrt(state.slides.length * 1.5));
            slide.treeX = 200 + (index % cols) * 260;
            slide.treeY = 150 + Math.floor(index / cols) * 230;
        }
        
        const node = createTreeNode(slide, index);
        container.appendChild(node);
    });
    
    // Nœud de fin
    const endNode = document.createElement('div');
    endNode.className = 'tree-end-node';
    endNode.innerHTML = '<div class="end-icon"></div><span>Fin</span>';
    const lastSlide = state.slides[state.slides.length - 1];
    if (lastSlide) {
        endNode.style.left = (lastSlide.treeX + 80) + 'px';
        endNode.style.top = (lastSlide.treeY + 200) + 'px';
    } else {
        endNode.style.left = '100px';
        endNode.style.top = '300px';
    }
    container.appendChild(endNode);
}

function createTreeNode(slide, index) {
    const node = document.createElement('div');
    const isCurrent = index === state.currentSlideIndex;
    
    node.className = 'family-node' + (isCurrent ? ' current' : '');
    node.dataset.slideId = slide.id;
    node.dataset.index = index;
    node.style.left = slide.treeX + 'px';
    node.style.top = slide.treeY + 'px';
    
    const previewHtml = generateSlidePreview(slide);
    
    node.innerHTML = `
        <div class="node-header">
            <div class="node-number">${index + 1}</div>
            <div class="node-title">Slide ${index + 1}</div>
        </div>
        <div class="node-body">
            ${previewHtml}
        </div>
        <div class="node-footer">
            <button class="node-btn edit-btn" title="Éditer"><i class="fas fa-edit"></i></button>
            <button class="node-btn delete-btn" title="Supprimer"><i class="fas fa-trash"></i></button>
        </div>
        <div class="connection-point top" data-pos="top"></div>
        <div class="connection-point right" data-pos="right"></div>
        <div class="connection-point bottom" data-pos="bottom"></div>
        <div class="connection-point left" data-pos="left"></div>
    `;
    
    // Événements
    setupNodeEvents(node, slide, index);
    
    return node;
}

function setupNodeEvents(node, slide, index) {
    // Drag pour déplacer
    node.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-btn') || e.target.closest('.connection-point')) return;
        startDragNode(e, slide, node);
    });
    
    // Double-clic pour ouvrir
    node.addEventListener('dblclick', () => {
        state.currentSlideIndex = index;
        updateSlidesList();
        renderCurrentSlide();
        updateSlideCounter();
        closeTreeFullscreen();
    });
    
    // Points de connexion
    node.querySelectorAll('.connection-point').forEach(point => {
        point.addEventListener('click', (e) => {
            e.stopPropagation();
            handleConnectionPoint(slide.id, point.dataset.pos);
        });
    });
    
    // Boutons
    const editBtn = node.querySelector('.edit-btn');
    const deleteBtn = node.querySelector('.delete-btn');
    
    editBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        state.currentSlideIndex = index;
        updateSlidesList();
        renderCurrentSlide();
        closeTreeFullscreen();
    });
    
    deleteBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.slides.length > 1) {
            deleteSlide(index);
            renderTreeNodes();
            drawConnections();
        }
    });
}

function generateSlidePreview(slide) {
    let html = '<div class="node-preview" style="background:' + slide.backgroundColor + ';">';
    
    slide.elements.slice(0, 3).forEach(elem => {
        const scale = 0.15;
        const style = `position:absolute;left:${elem.x * scale}px;top:${elem.y * scale}px;width:${elem.width * scale}px;height:${elem.height * scale}px;`;
        
        switch(elem.type) {
            case 'text':
                html += `<div style="${style}font-size:${Math.max(4, elem.fontSize * scale)}px;color:${elem.color};overflow:hidden;">${elem.content.substring(0, 15)}</div>`;
                break;
            case 'image':
                html += `<div style="${style}"><img src="${elem.src}" style="width:100%;height:100%;object-fit:cover;"></div>`;
                break;
            case 'shape':
                html += `<div style="${style}">${renderShape(elem.shape, elem.color || '#cc6699')}</div>`;
                break;
        }
    });
    
    html += '</div>';
    return html;
}

function startDragNode(e, slide, node) {
    if (e.target.classList.contains('connection-point')) return;
    
    treeState.dragNode = { slide, node };
    const rect = node.getBoundingClientRect();
    treeState.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    
    node.style.zIndex = '100';
    node.classList.add('dragging');
    
    const moveHandler = (e) => dragNode(e);
    const upHandler = () => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
        endDragNode();
    };
    
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
}

function dragNode(e) {
    if (!treeState.dragNode) return;
    
    const canvas = document.getElementById('treeCanvas');
    const canvasRect = canvas.getBoundingClientRect();
    
    let x = e.clientX - canvasRect.left - treeState.dragOffset.x + canvas.scrollLeft;
    let y = e.clientY - canvasRect.top - treeState.dragOffset.y + canvas.scrollTop;
    
    x = Math.max(20, x);
    y = Math.max(20, y);
    
    treeState.dragNode.slide.treeX = x;
    treeState.dragNode.slide.treeY = y;
    treeState.dragNode.node.style.left = x + 'px';
    treeState.dragNode.node.style.top = y + 'px';
    
    drawConnections();
}

function endDragNode() {
    if (treeState.dragNode) {
        treeState.dragNode.node.style.zIndex = '';
        treeState.dragNode.node.classList.remove('dragging');
        treeState.dragNode = null;
        saveProject();
    }
}

function handleConnectionPoint(slideId, position) {
    if (!treeState.connectMode) {
        treeState.connectMode = true;
        updateConnectModeBtn();
    }
    
    if (!treeState.connectFrom) {
        treeState.connectFrom = { slideId, position };
        highlightConnectionStart(slideId, position);
    } else {
        if (treeState.connectFrom.slideId !== slideId) {
            addConnection(
                treeState.connectFrom.slideId, 
                treeState.connectFrom.position,
                slideId, 
                position
            );
        }
        clearConnectionHighlight();
        treeState.connectFrom = null;
    }
}

function highlightConnectionStart(slideId, position) {
    document.querySelectorAll('.family-node').forEach(node => {
        if (node.dataset.slideId == slideId) {
            node.classList.add('connecting');
            node.querySelector(`.connection-point[data-pos="${position}"]`)?.classList.add('active');
        }
    });
}

function clearConnectionHighlight() {
    document.querySelectorAll('.connection-point.active').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.family-node.connecting').forEach(n => n.classList.remove('connecting'));
}

function addConnection(fromId, fromPos, toId, toPos) {
    const exists = treeState.connections.some(c => 
        c.from.slideId == fromId && c.to.slideId == toId
    );
    
    if (!exists && fromId != toId) {
        treeState.connections.push({
            from: { slideId: fromId, position: fromPos },
            to: { slideId: toId, position: toPos }
        });
        
        drawConnections();
        renderTreeNodes();
        saveProject();
    }
}

function drawConnections() {
    const svg = document.getElementById('treeSvg');
    if (!svg) return;
    
    svg.innerHTML = '';
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#cc6699"/>
        </marker>
    `;
    svg.appendChild(defs);
    
    treeState.connections.forEach((conn, index) => {
        const fromSlide = state.slides.find(s => s.id == conn.from.slideId);
        const toSlide = state.slides.find(s => s.id == conn.to.slideId);
        
        if (!fromSlide || !toSlide) return;
        
        const fromPoint = getConnectionPointCoords(fromSlide, conn.from.position);
        const toPoint = getConnectionPointCoords(toSlide, conn.to.position);
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const dx = toPoint.x - fromPoint.x;
        const dy = toPoint.y - fromPoint.y;
        const curve = Math.min(Math.abs(dx), Math.abs(dy)) * 0.5;
        
        let d;
        if (conn.from.position === 'bottom' || conn.from.position === 'top') {
            d = `M ${fromPoint.x} ${fromPoint.y} C ${fromPoint.x} ${fromPoint.y + curve}, ${toPoint.x} ${toPoint.y - curve}, ${toPoint.x} ${toPoint.y}`;
        } else {
            d = `M ${fromPoint.x} ${fromPoint.y} C ${fromPoint.x + curve} ${fromPoint.y}, ${toPoint.x - curve} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`;
        }
        
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#cc6699');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.style.cursor = 'pointer';
        
        path.addEventListener('click', () => {
            if (confirm('Supprimer cette connexion ?')) {
                treeState.connections.splice(index, 1);
                drawConnections();
                renderTreeNodes();
                saveProject();
            }
        });
        
        svg.appendChild(path);
    });
}

function getConnectionPointCoords(slide, position) {
    const nodeWidth = 180;
    const nodeHeight = 140;
    
    const x = slide.treeX || 0;
    const y = slide.treeY || 0;
    
    switch(position) {
        case 'top': return { x: x + nodeWidth/2, y: y };
        case 'right': return { x: x + nodeWidth, y: y + nodeHeight/2 };
        case 'bottom': return { x: x + nodeWidth/2, y: y + nodeHeight };
        case 'left': return { x: x, y: y + nodeHeight/2 };
        default: return { x: x + nodeWidth/2, y: y + nodeHeight/2 };
    }
}

function toggleConnectMode() {
    treeState.connectMode = !treeState.connectMode;
    treeState.connectFrom = null;
    clearConnectionHighlight();
    updateConnectModeBtn();
}

function updateConnectModeBtn() {
    const btn = document.getElementById('connectModeBtn');
    if (treeState.connectMode) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-times"></i> Annuler';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fas fa-link"></i> Connecter';
    }
}

function addSlideFromTree() {
    addSlide();
    
    const lastSlide = state.slides[state.slides.length - 2];
    const newSlide = state.slides[state.slides.length - 1];
    
    if (lastSlide && lastSlide.treeX !== undefined) {
        newSlide.treeX = lastSlide.treeX + 250;
        newSlide.treeY = lastSlide.treeY;
        
        if (newSlide.treeX > 1200) {
            newSlide.treeX = 200;
            newSlide.treeY = lastSlide.treeY + 200;
        }
    }
    
    renderTreeNodes();
    drawConnections();
}

function resetTreeLayout() {
    const cols = Math.ceil(Math.sqrt(state.slides.length * 1.5));
    state.slides.forEach((slide, index) => {
        slide.treeX = 200 + (index % cols) * 260;
        slide.treeY = 150 + Math.floor(index / cols) * 200;
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
        renderTreeNodes();
        saveProject();
    }
}

// Sauvegarde des connexions
const originalSaveProject = saveProject;
saveProject = function() {
    const projectIndex = state.projectIndex;
    if (projectIndex !== null && projectIndex !== undefined) {
        const treeData = { connections: treeState.connections };
        localStorage.setItem('slideflow_tree_' + projectIndex, JSON.stringify(treeData));
    }
    originalSaveProject();
};

function loadConnections() {
    const projectIndex = state.projectIndex;
    if (projectIndex !== null && projectIndex !== undefined) {
        const saved = localStorage.getItem('slideflow_tree_' + projectIndex);
        if (saved) {
            try {
                const treeData = JSON.parse(saved);
                treeState.connections = treeData.connections || [];
            } catch(e) {
                console.error('Erreur chargement arborescence:', e);
            }
        }
    }
}
