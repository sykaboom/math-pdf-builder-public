// Filename: js/renderer.js
import { State } from './state.js';
import { Actions } from './actions.js';
import { ManualRenderer } from './services.js';
import { Utils } from './utils.js';
import { Events } from './events.js';

export const Renderer = {
    createPage(num) {
        const div = document.createElement('div'); div.className = 'page'; if(num === 1) div.classList.add('page-first');
        const meta = State.docData.meta;
        const headerHTML = num === 1 ? 
            `<table class="header-table"><colgroup><col class="col-title"><col class="col-label"><col class="col-input-wide"><col class="col-label"><col class="col-input-narrow"></colgroup><tr><td rowspan="2" class="col-title">TEST</td><td class="col-label">과정</td><td><input class="header-input meta-title" value="${meta.title}"></td><td class="col-label">성명</td><td><input class="header-input"></td></tr><tr><td class="col-label">단원</td><td><input class="header-input meta-subtitle" value="${meta.subtitle}"></td><td class="col-label">점수</td><td></td></tr></table>` : `<div class="header-line"></div>`;
        const footerText = meta.footerText ? `<div class="footer-text">${meta.footerText}</div>` : '';
        const footerHTML = num === 1 ? `<div class="footer-content-first">${footerText}<div>- ${num} -</div></div>` : `<div class="footer-line"></div>${footerText}<div>- ${num} -</div>`;
        const columnsCount = parseInt(meta.columns) === 1 ? 1 : 2;
        const columnsHTML = columnsCount === 1 ? `<div class="column single"></div>` : `<div class="column left"></div><div class="column right"></div>`;
        const bodyClass = columnsCount === 1 ? 'body-container single-column' : 'body-container';
        div.innerHTML=`<div class="header-area">${headerHTML}</div><div class="${bodyClass}">${columnsHTML}</div><div class="page-footer">${footerHTML}</div>`;
        div.style.padding = `${meta.marginTopMm || 15}mm ${meta.marginSideMm || 10}mm`;
        if (columnsCount === 2) {
            const gap = meta.columnGapMm || 5;
            const leftCol = div.querySelector('.column.left');
            const rightCol = div.querySelector('.column.right');
            if (leftCol) leftCol.style.paddingRight = gap + 'mm';
            if (rightCol) rightCol.style.paddingLeft = gap + 'mm';
        }
        
        if(num === 1) {
            const titleInp = div.querySelector('.meta-title'); const subInp = div.querySelector('.meta-subtitle');
            if(titleInp) titleInp.oninput = (e) => { State.docData.meta.title = e.target.value; State.saveHistory(500); };
            if(subInp) subInp.oninput = (e) => { State.docData.meta.subtitle = e.target.value; State.saveHistory(500); };
        }
        return div;
    },

    renderPages() {
        const workspace = document.getElementById('workspace');
        const scrollTop = workspace ? workspace.scrollTop : 0;

        let preserveScrollAfterFocus = false;
        if (!State.lastFocusId) {
            const activeWrap = document.activeElement ? document.activeElement.closest('.block-wrapper') : null;
            const activeId = activeWrap && activeWrap.dataset ? activeWrap.dataset.id : null;
            if (activeId) {
                State.lastFocusId = activeId;
                preserveScrollAfterFocus = true;
            }
        }

        const container = document.getElementById('paper-container'); 
        container.innerHTML = ''; 
        if(State.docData.meta.zoom) { container.style.transform = `scale(${State.docData.meta.zoom})`; container.style.transformOrigin = 'top center'; document.getElementById('zoomRange').value = State.docData.meta.zoom; }

        let pageNum = 1; let currentPage = this.createPage(pageNum); container.appendChild(currentPage);
        const columnsCount = parseInt(State.docData.meta.columns) === 1 ? 1 : 2;
        let columns = columnsCount === 1 ? [currentPage.querySelector('.column.single')] : [currentPage.querySelector('.column.left'), currentPage.querySelector('.column.right')];
        let colIndex = 0; let curCol = columns[colIndex];

        const moveToNextColumn = () => {
            colIndex++;
            if (colIndex >= columns.length) {
                pageNum++; currentPage = this.createPage(pageNum); container.appendChild(currentPage);
                columns = columnsCount === 1 ? [currentPage.querySelector('.column.single')] : [currentPage.querySelector('.column.left'), currentPage.querySelector('.column.right')];
                colIndex = 0;
            }
            curCol = columns[colIndex];
        };

        State.docData.blocks.forEach((block) => { 
            if (block.type === 'break') { curCol.appendChild(this.createBlock(block)); moveToNextColumn(); return; } 
            const el = this.createBlock(block); curCol.appendChild(el); 
            if (curCol.scrollHeight > curCol.clientHeight + 5) { 
                if (curCol.children.length === 1) { moveToNextColumn(); } 
                else { curCol.removeChild(el); moveToNextColumn(); curCol.appendChild(el); } 
            } 
        });

        if (workspace) workspace.scrollTop = scrollTop;
        this.updatePreflightPanel();
        
        if(State.lastFocusId) {
            const focusId = State.lastFocusId;
            setTimeout(() => {
                const el = document.querySelector(`.block-wrapper[data-id="${focusId}"] .editable-box`);
                if(el) {
                    el.focus();
                    const r=document.createRange(); r.selectNodeContents(el); r.collapse(false);
                    const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
                }
                State.lastFocusId=null;
                if (preserveScrollAfterFocus && workspace) workspace.scrollTop = scrollTop;
            }, 0);
        }
    },

    // [Fix] 순환 참조 방지를 위한 렌더링 헬퍼
    async performAndRender(actionFn) {
        if(actionFn()) {
            this.renderPages();
            await ManualRenderer.renderAll();
        }
    },

    createBlock(block) {
        const wrap = document.createElement('div'); wrap.className = 'block-wrapper'; wrap.dataset.id = block.id;
        if(block.style && block.style.textAlign) wrap.style.textAlign = block.style.textAlign;
        if(block.bgGray) wrap.classList.add('bg-gray-block'); 

        const actions = document.createElement('div'); actions.className = 'block-actions';
        const btnBr = document.createElement('button'); btnBr.className = 'block-action-btn'; btnBr.innerText = '⤵'; btnBr.title = '단 나누기 추가'; btnBr.onclick=(e)=>{ e.stopPropagation(); this.performAndRender(() => Actions.addBlockBelow('break', block.id)); };
        const btnSp = document.createElement('button'); btnSp.className = 'block-action-btn'; btnSp.innerText = '▱'; btnSp.title = '여백 블록 추가'; btnSp.onclick=(e)=>{ e.stopPropagation(); this.performAndRender(() => Actions.addBlockBelow('spacer', block.id)); };
        actions.appendChild(btnBr); actions.appendChild(btnSp); wrap.appendChild(actions);

        wrap.addEventListener('click', (e) => {
             if (!(e.ctrlKey || e.metaKey)) return;
             if (e.altKey) { e.preventDefault(); e.stopPropagation(); this.performAndRender(() => Actions.addBlockBelow('break', block.id)); return; }
             if (e.shiftKey) { e.preventDefault(); e.stopPropagation(); this.performAndRender(() => Actions.addBlockBelow('spacer', block.id)); return; }
        });

        wrap.draggable = false; 
        const handle = document.createElement('div'); handle.className = 'block-handle'; handle.draggable = true; 
        handle.addEventListener('dragstart', (e) => {
            e.stopPropagation(); State.dragSrcId = block.id;
            const wrapper = e.target.closest('.block-wrapper'); wrapper.classList.add('dragging');
            if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', block.id); }
        });
        handle.addEventListener('dragend', (e) => {
             e.stopPropagation(); State.dragSrcId = null;
             document.querySelectorAll('.block-wrapper').forEach(w => w.classList.remove('dragging', 'drop-target-top', 'drop-target-bottom'));
             this.syncAllBlocks();
        });
        
        // [Fix] 메뉴 토글 로직 (display check)
        handle.onclick = (e) => {
            e.stopPropagation();
            const m = document.getElementById('context-menu');
            if (m.style.display === 'block' && State.contextTargetId === block.id) {
                m.style.display = 'none';
                return;
            }
            State.contextTargetId = block.id;
            Events.populateFontMenu(block.id);
            m.style.display = 'block';
            let left = e.clientX; let top = e.clientY;
            const pad = 8;
            const rect = m.getBoundingClientRect();
            if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
            if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
            if (left < pad) left = pad;
            if (top < pad) top = pad;
            m.style.left = left + 'px'; m.style.top = top + 'px';
        };
        wrap.appendChild(handle);

        wrap.ondragover=(e)=>{ e.preventDefault(); const r=wrap.getBoundingClientRect(); wrap.classList.remove('drop-target-top','drop-target-bottom'); if((e.clientY-r.top)<(r.height/2)) wrap.classList.add('drop-target-top'); else wrap.classList.add('drop-target-bottom'); };
        wrap.ondrop=(e)=>{ 
            const types = e.dataTransfer.types;
            if (types && (Array.from(types).includes('Files'))) return;
            e.preventDefault(); e.stopPropagation(); 
            if(State.dragSrcId && State.dragSrcId !== block.id){ 
                const srcIdx=State.docData.blocks.findIndex(b=>b.id===State.dragSrcId); const tgtIdx=State.docData.blocks.findIndex(b=>b.id===block.id); 
                const [moved]=State.docData.blocks.splice(srcIdx,1); 
                if(wrap.classList.contains('drop-target-bottom')) State.docData.blocks.splice(tgtIdx+1,0,moved); else State.docData.blocks.splice(tgtIdx,0,moved); 
                this.renderPages(); ManualRenderer.renderAll(); State.saveHistory();
            } 
            document.querySelectorAll('.block-wrapper').forEach(w=>w.classList.remove('dragging','drop-target-top','drop-target-bottom')); 
        };

        if(block.type==='break'){
            const br=document.createElement('div'); br.className='break-line'; 
            br.onclick=async ()=>{ if(confirm("단 나누기 삭제?")) this.performAndRender(() => Actions.deleteBlockById(block.id)); }; 
            wrap.appendChild(br);
        } else if(block.type==='spacer'){
            const sp=document.createElement('div'); sp.className='spacer-block'; sp.style.height=(block.height||50)+'px';
            sp.onmousedown=(e)=>{ const sY=e.clientY, sH=parseInt(sp.style.height); const mv=(ev)=>{ const nH=Math.max(10, sH+(ev.clientY-sY)); sp.style.height=nH+'px'; block.height=nH; }; window.addEventListener('mousemove',mv); window.addEventListener('mouseup',()=>{window.removeEventListener('mousemove',mv); State.saveHistory();},{once:true}); }; wrap.appendChild(sp);
        } else {
            const box=document.createElement('div'); box.className=`editable-box ${block.type}-box`;
            if(block.type==='concept') box.classList.add('concept-box');
            if(block.bordered) box.classList.add('bordered-box');
            box.innerHTML=block.content;
            box.contentEditable=true;
            const placeholderMap = {
                concept: "개념 내용 입력… (수식: $...$ / 줄바꿈: Shift+Enter)",
                example: "내용 입력… (수식: $...$ / 줄바꿈: Shift+Enter)",
                answer: "해설 입력… (수식: $...$ / 줄바꿈: Shift+Enter)"
            };
            box.dataset.placeholder = placeholderMap[block.type] || placeholderMap.example;

            const familyKey = block.fontFamily || State.docData.meta.fontFamily || 'serif';
            const sizePt = block.fontSizePt || State.docData.meta.fontSizePt || 10.5;
            const familyMap = {
                serif: "'Noto Serif KR', serif",
                gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
                gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
            };
            box.style.fontFamily = familyMap[familyKey] || familyMap.serif;
            box.style.fontSize = sizePt + 'pt';
            
            box.addEventListener('blur', async () => {
                if (!State.renderingEnabled) {
                    Actions.updateBlockContent(block.id, Utils.cleanRichContentToTex(box.innerHTML), true);
                    this.debouncedRebalance();
                    this.updatePreflightPanel();
                    return;
                }
                if(!window.isMathJaxReady) return;
                if(/\[빈칸[:_]/.test(box.innerText) || box.innerText.includes('$') || box.innerText.includes('[이미지') || box.innerText.includes('[블록박스') || box.innerText.includes('[표_')) {
                    await ManualRenderer.typesetElement(box);
                }
                Actions.updateBlockContent(block.id, Utils.cleanRichContentToTex(box.innerHTML), true);
                this.debouncedRebalance(); 
                this.updatePreflightPanel();
            });
            box.oninput=()=>{ 
                const cleanHTML = Utils.cleanRichContentToTex(box.innerHTML); 
                Actions.updateBlockContent(block.id, cleanHTML, false); 
                State.saveHistory(1000);
                this.debouncedRebalance(); // 입력 시 자동 레이아웃 조정
                this.updatePreflightPanel();
            };
            // 렌더링 콜백을 Events로 전달
            box.onkeydown = (e) => Events.handleBlockKeydown(e, block.id, box, () => { this.renderPages(); ManualRenderer.renderAll(); });
            box.onmousedown = (e) => Events.handleBlockMousedown(e, block.id);
            wrap.appendChild(box);
        }
        return wrap;
    },

    rebalanceLayout: Utils.debounce(function() {
        const container = document.getElementById('paper-container');
        let pages = Array.from(container.querySelectorAll('.page'));
        let columns = [];
        const columnsCount = parseInt(State.docData.meta.columns) === 1 ? 1 : 2;
        pages.forEach(p => {
            if (columnsCount === 1) columns.push(p.querySelector('.column.single'));
            else { columns.push(p.querySelector('.column.left')); columns.push(p.querySelector('.column.right')); }
        });
        const MAX_LOOPS = 50; let loopCount = 0;
        for (let i = 0; i < columns.length; i++) {
            let col = columns[i];
            if (loopCount++ > MAX_LOOPS) break;
            while (col.scrollHeight > col.clientHeight + 2) {
                if (col.children.length <= 1) break; 
                const lastBlock = col.lastElementChild;
                let nextCol = columns[i + 1];
                if (!nextCol) {
                    const newPageNum = pages.length + 1; const newPage = this.createPage(newPageNum); container.appendChild(newPage); pages.push(newPage);
                    if (columnsCount === 1) {
                        const ns = newPage.querySelector('.column.single');
                        columns.push(ns); nextCol = ns;
                    } else {
                        const nl = newPage.querySelector('.column.left'); const nr = newPage.querySelector('.column.right');
                        columns.push(nl); columns.push(nr); nextCol = nl;
                    }
                }
                if (nextCol.firstChild) nextCol.insertBefore(lastBlock, nextCol.firstChild); else nextCol.appendChild(lastBlock);
            }
        }
    }, 300),

    debouncedRebalance: function() { this.rebalanceLayout(); },

    updatePreflightPanel() {
        const panel = document.getElementById('preflight-panel');
        if (!panel) return;
        const mathBoxes = Array.from(document.querySelectorAll('.editable-box')).filter(b => (b.textContent || '').includes('$'));
        const placeholders = document.querySelectorAll('.image-placeholder');
        const mathCount = mathBoxes.length;
        const imageCount = placeholders.length;

        const mathEl = document.getElementById('preflight-math-count');
        const imgEl = document.getElementById('preflight-image-count');
        if (mathEl) mathEl.textContent = mathCount;
        if (imgEl) imgEl.textContent = imageCount;

        panel.querySelectorAll('.preflight-item').forEach(item => {
            const type = item.dataset.type;
            const count = type === 'math' ? mathCount : imageCount;
            if (count > 0) item.classList.add('warn'); else item.classList.remove('warn');
        });
    },

    jumpToPreflight(type) {
        let wrap = null;
        if (type === 'math') {
            const box = Array.from(document.querySelectorAll('.editable-box')).find(b => (b.textContent || '').includes('$'));
            if (box) wrap = box.closest('.block-wrapper');
        } else if (type === 'image') {
            const ph = document.querySelector('.image-placeholder');
            if (ph) wrap = ph.closest('.block-wrapper');
        }
        if (!wrap) return;
        wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        wrap.classList.add('preflight-highlight');
        setTimeout(() => wrap.classList.remove('preflight-highlight'), 1500);
        const box = wrap.querySelector('.editable-box');
        if (box) box.focus();
    },
    
    // [Fix] 누락된 수식 동기화 함수 복구
    syncBlock(id) {
        const wrap = document.querySelector(`.block-wrapper[data-id="${id}"]`); if (!wrap) return;
        const box = wrap.querySelector('.editable-box');
        if (box) Actions.updateBlockContent(id, Utils.cleanRichContentToTex(box.innerHTML), false);
    },

    syncAllBlocks() { 
        const newBlocks = [];
        document.querySelectorAll('.block-wrapper').forEach(wrap => {
            const id = wrap.dataset.id;
            const block = State.docData.blocks.find(b => b.id === id);
            if(block) {
                const box = wrap.querySelector('.editable-box');
                if(box) block.content = Utils.cleanRichContentToTex(box.innerHTML);
                newBlocks.push(block);
            }
        });
        State.docData.blocks = newBlocks;
        State.saveHistory(500); 
    }
};
