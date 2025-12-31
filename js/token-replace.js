// Filename: js/token-replace.js
/**
 * Replace editor tokens outside math delimiters with DOM elements.
 * @param {HTMLElement} root
 * @param {Object} options
 * @returns {boolean} true when any replacement occurred
 */
export const replaceTokensOutsideMath = (root, options = {}) => {
    const {
        passIndex = 0,
        trackConceptBlanks = true,
        getImagePlaceholderHTML,
        parseTableCellData,
        parseChoiceData,
        buildEditorTableElement,
        buildChoiceTableElement,
        recordConceptBlank,
        enqueueConceptBlankIndex,
        rawEditMap: rawEditMapInput
    } = options;

    let didReplace = false;
    const rawEditMap = rawEditMapInput instanceof Map ? rawEditMapInput : null;
    const mathRegex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g;
    const tokenPattern = /\[개념빈칸([:_])([^\]]*?)\]([\s\S]*?)\[\/개념빈칸\]|\[빈칸([:_])(.*?)\]|\[이미지\s*:\s*(.*?)\]|\[표_(\d+)x(\d+)\](?:\s*:\s*((?:\(\d+x\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+))?|\[선지_(1행|2행|5행)\](?:\s*:\s*((?:\(\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+))?|\[(굵게|볼드|BOLD|밑줄)([:_])([\s\S]*?)\]|\[블록사각형_([^\]]*?)\]/g;
    const conceptTokenRegex = /\[개념빈칸([:_])([^\]]*?)\]([\s\S]*?)\[\/개념빈칸\]/g;
    const tableDataRegex = /^\s*:\s*((?:\(\d+x\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+)/;
    const choiceDataRegex = /^\s*:\s*((?:\(\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+)/;
    const normalizeTextBlankLabel = (value = '') => {
        return String(value).replace(/\s+/g, ' ').trim();
    };
    const nodesToProcess = [];
    const shouldSkipTokenization = (node) => {
        const parent = node.parentElement;
        if (!parent) return false;
        if (parent.closest('.raw-edit')) return true;
        return !!parent.closest('.image-placeholder');
    };
    const getRawEditHtml = (node) => {
        if (!rawEditMap || !node || !node.getAttribute) return '';
        const id = node.getAttribute('data-raw-placeholder');
        if (!id) return '';
        return rawEditMap.get(id) || '';
    };
    const shouldRecordRawEdit = (node) => {
        if (!rawEditMap || !node || node.nodeType !== Node.ELEMENT_NODE) return false;
        const id = node.getAttribute('data-raw-placeholder');
        return !!id && rawEditMap.has(id);
    };
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        {
            acceptNode: (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (shouldSkipTokenization(node)) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
                if (shouldRecordRawEdit(node)) return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_SKIP;
            }
        },
        false
    );
    while (walker.nextNode()) {
        const node = walker.currentNode;
        nodesToProcess.push(node);
    }

    const createImageFragment = (label) => {
        const container = document.createElement('div');
        if (typeof getImagePlaceholderHTML === 'function') {
            container.innerHTML = getImagePlaceholderHTML(label);
        } else {
            container.textContent = label ? `[이미지: ${label}]` : '이미지 박스';
        }
        const frag = document.createDocumentFragment();
        Array.from(container.childNodes).forEach(child => frag.appendChild(child));
        return frag;
    };

    const getMathRanges = (text) => {
        const ranges = [];
        if (!text) return ranges;
        mathRegex.lastIndex = 0;
        let m;
        while ((m = mathRegex.exec(text)) !== null) {
            ranges.push([m.index, mathRegex.lastIndex]);
        }
        return ranges;
    };

    const isIndexInRanges = (index, ranges) => {
        return ranges.some(([start, end]) => index >= start && index < end);
    };
    const recordRawEditConceptBlanks = (rawHtml = '') => {
        if (!trackConceptBlanks || typeof recordConceptBlank !== 'function') return;
        const html = String(rawHtml || '');
        if (!html) return;
        const ranges = getMathRanges(html);
        conceptTokenRegex.lastIndex = 0;
        let m;
        while ((m = conceptTokenRegex.exec(html)) !== null) {
            const body = m[3] || '';
            const isMath = isIndexInRanges(m.index, ranges);
            recordConceptBlank(body, { isMath });
        }
    };

    const buildFragmentFromText = (text) => {
        const tokenRegex = new RegExp(tokenPattern.source, 'g');
        const frag = document.createDocumentFragment();
        if (!text) return frag;
        const mathRanges = getMathRanges(text);
        let lastIndex = 0; let m;
        while ((m = tokenRegex.exec(text)) !== null) {
            const insideMath = isIndexInRanges(m.index, mathRanges);
            if (insideMath) {
                if (passIndex === 0 && m[1] !== undefined && trackConceptBlanks && typeof recordConceptBlank === 'function') {
                    const body = m[3] || '';
                    const index = recordConceptBlank(body, { isMath: true });
                    if (typeof enqueueConceptBlankIndex === 'function') {
                        enqueueConceptBlankIndex(index);
                    }
                }
                continue;
            }
            didReplace = true;
            if (m.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
            if (m[1] !== undefined) {
                const rawLabel = m[2];
                const body = m[3] || '';
                const index = trackConceptBlanks && typeof recordConceptBlank === 'function'
                    ? recordConceptBlank(body, { isMath: false })
                    : normalizeTextBlankLabel(rawLabel || '#');
                const span = document.createElement('span');
                span.className = 'blank-box concept-blank-box';
                span.setAttribute('contenteditable', 'false');
                span.dataset.blankKind = 'concept';
                if (rawLabel !== undefined) span.dataset.rawLabel = rawLabel;
                span.dataset.delim = m[1] || ':';
                span.dataset.answer = body;
                span.dataset.index = String(index);
                span.textContent = `(${index})`;
                frag.appendChild(span);
            } else if (m[4] !== undefined) {
                const span = document.createElement('span');
                span.className = 'blank-box';
                span.setAttribute('contenteditable', 'false');
                span.dataset.delim = m[4] || ':';
                span.textContent = m[5];
                frag.appendChild(span);
            } else if (m[6] !== undefined) {
                frag.appendChild(createImageFragment(m[6]));
            } else if (m[7] !== undefined) {
                let tableData = m[9];
                if (!tableData) {
                    const after = text.slice(tokenRegex.lastIndex);
                    const dataMatch = after.match(tableDataRegex);
                    if (dataMatch) {
                        tableData = dataMatch[1];
                        tokenRegex.lastIndex += dataMatch[0].length;
                    }
                }
                const cellData = typeof parseTableCellData === 'function' && tableData ? parseTableCellData(tableData) : null;
                const tableEl = typeof buildEditorTableElement === 'function'
                    ? buildEditorTableElement(m[7], m[8], cellData, { allowHtml: false })
                    : null;
                if (tableEl) frag.appendChild(tableEl);
                else frag.appendChild(document.createTextNode(m[0]));
            } else if (m[10] !== undefined) {
                let choiceDataText = m[11];
                if (!choiceDataText) {
                    const after = text.slice(tokenRegex.lastIndex);
                    const dataMatch = after.match(choiceDataRegex);
                    if (dataMatch) {
                        choiceDataText = dataMatch[1];
                        tokenRegex.lastIndex += dataMatch[0].length;
                    }
                }
                const choiceData = typeof parseChoiceData === 'function' && choiceDataText ? parseChoiceData(choiceDataText) : null;
                const choiceEl = typeof buildChoiceTableElement === 'function'
                    ? buildChoiceTableElement(m[10], choiceData, { allowHtml: false })
                    : null;
                if (choiceEl) frag.appendChild(choiceEl);
                else frag.appendChild(document.createTextNode(m[0]));
            } else if (m[12] !== undefined) {
                const styleType = m[12];
                const styleText = m[14] || '';
                const wrapper = styleType === '밑줄' ? document.createElement('u') : document.createElement('strong');
                wrapper.appendChild(buildFragmentFromText(styleText));
                frag.appendChild(wrapper);
            } else if (m[15] !== undefined) {
                const rectBox = document.createElement('div');
                rectBox.className = 'rect-box';
                rectBox.setAttribute('contenteditable', 'false');
                const rectContent = document.createElement('div');
                rectContent.className = 'rect-box-content';
                rectContent.setAttribute('contenteditable', 'true');
                rectContent.appendChild(buildFragmentFromText(m[15] || ''));
                rectBox.appendChild(rectContent);
                frag.appendChild(rectBox);
            }
            lastIndex = tokenRegex.lastIndex;
        }
        if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        return frag;
    };

    for (let node of nodesToProcess) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            recordRawEditConceptBlanks(getRawEditHtml(node));
            continue;
        }
        const text = node.nodeValue;
        if (!text) continue;
        const hasToken = new RegExp(tokenPattern.source, 'g').test(text);
        if (!hasToken) continue;
        const frag = buildFragmentFromText(text);
        node.parentNode.replaceChild(frag, node);
    }

    const absorbTrailingTableData = () => {
        const parseTrailingData = (text, regex) => {
            const match = text.match(regex);
            if (!match) return null;
            return { data: match[1], length: match[0].length };
        };
        root.querySelectorAll('table.editor-table').forEach(table => {
            let next = table.nextSibling;
            while (next && next.nodeType === Node.TEXT_NODE && next.nodeValue.trim() === '') next = next.nextSibling;
            if (!next || next.nodeType !== Node.TEXT_NODE) return;
            const result = parseTrailingData(next.nodeValue, tableDataRegex);
            if (!result) return;
            const cellData = typeof parseTableCellData === 'function' ? parseTableCellData(result.data) : null;
            if (cellData && cellData.size > 0) {
                cellData.forEach((value, key) => {
                    const [r, c] = key.split('x').map(v => parseInt(v, 10) - 1);
                    const row = table.rows[r];
                    if (!row) return;
                    const cell = row.cells[c];
                    if (!cell) return;
                    cell.textContent = value;
                });
            }
            next.nodeValue = next.nodeValue.slice(result.length);
            if (next.nodeValue.trim() === '') next.remove();
            didReplace = true;
        });
        root.querySelectorAll('table.choice-table').forEach(table => {
            let next = table.nextSibling;
            while (next && next.nodeType === Node.TEXT_NODE && next.nodeValue.trim() === '') next = next.nextSibling;
            if (!next || next.nodeType !== Node.TEXT_NODE) return;
            const result = parseTrailingData(next.nodeValue, choiceDataRegex);
            if (!result) return;
            const choiceData = typeof parseChoiceData === 'function' ? parseChoiceData(result.data) : null;
            if (choiceData && choiceData.size > 0) {
                table.querySelectorAll('td[data-choice-index]').forEach(cell => {
                    const idx = cell.dataset.choiceIndex;
                    const textEl = cell.querySelector('.choice-text');
                    if (!textEl) return;
                    textEl.textContent = choiceData.get(String(idx)) || '';
                });
            }
            next.nodeValue = next.nodeValue.slice(result.length);
            if (next.nodeValue.trim() === '') next.remove();
            didReplace = true;
        });
    };
    absorbTrailingTableData();
    return didReplace;
};
