// Filename: js/block-logic.js
export const buildNewBlockData = (type, options = {}) => {
    const { imagePlaceholderHtml = '' } = options;
    const newBlock = { id: `b_${Date.now()}`, type, content: '' };
    if (type === 'concept') newBlock.content = '<span class="q-label">개념</span> ';
    if (type === 'image') { newBlock.type = 'example'; newBlock.content = imagePlaceholderHtml; }
    if (type === 'break') newBlock.type = 'break';
    if (type === 'spacer') { newBlock.type = 'spacer'; newBlock.height = 50; }
    return newBlock;
};

export const cloneBlockData = (block) => {
    const clone = JSON.parse(JSON.stringify(block));
    clone.id = `copy_${Date.now()}`;
    return clone;
};

export const buildSplitBlockData = (baseBlock, afterHtml) => {
    const newBlock = JSON.parse(JSON.stringify(baseBlock));
    newBlock.id = `b_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
    newBlock.content = afterHtml || '';
    return newBlock;
};
