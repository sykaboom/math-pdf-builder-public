// Filename: js/events.js
import { State } from './state.js';
import { Actions } from './actions.js';
import { Renderer } from './renderer.js'; // 순환 참조 아님 (내부 호출용)
import { ManualRenderer, FileSystem } from './services.js';
import { Utils } from './utils.js';
import { createTableEditor } from './table-editor.js';
import { getMathSplitCandidates as buildMathSplitCandidates } from './math-logic.js';
import { stripConceptBlankTokens } from './math-tokenize.js';

const PATCH_NOTES_PATH = 'PATCH_NOTES.txt';

const getFileHandleByPath = async (root, relPath) => {
    const parts = relPath.split('/').filter(Boolean);
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i]);
    }
    return dir.getFileHandle(parts[parts.length - 1]);
};

const renderPatchNotes = (container, text) => {
    if (!container) return;
    container.innerHTML = '';
    const lines = String(text || '').split(/\r?\n/);
    const frag = document.createDocumentFragment();
    let list = null;
    const flushList = () => {
        if (list) {
            frag.appendChild(list);
            list = null;
        }
    };
    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
            flushList();
            const spacer = document.createElement('div');
            spacer.className = 'patch-notes-spacer';
            frag.appendChild(spacer);
            return;
        }
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            flushList();
            const dateEl = document.createElement('div');
            dateEl.className = 'patch-notes-date';
            dateEl.textContent = trimmed;
            frag.appendChild(dateEl);
            return;
        }
        if (trimmed.startsWith('- ')) {
            if (!list) {
                list = document.createElement('ul');
                list.className = 'patch-notes-list';
            }
            const li = document.createElement('li');
            li.textContent = trimmed.slice(2);
            list.appendChild(li);
            return;
        }
        flushList();
        const textEl = document.createElement('div');
        textEl.className = 'patch-notes-text';
        textEl.textContent = trimmed;
        frag.appendChild(textEl);
    });
    flushList();
    if (!frag.childNodes.length) {
        container.textContent = '패치노트가 없습니다.';
        return;
    }
    container.appendChild(frag);
};

const doPrint = () => {
    Utils.showLoading("🖨️ 인쇄 준비 중...");
    window.print();
    Utils.hideLoading();
};

export const Events = {
    showResizer(img) {
        State.selectedImage = img; 
        const resizer = document.getElementById('image-resizer'); 
        const rect = img.getBoundingClientRect(); 
        resizer.style.display = 'block'; resizer.style.top = (rect.top + window.scrollY) + 'px'; resizer.style.left = (rect.left + window.scrollX) + 'px'; resizer.style.width = rect.width + 'px'; resizer.style.height = rect.height + 'px';
    },
    hideResizer() { document.getElementById('image-resizer').style.display = 'none'; State.selectedImage = null; },

    printPreflightData: null,

    printWithMath() {
        const placeholderCount = document.querySelectorAll('.image-placeholder').length;
        const unrenderedMathCount = Array.from(document.querySelectorAll('.editable-box'))
            .filter(b => (b.textContent || '').includes('$')).length;

        if (placeholderCount > 0 || unrenderedMathCount > 0) {
            this.printPreflightData = { placeholderCount, unrenderedMathCount };
            const body = document.getElementById('print-preflight-body');
            if (body) {
                const lines = [];
                if (placeholderCount > 0) lines.push(`• 미삽입 이미지 박스: ${placeholderCount}개`);
                if (unrenderedMathCount > 0) lines.push(`• 미렌더 수식($ 포함): ${unrenderedMathCount}개`);
                body.innerHTML = lines.join('<br>');
            }
            Utils.openModal('print-preflight-modal');
            return;
        }
        doPrint();
    },

    async printPreflightAction(mode) {
        Utils.closeModal('print-preflight-modal');
        if (mode === 'cancel') { this.printPreflightData = null; return; }
        if (mode === 'render') await ManualRenderer.renderAll(null, { force: true });
        doPrint();
        this.printPreflightData = null;
    },

    getEditableContextFromSelection() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        const anchor = sel.anchorNode;
        const el = anchor ? (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement) : null;
        if (!el) return null;
        const box = el.closest('.editable-box');
        if (!box || !box.isContentEditable || box.getAttribute('contenteditable') === 'false') return null;
        return { box, wrap: box.closest('.block-wrapper') };
    },

    canInsertImageAtCursor() {
        return !!this.getEditableContextFromSelection();
    },

    updateImageInsertAvailability() {
        const canInsert = this.canInsertImageAtCursor();
        document.querySelectorAll('[data-action="insert-image-box"]').forEach((el) => {
            if (el.tagName === 'BUTTON') {
                el.disabled = !canInsert;
                return;
            }
            if (canInsert) {
                el.classList.remove('disabled');
                el.removeAttribute('data-disabled');
            } else {
                el.classList.add('disabled');
                el.setAttribute('data-disabled', 'true');
            }
        });
    },

    updateRenderingToggleUI() {
        const btn = document.getElementById('toggle-rendering-btn');
        if (!btn) return;
        btn.textContent = State.renderingEnabled ? '🔓 렌더링 해제 (편집 모드)' : '🔒 렌더링 적용 (렌더 모드)';
    },

    async toggleRenderingMode(forceState) {
        const next = (typeof forceState === 'boolean') ? forceState : !State.renderingEnabled;
        State.renderingEnabled = next;
        Renderer.renderPages();
        if (next) {
            await ManualRenderer.renderAll();
        } else {
            const container = document.getElementById('paper-container');
            if (container) {
                const boxes = container.querySelectorAll('.editable-box');
                boxes.forEach(box => {
                    Utils.replaceTablesWithTokensInDom(box);
                    Utils.replaceBlockBoxesWithTokensInDom(box);
                    const cleaned = Utils.cleanRichContentToTex(box.innerHTML);
                    box.innerHTML = cleaned;
                    const wrap = box.closest('.block-wrapper');
                    if (wrap) Actions.updateBlockContent(wrap.dataset.id, cleaned, false);
                });
                State.saveHistory();
            }
        }
        this.updateRenderingToggleUI();
        this.updateImageInsertAvailability();
    },

    async renderAllSafe() {
        if (!State.renderingEnabled) { await this.toggleRenderingMode(true); return; }
        await ManualRenderer.renderAll();
    },

    resetProject() {
        if (!confirm('초기화하시겠습니까? (저장되지 않은 내용은 삭제됩니다)')) return;
        State.docData.blocks = [{ id: 'b0', type: 'concept', content: '<span class="q-label">안내</span> 내용 입력...' }];
        Renderer.renderPages();
        State.saveHistory();
    },

    loadProjectJSONFromInput(input) {
        if (!input || !input.files || !input.files[0]) return;
        const file = input.files[0];
        const r = new FileReader();
        r.onload = async (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (!parsed || typeof parsed !== 'object' || !parsed.data || !parsed.settings) {
                    throw new Error('지원하지 않는 파일 형식입니다.');
                }
                State.applyProjectData(parsed, { sanitize: true });
                await FileSystem.loadImagesForDisplay(State.docData.blocks);
                Renderer.renderPages();
                ManualRenderer.renderAll();
                State.saveHistory();
            } catch (err) {
                alert('파일 로드 실패: ' + err.message);
            }
        };
        r.readAsText(file);
    },

    async openPatchNotes() {
        const body = document.getElementById('patch-notes-body');
        if (body) body.textContent = '불러오는 중...';
        Utils.openModal('patch-notes-modal');
        try {
            let text = '';
            if (FileSystem.dirHandle) {
                const fileHandle = await getFileHandleByPath(FileSystem.dirHandle, PATCH_NOTES_PATH);
                const file = await fileHandle.getFile();
                text = await file.text();
            } else if (window.location.protocol !== 'file:') {
                const response = await fetch(encodeURI(PATCH_NOTES_PATH), { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                text = await response.text();
            } else {
                throw new Error('file-protocol');
            }
            renderPatchNotes(body, text);
        } catch (err) {
            if (body) body.textContent = '패치노트를 불러오지 못했습니다.';
        }
    },

    async downloadPromptFile(target) {
        const btn = typeof target === 'string'
            ? document.querySelector(`.prompt-download[data-prompt-path="${target}"]`)
            : target;
        const path = typeof target === 'string' ? target : (btn && btn.dataset ? btn.dataset.promptPath : '');
        if (!path) return;
        const promptName = (btn && btn.dataset ? btn.dataset.promptName : '') || '';
        const promptDate = (btn && btn.dataset ? btn.dataset.promptDate : '') || '';
        const fallbackName = path.split('/').pop() || 'prompt.txt';
        const baseName = promptName || fallbackName.replace(/\.txt$/i, '');
        const cleanedBaseName = baseName.replace(/\s*다운로드\s*/g, ' ').replace(/\s+/g, ' ').trim();
        const safeBaseName = cleanedBaseName || baseName;
        const filename = promptDate ? `${safeBaseName} (${promptDate}).txt` : `${safeBaseName}.txt`;
        const triggerDownload = (url, useNewTab = false) => {
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            if (useNewTab) link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            link.remove();
        };

        try {
            let blob = null;
            if (FileSystem.dirHandle) {
                const fileHandle = await getFileHandleByPath(FileSystem.dirHandle, path);
                const file = await fileHandle.getFile();
                blob = file;
            } else if (window.location.protocol !== 'file:') {
                const response = await fetch(encodeURI(path), { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                blob = await response.blob();
            } else {
                throw new Error('file-protocol');
            }
            const url = URL.createObjectURL(blob);
            triggerDownload(url);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            triggerDownload(encodeURI(path), true);
        }
    },

    focusNextBlock(currentId, direction) { 
        const idx = State.docData.blocks.findIndex(b => b.id === currentId); 
        let nextIdx = idx + direction; 
        while(nextIdx >= 0 && nextIdx < State.docData.blocks.length) { 
            const nextBlock = State.docData.blocks[nextIdx]; 
            if (['concept', 'example'].includes(nextBlock.type)) { 
                const nextEl = document.querySelector(`.block-wrapper[data-id="${nextBlock.id}"] .editable-box`); 
                if(nextEl) { nextEl.focus(); const nextWrap = nextEl.closest('.block-wrapper'); nextWrap.classList.add('temp-show-handle'); setTimeout(() => nextWrap.classList.remove('temp-show-handle'), 1000); } 
                return; 
            } 
            nextIdx += direction; 
        } 
    },
    
    insertImageBoxSafe() {
        const context = this.getEditableContextFromSelection();
        if (!context) {
            Utils.showToast('커서를 놓은 뒤 이미지 삽입을 사용하세요.', 'info');
            this.updateImageInsertAvailability();
            return;
        }
        document.execCommand('insertHTML', false, Utils.getImagePlaceholderHTML());
        const wrap = context.wrap;
        if (wrap && wrap.dataset && wrap.dataset.id) {
            Actions.updateBlockContent(wrap.dataset.id, Utils.cleanRichContentToTex(context.box.innerHTML), true);
            Renderer.debouncedRebalance();
            State.lastEditableId = wrap.dataset.id;
        }
        this.updateImageInsertAvailability();
    },

    addImageBlockBelow(refId) {
        const targetId = refId || State.contextTargetId;
        if (Actions.addBlockBelow('image', targetId)) {
            Renderer.renderPages();
            ManualRenderer.renderAll();
        }
    },

    insertImagePlaceholderAtEnd(refId) {
        const targetId = refId || State.contextTargetId;
        if (!targetId) return;
        const box = document.querySelector(`.block-wrapper[data-id="${targetId}"] .editable-box`);
        if (!box) return;
        box.focus();
        const r = document.createRange(); r.selectNodeContents(box); r.collapse(false);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        document.execCommand('insertHTML', false, `<br>${Utils.getImagePlaceholderHTML()}`);
        Actions.updateBlockContent(targetId, Utils.cleanRichContentToTex(box.innerHTML), true);
        Renderer.debouncedRebalance();
        State.lastEditableId = targetId;
    },

    splitBlockAtCursor(refId) {
        const targetId = refId || State.lastEditableId || State.contextTargetId;
        if (!targetId) return false;
        const block = State.docData.blocks.find(b => b.id === targetId);
        if (!block || !['concept', 'example', 'answer'].includes(block.type)) return false;
        const box = document.querySelector(`.block-wrapper[data-id="${targetId}"] .editable-box`);
        if (!box) return false;

        const sel = window.getSelection();
        if (!sel.rangeCount || !box.contains(sel.anchorNode)) {
            box.focus();
            const r = document.createRange();
            r.selectNodeContents(box);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
        }
        if (sel.rangeCount && !sel.isCollapsed) sel.collapseToEnd();

        if (!sel.rangeCount) return false;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) range.deleteContents();

        const br = document.createElement('br');
        const atomAfter = Utils.getAtomAfterCaret(box);
        if (atomAfter && atomAfter.parentNode) atomAfter.parentNode.insertBefore(br, atomAfter);
        else range.insertNode(br);

        const afterRange = document.createRange();
        afterRange.selectNodeContents(box);
        afterRange.setStartAfter(br);
        const afterFrag = afterRange.extractContents();

        br.remove();
        let beforeHtml = box.innerHTML;
        const tmpAfter = document.createElement('div');
        tmpAfter.appendChild(afterFrag);
        let afterHtml = tmpAfter.innerHTML;

        const labelEl = box.querySelector('.q-label');
        const labelHtml = labelEl ? labelEl.outerHTML : '';
        if (labelHtml) {
            const tmpAfterNoLabel = document.createElement('div');
            tmpAfterNoLabel.innerHTML = afterHtml;
            tmpAfterNoLabel.querySelectorAll('.q-label').forEach(el => el.remove());
            afterHtml = tmpAfterNoLabel.innerHTML;

            const tmpBefore = document.createElement('div');
            tmpBefore.innerHTML = beforeHtml;
            if (!tmpBefore.querySelector('.q-label')) {
                if (tmpBefore.innerHTML.trim()) tmpBefore.insertAdjacentHTML('afterbegin', `${labelHtml} `);
                else tmpBefore.innerHTML = `${labelHtml} `;
            }
            beforeHtml = tmpBefore.innerHTML;
        }

        const cleanBefore = Utils.cleanRichContentToTex(beforeHtml);
        const cleanAfter = Utils.cleanRichContentToTex(afterHtml);
        return Actions.splitBlockWithContents(targetId, cleanBefore, cleanAfter);
    },

    getMathSplitCandidates(tex) {
        return buildMathSplitCandidates(tex);
    },

    splitMathAtIndex(mjxContainer, splitIndex) {
        if (!mjxContainer || !Number.isFinite(splitIndex)) return false;
        const tex = mjxContainer.getAttribute('data-tex');
        if (!tex) return false;
        const left = tex.slice(0, splitIndex).trim();
        const right = tex.slice(splitIndex).trim();
        if (!left || !right) {
            Utils.showToast('나눌 위치를 찾지 못했습니다.', 'info');
            return false;
        }
        const nextText = `$${left}$$${right}$`;
        mjxContainer.replaceWith(document.createTextNode(nextText));
        return true;
    },

    populateFontMenu(targetId) {
        const b = State.docData.blocks.find(x => x.id === targetId);
        const famSel = document.getElementById('block-font-family-select');
        const sizeInp = document.getElementById('block-font-size-input');
        if (famSel) famSel.value = b && b.fontFamily ? b.fontFamily : 'default';
        if (sizeInp) {
            sizeInp.placeholder = State.settings.fontSizePt || 10.5;
            sizeInp.value = b && b.fontSizePt ? b.fontSizePt : '';
        }
    },

    applyBlockFontFromMenu() {
        const id = State.contextTargetId;
        if (!id) return;
        const famSel = document.getElementById('block-font-family-select');
        const sizeInp = document.getElementById('block-font-size-input');
        if (famSel) Actions.setBlockFontFamily(id, famSel.value);
        if (sizeInp) Actions.setBlockFontSize(id, sizeInp.value);
        Renderer.renderPages();
        ManualRenderer.renderAll();
        Utils.closeModal('context-menu');
    },

    applyInlineStyleToSelection(styles = {}) {
        const styleEntries = Object.entries(styles).filter(([, value]) => value !== undefined && value !== null && value !== '');
        if (!styleEntries.length) return;
        const sel = window.getSelection();
        const baseRange = State.selectionRange ? State.selectionRange.cloneRange() : (sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null);
        if (!baseRange || baseRange.collapsed) return;
        const container = baseRange.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? baseRange.commonAncestorContainer
            : baseRange.commonAncestorContainer.parentNode;
        const box = container ? container.closest('.editable-box') : null;
        if (!box) return;
        const wrap = box.closest('.block-wrapper');
        if (!wrap) return;

        const span = document.createElement('span');
        styleEntries.forEach(([key, value]) => { span.style[key] = value; });
        const contents = baseRange.extractContents();

        const stripInlineStyles = (node, keys) => {
            if (!node) return;
            if (node.nodeType === Node.ELEMENT_NODE) {
                keys.forEach((key) => {
                    if (node.style && node.style[key]) node.style[key] = '';
                });
                if (node.getAttribute && node.getAttribute('style') === '') node.removeAttribute('style');
            }
            node.childNodes && node.childNodes.forEach(child => stripInlineStyles(child, keys));
        };
        const styleKeys = styleEntries.map(([key]) => key);
        stripInlineStyles(contents, styleKeys);

        span.appendChild(contents);
        baseRange.insertNode(span);

        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(newRange);
        State.selectionRange = newRange.cloneRange();
        State.selectionBlockId = wrap.dataset.id || null;

        Actions.updateBlockContent(wrap.dataset.id, Utils.cleanRichContentToTex(box.innerHTML), true);
        Renderer.debouncedRebalance();
    },

    applyInlineFontFamily(familyKey) {
        if (!familyKey) return;
        const familyMap = {
            serif: "'Noto Serif KR', serif",
            gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
            gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
        };
        const fontFamily = familyKey === 'default' ? 'inherit' : (familyMap[familyKey] || familyKey);
        this.applyInlineStyleToSelection({ fontFamily });
    },

    applyInlineFontSize(sizePt) {
        if (sizePt === undefined || sizePt === null || sizePt === '') return;
        const sizeValue = parseFloat(sizePt);
        const fontSize = sizeValue > 0 ? `${sizeValue}pt` : 'inherit';
        this.applyInlineStyleToSelection({ fontSize });
    },

    async applyConceptBlankToSelection() {
        const sel = window.getSelection();
        const baseRange = State.selectionRange
            ? State.selectionRange.cloneRange()
            : (sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null);
        if (!baseRange || baseRange.collapsed) return;
        const container = baseRange.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? baseRange.commonAncestorContainer
            : baseRange.commonAncestorContainer.parentNode;
        const box = container ? container.closest('.editable-box') : null;
        if (!box) return;
        const wrap = box.closest('.block-wrapper');
        if (!wrap) return;

        const extracted = baseRange.extractContents();
        const extractedClone = extracted.cloneNode(true);
        const tmp = document.createElement('div');
        tmp.appendChild(extractedClone);
        const cleaned = Utils.cleanRichContentToTex(tmp.innerHTML);
        const textHolder = document.createElement('div');
        textHolder.innerHTML = cleaned;
        const answerText = (textHolder.innerText || '').replace(/\u00A0/g, ' ').trim();

        if (!answerText) {
            baseRange.insertNode(extracted);
            return;
        }

        const token = document.createTextNode(`[개념빈칸:#]${answerText}[/개념빈칸]`);
        baseRange.insertNode(token);
        const nextRange = document.createRange();
        nextRange.setStartAfter(token);
        nextRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nextRange);
        State.selectionRange = nextRange.cloneRange();
        State.selectionBlockId = wrap.dataset.id || null;

        Actions.updateBlockContent(wrap.dataset.id, Utils.cleanRichContentToTex(box.innerHTML), true);
        Renderer.debouncedRebalance();
        if (State.renderingEnabled) {
            await Renderer.updateConceptBlankSummary({ changedBlockId: wrap.dataset.id });
        } else {
            Renderer.updatePreflightPanel();
        }
        const toolbar = document.getElementById('floating-toolbar');
        if (toolbar) toolbar.style.display = 'none';
    },

    handleBlockMousedown(e, id) {
        const box = e.currentTarget;
        const activeWrap = document.activeElement ? document.activeElement.closest('.block-wrapper') : null;
        const activeId = activeWrap && activeWrap.dataset ? activeWrap.dataset.id : null;
        if (box && activeId !== id) {
            const focusTarget = e.target.closest('[contenteditable="true"]') || box;
            if (focusTarget && typeof focusTarget.focus === 'function') {
                focusTarget.focus();
            }
        }
        State.lastEditableId = id;
        if(e.target.tagName==='IMG') { this.showResizer(e.target); e.stopPropagation(); State.selectedImage=e.target; }
        const placeholder = e.target.closest('.image-placeholder');
        if(placeholder) { e.stopPropagation(); if(State.selectedPlaceholder) State.selectedPlaceholder.classList.remove('selected'); State.selectedPlaceholder = placeholder; State.selectedPlaceholder.classList.add('selected'); State.selectedPlaceholder.setAttribute('contenteditable', 'false'); }
        this.updateImageInsertAvailability();
    },

    handleBlockKeydown(e, id, box, renderCallback) {
        if (e.key === 'Backspace') {
            const atomBefore = Utils.getAtomBeforeCaret(box); 
            if (atomBefore) {
                e.preventDefault();
                atomBefore.remove();
                Actions.updateBlockContent(id, Utils.cleanRichContentToTex(box.innerHTML), false);
                State.saveHistory(0, { reason: 'edit', blockId: id });
                return;
            }
            if(box.innerText.trim() === '' && box.innerHTML.replace(/<br>/g,'').trim() === '') { 
                const prevIdx = State.docData.blocks.findIndex(b=>b.id===id) - 1; 
                if (prevIdx >= 0) { 
                    e.preventDefault(); 
                    const prevId = State.docData.blocks[prevIdx].id; 
                    // [Fix] 삭제 전 포커스 ID 저장, 변경 성공 시 렌더링
                    if(Actions.deleteBlockById(id)) {
                        State.lastFocusId = prevId; 
                        renderCallback(); 
                    }
                } 
            }
        }
        if (e.key === 'Enter' && e.altKey && e.shiftKey) {
            e.preventDefault();
            if (this.splitBlockAtCursor(id)) renderCallback();
            return;
        }
        if (e.key === 'Enter' && e.shiftKey) { const atomAfter = Utils.getAtomAfterCaret(box); if (atomAfter) { e.preventDefault(); const br = document.createElement('br'); atomAfter.parentNode.insertBefore(br, atomAfter); const r = document.createRange(); const s = window.getSelection(); r.setStartAfter(br); r.collapse(true); s.removeAllRanges(); s.addRange(r); Actions.updateBlockContent(id, Utils.cleanRichContentToTex(box.innerHTML), true); return; } }
        if(e.key === 'Tab') { e.preventDefault(); if(e.shiftKey) document.execCommand('insertHTML', false, '&nbsp;'.repeat(10)); else if(e.ctrlKey) this.focusNextBlock(id, -1); else this.focusNextBlock(id, 1); return; }
        if(e.key === 'ArrowDown') { if (Utils.isCaretOnLastLine(box)) { e.preventDefault(); this.focusNextBlock(id, 1); } }
        if(e.key === 'ArrowUp') { if (Utils.isCaretOnFirstLine(box)) { e.preventDefault(); this.focusNextBlock(id, -1); } }
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            let changed = false;
            if(e.ctrlKey) changed = Actions.addBlockBelow('break', id);
            else if(e.altKey) changed = Actions.addBlockAbove('example', id);
            else changed = Actions.addBlockBelow('example', id);
            if(changed) renderCallback();
        }
        
        // 스타일 단축키 (Actions 호출 -> 변경 시 callback 실행)
        let styleChanged = false;
        if((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.toggleStyle('bordered'); }
        if((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.toggleStyle('bgGray'); }
        if((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.duplicateTargetBlock(); }
        if((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.applyAlign('left'); }
        if((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.applyAlign('right'); }
        if((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); State.contextTargetId=id; styleChanged = Actions.applyAlign('center'); }
        if((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); this.insertImageBoxSafe(); return; }
        
        if(styleChanged) renderCallback();
    },

    handleConceptAnswerKeydown(e, id, box) {
        if (!(e && e.key === 'Enter' && e.altKey && e.shiftKey)) return;
        e.preventDefault();
        if (this.splitConceptAnswerBlock(id, box)) {
            Renderer.refreshConceptBlankAnswerBlocks();
        }
    },

    splitConceptAnswerBlock(id, box) {
        const block = State.docData.blocks.find(item => item.id === id && item.derived === 'concept-answers');
        if (!block || !box) return false;
        const items = Array.from(box.querySelectorAll('.concept-answer-item'));
        if (items.length < 2) return false;

        let splitIndex = null;
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
            const anchor = sel.anchorNode;
            const anchorEl = anchor
                ? (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement)
                : null;
            const item = anchorEl ? anchorEl.closest('.concept-answer-item') : null;
            if (item && box.contains(item)) {
                const parsed = parseInt(item.dataset.answerIndex, 10);
                if (Number.isFinite(parsed)) splitIndex = parsed;
            }
        }

        if (!Number.isFinite(splitIndex)) {
            const mid = Math.ceil(items.length / 2);
            const fallback = items[mid - 1];
            if (fallback) splitIndex = parseInt(fallback.dataset.answerIndex, 10);
        }

        const firstIndex = parseInt(items[0].dataset.answerIndex, 10);
        const lastIndex = parseInt(items[items.length - 1].dataset.answerIndex, 10);
        if (!Number.isFinite(firstIndex) || !Number.isFinite(lastIndex) || !Number.isFinite(splitIndex)) return false;
        if (splitIndex >= lastIndex) return false;

        const newCount = Math.max(1, splitIndex - firstIndex + 1);
        const currentCapacity = Number.isFinite(parseInt(block.conceptAnswerCount, 10))
            ? parseInt(block.conceptAnswerCount, 10)
            : items.length;
        const nextCapacity = Math.max(1, currentCapacity - newCount);
        block.conceptAnswerCount = newCount;
        block.conceptAnswerSplit = true;

        const newBlock = Renderer.createConceptAnswerBlock(nextCapacity, true);
        newBlock.conceptAnswerCount = nextCapacity;

        const idx = State.docData.blocks.findIndex(item => item.id === id);
        if (idx === -1) return false;
        State.docData.blocks.splice(idx + 1, 0, newBlock);
        State.saveHistory();
        return true;
    },

    initGlobalListeners() {
        const eventsApi = this;
        const body = document.body;
        const isTypingTarget = () => {
            const el = document.activeElement;
            if (!el) return false;
            if (el.isContentEditable) return true;
            const tag = el.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA';
        };

        const isFileDrag = (e) => {
            const dt = e.dataTransfer;
            if (!dt) return false;
            if (dt.types && Array.from(dt.types).includes('Files')) return true;
            if (dt.items && Array.from(dt.items).some(item => item.kind === 'file')) return true;
            if (dt.files && dt.files.length > 0) return true;
            return false;
        };

        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', () => eventsApi.loadProjectJSONFromInput(fileInput));
        }

        document.querySelectorAll('[data-action="insert-image-box"]').forEach((el) => {
            if (el.tagName !== 'BUTTON') return;
            el.addEventListener('mousedown', (e) => {
                if (!el.disabled) e.preventDefault();
            });
        });

        const mathMenu = document.getElementById('math-menu');
        const mathMenuOps = mathMenu ? mathMenu.querySelector('.math-menu-ops') : null;
        const mathBlankBtn = mathMenu ? mathMenu.querySelector('[data-action="blank"]') : null;
        const mathUnblankBtn = mathMenu ? mathMenu.querySelector('[data-action="unblank"]') : null;
        let activeMath = null;
        const closeMathMenu = () => {
            if (mathMenu) mathMenu.style.display = 'none';
            activeMath = null;
        };
        const openMathMenu = (mjx) => {
            if (!mathMenu) return;
            activeMath = mjx;
            const tex = mjx.getAttribute('data-tex') || '';
            const hasConceptBlank = /\[개념빈칸[:_]/.test(tex);
            if (mathBlankBtn) {
                mathBlankBtn.disabled = hasConceptBlank;
                mathBlankBtn.title = hasConceptBlank ? '이미 개념빈칸입니다.' : '수식을 개념빈칸으로 전환';
            }
            if (mathUnblankBtn) {
                mathUnblankBtn.disabled = !hasConceptBlank;
                mathUnblankBtn.title = hasConceptBlank ? '개념빈칸을 해제합니다.' : '개념빈칸이 없습니다.';
            }
            if (mathMenuOps) {
                const splitData = eventsApi.getMathSplitCandidates(tex);
                mathMenuOps.innerHTML = '';
                if (splitData.candidates.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'math-menu-empty';
                    empty.textContent = splitData.reason || '나눌 연산자가 없습니다.';
                    mathMenuOps.appendChild(empty);
                } else {
                    splitData.candidates.forEach((candidate) => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'math-menu-op';
                        btn.dataset.splitIndex = String(candidate.index);

                        const leftSpan = document.createElement('span');
                        leftSpan.className = 'math-menu-op-left';
                        leftSpan.textContent = candidate.leftPreview;

                        const tokenSpan = document.createElement('span');
                        tokenSpan.className = 'math-menu-op-token';
                        tokenSpan.textContent = candidate.token;

                        const rightSpan = document.createElement('span');
                        rightSpan.className = 'math-menu-op-right';
                        rightSpan.textContent = candidate.rightPreview;

                        btn.appendChild(leftSpan);
                        btn.appendChild(tokenSpan);
                        btn.appendChild(rightSpan);
                        mathMenuOps.appendChild(btn);
                    });
                }
            }
            mathMenu.style.display = 'flex';
            const rect = mjx.getBoundingClientRect();
            const menuRect = mathMenu.getBoundingClientRect();
            const pad = 8;
            let top = rect.top + window.scrollY - menuRect.height - 8;
            if (top < window.scrollY + pad) top = rect.bottom + window.scrollY + 8;
            let left = rect.left + window.scrollX + (rect.width / 2) - (menuRect.width / 2);
            left = Math.min(Math.max(left, window.scrollX + pad), window.scrollX + window.innerWidth - pad - menuRect.width);
            top = Math.min(Math.max(top, window.scrollY + pad), window.scrollY + window.innerHeight - pad - menuRect.height);
            mathMenu.style.top = `${top}px`;
            mathMenu.style.left = `${left}px`;
        };
        const elementMenu = document.getElementById('element-menu');
        const elementMenuTitle = elementMenu ? elementMenu.querySelector('.element-menu-title') : null;
        const elementMenuUnblankBtn = elementMenu ? elementMenu.querySelector('[data-action="unblank"]') : null;
        const elementMenuUnblankRow = elementMenuUnblankBtn ? elementMenuUnblankBtn.closest('.element-menu-row') : null;
        const elementEditModal = document.getElementById('element-edit-modal');
        const elementEditTitle = document.getElementById('element-edit-title');
        const elementEditTextarea = document.getElementById('element-edit-textarea');
        const elementEditHint = document.getElementById('element-edit-hint');
        let activeElement = null;
        let activeEdit = null;
        const closeElementMenu = () => {
            if (elementMenu) elementMenu.style.display = 'none';
            activeElement = null;
        };
        const decodeHtml = (value = '') => {
            const tmp = document.createElement('div');
            tmp.innerHTML = String(value);
            return tmp.textContent || '';
        };
        const buildTokenFragmentFromLines = (lines) => {
            const frag = document.createDocumentFragment();
            lines.forEach((line, idx) => {
                frag.appendChild(document.createTextNode(line));
                if (idx < lines.length - 1) frag.appendChild(document.createElement('br'));
            });
            return frag;
        };
        const buildConceptBlankToken = (blank) => {
            const dataset = blank.dataset || {};
            const rawLabel = dataset.rawLabel !== undefined
                ? decodeHtml(dataset.rawLabel)
                : (dataset.label !== undefined ? decodeHtml(dataset.label) : '#');
            const delim = dataset.delim || ':';
            const answer = dataset.answer ? decodeHtml(dataset.answer) : '';
            return `[개념빈칸${delim}${rawLabel}]${answer}[/개념빈칸]`;
        };
        const buildBlankToken = (blank) => {
            const dataset = blank.dataset || {};
            const delim = dataset.delim || ':';
            const label = decodeHtml(blank.textContent || '');
            return `[빈칸${delim}${label}]`;
        };
        const buildImageToken = (placeholder) => {
            const label = decodeHtml(placeholder.getAttribute('data-label') || '');
            return `[이미지:${label}]`;
        };
        const extractBoxBodyText = (contentEl) => {
            if (!contentEl) return '';
            const cleaned = Utils.cleanRichContentToTex(contentEl.innerHTML);
            const tmp = document.createElement('div');
            tmp.innerHTML = cleaned;
            return (tmp.innerText || '').replace(/\u00A0/g, ' ').trim();
        };
        const buildBoxTokenFragment = (startToken, bodyText, endToken) => {
            const frag = document.createDocumentFragment();
            frag.appendChild(document.createTextNode(startToken));
            frag.appendChild(document.createElement('br'));
            if (bodyText) {
                const lines = bodyText.split(/\n/);
                lines.forEach((line, idx) => {
                    frag.appendChild(document.createTextNode(line));
                    if (idx < lines.length - 1) frag.appendChild(document.createElement('br'));
                });
            }
            frag.appendChild(document.createElement('br'));
            frag.appendChild(document.createTextNode(endToken));
            return frag;
        };
        const buildBoxTokenText = (startToken, bodyText, endToken) => {
            const lines = [startToken];
            if (bodyText) lines.push(...bodyText.split(/\n/));
            lines.push('');
            lines.push(endToken);
            return lines.join('\n');
        };
        const buildRectBoxTokenData = (rectBox) => {
            const bodyText = extractBoxBodyText(rectBox.querySelector('.rect-box-content'));
            const startToken = '[블록사각형]';
            const endToken = '[/블록사각형]';
            return {
                text: buildBoxTokenText(startToken, bodyText, endToken),
                fragment: buildBoxTokenFragment(startToken, bodyText, endToken)
            };
        };
        const buildCustomBoxTokenData = (customBox) => {
            let labelText = '';
            const labelEl = customBox.querySelector('.box-label');
            if (labelEl) labelText = labelEl.textContent.replace(/[<>]/g, '').trim();
            const bodyText = extractBoxBodyText(customBox.querySelector('.box-content'));
            const startToken = labelText ? `[블록박스_${labelText}]` : `[블록박스_]`;
            const endToken = '[/블록박스]';
            return {
                text: buildBoxTokenText(startToken, bodyText, endToken),
                fragment: buildBoxTokenFragment(startToken, bodyText, endToken)
            };
        };
        const selectorMap = {
            'math': 'mjx-container',
            'concept-blank': '.blank-box.concept-blank-box',
            'blank': '.blank-box:not(.concept-blank-box)',
            'image': '.image-placeholder',
            'rect-box': '.rect-box',
            'custom-box': '.custom-box',
            'table': 'table.editor-table',
            'choice': 'table.choice-table'
        };
        const labelMap = {
            'math': '수식',
            'concept-blank': '개념빈칸',
            'blank': '빈칸',
            'image': '이미지',
            'rect-box': '사각형',
            'custom-box': '박스',
            'table': '표',
            'choice': '선지'
        };
        const editHintMap = {
            'math': '수식은 $...$ 또는 $$...$$ 형식으로 입력하세요.',
            'concept-blank': '형식: [개념빈칸:#]정답[/개념빈칸]',
            'blank': '형식: [빈칸: 내용]',
            'image': '형식: [이미지: 설명]',
            'rect-box': '형식: [블록사각형] ... [/블록사각형]',
            'custom-box': '형식: [블록박스_라벨] ... [/블록박스]',
            'table': '형식: [표_행x열] : (1x1_"내용")',
            'choice': '형식: [선지_1행/2행/5행] : (1_"내용")'
        };
        const getElementSelector = (kind) => selectorMap[kind] || null;
        const getElementIndex = (target, selector) => {
            if (!target || !selector) return -1;
            const wrap = target.closest('.block-wrapper');
            if (!wrap) return -1;
            const nodes = Array.from(wrap.querySelectorAll(selector));
            return nodes.indexOf(target);
        };
        const resolveTargetFromRef = (ref) => {
            if (!ref) return null;
            if (ref.node && ref.node.isConnected) return ref.node;
            if (!ref.blockId || !ref.selector) return null;
            const wrap = document.querySelector(`.block-wrapper[data-id="${ref.blockId}"]`);
            if (!wrap) return null;
            const nodes = Array.from(wrap.querySelectorAll(ref.selector));
            if (!nodes.length) return null;
            const idx = Number.isInteger(ref.index) ? ref.index : -1;
            return (idx >= 0 && idx < nodes.length) ? nodes[idx] : nodes[0];
        };
        const resolveActiveElement = () => resolveTargetFromRef(activeElement);
        const resolveActiveEditTarget = () => resolveTargetFromRef(activeEdit);
        const buildMathToken = (mjx) => {
            if (!mjx) return '';
            const tex = mjx.getAttribute('data-tex') || '';
            if (!tex) return '';
            const isDisplay = mjx.getAttribute('display') === 'true';
            return isDisplay ? `$$${tex}$$` : `$${tex}$`;
        };
        const buildEditToken = (kind, target) => {
            if (!target) return '';
            if (kind === 'math') return buildMathToken(target);
            if (kind === 'concept-blank') return buildConceptBlankToken(target);
            if (kind === 'blank') return buildBlankToken(target);
            if (kind === 'image') return buildImageToken(target);
            if (kind === 'rect-box') return buildRectBoxTokenData(target).text;
            if (kind === 'custom-box') return buildCustomBoxTokenData(target).text;
            if (kind === 'table') return Utils.serializeEditorTable(target);
            if (kind === 'choice') return Utils.serializeChoiceTable(target);
            return '';
        };
        const openEditModalForTarget = (kind, target) => {
            if (!elementEditModal || !elementEditTextarea) return;
            if (!target) {
                Utils.showToast('편집할 대상을 찾지 못했습니다.', 'info');
                return;
            }
            const selector = getElementSelector(kind);
            const index = getElementIndex(target, selector);
            const blockId = target.closest('.block-wrapper')?.dataset?.id || null;
            const token = buildEditToken(kind, target);
            if (!token) {
                Utils.showToast('편집할 내용을 찾지 못했습니다.', 'info');
                return;
            }
            activeEdit = { kind, blockId, selector, index, node: target };
            if (elementEditTitle) {
                elementEditTitle.textContent = `${labelMap[kind] || '요소'} 편집`;
            }
            if (elementEditHint) {
                elementEditHint.textContent = editHintMap[kind] || '';
            }
            elementEditTextarea.value = token;
            Utils.openModal('element-edit-modal');
            setTimeout(() => {
                elementEditTextarea.focus();
                elementEditTextarea.select();
            }, 0);
        };
        const applyActiveEdit = async () => {
            if (!activeEdit || !elementEditTextarea) return;
            const rawValue = elementEditTextarea.value ?? '';
            if (!rawValue.trim()) {
                Utils.showToast('내용이 비어 있습니다.', 'info');
                return;
            }
            const target = resolveActiveEditTarget();
            if (!target) {
                Utils.showToast('편집 대상을 찾지 못했습니다.', 'error');
                Utils.closeModal('element-edit-modal');
                activeEdit = null;
                return;
            }
            const frag = buildTokenFragmentFromLines(String(rawValue).split(/\r?\n/));
            target.replaceWith(frag);

            const blockId = activeEdit.blockId;
            if (blockId) Renderer.syncBlock(blockId, true);

            const wrap = blockId ? document.querySelector(`.block-wrapper[data-id="${blockId}"]`) : null;
            const box = wrap ? wrap.querySelector('.editable-box') : null;
            const needsConceptSync = /\[개념빈칸[:_]/.test(rawValue) || activeEdit.kind === 'concept-blank' || activeEdit.kind === 'math';

            if (State.renderingEnabled && box) {
                if (needsConceptSync) {
                    await Renderer.updateConceptBlankSummary({ changedBlockId: blockId || null });
                } else {
                    await ManualRenderer.typesetElement(box);
                    Renderer.updatePreflightPanel();
                }
            } else {
                Renderer.updatePreflightPanel();
            }
            Renderer.debouncedRebalance();
            Utils.closeModal('element-edit-modal');
            activeEdit = null;
        };
        const openElementMenu = (target, kind) => {
            if (!elementMenu || !target) return;
            const selector = getElementSelector(kind);
            const index = getElementIndex(target, selector);
            activeElement = {
                node: target,
                kind,
                blockId: target.closest('.block-wrapper')?.dataset?.id || null,
                selector,
                index
            };
            if (elementMenuTitle) {
                elementMenuTitle.textContent = `${labelMap[kind] || '요소'} 편집`;
            }
            if (elementMenuUnblankRow) {
                const showUnblank = kind === 'concept-blank';
                elementMenuUnblankRow.style.display = showUnblank ? 'flex' : 'none';
            }
            elementMenu.style.display = 'flex';
            const rect = target.getBoundingClientRect();
            const menuRect = elementMenu.getBoundingClientRect();
            const pad = 8;
            let top = rect.top + window.scrollY - menuRect.height - 8;
            if (top < window.scrollY + pad) top = rect.bottom + window.scrollY + 8;
            let left = rect.left + window.scrollX + (rect.width / 2) - (menuRect.width / 2);
            left = Math.min(Math.max(left, window.scrollX + pad), window.scrollX + window.innerWidth - pad - menuRect.width);
            top = Math.min(Math.max(top, window.scrollY + pad), window.scrollY + window.innerHeight - pad - menuRect.height);
            elementMenu.style.top = `${top}px`;
            elementMenu.style.left = `${left}px`;
        };
        let mathDragState = null;
        let mathSelectionRaf = null;
        const highlightedMath = new Set();
        const clearMathSelectionHighlight = () => {
            highlightedMath.forEach(node => node.classList.remove('math-selected'));
            highlightedMath.clear();
        };
        const updateMathSelectionHighlight = () => {
            clearMathSelectionHighlight();
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
            const range = sel.getRangeAt(0);
            let root = range.commonAncestorContainer;
            if (root && root.nodeType !== Node.ELEMENT_NODE) root = root.parentNode;
            if (!root) return;
            let scope = root.closest ? root.closest('.editable-box') : null;
            if (!scope) scope = document.getElementById('paper-container') || document;
            scope.querySelectorAll('mjx-container').forEach((node) => {
                try {
                    if (range.intersectsNode(node)) {
                        node.classList.add('math-selected');
                        highlightedMath.add(node);
                    }
                } catch (err) { }
            });
        };
        const scheduleMathSelectionHighlight = () => {
            if (mathSelectionRaf) return;
            mathSelectionRaf = requestAnimationFrame(() => {
                mathSelectionRaf = null;
                updateMathSelectionHighlight();
            });
        };
        const showFloatingToolbarForRange = (range) => {
            const container = range.commonAncestorContainer.nodeType === 1
                ? range.commonAncestorContainer
                : range.commonAncestorContainer.parentNode;
            if (!container) return false;
            const box = container.closest('.editable-box');
            if (!box) return false;
            const rect = range.getBoundingClientRect();
            const tb = document.getElementById('floating-toolbar');
            if (!tb) return false;
            const desiredTop = rect.top + window.scrollY - 45;
            const desiredLeft = rect.left + window.scrollX + rect.width / 2;
            tb.style.display = 'flex';
            tb.style.top = desiredTop + 'px';
            tb.style.left = desiredLeft + 'px';

            const pad = 8;
            const tbRect = tb.getBoundingClientRect();
            let top = desiredTop; let left = desiredLeft;
            if (tbRect.left < pad) left += pad - tbRect.left;
            if (tbRect.right > window.innerWidth - pad) left -= tbRect.right - (window.innerWidth - pad);
            if (tbRect.top < pad) top += pad - tbRect.top;
            if (tbRect.bottom > window.innerHeight - pad) top -= tbRect.bottom - (window.innerHeight - pad);
            tb.style.top = top + 'px';
            tb.style.left = left + 'px';

            State.selectionRange = range.cloneRange();
            const wrap = container.closest('.block-wrapper');
            State.selectionBlockId = wrap ? wrap.dataset.id : null;
            return true;
        };

        const floatingToolbar = document.getElementById('floating-toolbar');
        if (floatingToolbar) {
            floatingToolbar.addEventListener('mousedown', (e) => {
                const btn = e.target.closest('.ft-btn');
                if (!btn) return;
                const action = btn.dataset.action;
                if (action === 'concept-blank') {
                    eventsApi.applyConceptBlankToSelection();
                    return;
                }
                const cmd = btn.dataset.cmd;
                if (!cmd) return;
                const value = btn.dataset.value || null;
                document.execCommand(cmd, false, value);
            });
            floatingToolbar.addEventListener('change', (e) => {
                const target = e.target;
                if (target.id === 'ft-font-family') {
                    eventsApi.applyInlineFontFamily(target.value);
                    return;
                }
                if (target.id === 'ft-font-size') {
                    eventsApi.applyInlineFontSize(target.value);
                }
            });
        }

        const paperContainer = document.getElementById('paper-container');
        if (paperContainer) {
            paperContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.block-action-btn');
                if (!btn) return;
                const action = btn.dataset.action;
                const wrap = btn.closest('.block-wrapper');
                const id = wrap ? wrap.dataset.id : null;
                if (!action || !id) return;
                e.preventDefault();
                e.stopPropagation();
                if (action === 'add-break') {
                    Renderer.performAndRender(() => Actions.addBlockBelow('break', id));
                    return;
                }
                if (action === 'add-spacer') {
                    Renderer.performAndRender(() => Actions.addBlockBelow('spacer', id));
                }
            });
        }

        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.modal-close');
            if (closeBtn) {
                const modalId = closeBtn.dataset.modal;
                if (modalId) Utils.closeModal(modalId);
                return;
            }

            const actionEl = e.target.closest('[data-action]');
            if (!actionEl) return;
            const action = actionEl.dataset.action;
            if (!action) return;

            if (action === 'open-modal') {
                e.preventDefault();
                const modalId = actionEl.dataset.modal;
                if (!modalId) return;
                Utils.openModal(modalId);
                const focusId = actionEl.dataset.focus;
                if (focusId) {
                    const focusEl = document.getElementById(focusId);
                    if (focusEl) focusEl.focus();
                }
                return;
            }
            if (action === 'close-modal') {
                e.preventDefault();
                const modalId = actionEl.dataset.modal;
                if (modalId) Utils.closeModal(modalId);
                if (modalId === 'element-edit-modal') activeEdit = null;
                return;
            }
            if (action === 'confirm-import') {
                e.preventDefault();
                const overwrite = actionEl.dataset.overwrite === 'true';
                const normalizeLlm = document.getElementById('setting-normalize-llm');
                const didImport = Actions.confirmImport(
                    document.getElementById('import-textarea').value.trim(),
                    overwrite,
                    parseInt(document.getElementById('setting-limit').value) || 0,
                    document.getElementById('setting-spacer').checked,
                    normalizeLlm ? normalizeLlm.checked : false
                );
                if (didImport) { Renderer.renderPages(); ManualRenderer.renderAll(); }
                return;
            }
            if (action === 'execute-find-replace') {
                e.preventDefault();
                const f = document.getElementById('fr-find-input').value;
                const r = document.getElementById('fr-replace-input').value;
                if (!f) return;
                let replaceCount = 0;
                State.docData.blocks.forEach(b => {
                    if (!b.content) return;
                    let idx = b.content.indexOf(f);
                    if (idx === -1) return;
                    while (idx !== -1) { replaceCount++; idx = b.content.indexOf(f, idx + f.length); }
                    b.content = b.content.replaceAll(f, r);
                });
                Renderer.renderPages();
                ManualRenderer.renderAll();
                State.saveHistory();
                Utils.closeModal('find-replace-modal');
                Utils.showToast(`"${f}" → "${r}" ${replaceCount}건 바꿈`, replaceCount ? 'success' : 'info');
                return;
            }
            if (action === 'print-with-math') {
                e.preventDefault();
                eventsApi.printWithMath();
                return;
            }
            if (action === 'print-preflight') {
                e.preventDefault();
                const mode = actionEl.dataset.mode;
                if (mode) eventsApi.printPreflightAction(mode);
                return;
            }
            if (action === 'open-patch-notes') {
                e.preventDefault();
                eventsApi.openPatchNotes();
                return;
            }
            if (action === 'save-project') {
                e.preventDefault();
                FileSystem.saveProjectJSON(() => Renderer.syncAllBlocks());
                return;
            }
            if (action === 'reset-project') {
                e.preventDefault();
                eventsApi.resetProject();
                return;
            }
            if (action === 'open-file-dialog') {
                e.preventDefault();
                const input = document.getElementById('fileInput');
                if (input) input.click();
                return;
            }
            if (action === 'open-project-folder') {
                e.preventDefault();
                FileSystem.openProjectFolder();
                return;
            }
            if (action === 'download-prompt') {
                e.preventDefault();
                eventsApi.downloadPromptFile(actionEl);
                return;
            }
            if (action === 'undo') {
                e.preventDefault();
                if (State.undo()) { Renderer.renderPages(); ManualRenderer.renderAll(); }
                return;
            }
            if (action === 'redo') {
                e.preventDefault();
                if (State.redo()) { Renderer.renderPages(); ManualRenderer.renderAll(); }
                return;
            }
            if (action === 'insert-image-box') {
                e.preventDefault();
                if (actionEl.getAttribute('data-disabled') === 'true') return;
                eventsApi.insertImageBoxSafe();
                return;
            }
            if (action === 'split-block') {
                e.preventDefault();
                Renderer.performAndRender(() => eventsApi.splitBlockAtCursor());
                return;
            }
            if (action === 'insert-image-placeholder') {
                e.preventDefault();
                eventsApi.insertImagePlaceholderAtEnd();
                return;
            }
            if (action === 'add-spacer') {
                e.preventDefault();
                Renderer.performAndRender(() => Actions.addBlockBelow('spacer'));
                return;
            }
            if (action === 'add-break') {
                e.preventDefault();
                Renderer.performAndRender(() => Actions.addBlockBelow('break'));
                return;
            }
            if (action === 'toggle-gray-bg') {
                e.preventDefault();
                if (Actions.toggleStyle('bgGray')) { Renderer.renderPages(); ManualRenderer.renderAll(); }
                return;
            }
            if (action === 'toggle-border') {
                e.preventDefault();
                if (Actions.toggleStyle('bordered')) { Renderer.renderPages(); ManualRenderer.renderAll(); }
                return;
            }
            if (action === 'apply-align') {
                e.preventDefault();
                const align = actionEl.dataset.align;
                if (align && Actions.applyAlign(align)) { Renderer.renderPages(); ManualRenderer.renderAll(); }
                return;
            }
            if (action === 'duplicate-block') {
                e.preventDefault();
                if (Actions.duplicateTargetBlock()) { Renderer.renderPages(); ManualRenderer.renderAll(); }
                return;
            }
            if (action === 'add-block-above') {
                e.preventDefault();
                const type = actionEl.dataset.type || 'example';
                if (Actions.addBlockAbove(type)) { Renderer.renderPages(); ManualRenderer.renderAll(); }
                return;
            }
            if (action === 'add-block-below') {
                e.preventDefault();
                const type = actionEl.dataset.type || 'example';
                if (Actions.addBlockBelow(type)) { Renderer.renderPages(); ManualRenderer.renderAll(); }
                return;
            }
            if (action === 'apply-block-font') {
                e.preventDefault();
                eventsApi.applyBlockFontFromMenu();
                return;
            }
            if (action === 'delete-block') {
                e.preventDefault();
                if (State.contextTargetId && Actions.deleteBlockById(State.contextTargetId)) {
                    Renderer.renderPages();
                    ManualRenderer.renderAll();
                }
                Utils.closeModal('context-menu');
                return;
            }
            if (action === 'toggle-rendering') {
                e.preventDefault();
                eventsApi.toggleRenderingMode();
                return;
            }
            if (action === 'render-all') {
                e.preventDefault();
                eventsApi.renderAllSafe();
                return;
            }
            if (action === 'apply-element-edit') {
                e.preventDefault();
                applyActiveEdit();
                return;
            }
            if (action === 'resolve-confirm') {
                e.preventDefault();
                Utils.resolveConfirm(actionEl.dataset.result === 'true');
            }
        });

        body.addEventListener('dragover', (e) => {
            if (State.dragSrcId) return;
            if (!isFileDrag(e)) return;
            e.preventDefault();
            body.classList.add('drag-over');
        });
        body.addEventListener('dragleave', (e) => { if(!e.relatedTarget) body.classList.remove('drag-over'); });
        
        body.addEventListener('drop', (e) => {
            if(State.dragSrcId) return; 
            if (!isFileDrag(e)) { body.classList.remove('drag-over'); return; }
            e.preventDefault(); body.classList.remove('drag-over');
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if(file) {
                if(file.name.endsWith('.json')) {
                    const r = new FileReader();
                    r.onload = async (ev) => {
                        try {
                            const parsed = JSON.parse(ev.target.result);
                            if (!parsed || typeof parsed !== 'object' || !parsed.data || !parsed.settings) {
                                throw new Error('지원하지 않는 파일 형식입니다.');
                            }
                            State.applyProjectData(parsed, { sanitize: true });
                            await FileSystem.loadImagesForDisplay(State.docData.blocks);
                            Renderer.renderPages();
                            ManualRenderer.renderAll();
                            State.saveHistory();
                        } catch(err){ alert("로드 실패"); }
                    };
                    r.readAsText(file);
                } else if (file.type === 'text/plain' || /\.txt$/i.test(file.name)) {
                    const r = new FileReader(); r.onload = (ev) => { document.getElementById('import-textarea').value = ev.target.result; Utils.openModal('import-modal'); }; r.readAsText(file);
                }
            }
        });

        const preflightPanel = document.getElementById('preflight-panel');
        if (preflightPanel) {
            preflightPanel.addEventListener('click', (e) => {
                const item = e.target.closest('.preflight-item');
                if (!item) return;
                Renderer.jumpToPreflight(item.dataset.type);
            });
        }
        document.addEventListener('preflight:update', () => Renderer.updatePreflightPanel());
        document.addEventListener('conceptblanks:update', async () => {
            await Renderer.refreshConceptBlankAnswerBlocks();
        });

        const tableEditor = createTableEditor({
            openEditModal: ({ kind, target }) => openEditModalForTarget(kind, target)
        });
        tableEditor.init();
        this.updateImageInsertAvailability();

        // [Fix] 스크롤 시 팝업 닫기 추가
        window.addEventListener('scroll', () => {
            document.getElementById('context-menu').style.display = 'none';
            document.getElementById('floating-toolbar').style.display = 'none';
            closeMathMenu();
            closeElementMenu();
            tableEditor.handleScroll();
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                tableEditor.handleEscape();
                Utils.resolveConfirm(false);
                Utils.closeModal('context-menu');
                document.getElementById('floating-toolbar').style.display='none';
                closeMathMenu();
                closeElementMenu();
                this.hideResizer();
                Utils.closeModal('import-modal');
                Utils.closeModal('find-replace-modal');
                Utils.closeModal('element-edit-modal');
                activeEdit = null;
                return;
            }
            const key = e.key.toLowerCase();
            State.keysPressed[key] = true; 
            if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && key === 'i') {
                e.preventDefault();
                Utils.openModal('import-modal');
                const ta = document.getElementById('import-textarea');
                if (ta) ta.focus();
                return;
            }
            if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && key === 'n') {
                e.preventDefault();
                eventsApi.resetProject();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && key === 'o') {
                e.preventDefault();
                const fileInput = document.getElementById('fileInput');
                if (fileInput) fileInput.click();
                return;
            }
            if (!isTypingTarget() && key === 'delete') {
                if (State.contextTargetId && Actions.deleteBlockById(State.contextTargetId)) {
                    e.preventDefault();
                    Renderer.renderPages();
                    ManualRenderer.renderAll();
                }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'f') { e.preventDefault(); Utils.openModal('find-replace-modal'); document.getElementById('fr-find-input').focus(); return; } 
            if ((e.ctrlKey || e.metaKey) && key === 's') { e.preventDefault(); FileSystem.saveProjectJSON(() => Renderer.syncAllBlocks()); return; } 
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'z') { e.preventDefault(); if(State.redo()) { Renderer.renderPages(); ManualRenderer.renderAll(); } return; } 
            else if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); if(State.undo()) { Renderer.renderPages(); ManualRenderer.renderAll(); } return; } 
        });
        document.addEventListener('keyup', (e) => State.keysPressed[e.key.toLowerCase()] = false);

        const findMathContainerFromNode = (node) => {
            let current = node;
            while (current) {
                if (current.nodeType === Node.ELEMENT_NODE) {
                    const tag = current.tagName ? current.tagName.toLowerCase() : '';
                    if (tag === 'mjx-container') return current;
                    if (current.classList && current.classList.contains('math-atom')) return current;
                    if (current.getAttribute && current.getAttribute('data-tex')) return current;
                }
                if (current.parentNode) {
                    current = current.parentNode;
                    continue;
                }
                const root = typeof current.getRootNode === 'function' ? current.getRootNode() : null;
                current = root && root.host ? root.host : null;
            }
            return null;
        };

        const findMathContainerFromPoint = (x, y, fallbackRoot = null) => {
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            const elements = typeof document.elementsFromPoint === 'function'
                ? document.elementsFromPoint(x, y)
                : [document.elementFromPoint(x, y)].filter(Boolean);
            for (const el of elements) {
                const found = findMathContainerFromNode(el);
                if (found) return found;
            }
            let root = fallbackRoot || null;
            if (!root) {
                for (const el of elements) {
                    if (el && el.closest) {
                        root = el.closest('.editable-box');
                        if (root) break;
                    }
                }
            }
            if (!root) return null;
            const mjxNodes = Array.from(root.querySelectorAll('mjx-container'));
            for (const node of mjxNodes) {
                const rect = node.getBoundingClientRect();
                if (x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - 2 && y <= rect.bottom + 2) {
                    return node;
                }
            }
            return null;
        };

        const findMathTargetFromEvent = (evt) => {
            if (!evt) return null;
            const path = typeof evt.composedPath === 'function' ? evt.composedPath() : null;
            if (path && path.length) {
                for (const node of path) {
                    const found = findMathContainerFromNode(node);
                    if (found) return found;
                }
            }
            const direct = findMathContainerFromNode(evt.target);
            if (direct) return direct;
            const fallbackRoot = evt.target && evt.target.closest ? evt.target.closest('.editable-box') : null;
            return findMathContainerFromPoint(evt.clientX, evt.clientY, fallbackRoot);
        };

        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('#floating-toolbar') && !e.target.closest('.ft-btn')) document.getElementById('floating-toolbar').style.display='none'; 
            if (!e.target.closest('img') && !e.target.closest('#image-resizer')) this.hideResizer(); 
            if (!e.target.closest('#floating-toolbar') && !e.target.closest('.editable-box')) {
                State.selectionRange = null;
                State.selectionBlockId = null;
            }
            const menu = document.getElementById('context-menu');
            if (menu && menu.style.display === 'block') { if (!e.target.closest('#context-menu') && !e.target.closest('.block-handle')) menu.style.display = 'none'; }
            if (!e.target.closest('.image-placeholder') && !e.target.closest('#imgUpload')) { if(State.selectedPlaceholder) { State.selectedPlaceholder.classList.remove('selected'); State.selectedPlaceholder.setAttribute('contenteditable', 'false'); } State.selectedPlaceholder = null; } 
            if (!e.target.closest('#element-menu')) closeElementMenu();
            if (!e.target.closest('#math-menu') && !e.target.closest('mjx-container')) closeMathMenu();
            const mjx = findMathTargetFromEvent(e);
            mathDragState = mjx ? { target: mjx, x: e.clientX, y: e.clientY } : null;
            tableEditor.handleDocumentMouseDown(e);
        });
        document.addEventListener('mouseup', (e) => {
            const target = e.target;
            const dragCandidate = mathDragState
                ? { target: mathDragState.target, dx: e.clientX - mathDragState.x, dy: e.clientY - mathDragState.y }
                : null;
            mathDragState = null;
            setTimeout(() => {
                const sel = window.getSelection();
                let range = null;
                if (sel.rangeCount && !sel.isCollapsed) {
                    range = sel.getRangeAt(0);
                } else if (dragCandidate && dragCandidate.target) {
                    const distance = Math.hypot(dragCandidate.dx, dragCandidate.dy);
                    if (distance > 3) {
                        range = document.createRange();
                        range.selectNode(dragCandidate.target);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
                if (range) {
                    if (showFloatingToolbarForRange(range)) {
                        scheduleMathSelectionHighlight();
                        return;
                    }
                }
                if (!target.closest('#floating-toolbar')) {
                    State.selectionRange = null;
                    State.selectionBlockId = null;
                }
                scheduleMathSelectionHighlight();
            }, 10);
        });
        document.addEventListener('selectionchange', () => {
            scheduleMathSelectionHighlight();
            eventsApi.updateImageInsertAvailability();
        });

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.image-load-btn');
            if (!btn) return;
            const placeholder = btn.closest('.image-placeholder');
            if (!placeholder) return;
            e.preventDefault(); e.stopPropagation();
            if(State.selectedPlaceholder) State.selectedPlaceholder.classList.remove('selected');
            State.selectedPlaceholder = placeholder;
            placeholder.classList.add('selected');
            placeholder.setAttribute('contenteditable', 'false');
            document.getElementById('imgUpload').click();
        });

        if (mathMenu) {
            mathMenu.addEventListener('click', async (e) => {
                const btn = e.target.closest('[data-action]');
                const splitBtn = e.target.closest('[data-split-index]');
                if ((!btn && !splitBtn) || !activeMath) return;
                e.preventDefault(); e.stopPropagation();
                const targetMath = activeMath;
                const wrap = targetMath.closest('.block-wrapper');
                const id = wrap ? wrap.dataset.id : null;
                if (btn) {
                    const action = btn.dataset.action;
                    closeMathMenu();
                    if (action === 'edit') {
                        openEditModalForTarget('math', targetMath);
                        return;
                    }
                    if (action === 'copy') {
                        const tex = targetMath.getAttribute('data-tex') || '';
                        if (!tex) {
                            Utils.showToast('수식 정보를 찾지 못했습니다.', 'info');
                            return;
                        }
                        const isDisplay = targetMath.getAttribute('display') === 'true';
                        const mathSource = isDisplay ? `$$${tex}$$` : `$${tex}$`;
                        const ok = await Utils.copyText(mathSource);
                        Utils.showToast(ok ? '수식이 복사되었습니다.' : '복사에 실패했습니다.', ok ? 'success' : 'error');
                        return;
                    }
                    if (action === 'delete') {
                        const tex = targetMath.getAttribute('data-tex') || '';
                        if (!tex) {
                            Utils.showToast('수식 정보를 찾지 못했습니다.', 'info');
                            return;
                        }
                        const confirmed = await Utils.confirmDialog('수식을 삭제하겠습니까?');
                        if (!confirmed) return;
                        targetMath.remove();
                        if (id) Renderer.syncBlock(id, true);
                        if (/\[개념빈칸[:_]/.test(tex)) {
                            Renderer.updateConceptBlankSummary({ changedBlockId: id || null });
                        }
                        return;
                    }
                    if (action === 'unblank') {
                        const tex = targetMath.getAttribute('data-tex') || '';
                        if (!tex) {
                            Utils.showToast('수식 정보를 찾지 못했습니다.', 'info');
                            return;
                        }
                        const cleanedTex = stripConceptBlankTokens(tex);
                        if (cleanedTex === tex) {
                            Utils.showToast('개념빈칸이 없습니다.', 'info');
                            return;
                        }
                        const confirmed = await Utils.confirmDialog('개념빈칸을 없애겠습니까?');
                        if (!confirmed) return;
                        const isDisplay = targetMath.getAttribute('display') === 'true';
                        const mathSource = isDisplay ? `$$${cleanedTex}$$` : `$${cleanedTex}$`;
                        targetMath.replaceWith(document.createTextNode(mathSource));
                        if (id) Renderer.syncBlock(id, true);
                        Renderer.updateConceptBlankSummary({ changedBlockId: id || null });
                        return;
                    }
                    if (action === 'blank') {
                        const tex = targetMath.getAttribute('data-tex') || '';
                        if (!tex) {
                            Utils.showToast('수식 정보를 찾지 못했습니다.', 'info');
                            return;
                        }
                        const isDisplay = targetMath.getAttribute('display') === 'true';
                        const mathSource = isDisplay ? `$$${tex}$$` : `$${tex}$`;
                        const token = `[개념빈칸:#]${mathSource}[/개념빈칸]`;
                        targetMath.replaceWith(document.createTextNode(token));
                        if (id) Renderer.syncBlock(id, true);
                        Renderer.updateConceptBlankSummary({ changedBlockId: id || null });
                        return;
                    }
                    return;
                }
                if (splitBtn) {
                    const splitIndex = parseInt(splitBtn.dataset.splitIndex, 10);
                    closeMathMenu();
                    const didSplit = eventsApi.splitMathAtIndex(targetMath, splitIndex);
                    if (didSplit && id) {
                        Renderer.syncBlock(id);
                        ManualRenderer.renderAll();
                    }
                }
            });
        }
        if (elementMenu) {
            elementMenu.addEventListener('click', async (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn || !activeElement) return;
                e.preventDefault(); e.stopPropagation();
                const action = btn.dataset.action;
                const target = resolveActiveElement();
                const wrapId = activeElement.blockId;
                if (!target) {
                    closeElementMenu();
                    return;
                }
                if (action === 'edit') {
                    openEditModalForTarget(activeElement.kind, target);
                    closeElementMenu();
                    return;
                }
                if (action === 'copy') {
                    let token = '';
                    if (activeElement.kind === 'concept-blank') token = buildConceptBlankToken(target);
                    else if (activeElement.kind === 'blank') token = buildBlankToken(target);
                    else if (activeElement.kind === 'image') token = buildImageToken(target);
                    else if (activeElement.kind === 'rect-box') token = buildRectBoxTokenData(target).text;
                    else if (activeElement.kind === 'custom-box') token = buildCustomBoxTokenData(target).text;
                    if (!token) {
                        Utils.showToast('복사할 내용이 없습니다.', 'info');
                        return;
                    }
                    const ok = await Utils.copyText(token);
                    Utils.showToast(ok ? '복사되었습니다.' : '복사에 실패했습니다.', ok ? 'success' : 'error');
                    return;
                }
                if (action === 'delete') {
                    const confirmed = await Utils.confirmDialog('요소를 삭제하겠습니까?');
                    if (!confirmed) return;
                    target.remove();
                    if (wrapId) Renderer.syncBlock(wrapId, true);
                    if (activeElement.kind === 'concept-blank') {
                        Renderer.updateConceptBlankSummary({ changedBlockId: wrapId || null });
                    }
                    closeElementMenu();
                    return;
                }
                if (action === 'unblank') {
                    if (activeElement.kind !== 'concept-blank') return;
                    const dataset = target.dataset || {};
                    const answerSource = dataset.answer ? decodeHtml(dataset.answer) : '';
                    const confirmed = await Utils.confirmDialog('개념빈칸을 없애겠습니까?');
                    if (!confirmed) return;
                    const frag = answerSource
                        ? buildTokenFragmentFromLines(answerSource.split(/\r?\n/))
                        : document.createDocumentFragment();
                    target.replaceWith(frag);
                    if (wrapId) Renderer.syncBlock(wrapId, true);
                    await Renderer.updateConceptBlankSummary({ changedBlockId: wrapId || null });
                    closeElementMenu();
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#math-menu')) closeMathMenu();
            if (!e.target.closest('#element-menu')) closeElementMenu();
        });
        
        document.addEventListener('dblclick', (e) => {
            if (!State.renderingEnabled) return;
            if (e.target.closest('#math-menu') || e.target.closest('#element-menu')) return;
            const mjx = findMathTargetFromEvent(e);
            if (mjx) {
                closeElementMenu();
                openMathMenu(mjx);
                e.preventDefault(); e.stopPropagation();
                return;
            }
            const blank = e.target.closest('.blank-box');
            if (blank) {
                closeMathMenu();
                const kind = blank.dataset && blank.dataset.blankKind === 'concept' ? 'concept-blank' : 'blank';
                openElementMenu(blank, kind);
                e.preventDefault(); e.stopPropagation();
                return;
            }
            const placeholder = e.target.closest('.image-placeholder');
            if (placeholder) {
                closeMathMenu();
                openElementMenu(placeholder, 'image');
                e.preventDefault(); e.stopPropagation();
                return;
            }
            if (tableEditor.handleDoubleClick(e)) {
                closeMathMenu();
                closeElementMenu();
                return;
            }
            const rectBox = e.target.closest('.rect-box');
            if (rectBox) {
                closeMathMenu();
                openElementMenu(rectBox, 'rect-box');
                e.preventDefault(); e.stopPropagation();
                return;
            }
            const customBox = e.target.closest('.custom-box');
            if (customBox) {
                closeMathMenu();
                openElementMenu(customBox, 'custom-box');
                e.preventDefault(); e.stopPropagation();
                return;
            }
        });
        document.addEventListener('paste', async (e) => {
            let target = null; if (State.selectedPlaceholder && State.selectedPlaceholder.getAttribute('contenteditable') === 'false') target = State.selectedPlaceholder; else { const sel = window.getSelection(); if (sel.rangeCount) { const node = sel.anchorNode; const el = node.nodeType === 1 ? node : node.parentElement; if (el.closest('.editable-box')) target = 'cursor'; } } 
            const clipboard = e.clipboardData || e.originalEvent.clipboardData;
            if (!clipboard) return;
            const items = clipboard.items || []; 
            for (let item of items) { 
                if (item.kind === 'file' && item.type.includes('image/')) { 
                    if(!target) return; e.preventDefault(); const file = item.getAsFile(); 
                    let saved = null; 
                    if(FileSystem.dirHandle) saved = await FileSystem.saveImage(file); 
                    else { const reader = new FileReader(); saved = await new Promise(r => { reader.onload=ev=>r({url:ev.target.result, path:null}); reader.readAsDataURL(file); }); } 
                    if(!saved) return; 
                    const newImg = document.createElement('img'); newImg.src = saved.url; if(saved.path) newImg.dataset.path = saved.path; newImg.style.maxWidth = '100%'; 
                    if (target === State.selectedPlaceholder) { target.replaceWith(newImg); Actions.updateBlockContent(newImg.closest('.block-wrapper').dataset.id, newImg.closest('.editable-box').innerHTML); State.selectedPlaceholder = null; } 
                    else if (target === 'cursor') { document.execCommand('insertHTML', false, newImg.outerHTML); } 
                    State.saveHistory(500); return; 
                } 
            } 
            if (target === 'cursor') {
                const htmlData = clipboard.getData('text/html');
                if (htmlData) {
                    e.preventDefault();
                    const sanitized = Utils.sanitizeHtml(htmlData);
                    if (sanitized) {
                        document.execCommand('insertHTML', false, sanitized);
                    } else {
                        const textData = clipboard.getData('text/plain');
                        if (textData) document.execCommand('insertText', false, textData);
                    }
                }
            }
        });

        const resizeHandle = document.querySelector('.resizer-handle');
        if(resizeHandle) resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation(); if(!State.selectedImage) return; 
            const startX = e.clientX, startY = e.clientY; const startW = State.selectedImage.offsetWidth, startH = State.selectedImage.offsetHeight; const zoom = State.settings.zoom || 1.0; 
            function doDrag(evt) { const newW = Math.max(20, startW + (evt.clientX - startX) / zoom); const newH = Math.max(20, startH + (evt.clientY - startY) / zoom); State.selectedImage.style.width = newW + 'px'; State.selectedImage.style.height = newH + 'px'; Events.showResizer(State.selectedImage); } 
            function stopDrag() { window.removeEventListener('mousemove', doDrag); window.removeEventListener('mouseup', stopDrag); Actions.updateBlockContent(State.selectedImage.closest('.block-wrapper').dataset.id, State.selectedImage.closest('.editable-box').innerHTML); } 
            window.addEventListener('mousemove', doDrag); window.addEventListener('mouseup', stopDrag); 
        });
    }
};
