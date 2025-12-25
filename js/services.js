// Filename: js/services.js
import { State } from './state.js';
import { Utils } from './utils.js';
import { parseChoiceData, parseTableCellData } from './table-parse.js';
import { buildChoiceTableElement, buildEditorTableElement } from './table-elements.js';
import { decodeMathEntities, sanitizeMathTokens } from './math-tokenize.js';

export const ManualRenderer = {
    mathCache: new Map(),
    isRendering: false,
    conceptBlankCounter: 0,
    conceptBlankAnswers: [],
    conceptBlankAnswersIsMath: [],
    conceptBlankMathQueue: [],

    resetConceptBlankTracking() {
        this.conceptBlankCounter = 0;
        this.conceptBlankAnswers = [];
        this.conceptBlankAnswersIsMath = [];
        this.conceptBlankMathQueue = [];
    },

    recordConceptBlank(rawAnswer = '', options = {}) {
        const isMath = options && options.isMath === true;
        const tmp = document.createElement('div');
        tmp.innerHTML = String(rawAnswer);
        const normalized = (tmp.textContent || '').replace(/\u00A0/g, ' ');
        this.conceptBlankCounter += 1;
        this.conceptBlankAnswers.push(normalized);
        this.conceptBlankAnswersIsMath.push(isMath);
        return this.conceptBlankCounter;
    },

    syncConceptBlankAnswers() {
        const nextAnswers = this.conceptBlankAnswers.slice();
        const nextIsMath = this.conceptBlankAnswersIsMath.slice();
        const nextHash = JSON.stringify({ answers: nextAnswers, isMath: nextIsMath });
        const hasAnswerBlocks = Array.isArray(State.docData.blocks)
            && State.docData.blocks.some(block => block.derived === 'concept-answers');
        if (nextHash === State.conceptBlankAnswersHash && (hasAnswerBlocks || nextAnswers.length === 0)) return false;
        State.conceptBlankAnswers = nextAnswers;
        State.conceptBlankAnswersIsMath = nextIsMath;
        State.conceptBlankAnswersHash = nextHash;
        return true;
    },

    async renderAll(callback, options = {}) {
        if (!options.force && State.renderingEnabled === false) return;
        if (!window.isMathJaxReady) { return; }
        if (this.isRendering) return; 
        this.isRendering = true;
        this.resetConceptBlankTracking();
        try {
            Utils.showLoading("⚡ 수식 변환 중...");
            const boxes = document.querySelectorAll('.editable-box');
            for (let box of boxes) {
                const wrap = box.closest('.block-wrapper');
                const isDerivedAnswer = wrap && wrap.dataset && wrap.dataset.derived === 'concept-answers';
                await this.typesetElement(box, { trackConceptBlanks: !isDerivedAnswer });
            }
            if (callback) callback(); 
        } catch(e) { console.error("Render Error:", e); } 
        finally {
            this.isRendering = false;
            Utils.hideLoading();
            if (!options.skipConceptBlankSync) {
                const conceptChanged = this.syncConceptBlankAnswers();
                if (conceptChanged) document.dispatchEvent(new Event('conceptblanks:update'));
            }
            document.dispatchEvent(new Event('preflight:update'));
        }
    },

    async typesetElement(element, options = {}) {
        if (element.querySelector('mjx-container') || element.querySelector('.blank-box') || element.querySelector('.image-placeholder')) {
            element.innerHTML = Utils.cleanRichContentToTex(element.innerHTML);
        }
        const renderer = this;
        const trackConceptBlanks = options.trackConceptBlanks !== false;
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

        const getConceptBlankIndexForMath = (answerText = '') => {
            if (renderer.conceptBlankMathQueue.length) return renderer.conceptBlankMathQueue.shift();
            return renderer.recordConceptBlank(answerText, { isMath: true });
        };

        const applyTokenReplacementsOutsideMath = (root, options = {}) => {
            let didReplace = false;
            const passIndex = Number.isFinite(options.passIndex) ? options.passIndex : 0;
            const mathRegex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g;
            const tokenPattern = /\[개념빈칸([:_])([^\]]*?)\]([\s\S]*?)\[\/개념빈칸\]|\[빈칸([:_])(.*?)\]|\[이미지\s*:\s*(.*?)\]|\[표_(\d+)x(\d+)\](?:\s*:\s*((?:\(\d+x\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+))?|\[선지_(1행|2행|5행)\](?:\s*:\s*((?:\(\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+))?|\[(굵게|볼드|BOLD|밑줄)([:_])([\s\S]*?)\]|\[블록사각형_([^\]]*?)\]/g;
            const tableDataRegex = /^\s*:\s*((?:\(\d+x\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+)/;
            const choiceDataRegex = /^\s*:\s*((?:\(\d+_(?:"(?:\\.|[^"])*"|&quot;[\s\S]*?&quot;|[^)]*)\)\s*,?\s*)+)/;
            const normalizeTextBlankLabel = (value = '') => {
                return String(value).replace(/\s+/g, ' ').trim();
            };
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
                    const insideMath = isIndexInRanges(m.index, mathRanges);
                    if (insideMath) {
                        if (passIndex === 0 && m[1] !== undefined && trackConceptBlanks) {
                            const body = m[3] || '';
                            const index = renderer.recordConceptBlank(body, { isMath: true });
                            renderer.conceptBlankMathQueue.push(index);
                        }
                        continue;
                    }
                    didReplace = true;
                    if (m.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
                    if (m[1] !== undefined) {
                        const rawLabel = m[2];
                        const body = m[3] || '';
                        const index = trackConceptBlanks
                            ? renderer.recordConceptBlank(body, { isMath: false })
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
                        const cellData = tableData ? parseTableCellData(tableData) : null;
                        const tableEl = buildEditorTableElement(m[7], m[8], cellData, { allowHtml: false });
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
                        const choiceData = choiceDataText ? parseChoiceData(choiceDataText) : null;
                        const choiceEl = buildChoiceTableElement(m[10], choiceData, { allowHtml: false });
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
                        rectContent.setAttribute('contenteditable', 'false');
                        rectContent.appendChild(buildFragmentFromText(m[15] || ''));
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
            tokensReplaced = applyTokenReplacementsOutsideMath(element, { passIndex: pass });
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
                const preparedTex = sanitizeMathTokens(decodedTex, {
                    trackConceptBlanks,
                    getConceptBlankIndex: getConceptBlankIndexForMath
                });
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
        
        const rawData = {
            data: JSON.parse(JSON.stringify(State.docData)),
            settings: JSON.parse(JSON.stringify(State.settings))
        };
        rawData.data.blocks.forEach(block => {
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

