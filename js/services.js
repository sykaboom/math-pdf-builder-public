// Filename: js/services.js
import { State } from './state.js';
import { Utils } from './utils.js';
import { parseChoiceData, parseTableCellData } from './table-parse.js';
import { buildChoiceTableElement, buildEditorTableElement } from './table-elements.js';
import { decodeMathEntities, sanitizeMathTokens } from './math-tokenize.js';
import { buildBoxHtml, buildRectBoxHtml, replaceBoxTokensInHtml } from './box-render.js';
import { replaceTokensOutsideMath } from './token-replace.js';
import { buildMathFragmentFromText } from './math-render.js';
import { recordConceptBlank, resetConceptBlankTracking, syncConceptBlankAnswers } from './concept-blank.js';
import { buildImageFilename, buildProjectSaveData, buildSafeProjectFilename, getImageFolderName } from './file-helpers.js';

export const ManualRenderer = {
    mathCache: new Map(),
    isRendering: false,
    conceptBlankCounter: 0,
    conceptBlankAnswers: [],
    conceptBlankAnswersIsMath: [],
    conceptBlankMathQueue: [],

    resetConceptBlankTracking() {
        resetConceptBlankTracking(this);
    },

    recordConceptBlank(rawAnswer = '', options = {}) {
        return recordConceptBlank(this, rawAnswer, options);
    },

    syncConceptBlankAnswers() {
        return syncConceptBlankAnswers(this, State);
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

        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        while(walker.nextNode()) textNodes.push(walker.currentNode);

        for (let node of textNodes) {
            const text = node.nodeValue;
            if (!text || (!text.includes('$') && !text.includes('$$'))) continue;
            const fragment = await buildMathFragmentFromText(text, {
                decodeMathEntities,
                sanitizeMathTokens,
                trackConceptBlanks,
                getConceptBlankIndex: getConceptBlankIndexForMath,
                mathCache: this.mathCache,
                tex2svgPromise: MathJax.tex2svgPromise
            });
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
            const folderName = getImageFolderName();
            const imgDir = await this.dirHandle.getDirectoryHandle(folderName, { create: true });
            const filename = buildImageFilename(file);
            const fileHandle = await imgDir.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable(); await writable.write(file); await writable.close();
            const savedFile = await fileHandle.getFile();
            return { filename, url: URL.createObjectURL(savedFile), path: `./${folderName}/${filename}` };
        } catch (e) { alert("저장 실패: " + e.message); return null; }
    },
    async loadImagesForDisplay(blocks) {
        if (!this.dirHandle) return;
        const folderName = getImageFolderName();
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
        const filename = buildSafeProjectFilename(inputName, defaultBase);

        Utils.showLoading("💾 저장 중...");
        
        const rawData = buildProjectSaveData(State.docData, State.settings, {
            cleanContent: Utils.cleanRichContentToTex
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

