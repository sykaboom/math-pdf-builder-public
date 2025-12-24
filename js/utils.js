// Filename: js/utils.js
import { choiceLayoutGrid, normalizeChoiceLayout, getChoiceLayoutGrid, getChoiceColumnCount } from './choice-layout.js';
import { normalizeLlmOutput, protectMathEnvironments } from './math-logic.js';
export const Utils = {
    preservedClasses: ['custom-box', 'labeled-box', 'simple-box', 'box-label', 'box-content', 'rect-box', 'rect-box-content'],
    choiceLabels: ['①', '②', '③', '④', '⑤'],
    confirmResolver: null,
    choiceLayoutGrid,
    normalizeChoiceLayout,
    getChoiceLayoutGrid,
    getChoiceColumnCount,
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    },

    cleanRichContentToTex(htmlContent) {
        const div = document.createElement('div');
        div.innerHTML = htmlContent;
        const normalizeIneqEntities = (value = '') => {
            let text = value;
            text = text.replace(/&amp;lt;/g, '&lt;').replace(/&amp;gt;/g, '&gt;');
            text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            return text;
        };
        const textWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        while (textWalker.nextNode()) textNodes.push(textWalker.currentNode);
        textNodes.forEach(node => {
            const raw = node.nodeValue;
            if (!raw || raw.indexOf('&') === -1) return;
            const normalized = normalizeIneqEntities(raw);
            if (normalized !== raw) node.nodeValue = normalized;
        });
        div.querySelectorAll('table.editor-table td.table-cell-selected').forEach(td => {
            td.classList.remove('table-cell-selected');
        });
        div.querySelectorAll('table.choice-table td[data-choice-index]').forEach(cell => {
            const index = parseInt(cell.dataset.choiceIndex, 10);
            if (!Number.isFinite(index) || index <= 0) return;
            let label = cell.querySelector('.choice-label');
            if (!label) {
                label = document.createElement('span');
                label.className = 'choice-label';
                label.setAttribute('contenteditable', 'false');
                cell.prepend(label);
            }
            label.textContent = Utils.choiceLabels[index - 1] || `${index}.`;
            label.setAttribute('contenteditable', 'false');
        });
        const tablePlaceholders = [];
        div.querySelectorAll('table.editor-table').forEach((table, idx) => {
            const placeholder = document.createElement('span');
            placeholder.setAttribute('data-table-placeholder', String(idx));
            tablePlaceholders.push({ placeholder, table });
            table.replaceWith(placeholder);
        });
        div.querySelectorAll('mjx-container').forEach(mjx => {
            const tex = mjx.getAttribute('data-tex');
            const isDisplay = mjx.getAttribute('display') === 'true'; 
            if (tex) mjx.replaceWith(document.createTextNode(isDisplay ? `$$${tex}$$` : `$${tex}$`));
        });
        const decodeHtml = (value = '') => {
            const tmp = document.createElement('div');
            tmp.innerHTML = String(value);
            return tmp.textContent || '';
        };
        div.querySelectorAll('.blank-box').forEach(blank => {
            const dataset = blank.dataset || {};
            if (dataset.blankKind === 'concept') {
                const rawLabel = dataset.rawLabel !== undefined
                    ? decodeHtml(dataset.rawLabel)
                    : (dataset.label !== undefined ? decodeHtml(dataset.label) : '#');
                const delim = dataset.delim || ':';
                const answer = dataset.answer ? decodeHtml(dataset.answer) : '';
                blank.replaceWith(document.createTextNode(`[개념빈칸${delim}${rawLabel}]${answer}[/개념빈칸]`));
                return;
            }
            const delim = dataset.delim || ':';
            blank.replaceWith(document.createTextNode(`[빈칸${delim}${blank.innerText}]`));
        });
        div.querySelectorAll('.image-placeholder').forEach(ph => {
            const label = ph.getAttribute('data-label') || '';
            ph.replaceWith(document.createTextNode(`[이미지:${label}]`));
        });
        tablePlaceholders.forEach(({ placeholder, table }, idx) => {
            const current = div.querySelector(`span[data-table-placeholder="${idx}"]`);
            if (current) current.replaceWith(table);
        });
        return div.innerHTML;
    },

    sanitizeHtml(htmlContent = '') {
        const container = document.createElement('div');
        container.innerHTML = String(htmlContent || '');
        ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style'].forEach(tag => {
            container.querySelectorAll(tag).forEach(node => node.remove());
        });

        const urlAttrs = new Set(['href', 'src', 'xlink:href', 'formaction']);
        const isUnsafeUrl = (value, attrName) => {
            const raw = String(value || '');
            const compact = raw.trim().replace(/\s+/g, '').toLowerCase();
            if (!compact) return false;
            if (compact.startsWith('javascript:') || compact.startsWith('vbscript:')) return true;
            if (compact.startsWith('data:')) {
                if (attrName === 'src' || attrName === 'href' || attrName === 'xlink:href') {
                    if (compact.startsWith('data:image/')) {
                        if (compact.startsWith('data:image/svg+xml')) return true;
                        return false;
                    }
                    return true;
                }
            }
            return false;
        };

        container.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                if (name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                    return;
                }
                if (name === 'style') {
                    const value = String(attr.value || '').toLowerCase();
                    if (value.includes('expression(') || value.includes('javascript:')) {
                        el.removeAttribute(attr.name);
                    }
                    return;
                }
                if (urlAttrs.has(name) && isUnsafeUrl(attr.value, name)) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return container.innerHTML;
    },

    escapeTokenValue(value = '') {
        return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    },

    serializeEditorTable(table) {
        if (!table) return '';
        const rows = Array.from(table.rows);
        const rowCount = rows.length;
        const colCount = rows[0] ? rows[0].cells.length : 0;
        if (!rowCount || !colCount) return '';
        const entries = [];
        rows.forEach((row, r) => {
            Array.from(row.cells).forEach((cell, c) => {
                const raw = this.cleanRichContentToTex(cell.innerHTML || '');
                const normalized = raw.replace(/\u00A0/g, ' ');
                if (!normalized.trim()) return;
                const escaped = this.escapeTokenValue(normalized);
                entries.push(`(${r + 1}x${c + 1}_"${escaped}")`);
            });
        });
        const head = `[표_${rowCount}x${colCount}]`;
        return entries.length ? `${head} : ${entries.join(', ')}` : head;
    },

    serializeChoiceTable(table) {
        if (!table) return '';
        const layout = this.normalizeChoiceLayout(table.dataset ? table.dataset.layout : '2');
        const layoutToken = layout === '1' ? '1행' : layout === '5' ? '5행' : '2행';
        const items = [];
        table.querySelectorAll('td[data-choice-index]').forEach(cell => {
            const idx = parseInt(cell.dataset.choiceIndex, 10);
            if (!Number.isFinite(idx)) return;
            const textEl = cell.querySelector('.choice-text');
            const raw = this.cleanRichContentToTex(textEl ? textEl.innerHTML : '');
            const normalized = raw.replace(/\u00A0/g, ' ');
            if (!normalized.trim()) return;
            items.push({ idx, value: normalized });
        });
        items.sort((a, b) => a.idx - b.idx);
        const entries = items.map(item => `(${item.idx}_"${this.escapeTokenValue(item.value)}")`);
        const head = `[선지_${layoutToken}]`;
        return entries.length ? `${head} : ${entries.join(', ')}` : head;
    },

    replaceTablesWithTokensInDom(root) {
        if (!root) return;
        const tables = Array.from(root.querySelectorAll('table.editor-table'));
        tables.forEach(table => {
            const token = this.serializeEditorTable(table);
            table.replaceWith(document.createTextNode(token));
        });
        const choices = Array.from(root.querySelectorAll('table.choice-table'));
        choices.forEach(table => {
            const token = this.serializeChoiceTable(table);
            table.replaceWith(document.createTextNode(token));
        });
    },

    replaceBlockBoxesWithTokensInDom(root) {
        if (!root) return;
        const buildTokenFragment = (startToken, endToken, bodyText) => {
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

        const getBodyText = (contentEl) => {
            if (!contentEl) return '';
            const cleaned = Utils.cleanRichContentToTex(contentEl.innerHTML);
            const tmp = document.createElement('div');
            tmp.innerHTML = cleaned;
            return (tmp.innerText || '').replace(/\u00A0/g, ' ').trim();
        };

        Array.from(root.querySelectorAll('.custom-box')).forEach(customBox => {
            const labelEl = customBox.querySelector('.box-label');
            const labelText = labelEl ? labelEl.textContent.replace(/[<>]/g, '').trim() : '';
            const contentEl = customBox.querySelector('.box-content');
            const bodyText = getBodyText(contentEl);
            const startToken = labelText ? `[블록박스_${labelText}]` : '[블록박스_]';
            const frag = buildTokenFragment(startToken, '[/블록박스]', bodyText);
            customBox.replaceWith(frag);
        });

        Array.from(root.querySelectorAll('.rect-box')).forEach(rectBox => {
            const contentEl = rectBox.querySelector('.rect-box-content');
            const bodyText = getBodyText(contentEl);
            const frag = buildTokenFragment('[블록사각형]', '[/블록사각형]', bodyText);
            rectBox.replaceWith(frag);
        });
    },

    protectMathEnvironments,
    normalizeLlmOutput,

    getImagePlaceholderHTML(labelText = '') {
        const label = (labelText || '').trim();
        const safeLabel = label
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const display = label ? `[이미지: ${safeLabel}]` : '이미지 박스';
        return `<span class="image-placeholder" contenteditable="false" data-label="${safeLabel}">${display}<button class="image-load-btn" contenteditable="false" tabindex="-1">불러오기</button></span>`;
    },

    getAtomBeforeCaret(container) { 
        const sel = window.getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return null; 
        const range = sel.getRangeAt(0); let node = range.startContainer; let offset = range.startOffset; 
        if (!container.contains(node)) return null; 
        if (node.nodeType === Node.TEXT_NODE) { 
            if (offset === 0) { 
                let prev = node.previousSibling; 
                while (prev && prev.nodeType === Node.TEXT_NODE && prev.nodeValue === '') prev = prev.previousSibling; 
                if (prev && (prev.tagName === 'MJX-CONTAINER' || prev.classList?.contains('blank-box'))) return prev; 
            } return null; 
        } 
        if (node.nodeType === Node.ELEMENT_NODE) { 
            const idx = offset - 1; if (idx >= 0) { const prev = node.childNodes[idx]; if (prev && (prev.tagName === 'MJX-CONTAINER' || prev.classList?.contains('blank-box'))) return prev; } 
        } return null; 
    },

    getAtomAfterCaret(container) { 
        const sel = window.getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return null; 
        const range = sel.getRangeAt(0); let node = range.startContainer; let offset = range.startOffset; 
        if (!container.contains(node)) return null; 
        if (node.nodeType === Node.TEXT_NODE) { 
            if (offset === node.nodeValue.length) { 
                let next = node.nextSibling; 
                while (next && next.nodeType === Node.TEXT_NODE && next.nodeValue === '') next = next.nextSibling; 
                if (next && (next.tagName === 'MJX-CONTAINER' || next.classList?.contains('blank-box'))) return next; 
            } return null; 
        } 
        if (node.nodeType === Node.ELEMENT_NODE) { const next = node.childNodes[offset]; if (next && (next.tagName === 'MJX-CONTAINER' || next.classList?.contains('blank-box'))) return next; } 
        return null; 
    },

    isCaretOnLastLine(element) { const selection = window.getSelection(); if (selection.rangeCount === 0) return false; const range = selection.getRangeAt(0); const rect = range.getBoundingClientRect(); const elementRect = element.getBoundingClientRect(); return (elementRect.bottom - rect.bottom) < 30; },
    isCaretOnFirstLine(element) { const selection = window.getSelection(); if (selection.rangeCount === 0) return false; const range = selection.getRangeAt(0); const rect = range.getBoundingClientRect(); const elementRect = element.getBoundingClientRect(); return (rect.top - elementRect.top) < 30; },

    showLoading(msg) { const el=document.getElementById('loading-indicator'); el.innerText=msg; el.style.display='block'; },
    hideLoading() { document.getElementById('loading-indicator').style.display='none'; },
    showToast(msg, type = 'info', duration = 2000) {
        const container = document.getElementById('toast-container');
        if (!container) { alert(msg); return; }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }, duration);
    },
    openModal(id) { document.getElementById(id).style.display = 'flex'; },
    closeModal(id) { document.getElementById(id).style.display = 'none'; },
    confirmDialog(message) {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-modal-message');
        if (!modal || !msgEl) return Promise.resolve(window.confirm(message));
        msgEl.textContent = message;
        return new Promise((resolve) => {
            this.confirmResolver = resolve;
            this.openModal('confirm-modal');
        });
    },
    resolveConfirm(result) {
        const resolver = this.confirmResolver;
        this.confirmResolver = null;
        this.closeModal('confirm-modal');
        if (resolver) resolver(!!result);
    }
};
