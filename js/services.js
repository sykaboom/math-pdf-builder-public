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
import { buildSourceDataFromDocData, normalizeSourceData } from './source-data.js';
import { ZipUtils } from './zip-utils.js';

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
        const rawEditMap = new Map();
        const stashRawEdits = () => {
            const nodes = Array.from(element.querySelectorAll('.raw-edit'));
            if (!nodes.length) return;
            nodes.forEach((node, idx) => {
                const id = String(idx);
                rawEdits.push({ id, html: node.outerHTML });
                rawEditMap.set(id, node.outerHTML);
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
        stashRawEdits();
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
                rawEditMap,
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
            const loadLayoutImage = async (imageRef, selector) => {
                if (!imageRef || !imageRef.path) return;
                const src = imageRef.path;
                if (!src || !src.startsWith(`./${folderName}/`)) return;
                try {
                    const fh = await imgDir.getFileHandle(src.split('/').pop());
                    const f = await fh.getFile();
                    const url = URL.createObjectURL(f);
                    imageRef.src = url;
                    document.querySelectorAll(selector).forEach(img => { img.src = url; });
                } catch (e) { }
            };
            const headerFooter = State.docData?.headerFooter;
            await loadLayoutImage(headerFooter?.header?.image, '.header-footer-image.header-image');
            await loadLayoutImage(headerFooter?.footer?.image, '.header-footer-image.footer-image');
        } catch (e) { }
    },
    async saveProjectPackage(syncCallback) {
        syncCallback(); // 저장 전 최신 상태 동기화
        const defaultBase = '과정_단원';
        const inputName = prompt('저장 파일 이름', defaultBase);
        if (inputName === null) return;
        const filename = buildSafeProjectFilename(inputName, defaultBase, PACKAGE_EXTENSION);

        Utils.showLoading("💾 저장 중...");

        const rawData = buildProjectSaveData(State.docData, State.settings, {
            cleanContent: Utils.cleanRichContentToTex
        });
        const sourceData = buildSourceDataFromDocData(State.docData);
        const assetBundle = await collectPackageAssets(State.docData, this.dirHandle);
        remapImageRefs(rawData.data, assetBundle.map);

        const manifest = {
            schemaVersion: 1,
            packageType: 'msk',
            createdBy: 'math-pdf-builder',
            createdAt: new Date().toISOString(),
            entry: {
                content: 'content.json',
                source: 'source.json'
            },
            assetRoot: PACKAGE_ASSET_ROOT,
            contentSchemaVersion: 1,
            sourceSchemaVersion: sourceData.schemaVersion || 1
        };

        const entries = [
            { path: 'manifest.json', data: encodeJson(manifest) },
            { path: 'content.json', data: encodeJson(rawData) },
            { path: 'source.json', data: encodeJson(sourceData) },
            ...assetBundle.entries
        ];
        const zipBytes = ZipUtils.buildZip(entries);
        const blob = new Blob([zipBytes], { type: 'application/zip' });

        if (this.dirHandle) {
            try {
                const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                Utils.hideLoading();
                Utils.showToast("저장 완료!", "success");
            } catch(e) {
                Utils.showToast("저장 실패: " + e.message, "error");
                Utils.hideLoading();
            }
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            Utils.hideLoading();
            Utils.showToast("다운로드로 저장되었습니다.", "success");
        }

        if (assetBundle.missing.length > 0) {
            Utils.showToast(`이미지 ${assetBundle.missing.length}개가 포함되지 않았습니다.`, "info", 3000);
        }
    },

    async saveProjectJSON(syncCallback) {
        return this.saveProjectPackage(syncCallback);
    },

    async readProjectPackage(file) {
        const buffer = await file.arrayBuffer();
        const zipEntries = ZipUtils.readZip(buffer);
        const manifestBytes = zipEntries.get('manifest.json');
        if (!manifestBytes) throw new Error('manifest.json을 찾을 수 없습니다.');
        const manifest = decodeJson(manifestBytes);
        if (manifest.packageType && manifest.packageType !== 'msk') {
            throw new Error('지원하지 않는 파일 형식입니다.');
        }
        const contentPath = manifest?.entry?.content || 'content.json';
        const sourcePath = manifest?.entry?.source || 'source.json';
        const contentBytes = zipEntries.get(contentPath);
        if (!contentBytes) throw new Error('content.json을 찾을 수 없습니다.');
        const content = decodeJson(contentBytes);
        const sourceBytes = zipEntries.get(sourcePath);
        const source = sourceBytes ? normalizeSourceData(decodeJson(sourceBytes)) : null;
        const assetRoot = manifest?.assetRoot || PACKAGE_ASSET_ROOT;
        const assets = new Map();
        zipEntries.forEach((value, key) => {
            if (key.startsWith(`${assetRoot}/`)) assets.set(normalizeAssetKey(key), value);
        });
        return { manifest, content, source, assets };
    },

    applyPackageAssets(docData, assetEntries) {
        const urlMap = buildAssetUrlMap(assetEntries);
        applyAssetUrlsToDocData(docData, urlMap);
        return urlMap;
    }
};

const PACKAGE_EXTENSION = '.msk';
const PACKAGE_ASSET_ROOT = 'assets';
const PACKAGE_IMAGE_DIR = `${PACKAGE_ASSET_ROOT}/images`;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const encodeJson = (value) => TEXT_ENCODER.encode(JSON.stringify(value, null, 2));
const decodeJson = (bytes) => JSON.parse(TEXT_DECODER.decode(bytes));

const normalizeAssetKey = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
    return raw.replace(/^\.\//, '');
};

const getBaseName = (value) => normalizeAssetKey(value).split('/').pop() || '';

const guessExtensionFromMime = (mime = '') => {
    const normalized = String(mime || '').toLowerCase();
    if (normalized.includes('png')) return 'png';
    if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
    if (normalized.includes('gif')) return 'gif';
    if (normalized.includes('webp')) return 'webp';
    if (normalized.includes('svg')) return 'svg';
    if (normalized.includes('bmp')) return 'bmp';
    return 'png';
};

const guessMimeFromExtension = (ext = '') => {
    const normalized = String(ext || '').toLowerCase();
    if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
    if (normalized === 'gif') return 'image/gif';
    if (normalized === 'webp') return 'image/webp';
    if (normalized === 'svg') return 'image/svg+xml';
    if (normalized === 'bmp') return 'image/bmp';
    return 'image/png';
};

const decodeDataUrl = (dataUrl) => {
    const raw = String(dataUrl || '');
    const match = raw.match(/^data:([^;]+)(;base64)?,(.*)$/);
    if (!match) return null;
    const mime = match[1] || 'image/png';
    const isBase64 = !!match[2];
    const data = match[3] || '';
    if (isBase64) {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return { bytes, ext: guessExtensionFromMime(mime) };
    }
    const decoded = decodeURIComponent(data);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    return { bytes, ext: guessExtensionFromMime(mime) };
};

const readFileBytesFromHandle = async (dirHandle, relPath) => {
    const cleanPath = normalizeAssetKey(relPath);
    if (!dirHandle || !cleanPath) return null;
    const parts = cleanPath.split('/').filter(Boolean);
    let dir = dirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
};

const ensureUniqueName = (baseName, ext, used) => {
    const safeExt = ext ? `.${ext}` : '';
    let name = baseName || `asset_${Date.now()}`;
    if (!name.toLowerCase().endsWith(safeExt)) name = `${name}${safeExt}`;
    let finalName = name;
    let i = 2;
    while (used.has(finalName)) {
        const stem = name.replace(/\.[^/.]+$/, '');
        finalName = `${stem}_${i}${safeExt}`;
        i += 1;
    }
    used.add(finalName);
    return finalName;
};

const extractImageRefsFromHtml = (html, refs) => {
    if (!html || !html.includes('<img')) return;
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('img').forEach(img => {
        const dataPath = img.getAttribute('data-path') || img.dataset.path;
        const src = img.getAttribute('src');
        const srcKey = normalizeAssetKey(src);
        if (srcKey.startsWith('data:') || srcKey.startsWith('blob:')) {
            refs.push({ ref: src, kind: 'src' });
            return;
        }
        if (dataPath) refs.push({ ref: dataPath, kind: 'path' });
        else if (src) refs.push({ ref: src, kind: 'src' });
    });
};

const collectPackageAssets = async (docData, dirHandle) => {
    const refs = [];
    const data = docData && typeof docData === 'object' ? docData : {};
    const blocks = Array.isArray(data.blocks) ? data.blocks : [];
    blocks.forEach(block => extractImageRefsFromHtml(block.content, refs));

    const headerFooter = data.headerFooter || {};
    const pushImageRef = (imageRef) => {
        if (!imageRef) return;
        const srcKey = normalizeAssetKey(imageRef.src);
        if (srcKey.startsWith('data:') || srcKey.startsWith('blob:')) {
            refs.push({ ref: imageRef.src, kind: 'src' });
            return;
        }
        if (imageRef.path) refs.push({ ref: imageRef.path, kind: 'path' });
        else if (imageRef.src) refs.push({ ref: imageRef.src, kind: 'src' });
    };
    pushImageRef(headerFooter.header?.image);
    pushImageRef(headerFooter.footer?.image);

    const toc = data.toc || {};
    pushImageRef(toc.headerImage);
    pushImageRef(toc.headerOverlayImage);

    const map = new Map();
    const entries = [];
    const missing = [];
    const usedNames = new Set();

    for (const item of refs) {
        const key = normalizeAssetKey(item.ref);
        if (!key || map.has(key)) continue;
        let bytes = null;
        let ext = '';
        if (key.startsWith('data:')) {
            const decoded = decodeDataUrl(key);
            if (decoded) {
                bytes = decoded.bytes;
                ext = decoded.ext;
            }
        } else if (key.startsWith('blob:')) {
            try {
                const response = await fetch(key);
                const blob = await response.blob();
                const buffer = await blob.arrayBuffer();
                bytes = new Uint8Array(buffer);
                ext = guessExtensionFromMime(blob.type);
            } catch (e) {
                bytes = null;
            }
        } else {
            try {
                bytes = await readFileBytesFromHandle(dirHandle, key);
                const fileName = getBaseName(key);
                ext = fileName.split('.').pop() || 'png';
            } catch (e) {
                bytes = null;
            }
        }
        if (!bytes) {
            missing.push(key);
            continue;
        }
        const baseName = getBaseName(key).replace(/\.[^/.]+$/, '') || `image_${entries.length + 1}`;
        const fileName = ensureUniqueName(baseName, ext, usedNames);
        const assetPath = `${PACKAGE_IMAGE_DIR}/${fileName}`;
        map.set(key, assetPath);
        entries.push({ path: assetPath, data: bytes });
    }

    return { entries, map, missing };
};

const remapImageRefs = (docData, map) => {
    if (!map || map.size === 0) return;
    const data = docData && typeof docData === 'object' ? docData : {};
    const blocks = Array.isArray(data.blocks) ? data.blocks : [];
    blocks.forEach(block => {
        if (!block.content || !block.content.includes('<img')) return;
        const div = document.createElement('div');
        div.innerHTML = block.content;
        div.querySelectorAll('img').forEach(img => {
            const dataPath = img.getAttribute('data-path') || img.dataset.path;
            const src = img.getAttribute('src');
            const dataKey = dataPath ? normalizeAssetKey(dataPath) : '';
            const srcKey = src ? normalizeAssetKey(src) : '';
            const mapped = map.get(dataKey) || map.get(srcKey);
            if (mapped) {
                img.setAttribute('data-path', mapped);
                img.dataset.path = mapped;
                img.setAttribute('src', mapped);
            }
        });
        block.content = div.innerHTML;
    });

    const applyImageRef = (imageRef) => {
        if (!imageRef) return;
        const pathKey = normalizeAssetKey(imageRef.path);
        const srcKey = normalizeAssetKey(imageRef.src);
        const mapped = map.get(pathKey) || map.get(srcKey);
        if (mapped) {
            imageRef.path = mapped;
            imageRef.src = mapped;
        }
    };

    const headerFooter = data.headerFooter || {};
    applyImageRef(headerFooter.header?.image);
    applyImageRef(headerFooter.footer?.image);

    const toc = data.toc || {};
    applyImageRef(toc.headerImage);
    applyImageRef(toc.headerOverlayImage);
};

const applyAssetUrlsToDocData = (docData, assetUrlMap) => {
    if (!assetUrlMap || assetUrlMap.size === 0) return;
    const data = docData && typeof docData === 'object' ? docData : {};
    const blocks = Array.isArray(data.blocks) ? data.blocks : [];
    blocks.forEach(block => {
        if (!block.content || !block.content.includes('<img')) return;
        const div = document.createElement('div');
        div.innerHTML = block.content;
        div.querySelectorAll('img').forEach(img => {
            const dataPath = img.getAttribute('data-path') || img.dataset.path;
            const src = img.getAttribute('src');
            const dataKey = dataPath ? normalizeAssetKey(dataPath) : '';
            const srcKey = src ? normalizeAssetKey(src) : '';
            const url = assetUrlMap.get(dataKey) || assetUrlMap.get(srcKey);
            if (url) img.setAttribute('src', url);
        });
        block.content = div.innerHTML;
    });

    const applyImageRef = (imageRef) => {
        if (!imageRef) return;
        const pathKey = normalizeAssetKey(imageRef.path);
        const srcKey = normalizeAssetKey(imageRef.src);
        const url = assetUrlMap.get(pathKey) || assetUrlMap.get(srcKey);
        if (url) imageRef.src = url;
    };

    const headerFooter = data.headerFooter || {};
    applyImageRef(headerFooter.header?.image);
    applyImageRef(headerFooter.footer?.image);

    const toc = data.toc || {};
    applyImageRef(toc.headerImage);
    applyImageRef(toc.headerOverlayImage);
};

const buildAssetUrlMap = (assetEntries) => {
    const map = new Map();
    if (!assetEntries) return map;
    assetEntries.forEach((bytes, path) => {
        const ext = String(path || '').split('.').pop();
        const mime = guessMimeFromExtension(ext);
        const blob = new Blob([bytes], { type: mime });
        const url = URL.createObjectURL(blob);
        map.set(normalizeAssetKey(path), url);
    });
    return map;
};

