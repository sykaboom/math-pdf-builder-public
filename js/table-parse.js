// Filename: js/table-parse.js
export const toPositiveInt = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const decodeQuotedValue = (rawValue = '') => {
    let value = String(rawValue || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    } else if (value.startsWith('&quot;') && value.endsWith('&quot;')) {
        value = value
            .slice(6, -6)
            .replace(/\\&quot;/g, '"')
            .replace(/&quot;/g, '"')
            .replace(/\\\\/g, '\\');
    }
    return value;
};

export const parseTableCellData = (data = '') => {
    const cellMap = new Map();
    if (!data) return cellMap;
    const cellRegex = /\((\d+)x(\d+)_("(?:(?:\\")|(?:\\\\)|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)/g;
    let match;
    while ((match = cellRegex.exec(data)) !== null) {
        const key = `${match[1]}x${match[2]}`;
        cellMap.set(key, decodeQuotedValue(match[3] || ''));
    }
    return cellMap;
};

export const parseChoiceData = (data = '') => {
    const choiceMap = new Map();
    if (!data) return choiceMap;
    const choiceRegex = /\((\d+)_("(?:(?:\\")|(?:\\\\)|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)/g;
    let match;
    while ((match = choiceRegex.exec(data)) !== null) {
        const idx = parseInt(match[1], 10);
        if (!Number.isFinite(idx)) continue;
        choiceMap.set(String(idx), decodeQuotedValue(match[2] || ''));
    }
    return choiceMap;
};
