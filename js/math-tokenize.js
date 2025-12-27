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

/**
 * Replace concept blank/image tokens inside math with TeX-safe placeholders.
 * @param {string} tex
 * @param {{trackConceptBlanks?: boolean, getConceptBlankIndex?: function}} options
 * @returns {string}
 */
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

// Force displaystyle and upgrade fractions outside scripts for consistent sizing.
export const applyMathDisplayRules = (tex) => {
    if (!tex) return tex;
    const needsDisplay = !/^\s*\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)\b/.test(tex);
    let nextTex = needsDisplay ? `\\displaystyle ${tex}` : tex;
    const replaceOutsideScripts = (input) => {
        let out = '';
        let i = 0;
        let scriptDepth = 0;
        while (i < input.length) {
            const ch = input[i];
            if ((ch === '_' || ch === '^') && i + 1 < input.length) {
                out += ch;
                i++;
                scriptDepth++;
                if (input[i] === '{') {
                    out += '{';
                    i++;
                    let depth = 1;
                    while (i < input.length && depth > 0) {
                        const c = input[i];
                        out += c;
                        if (c === '{') depth++;
                        else if (c === '}') depth--;
                        i++;
                    }
                    scriptDepth = Math.max(0, scriptDepth - 1);
                    continue;
                }
                out += input[i];
                i++;
                scriptDepth = Math.max(0, scriptDepth - 1);
                continue;
            }
            if (scriptDepth === 0 && input.startsWith('\\frac', i)) {
                out += '\\dfrac';
                i += 5;
                continue;
            }
            out += ch;
            i++;
        }
        return out;
    };
    nextTex = replaceOutsideScripts(nextTex);
    return nextTex;
};

/**
 * Strip concept blank tokens from math and keep only the raw answer text.
 * @param {string} tex
 * @returns {string}
 */
export const stripConceptBlankTokens = (tex) => {
    if (!tex) return tex;
    return tex.replace(/\[개념빈칸([:_])([^\]]*?)\]([\s\S]*?)\[\/개념빈칸\]/g, (m, delim, label, body) => String(body || ''));
};
