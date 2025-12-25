// Filename: js/import-parser.js
import { parseChoiceData, parseTableCellData } from './table-parse.js';
import { buildChoiceTableElement, buildEditorTableElement } from './table-elements.js';

export const ImportParser = {
    parse(text) {
        const blocks = [];
        const rawItems = text.split('[[').filter(s => s.trim().length > 0);
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
            const meta = chunk.substring(0, closeIdx); let content = chunk.substring(closeIdx + 2).trim();
            if (content.startsWith(':')) content = content.substring(1).trim();
            const metaClean = meta.trim();
            const [stylePart, labelPart] = metaClean.includes('_') ? metaClean.split('_') : ['기본', metaClean];
            const styles = stylePart.split(',');
            const labelTrim = (labelPart || '').trim();
            const hasStyle = (name) => styles.some(style => style.trim() === name);
            const isConceptBlock = hasStyle('개념')
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
                const safeLabel = (label || '').trim();
                if (safeLabel) {
                    const isViewLabel = safeLabel === '보기';
                    const labelHtml = isViewLabel
                        ? `<div class="box-label view-label" contenteditable="false">${safeLabel}</div>`
                        : `<div class="box-label" contenteditable="false">${safeLabel}</div>`;
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
            content = content.replace(/\[개념빈칸([:_])([^\]]*?)\]([\s\S]*?)\[\/개념빈칸\]/g, (m, delim, label, body) => {
                const rawLabel = label !== undefined ? label : '#';
                return getConceptBlankPlaceholderHTML(rawLabel, body || '', delim);
            });
            content = content.replace(/\[이미지\s*:\s*(.*?)\]/g, (m, label) => getEscapedImagePlaceholderHTML(label));
            content = content.replace(/\[빈칸([:_])(.*?)\]/g, (m, delim, label) => `<span class="blank-box" data-delim="${delim || ':'}" contenteditable="false">${label}</span>`);
            content = content.replace(/\n/g, '<br>');
            let type = 'example'; let bordered = hasStyle('박스'); let bgGray = hasStyle('음영');
            const safeQLabel = labelPart ? escapeHtml(labelPart) : '';
            let label = safeQLabel ? `<span class="q-label">${safeQLabel}</span>` : '';
            if (hasStyle('개념')) type = 'concept';
            blocks.push({ id: `imp_${Date.now()}${Math.random()}`, type, content: label + ' ' + content, bordered, bgGray });
        });
        return blocks;
    }
};
