// Filename: js/table-utils.js
export const TABLE_MIN_WIDTH = 40;
export const TABLE_MIN_HEIGHT = 24;

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

export const freezeTableColWidths = (table) => {
    const colgroup = ensureColgroup(table);
    if (!colgroup) return;
    const firstRow = table.rows[0];
    const cells = firstRow ? Array.from(firstRow.cells) : [];
    Array.from(colgroup.children).forEach((col, idx) => {
        const cell = cells[idx];
        if (!cell) return;
        const width = Math.max(TABLE_MIN_WIDTH, cell.getBoundingClientRect().width);
        col.style.width = width + 'px';
    });
    syncTableWidthFromCols(table);
};

export const freezeTableRowHeights = (table) => {
    Array.from(table.rows).forEach(row => {
        const height = Math.max(TABLE_MIN_HEIGHT, row.getBoundingClientRect().height);
        row.style.height = height + 'px';
        row.querySelectorAll('td').forEach(td => {
            td.style.height = height + 'px';
        });
    });
    syncTableHeightFromRows(table);
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
