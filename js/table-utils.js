// Filename: js/table-utils.js
export const TABLE_MIN_WIDTH = 40;
export const TABLE_MIN_HEIGHT = 24;

/**
 * Ensure a colgroup with enough columns exists for a table.
 * @param {HTMLTableElement} table
 * @returns {HTMLTableColElement|null}
 */
export const ensureColgroup = (table) => {
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

export const syncTableWidthFromCols = (table) => {
    const colgroup = ensureColgroup(table);
    if (!colgroup) return;
    let total = 0;
    Array.from(colgroup.children).forEach(col => {
        const width = parseFloat(col.style.width);
        if (Number.isFinite(width) && width > 0) total += width;
    });
    if (total > 0) {
        table.style.width = total + 'px';
        table.style.tableLayout = 'fixed';
    }
};

export const syncTableHeightFromRows = (table) => {
    const rows = Array.from(table.rows);
    let total = 0;
    rows.forEach(row => {
        const height = parseFloat(row.style.height);
        if (Number.isFinite(height) && height > 0) total += height;
    });
    if (total > 0) {
        table.style.height = total + 'px';
    }
};

export const setColumnWidthRaw = (table, index, width) => {
    const colgroup = ensureColgroup(table);
    if (!colgroup || !colgroup.children[index]) return;
    colgroup.children[index].style.width = Math.max(TABLE_MIN_WIDTH, width) + 'px';
};

export const freezeTableColWidths = (table, options = {}) => {
    const colgroup = ensureColgroup(table);
    if (!colgroup) return;
    const preserveWidth = options.preserveWidth !== false;
    const firstRow = table.rows[0];
    const cells = firstRow ? Array.from(firstRow.cells) : [];
    const tableWidth = table.getBoundingClientRect().width;
    const style = window.getComputedStyle(table);
    const borderX = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
    const contentWidth = Math.max(0, tableWidth - borderX);
    let widths = Array.from(colgroup.children).map((col, idx) => {
        const preset = parseFloat(col.style.width);
        if (Number.isFinite(preset) && preset > 0) return Math.max(TABLE_MIN_WIDTH, preset);
        const cell = cells[idx];
        const width = cell ? cell.getBoundingClientRect().width : TABLE_MIN_WIDTH;
        return Math.max(TABLE_MIN_WIDTH, width);
    });
    const total = widths.reduce((sum, value) => sum + value, 0);
    if (preserveWidth && total > 0 && contentWidth > 0) {
        const diff = contentWidth - total;
        if (widths.length) {
            const lastIdx = widths.length - 1;
            widths[lastIdx] = Math.max(TABLE_MIN_WIDTH, widths[lastIdx] + diff);
        }
    }
    Array.from(colgroup.children).forEach((col, idx) => {
        const width = widths[idx] || TABLE_MIN_WIDTH;
        col.style.width = width + 'px';
    });
    if (preserveWidth && tableWidth > 0) {
        table.style.width = tableWidth + 'px';
        table.style.tableLayout = 'fixed';
    } else {
        syncTableWidthFromCols(table);
    }
};

export const freezeTableRowHeights = (table, options = {}) => {
    const preserveHeight = options.preserveHeight !== false;
    const rows = Array.from(table.rows);
    const tableHeight = table.getBoundingClientRect().height;
    const style = window.getComputedStyle(table);
    const borderY = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    const contentHeight = Math.max(0, tableHeight - borderY);
    let heights = rows.map(row => {
        const preset = parseFloat(row.style.height);
        if (Number.isFinite(preset) && preset > 0) return Math.max(TABLE_MIN_HEIGHT, preset);
        return Math.max(TABLE_MIN_HEIGHT, row.getBoundingClientRect().height);
    });
    const total = heights.reduce((sum, value) => sum + value, 0);
    if (preserveHeight && total > 0 && contentHeight > 0) {
        const diff = contentHeight - total;
        if (heights.length) {
            const lastIdx = heights.length - 1;
            heights[lastIdx] = Math.max(TABLE_MIN_HEIGHT, heights[lastIdx] + diff);
        }
    }
    rows.forEach((row, idx) => {
        const height = heights[idx] || TABLE_MIN_HEIGHT;
        row.style.height = height + 'px';
        row.querySelectorAll('td').forEach(td => {
            td.style.height = height + 'px';
        });
    });
    if (preserveHeight && tableHeight > 0) {
        table.style.height = tableHeight + 'px';
    } else {
        syncTableHeightFromRows(table);
    }
};

export const applyColumnWidth = (table, index, width) => {
    setColumnWidthRaw(table, index, width);
    syncTableWidthFromCols(table);
};

export const applyRowHeight = (row, height) => {
    const newHeight = Math.max(TABLE_MIN_HEIGHT, height);
    row.style.height = newHeight + 'px';
    row.querySelectorAll('td').forEach(td => {
        td.style.height = newHeight + 'px';
    });
};

export const getColWidth = (table, index) => {
    const colgroup = ensureColgroup(table);
    if (colgroup && colgroup.children[index]) {
        const width = parseFloat(colgroup.children[index].style.width);
        if (Number.isFinite(width) && width > 0) return width;
    }
    const row = table.rows[0];
    const cell = row ? row.cells[index] : null;
    return cell ? cell.getBoundingClientRect().width : TABLE_MIN_WIDTH;
};

export const getRowHeight = (table, index) => {
    const row = table.rows[index];
    if (!row) return TABLE_MIN_HEIGHT;
    const height = parseFloat(row.style.height);
    if (Number.isFinite(height) && height > 0) return height;
    return row.getBoundingClientRect().height || TABLE_MIN_HEIGHT;
};

export const applyUniformColumnWidths = (table, colIndices) => {
    if (!colIndices.length) return;
    freezeTableColWidths(table);
    const colgroup = ensureColgroup(table);
    if (!colgroup) return;
    const widths = colIndices.map(index => parseFloat(colgroup.children[index]?.style.width) || TABLE_MIN_WIDTH);
    const average = widths.reduce((sum, value) => sum + value, 0) / widths.length;
    colIndices.forEach(index => {
        if (colgroup.children[index]) {
            colgroup.children[index].style.width = Math.max(TABLE_MIN_WIDTH, average) + 'px';
        }
    });
    syncTableWidthFromCols(table);
};

export const applyUniformRowHeights = (table, rowIndices) => {
    if (!rowIndices.length) return;
    freezeTableRowHeights(table);
    const heights = rowIndices.map(index => {
        const row = table.rows[index];
        return row ? (parseFloat(row.style.height) || TABLE_MIN_HEIGHT) : TABLE_MIN_HEIGHT;
    });
    const average = heights.reduce((sum, value) => sum + value, 0) / heights.length;
    rowIndices.forEach(index => {
        const row = table.rows[index];
        if (row) applyRowHeight(row, average);
    });
    syncTableHeightFromRows(table);
};

export const getRowIndicesForRect = (table, rect) => {
    const rows = Array.from(table.rows);
    if (!rows.length) return [];
    if (!rect) return rows.map((_, idx) => idx);
    const maxRow = Math.min(rect.maxRow, rows.length - 1);
    const indices = [];
    for (let r = Math.max(0, rect.minRow); r <= maxRow; r++) indices.push(r);
    return indices;
};

export const getColIndicesForRect = (table, rect) => {
    const firstRow = table.rows[0];
    const colCount = firstRow ? firstRow.cells.length : 0;
    if (!colCount) return [];
    if (!rect) return Array.from({ length: colCount }, (_, idx) => idx);
    const maxCol = Math.min(rect.maxCol, colCount - 1);
    const indices = [];
    for (let c = Math.max(0, rect.minCol); c <= maxCol; c++) indices.push(c);
    return indices;
};

/**
 * Determine if the cursor is near a table cell resize handle.
 * @param {HTMLTableCellElement} cell
 * @param {MouseEvent} event
 * @param {number} [margin=4]
 * @returns {{type: 'col' | 'row', index: number} | null}
 */
export const getTableResizeHit = (cell, event, margin = 4) => {
    if (!cell) return null;
    const table = cell.closest('table.editor-table');
    if (!table) return null;
    const rect = cell.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const distRight = rect.width - offsetX;
    const distBottom = rect.height - offsetY;
    const nearRight = distRight >= 0 && distRight <= margin;
    const nearBottom = distBottom >= 0 && distBottom <= margin;
    const row = cell.parentElement;
    const firstRow = table.rows[0];
    const lastColIndex = firstRow ? firstRow.cells.length - 1 : 0;
    const lastRowIndex = table.rows.length - 1;
    const canResizeCol = nearRight && cell.cellIndex < lastColIndex;
    const canResizeRow = nearBottom && row && row.rowIndex < lastRowIndex;
    if (canResizeCol && canResizeRow) {
        return distRight <= distBottom ? { type: 'col', index: cell.cellIndex } : { type: 'row', index: row.rowIndex };
    }
    if (canResizeCol) return { type: 'col', index: cell.cellIndex };
    if (canResizeRow) return { type: 'row', index: row.rowIndex };
    return null;
};
