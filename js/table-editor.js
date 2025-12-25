// Filename: js/table-editor.js
import { State } from './state.js';
import { Actions } from './actions.js';
import { Renderer } from './renderer.js';
import { Utils } from './utils.js';
import {
    TABLE_MIN_WIDTH,
    TABLE_MIN_HEIGHT,
    ensureColgroup,
    syncTableWidthFromCols,
    syncTableHeightFromRows,
    setColumnWidthRaw,
    freezeTableColWidths,
    freezeTableRowHeights,
    applyRowHeight,
    getColWidth,
    getRowHeight,
    applyUniformColumnWidths,
    applyUniformRowHeights,
    getRowIndicesForRect,
    getColIndicesForRect,
    getTableResizeHit
} from './table-utils.js';
import { serializeEditorTable, serializeChoiceTable } from './table-serialize.js';

export const createTableEditor = () => {
    const TABLE_RESIZE_MARGIN = 4;
    const TABLE_HANDLE_SIZE = 12;
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
    let activeChoiceTable = null;
    let choiceMenuOpen = false;
    let tableHandleHideTimer = null;
    let choiceHandleHideTimer = null;
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

    const getTableHandleHit = (table, event) => {
        const rect = table.getBoundingClientRect();
        const distRight = rect.right - event.clientX;
        const distBottom = rect.bottom - event.clientY;
        const nearRight = distRight >= 0 && distRight <= TABLE_HANDLE_SIZE;
        const nearBottom = distBottom >= 0 && distBottom <= TABLE_HANDLE_SIZE;
        return nearRight && nearBottom;
    };

    const isPointerNearRect = (rect, event, padding = 32) => {
        if (!rect) return false;
        const x = event.clientX;
        const y = event.clientY;
        return (
            x >= rect.left - padding &&
            x <= rect.right + padding &&
            y >= rect.top - padding &&
            y <= rect.bottom + padding
        );
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

    const cancelHideTableHandles = () => {
        if (tableHandleHideTimer) {
            clearTimeout(tableHandleHideTimer);
            tableHandleHideTimer = null;
        }
    };

    const scheduleHideTableHandles = () => {
        if (tableMenuOpen) return;
        cancelHideTableHandles();
        tableHandleHideTimer = setTimeout(() => {
            hideHandle();
            hideMenuHandle();
        }, 200);
    };

    const cancelHideChoiceHandle = () => {
        if (choiceHandleHideTimer) {
            clearTimeout(choiceHandleHideTimer);
            choiceHandleHideTimer = null;
        }
    };

    const scheduleHideChoiceHandle = () => {
        if (choiceMenuOpen) return;
        cancelHideChoiceHandle();
        choiceHandleHideTimer = setTimeout(() => {
            hideChoiceHandle();
        }, 200);
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
        cancelHideTableHandles();
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
        if (top < minTop) top = rect.top + window.scrollY + margin;
        choiceMenuHandle.style.display = 'flex';
        choiceMenuHandle.style.left = left + 'px';
        choiceMenuHandle.style.top = top + 'px';
    };

    const hideChoiceHandle = () => {
        if (!choiceMenuHandle || choiceMenuOpen) return;
        choiceMenuHandle.style.display = 'none';
    };

    const positionChoiceMenu = (table) => {
        if (!choiceMenu || !table) return;
        choiceMenu.style.display = 'block';
        choiceMenu.style.visibility = 'hidden';
        const menuRect = choiceMenu.getBoundingClientRect();
        const rect = table.getBoundingClientRect();
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

    const openChoiceMenu = (table) => {
        if (!choiceMenu || !table) return;
        activeChoiceTable = table;
        choiceMenuOpen = true;
        cancelHideChoiceHandle();
        positionChoiceMenu(table);
        showChoiceHandle(table.getBoundingClientRect());
    };

    const closeChoiceMenu = () => {
        if (!choiceMenu) return;
        choiceMenu.style.display = 'none';
        choiceMenu.style.visibility = 'visible';
        choiceMenuOpen = false;
        hideChoiceHandle();
    };

    const buildChoiceTable = (layoutToken, choiceData = null) => {
        const layout = Utils.normalizeChoiceLayout(layoutToken);
        const grid = Utils.getChoiceLayoutGrid(layout);
        const colCount = Utils.getChoiceColumnCount(layout);
        const table = document.createElement('table');
        table.className = 'choice-table';
        table.dataset.layout = layout;
        const colgroup = document.createElement('colgroup');
        for (let c = 0; c < colCount; c++) colgroup.appendChild(document.createElement('col'));
        table.appendChild(colgroup);
        const tbody = document.createElement('tbody');
        grid.forEach(rowDef => {
            const tr = document.createElement('tr');
            rowDef.forEach(cellIndex => {
                const td = document.createElement('td');
                td.setAttribute('contenteditable', 'false');
                if (cellIndex > 0) {
                    td.className = 'choice-cell';
                    td.dataset.choiceIndex = String(cellIndex);
                    const label = document.createElement('span');
                    label.className = 'choice-label';
                    label.textContent = Utils.choiceLabels[cellIndex - 1] || `${cellIndex}.`;
                    label.setAttribute('contenteditable', 'false');
                    const text = document.createElement('span');
                    text.className = 'choice-text';
                    text.setAttribute('contenteditable', 'true');
                    const value = choiceData ? (choiceData.get(String(cellIndex)) || '') : '';
                    text.innerHTML = value;
                    td.appendChild(label);
                    td.appendChild(text);
                } else {
                    td.className = 'choice-empty';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    };

    const extractChoiceData = (table) => {
        const data = new Map();
        if (!table) return data;
        table.querySelectorAll('td[data-choice-index]').forEach(cell => {
            const idx = cell.dataset.choiceIndex;
            const text = cell.querySelector('.choice-text');
            data.set(idx, text ? text.innerHTML : '');
        });
        return data;
    };

    const applyChoiceLayout = (table, layoutToken) => {
        if (!table) return null;
        const data = extractChoiceData(table);
        const nextTable = buildChoiceTable(layoutToken, data);
        table.replaceWith(nextTable);
        activeChoiceTable = nextTable;
        return nextTable;
    };

    const syncChoiceToState = (table) => {
        if (!table) return;
        const wrap = table.closest('.block-wrapper');
        if (!wrap) return;
        const box = wrap.querySelector('.editable-box');
        if (!box) return;
        Actions.updateBlockContent(wrap.dataset.id, Utils.cleanRichContentToTex(box.innerHTML), true);
        Renderer.debouncedRebalance();
    };

    const handleMouseMove = (e) => {
        if (tableResizeState) {
            hideChoiceHandle();
            const zoom = State.settings.zoom || 1;
            if (tableResizeState.type === 'col') {
                const delta = (e.clientX - tableResizeState.startX) / zoom;
                if (Number.isFinite(tableResizeState.startNeighborWidth) && tableResizeState.neighborIndex !== null) {
                    const total = tableResizeState.totalWidth;
                    const minWidth = TABLE_MIN_WIDTH;
                    const maxWidth = total - minWidth;
                    const nextWidth = Math.min(Math.max(tableResizeState.startWidth + delta, minWidth), maxWidth);
                    const neighborWidth = total - nextWidth;
                    setColumnWidthRaw(tableResizeState.table, tableResizeState.index, nextWidth);
                    setColumnWidthRaw(tableResizeState.table, tableResizeState.neighborIndex, neighborWidth);
                    if (Number.isFinite(tableResizeState.tableWidth)) {
                        tableResizeState.table.style.width = tableResizeState.tableWidth + 'px';
                        tableResizeState.table.style.tableLayout = 'fixed';
                    } else {
                        syncTableWidthFromCols(tableResizeState.table);
                    }
                } else {
                    setColumnWidthRaw(tableResizeState.table, tableResizeState.index, tableResizeState.startWidth + delta);
                    if (Number.isFinite(tableResizeState.tableWidth)) {
                        tableResizeState.table.style.width = tableResizeState.tableWidth + 'px';
                        tableResizeState.table.style.tableLayout = 'fixed';
                    } else {
                        syncTableWidthFromCols(tableResizeState.table);
                    }
                }
                document.body.style.cursor = 'col-resize';
            } else if (tableResizeState.type === 'row') {
                const delta = (e.clientY - tableResizeState.startY) / zoom;
                if (tableResizeState.neighborRow && Number.isFinite(tableResizeState.startNeighborHeight)) {
                    const total = tableResizeState.totalHeight;
                    const minHeight = TABLE_MIN_HEIGHT;
                    const maxHeight = total - minHeight;
                    const nextHeight = Math.min(Math.max(tableResizeState.startHeight + delta, minHeight), maxHeight);
                    const neighborHeight = total - nextHeight;
                    applyRowHeight(tableResizeState.row, nextHeight);
                    applyRowHeight(tableResizeState.neighborRow, neighborHeight);
                } else {
                    applyRowHeight(tableResizeState.row, tableResizeState.startHeight + delta);
                }
                if (Number.isFinite(tableResizeState.tableHeight)) {
                    tableResizeState.table.style.height = tableResizeState.tableHeight + 'px';
                } else {
                    syncTableHeightFromRows(tableResizeState.table);
                }
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
        const cell = e.target.closest('table.editor-table td');
        const table = e.target.closest('table.editor-table');
        let cursor = '';
        let hit = null;
        hideGuides();
        const isResizeHandleHover = e.target.closest('#table-resize-handle');
        const isTableUiHover = isResizeHandleHover || e.target.closest('#table-menu') || e.target.closest('#table-menu-handle');
        const isNearActiveTable = activeTable ? isPointerNearRect(activeTable.getBoundingClientRect(), e, 32) : false;
        if (table) {
            cancelHideTableHandles();
            activeTable = table;
            showHandle(table.getBoundingClientRect());
            showMenuHandle(table.getBoundingClientRect());
        } else if ((isTableUiHover || isNearActiveTable) && activeTable) {
            cancelHideTableHandles();
            const rect = activeTable.getBoundingClientRect();
            showMenuHandle(rect);
            if (isResizeHandleHover || isNearActiveTable) showHandle(rect);
            else hideHandle();
        } else {
            if (tableMenuOpen && activeTable) {
                showMenuHandle(activeTable.getBoundingClientRect());
            } else {
                scheduleHideTableHandles();
            }
        }
        if (table && getTableHandleHit(table, e)) {
            cursor = 'nwse-resize';
        } else if (cell) {
            hit = getTableResizeHit(cell, e, TABLE_RESIZE_MARGIN);
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
        const choiceTable = e.target.closest('table.choice-table');
        const isChoiceUiHover = e.target.closest('#choice-menu') || e.target.closest('#choice-menu-handle');
        const isNearActiveChoice = activeChoiceTable ? isPointerNearRect(activeChoiceTable.getBoundingClientRect(), e, 32) : false;
        if (choiceTable) {
            cancelHideChoiceHandle();
            activeChoiceTable = choiceTable;
            showChoiceHandle(choiceTable.getBoundingClientRect());
        } else if ((isChoiceUiHover || isNearActiveChoice) && activeChoiceTable) {
            cancelHideChoiceHandle();
            showChoiceHandle(activeChoiceTable.getBoundingClientRect());
        } else {
            if (choiceMenuOpen && activeChoiceTable) showChoiceHandle(activeChoiceTable.getBoundingClientRect());
            else scheduleHideChoiceHandle();
        }
    };

    const handleMouseDown = (e) => {
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
        const hit = getTableResizeHit(cell, e, TABLE_RESIZE_MARGIN);
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
            freezeTableColWidths(tableForCell, { preserveWidth: true });
            const startWidth = getColWidth(tableForCell, hit.index);
            const neighborIndex = hit.index + 1;
            const hasNeighbor = !!(ensureColgroup(tableForCell)?.children[neighborIndex]);
            const startNeighborWidth = hasNeighbor ? getColWidth(tableForCell, neighborIndex) : null;
            const tableRect = tableForCell.getBoundingClientRect();
            tableResizeState = {
                type: 'col',
                table: tableForCell,
                index: hit.index,
                startX: e.clientX,
                startWidth,
                neighborIndex: hasNeighbor ? neighborIndex : null,
                startNeighborWidth,
                totalWidth: hasNeighbor ? (startWidth + startNeighborWidth) : null,
                tableWidth: tableRect.width
            };
        } else {
            freezeTableRowHeights(tableForCell, { preserveHeight: true });
            const row = cell.parentElement;
            const startHeight = getRowHeight(tableForCell, hit.index);
            const neighborRow = tableForCell.rows[hit.index + 1] || null;
            const startNeighborHeight = neighborRow ? getRowHeight(tableForCell, hit.index + 1) : null;
            const tableRect = tableForCell.getBoundingClientRect();
            tableResizeState = {
                type: 'row',
                table: tableForCell,
                row,
                index: hit.index,
                startY: e.clientY,
                startHeight,
                neighborRow,
                startNeighborHeight,
                totalHeight: neighborRow ? (startHeight + startNeighborHeight) : null,
                tableHeight: tableRect.height
            };
        }
    };

    const handleMouseUp = () => {
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
    };

    const handleTableMenuHandleMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeTable) return;
        if (tableMenuOpen) closeTableMenu();
        else openTableMenu(activeTable);
    };

    const handleTableMenuMouseDown = (e) => {
        e.stopPropagation();
    };

    const handleTableMenuClick = async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (!activeTable) { Utils.showToast("표를 먼저 선택하세요.", "error"); return; }
        const mode = tableBorderSelect ? tableBorderSelect.value : 'solid';
        const selectionCells = getSelectionCellsForTable(activeTable);
        const selectionRect = selectionCells.length ? getSelectionRect() : null;
        const action = btn.dataset.action;
        if (action === 'copy-table') {
            const token = serializeEditorTable(activeTable, { normalizeHtml: Utils.cleanRichContentToTex });
            if (!token) { Utils.showToast('복사할 표가 없습니다.', 'info'); return; }
            const ok = await Utils.copyText(token);
            Utils.showToast(ok ? '표가 복사되었습니다.' : '복사에 실패했습니다.', ok ? 'success' : 'error');
            return;
        } else if (action === 'delete-table') {
            const confirmed = await Utils.confirmDialog('표를 삭제하겠습니까?');
            if (!confirmed) return;
            const wrap = activeTable.closest('.block-wrapper');
            const id = wrap ? wrap.dataset.id : null;
            activeTable.remove();
            if (id) syncTableToState(wrap.querySelector('table.editor-table') || wrap);
            activeTable = null;
            closeTableMenu();
            return;
        }
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
        } else if (action === 'border-top') {
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
        } else if (action === 'uniform-rows') {
            const rect = selectionRect || null;
            const rowIndices = getRowIndicesForRect(activeTable, rect);
            applyUniformRowHeights(activeTable, rowIndices);
            syncTableToState(activeTable);
        } else if (action === 'uniform-cols') {
            const rect = selectionRect || null;
            const colIndices = getColIndicesForRect(activeTable, rect);
            applyUniformColumnWidths(activeTable, colIndices);
            syncTableToState(activeTable);
        }
        if (tableMenuOpen) positionTableMenu(activeTable);
    };

    const handleChoiceMenuHandleMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeChoiceTable) return;
        if (choiceMenuOpen) closeChoiceMenu();
        else openChoiceMenu(activeChoiceTable);
    };

    const handleChoiceMenuMouseDown = (e) => {
        e.stopPropagation();
    };

    const handleChoiceMenuClick = async (e) => {
        const actionBtn = e.target.closest('[data-action]');
        const layoutBtn = e.target.closest('[data-layout]');
        if (!actionBtn && !layoutBtn) return;
        if (!activeChoiceTable) { Utils.showToast("선지를 먼저 선택하세요.", "error"); return; }
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            if (action === 'copy-choice') {
                const token = serializeChoiceTable(activeChoiceTable, { normalizeHtml: Utils.cleanRichContentToTex, normalizeLayout: Utils.normalizeChoiceLayout, choiceLabels: Utils.choiceLabels });
                if (!token) { Utils.showToast('복사할 선지가 없습니다.', 'info'); return; }
                const ok = await Utils.copyText(token);
                Utils.showToast(ok ? '선지가 복사되었습니다.' : '복사에 실패했습니다.', ok ? 'success' : 'error');
                return;
            }
            if (action === 'delete-choice') {
                const confirmed = await Utils.confirmDialog('선지를 삭제하겠습니까?');
                if (!confirmed) return;
                const wrap = activeChoiceTable.closest('.block-wrapper');
                const id = wrap ? wrap.dataset.id : null;
                activeChoiceTable.remove();
                if (id) syncChoiceToState(wrap.querySelector('table.choice-table') || wrap);
                activeChoiceTable = null;
                closeChoiceMenu();
                return;
            }
        }
        if (layoutBtn) {
            const nextTable = applyChoiceLayout(activeChoiceTable, layoutBtn.dataset.layout);
            if (nextTable) syncChoiceToState(nextTable);
            if (choiceMenuOpen && nextTable) positionChoiceMenu(nextTable);
        }
    };

    const handleDocumentMouseDown = (e) => {
        if (tableMenuOpen) {
            if (!e.target.closest('#table-menu') && !e.target.closest('#table-menu-handle')) closeTableMenu();
        }
        if (choiceMenuOpen) {
            if (!e.target.closest('#choice-menu') && !e.target.closest('#choice-menu-handle')) closeChoiceMenu();
        }
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
        const choiceTable = e.target.closest('table.choice-table');
        if (choiceTable) {
            activeChoiceTable = choiceTable;
        } else if (!e.target.closest('#choice-menu') && !e.target.closest('#choice-menu-handle')) {
            activeChoiceTable = null;
        }
    };

    const handleScroll = () => {
        closeTableMenu();
        closeChoiceMenu();
    };

    const handleEscape = () => {
        clearTableSelection();
        closeTableMenu();
        closeChoiceMenu();
    };

    const handleDoubleClick = (e) => {
        if (e.target.closest('#table-menu') || e.target.closest('#choice-menu')) return true;
        const choiceTable = e.target.closest('table.choice-table');
        if (choiceTable) {
            activeChoiceTable = choiceTable;
            openChoiceMenu(choiceTable);
            e.stopPropagation();
            return true;
        }
        const cell = e.target.closest('table.editor-table td');
        if (cell) {
            activeCell = cell;
            activeTable = cell.closest('table.editor-table');
            if (!e.shiftKey) {
                clearTableSelection();
                tableSelectAnchor = cell;
            }
            openTableMenu(activeTable);
            e.stopPropagation();
            return true;
        }
        return false;
    };

    const init = () => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);
        if (tableMenuHandle) tableMenuHandle.addEventListener('mousedown', handleTableMenuHandleMouseDown);
        if (tableMenu) {
            tableMenu.addEventListener('mousedown', handleTableMenuMouseDown);
            tableMenu.addEventListener('click', handleTableMenuClick);
        }
        if (choiceMenuHandle) choiceMenuHandle.addEventListener('mousedown', handleChoiceMenuHandleMouseDown);
        if (choiceMenu) {
            choiceMenu.addEventListener('mousedown', handleChoiceMenuMouseDown);
            choiceMenu.addEventListener('click', handleChoiceMenuClick);
        }
    };

    return {
        init,
        handleScroll,
        handleEscape,
        handleDocumentMouseDown,
        handleDoubleClick
    };
};
