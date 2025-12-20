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
        let lastCursorTable = null;
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
        const tableMenu = document.getElementById('table-menu');
        const tableMenuHandle = document.getElementById('table-menu-handle');
        const tableBorderSelect = document.getElementById('table-border-style');
        let activeTable = null;
        let activeCell = null;
        let tableMenuOpen = false;
        const choiceMenu = document.getElementById('choice-menu');
        const choiceMenuHandle = document.getElementById('choice-menu-handle');
        let activeChoiceGroup = null;
        let choiceMenuOpen = false;
        let tableSelectAnchor = null;
        let tableSelectFocus = null;
        let tableSelectCells = [];
        let isTableSelecting = false;

        const clearTableSelection = () => {
            if (tableSelectCells.length) {
                tableSelectCells.forEach(cell => cell.classList.remove('table-cell-selected'));
            }
            tableSelectCells = [];
            tableSelectAnchor = null;
            tableSelectFocus = null;
        };

        const setTableSelectionCells = (cells) => {
            if (tableSelectCells.length) {
                tableSelectCells.forEach(cell => cell.classList.remove('table-cell-selected'));
            }
            tableSelectCells = cells.filter(cell => cell);
            tableSelectCells.forEach(cell => cell.classList.add('table-cell-selected'));
        };

        const getCellPosition = (cell) => {
            if (!cell) return null;
            const row = cell.parentElement;
            return {
                row: row ? row.rowIndex : 0,
                col: cell.cellIndex
            };
        };

        const buildSelectionCells = (anchor, focus) => {
            const table = anchor.closest('table.editor-table');
            if (!table || focus.closest('table.editor-table') !== table) return [];
            const anchorPos = getCellPosition(anchor);
            const focusPos = getCellPosition(focus);
            if (!anchorPos || !focusPos) return [];
            const minRow = Math.min(anchorPos.row, focusPos.row);
            const maxRow = Math.max(anchorPos.row, focusPos.row);
            const minCol = Math.min(anchorPos.col, focusPos.col);
            const maxCol = Math.max(anchorPos.col, focusPos.col);
            const cells = [];
            for (let r = minRow; r <= maxRow; r++) {
                const row = table.rows[r];
                if (!row) continue;
                for (let c = minCol; c <= maxCol; c++) {
                    const cell = row.cells[c];
                    if (cell) cells.push(cell);
                }
            }
            return cells;
        };

        const updateTableSelection = (anchor, focus) => {
            if (!anchor || !focus) return;
            const table = anchor.closest('table.editor-table');
            if (!table || focus.closest('table.editor-table') !== table) return;
            tableSelectAnchor = anchor;
            tableSelectFocus = focus;
            activeCell = focus;
            activeTable = table;
            setTableSelectionCells(buildSelectionCells(anchor, focus));
        };

        const getSelectionRect = () => {
            if (!tableSelectAnchor || !tableSelectFocus) return null;
            const anchorPos = getCellPosition(tableSelectAnchor);
            const focusPos = getCellPosition(tableSelectFocus);
            if (!anchorPos || !focusPos) return null;
            return {
                minRow: Math.min(anchorPos.row, focusPos.row),
                maxRow: Math.max(anchorPos.row, focusPos.row),
                minCol: Math.min(anchorPos.col, focusPos.col),
                maxCol: Math.max(anchorPos.col, focusPos.col)
            };
        };

        const getSelectionCellsForTable = (table) => {
            if (!table || tableSelectCells.length === 0) return [];
            const sameTable = tableSelectAnchor && tableSelectAnchor.closest('table.editor-table') === table;
            if (!sameTable) return [];
            return tableSelectCells.filter(cell => cell && cell.isConnected);
        };

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

        const showMenuHandle = (rect) => {
            if (!tableMenuHandle) return;
            const size = 20;
            const margin = 6;
            let left = rect.left + window.scrollX - margin;
            let top = rect.top + window.scrollY - (size + margin);
            const minLeft = window.scrollX + 4;
            const minTop = window.scrollY + 4;
            if (left < minLeft) left = minLeft;
            if (top < minTop) top = rect.top + window.scrollY + margin;
            tableMenuHandle.style.display = 'flex';
            tableMenuHandle.style.left = left + 'px';
            tableMenuHandle.style.top = top + 'px';
        };

        const hideMenuHandle = () => {
            if (!tableMenuHandle || tableMenuOpen) return;
            tableMenuHandle.style.display = 'none';
        };

        const positionTableMenu = (table) => {
            if (!tableMenu || !table) return;
            tableMenu.style.display = 'block';
            tableMenu.style.visibility = 'hidden';
            const menuRect = tableMenu.getBoundingClientRect();
            const rect = table.getBoundingClientRect();
            const margin = 6;
            let left = rect.left + window.scrollX;
            let top = rect.top + window.scrollY - menuRect.height - margin;
            const maxLeft = window.scrollX + window.innerWidth - menuRect.width - margin;
            if (left > maxLeft) left = maxLeft;
            if (left < window.scrollX + margin) left = window.scrollX + margin;
            if (top < window.scrollY + margin) top = rect.bottom + window.scrollY + margin;
            tableMenu.style.left = left + 'px';
            tableMenu.style.top = top + 'px';
            tableMenu.style.visibility = 'visible';
        };

        const openTableMenu = (table) => {
            if (!tableMenu || !table) return;
            activeTable = table;
            tableMenuOpen = true;
            positionTableMenu(table);
            showMenuHandle(table.getBoundingClientRect());
        };

        const closeTableMenu = () => {
            if (!tableMenu) return;
            tableMenu.style.display = 'none';
            tableMenu.style.visibility = 'visible';
            tableMenuOpen = false;
            hideMenuHandle();
        };

        const updateTableDataSize = (table) => {
            if (!table) return;
            const rowCount = table.querySelectorAll('tr').length;
            const colCount = table.querySelectorAll('tr:first-child td').length;
            table.dataset.rows = rowCount;
            table.dataset.cols = colCount;
        };

        const resolveBorderStyle = (value) => {
            if (value === 'dashed') return { style: 'dashed', color: '#333' };
            if (value === 'transparent') return { style: 'solid', color: 'transparent' };
            return { style: 'solid', color: '#333' };
        };

        const getNeighborCell = (cell, side) => {
            const table = cell.closest('table.editor-table');
            if (!table) return null;
            const rowIndex = cell.parentElement.rowIndex;
            const colIndex = cell.cellIndex;
            const rowOffset = side === 'top' ? -1 : side === 'bottom' ? 1 : 0;
            const colOffset = side === 'left' ? -1 : side === 'right' ? 1 : 0;
            const row = table.rows[rowIndex + rowOffset];
            if (!row) return null;
            return row.cells[colIndex + colOffset] || null;
        };

        const setBorderSide = (cell, side, mode, syncNeighbor = false) => {
            if (!cell) return;
            const { style, color } = resolveBorderStyle(mode);
            const cap = side.charAt(0).toUpperCase() + side.slice(1);
            cell.style[`border${cap}Style`] = style;
            cell.style[`border${cap}Color`] = color;
            if (syncNeighbor) {
                const neighbor = getNeighborCell(cell, side);
                if (neighbor) {
                    const oppositeMap = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
                    const opp = oppositeMap[side];
                    const oppCap = opp.charAt(0).toUpperCase() + opp.slice(1);
                    neighbor.style[`border${oppCap}Style`] = style;
                    neighbor.style[`border${oppCap}Color`] = color;
                }
            }
        };

        const applyBorderAll = (table, mode) => {
            const rows = Array.from(table.rows);
            rows.forEach(row => {
                Array.from(row.cells).forEach(cell => {
                    ['top', 'right', 'bottom', 'left'].forEach(side => setBorderSide(cell, side, mode, false));
                });
            });
        };

        const applyBorderOuter = (table, mode) => {
            const rows = Array.from(table.rows);
            const lastRow = rows.length - 1;
            rows.forEach((row, r) => {
                const cells = Array.from(row.cells);
                const lastCol = cells.length - 1;
                cells.forEach((cell, c) => {
                    if (r === 0) setBorderSide(cell, 'top', mode, true);
                    if (r === lastRow) setBorderSide(cell, 'bottom', mode, true);
                    if (c === 0) setBorderSide(cell, 'left', mode, true);
                    if (c === lastCol) setBorderSide(cell, 'right', mode, true);
                });
            });
        };

        const applyBorderInner = (table, mode) => {
            const rows = Array.from(table.rows);
            rows.forEach((row, r) => {
                const cells = Array.from(row.cells);
                cells.forEach((cell, c) => {
                    if (r > 0) setBorderSide(cell, 'top', mode, true);
                    if (c > 0) setBorderSide(cell, 'left', mode, true);
                });
            });
        };

        const applyBorderOuterRect = (table, rect, mode) => {
            if (!rect) return;
            for (let r = rect.minRow; r <= rect.maxRow; r++) {
                const row = table.rows[r];
                if (!row) continue;
                for (let c = rect.minCol; c <= rect.maxCol; c++) {
                    const cell = row.cells[c];
                    if (!cell) continue;
                    if (r === rect.minRow) setBorderSide(cell, 'top', mode, true);
                    if (r === rect.maxRow) setBorderSide(cell, 'bottom', mode, true);
                    if (c === rect.minCol) setBorderSide(cell, 'left', mode, true);
                    if (c === rect.maxCol) setBorderSide(cell, 'right', mode, true);
                }
            }
        };

        const applyBorderInnerRect = (table, rect, mode) => {
            if (!rect) return;
            for (let r = rect.minRow; r <= rect.maxRow; r++) {
                const row = table.rows[r];
                if (!row) continue;
                for (let c = rect.minCol; c <= rect.maxCol; c++) {
                    const cell = row.cells[c];
                    if (!cell) continue;
                    if (r > rect.minRow) setBorderSide(cell, 'top', mode, true);
                    if (c > rect.minCol) setBorderSide(cell, 'left', mode, true);
                }
            }
        };

        const createTableCell = () => {
            const td = document.createElement('td');
            td.setAttribute('contenteditable', 'true');
            return td;
        };

        const addRowToTable = (table, position) => {
            const rows = Array.from(table.rows);
            if (!rows.length) return;
            const colCount = rows[0].cells.length;
            if (!colCount) return;
            const newRow = document.createElement('tr');
            for (let c = 0; c < colCount; c++) newRow.appendChild(createTableCell());
            let insertIndex = rows.length;
            if (activeCell && table.contains(activeCell)) {
                const baseIndex = activeCell.parentElement.rowIndex;
                insertIndex = position === 'above' ? baseIndex : baseIndex + 1;
            } else if (position === 'above') {
                insertIndex = 0;
            }
            const tbody = table.tBodies[0] || table;
            const refRow = rows[insertIndex];
            if (refRow && refRow.parentNode === tbody) tbody.insertBefore(newRow, refRow);
            else tbody.appendChild(newRow);
            updateTableDataSize(table);
        };

        const addColumnToTable = (table, position) => {
            const rows = Array.from(table.rows);
            if (!rows.length) return;
            const colCount = rows[0].cells.length;
            let insertIndex = colCount;
            if (activeCell && table.contains(activeCell)) {
                const baseIndex = activeCell.cellIndex;
                insertIndex = position === 'left' ? baseIndex : baseIndex + 1;
            } else if (position === 'left') {
                insertIndex = 0;
            }
            rows.forEach(row => {
                const td = createTableCell();
                const refCell = row.cells[insertIndex];
                if (refCell) row.insertBefore(td, refCell);
                else row.appendChild(td);
            });
            const colgroup = ensureColgroup(table);
            if (colgroup) {
                const col = document.createElement('col');
                const refCol = colgroup.children[insertIndex];
                if (refCol) colgroup.insertBefore(col, refCol);
                else colgroup.appendChild(col);
            }
            updateTableDataSize(table);
        };

        const syncTableToState = (table) => {
            if (!table) return;
            const wrap = table.closest('.block-wrapper');
            if (!wrap) return;
            const box = wrap.querySelector('.editable-box');
            if (!box) return;
            Actions.updateBlockContent(wrap.dataset.id, Utils.cleanRichContentToTex(box.innerHTML), true);
            Renderer.debouncedRebalance();
        };

        const showChoiceHandle = (rect) => {
            if (!choiceMenuHandle) return;
            const width = 32;
            const height = 20;
            const margin = 6;
            let left = rect.right + window.scrollX - width;
            let top = rect.top + window.scrollY - height - margin;
            const minLeft = window.scrollX + 4;
            const minTop = window.scrollY + 4;
            if (left < minLeft) left = minLeft;
            if (top < minTop) top = rect.bottom + window.scrollY + margin;
            choiceMenuHandle.style.display = 'flex';
            choiceMenuHandle.style.left = left + 'px';
            choiceMenuHandle.style.top = top + 'px';
        };

        const hideChoiceHandle = () => {
            if (!choiceMenuHandle || choiceMenuOpen) return;
            choiceMenuHandle.style.display = 'none';
        };

        const positionChoiceMenu = (group) => {
            if (!choiceMenu || !group) return;
            choiceMenu.style.display = 'block';
            choiceMenu.style.visibility = 'hidden';
            const menuRect = choiceMenu.getBoundingClientRect();
            const rect = group.getBoundingClientRect();
            const margin = 6;
            let left = rect.left + window.scrollX;
            let top = rect.top + window.scrollY - menuRect.height - margin;
            const maxLeft = window.scrollX + window.innerWidth - menuRect.width - margin;
            if (left > maxLeft) left = maxLeft;
            if (left < window.scrollX + margin) left = window.scrollX + margin;
            if (top < window.scrollY + margin) top = rect.bottom + window.scrollY + margin;
            choiceMenu.style.left = left + 'px';
            choiceMenu.style.top = top + 'px';
            choiceMenu.style.visibility = 'visible';
        };

        const openChoiceMenu = (group) => {
            if (!choiceMenu || !group) return;
            activeChoiceGroup = group;
            choiceMenuOpen = true;
            positionChoiceMenu(group);
            showChoiceHandle(group.getBoundingClientRect());
        };

        const closeChoiceMenu = () => {
            if (!choiceMenu) return;
            choiceMenu.style.display = 'none';
            choiceMenu.style.visibility = 'visible';
            choiceMenuOpen = false;
            hideChoiceHandle();
        };

        const createChoiceItem = (index) => {
            const item = document.createElement('span');
            item.className = 'choice-item';
            const label = document.createElement('span');
            label.className = 'choice-label';
            label.textContent = Utils.choiceLabels[index] || `${index + 1}.`;
            label.setAttribute('contenteditable', 'false');
            const text = document.createElement('span');
            text.className = 'choice-text';
            text.setAttribute('contenteditable', 'true');
            item.appendChild(label);
            item.appendChild(text);
            return item;
        };

        const normalizeChoiceItems = (group) => {
            let items = Array.from(group.querySelectorAll('.choice-item'));
            if (items.length < 5) {
                for (let i = items.length; i < 5; i++) items.push(createChoiceItem(i));
            }
            items = items.slice(0, 5);
            items.forEach((item, idx) => {
                let label = item.querySelector('.choice-label');
                if (!label) {
                    label = document.createElement('span');
                    label.className = 'choice-label';
                    label.setAttribute('contenteditable', 'false');
                    item.prepend(label);
                }
                label.textContent = Utils.choiceLabels[idx] || `${idx + 1}.`;
                let text = item.querySelector('.choice-text');
                if (!text) {
                    text = document.createElement('span');
                    text.className = 'choice-text';
                    text.setAttribute('contenteditable', 'true');
                    const nodes = Array.from(item.childNodes).filter(node => node !== label);
                    nodes.forEach(node => text.appendChild(node));
                    item.appendChild(text);
                }
            });
            return items;
        };

        const applyChoiceLayout = (group, layoutToken) => {
            if (!group) return;
            const layout = Utils.normalizeChoiceLayout(layoutToken);
            const items = normalizeChoiceItems(group);
            group.dataset.layout = layout;
            group.replaceChildren();
            const appendRow = (rowItems) => {
                const row = document.createElement('div');
                row.className = 'choice-row';
                row.dataset.count = String(rowItems.length);
                rowItems.forEach(item => row.appendChild(item));
                group.appendChild(row);
            };
            if (layout === '2') {
                appendRow(items.slice(0, 3));
                appendRow(items.slice(3));
            } else if (layout === '5') {
                items.forEach(item => appendRow([item]));
            } else {
                appendRow(items);
            }
        };

        const syncChoiceToState = (group) => {
            if (!group) return;
            const wrap = group.closest('.block-wrapper');
            if (!wrap) return;
            const box = wrap.querySelector('.editable-box');
            if (!box) return;
            Actions.updateBlockContent(wrap.dataset.id, Utils.cleanRichContentToTex(box.innerHTML), true);
            Renderer.debouncedRebalance();
        };

        document.addEventListener('mousemove', (e) => {
            if (tableResizeState) {
                hideChoiceHandle();
                const zoom = State.docData.meta.zoom || 1;
                if (tableResizeState.type === 'col') {
                    const delta = (e.clientX - tableResizeState.startX) / zoom;
                    applyColumnWidth(tableResizeState.table, tableResizeState.index, tableResizeState.startWidth + delta);
                    document.body.style.cursor = 'col-resize';
                } else if (tableResizeState.type === 'row') {
                    const delta = (e.clientY - tableResizeState.startY) / zoom;
                    applyRowHeight(tableResizeState.row, tableResizeState.startHeight + delta);
                    document.body.style.cursor = 'row-resize';
                } else if (tableResizeState.type === 'table') {
                    const deltaX = (e.clientX - tableResizeState.startX) / zoom;
                    const deltaY = (e.clientY - tableResizeState.startY) / zoom;
                    const width = Math.max(tableResizeState.minWidth, tableResizeState.startWidth + deltaX);
                    const height = Math.max(tableResizeState.minHeight, tableResizeState.startHeight + deltaY);
                    tableResizeState.table.style.width = width + 'px';
                    tableResizeState.table.style.height = height + 'px';
                    tableResizeState.table.style.tableLayout = 'fixed';
                    document.body.style.cursor = 'nwse-resize';
                }
                e.preventDefault();
                return;
            }
            if (isTableSelecting) {
                hideChoiceHandle();
                const cell = e.target.closest('table.editor-table td');
                if (cell && cell.closest('table.editor-table') === activeTable) {
                    updateTableSelection(tableSelectAnchor, cell);
                }
                document.body.style.cursor = 'cell';
                e.preventDefault();
                return;
            }
            {
                const cell = e.target.closest('table.editor-table td');
                const table = e.target.closest('table.editor-table');
                let cursor = '';
                let hit = null;
                hideGuides();
                const isTableUiHover = e.target.closest('#table-menu') || e.target.closest('#table-menu-handle');
                if (table) {
                    activeTable = table;
                    showHandle(table.getBoundingClientRect());
                    showMenuHandle(table.getBoundingClientRect());
                } else if (isTableUiHover && activeTable) {
                    showMenuHandle(activeTable.getBoundingClientRect());
                    hideHandle();
                } else {
                    hideHandle();
                    if (tableMenuOpen && activeTable) showMenuHandle(activeTable.getBoundingClientRect());
                    else hideMenuHandle();
                }
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
                if (lastCursorTable && lastCursorTable !== table) lastCursorTable.style.cursor = '';
                if (table) table.style.cursor = cursor || '';
                lastCursorTable = table || null;
                document.body.style.cursor = cursor;
                const choiceGroup = e.target.closest('.choice-group');
                const isChoiceUiHover = e.target.closest('#choice-menu') || e.target.closest('#choice-menu-handle');
                if (choiceGroup) {
                    activeChoiceGroup = choiceGroup;
                    showChoiceHandle(choiceGroup.getBoundingClientRect());
                } else if (isChoiceUiHover && activeChoiceGroup) {
                    showChoiceHandle(activeChoiceGroup.getBoundingClientRect());
                } else {
                    if (choiceMenuOpen && activeChoiceGroup) showChoiceHandle(activeChoiceGroup.getBoundingClientRect());
                    else hideChoiceHandle();
                }
            }
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
            if (!hit && e.shiftKey) {
                const tableForCell = cell.closest('table.editor-table');
                if (!tableSelectAnchor || !tableSelectAnchor.isConnected || tableSelectAnchor.closest('table.editor-table') !== tableForCell) {
                    tableSelectAnchor = cell;
                }
                isTableSelecting = true;
                updateTableSelection(tableSelectAnchor, cell);
                e.preventDefault();
                e.stopPropagation();
                document.body.style.userSelect = 'none';
                return;
            }
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
            if (tableResizeState) {
                const table = tableResizeState.table;
                tableResizeState = null;
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                if (table) table.style.cursor = '';
                hideGuides();
                const wrap = table.closest('.block-wrapper');
                if (wrap) {
                    const box = wrap.querySelector('.editable-box');
                    if (box) Actions.updateBlockContent(wrap.dataset.id, Utils.cleanRichContentToTex(box.innerHTML), true);
                    Renderer.debouncedRebalance();
                }
                return;
            }
            if (isTableSelecting) {
                isTableSelecting = false;
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
            }
        });

        if (tableMenuHandle) {
            tableMenuHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!activeTable) return;
                if (tableMenuOpen) closeTableMenu();
                else openTableMenu(activeTable);
            });
        }
        if (tableMenu) {
            tableMenu.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            tableMenu.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                if (!activeTable) { Utils.showToast("표를 먼저 선택하세요.", "error"); return; }
                const mode = tableBorderSelect ? tableBorderSelect.value : 'solid';
                const selectionCells = getSelectionCellsForTable(activeTable);
                const selectionRect = selectionCells.length ? getSelectionRect() : null;
                const action = btn.dataset.action;
                if (action === 'add-row-above') { addRowToTable(activeTable, 'above'); syncTableToState(activeTable); }
                else if (action === 'add-row-below') { addRowToTable(activeTable, 'below'); syncTableToState(activeTable); }
                else if (action === 'add-col-left') { addColumnToTable(activeTable, 'left'); syncTableToState(activeTable); }
                else if (action === 'add-col-right') { addColumnToTable(activeTable, 'right'); syncTableToState(activeTable); }
                else if (action === 'border-all') {
                    if (selectionRect) {
                        applyBorderOuterRect(activeTable, selectionRect, mode);
                        applyBorderInnerRect(activeTable, selectionRect, mode);
                    } else if (selectionCells.length) {
                        selectionCells.forEach(cell => ['top', 'right', 'bottom', 'left'].forEach(side => setBorderSide(cell, side, mode, true)));
                    } else {
                        applyBorderAll(activeTable, mode);
                    }
                    syncTableToState(activeTable);
                } else if (action === 'border-outer') {
                    if (selectionRect) applyBorderOuterRect(activeTable, selectionRect, mode);
                    else applyBorderOuter(activeTable, mode);
                    syncTableToState(activeTable);
                } else if (action === 'border-inner') {
                    if (selectionRect) applyBorderInnerRect(activeTable, selectionRect, mode);
                    else applyBorderInner(activeTable, mode);
                    syncTableToState(activeTable);
                }
                else if (action === 'border-top') {
                    if (selectionCells.length) {
                        selectionCells.forEach(cell => setBorderSide(cell, 'top', mode, true));
                    } else {
                        if (!activeCell) { Utils.showToast("셀을 먼저 클릭하세요.", "info"); return; }
                        setBorderSide(activeCell, 'top', mode, true);
                    }
                    syncTableToState(activeTable);
                } else if (action === 'border-right') {
                    if (selectionCells.length) {
                        selectionCells.forEach(cell => setBorderSide(cell, 'right', mode, true));
                    } else {
                        if (!activeCell) { Utils.showToast("셀을 먼저 클릭하세요.", "info"); return; }
                        setBorderSide(activeCell, 'right', mode, true);
                    }
                    syncTableToState(activeTable);
                } else if (action === 'border-bottom') {
                    if (selectionCells.length) {
                        selectionCells.forEach(cell => setBorderSide(cell, 'bottom', mode, true));
                    } else {
                        if (!activeCell) { Utils.showToast("셀을 먼저 클릭하세요.", "info"); return; }
                        setBorderSide(activeCell, 'bottom', mode, true);
                    }
                    syncTableToState(activeTable);
                } else if (action === 'border-left') {
                    if (selectionCells.length) {
                        selectionCells.forEach(cell => setBorderSide(cell, 'left', mode, true));
                    } else {
                        if (!activeCell) { Utils.showToast("셀을 먼저 클릭하세요.", "info"); return; }
                        setBorderSide(activeCell, 'left', mode, true);
                    }
                    syncTableToState(activeTable);
                }
                if (tableMenuOpen) positionTableMenu(activeTable);
            });
        }
        if (choiceMenuHandle) {
            choiceMenuHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!activeChoiceGroup) return;
                if (choiceMenuOpen) closeChoiceMenu();
                else openChoiceMenu(activeChoiceGroup);
            });
        }
        if (choiceMenu) {
            choiceMenu.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            choiceMenu.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-layout]');
                if (!btn) return;
                if (!activeChoiceGroup) { Utils.showToast("선지를 먼저 선택하세요.", "error"); return; }
                applyChoiceLayout(activeChoiceGroup, btn.dataset.layout);
                syncChoiceToState(activeChoiceGroup);
                if (choiceMenuOpen) positionChoiceMenu(activeChoiceGroup);
            });
        }

        // [Fix] 스크롤 시 팝업 닫기 추가
        window.addEventListener('scroll', () => {
            document.getElementById('context-menu').style.display = 'none';
            document.getElementById('floating-toolbar').style.display = 'none';
            closeTableMenu();
            closeChoiceMenu();
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                clearTableSelection();
                closeTableMenu();
                closeChoiceMenu();
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
            if (tableMenuOpen) {
                if (!e.target.closest('#table-menu') && !e.target.closest('#table-menu-handle')) closeTableMenu();
            }
            if (choiceMenuOpen) {
                if (!e.target.closest('#choice-menu') && !e.target.closest('#choice-menu-handle')) closeChoiceMenu();
            }
            if (!e.target.closest('.image-placeholder') && !e.target.closest('#imgUpload')) { if(State.selectedPlaceholder) { State.selectedPlaceholder.classList.remove('selected'); State.selectedPlaceholder.setAttribute('contenteditable', 'false'); } State.selectedPlaceholder = null; } 
            const cell = e.target.closest('table.editor-table td');
            if (cell) {
                activeCell = cell;
                activeTable = cell.closest('table.editor-table');
                if (!e.shiftKey) {
                    clearTableSelection();
                    tableSelectAnchor = cell;
                }
            } else if (!e.target.closest('#table-menu') && !e.target.closest('#table-menu-handle')) {
                clearTableSelection();
                activeCell = null;
            }
            const choiceGroup = e.target.closest('.choice-group');
            if (choiceGroup) {
                activeChoiceGroup = choiceGroup;
            } else if (!e.target.closest('#choice-menu') && !e.target.closest('#choice-menu-handle')) {
                activeChoiceGroup = null;
            }
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
