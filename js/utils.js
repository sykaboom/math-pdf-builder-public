// Filename: js/utils.js
export const Utils = {
    preservedClasses: ['custom-box', 'labeled-box', 'simple-box', 'box-label', 'box-content'],
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
        div.querySelectorAll('.blank-box').forEach(blank => {
            const delim = blank.dataset ? (blank.dataset.delim || ':') : ':';
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
    closeModal(id) { document.getElementById(id).style.display = 'none'; }
};
