// Filename: js/events.js
import { State } from './state.js';
import { Actions } from './actions.js';
import { Renderer } from './renderer.js'; // 순환 참조 아님 (내부 호출용)
import { ManualRenderer, FileSystem } from './services.js';
import { Utils } from './utils.js';

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

    handleBlockMousedown(e, id) {
        State.lastEditableId = id;
        if(e.target.tagName==='IMG') { this.showResizer(e.target); e.stopPropagation(); State.selectedImage=e.target; }
        const placeholder = e.target.closest('.image-placeholder');
        if(placeholder) { e.stopPropagation(); if(State.selectedPlaceholder) State.selectedPlaceholder.classList.remove('selected'); State.selectedPlaceholder = placeholder; State.selectedPlaceholder.classList.add('selected'); State.selectedPlaceholder.setAttribute('contenteditable', 'false'); }
    },

    handleBlockKeydown(e, id, box, renderCallback) {
        if (e.key === 'Backspace') {
            const atomBefore = Utils.getAtomBeforeCaret(box); 
            if (atomBefore) { e.preventDefault(); atomBefore.remove(); Actions.updateBlockContent(id, Utils.cleanRichContentToTex(box.innerHTML), true); return; }
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

        const TABLE_RESIZE_MARGIN = 4;
        const TABLE_HANDLE_SIZE = 12;
        const TABLE_MIN_WIDTH = 40;
        const TABLE_MIN_HEIGHT = 24;
        let tableResizeState = null;
        const guideV = document.getElementById('table-resize-guide-v') || (() => {
            const el = document.createElement('div');
            el.id = 'table-resize-guide-v';
            el.className = 'table-resize-guide';
            document.body.appendChild(el);
            return el;
        })();
        const guideH = document.getElementById('table-resize-guide-h') || (() => {
            const el = document.createElement('div');
            el.id = 'table-resize-guide-h';
            el.className = 'table-resize-guide';
            document.body.appendChild(el);
            return el;
        })();
        const tableHandle = document.getElementById('table-resize-handle') || (() => {
            const el = document.createElement('div');
            el.id = 'table-resize-handle';
            el.className = 'table-resize-handle';
            document.body.appendChild(el);
            return el;
        })();

        const getTableResizeHit = (cell, event) => {
            const rect = cell.getBoundingClientRect();
            const offsetX = event.clientX - rect.left;
            const offsetY = event.clientY - rect.top;
            const distRight = rect.width - offsetX;
            const distBottom = rect.height - offsetY;
            const nearRight = distRight >= 0 && distRight <= TABLE_RESIZE_MARGIN;
            const nearBottom = distBottom >= 0 && distBottom <= TABLE_RESIZE_MARGIN;
            if (nearRight && nearBottom) {
                return distRight <= distBottom ? { type: 'col', index: cell.cellIndex } : { type: 'row', index: cell.parentElement.rowIndex };
            }
            if (nearRight) return { type: 'col', index: cell.cellIndex };
            if (nearBottom) return { type: 'row', index: cell.parentElement.rowIndex };
            return null;
        };

        const getTableHandleHit = (table, event) => {
            const rect = table.getBoundingClientRect();
            const distRight = rect.right - event.clientX;
            const distBottom = rect.bottom - event.clientY;
            const nearRight = distRight >= 0 && distRight <= TABLE_HANDLE_SIZE;
            const nearBottom = distBottom >= 0 && distBottom <= TABLE_HANDLE_SIZE;
            return nearRight && nearBottom;
        };

        const ensureColgroup = (table) => {
            const firstRow = table.querySelector('tr');
            const colCount = firstRow ? firstRow.children.length : 0;
            if (!colCount) return null;
            let colgroup = table.querySelector('colgroup');
            if (!colgroup) {
                colgroup = document.createElement('colgroup');
                table.insertBefore(colgroup, table.firstChild);
            }
            while (colgroup.children.length < colCount) colgroup.appendChild(document.createElement('col'));
            return colgroup;
        };

        const applyColumnWidth = (table, index, width) => {
            const colgroup = ensureColgroup(table);
            if (!colgroup || !colgroup.children[index]) return;
            colgroup.children[index].style.width = Math.max(TABLE_MIN_WIDTH, width) + 'px';
            table.style.tableLayout = 'fixed';
        };

        const applyRowHeight = (row, height) => {
            const newHeight = Math.max(TABLE_MIN_HEIGHT, height);
            row.style.height = newHeight + 'px';
            row.querySelectorAll('td').forEach(td => {
                td.style.height = newHeight + 'px';
            });
        };

        const showGuideV = (x, top, height) => {
            guideV.style.display = 'block';
            guideV.style.left = x + 'px';
            guideV.style.top = top + 'px';
            guideV.style.height = height + 'px';
        };

        const showGuideH = (y, left, width) => {
            guideH.style.display = 'block';
            guideH.style.left = left + 'px';
            guideH.style.top = y + 'px';
            guideH.style.width = width + 'px';
        };

        const hideGuides = () => {
            guideV.style.display = 'none';
            guideH.style.display = 'none';
        };

        const showHandle = (rect) => {
            tableHandle.style.display = 'block';
            tableHandle.style.left = rect.right - TABLE_HANDLE_SIZE + window.scrollX + 'px';
            tableHandle.style.top = rect.bottom - TABLE_HANDLE_SIZE + window.scrollY + 'px';
        };

        const hideHandle = () => {
            tableHandle.style.display = 'none';
        };

        document.addEventListener('mousemove', (e) => {
            if (!tableResizeState) {
                const cell = e.target.closest('table.editor-table td');
                const table = e.target.closest('table.editor-table');
                let cursor = '';
                let hit = null;
                hideGuides();
                if (table) showHandle(table.getBoundingClientRect());
                else hideHandle();
                if (table && getTableHandleHit(table, e)) {
                    cursor = 'nwse-resize';
                } else if (cell) {
                    hit = getTableResizeHit(cell, e);
                    if (hit) {
                        const tableRect = table.getBoundingClientRect();
                        if (hit.type === 'col') {
                            const rect = cell.getBoundingClientRect();
                            showGuideV(rect.right + window.scrollX, tableRect.top + window.scrollY, tableRect.height);
                            cursor = 'col-resize';
                        } else {
                            const rowRect = cell.parentElement.getBoundingClientRect();
                            showGuideH(rowRect.bottom + window.scrollY, tableRect.left + window.scrollX, tableRect.width);
                            cursor = 'row-resize';
                        }
                    }
                }
                document.body.style.cursor = cursor;
                return;
            }
            const zoom = State.docData.meta.zoom || 1;
            if (tableResizeState.type === 'col') {
                const delta = (e.clientX - tableResizeState.startX) / zoom;
                applyColumnWidth(tableResizeState.table, tableResizeState.index, tableResizeState.startWidth + delta);
            } else if (tableResizeState.type === 'row') {
                const delta = (e.clientY - tableResizeState.startY) / zoom;
                applyRowHeight(tableResizeState.row, tableResizeState.startHeight + delta);
            } else if (tableResizeState.type === 'table') {
                const deltaX = (e.clientX - tableResizeState.startX) / zoom;
                const deltaY = (e.clientY - tableResizeState.startY) / zoom;
                const width = Math.max(tableResizeState.minWidth, tableResizeState.startWidth + deltaX);
                const height = Math.max(tableResizeState.minHeight, tableResizeState.startHeight + deltaY);
                tableResizeState.table.style.width = width + 'px';
                tableResizeState.table.style.height = height + 'px';
                tableResizeState.table.style.tableLayout = 'fixed';
            }
            e.preventDefault();
        });

        document.addEventListener('mousedown', (e) => {
            const table = e.target.closest('table.editor-table');
            if (table && getTableHandleHit(table, e)) {
                const rect = table.getBoundingClientRect();
                const colCount = table.querySelectorAll('tr:first-child td').length || 1;
                const rowCount = table.querySelectorAll('tr').length || 1;
                tableResizeState = {
                    type: 'table',
                    table,
                    startX: e.clientX,
                    startY: e.clientY,
                    startWidth: rect.width,
                    startHeight: rect.height,
                    minWidth: colCount * TABLE_MIN_WIDTH,
                    minHeight: rowCount * TABLE_MIN_HEIGHT
                };
                e.preventDefault();
                e.stopPropagation();
                document.body.style.userSelect = 'none';
                hideGuides();
                return;
            }
            const cell = e.target.closest('table.editor-table td');
            if (!cell) return;
            const hit = getTableResizeHit(cell, e);
            if (!hit) return;
            const tableForCell = cell.closest('table.editor-table');
            if (!tableForCell) return;
            e.preventDefault();
            e.stopPropagation();
            document.body.style.userSelect = 'none';
            if (hit.type === 'col') {
                const rect = cell.getBoundingClientRect();
                tableResizeState = {
                    type: 'col',
                    table: tableForCell,
                    index: hit.index,
                    startX: e.clientX,
                    startWidth: rect.width
                };
            } else {
                const row = cell.parentElement;
                const rect = row.getBoundingClientRect();
                tableResizeState = {
                    type: 'row',
                    table: tableForCell,
                    row,
                    index: hit.index,
                    startY: e.clientY,
                    startHeight: rect.height
                };
            }
        });

        document.addEventListener('mouseup', () => {
            if (!tableResizeState) return;
            const table = tableResizeState.table;
            tableResizeState = null;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            hideGuides();
            const wrap = table.closest('.block-wrapper');
            if (wrap) {
                const box = wrap.querySelector('.editable-box');
                if (box) Actions.updateBlockContent(wrap.dataset.id, Utils.cleanRichContentToTex(box.innerHTML), true);
                Renderer.debouncedRebalance();
            }
        });

        // [Fix] 스크롤 시 팝업 닫기 추가
        window.addEventListener('scroll', () => {
            document.getElementById('context-menu').style.display = 'none';
            document.getElementById('floating-toolbar').style.display = 'none';
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                Utils.closeModal('context-menu'); document.getElementById('floating-toolbar').style.display='none'; this.hideResizer(); Utils.closeModal('import-modal'); Utils.closeModal('find-replace-modal'); return;
            }
            State.keysPressed[e.key.toLowerCase()] = true; 
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); Utils.openModal('find-replace-modal'); document.getElementById('fr-find-input').focus(); return; } 
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); FileSystem.saveProjectJSON(() => Renderer.syncAllBlocks()); return; } 
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if(State.redo()) { Renderer.renderPages(); ManualRenderer.renderAll(); } return; } 
            else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if(State.undo()) { Renderer.renderPages(); ManualRenderer.renderAll(); } return; } 
        });
        document.addEventListener('keyup', (e) => State.keysPressed[e.key.toLowerCase()] = false);

        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('#floating-toolbar') && !e.target.closest('.ft-btn')) document.getElementById('floating-toolbar').style.display='none'; 
            if (!e.target.closest('img') && !e.target.closest('#image-resizer')) this.hideResizer(); 
            const menu = document.getElementById('context-menu');
            if (menu && menu.style.display === 'block') { if (!e.target.closest('#context-menu') && !e.target.closest('.block-handle')) menu.style.display = 'none'; }
            if (!e.target.closest('.image-placeholder') && !e.target.closest('#imgUpload')) { if(State.selectedPlaceholder) { State.selectedPlaceholder.classList.remove('selected'); State.selectedPlaceholder.setAttribute('contenteditable', 'false'); } State.selectedPlaceholder = null; } 
        });
        document.addEventListener('mouseup', (e) => { setTimeout(() => {
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
                }
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
            if (e.target.closest('table.editor-table')) { e.stopPropagation(); return; }
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
