// Filename: js/services.js
import { State } from './state.js';
import { Utils } from './utils.js';
import { parseChoiceData, parseTableCellData } from './table-parse.js';
import { buildChoiceTableElement, buildEditorTableElement } from './table-elements.js';
import { decodeMathEntities, sanitizeMathTokens, applyMathDisplayRules } from './math-tokenize.js';
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
        const rawEdits = [];
        const stashRawEdits = () => {
            const nodes = Array.from(element.querySelectorAll('.raw-edit'));
            if (!nodes.length) return;
            nodes.forEach((node, idx) => {
                const id = String(idx);
                rawEdits.push({ id, html: node.outerHTML });
                const placeholder = document.createElement('span');
                placeholder.dataset.rawPlaceholder = id;
                node.replaceWith(placeholder);
            });
        };
        const restoreRawEdits = () => {
            rawEdits.forEach(({ id, html }) => {
                const placeholder = element.querySelector(`[data-raw-placeholder="${id}"]`);
                if (!placeholder) return;
                const container = document.createElement('div');
                container.innerHTML = html;
                const restored = container.firstChild;
                if (restored) placeholder.replaceWith(restored);
                else placeholder.remove();
            });
        };
        const renderer = this;
        const trackConceptBlanks = options.trackConceptBlanks !== false;
        const recordRawEditConceptBlanks = () => {
            if (!trackConceptBlanks || rawEdits.length === 0) return;
            const conceptRegex = /\[개념빈칸([:_])([^\]]*?)\]([\s\S]*?)\[\/개념빈칸\]/g;
            const mathRegex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g;
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
            rawEdits.forEach(({ html }) => {
                const ranges = getMathRanges(html);
                conceptRegex.lastIndex = 0;
                let m;
                while ((m = conceptRegex.exec(html)) !== null) {
                    const body = m[3] || '';
                    const isMath = isIndexInRanges(m.index, ranges);
                    renderer.recordConceptBlank(body, { isMath });
                }
            });
        };
        stashRawEdits();
        recordRawEditConceptBlanks();
        if (element.querySelector('mjx-container') || element.querySelector('.blank-box') || element.querySelector('.image-placeholder')) {
            element.innerHTML = Utils.cleanRichContentToTex(element.innerHTML);
        }
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
                applyMathDisplayRules,
                trackConceptBlanks,
                getConceptBlankIndex: getConceptBlankIndexForMath,
                mathCache: this.mathCache,
                tex2svgPromise: MathJax.tex2svgPromise
            });
            node.parentNode.replaceChild(fragment, node);
        }
        if (rawEdits.length) restoreRawEdits();
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
            this.loadImagesForDisplay(State.docData.blocks, State.docData.toc); 
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
    async loadImagesForDisplay(blocks, toc) {
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
            const loadTocImage = async (imageRef, selector) => {
                if (!imageRef || !imageRef.path) return;
                const src = imageRef.path;
                if (!src || !src.startsWith(`./${folderName}/`)) return;
                try {
                    const fh = await imgDir.getFileHandle(src.split('/').pop());
                    const f = await fh.getFile();
                    const url = URL.createObjectURL(f);
                    imageRef.src = url;
                    const tocImg = document.querySelector(selector);
                    if (tocImg) tocImg.src = url;
                } catch (e) { }
            };
            if (toc) {
                await loadTocImage(toc.headerImage, '.toc-bg-image');
                await loadTocImage(toc.headerOverlayImage, '.toc-overlay-image');
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

