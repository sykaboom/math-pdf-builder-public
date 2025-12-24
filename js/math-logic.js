// Filename: js/math-logic.js
export const protectMathEnvironments = (rawInput = '') => {
    let text = String(rawInput || '');
    const envs = ['matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'array', 'aligned', 'align', 'cases'];
    const envPattern = `(?:${envs.join('|')})`;
    const envRegex = new RegExp(`\\\\begin\\{(${envPattern})\\}[\\s\\S]*?\\\\end\\{\\1\\}`, 'g');
    text = text.replace(envRegex, (match) => match.replace(/\$/g, ''));

    const wrapRegex = new RegExp(`\\\\begin\\{(${envPattern})\\}[\\s\\S]*?\\\\end\\{\\1\\}`, 'g');
    let result = '';
    let cursor = 0;
    let inMath = false;
    const updateInMath = (segment) => {
        for (let i = 0; i < segment.length; i++) {
            if (segment[i] !== '$') continue;
            if (i > 0 && segment[i - 1] === '\\') continue;
            inMath = !inMath;
        }
    };

    let match;
    while ((match = wrapRegex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const before = text.slice(cursor, start);
        updateInMath(before);
        result += before;
        if (inMath) result += match[0];
        else result += `$${match[0]}$`;
        cursor = end;
    }
    result += text.slice(cursor);
    return result;
};

export const normalizeLlmOutput = (rawInput = '') => {
    let text = String(rawInput || '').trim();
    const fenced = text.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
    if (fenced) text = fenced[1].trim();
    text = text.replace(/^\s*```[^\n]*\n?/gm, '').replace(/\n?\s*```[\s]*$/gm, '');
    text = text.replace(/\*\*([^*]+?)\*\*/g, '$1').replace(/\*\*/g, '');
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, body) => `$${body}$`);
    text = text.replace(/\\frac/g, '\\dfrac');
    text = text.replace(/\\cdot(?:\s*\\cdot){2}/g, '\\cdots');
    text = protectMathEnvironments(text);
    text = text.replace(/\[선지_([^\]]+)\]\s*:?\s*/g, (match, layout) => {
        const normalized = String(layout || '').trim();
        if (normalized === '1행' || normalized === '2행' || normalized === '5행') return match;
        return '';
    });
    text = text.replace(/\[블록박스_개념\]\s*([\s\S]*?)\s*\[\/블록박스\]/g, (match, body) => {
        const cleaned = String(body || '').trim();
        return `[[박스_개념]] :\n${cleaned}`;
    });
    text = text.replace(/\[\/?블록박스_개념\]/g, '');
    let conceptIndex = 1;
    text = text.replace(/\[\[(박스_개념(?:\s*\d+)?|개념_[^\]]+)\]\]/g, () => `[[박스_개념 ${conceptIndex++}]]`);
    return text.trim();
};

export const getMathSplitCandidates = (tex) => {
    const envRegex = /\\begin\{(matrix|pmatrix|bmatrix|vmatrix|Vmatrix|array|aligned|align|cases)\}/;
    if (!tex) return { candidates: [], reason: '나눌 연산자가 없습니다.' };
    if (envRegex.test(tex)) return { candidates: [], reason: '정렬/행렬 수식은 나누기를 지원하지 않습니다.' };

    const operatorCommands = new Set(['le', 'leq', 'leqslant', 'ge', 'geq', 'geqslant', 'ne', 'neq']);
    const cdotsOperatorCommands = new Set(['times', 'cdot', 'ast']);
    const rawCandidates = [];
    let braceDepth = 0;
    let bracketDepth = 0;
    let parenDepth = 0;
    let awaitingCdotsOperator = false;
    const cdotTripletEnd = (startIndex) => {
        let idx = startIndex;
        let count = 0;
        while (count < 3) {
            if (tex[idx] !== '\\') return null;
            const rest = tex.slice(idx + 1);
            const match = rest.match(/^([a-zA-Z]+|.)/);
            if (!match || match[1] !== 'cdot') return null;
            idx += match[1].length + 1;
            while (idx < tex.length && /\s/.test(tex[idx])) idx++;
            count++;
        }
        return idx;
    };

    for (let i = 0; i < tex.length; i++) {
        const ch = tex[i];
        if (ch === '\\') {
            const rest = tex.slice(i + 1);
            const match = rest.match(/^([a-zA-Z]+|.)/);
            if (match) {
                const cmd = match[1];
                const atTopLevel = braceDepth === 0 && bracketDepth === 0 && parenDepth === 0;
                if (atTopLevel && cmd === 'cdots') {
                    awaitingCdotsOperator = true;
                    i += cmd.length;
                    continue;
                }
                if (atTopLevel && cmd === 'cdot') {
                    const tripletEnd = cdotTripletEnd(i);
                    if (tripletEnd !== null) {
                        awaitingCdotsOperator = true;
                        i = tripletEnd - 1;
                        continue;
                    }
                }
                if (atTopLevel && awaitingCdotsOperator && cdotsOperatorCommands.has(cmd)) {
                    rawCandidates.push({ index: i, token: `\\${cmd}` });
                    awaitingCdotsOperator = false;
                    i += cmd.length;
                    continue;
                }
                if (atTopLevel && operatorCommands.has(cmd)) {
                    rawCandidates.push({ index: i, token: `\\${cmd}` });
                }
                i += cmd.length;
                continue;
            }
        }
        if (ch === '{') { braceDepth++; continue; }
        if (ch === '}') { braceDepth = Math.max(0, braceDepth - 1); continue; }
        if (ch === '[') { bracketDepth++; continue; }
        if (ch === ']') { bracketDepth = Math.max(0, bracketDepth - 1); continue; }
        if (ch === '(') { parenDepth++; continue; }
        if (ch === ')') { parenDepth = Math.max(0, parenDepth - 1); continue; }
        if (braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
            if (ch === '=' || ch === '<' || ch === '>') rawCandidates.push({ index: i, token: ch });
            if (awaitingCdotsOperator && (ch === '+' || ch === '-')) {
                rawCandidates.push({ index: i, token: ch });
                awaitingCdotsOperator = false;
            }
        }
    }

    const normalizeSpace = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const trimPreview = (value, maxLen, trimLeft) => {
        const text = normalizeSpace(value);
        if (text.length <= maxLen) return text;
        return trimLeft ? `...${text.slice(-maxLen)}` : `${text.slice(0, maxLen)}...`;
    };
    const stripOperator = (right, token) => {
        const cleaned = normalizeSpace(right);
        if (!token) return cleaned;
        if (cleaned.startsWith(token)) return normalizeSpace(cleaned.slice(token.length));
        if (token.length === 1 && cleaned[0] === token) return normalizeSpace(cleaned.slice(1));
        return cleaned;
    };

    const candidates = rawCandidates.map(candidate => {
        const left = tex.slice(0, candidate.index).trim();
        const right = tex.slice(candidate.index).trim();
        if (!left || !right) return null;
        const rightBody = stripOperator(right, candidate.token);
        if (!rightBody) return null;
        const leftPreview = trimPreview(left, 18, true) || '...';
        const rightPreview = trimPreview(rightBody, 18, false) || '...';
        return {
            index: candidate.index,
            token: candidate.token,
            leftPreview,
            rightPreview
        };
    }).filter(Boolean);

    return candidates.length
        ? { candidates, reason: '' }
        : { candidates: [], reason: '나눌 연산자가 없습니다.' };
};
