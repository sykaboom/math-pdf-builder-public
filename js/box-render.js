// Filename: js/box-render.js
export const buildBoxHtml = (label, bodyHtml) => {
    let body = (bodyHtml || '').trim();
    body = body.replace(/^(<br\s*\/?>)+/gi, '').replace(/(<br\s*\/?>)+$/gi, '');
    body = body.replace(/\n/g, '<br>');
    if (label) {
        const rawLabel = (label || '').trim();
        const safeLabel = rawLabel
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const isViewLabel = rawLabel === '보기';
        const labelHtml = isViewLabel
            ? `<div class="box-label view-label">${safeLabel}</div>`
            : `<div class="box-label">${safeLabel}</div>`;
        return `<div class="custom-box labeled-box" contenteditable="false">${labelHtml}<div class="box-content">${body}</div></div>`;
    }
    return `<div class="custom-box simple-box" contenteditable="false"><div class="box-content">${body}</div></div>`;
};

export const buildRectBoxHtml = (bodyHtml) => {
    let body = (bodyHtml || '').trim();
    body = body.replace(/^(<br\s*\/?>)+/gi, '').replace(/(<br\s*\/?>)+$/gi, '');
    body = body.replace(/\n/g, '<br>');
    return `<div class="rect-box" contenteditable="false"><div class="rect-box-content">${body}</div></div>`;
};

export const replaceBoxTokensInHtml = (html, options = {}) => {
    const { renderBox = buildBoxHtml, renderRectBox = buildRectBoxHtml } = options;
    if (!html) return html;
    let nextHtml = html;
    const multilineBoxRegex = /\[블록박스_([^\]]*)\]\s*(?::)?\s*([\s\S]*?)\[\/블록박스\]/g;
    nextHtml = nextHtml.replace(multilineBoxRegex, (m, label, body) => {
        return renderBox((label || '').trim(), body);
    });

    const inlineBoxRegex = /\[블록박스_([^\]]*)\]\s*(?::)?\s*([\s\S]*?)(?=(<br\s*\/?>|<\/div>|<\/p>|$))/gi;
    nextHtml = nextHtml.replace(inlineBoxRegex, (m, label, body) => {
        const trimmedBody = (body || '').replace(/^\s+/, '');
        if (!trimmedBody.trim()) return m;
        return renderBox((label || '').trim(), trimmedBody);
    });

    const multilineRectBoxRegex = /\[블록사각형\]\s*([\s\S]*?)\[\/블록사각형\]/g;
    nextHtml = nextHtml.replace(multilineRectBoxRegex, (m, body) => {
        return renderRectBox(body);
    });
    return nextHtml;
};
