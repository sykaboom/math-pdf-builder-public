// Filename: js/import-logic.js
export const buildJsonImportBlocks = (parsedJson) => {
    const arr = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
    return arr.map(item => ({
        id: `imp_json_${Date.now()}${Math.random()}`,
        type: item.type || 'example',
        content: item.content || '',
        bordered: item.bordered || false,
        bgGray: item.bgGray || false
    }));
};

export const parseJsonImport = (input = '') => {
    const text = String(input || '');
    if (!text.startsWith('[') && !text.startsWith('{')) return null;
    try {
        const parsedJson = JSON.parse(text);
        if (typeof parsedJson !== 'object' || parsedJson === null) return null;
        return buildJsonImportBlocks(parsedJson);
    } catch (error) {
        return null;
    }
};

export const expandImportedBlocks = (blocks, options = {}) => {
    const { limit = 0, addSpacer = false } = options;
    const processedBlocks = [];
    let countInColumn = 0;
    const affectsLimit = (block) => block && block.type !== 'answer' && block.bgGray !== true;
    blocks.forEach((block, idx) => {
        processedBlocks.push(block);
        if (affectsLimit(block)) {
            countInColumn++;
            if (addSpacer) processedBlocks.push({ id: `sp_${Math.random()}`, type: 'spacer', height: 50 });
        }
        if (limit > 0 && countInColumn >= limit && idx < blocks.length - 1) {
            processedBlocks.push({ id: `br_${Math.random()}`, type: 'break' });
            countInColumn = 0;
        }
    });
    return processedBlocks;
};
