// Filename: js/table-serialize.js
export const escapeTokenValue = (value = '') => {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

export const serializeEditorTable = (table, options = {}) => {
    const { normalizeHtml } = options;
    if (!table) return '';
    const rows = Array.from(table.rows);
    const rowCount = rows.length;
    const colCount = rows[0] ? rows[0].cells.length : 0;
    if (!rowCount || !colCount) return '';
    const entries = [];
    rows.forEach((row, r) => {
        Array.from(row.cells).forEach((cell, c) => {
            const raw = typeof normalizeHtml === 'function'
                ? normalizeHtml(cell.innerHTML || '')
                : (cell.innerHTML || '');
            const normalized = raw.replace(/\u00A0/g, ' ');
            if (!normalized.trim()) return;
            const escaped = escapeTokenValue(normalized);
            entries.push(`(${r + 1}x${c + 1}_"${escaped}")`);
        });
    });
    const head = `[표_${rowCount}x${colCount}]`;
    return entries.length ? `${head} : ${entries.join(', ')}` : head;
};

export const serializeChoiceTable = (table, options = {}) => {
    const { normalizeHtml, normalizeLayout, layoutGrid, choiceLabels } = options;
    if (!table) return '';
    const layout = typeof normalizeLayout === 'function'
        ? normalizeLayout(table.dataset ? table.dataset.layout : '2')
        : (table.dataset ? table.dataset.layout : '2');
    const layoutToken = layout === '1' ? '1행' : layout === '5' ? '5행' : '2행';
    const items = [];
    table.querySelectorAll('td[data-choice-index]').forEach(cell => {
        const idx = parseInt(cell.dataset.choiceIndex, 10);
        if (!Number.isFinite(idx)) return;
        const textEl = cell.querySelector('.choice-text');
        const raw = typeof normalizeHtml === 'function'
            ? normalizeHtml(textEl ? textEl.innerHTML : '')
            : (textEl ? textEl.innerHTML : '');
        const normalized = raw.replace(/\u00A0/g, ' ');
        if (!normalized.trim()) return;
        items.push({ idx, value: normalized });
    });
    items.sort((a, b) => a.idx - b.idx);
    const entries = items.map(item => `(${item.idx}_"${escapeTokenValue(item.value)}")`);
    const head = `[선지_${layoutToken}]`;
    return entries.length ? `${head} : ${entries.join(', ')}` : head;
};
