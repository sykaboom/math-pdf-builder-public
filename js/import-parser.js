// Filename: js/import-parser.js
import { parseChoiceData, parseTableCellData } from './table-parse.js';
import { buildChoiceTableElement, buildEditorTableElement } from './table-elements.js';
import { Utils } from './utils.js';

const HEADER_TOKENS = [
    { token: '머릿말_과정', key: 'title' },
    { token: '머릿말_단원', key: 'subtitle' }
];
const FOOTER_TAG = '꼬릿말';

const extractHeaderTokens = (input = '') => {
    const lines = String(input || '').split(/\r?\n/);
    const meta = {};
    const normalizeValue = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const remaining = [];
    lines.forEach((line) => {
        const trimmedLine = line.trim();
        let consumed = false;
        if (!consumed) {
            const footerMatch = trimmedLine.match(new RegExp(`^\\[\\[${FOOTER_TAG}:([^\\]]*)\\]\\]\\s*:?\\s*(.*)$`));
            if (footerMatch) {
                const inlineValue = normalizeValue(footerMatch[1] || '');
                const trailingValue = normalizeValue(footerMatch[2] || '');
                meta.footerText = inlineValue || trailingValue;
                consumed = true;
            }
        }
        for (const { token, key } of HEADER_TOKENS) {
            const regex = new RegExp(`^\\[\\[${token}\\]\\]\\s*:?\\s*(.*)$`);
            const match = trimmedLine.match(regex);
            if (match) {
                const value = normalizeValue(match[1]);
                if (value) meta[key] = value;
                consumed = true;
                break;
            }
        }
        if (!consumed) remaining.push(line);
    });
    return { text: remaining.join('\n').trim(), meta };
};

export const ImportParser = {
    parse(text) {
        const blocks = [];
        const { text: cleanedText, meta } = extractHeaderTokens(text);
        const rawItems = cleanedText.split('[[').filter(s => s.trim().length > 0);
        const escapeHtml = (value = '') => {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };
        rawItems.forEach(chunk => {
            const closeIdx = chunk.indexOf(']]'); if (closeIdx === -1) return;
            const blockMeta = chunk.substring(0, closeIdx);
            let content = chunk.substring(closeIdx + 2).trim();
            if (content.startsWith(':')) content = content.substring(1).trim();
            const metaClean = blockMeta.trim();
            const [stylePart, labelPart] = metaClean.includes('_') ? metaClean.split('_') : ['기본', metaClean];
            const styles = stylePart.split(',');
            const labelTrim = (labelPart || '').trim();
            const hasStyle = (name) => styles.some(style => style.trim() === name);
            const isLeftConcept = hasStyle('좌컨셉');
            const isTopConcept = hasStyle('상단컨셉');
            const isTwoColConcept = hasStyle('2단컨셉');
            const isConceptBlock = hasStyle('개념')
                || isLeftConcept
                || isTopConcept
                || /^박스_개념\b/.test(metaClean)
                || /^개념\b/.test(metaClean)
                || (hasStyle('박스') && /^개념\b/.test(labelTrim));

            content = escapeHtml(content);
            if (isConceptBlock) {
                content = content.replace(/\[블록박스_[^\]]*\]/g, '[블록사각형]');
                content = content.replace(/\[\/블록박스\]/g, '[/블록사각형]');
            }

            const renderBox = (label, body) => {
                const bodyText = (body || '').trim().replace(/\n/g, '<br>');
                const normalizedLabel = Utils.normalizeBoxLabel(label);
                if (normalizedLabel.text) {
                    const labelHtml = normalizedLabel.isViewLabel
                        ? `<div class="box-label view-label" contenteditable="false">${normalizedLabel.text}</div>`
                        : `<div class="box-label" contenteditable="false">${normalizedLabel.text}</div>`;
                    return `<div class="custom-box labeled-box" contenteditable="false">${labelHtml}<div class="box-content" contenteditable="true">${bodyText}</div></div>`;
                }
                return `<div class="custom-box simple-box" contenteditable="false"><div class="box-content" contenteditable="true">${bodyText}</div></div>`;
            };

            const renderRectBox = (body) => {
                const bodyText = (body || '').trim().replace(/\n/g, '<br>');
                return `<div class="rect-box" contenteditable="false"><div class="rect-box-content" contenteditable="true">${bodyText}</div></div>`;
            };

            const getEscapedImagePlaceholderHTML = (escapedLabelText = '') => {
                const label = (escapedLabelText || '').trim();
                const display = label ? `[이미지: ${label}]` : '이미지 박스';
                return `<span class="image-placeholder" contenteditable="false" data-label="${label}">${display}<button class="image-load-btn" contenteditable="false" tabindex="-1">불러오기</button></span>`;
            };
            const getConceptBlankPlaceholderHTML = (rawLabelText = '#', answerText = '', delim = ':') => {
                const span = document.createElement('span');
                span.className = 'blank-box concept-blank-box';
                span.setAttribute('contenteditable', 'false');
                span.dataset.blankKind = 'concept';
                span.dataset.rawLabel = rawLabelText;
                span.dataset.delim = delim || ':';
                span.dataset.answer = answerText;
                span.textContent = '(#)';
                return span.outerHTML;
            };
            const replaceConceptBlanksOutsideMath = (input = '') => {
                const mathRegex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g;
                const conceptRegex = /\[개념빈칸([:_])([^\]]*?)\]([\s\S]*?)\[\/개념빈칸\]/g;
                const replaceConcept = (segment = '') => {
                    return segment.replace(conceptRegex, (m, delim, label, body) => {
                        const rawLabel = label !== undefined ? label : '#';
                        return getConceptBlankPlaceholderHTML(rawLabel, body || '', delim);
                    });
                };
                let output = '';
                let lastIndex = 0;
                mathRegex.lastIndex = 0;
                let match;
                while ((match = mathRegex.exec(input)) !== null) {
                    output += replaceConcept(input.slice(lastIndex, match.index));
                    output += match[0];
                    lastIndex = mathRegex.lastIndex;
                }
                output += replaceConcept(input.slice(lastIndex));
                return output;
            };

            const convertBlockBoxes = (input) => {
                const lines = input.split('\n');
                const outLines = [];
                for (let i = 0; i < lines.length; ) {
                    const line = lines[i];
                    const m = line.match(/^\s*\[블록박스_(.*?)\]\s*(?::)?\s*(.*)$/);
                    if (!m) { outLines.push(line); i++; continue; }

                    const label = (m[1] || '').trim();
                    const rest = (m[2] || '').trim();
                    if (rest) {
                        outLines.push(renderBox(label, rest));
                        i++; continue;
                    }

                    const bodyLines = [];
                    let j = i + 1; let foundEnd = false;
                    for (; j < lines.length; j++) {
                        const endPos = lines[j].indexOf('[/블록박스]');
                        if (endPos !== -1) {
                            foundEnd = true;
                            const before = lines[j].slice(0, endPos);
                            if (before.trim() !== '') bodyLines.push(before);
                            outLines.push(renderBox(label, bodyLines.join('\n')));
                            const after = lines[j].slice(endPos + '[/블록박스]'.length);
                            if (after.trim() !== '') outLines.push(after.trim());
                            break;
                        }
                        bodyLines.push(lines[j]);
                    }
                    if (foundEnd) i = j + 1;
                    else { outLines.push(line); outLines.push(...bodyLines); i = j; }
                }
                return outLines.join('\n');
            };
            const convertRectBoxes = (input) => {
                const lines = input.split('\n');
                const outLines = [];
                for (let i = 0; i < lines.length; ) {
                    const line = lines[i];
                    const m = line.match(/^\s*\[블록사각형\]\s*(?::)?\s*(.*)$/);
                    if (!m) { outLines.push(line); i++; continue; }

                    const rest = (m[1] || '').trim();
                    if (rest) {
                        outLines.push(renderRectBox(rest));
                        i++; continue;
                    }

                    const bodyLines = [];
                    let j = i + 1; let foundEnd = false;
                    for (; j < lines.length; j++) {
                        const endPos = lines[j].indexOf('[/블록사각형]');
                        if (endPos !== -1) {
                            foundEnd = true;
                            const before = lines[j].slice(0, endPos);
                            if (before.trim() !== '') bodyLines.push(before);
                            outLines.push(renderRectBox(bodyLines.join('\n')));
                            const after = lines[j].slice(endPos + '[/블록사각형]'.length);
                            if (after.trim() !== '') outLines.push(after.trim());
                            break;
                        }
                        bodyLines.push(lines[j]);
                    }
                    if (foundEnd) i = j + 1;
                    else { outLines.push(line); outLines.push(...bodyLines); i = j; }
                }
                return outLines.join('\n');
            };

            const convertLegacyBlockBoxes = (input) => {
                return input.replace(/\[블록박스_(.*?)\]\s*(?::)?\s*([^\n]*?)\s*\]/g, (m, label, body) => {
                    return renderBox((label || '').trim(), body);
                });
            };
            const convertLegacyRectBoxes = (input) => {
                return input.replace(/\[블록사각형_([^\]]*?)\]/g, (m, body) => renderRectBox(body));
            };

            content = convertLegacyRectBoxes(convertRectBoxes(convertLegacyBlockBoxes(convertBlockBoxes(content))));
            content = content.replace(/\[표_(\d+)x(\d+)\](?:\s*:\s*((?:\(\d+x\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+))?/g, (m, rows, cols, data) => {
                const cellData = data ? parseTableCellData(data) : null;
                const tableEl = buildEditorTableElement(rows, cols, cellData, { allowHtml: true });
                return tableEl ? tableEl.outerHTML : m;
            });
            content = content.replace(/\[선지_(1행|2행|5행)\](?:\s*:\s*((?:\(\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+))?/g, (m, layout, data) => {
                const choiceData = data ? parseChoiceData(data) : null;
                const choiceEl = buildChoiceTableElement(layout, choiceData, { allowHtml: true });
                return choiceEl ? choiceEl.outerHTML : m;
            });
            content = content.replace(/\[(굵게|볼드|BOLD|밑줄)([:_])([\s\S]*?)\]/g, (m, style, delim, body) => {
                const tag = style === '밑줄' ? 'u' : 'strong';
                return `<${tag}>${body}</${tag}>`;
            });
            content = replaceConceptBlanksOutsideMath(content);
            content = content.replace(/\[이미지\s*:\s*(.*?)\]/g, (m, label) => getEscapedImagePlaceholderHTML(label));
            content = content.replace(/\[빈칸([:_])(.*?)\]/g, (m, delim, label) => `<span class="blank-box" data-delim="${delim || ':'}" contenteditable="false">${label}</span>`);
            content = content.replace(/\n/g, '<br>');
            let type = 'example'; let bordered = hasStyle('박스'); let bgGray = hasStyle('음영');
            let variant = null;
            if (isLeftConcept) variant = 'left-concept';
            else if (isTopConcept) variant = 'top-concept';
            else if (isTwoColConcept) variant = 'two-col-concept';

            const splitTwoColLabel = (raw = '') => {
                const text = String(raw || '').trim();
                if (!text) return { main: '', sub: '' };
                const idx = text.lastIndexOf('_');
                if (idx < 0) return { main: text, sub: '' };
                return { main: text.slice(0, idx).trim(), sub: text.slice(idx + 1).trim() };
            };

            const safeQLabel = labelPart ? escapeHtml(labelPart) : '';
            let label = safeQLabel ? `<span class="q-label">${safeQLabel}</span>` : '';

            if (variant === 'left-concept') {
                type = 'concept';
            } else if (variant === 'top-concept') {
                type = 'concept';
                const headerLabel = safeQLabel || 'Visual Concept';
                content = `<div class="top-concept-header">${headerLabel}</div><div class="top-concept-body">${content}</div>`;
                label = '';
            } else if (variant === 'two-col-concept') {
                type = 'example';
                const { main, sub } = splitTwoColLabel(labelPart);
                const safeMain = escapeHtml(main);
                const safeSub = escapeHtml(sub);
                const subHtml = safeSub ? `<div class="two-col-concept-sub">${safeSub}</div>` : '';
                content = `<div class="two-col-concept"><div class="two-col-concept-label"><div class="two-col-concept-title">${safeMain || '예제 01'}</div>${subHtml}</div><div class="two-col-concept-body">${content}</div></div>`;
                label = '';
            } else if (hasStyle('개념')) {
                type = 'concept';
            }

            const block = { id: `imp_${Date.now()}${Math.random()}`, type, content: label + ' ' + content, bordered, bgGray };
            if (variant) block.variant = variant;
            blocks.push(block);
        });
        return { blocks, meta };
    }
};
