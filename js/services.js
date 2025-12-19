// Filename: js/services.js
import { State } from './state.js';
import { Utils } from './utils.js';

const toPositiveInt = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const buildEditorTableElement = (rows, cols) => {
    const rowCount = toPositiveInt(rows);
    const colCount = toPositiveInt(cols);
    if (!rowCount || !colCount) return null;
    const table = document.createElement('table');
    table.className = 'editor-table';
    const tbody = document.createElement('tbody');
    for (let r = 0; r < rowCount; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < colCount; c++) {
            const td = document.createElement('td');
            td.setAttribute('contenteditable', 'true');
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
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
                const safeLabel = label
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                return `<div class="custom-box labeled-box" contenteditable="false"><div class="box-label">&lt; ${safeLabel} &gt;</div><div class="box-content">${body}</div></div>`;
            }
            return `<div class="custom-box simple-box" contenteditable="false"><div class="box-content">${body}</div></div>`;
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

        // [Fix] 블록박스를 원자적 개체로 유지하고, 뒤로 커서가 이동할 수 있도록 줄바꿈 보장
        element.querySelectorAll('.custom-box').forEach(boxEl => {
            boxEl.setAttribute('contenteditable', 'false');
            let next = boxEl.nextSibling;
            if (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim() === '') next = next.nextSibling;
            if (!next || !(next.nodeType === Node.ELEMENT_NODE && next.tagName === 'BR')) {
                boxEl.after(document.createElement('br'));
            }
        });

        const escapeForMathTex = (value = '') => {
            return value
                .replace(/\\/g, '\\textbackslash ')
                .replace(/([{}#%&_\$])/g, '\\$1')
                .replace(/\^/g, '\\^{}')
                .replace(/~/g, '\\~{}');
        };

        const sanitizeMathTokens = (tex) => {
            if (!tex) return tex;
            const toMathBlankText = (label = '') => {
                return `\\bbox[3px, border:1.5px solid #000]{\\text{${escapeForMathTex(label)}}}`;
            };
            const toBoxedText = (label = '') => {
                return `\\boxed{\\text{${escapeForMathTex(label)}}}`;
            };
            tex = tex.replace(/\[빈칸[:_](.*?)\]/g, (m, label) => toMathBlankText(label));
            tex = tex.replace(/\[이미지\s*:\s*(.*?)\]/g, (m, label) => toBoxedText(label));
            return tex;
        };

        const applyTokenReplacementsOutsideMath = (root) => {
            const mathRegex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g;
            const tokenRegex = /\[빈칸([:_])(.*?)\]|\[이미지\s*:\s*(.*?)\]|\[표_(\d+)x(\d+)\]/g;
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];
            while (walker.nextNode()) textNodes.push(walker.currentNode);

            const createImageFragment = (label) => {
                const container = document.createElement('div');
                container.innerHTML = Utils.getImagePlaceholderHTML(label);
                const frag = document.createDocumentFragment();
                Array.from(container.childNodes).forEach(child => frag.appendChild(child));
                return frag;
            };

            const buildFragmentFromPlain = (text) => {
                const frag = document.createDocumentFragment();
                if (!text) return frag;
                let lastIndex = 0; tokenRegex.lastIndex = 0; let m;
                while ((m = tokenRegex.exec(text)) !== null) {
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
                        const tableEl = buildEditorTableElement(m[4], m[5]);
                        if (tableEl) frag.appendChild(tableEl);
                        else frag.appendChild(document.createTextNode(m[0]));
                    }
                    lastIndex = tokenRegex.lastIndex;
                }
                if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
                return frag;
            };

            for (let node of textNodes) {
                const text = node.nodeValue;
                if (!text) continue;
                tokenRegex.lastIndex = 0; mathRegex.lastIndex = 0;
                const hasToken = tokenRegex.test(text); tokenRegex.lastIndex = 0;
                const hasMath = mathRegex.test(text); mathRegex.lastIndex = 0;
                if (!hasToken && !hasMath) continue;
                const frag = document.createDocumentFragment();
                let lastIndex = 0; mathRegex.lastIndex = 0; let match;
                while ((match = mathRegex.exec(text)) !== null) {
                    if (match.index > lastIndex) frag.appendChild(buildFragmentFromPlain(text.slice(lastIndex, match.index)));
                    frag.appendChild(document.createTextNode(match[0]));
                    lastIndex = mathRegex.lastIndex;
                }
                if (lastIndex < text.length) frag.appendChild(buildFragmentFromPlain(text.slice(lastIndex)));
                node.parentNode.replaceChild(frag, node);
            }
        };

        applyTokenReplacementsOutsideMath(element);

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
                const preparedTex = sanitizeMathTokens(cleanTex);
                const cacheKey = preparedTex + (isDisplay ? '_D' : '_I');
                let mjxNode = null;

                if (this.mathCache.has(cacheKey)) {
                    mjxNode = this.mathCache.get(cacheKey).cloneNode(true);
                } else {
                    try {
                        mjxNode = await MathJax.tex2svgPromise(preparedTex, { display: isDisplay });
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
        Utils.showLoading("💾 저장 중...");

        const title = (State.docData.meta.title || 'exam').trim();
        const safeTitle = title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 40) || 'exam';
        const now = new Date();
        const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        const filename = `${safeTitle}_${stamp}.json`;
        
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
                    return `<div class="custom-box labeled-box" contenteditable="false"><div class="box-label">&lt; ${safeLabel} &gt;</div><div class="box-content">${bodyText}</div></div>`;
                }
                return `<div class="custom-box simple-box" contenteditable="false"><div class="box-content">${bodyText}</div></div>`;
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

            const convertLegacyBlockBoxes = (input) => {
                return input.replace(/\[블록박스_(.*?)\]\s*(?::)?\s*([^\n]*?)\s*\]/g, (m, label, body) => {
                    return renderBox((label || '').trim(), body);
                });
            };

            content = convertLegacyBlockBoxes(convertBlockBoxes(content));
            content = content.replace(/\[표_(\d+)x(\d+)\]/g, (m, rows, cols) => {
                const tableEl = buildEditorTableElement(rows, cols);
                return tableEl ? tableEl.outerHTML : m;
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
