// Filename: js/source-data.js
import { Utils } from './utils.js';

const SOURCE_SCHEMA_VERSION = 1;
const STYLE_VALUES = new Set(['기본', '박스', '음영']);
const VARIANT_VALUES = new Set(['좌컨셉', '상단컨셉', '2행컨셉', '2단컨셉']);
const KIND_VALUES = new Set(['concept', 'example', 'answer', 'break', 'spacer', 'unknown']);

const variantMap = {
    'left-concept': '좌컨셉',
    'top-concept': '상단컨셉',
    'two-col-concept': '2행컨셉'
};

const normalizeText = (value) => String(value || '').trim();

const normalizeStyle = (value) => (STYLE_VALUES.has(value) ? value : '기본');

const normalizeVariant = (value) => {
    if (!value) return null;
    const mapped = variantMap[value] || value;
    if (!VARIANT_VALUES.has(mapped)) return null;
    return mapped;
};

const normalizeKind = (value) => (KIND_VALUES.has(value) ? value : 'unknown');

const normalizeMeta = (raw) => {
    const meta = raw && typeof raw === 'object' ? raw : {};
    const header = meta.header && typeof meta.header === 'object' ? meta.header : {};
    return {
        header: {
            course: normalizeText(header.course),
            unit: normalizeText(header.unit)
        },
        footer: normalizeText(meta.footer)
    };
};

const normalizeBlock = (raw, index) => {
    const block = raw && typeof raw === 'object' ? raw : {};
    const idBase = normalizeText(block.id) || `src_${Date.now()}_${index}`;
    return {
        id: idBase,
        style: normalizeStyle(block.style),
        label: normalizeText(block.label),
        variant: normalizeVariant(block.variant),
        kind: normalizeKind(block.kind),
        raw: String(block.raw || ''),
        bodyRaw: String(block.bodyRaw || '')
    };
};

const extractLabelFromContent = (html, variant) => {
    const container = document.createElement('div');
    container.innerHTML = String(html || '');
    let label = '';

    const inferredVariant = variant || (() => {
        if (container.querySelector('.two-col-concept')) return 'two-col-concept';
        if (container.querySelector('.top-concept-header')) return 'top-concept';
        return null;
    })();

    if (inferredVariant === 'two-col-concept') {
        const title = container.querySelector('.two-col-concept-title');
        const sub = container.querySelector('.two-col-concept-sub');
        const mainText = title ? normalizeText(title.textContent) : '';
        const subText = sub ? normalizeText(sub.textContent) : '';
        label = subText ? `${mainText}_${subText}` : mainText;
        const body = container.querySelector('.two-col-concept-body');
        if (body) container.innerHTML = body.innerHTML;
    } else if (inferredVariant === 'top-concept') {
        const header = container.querySelector('.top-concept-header');
        if (header) {
            label = normalizeText(header.textContent);
            header.remove();
        }
        const body = container.querySelector('.top-concept-body');
        if (body) container.innerHTML = body.innerHTML;
    } else {
        const labelEl = container.querySelector('.q-label');
        if (labelEl) {
            label = normalizeText(labelEl.textContent);
            labelEl.remove();
        }
    }

    return { label, bodyHtml: container.innerHTML.trim() };
};

const toPromptBodyText = (html) => {
    const container = document.createElement('div');
    container.innerHTML = String(html || '');
    container.querySelectorAll('strong').forEach(el => {
        const text = el.textContent || '';
        el.replaceWith(document.createTextNode(`[굵게:${text}]`));
    });
    container.querySelectorAll('u').forEach(el => {
        const text = el.textContent || '';
        el.replaceWith(document.createTextNode(`[밑줄:${text}]`));
    });
    return Utils.extractTextWithBreaks(container.innerHTML);
};

const buildRawBlockText = (style, label, bodyRaw) => {
    const safeStyle = normalizeStyle(style);
    const safeLabel = normalizeText(label);
    const header = `[[${safeStyle}_${safeLabel}]]`;
    if (!bodyRaw) return header;
    return `${header} : ${bodyRaw}`;
};

/**
 * Normalize source data into the v1 schema.
 * @param {object} raw
 */
export const normalizeSourceData = (raw) => {
    const base = raw && typeof raw === 'object' ? raw : {};
    const schemaVersion = Number.isFinite(base.schemaVersion) ? base.schemaVersion : SOURCE_SCHEMA_VERSION;
    const blocks = Array.isArray(base.blocks) ? base.blocks : [];
    return {
        schemaVersion: schemaVersion || SOURCE_SCHEMA_VERSION,
        meta: normalizeMeta(base.meta),
        blocks: blocks.map((block, index) => normalizeBlock(block, index))
    };
};

/**
 * Build source blocks from the current doc data.
 * @param {object} docData
 */
export const buildSourceDataFromDocData = (docData) => {
    const data = docData && typeof docData === 'object' ? docData : {};
    const meta = data.meta || {};
    const blocks = Array.isArray(data.blocks) ? data.blocks : [];
    const source = {
        schemaVersion: SOURCE_SCHEMA_VERSION,
        meta: {
            header: {
                course: normalizeText(meta.title),
                unit: normalizeText(meta.subtitle)
            },
            footer: normalizeText(meta.footerText)
        },
        blocks: []
    };

    blocks.forEach((block, index) => {
        const style = block?.bgGray ? '음영' : (block?.bordered ? '박스' : '기본');
        const kind = normalizeKind(block?.type);
        const variant = normalizeVariant(block?.variant);
        const { label, bodyHtml } = extractLabelFromContent(block?.content || '', block?.variant);
        const bodyRaw = toPromptBodyText(bodyHtml);
        const raw = buildRawBlockText(style, label, bodyRaw);
        source.blocks.push({
            id: normalizeText(block?.id) || `src_${Date.now()}_${index}`,
            style,
            label,
            variant,
            kind,
            raw,
            bodyRaw
        });
    });

    return normalizeSourceData(source);
};
