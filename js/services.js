// Filename: js/services.js
import { State } from './state.js';
import { Utils } from './utils.js';

const toPositiveInt = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const decodeQuotedValue = (rawValue = '') => {
    let value = String(rawValue || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    } else if (value.startsWith('&quot;') && value.endsWith('&quot;')) {
        value = value
            .slice(6, -6)
            .replace(/\\&quot;/g, '"')
            .replace(/&quot;/g, '"')
            .replace(/\\\\/g, '\\');
    }
    return value;
};

const parseTableCellData = (data = '') => {
    const cellMap = new Map();
    if (!data) return cellMap;
    const cellRegex = /\((\d+)x(\d+)_("(?:(?:\\")|(?:\\\\)|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)/g;
    let match;
    while ((match = cellRegex.exec(data)) !== null) {
        const key = `${match[1]}x${match[2]}`;
        cellMap.set(key, decodeQuotedValue(match[3] || ''));
    }
    return cellMap;
};

const parseChoiceData = (data = '') => {
    const choiceMap = new Map();
    if (!data) return choiceMap;
    const choiceRegex = /\((\d+)_("(?:(?:\\")|(?:\\\\)|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)/g;
    let match;
    while ((match = choiceRegex.exec(data)) !== null) {
        const idx = parseInt(match[1], 10);
        if (!Number.isFinite(idx)) continue;
        choiceMap.set(String(idx), decodeQuotedValue(match[2] || ''));
    }
    return choiceMap;
};

const buildEditorTableElement = (rows, cols, cellData = null, options = {}) => {
    const rowCount = toPositiveInt(rows);
    const colCount = toPositiveInt(cols);
    if (!rowCount || !colCount) return null;
    const table = document.createElement('table');
    table.className = 'editor-table';
    table.dataset.rows = rowCount;
    table.dataset.cols = colCount;
    const colgroup = document.createElement('colgroup');
    for (let c = 0; c < colCount; c++) colgroup.appendChild(document.createElement('col'));
    table.appendChild(colgroup);
    const tbody = document.createElement('tbody');
    for (let r = 0; r < rowCount; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < colCount; c++) {
            const td = document.createElement('td');
            td.setAttribute('contenteditable', 'true');
            if (cellData) {
                const key = `${r + 1}x${c + 1}`;
                if (cellData.has(key)) {
                    const value = cellData.get(key);
                    if (options.allowHtml) td.innerHTML = value;
                    else td.textContent = value;
                }
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
};

const buildChoiceTableElement = (layoutToken, choiceData = null, options = {}) => {
    const layout = Utils.normalizeChoiceLayout(layoutToken);
    const grid = Utils.getChoiceLayoutGrid(layout);
    const colCount = Utils.getChoiceColumnCount(layout);
    const table = document.createElement('table');
    table.className = 'choice-table';
    table.dataset.layout = layout;
    const colgroup = document.createElement('colgroup');
    for (let c = 0; c < colCount; c++) colgroup.appendChild(document.createElement('col'));
    table.appendChild(colgroup);
    const tbody = document.createElement('tbody');
    const allowHtml = !!options.allowHtml;
    grid.forEach(rowDef => {
        const tr = document.createElement('tr');
        rowDef.forEach(cellIndex => {
            const td = document.createElement('td');
            td.setAttribute('contenteditable', 'false');
            if (cellIndex > 0) {
                td.className = 'choice-cell';
                td.dataset.choiceIndex = String(cellIndex);
                const label = document.createElement('span');
                label.className = 'choice-label';
                label.textContent = Utils.choiceLabels[cellIndex - 1] || `${cellIndex}.`;
                label.setAttribute('contenteditable', 'false');
                const text = document.createElement('span');
                text.className = 'choice-text';
                text.setAttribute('contenteditable', 'true');
                const value = choiceData ? (choiceData.get(String(cellIndex)) || '') : '';
                if (allowHtml) text.innerHTML = value;
                else text.textContent = value;
                td.appendChild(label);
                td.appendChild(text);
            } else {
                td.className = 'choice-empty';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
};

export const ManualRenderer = {
    mathCache: new Map(),
    isRendering: false,

    async renderAll(callback, options = {}) {
        if (!options.force && State.renderingEnabled === false) return;
        if (!window.isMathJaxReady) { console.log("MathJax Waiting..."); return; }
        if (this.isRendering) return; 
        this.isRendering = true;
        try {
            Utils.showLoading("⚡ 수식 변환 중...");
            const boxes = document.querySelectorAll('.editable-box');
            for (let box of boxes) await this.typesetElement(box);
            if (callback) callback(); 
        } catch(e) { console.error("Render Error:", e); } 
        finally { this.isRendering = false; Utils.hideLoading(); document.dispatchEvent(new Event('preflight:update')); }
    },

    async typesetElement(element) {
        if (element.querySelector('mjx-container') || element.querySelector('.blank-box') || element.querySelector('.image-placeholder')) {
            element.innerHTML = Utils.cleanRichContentToTex(element.innerHTML);
        }
        // [Fix] 에디터에서 직접 타이핑한 블록박스 문법도 렌더링
        const renderBox = (label, bodyHtml) => {
            let body = (bodyHtml || '').trim();
            body = body.replace(/^(<br\s*\/?>)+/gi, '').replace(/(<br\s*\/?>)+$/gi, '');
            body = body.replace(/\n/g, '<br>');
            if (label) {
                const rawLabel = (label || '').trim();
                const safeLabel = rawLabel
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                const isViewLabel = rawLabel === '보기';
                const labelHtml = isViewLabel
                    ? `<div class="box-label view-label">${safeLabel}</div>`
                    : `<div class="box-label">${safeLabel}</div>`;
                return `<div class="custom-box labeled-box" contenteditable="false">${labelHtml}<div class="box-content">${body}</div></div>`;
            }
            return `<div class="custom-box simple-box" contenteditable="false"><div class="box-content">${body}</div></div>`;
        };
        const renderRectBox = (bodyHtml) => {
            let body = (bodyHtml || '').trim();
            body = body.replace(/^(<br\s*\/?>)+/gi, '').replace(/(<br\s*\/?>)+$/gi, '');
            body = body.replace(/\n/g, '<br>');
            return `<div class="rect-box" contenteditable="false"><div class="rect-box-content">${body}</div></div>`;
        };

        const multilineBoxRegex = /\[블록박스_([^\]]*)\]\s*(?::)?\s*([\s\S]*?)\[\/블록박스\]/g;
        element.innerHTML = element.innerHTML.replace(multilineBoxRegex, (m, label, body) => {
            return renderBox((label || '').trim(), body);
        });

        const inlineBoxRegex = /\[블록박스_([^\]]*)\]\s*(?::)?\s*([\s\S]*?)(?=(<br\s*\/?>|<\/div>|<\/p>|$))/gi;
        element.innerHTML = element.innerHTML.replace(inlineBoxRegex, (m, label, body) => {
            const trimmedBody = (body || '').replace(/^\s+/, '');
            if (!trimmedBody.trim()) return m; // 종료 토큰 누락 등은 원문 유지
            return renderBox((label || '').trim(), trimmedBody);
        });

        const multilineRectBoxRegex = /\[블록사각형\]\s*([\s\S]*?)\[\/블록사각형\]/g;
        element.innerHTML = element.innerHTML.replace(multilineRectBoxRegex, (m, body) => {
            return renderRectBox(body);
        });

        // [Fix] 블록박스를 원자적 개체로 유지하고, 불필요한 빈 줄을 제거
        element.querySelectorAll('.custom-box, .rect-box').forEach(boxEl => {
            boxEl.setAttribute('contenteditable', 'false');

            let prev = boxEl.previousSibling;
            while (prev && prev.nodeType === Node.TEXT_NODE && prev.textContent.trim() === '') prev = prev.previousSibling;
            if (prev && prev.nodeType === Node.ELEMENT_NODE && prev.tagName === 'BR') prev.remove();

            let next = boxEl.nextSibling;
            while (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim() === '') next = next.nextSibling;
            while (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === 'BR') {
                const toRemove = next;
                next = next.nextSibling;
                while (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim() === '') next = next.nextSibling;
                toRemove.remove();
            }
        });

        const escapeForMathTex = (value = '') => {
            return value
                .replace(/\\/g, '\\textbackslash ')
                .replace(/([{}#%&_\$])/g, '\\$1')
                .replace(/\^/g, '\\^{}')
                .replace(/~/g, '\\~{}');
        };

        const decodeMathEntities = (value = '') => {
            let text = String(value);
            text = text.replace(/&amp;lt;/g, '&lt;').replace(/&amp;gt;/g, '&gt;');
            text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            return text;
        };

        const sanitizeMathTokens = (tex) => {
            if (!tex) return tex;
            const normalizeMathBlankLabel = (value = '') => {
                return String(value).replace(/\s+/g, ' ').trim();
            };
            const toMathBlankText = (label = '') => {
                const normalized = normalizeMathBlankLabel(label);
                return `\\class{math-blank-box}{\\bbox[border:1.5px solid #000; padding: 3px 12px; background: #fff]{\\text{${escapeForMathTex(normalized)}}}}`;
            };
            const toBoxedText = (label = '') => {
                return `\\boxed{\\text{${escapeForMathTex(label)}}}`;
            };
            tex = tex.replace(/\[빈칸[:_](.*?)\]/g, (m, label) => toMathBlankText(label));
            tex = tex.replace(/\[이미지\s*:\s*(.*?)\]/g, (m, label) => toBoxedText(label));
            return tex;
        };

        const applyTokenReplacementsOutsideMath = (root) => {
            let didReplace = false;
            const mathRegex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g;
            const tokenPattern = /\[빈칸([:_])(.*?)\]|\[이미지\s*:\s*(.*?)\]|\[표_(\d+)x(\d+)\](?:\s*:\s*((?:\(\d+x\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+))?|\[선지_(1행|2행|5행)\](?:\s*:\s*((?:\(\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+))?|\[(굵게|볼드|BOLD|밑줄)([:_])([\s\S]*?)\]|\[블록사각형_([^\]]*?)\]/g;
            const tableDataRegex = /^\s*:\s*((?:\(\d+x\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+)/;
            const choiceDataRegex = /^\s*:\s*((?:\(\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+)/;
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];
            const shouldSkipTokenization = (node) => {
                const parent = node.parentElement;
                if (!parent) return false;
                return !!parent.closest('.image-placeholder');
            };
            while (walker.nextNode()) {
                const node = walker.currentNode;
                if (shouldSkipTokenization(node)) continue;
                textNodes.push(node);
            }

            const createImageFragment = (label) => {
                const container = document.createElement('div');
                container.innerHTML = Utils.getImagePlaceholderHTML(label);
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

            const buildFragmentFromText = (text) => {
                const tokenRegex = new RegExp(tokenPattern.source, 'g');
                const frag = document.createDocumentFragment();
                if (!text) return frag;
                const mathRanges = getMathRanges(text);
                let lastIndex = 0; let m;
                while ((m = tokenRegex.exec(text)) !== null) {
                    if (isIndexInRanges(m.index, mathRanges)) continue;
                    didReplace = true;
                    if (m.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
                    if (m[1] !== undefined) {
                        const span = document.createElement('span');
                        span.className = 'blank-box';
                        span.setAttribute('contenteditable', 'false');
                        span.dataset.delim = m[1] || ':';
                        span.textContent = m[2];
                        frag.appendChild(span);
                    } else if (m[3] !== undefined) {
                        frag.appendChild(createImageFragment(m[3]));
                    } else if (m[4] !== undefined) {
                        let tableData = m[6];
                        if (!tableData) {
                            const after = text.slice(tokenRegex.lastIndex);
                            const dataMatch = after.match(tableDataRegex);
                            if (dataMatch) {
                                tableData = dataMatch[1];
                                tokenRegex.lastIndex += dataMatch[0].length;
                            }
                        }
                        const cellData = tableData ? parseTableCellData(tableData) : null;
                        const tableEl = buildEditorTableElement(m[4], m[5], cellData, { allowHtml: false });
                        if (tableEl) frag.appendChild(tableEl);
                        else frag.appendChild(document.createTextNode(m[0]));
                    } else if (m[7] !== undefined) {
                        let choiceDataText = m[8];
                        if (!choiceDataText) {
                            const after = text.slice(tokenRegex.lastIndex);
                            const dataMatch = after.match(choiceDataRegex);
                            if (dataMatch) {
                                choiceDataText = dataMatch[1];
                                tokenRegex.lastIndex += dataMatch[0].length;
                            }
                        }
                        const choiceData = choiceDataText ? parseChoiceData(choiceDataText) : null;
                        const choiceEl = buildChoiceTableElement(m[7], choiceData, { allowHtml: false });
                        if (choiceEl) frag.appendChild(choiceEl);
                        else frag.appendChild(document.createTextNode(m[0]));
                    } else if (m[9] !== undefined) {
                        const styleType = m[9];
                        const styleText = m[11] || '';
                        const wrapper = styleType === '밑줄' ? document.createElement('u') : document.createElement('strong');
                        wrapper.appendChild(buildFragmentFromText(styleText));
                        frag.appendChild(wrapper);
                    } else if (m[12] !== undefined) {
                        const rectBox = document.createElement('div');
                        rectBox.className = 'rect-box';
                        rectBox.setAttribute('contenteditable', 'false');
                        const rectContent = document.createElement('div');
                        rectContent.className = 'rect-box-content';
                        rectContent.setAttribute('contenteditable', 'false');
                        rectContent.appendChild(buildFragmentFromText(m[12] || ''));
                        rectBox.appendChild(rectContent);
                        frag.appendChild(rectBox);
                    }
                    lastIndex = tokenRegex.lastIndex;
                }
                if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
                return frag;
            };

            for (let node of textNodes) {
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
                    const cellData = parseTableCellData(result.data);
                    if (cellData.size > 0) {
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
                    const choiceData = parseChoiceData(result.data);
                    if (choiceData.size > 0) {
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

        let tokensReplaced = true;
        for (let pass = 0; pass < 2 && tokensReplaced; pass++) {
            tokensReplaced = applyTokenReplacementsOutsideMath(element);
        }

        const regex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        while(walker.nextNode()) textNodes.push(walker.currentNode);

        for (let node of textNodes) {
            const text = node.nodeValue;
            if (!text.match(regex)) continue;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0; regex.lastIndex = 0; let match;
            while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                const fullTex = match[0]; 
                const isDisplay = fullTex.startsWith('$$'); 
                const cleanTex = isDisplay ? fullTex.slice(2, -2) : fullTex.slice(1, -1);
                const decodedTex = decodeMathEntities(cleanTex);
                const preparedTex = sanitizeMathTokens(decodedTex);
                const cacheKey = preparedTex + (isDisplay ? '_D' : '_I');
                let mjxNode = null;

                if (this.mathCache.has(cacheKey)) {
                    mjxNode = this.mathCache.get(cacheKey).cloneNode(true);
                } else {
                    try {
                        mjxNode = await MathJax.tex2svgPromise(preparedTex, { display: isDisplay });
                        if (mjxNode) {
                            mjxNode.setAttribute('data-tex', decodedTex); 
                            mjxNode.setAttribute('display', isDisplay);
                            mjxNode.setAttribute('contenteditable', 'false');
                            mjxNode.classList.add('math-atom');
                            this.mathCache.set(cacheKey, mjxNode.cloneNode(true));
                        }
                    } catch(e) { console.error(e); }
                }
                if (mjxNode) fragment.appendChild(mjxNode);
                else fragment.appendChild(document.createTextNode(fullTex));
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            node.parentNode.replaceChild(fragment, node);
        }
    },
    
    revertToSource(mjxContainer) {
        const tex = mjxContainer.getAttribute('data-tex');
        const isDisplay = mjxContainer.getAttribute('display') === 'true';
        if (tex) mjxContainer.replaceWith(document.createTextNode(isDisplay ? `$$${tex}$$` : `$${tex}$`));
    }
};

export const FileSystem = {
    dirHandle: null,
    async openProjectFolder() {
        if (!window.showDirectoryPicker) { Utils.showToast("브라우저 미지원", "error"); return; }
        try { 
            this.dirHandle = await window.showDirectoryPicker(); 
            const statusEl = document.getElementById('folder-status');
            if (statusEl) {
                statusEl.classList.add('active');
                statusEl.textContent = "✅ 폴더 연결됨 (저장: 폴더)";
            }
            Utils.showToast("폴더가 연결되었습니다.", "success"); 
            if (window.updatePromptDates) window.updatePromptDates();
            this.loadImagesForDisplay(State.docData.blocks); 
        } catch (e) { }
    },
    async saveImage(file) {
        if (!this.dirHandle) { alert("⚠️ 폴더 미연결"); return null; }
        try {
            const folderName = document.getElementById('setting-img-folder').value || 'images';
            const imgDir = await this.dirHandle.getDirectoryHandle(folderName, { create: true });
            const filename = `img_${new Date().toISOString().replace(/[-:T.]/g,'').slice(2,14)}.${file.name.split('.').pop()||'png'}`;
            const fileHandle = await imgDir.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable(); await writable.write(file); await writable.close();
            const savedFile = await fileHandle.getFile();
            return { filename, url: URL.createObjectURL(savedFile), path: `./${folderName}/${filename}` };
        } catch (e) { alert("저장 실패: " + e.message); return null; }
    },
    async loadImagesForDisplay(blocks) {
        if (!this.dirHandle) return;
        const folderName = document.getElementById('setting-img-folder').value || 'images';
        try {
            const imgDir = await this.dirHandle.getDirectoryHandle(folderName);
            for (let block of blocks) {
                if (block.content.includes('<img')) {
                    const div = document.createElement('div'); div.innerHTML = block.content;
                    div.querySelectorAll('img').forEach(async (img) => {
                        const src = img.getAttribute('src');
                        if (src && src.startsWith(`./${folderName}/`)) {
                            try { const fh = await imgDir.getFileHandle(src.split('/').pop()); const f = await fh.getFile(); img.src = URL.createObjectURL(f); } catch (e) { }
                        }
                    });
                    block.content = div.innerHTML;
                }
            }
        } catch (e) { }
    },
    async saveProjectJSON(syncCallback) {
        syncCallback(); // 저장 전 최신 상태 동기화
        const defaultBase = '과정_단원';
        const inputName = prompt('저장 파일 이름', defaultBase);
        if (inputName === null) return;
        let baseName = inputName.trim();
        if (!baseName) baseName = defaultBase;
        baseName = baseName.replace(/\.json$/i, '');
        const safeBase = baseName.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 40);
        const fallbackBase = defaultBase.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 40) || '과정_단원';
        const filename = `${safeBase || fallbackBase}.json`;

        Utils.showLoading("💾 저장 중...");
        
        const rawData = JSON.parse(JSON.stringify(State.docData)); 
        rawData.blocks.forEach(block => {
            block.content = Utils.cleanRichContentToTex(block.content);
            if (block.content.includes('<img')) {
                const div = document.createElement('div'); div.innerHTML = block.content;
                div.querySelectorAll('img').forEach(img => { if (img.dataset.path) img.src = img.dataset.path; });
                block.content = div.innerHTML;
            }
        });

        if (this.dirHandle) {
            try {
                const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable(); await writable.write(JSON.stringify(rawData, null, 2)); await writable.close();
                Utils.hideLoading(); Utils.showToast("저장 완료!", "success");
            } catch(e) { Utils.showToast("저장 실패: " + e.message, "error"); Utils.hideLoading(); }
        } else {
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(rawData, null, 2)], {type:'application/json'})); a.download = filename; a.click(); Utils.hideLoading();
            Utils.showToast("다운로드로 저장되었습니다.", "success");
        }
    }
};

export const ImportParser = {
    parse(text) {
        const blocks = []; const rawItems = text.split('[[').filter(s => s.trim().length > 0);
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
            content = escapeHtml(content);

            const renderBox = (label, body) => {
                const bodyText = (body || '').trim().replace(/\n/g, '<br>');
                const safeLabel = (label || '').trim();
                if (safeLabel) {
                    const isViewLabel = safeLabel === '보기';
                    const labelHtml = isViewLabel
                        ? `<div class="box-label view-label">${safeLabel}</div>`
                        : `<div class="box-label">${safeLabel}</div>`;
                    return `<div class="custom-box labeled-box" contenteditable="false">${labelHtml}<div class="box-content">${bodyText}</div></div>`;
                }
                return `<div class="custom-box simple-box" contenteditable="false"><div class="box-content">${bodyText}</div></div>`;
            };

            const renderRectBox = (body) => {
                const bodyText = (body || '').trim().replace(/\n/g, '<br>');
                return `<div class="rect-box" contenteditable="false"><div class="rect-box-content">${bodyText}</div></div>`;
            };

            const getEscapedImagePlaceholderHTML = (escapedLabelText = '') => {
                const label = (escapedLabelText || '').trim();
                const display = label ? `[이미지: ${label}]` : '이미지 박스';
                return `<span class="image-placeholder" contenteditable="false" data-label="${label}">${display}<button class="image-load-btn" contenteditable="false" tabindex="-1">불러오기</button></span>`;
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
            content = content.replace(/\[이미지\s*:\s*(.*?)\]/g, (m, label) => getEscapedImagePlaceholderHTML(label));
            content = content.replace(/\[빈칸([:_])(.*?)\]/g, (m, delim, label) => `<span class="blank-box" data-delim="${delim || ':'}" contenteditable="false">${label}</span>`);
            content = content.replace(/\n/g, '<br>');
            const [stylePart, labelPart] = meta.includes('_') ? meta.split('_') : ['기본', meta];
            const styles = stylePart.split(',');
            let type = 'example'; let bordered = styles.includes('박스'); let bgGray = styles.includes('음영');
            const safeQLabel = labelPart ? escapeHtml(labelPart) : '';
            let label = safeQLabel ? `<span class="q-label">${safeQLabel}</span>` : '';
            if (styles.includes('개념')) type = 'concept';
            blocks.push({ id: 'imp_' + Date.now() + Math.random(), type: type, content: label + ' ' + content, bordered: bordered, bgGray: bgGray });
        });
        return blocks;
    }
};
