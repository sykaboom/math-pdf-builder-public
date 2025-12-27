// Filename: js/renderer.js
import { State } from './state.js';
import { Actions } from './actions.js';
import { ManualRenderer } from './services.js';
import { Utils } from './utils.js';
import { Events } from './events.js';

export const Renderer = {
    conceptBlankSyncing: false,
    conceptBlankPending: null,
    queueConceptBlankSummaryUpdate(changedBlockId = null) {
        if (!this.conceptBlankPending) {
            this.conceptBlankPending = { changedBlockId: changedBlockId || null, timer: null };
        } else if (changedBlockId) {
            if (this.conceptBlankPending.changedBlockId && this.conceptBlankPending.changedBlockId !== changedBlockId) {
                this.conceptBlankPending.changedBlockId = null;
            } else if (!this.conceptBlankPending.changedBlockId) {
                this.conceptBlankPending.changedBlockId = changedBlockId;
            }
        }
        if (this.conceptBlankPending.timer) return;
        this.conceptBlankPending.timer = setTimeout(() => this.flushConceptBlankSummaryUpdate(), 80);
    },
    async flushConceptBlankSummaryUpdate() {
        const pending = this.conceptBlankPending;
        if (!pending) return;
        if (this.conceptBlankSyncing || ManualRenderer.isRendering) {
            pending.timer = setTimeout(() => this.flushConceptBlankSummaryUpdate(), 80);
            return;
        }
        this.conceptBlankPending = null;
        await this.updateConceptBlankSummary({ changedBlockId: pending.changedBlockId });
    },
    getPageColumnsCount(pageNum) {
        const settings = State.settings || {};
        const layouts = settings.pageLayouts || {};
        const override = layouts[pageNum];
        if (override === 1 || override === 2) return override;
        return parseInt(settings.columns) === 1 ? 1 : 2;
    },

    getPageColumns(pageNum, pageEl) {
        const count = this.getPageColumnsCount(pageNum);
        if (count === 1) return [pageEl.querySelector('.column.single')];
        return [pageEl.querySelector('.column.left'), pageEl.querySelector('.column.right')];
    },

    createPage(num) {
        const div = document.createElement('div'); div.className = 'page'; if(num === 1) div.classList.add('page-first');
        const meta = State.docData.meta;
        const settings = State.settings;
        const headerHTML = num === 1 ? 
            `<table class="header-table"><colgroup><col class="col-title"><col class="col-label"><col class="col-input-wide"><col class="col-label"><col class="col-input-narrow"></colgroup><tr><td rowspan="2" class="col-title">TEST</td><td class="col-label">과정</td><td><input class="header-input meta-title" value="${meta.title}"></td><td class="col-label">성명</td><td><input class="header-input"></td></tr><tr><td class="col-label">단원</td><td><input class="header-input meta-subtitle" value="${meta.subtitle}"></td><td class="col-label">점수</td><td></td></tr></table>` : `<div class="header-line"></div>`;
        const footerText = meta.footerText ? `<div class="footer-text">${meta.footerText}</div>` : '';
        const footerHTML = num === 1 ? `<div class="footer-content-first">${footerText}<div>- ${num} -</div></div>` : `<div class="footer-line"></div>${footerText}<div>- ${num} -</div>`;
        const columnsCount = this.getPageColumnsCount(num);
        const columnsHTML = columnsCount === 1 ? `<div class="column single"></div>` : `<div class="column left"></div><div class="column right"></div>`;
        const bodyClass = columnsCount === 1 ? 'body-container single-column' : 'body-container';
        div.innerHTML=`<div class="header-area">${headerHTML}</div><div class="${bodyClass}">${columnsHTML}</div><div class="page-footer">${footerHTML}</div><div class="page-layout-control"><span class="page-layout-label">단 구성</span><select class="page-layout-select"><option value="1">1단</option><option value="2">2단</option></select></div>`;
        div.style.padding = `${settings.marginTopMm || 15}mm ${settings.marginSideMm || 10}mm`;
        if (columnsCount === 2) {
            const gap = settings.columnGapMm || 5;
            const leftCol = div.querySelector('.column.left');
            const rightCol = div.querySelector('.column.right');
            if (leftCol) leftCol.style.paddingRight = gap + 'mm';
            if (rightCol) rightCol.style.paddingLeft = gap + 'mm';
        }

        const layoutSelect = div.querySelector('.page-layout-select');
        if (layoutSelect) {
            layoutSelect.value = String(columnsCount);
            layoutSelect.addEventListener('change', async (e) => {
                const next = parseInt(e.target.value, 10) === 1 ? 1 : 2;
                if (!settings.pageLayouts) settings.pageLayouts = {};
                const defaultColumns = parseInt(settings.columns) === 1 ? 1 : 2;
                if (next === defaultColumns) delete settings.pageLayouts[num];
                else settings.pageLayouts[num] = next;
                State.saveHistory();
                this.renderPages();
                await ManualRenderer.renderAll();
            });
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
        const labelFamilyMap = {
            serif: "'Noto Serif KR', serif",
            gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
            gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
        };
        const labelKey = State.settings.labelFontFamily || 'gothic';
        const labelBold = State.settings.labelBold !== false;
        const labelUnderline = State.settings.labelUnderline === true;
        const labelSize = State.settings.labelFontSizePt;
        document.documentElement.style.setProperty('--label-font-family', labelFamilyMap[labelKey] || labelFamilyMap.gothic);
        document.documentElement.style.setProperty('--label-font-weight', labelBold ? '800' : '400');
        document.documentElement.style.setProperty('--label-text-decoration', labelUnderline ? 'underline' : 'none');
        document.documentElement.style.setProperty('--label-font-size', Number.isFinite(labelSize) ? `${labelSize}pt` : 'inherit');

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
        if(State.settings.zoom) { container.style.transform = `scale(${State.settings.zoom})`; container.style.transformOrigin = 'top center'; document.getElementById('zoomRange').value = State.settings.zoom; }

        let pageNum = 1; let currentPage = this.createPage(pageNum); container.appendChild(currentPage);
        let columns = this.getPageColumns(pageNum, currentPage);
        let colIndex = 0; let curCol = columns[colIndex];

        const moveToNextColumn = () => {
            colIndex++;
            if (colIndex >= columns.length) {
                pageNum++; currentPage = this.createPage(pageNum); container.appendChild(currentPage);
                columns = this.getPageColumns(pageNum, currentPage);
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
                Events.updateImageInsertAvailability();
            }, 0);
        } else {
            Events.updateImageInsertAvailability();
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
        const isConceptDerived = block.derived === 'concept-answers';
        if (block.derived && !isConceptDerived) {
            const wrap = document.createElement('div');
            wrap.className = 'block-wrapper derived-block';
            wrap.dataset.derived = block.derived;
            if (block.style && block.style.textAlign) wrap.style.textAlign = block.style.textAlign;
            if (block.bgGray) wrap.classList.add('bg-gray-block');

            const box = document.createElement('div');
            box.className = `editable-box ${block.type}-box`;
            box.innerHTML = block.content;
            box.contentEditable = false;
            if (block.type === 'concept') box.classList.add('concept-box');
            if (block.bordered) box.classList.add('bordered-box');

            const familyKey = block.fontFamily || State.settings.fontFamily || 'serif';
            const sizePt = block.fontSizePt || State.settings.fontSizePt || 10.5;
            const familyMap = {
                serif: "'Noto Serif KR', serif",
                gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
                gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
            };
            box.style.fontFamily = familyMap[familyKey] || familyMap.serif;
            box.style.fontSize = sizePt + 'pt';

            wrap.appendChild(box);
            return wrap;
        }

        const wrap = document.createElement('div'); wrap.className = 'block-wrapper'; wrap.dataset.id = block.id;
        if (isConceptDerived) wrap.dataset.derived = 'concept-answers';
        if(block.style && block.style.textAlign) wrap.style.textAlign = block.style.textAlign;
        if(block.bgGray) wrap.classList.add('bg-gray-block'); 

        if (!isConceptDerived) {
            const actions = document.createElement('div'); actions.className = 'block-actions';
            const btnBr = document.createElement('button'); btnBr.className = 'block-action-btn'; btnBr.innerText = '⤵'; btnBr.title = '단 나누기 추가'; btnBr.dataset.action = 'add-break';
            const btnSp = document.createElement('button'); btnSp.className = 'block-action-btn'; btnSp.innerText = '▱'; btnSp.title = '여백 블록 추가'; btnSp.dataset.action = 'add-spacer';
            actions.appendChild(btnBr); actions.appendChild(btnSp); wrap.appendChild(actions);
        }

        if (!isConceptDerived) {
            wrap.addEventListener('click', (e) => {
                 if (e.target.closest('.block-actions')) return;
                 if (!(e.ctrlKey || e.metaKey)) return;
                 if (e.altKey) { e.preventDefault(); e.stopPropagation(); this.performAndRender(() => Actions.addBlockBelow('break', block.id)); return; }
                 if (e.shiftKey) { e.preventDefault(); e.stopPropagation(); this.performAndRender(() => Actions.addBlockBelow('spacer', block.id)); return; }
            });
        }

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
            if (isConceptDerived) return;
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
            const isConceptAnswer = isConceptDerived;
            box.contentEditable = true;
            if (isConceptAnswer) {
                box.classList.add('concept-answer-box');
                box.tabIndex = 0;
                if (block.conceptAnswerStart) box.dataset.answerStart = String(block.conceptAnswerStart);
                if (block.conceptAnswerAssigned) box.dataset.answerCount = String(block.conceptAnswerAssigned);
            }
            const placeholderMap = {
                concept: "개념 내용 입력… (수식: $...$ / 줄바꿈: Shift+Enter)",
                example: "내용 입력… (수식: $...$ / 줄바꿈: Shift+Enter)",
                answer: "해설 입력… (수식: $...$ / 줄바꿈: Shift+Enter)"
            };
            if (!isConceptAnswer) box.dataset.placeholder = placeholderMap[block.type] || placeholderMap.example;

            const familyKey = block.fontFamily || State.settings.fontFamily || 'serif';
            const sizePt = block.fontSizePt || State.settings.fontSizePt || 10.5;
            const familyMap = {
                serif: "'Noto Serif KR', serif",
                gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
                gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
            };
            box.style.fontFamily = familyMap[familyKey] || familyMap.serif;
            box.style.fontSize = sizePt + 'pt';
            
            if (!isConceptAnswer) {
                box.addEventListener('blur', async () => {
                    const hasRawEdit = !!box.querySelector('.raw-edit');
                    const shouldStripRawEdit = hasRawEdit && State.renderingEnabled;
                    const cleaned = shouldStripRawEdit
                        ? Utils.cleanRichContentToTex(box.innerHTML)
                        : Utils.cleanRichContentToTexPreserveRaw(box.innerHTML);
                    const contentChanged = cleaned !== block.content;
                    if (!contentChanged && !shouldStripRawEdit) return;

                    if (contentChanged) Actions.updateBlockContent(block.id, cleaned, true);
                    if (!State.renderingEnabled) {
                        this.debouncedRebalance();
                        this.updatePreflightPanel();
                        return;
                    }
                    if (!window.isMathJaxReady) {
                        this.debouncedRebalance();
                        this.updatePreflightPanel();
                        return;
                    }

                    if (shouldStripRawEdit) box.innerHTML = cleaned;

                    const hasConceptBlank = /\[개념빈칸[:_]/.test(cleaned);
                    const needsTypeset = /\[빈칸[:_]/.test(cleaned)
                        || cleaned.includes('$')
                        || cleaned.includes('[이미지')
                        || cleaned.includes('[블록박스')
                        || cleaned.includes('[블록사각형')
                        || cleaned.includes('[표_')
                        || cleaned.includes('[선지_')
                        || cleaned.includes('[BOLD')
                        || cleaned.includes('[굵게')
                        || cleaned.includes('[밑줄');
                    if (hasConceptBlank) {
                        await ManualRenderer.renderAll();
                    } else if (needsTypeset) {
                        await ManualRenderer.typesetElement(box);
                    }
                    this.debouncedRebalance(); 
                    this.updatePreflightPanel();
                });
                box.oninput=(e)=>{ 
                    const cleanHTML = Utils.cleanRichContentToTexPreserveRaw(box.innerHTML); 
                    Actions.updateBlockContent(block.id, cleanHTML, false);
                    const inputType = e && e.inputType ? e.inputType : '';
                    const isDelete = typeof inputType === 'string' && inputType.startsWith('delete');
                    const delay = isDelete ? 0 : 1000;
                    const reason = isDelete ? 'edit' : 'typing';
                    State.saveHistory(delay, { reason, blockId: block.id, coalesceMs: 2000 });
                    this.debouncedRebalance(); // 입력 시 자동 레이아웃 조정
                    this.updatePreflightPanel();
                };
                // 렌더링 콜백을 Events로 전달
                box.onkeydown = (e) => Events.handleBlockKeydown(e, block.id, box, () => { this.renderPages(); ManualRenderer.renderAll(); });
                box.onmousedown = (e) => Events.handleBlockMousedown(e, block.id);
            } else {
                box.onkeydown = (e) => Events.handleConceptAnswerKeydown(e, block.id, box);
                box.onmousedown = () => { box.focus(); };
                box.addEventListener('input', (e) => Events.handleConceptAnswerInput(e, block.id, box));
                box.addEventListener('blur', (e) => Events.handleConceptAnswerInput(e, block.id, box, { immediate: true }));
            }
            wrap.appendChild(box);
        }
        return wrap;
    },

    createConceptAnswerBlock(capacity = null, manualSplit = false) {
        const suffix = Math.random().toString(16).slice(2, 6);
        const block = {
            id: `concept_${Date.now()}_${suffix}`,
            type: 'answer',
            content: '',
            bgGray: true,
            derived: 'concept-answers'
        };
        if (Number.isFinite(capacity) && capacity > 0) block.conceptAnswerCount = capacity;
        if (manualSplit) block.conceptAnswerSplit = true;
        return block;
    },

    syncConceptAnswerBlocks(answersInput) {
        const answers = Array.isArray(answersInput)
            ? answersInput
            : (Array.isArray(State.conceptBlankAnswers) ? State.conceptBlankAnswers : []);
        const answersIsMath = Array.isArray(State.conceptBlankAnswersIsMath)
            ? State.conceptBlankAnswersIsMath
            : [];
        let structureChanged = false;
        let contentChanged = false;

        const blocks = State.docData.blocks;
        let conceptBlocks = [];
        blocks.forEach((block, idx) => {
            if (block.derived === 'concept-answers') {
                conceptBlocks.push(block);
            }
        });

        if (!answers.length) {
            if (conceptBlocks.length) {
                State.docData.blocks = blocks.filter(block => block.derived !== 'concept-answers');
                structureChanged = true;
            }
            return { structureChanged, contentChanged, blocks: [] };
        }

        const hasManualSplit = conceptBlocks.some(block => block.conceptAnswerSplit);
        if (conceptBlocks.length > 1 && !hasManualSplit) {
            const keep = conceptBlocks[0];
            State.docData.blocks = blocks.filter(block => block.derived !== 'concept-answers' || block === keep);
            structureChanged = true;
            conceptBlocks = [keep];
        }
        if (!conceptBlocks.length) {
            const created = this.createConceptAnswerBlock();
            blocks.push(created);
            conceptBlocks = [created];
            structureChanged = true;
        }

        const escapeHtml = (value = '') => {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };
        const normalizeAnswer = (value = '') => {
            return String(value).replace(/\r\n/g, '\n').replace(/\n/g, ' ').trim();
        };
        const wrapMathAnswer = (value = '', isMath = false) => {
            const normalized = normalizeAnswer(value);
            if (!isMath) return normalized;
            if (!normalized) return normalized;
            if (normalized.includes('$')) return normalized;
            return `$${normalized}$`;
        };
        const sanitizeSeparatorHtml = (value = '') => {
            if (typeof value !== 'string' || !value) return '';
            const container = document.createElement('div');
            container.innerHTML = value;
            const nodes = Array.from(container.querySelectorAll('*'));
            nodes.forEach((node) => {
                const tag = node.tagName ? node.tagName.toLowerCase() : '';
                if (tag === 'br') return;
                node.replaceWith(document.createTextNode(node.textContent || ''));
            });
            return container.innerHTML;
        };
        const buildSeparatorConfig = (block, itemCount, includeLabel) => {
            const stored = block && typeof block === 'object' ? block.conceptAnswerSeparators : null;
            const hasLeading = stored && Object.prototype.hasOwnProperty.call(stored, 'leading');
            const hasTrailing = stored && Object.prototype.hasOwnProperty.call(stored, 'trailing');
            const leadingDefault = includeLabel ? ' ' : '';
            const leading = sanitizeSeparatorHtml(hasLeading ? stored.leading : leadingDefault);
            const trailing = sanitizeSeparatorHtml(hasTrailing ? stored.trailing : '');
            let between = Array.isArray(stored && stored.between)
                ? stored.between.map(sanitizeSeparatorHtml)
                : [];
            const needed = Math.max(0, itemCount - 1);
            if (between.length > needed) between = between.slice(0, needed);
            if (between.length < needed) {
                const fill = between.length ? between[between.length - 1] : '&nbsp;&nbsp;';
                while (between.length < needed) between.push(fill);
            }
            const normalized = { leading, between, trailing };
            if (block) block.conceptAnswerSeparators = normalized;
            return normalized;
        };
        const buildContent = (slice, startIndex, includeLabel, block) => {
            const items = slice.map((answer, idx) => {
                const index = startIndex + idx + 1;
                const isMath = !!answersIsMath[index - 1];
                const displayAnswer = wrapMathAnswer(answer, isMath);
                const cleaned = escapeHtml(displayAnswer);
                return `<span class="concept-answer-item" data-answer-index="${index}" contenteditable="false">(${index}) ${cleaned}</span>`;
            });
            const separators = buildSeparatorConfig(block, items.length, includeLabel);
            const labelHtml = includeLabel ? `<span class="q-label" contenteditable="false">개념 빈칸 정답</span>` : '';
            let html = labelHtml;
            html += separators.leading || '';
            items.forEach((item, idx) => {
                html += item;
                if (idx < items.length - 1) html += separators.between[idx] || '&nbsp;&nbsp;';
            });
            html += separators.trailing || '';
            return html;
        };

        if (conceptBlocks.length === 1) {
            const block = conceptBlocks[0];
            const nextContent = buildContent(answers, 0, true, block);
            if (block.content !== nextContent) {
                block.content = nextContent;
                contentChanged = true;
            }
            block.type = 'answer';
            block.bgGray = true;
            block.derived = 'concept-answers';
            block.conceptAnswerSplit = false;
            block.conceptAnswerCount = answers.length;
            block.conceptAnswerStart = answers.length ? 1 : null;
            block.conceptAnswerAssigned = answers.length;
            return { structureChanged, contentChanged, blocks: conceptBlocks };
        }

        const capacities = conceptBlocks.map((block) => {
            const count = parseInt(block.conceptAnswerCount, 10);
            if (Number.isFinite(count) && count > 0) return count;
            const assigned = parseInt(block.conceptAnswerAssigned, 10);
            if (Number.isFinite(assigned) && assigned > 0) return assigned;
            return null;
        });

        const assignments = [];
        let answerIndex = 0;
        for (let i = 0; i < conceptBlocks.length; i++) {
            const remaining = answers.length - answerIndex;
            let count = 0;
            if (remaining > 0) {
                if (i === conceptBlocks.length - 1) {
                    count = remaining;
                } else {
                    const capacity = capacities[i];
                    if (capacity) count = Math.min(capacity, remaining);
                }
            }
            assignments.push({ block: conceptBlocks[i], startIndex: answerIndex, count });
            answerIndex += count;
        }

        let lastNonEmpty = -1;
        assignments.forEach((assignment, idx) => {
            if (assignment.count > 0) lastNonEmpty = idx;
        });
        for (let i = assignments.length - 1; i > lastNonEmpty; i--) {
            const block = assignments[i].block;
            const idx = blocks.indexOf(block);
            if (idx !== -1) {
                blocks.splice(idx, 1);
                structureChanged = true;
            }
            assignments.pop();
        }
        if (assignments.length === 1) {
            const onlyBlock = assignments[0].block;
            const nextContent = buildContent(answers, 0, true, onlyBlock);
            if (onlyBlock.content !== nextContent) {
                onlyBlock.content = nextContent;
                contentChanged = true;
            }
            onlyBlock.type = 'answer';
            onlyBlock.bgGray = true;
            onlyBlock.derived = 'concept-answers';
            onlyBlock.conceptAnswerSplit = false;
            onlyBlock.conceptAnswerCount = answers.length;
            onlyBlock.conceptAnswerStart = answers.length ? 1 : null;
            onlyBlock.conceptAnswerAssigned = answers.length;
            return { structureChanged, contentChanged, blocks: [onlyBlock] };
        }

        assignments.forEach((assignment, idx) => {
            const includeLabel = idx === 0;
            const slice = answers.slice(assignment.startIndex, assignment.startIndex + assignment.count);
            const nextContent = buildContent(slice, assignment.startIndex, includeLabel, assignment.block);
            if (assignment.block.content !== nextContent) {
                assignment.block.content = nextContent;
                contentChanged = true;
            }
            assignment.block.type = 'answer';
            assignment.block.bgGray = true;
            assignment.block.derived = 'concept-answers';
            assignment.block.conceptAnswerSplit = true;
            if (idx === assignments.length - 1) {
                assignment.block.conceptAnswerCount = assignment.count;
            } else if (assignment.block.conceptAnswerCount === undefined || assignment.block.conceptAnswerCount === null) {
                assignment.block.conceptAnswerCount = assignment.count;
            }
            assignment.block.conceptAnswerStart = assignment.count ? assignment.startIndex + 1 : null;
            assignment.block.conceptAnswerAssigned = assignment.count;
        });

        return { structureChanged, contentChanged, blocks: assignments.map(a => a.block) };
    },

    async refreshConceptBlankAnswerBlocks(answersInput) {
        const container = document.getElementById('paper-container');
        if (!container) return;

        const syncResult = this.syncConceptAnswerBlocks(answersInput);

        if (!State.renderingEnabled) {
            if (syncResult.structureChanged) this.renderPages();
            this.debouncedRebalance();
            return;
        }

        const domBlocks = container.querySelectorAll('.block-wrapper[data-derived="concept-answers"]');
        const expectedCount = syncResult.blocks.length;
        const needsFullRender = syncResult.structureChanged || domBlocks.length !== expectedCount;
        if (needsFullRender) {
            this.renderPages();
            await ManualRenderer.renderAll(null, { skipConceptBlankSync: true });
            this.debouncedRebalance();
            return;
        } else if (syncResult.contentChanged) {
            domBlocks.forEach((wrap) => {
                const id = wrap.dataset.id;
                const block = State.docData.blocks.find(item => item.id === id);
                if (!block) return;
                const box = wrap.querySelector('.editable-box');
                if (!box) return;
                if (box.innerHTML !== block.content) box.innerHTML = block.content;
                if (block.conceptAnswerStart) box.dataset.answerStart = String(block.conceptAnswerStart);
                if (block.conceptAnswerAssigned !== undefined) box.dataset.answerCount = String(block.conceptAnswerAssigned);
            });
        }

        const conceptBoxes = Array.from(document.querySelectorAll('.block-wrapper[data-derived="concept-answers"] .editable-box'));
        if (window.isMathJaxReady && conceptBoxes.length) {
            await Promise.all(conceptBoxes.map(box => ManualRenderer.typesetElement(box, { trackConceptBlanks: false })));
        }

        this.debouncedRebalance();
    },

    async updateConceptBlankSummary(options = {}) {
        if (this.conceptBlankSyncing) {
            this.queueConceptBlankSummaryUpdate(options.changedBlockId);
            return;
        }
        if (!State.renderingEnabled) {
            await this.refreshConceptBlankAnswerBlocks([]);
            return;
        }
        if (!window.isMathJaxReady) return;
        if (ManualRenderer.isRendering) {
            this.queueConceptBlankSummaryUpdate(options.changedBlockId);
            return;
        }

        const idsWithConceptBlank = new Set();
        State.docData.blocks.forEach((block) => {
            if (typeof block.content === 'string' && block.content.includes('[개념빈칸')) {
                idsWithConceptBlank.add(block.id);
            }
        });
        if (options.changedBlockId) idsWithConceptBlank.add(options.changedBlockId);

        this.conceptBlankSyncing = true;
        try {
            ManualRenderer.resetConceptBlankTracking();
            for (const block of State.docData.blocks) {
                if (!idsWithConceptBlank.has(block.id)) continue;
                const wrap = document.querySelector(`.block-wrapper[data-id="${block.id}"]`);
                if (!wrap) continue;
                const box = wrap.querySelector('.editable-box');
                if (!box) continue;
                await ManualRenderer.typesetElement(box);
            }
            ManualRenderer.syncConceptBlankAnswers();
            await this.refreshConceptBlankAnswerBlocks();
            this.updatePreflightPanel();
        } finally {
            this.conceptBlankSyncing = false;
        }
    },

    rebalanceLayout: Utils.debounce(function() {
        const container = document.getElementById('paper-container');
        let pages = Array.from(container.querySelectorAll('.page'));
        let columns = [];
        pages.forEach((p, idx) => {
            const pageNum = idx + 1;
            columns.push(...this.getPageColumns(pageNum, p));
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
                    const newColumns = this.getPageColumns(newPageNum, newPage);
                    columns.push(...newColumns); nextCol = newColumns[0];
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
    syncBlock(id, recordHistory = false) {
        const wrap = document.querySelector(`.block-wrapper[data-id="${id}"]`); if (!wrap) return;
        const box = wrap.querySelector('.editable-box');
        if (box) Actions.updateBlockContent(id, Utils.cleanRichContentToTexPreserveRaw(box.innerHTML), recordHistory);
    },

    syncAllBlocks() { 
        const newBlocks = [];
        document.querySelectorAll('.block-wrapper').forEach(wrap => {
            const id = wrap.dataset.id;
            const block = State.docData.blocks.find(b => b.id === id);
            if(block) {
                const box = wrap.querySelector('.editable-box');
                if(box) block.content = Utils.cleanRichContentToTexPreserveRaw(box.innerHTML);
                newBlocks.push(block);
            }
        });
        State.docData.blocks = newBlocks;
        State.saveHistory(500); 
    }
};
