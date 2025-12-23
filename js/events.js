// Filename: js/events.js
import { State } from './state.js';
import { Actions } from './actions.js';
import { Renderer } from './renderer.js'; // 순환 참조 아님 (내부 호출용)
import { ManualRenderer, FileSystem } from './services.js';
import { Utils } from './utils.js';
import { createTableEditor } from './table-editor.js';

export const Events = {
    showResizer(img) {
        State.selectedImage = img; 
        const resizer = document.getElementById('image-resizer'); 
        const rect = img.getBoundingClientRect(); 
        resizer.style.display = 'block'; resizer.style.top = (rect.top + window.scrollY) + 'px'; resizer.style.left = (rect.left + window.scrollX) + 'px'; resizer.style.width = rect.width + 'px'; resizer.style.height = rect.height + 'px';
    },
    hideResizer() { document.getElementById('image-resizer').style.display = 'none'; State.selectedImage = null; },

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
        const active = document.activeElement;
        if(active && active.isContentEditable) {
            const wrap = active.closest('.block-wrapper');
            const id = wrap ? wrap.dataset.id : null;
            document.execCommand('insertHTML', false, Utils.getImagePlaceholderHTML());
            if (id) {
                Actions.updateBlockContent(id, Utils.cleanRichContentToTex(active.innerHTML), true);
                Renderer.debouncedRebalance();
                State.lastEditableId = id;
            }
            return;
        }

        const targetId = State.lastEditableId || State.contextTargetId;
        if (targetId) {
            const box = document.querySelector(`.block-wrapper[data-id="${targetId}"] .editable-box`);
            if (box) {
                box.focus();
                const r = document.createRange(); r.selectNodeContents(box); r.collapse(false);
                const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
                document.execCommand('insertHTML', false, Utils.getImagePlaceholderHTML());
                Actions.updateBlockContent(targetId, Utils.cleanRichContentToTex(box.innerHTML), true);
                Renderer.debouncedRebalance();
                return;
            }
        }

        if(Actions.addBlockBelow('image')) {
            Renderer.renderPages();
            ManualRenderer.renderAll();
        }
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
        const envRegex = /\\begin\{(matrix|pmatrix|bmatrix|vmatrix|Vmatrix|array|aligned|align|cases)\}/;
        if (!tex) return { candidates: [], reason: '나눌 연산자가 없습니다.' };
        if (envRegex.test(tex)) return { candidates: [], reason: '정렬/행렬 수식은 나누기를 지원하지 않습니다.' };

        const operatorCommands = new Set(['le', 'leq', 'leqslant', 'ge', 'geq', 'geqslant', 'ne', 'neq']);
        const cdotsOperatorCommands = new Set(['times', 'cdot', 'ast']);
        const rawCandidates = [];
        let braceDepth = 0;
        let bracketDepth = 0;
        let parenDepth = 0;
        let awaitingCdotsOperator = false;

        for (let i = 0; i < tex.length; i++) {
            const ch = tex[i];
            if (ch === '\\') {
                const rest = tex.slice(i + 1);
                const match = rest.match(/^([a-zA-Z]+|.)/);
                if (match) {
                    const cmd = match[1];
                    const atTopLevel = braceDepth === 0 && bracketDepth === 0 && parenDepth === 0;
                    if (atTopLevel && cmd === 'cdots') {
                        awaitingCdotsOperator = true;
                        i += cmd.length;
                        continue;
                    }
                    if (atTopLevel && awaitingCdotsOperator && cdotsOperatorCommands.has(cmd)) {
                        rawCandidates.push({ index: i, token: `\\${cmd}` });
                        awaitingCdotsOperator = false;
                        i += cmd.length;
                        continue;
                    }
                    if (atTopLevel && operatorCommands.has(cmd)) {
                        rawCandidates.push({ index: i, token: `\\${cmd}` });
                    }
                    i += cmd.length;
                    continue;
                }
            }
            if (ch === '{') { braceDepth++; continue; }
            if (ch === '}') { braceDepth = Math.max(0, braceDepth - 1); continue; }
            if (ch === '[') { bracketDepth++; continue; }
            if (ch === ']') { bracketDepth = Math.max(0, bracketDepth - 1); continue; }
            if (ch === '(') { parenDepth++; continue; }
            if (ch === ')') { parenDepth = Math.max(0, parenDepth - 1); continue; }
            if (braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
                if (ch === '=' || ch === '<' || ch === '>') rawCandidates.push({ index: i, token: ch });
                if (awaitingCdotsOperator && (ch === '+' || ch === '-')) {
                    rawCandidates.push({ index: i, token: ch });
                    awaitingCdotsOperator = false;
                }
            }
        }

        const normalizeSpace = (value = '') => String(value).replace(/\s+/g, ' ').trim();
        const trimPreview = (value, maxLen, trimLeft) => {
            const text = normalizeSpace(value);
            if (text.length <= maxLen) return text;
            return trimLeft ? `...${text.slice(-maxLen)}` : `${text.slice(0, maxLen)}...`;
        };
        const stripOperator = (right, token) => {
            const cleaned = normalizeSpace(right);
            if (!token) return cleaned;
            if (cleaned.startsWith(token)) return normalizeSpace(cleaned.slice(token.length));
            if (token.length === 1 && cleaned[0] === token) return normalizeSpace(cleaned.slice(1));
            return cleaned;
        };

        const candidates = rawCandidates.map(candidate => {
            const left = tex.slice(0, candidate.index).trim();
            const right = tex.slice(candidate.index).trim();
            if (!left || !right) return null;
            const rightBody = stripOperator(right, candidate.token);
            if (!rightBody) return null;
            const leftPreview = trimPreview(left, 18, true) || '...';
            const rightPreview = trimPreview(rightBody, 18, false) || '...';
            return {
                index: candidate.index,
                token: candidate.token,
                leftPreview,
                rightPreview
            };
        }).filter(Boolean);

        return candidates.length
            ? { candidates, reason: '' }
            : { candidates: [], reason: '나눌 연산자가 없습니다.' };
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
            sizeInp.placeholder = State.docData.meta.fontSizePt || 10.5;
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
        State.lastEditableId = id;
        if(e.target.tagName==='IMG') { this.showResizer(e.target); e.stopPropagation(); State.selectedImage=e.target; }
        const placeholder = e.target.closest('.image-placeholder');
        if(placeholder) { e.stopPropagation(); if(State.selectedPlaceholder) State.selectedPlaceholder.classList.remove('selected'); State.selectedPlaceholder = placeholder; State.selectedPlaceholder.classList.add('selected'); State.selectedPlaceholder.setAttribute('contenteditable', 'false'); }
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

        const newBlock = Renderer.createConceptAnswerBlock(nextCapacity);
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

        const mathMenu = document.getElementById('math-menu');
        const mathMenuOps = mathMenu ? mathMenu.querySelector('.math-menu-ops') : null;
        let activeMath = null;
        const closeMathMenu = () => {
            if (mathMenu) mathMenu.style.display = 'none';
            activeMath = null;
        };
        const openMathMenu = (mjx) => {
            if (!mathMenu) return;
            activeMath = mjx;
            if (mathMenuOps) {
                const tex = mjx.getAttribute('data-tex') || '';
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
                    const r = new FileReader(); r.onload = async (ev) => { try { State.docData = JSON.parse(ev.target.result); await FileSystem.loadImagesForDisplay(State.docData.blocks); Renderer.renderPages(); ManualRenderer.renderAll(); State.saveHistory(); } catch(err){ alert("로드 실패"); } }; r.readAsText(file);
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

        const tableEditor = createTableEditor();
        tableEditor.init();

        // [Fix] 스크롤 시 팝업 닫기 추가
        window.addEventListener('scroll', () => {
            document.getElementById('context-menu').style.display = 'none';
            document.getElementById('floating-toolbar').style.display = 'none';
            closeMathMenu();
            tableEditor.handleScroll();
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                tableEditor.handleEscape();
                Utils.resolveConfirm(false);
                Utils.closeModal('context-menu'); document.getElementById('floating-toolbar').style.display='none'; closeMathMenu(); this.hideResizer(); Utils.closeModal('import-modal'); Utils.closeModal('find-replace-modal'); return;
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
                if (typeof window.resetProject === 'function') window.resetProject();
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
            if (!e.target.closest('#math-menu') && !e.target.closest('mjx-container')) closeMathMenu();
            const mjx = e.target.closest('mjx-container');
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
        document.addEventListener('selectionchange', scheduleMathSelectionHighlight);

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
            mathMenu.addEventListener('click', (e) => {
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
                        ManualRenderer.revertToSource(targetMath);
                        if (id) Renderer.syncBlock(id);
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

        document.addEventListener('click', (e) => {
            const mjx = e.target.closest('mjx-container');
            if (mjx && State.renderingEnabled) {
                const sel = window.getSelection();
                if (sel && sel.rangeCount && !sel.isCollapsed) {
                    try {
                        if (sel.containsNode(mjx, true)) return;
                    } catch (err) {
                        return;
                    }
                }
                openMathMenu(mjx);
                return;
            }
            if (!e.target.closest('#math-menu')) closeMathMenu();
        });
        
        document.addEventListener('dblclick', async (e) => {
            if (!State.renderingEnabled) return;
            if (tableEditor.handleDoubleClick(e)) return;
            const mjx = e.target.closest('mjx-container');
            if (mjx) {
                closeMathMenu();
                e.preventDefault(); e.stopPropagation();
                ManualRenderer.revertToSource(mjx);
                Renderer.syncBlock(mjx.closest('.block-wrapper').dataset.id);
                return;
            }
            const blank = e.target.closest('.blank-box');
            if (blank) {
                e.preventDefault(); e.stopPropagation();
                const dataset = blank.dataset || {};
                if (dataset.blankKind === 'concept') {
                    const decodeHtml = (value = '') => {
                        const tmp = document.createElement('div');
                        tmp.innerHTML = String(value);
                        return tmp.textContent || '';
                    };
                    const wrapEl = blank.closest('.block-wrapper');
                    const wrapId = wrapEl?.dataset?.id || null;
                    const blankMeta = {
                        index: dataset.index || '',
                        rawLabel: dataset.rawLabel !== undefined ? dataset.rawLabel : (dataset.label || ''),
                        answer: dataset.answer !== undefined ? dataset.answer : ''
                    };
                    const confirmed = await Utils.confirmDialog('개념빈칸을 없애겠습니까?');
                    if (!confirmed) return;
                    const wrap = wrapId
                        ? document.querySelector(`.block-wrapper[data-id="${wrapId}"]`)
                        : (wrapEl && wrapEl.isConnected ? wrapEl : null);
                    let targetBlank = blank.isConnected ? blank : null;
                    if (!targetBlank && wrap) {
                        const blanks = Array.from(wrap.querySelectorAll('.blank-box.concept-blank-box'));
                        if (blankMeta.index) {
                            targetBlank = blanks.find(node => node.dataset.index === blankMeta.index) || null;
                        }
                        if (!targetBlank) {
                            targetBlank = blanks.find(node => {
                                const raw = node.dataset.rawLabel !== undefined ? node.dataset.rawLabel : (node.dataset.label || '');
                                return (node.dataset.answer || '') === blankMeta.answer && raw === blankMeta.rawLabel;
                            }) || null;
                        }
                        if (!targetBlank && blanks.length === 1) targetBlank = blanks[0];
                    }
                    if (!targetBlank) return;
                    const answerSource = (targetBlank.dataset.answer !== undefined && targetBlank.dataset.answer !== '')
                        ? targetBlank.dataset.answer
                        : blankMeta.answer;
                    const answer = answerSource ? decodeHtml(answerSource) : '';
                    const frag = document.createDocumentFragment();
                    if (answer) {
                        const lines = answer.split(/\n/);
                        lines.forEach((line, idx) => {
                            frag.appendChild(document.createTextNode(line));
                            if (idx < lines.length - 1) frag.appendChild(document.createElement('br'));
                        });
                    }
                    targetBlank.replaceWith(frag);
                    if (wrapId) Renderer.syncBlock(wrapId, true);
                    await Renderer.updateConceptBlankSummary({ changedBlockId: wrapId || null });
                    return;
                } else {
                    const text = blank.innerText;
                    const delim = dataset.delim || ':';
                    blank.replaceWith(document.createTextNode(`[빈칸${delim}${text}]`));
                }
                Renderer.syncBlock(blank.closest('.block-wrapper').dataset.id);
                return;
            }
            const placeholder = e.target.closest('.image-placeholder');
            if (placeholder) {
                e.preventDefault(); e.stopPropagation();
                const wrap = placeholder.closest('.block-wrapper');
                const id = wrap ? wrap.dataset.id : null;
                const label = placeholder.dataset ? (placeholder.dataset.label || '') : '';
                placeholder.replaceWith(document.createTextNode(`[이미지:${label}]`));
                if (id) Renderer.syncBlock(id);
                return;
            }
            const rectBox = e.target.closest('.rect-box');
            if (rectBox) {
                e.preventDefault(); e.stopPropagation();
                const wrap = rectBox.closest('.block-wrapper');
                const id = wrap ? wrap.dataset.id : null;
                const contentEl = rectBox.querySelector('.rect-box-content');
                let bodyText = '';
                if (contentEl) {
                    const cleaned = Utils.cleanRichContentToTex(contentEl.innerHTML);
                    const tmp = document.createElement('div');
                    tmp.innerHTML = cleaned;
                    bodyText = (tmp.innerText || '').replace(/\u00A0/g, ' ').trim();
                }
                const frag = document.createDocumentFragment();
                frag.appendChild(document.createTextNode('[블록사각형]'));
                frag.appendChild(document.createElement('br'));
                if (bodyText) {
                    const lines = bodyText.split(/\n/);
                    lines.forEach((ln, idx) => {
                        frag.appendChild(document.createTextNode(ln));
                        if (idx < lines.length - 1) frag.appendChild(document.createElement('br'));
                    });
                }
                frag.appendChild(document.createElement('br'));
                frag.appendChild(document.createTextNode('[/블록사각형]'));
                rectBox.replaceWith(frag);
                if (id) Renderer.syncBlock(id);
                return;
            }
            const customBox = e.target.closest('.custom-box');
            if (customBox) {
                e.preventDefault(); e.stopPropagation();
                const wrap = customBox.closest('.block-wrapper');
                const id = wrap ? wrap.dataset.id : null;
                let labelText = '';
                const labelEl = customBox.querySelector('.box-label');
                if (labelEl) {
                    labelText = labelEl.textContent.replace(/[<>]/g, '').trim();
                }
                const contentEl = customBox.querySelector('.box-content');
                let bodyText = '';
                if (contentEl) {
                    const cleaned = Utils.cleanRichContentToTex(contentEl.innerHTML);
                    const tmp = document.createElement('div');
                    tmp.innerHTML = cleaned;
                    bodyText = (tmp.innerText || '').replace(/\u00A0/g, ' ').trim();
                }
                const startToken = labelText ? `[블록박스_${labelText}]` : `[블록박스_]`;
                const endToken = `[/블록박스]`;
                const frag = document.createDocumentFragment();
                frag.appendChild(document.createTextNode(startToken));
                frag.appendChild(document.createElement('br'));
                if (bodyText) {
                    const lines = bodyText.split(/\n/);
                    lines.forEach((ln, idx) => {
                        frag.appendChild(document.createTextNode(ln));
                        if (idx < lines.length - 1) frag.appendChild(document.createElement('br'));
                    });
                }
                frag.appendChild(document.createElement('br'));
                frag.appendChild(document.createTextNode(endToken));
                customBox.replaceWith(frag);
                if (id) Renderer.syncBlock(id);
                return;
            }
        });
        document.addEventListener('paste', async (e) => {
            let target = null; if (State.selectedPlaceholder && State.selectedPlaceholder.getAttribute('contenteditable') === 'false') target = State.selectedPlaceholder; else { const sel = window.getSelection(); if (sel.rangeCount) { const node = sel.anchorNode; const el = node.nodeType === 1 ? node : node.parentElement; if (el.closest('.editable-box')) target = 'cursor'; } } 
            const items = (e.clipboardData || e.originalEvent.clipboardData).items; 
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
        });

        const resizeHandle = document.querySelector('.resizer-handle');
        if(resizeHandle) resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation(); if(!State.selectedImage) return; 
            const startX = e.clientX, startY = e.clientY; const startW = State.selectedImage.offsetWidth, startH = State.selectedImage.offsetHeight; const zoom = State.docData.meta.zoom || 1.0; 
            function doDrag(evt) { const newW = Math.max(20, startW + (evt.clientX - startX) / zoom); const newH = Math.max(20, startH + (evt.clientY - startY) / zoom); State.selectedImage.style.width = newW + 'px'; State.selectedImage.style.height = newH + 'px'; Events.showResizer(State.selectedImage); } 
            function stopDrag() { window.removeEventListener('mousemove', doDrag); window.removeEventListener('mouseup', stopDrag); Actions.updateBlockContent(State.selectedImage.closest('.block-wrapper').dataset.id, State.selectedImage.closest('.editable-box').innerHTML); } 
            window.addEventListener('mousemove', doDrag); window.addEventListener('mouseup', stopDrag); 
        });
    }
};
