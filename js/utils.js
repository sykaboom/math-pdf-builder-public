// Filename: js/utils.js
import { choiceLayoutGrid, normalizeChoiceLayout, getChoiceLayoutGrid, getChoiceColumnCount } from './choice-layout.js';
import { normalizeLlmOutput, protectMathEnvironments, normalizeMathTex } from './math-logic.js';
import { escapeTokenValue, serializeEditorTable, serializeChoiceTable } from './table-serialize.js';
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
        div.querySelectorAll('.raw-edit').forEach(wrapper => {
            const frag = document.createDocumentFragment();
            Array.from(wrapper.childNodes).forEach(node => {
                frag.appendChild(node.cloneNode(true));
            });
            wrapper.replaceWith(frag);
        });
        div.querySelectorAll('.box-content, .rect-box-content, .box-label').forEach(el => {
            el.removeAttribute('contenteditable');
        });
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
            if (tex) {
                const normalizedTex = normalizeMathTex(tex);
                mjx.replaceWith(document.createTextNode(isDisplay ? `$$${normalizedTex}$$` : `$${normalizedTex}$`));
            }
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

    serializeEditorTable(table) {
        return serializeEditorTable(table, { normalizeHtml: this.cleanRichContentToTex.bind(this) });
    },

    serializeChoiceTable(table) {
        return serializeChoiceTable(table, {
            normalizeHtml: this.cleanRichContentToTex.bind(this),
            normalizeLayout: this.normalizeChoiceLayout.bind(this),
            layoutGrid: this.getChoiceLayoutGrid.bind(this),
            choiceLabels: this.choiceLabels
        });
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
    async copyText(text = '') {
        const value = String(text ?? '');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(value);
            return true;
        }
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        document.body.appendChild(textarea);
        textarea.select();
        let ok = false;
        try {
            ok = document.execCommand('copy');
        } catch (err) {
            ok = false;
        }
        textarea.remove();
        return ok;
    },
    openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
    },
    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
        const anyOpen = Array.from(document.querySelectorAll('.modal-overlay'))
            .some((el) => window.getComputedStyle(el).display !== 'none');
        if (!anyOpen) document.body.classList.remove('modal-open');
    },
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
