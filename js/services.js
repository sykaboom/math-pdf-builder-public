// Filename: js/services.js
import { State } from './state.js';
import { Utils } from './utils.js';

export const ManualRenderer = {
    mathCache: new Map(),
    isRendering: false,

    async renderAll(callback) {
        if (!window.isMathJaxReady) { console.log("MathJax Waiting..."); return; }
        if (this.isRendering) return; 
        this.isRendering = true;
        try {
            Utils.showLoading("⚡ 수식 변환 중...");
            const boxes = document.querySelectorAll('.editable-box');
            for (let box of boxes) await this.typesetElement(box);
            if (callback) callback(); 
        } catch(e) { console.error("Render Error:", e); } 
        finally { this.isRendering = false; Utils.hideLoading(); }
    },

    async typesetElement(element) {
        if (element.querySelector('mjx-container') || element.querySelector('.blank-box')) {
            element.innerHTML = Utils.cleanRichContentToTex(element.innerHTML);
        }
        element.innerHTML = element.innerHTML.replace(/\[빈칸:(.*?)\]/g, '<span class="blank-box" contenteditable="false">$1</span>');

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
                const cacheKey = cleanTex + (isDisplay ? '_D' : '_I');
                let mjxNode = null;

                if (this.mathCache.has(cacheKey)) {
                    mjxNode = this.mathCache.get(cacheKey).cloneNode(true);
                } else {
                    try {
                        mjxNode = await MathJax.tex2svgPromise(cleanTex, { display: isDisplay });
                        if (mjxNode) {
                            mjxNode.setAttribute('data-tex', cleanTex); 
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
        if (!window.showDirectoryPicker) { alert("브라우저 미지원"); return; }
        try { 
            this.dirHandle = await window.showDirectoryPicker(); 
            document.getElementById('folder-status').classList.add('active'); 
            alert("✅ 폴더 연결됨"); 
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
        if (!this.dirHandle) { if(!confirm("로컬 폴더 미연결. 다운로드?")) return; }
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
                const fileHandle = await this.dirHandle.getFileHandle('data.json', { create: true });
                const writable = await fileHandle.createWritable(); await writable.write(JSON.stringify(rawData, null, 2)); await writable.close();
                Utils.hideLoading(); alert("✅ 저장 완료!");
            } catch(e) { alert("오류: " + e.message); Utils.hideLoading(); }
        } else {
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(rawData, null, 2)], {type:'application/json'})); a.download = 'exam_v3.9.5.json'; a.click(); Utils.hideLoading();
        }
    }
};

export const ImportParser = {
    parse(text) {
        const blocks = []; const rawItems = text.split('[[').filter(s => s.trim().length > 0);
        rawItems.forEach(chunk => {
            const closeIdx = chunk.indexOf(']]'); if (closeIdx === -1) return;
            const meta = chunk.substring(0, closeIdx); let content = chunk.substring(closeIdx + 2).trim();
            if (content.startsWith(':')) content = content.substring(1).trim();
            content = content.replace(/\[이미지:(.*?)\]/g, '<span class="image-placeholder">[이미지: $1]</span>');
            content = content.replace(/\[빈칸:(.*?)\]/g, '<span class="blank-box" contenteditable="false">$1</span>');
            content = content.replace(/\n/g, '<br>');
            const [stylePart, labelPart] = meta.includes('_') ? meta.split('_') : ['기본', meta];
            const styles = stylePart.split(',');
            let type = 'example'; let bordered = styles.includes('박스'); let bgGray = styles.includes('음영');
            let label = labelPart ? `<span class="q-label">${labelPart}</span>` : '';
            if (styles.includes('개념')) type = 'concept';
            blocks.push({ id: 'imp_' + Date.now() + Math.random(), type: type, content: label + ' ' + content, bordered: bordered, bgGray: bgGray });
        });
        return blocks;
    }
};