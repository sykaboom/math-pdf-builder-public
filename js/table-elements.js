// Filename: js/table-elements.js
import { Utils } from './utils.js';
import { toPositiveInt } from './table-parse.js';

export const buildEditorTableElement = (rows, cols, cellData = null, options = {}) => {
    const rowCount = toPositiveInt(rows);
    const colCount = toPositiveInt(cols);
    if (!rowCount || !colCount) return null;
    const table = document.createElement('table');
    table.className = 'editor-table';
    table.dataset.rows = rowCount;
    table.dataset.cols = colCount;
    const colgroup = document.createElement('colgroup');
    for (let c = 0; c < colCount; c++) colgroup.appendChild(document.createElement('col'));
    table.appendChild(colgroup);
    const tbody = document.createElement('tbody');
    for (let r = 0; r < rowCount; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < colCount; c++) {
            const td = document.createElement('td');
            td.setAttribute('contenteditable', 'true');
            if (cellData) {
                const key = `${r + 1}x${c + 1}`;
                if (cellData.has(key)) {
                    const value = cellData.get(key);
                    if (options.allowHtml) td.innerHTML = value;
                    else td.textContent = value;
                }
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
};

export const buildChoiceTableElement = (layoutToken, choiceData = null, options = {}) => {
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
    const allowHtml = !!options.allowHtml;
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
                if (allowHtml) text.innerHTML = value;
                else text.textContent = value;
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
