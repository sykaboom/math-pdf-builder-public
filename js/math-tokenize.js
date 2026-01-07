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
    if (!text.includes('&')) return text;
    while (text.includes('&amp;')) {
        text = text.replace(/&amp;/g, '&');
    }
    text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    text = text.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
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
    const nextTex = needsDisplay ? `\\displaystyle ${tex}` : tex;
    const argCounts = {
        frac: 2,
        dfrac: 2,
        tfrac: 2,
        cfrac: 2,
        binom: 2,
        dbinom: 2,
        tbinom: 2,
        overset: 2,
        underset: 2,
        stackrel: 2,
        sqrt: 1,
        overline: 1,
        underline: 1,
        bar: 1,
        vec: 1,
        hat: 1,
        tilde: 1,
        dot: 1,
        ddot: 1,
        text: 1,
        textbf: 1,
        textit: 1,
        mathrm: 1,
        mathbf: 1,
        mathit: 1,
        mathcal: 1,
        mathbb: 1,
        mathfrak: 1,
        mathsf: 1,
        operatorname: 1
    };
    const optionalArgCommands = new Set(['sqrt']);
    const readControlSequence = (input, start) => {
        let i = start + 1;
        if (i >= input.length) return { name: '', end: i };
        if (/[a-zA-Z]/.test(input[i])) {
            while (i < input.length && /[a-zA-Z]/.test(input[i])) i++;
        } else {
            i++;
        }
        return { name: input.slice(start + 1, i), end: i };
    };
    const isEscaped = (input, index) => {
        let count = 0;
        for (let i = index - 1; i >= 0 && input[i] === '\\'; i--) count++;
        return count % 2 === 1;
    };
    const consumeGroup = (input, start, openChar, closeChar) => {
        let depth = 0;
        let i = start;
        while (i < input.length) {
            const ch = input[i];
            if (ch === openChar && !isEscaped(input, i)) depth++;
            else if (ch === closeChar && !isEscaped(input, i)) {
                depth--;
                if (depth === 0) {
                    i++;
                    break;
                }
            }
            i++;
        }
        return i;
    };
    const skipSpaces = (input, start) => {
        let i = start;
        while (i < input.length && /\s/.test(input[i])) i++;
        return i;
    };
    const consumeArgument = (input, start) => {
        let i = start;
        if (i >= input.length) return i;
        const ch = input[i];
        if (ch === '{') return consumeGroup(input, i, '{', '}');
        if (ch === '[') return consumeGroup(input, i, '[', ']');
        if (ch === '\\') {
            const { name, end } = readControlSequence(input, i);
            let j = end;
            if (optionalArgCommands.has(name) && input[j] === '[') {
                j = consumeGroup(input, j, '[', ']');
            }
            const argCount = Object.prototype.hasOwnProperty.call(argCounts, name) ? argCounts[name] : 0;
            for (let k = 0; k < argCount; k++) {
                j = skipSpaces(input, j);
                const next = consumeArgument(input, j);
                if (next <= j) break;
                j = next;
            }
            return j;
        }
        return i + 1;
    };
    const replaceOutsideScripts = (input) => {
        let out = '';
        let i = 0;
        let pendingScript = false;
        while (i < input.length) {
            if (pendingScript) {
                if (/\s/.test(input[i])) {
                    out += input[i];
                    i++;
                    continue;
                }
                const end = consumeArgument(input, i);
                if (end <= i) {
                    out += input[i];
                    i++;
                } else {
                    out += input.slice(i, end);
                    i = end;
                }
                pendingScript = false;
                continue;
            }
            const ch = input[i];
            if ((ch === '_' || ch === '^') && i + 1 < input.length) {
                out += ch;
                i++;
                pendingScript = true;
                continue;
            }
            if (input.startsWith('\\frac', i)) {
                out += '\\dfrac';
                i += 5;
                continue;
            }
            out += ch;
            i++;
        }
        return out;
    };
    return replaceOutsideScripts(nextTex);
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
