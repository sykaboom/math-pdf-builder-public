// Filename: js/events.js
import { State } from './state.js';
import { Actions } from './actions.js';
import { Renderer } from './renderer.js'; // 순환 참조 아님 (내부 호출용)
import { ManualRenderer, FileSystem } from './services.js';
import { Utils } from './utils.js';
import { createTableEditor } from './table-editor.js';

export const Events = {
    showResizer(img) {
        State.selectedImage = img; 
        const resizer = document.getElementById('image-resizer'); 
        const rect = img.getBoundingClientRect(); 
        resizer.style.display = 'block'; resizer.style.top = (rect.top + window.scrollY) + 'px'; resizer.style.left = (rect.left + window.scrollX) + 'px'; resizer.style.width = rect.width + 'px'; resizer.style.height = rect.height + 'px';
    },
    hideResizer() { document.getElementById('image-resizer').style.display = 'none'; State.selectedImage = null; },

    focusNextBlock(currentId, direction) { 
        const idx = State.docData.blocks.findIndex(b => b.id === currentId); 
        let nextIdx = idx + direction; 
        while(nextIdx >= 0 && nextIdx < State.docData.blocks.length) { 
            const nextBlock = State.docData.blocks[nextIdx]; 
            if (['concept', 'example'].includes(nextBlock.type)) { 
                const nextEl = document.querySelector(`.block-wrapper[data-id="${nextBlock.id}"] .editable-box`); 
                if(nextEl) { nextEl.focus(); const nextWrap = nextEl.closest('.block-wrapper'); nextWrap.classList.add('temp-show-handle'); setTimeout(() => nextWrap.classList.remove('temp-show-handle'), 1000); } 
                return; 
            } 
            nextIdx += direction; 
        } 
    },
    
    insertImageBoxSafe() {
        const active = document.activeElement;
        if(active && active.isContentEditable) {
            const wrap = active.closest('.block-wrapper');
            const id = wrap ? wrap.dataset.id : null;
            document.execCommand('insertHTML', false, Utils.getImagePlaceholderHTML());
            if (id) {
                Actions.updateBlockContent(id, Utils.cleanRichContentToTex(active.innerHTML), true);
                Renderer.debouncedRebalance();
                State.lastEditableId = id;
            }
            return;
        }

        const targetId = State.lastEditableId || State.contextTargetId;
        if (targetId) {
            const box = document.querySelector(`.block-wrapper[data-id="${targetId}"] .editable-box`);
            if (box) {
                box.focus();
                const r = document.createRange(); r.selectNodeContents(box); r.collapse(false);
                const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
                document.execCommand('insertHTML', false, Utils.getImagePlaceholderHTML());
                Actions.updateBlockContent(targetId, Utils.cleanRichContentToTex(box.innerHTML), true);
                Renderer.debouncedRebalance();
                return;
            }
        }

        if(Actions.addBlockBelow('image')) {
            Renderer.renderPages();
            ManualRenderer.renderAll();
        }
    },

    addImageBlockBelow(refId) {
        const targetId = refId || State.contextTargetId;
        if (Actions.addBlockBelow('image', targetId)) {
            Renderer.renderPages();
            ManualRenderer.renderAll();
        }
    },

    insertImagePlaceholderAtEnd(refId) {
        const targetId = refId || State.contextTargetId;
        if (!targetId) return;
        const box = document.querySelector(`.block-wrapper[data-id="${targetId}"] .editable-box`);
        if (!box) return;
        box.focus();
        const r = document.createRange(); r.selectNodeContents(box); r.collapse(false);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        document.execCommand('insertHTML', false, `<br>${Utils.getImagePlaceholderHTML()}`);
        Actions.updateBlockContent(targetId, Utils.cleanRichContentToTex(box.innerHTML), true);
        Renderer.debouncedRebalance();
        State.lastEditableId = targetId;
    },

    splitBlockAtCursor(refId) {
        const targetId = refId || State.lastEditableId || State.contextTargetId;
        if (!targetId) return false;
        const block = State.docData.blocks.find(b => b.id === targetId);
        if (!block || !['concept', 'example', 'answer'].includes(block.type)) return false;
        const box = document.querySelector(`.block-wrapper[data-id="${targetId}"] .editable-box`);
        if (!box) return false;

        const sel = window.getSelection();
        if (!sel.rangeCount || !box.contains(sel.anchorNode)) {
            box.focus();
            const r = document.createRange();
            r.selectNodeContents(box);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
        }
        if (sel.rangeCount && !sel.isCollapsed) sel.collapseToEnd();

        if (!sel.rangeCount) return false;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) range.deleteContents();

        const br = document.createElement('br');
        const atomAfter = Utils.getAtomAfterCaret(box);
        if (atomAfter && atomAfter.parentNode) atomAfter.parentNode.insertBefore(br, atomAfter);
        else range.insertNode(br);

        const beforeRange = document.createRange();
        beforeRange.selectNodeContents(box);
        beforeRange.setEndBefore(br);

        const afterRange = document.createRange();
        afterRange.selectNodeContents(box);
        afterRange.setStartAfter(br);

        const rangeToHtml = (r) => {
            const tmp = document.createElement('div');
            tmp.appendChild(r.cloneContents());
            return tmp.innerHTML;
        };

        let beforeHtml = rangeToHtml(beforeRange);
        let afterHtml = rangeToHtml(afterRange);
        br.remove();

        const labelEl = box.querySelector('.q-label');
        const labelHtml = labelEl ? labelEl.outerHTML : '';
        if (labelHtml) {
            const tmpAfter = document.createElement('div');
            tmpAfter.innerHTML = afterHtml;
            tmpAfter.querySelectorAll('.q-label').forEach(el => el.remove());
            afterHtml = tmpAfter.innerHTML;

            const tmpBefore = document.createElement('div');
            tmpBefore.innerHTML = beforeHtml;
            if (!tmpBefore.querySelector('.q-label')) {
                if (tmpBefore.innerHTML.trim()) tmpBefore.insertAdjacentHTML('afterbegin', `${labelHtml} `);
                else tmpBefore.innerHTML = `${labelHtml} `;
            }
            beforeHtml = tmpBefore.innerHTML;
        }

        const cleanBefore = Utils.cleanRichContentToTex(beforeHtml);
        const cleanAfter = Utils.cleanRichContentToTex(afterHtml);
        return Actions.splitBlockWithContents(targetId, cleanBefore, cleanAfter);
    },

    populateFontMenu(targetId) {
        const b = State.docData.blocks.find(x => x.id === targetId);
        const famSel = document.getElementById('block-font-family-select');
        const sizeInp = document.getElementById('block-font-size-input');
        if (famSel) famSel.value = b && b.fontFamily ? b.fontFamily : 'default';
        if (sizeInp) {
            sizeInp.placeholder = State.docData.meta.fontSizePt || 10.5;
            sizeInp.value = b && b.fontSizePt ? b.fontSizePt : '';
        }
    },

    applyBlockFontFromMenu() {
        const id = State.contextTargetId;
        if (!id) return;
        const famSel = document.getElementById('block-font-family-select');
        const sizeInp = document.getElementById('block-font-size-input');
        if (famSel) Actions.setBlockFontFamily(id, famSel.value);
        if (sizeInp) Actions.setBlockFontSize(id, sizeInp.value);
        Renderer.renderPages();
        ManualRenderer.renderAll();
        Utils.closeModal('context-menu');
    },

    applyInlineStyleToSelection(styles = {}) {
        const styleEntries = Object.entries(styles).filter(([, value]) => value !== undefined && value !== null && value !== '');
        if (!styleEntries.length) return;
        const sel = window.getSelection();
        const baseRange = State.selectionRange ? State.selectionRange.cloneRange() : (sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null);
        if (!baseRange || baseRange.collapsed) return;
        const container = baseRange.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? baseRange.commonAncestorContainer
            : baseRange.commonAncestorContainer.parentNode;
        const box = container ? container.closest('.editable-box') : null;
        if (!box) return;
        const wrap = box.closest('.block-wrapper');
        if (!wrap) return;

        const span = document.createElement('span');
        styleEntries.forEach(([key, value]) => { span.style[key] = value; });
        const contents = baseRange.extractContents();

        const stripInlineStyles = (node, keys) => {
            if (!node) return;
            if (node.nodeType === Node.ELEMENT_NODE) {
                keys.forEach((key) => {
                    if (node.style && node.style[key]) node.style[key] = '';
                });
                if (node.getAttribute && node.getAttribute('style') === '') node.removeAttribute('style');
            }
            node.childNodes && node.childNodes.forEach(child => stripInlineStyles(child, keys));
        };
        const styleKeys = styleEntries.map(([key]) => key);
        stripInlineStyles(contents, styleKeys);

        span.appendChild(contents);
        baseRange.insertNode(span);

        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(newRange);
        State.selectionRange = newRange.cloneRange();
        State.selectionBlockId = wrap.dataset.id || null;

        Actions.updateBlockContent(wrap.dataset.id, Utils.cleanRichContentToTex(box.innerHTML), true);
        Renderer.debouncedRebalance();
    },

    applyInlineFontFamily(familyKey) {
        if (!familyKey) return;
        const familyMap = {
            serif: "'Noto Serif KR', serif",
            gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
            gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
        };
        const fontFamily = familyKey === 'default' ? 'inherit' : (familyMap[familyKey] || familyKey);
        this.applyInlineStyleToSelection({ fontFamily });
    },

    applyInlineFontSize(sizePt) {
        if (sizePt === undefined || sizePt === null || sizePt === '') return;
        const sizeValue = parseFloat(sizePt);
        const fontSize = sizeValue > 0 ? `${sizeValue}pt` : 'inherit';
        this.applyInlineStyleToSelection({ fontSize });
    },

    handleBlockMousedown(e, id) {
        State.lastEditableId = id;
        if(e.target.tagName==='IMG') { this.showResizer(e.target); e.stopPropagation(); State.selectedImage=e.target; }
        const placeholder = e.target.closest('.image-placeholder');
        if(placeholder) { e.stopPropagation(); if(State.selectedPlaceholder) State.selectedPlaceholder.classList.remove('selected'); State.selectedPlaceholder = placeholder; State.selectedPlaceholder.classList.add('selected'); State.selectedPlaceholder.setAttribute('contenteditable', 'false'); }
    },

    handleBlockKeydown(e, id, box, renderCallback) {
        if (e.key === 'Backspace') {
            const atomBefore = Utils.getAtomBeforeCaret(box); 
            if (atomBefore) {
                e.preventDefault();
                atomBefore.remove();
                Actions.updateBlockContent(id, Utils.cleanRichContentToTex(box.innerHTML), false);
                State.saveHistory(0, { reason: 'edit', blockId: id });
                return;
            }
            if(box.innerText.trim() === '' && box.innerHTML.replace(/<br>/g,'').trim() === '') { 
                const prevIdx = State.docData.blocks.findIndex(b=>b.id===id) - 1; 
                if (prevIdx >= 0) { 
                    e.preventDefault(); 
                    const prevId = State.docData.blocks[prevIdx].id; 
                    // [Fix] 삭제 전 포커스 ID 저장, 변경 성공 시 렌더링
                    if(Actions.deleteBlockById(id)) {
                        State.lastFocusId = prevId; 
                        renderCallback(); 
                    }
                } 
            }
        }
        if (e.key === 'Enter' && e.altKey && e.shiftKey) {
            e.preventDefault();
            if (this.splitBlockAtCursor(id)) renderCallback();
            return;
        }
        if (e.key === 'Enter' && e.shiftKey) { const atomAfter = Utils.getAtomAfterCaret(box); if (atomAfter) { e.preventDefault(); const br = document.createElement('br'); atomAfter.parentNode.insertBefore(br, atomAfter); const r = document.createRange(); const s = window.getSelection(); r.setStartAfter(br); r.collapse(true); s.removeAllRanges(); s.addRange(r); Actions.updateBlockContent(id, Utils.cleanRichContentToTex(box.innerHTML), true); return; } }
        if(e.key === 'Tab') { e.preventDefault(); if(e.shiftKey) document.execCommand('insertHTML', false, '&nbsp;'.repeat(10)); else if(e.ctrlKey) this.focusNextBlock(id, -1); else this.focusNextBlock(id, 1); return; }
        if(e.key === 'ArrowDown') { if (Utils.isCaretOnLastLine(box)) { e.preventDefault(); this.focusNextBlock(id, 1); } }
        if(e.key === 'ArrowUp') { if (Utils.isCaretOnFirstLine(box)) { e.preventDefault(); this.focusNextBlock(id, -1); } }
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            let changed = false;
            if(e.ctrlKey) changed = Actions.addBlockBelow('break', id);
            else if(e.altKey) changed = Actions.addBlockAbove('example', id);
            else changed = Actions.addBlockBelow('example', id);
            if(changed) renderCallback();
        }
        
        // 스타일 단축키 (Actions 호출 -> 변경 시 callback 실행)
        let styleChanged = false;
        if((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.toggleStyle('bordered'); }
        if((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.toggleStyle('bgGray'); }
        if((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.duplicateTargetBlock(); }
        if((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.applyAlign('left'); }
        if((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.applyAlign('right'); }
        if((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.applyAlign('center'); }
        if((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); this.insertImageBoxSafe(); return; }
        
        if(styleChanged) renderCallback();
    },

    initGlobalListeners() {
        const body = document.body;

        const isFileDrag = (e) => {
            const dt = e.dataTransfer;
            if (!dt) return false;
            if (dt.types && Array.from(dt.types).includes('Files')) return true;
            if (dt.items && Array.from(dt.items).some(item => item.kind === 'file')) return true;
            if (dt.files && dt.files.length > 0) return true;
            return false;
        };

        body.addEventListener('dragover', (e) => {
            if (State.dragSrcId) return;
            if (!isFileDrag(e)) return;
            e.preventDefault();
            body.classList.add('drag-over');
        });
        body.addEventListener('dragleave', (e) => { if(!e.relatedTarget) body.classList.remove('drag-over'); });
        
        body.addEventListener('drop', (e) => {
            if(State.dragSrcId) return; 
            if (!isFileDrag(e)) { body.classList.remove('drag-over'); return; }
            e.preventDefault(); body.classList.remove('drag-over');
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if(file) {
                if(file.name.endsWith('.json')) {
                    const r = new FileReader(); r.onload = async (ev) => { try { State.docData = JSON.parse(ev.target.result); await FileSystem.loadImagesForDisplay(State.docData.blocks); Renderer.renderPages(); ManualRenderer.renderAll(); State.saveHistory(); } catch(err){ alert("로드 실패"); } }; r.readAsText(file);
                } else if (file.type === 'text/plain' || /\.txt$/i.test(file.name)) {
                    const r = new FileReader(); r.onload = (ev) => { document.getElementById('import-textarea').value = ev.target.result; Utils.openModal('import-modal'); }; r.readAsText(file);
                }
            }
        });

        const preflightPanel = document.getElementById('preflight-panel');
        if (preflightPanel) {
            preflightPanel.addEventListener('click', (e) => {
                const item = e.target.closest('.preflight-item');
                if (!item) return;
                Renderer.jumpToPreflight(item.dataset.type);
            });
        }
        document.addEventListener('preflight:update', () => Renderer.updatePreflightPanel());

        const tableEditor = createTableEditor();
        tableEditor.init();

        // [Fix] 스크롤 시 팝업 닫기 추가
        window.addEventListener('scroll', () => {
            document.getElementById('context-menu').style.display = 'none';
            document.getElementById('floating-toolbar').style.display = 'none';
            tableEditor.handleScroll();
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                tableEditor.handleEscape();
                Utils.closeModal('context-menu'); document.getElementById('floating-toolbar').style.display='none'; this.hideResizer(); Utils.closeModal('import-modal'); Utils.closeModal('find-replace-modal'); return;
            }
            const key = e.key.toLowerCase();
            State.keysPressed[key] = true; 
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'f') { e.preventDefault(); Utils.openModal('find-replace-modal'); document.getElementById('fr-find-input').focus(); return; } 
            if ((e.ctrlKey || e.metaKey) && key === 's') { e.preventDefault(); FileSystem.saveProjectJSON(() => Renderer.syncAllBlocks()); return; } 
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'z') { e.preventDefault(); if(State.redo()) { Renderer.renderPages(); ManualRenderer.renderAll(); } return; } 
            else if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); if(State.undo()) { Renderer.renderPages(); ManualRenderer.renderAll(); } return; } 
        });
        document.addEventListener('keyup', (e) => State.keysPressed[e.key.toLowerCase()] = false);

        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('#floating-toolbar') && !e.target.closest('.ft-btn')) document.getElementById('floating-toolbar').style.display='none'; 
            if (!e.target.closest('img') && !e.target.closest('#image-resizer')) this.hideResizer(); 
            if (!e.target.closest('#floating-toolbar') && !e.target.closest('.editable-box')) {
                State.selectionRange = null;
                State.selectionBlockId = null;
            }
            const menu = document.getElementById('context-menu');
            if (menu && menu.style.display === 'block') { if (!e.target.closest('#context-menu') && !e.target.closest('.block-handle')) menu.style.display = 'none'; }
            if (!e.target.closest('.image-placeholder') && !e.target.closest('#imgUpload')) { if(State.selectedPlaceholder) { State.selectedPlaceholder.classList.remove('selected'); State.selectedPlaceholder.setAttribute('contenteditable', 'false'); } State.selectedPlaceholder = null; } 
            tableEditor.handleDocumentMouseDown(e);
        });
        document.addEventListener('mouseup', (e) => { const target = e.target; setTimeout(() => {
            const sel = window.getSelection();
            if (sel.rangeCount && !sel.isCollapsed) {
                const range = sel.getRangeAt(0);
                const container = range.commonAncestorContainer.nodeType===1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
                if (container.closest('.editable-box')) {
                    const rect = range.getBoundingClientRect();
                    const tb = document.getElementById('floating-toolbar');
                    const desiredTop = rect.top + window.scrollY - 45;
                    const desiredLeft = rect.left + window.scrollX + rect.width / 2;
                    tb.style.display = 'flex';
                    tb.style.top = desiredTop + 'px';
                    tb.style.left = desiredLeft + 'px';

                    const pad = 8;
                    const tbRect = tb.getBoundingClientRect();
                    let top = desiredTop; let left = desiredLeft;
                    if (tbRect.left < pad) left += pad - tbRect.left;
                    if (tbRect.right > window.innerWidth - pad) left -= tbRect.right - (window.innerWidth - pad);
                    if (tbRect.top < pad) top += pad - tbRect.top;
                    if (tbRect.bottom > window.innerHeight - pad) top -= tbRect.bottom - (window.innerHeight - pad);
                    tb.style.top = top + 'px';
                    tb.style.left = left + 'px';

                    State.selectionRange = range.cloneRange();
                    const wrap = container.closest('.block-wrapper');
                    State.selectionBlockId = wrap ? wrap.dataset.id : null;
                }
            } else if (!target.closest('#floating-toolbar')) {
                State.selectionRange = null;
                State.selectionBlockId = null;
            }
        }, 10); });

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.image-load-btn');
            if (!btn) return;
            const placeholder = btn.closest('.image-placeholder');
            if (!placeholder) return;
            e.preventDefault(); e.stopPropagation();
            if(State.selectedPlaceholder) State.selectedPlaceholder.classList.remove('selected');
            State.selectedPlaceholder = placeholder;
            placeholder.classList.add('selected');
            placeholder.setAttribute('contenteditable', 'false');
            document.getElementById('imgUpload').click();
        });
        
        document.addEventListener('dblclick', (e) => {
            if (!State.renderingEnabled) return;
            if (tableEditor.handleDoubleClick(e)) return;
            const mjx = e.target.closest('mjx-container');
            if (mjx) {
                e.preventDefault(); e.stopPropagation();
                ManualRenderer.revertToSource(mjx);
                Renderer.syncBlock(mjx.closest('.block-wrapper').dataset.id);
                return;
            }
            const blank = e.target.closest('.blank-box');
            if (blank) {
                e.preventDefault(); e.stopPropagation();
                const text = blank.innerText;
                const delim = blank.dataset ? (blank.dataset.delim || ':') : ':';
                blank.replaceWith(document.createTextNode(`[빈칸${delim}${text}]`));
                Renderer.syncBlock(blank.closest('.block-wrapper').dataset.id);
                return;
            }
            const placeholder = e.target.closest('.image-placeholder');
            if (placeholder) {
                e.preventDefault(); e.stopPropagation();
                const wrap = placeholder.closest('.block-wrapper');
                const id = wrap ? wrap.dataset.id : null;
                const label = placeholder.dataset ? (placeholder.dataset.label || '') : '';
                placeholder.replaceWith(document.createTextNode(`[이미지:${label}]`));
                if (id) Renderer.syncBlock(id);
                return;
            }
            const rectBox = e.target.closest('.rect-box');
            if (rectBox) {
                e.preventDefault(); e.stopPropagation();
                const wrap = rectBox.closest('.block-wrapper');
                const id = wrap ? wrap.dataset.id : null;
                const contentEl = rectBox.querySelector('.rect-box-content');
                let bodyText = '';
                if (contentEl) {
                    const cleaned = Utils.cleanRichContentToTex(contentEl.innerHTML);
                    const tmp = document.createElement('div');
                    tmp.innerHTML = cleaned;
                    bodyText = (tmp.innerText || '').replace(/\u00A0/g, ' ').trim();
                }
                const frag = document.createDocumentFragment();
                frag.appendChild(document.createTextNode('[블록사각형]'));
                frag.appendChild(document.createElement('br'));
                if (bodyText) {
                    const lines = bodyText.split(/\n/);
                    lines.forEach((ln, idx) => {
                        frag.appendChild(document.createTextNode(ln));
                        if (idx < lines.length - 1) frag.appendChild(document.createElement('br'));
                    });
                }
                frag.appendChild(document.createElement('br'));
                frag.appendChild(document.createTextNode('[/블록사각형]'));
                rectBox.replaceWith(frag);
                if (id) Renderer.syncBlock(id);
                return;
            }
            const customBox = e.target.closest('.custom-box');
            if (customBox) {
                e.preventDefault(); e.stopPropagation();
                const wrap = customBox.closest('.block-wrapper');
                const id = wrap ? wrap.dataset.id : null;
                let labelText = '';
                const labelEl = customBox.querySelector('.box-label');
                if (labelEl) {
                    labelText = labelEl.textContent.replace(/[<>]/g, '').trim();
                }
                const contentEl = customBox.querySelector('.box-content');
                let bodyText = '';
                if (contentEl) {
                    const cleaned = Utils.cleanRichContentToTex(contentEl.innerHTML);
                    const tmp = document.createElement('div');
                    tmp.innerHTML = cleaned;
                    bodyText = (tmp.innerText || '').replace(/\u00A0/g, ' ').trim();
                }
                const startToken = labelText ? `[블록박스_${labelText}]` : `[블록박스_]`;
                const endToken = `[/블록박스]`;
                const frag = document.createDocumentFragment();
                frag.appendChild(document.createTextNode(startToken));
                frag.appendChild(document.createElement('br'));
                if (bodyText) {
                    const lines = bodyText.split(/\n/);
                    lines.forEach((ln, idx) => {
                        frag.appendChild(document.createTextNode(ln));
                        if (idx < lines.length - 1) frag.appendChild(document.createElement('br'));
                    });
                }
                frag.appendChild(document.createElement('br'));
                frag.appendChild(document.createTextNode(endToken));
                customBox.replaceWith(frag);
                if (id) Renderer.syncBlock(id);
                return;
            }
        });
        document.addEventListener('paste', async (e) => {
            let target = null; if (State.selectedPlaceholder && State.selectedPlaceholder.getAttribute('contenteditable') === 'false') target = State.selectedPlaceholder; else { const sel = window.getSelection(); if (sel.rangeCount) { const node = sel.anchorNode; const el = node.nodeType === 1 ? node : node.parentElement; if (el.closest('.editable-box')) target = 'cursor'; } } 
            const items = (e.clipboardData || e.originalEvent.clipboardData).items; 
            for (let item of items) { 
                if (item.kind === 'file' && item.type.includes('image/')) { 
                    if(!target) return; e.preventDefault(); const file = item.getAsFile(); 
                    let saved = null; 
                    if(FileSystem.dirHandle) saved = await FileSystem.saveImage(file); 
                    else { const reader = new FileReader(); saved = await new Promise(r => { reader.onload=ev=>r({url:ev.target.result, path:null}); reader.readAsDataURL(file); }); } 
                    if(!saved) return; 
                    const newImg = document.createElement('img'); newImg.src = saved.url; if(saved.path) newImg.dataset.path = saved.path; newImg.style.maxWidth = '100%'; 
                    if (target === State.selectedPlaceholder) { target.replaceWith(newImg); Actions.updateBlockContent(newImg.closest('.block-wrapper').dataset.id, newImg.closest('.editable-box').innerHTML); State.selectedPlaceholder = null; } 
                    else if (target === 'cursor') { document.execCommand('insertHTML', false, newImg.outerHTML); } 
                    State.saveHistory(500); return; 
                } 
            } 
        });

        const resizeHandle = document.querySelector('.resizer-handle');
        if(resizeHandle) resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation(); if(!State.selectedImage) return; 
            const startX = e.clientX, startY = e.clientY; const startW = State.selectedImage.offsetWidth, startH = State.selectedImage.offsetHeight; const zoom = State.docData.meta.zoom || 1.0; 
            function doDrag(evt) { const newW = Math.max(20, startW + (evt.clientX - startX) / zoom); const newH = Math.max(20, startH + (evt.clientY - startY) / zoom); State.selectedImage.style.width = newW + 'px'; State.selectedImage.style.height = newH + 'px'; Events.showResizer(State.selectedImage); } 
            function stopDrag() { window.removeEventListener('mousemove', doDrag); window.removeEventListener('mouseup', stopDrag); Actions.updateBlockContent(State.selectedImage.closest('.block-wrapper').dataset.id, State.selectedImage.closest('.editable-box').innerHTML); } 
            window.addEventListener('mousemove', doDrag); window.addEventListener('mouseup', stopDrag); 
        });
    }
};
