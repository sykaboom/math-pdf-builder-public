// Filename: js/math-tokenize.js
export const escapeForMathTex = (value = '') => {
    return value
        .replace(/\\/g, '\\textbackslash ')
        .replace(/([{}#%&_\$])/g, '\\$1')
        .replace(/\^/g, '\\^{}')
        .replace(/~/g, '\\~{}');
};

export const decodeMathEntities = (value = '') => {
    let text = String(value);
    text = text.replace(/&amp;lt;/g, '&lt;').replace(/&amp;gt;/g, '&gt;');
    text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return text;
};

export const sanitizeMathTokens = (tex, options = {}) => {
    if (!tex) return tex;
    const { trackConceptBlanks = true, getConceptBlankIndex } = options;
    const normalizeMathBlankLabel = (value = '') => {
        return String(value).replace(/\s+/g, ' ').trim();
    };
    const formatConceptBlankLabel = (value = '') => {
        const normalized = normalizeMathBlankLabel(value);
        return `(${normalized || '#'})`;
    };
    const toMathBlankText = (label = '') => {
        const normalized = normalizeMathBlankLabel(label);
        return `\\class{math-blank-box}{\\bbox[border:1.5px solid #000; padding: 3px 12px; background: #fff]{\\text{${escapeForMathTex(normalized)}}}}`;
    };
    const toConceptBlankText = (answerText = '', rawLabel = '#') => {
        if (!trackConceptBlanks) return toMathBlankText(formatConceptBlankLabel(rawLabel));
        const index = typeof getConceptBlankIndex === 'function'
            ? getConceptBlankIndex(answerText)
            : null;
        return toMathBlankText(`(${index || '#'})`);
    };
    const toBoxedText = (label = '') => {
        return `\\boxed{\\text{${escapeForMathTex(label)}}}`;
    };
    let nextTex = tex;
    nextTex = nextTex.replace(/\[개념빈칸([:_])([^\]]*?)\]([\s\S]*?)\[\/개념빈칸\]/g, (m, delim, label, body) => toConceptBlankText(body, label));
    nextTex = nextTex.replace(/\[빈칸[:_](.*?)\]/g, (m, label) => toMathBlankText(label));
    nextTex = nextTex.replace(/\[이미지\s*:\s*(.*?)\]/g, (m, label) => toBoxedText(label));
    return nextTex;
};

export const stripConceptBlankTokens = (tex) => {
    if (!tex) return tex;
    return tex.replace(/\[개념빈칸([:_])([^\]]*?)\]([\s\S]*?)\[\/개념빈칸\]/g, (m, delim, label, body) => String(body || ''));
};
