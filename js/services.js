// Filename: js/services.js
import { State } from './state.js';
import { Utils } from './utils.js';
import { parseChoiceData, parseTableCellData } from './table-parse.js';
import { buildChoiceTableElement, buildEditorTableElement } from './table-elements.js';
import { decodeMathEntities, sanitizeMathTokens } from './math-tokenize.js';
import { buildBoxHtml, buildRectBoxHtml, replaceBoxTokensInHtml } from './box-render.js';
import { replaceTokensOutsideMath } from './token-replace.js';

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
        element.innerHTML = replaceBoxTokensInHtml(element.innerHTML, {
            renderBox: buildBoxHtml,
            renderRectBox: buildRectBoxHtml
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

        let tokensReplaced = true;
        for (let pass = 0; pass < 2 && tokensReplaced; pass++) {
            tokensReplaced = replaceTokensOutsideMath(element, {
                passIndex: pass,
                trackConceptBlanks,
                getImagePlaceholderHTML: Utils.getImagePlaceholderHTML,
                parseTableCellData,
                parseChoiceData,
                buildEditorTableElement,
                buildChoiceTableElement,
                recordConceptBlank: renderer.recordConceptBlank.bind(renderer),
                enqueueConceptBlankIndex: (index) => renderer.conceptBlankMathQueue.push(index)
            });
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

