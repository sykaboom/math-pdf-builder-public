// Filename: js/block-logic.js
const escapeHtml = (value = '') => {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

const buildVariantBlock = (variant, options = {}) => {
    const label = escapeHtml(options.label || '');
    const subLabel = escapeHtml(options.subLabel || '');
    if (variant === 'left-concept') {
        return {
            type: 'concept',
            content: `${label ? `<span class="q-label">${label}</span> ` : ''}내용 입력...`
        };
    }
    if (variant === 'top-concept') {
        const title = label || 'Visual Concept';
        return {
            type: 'concept',
            content: `<div class="top-concept-header">${title}</div><div class="top-concept-body">내용 입력...</div>`
        };
    }
    if (variant === 'two-col-concept') {
        const title = label || '';
        const sub = subLabel ? `<div class="two-col-concept-sub">${subLabel}</div>` : '';
        return {
            type: 'example',
            content: `<div class="two-col-concept"><div class="two-col-concept-label"><div class="two-col-concept-title">${title}</div>${sub}</div><div class="two-col-concept-body">내용 입력...</div></div>`
        };
    }
    return null;
};

export const buildNewBlockData = (type, options = {}) => {
    const { imagePlaceholderHtml = '', variant = null } = options;
    const newBlock = { id: `b_${Date.now()}`, type, content: '' };
    if (variant) {
        const built = buildVariantBlock(variant, options);
        if (built) {
            newBlock.type = built.type;
            newBlock.content = built.content;
            newBlock.variant = variant;
            return newBlock;
        }
    }
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
