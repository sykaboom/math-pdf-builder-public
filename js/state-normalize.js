// Filename: js/state-normalize.js
export const DEFAULT_DOC_META = {
    title: "시험지 제목",
    subtitle: "단원명",
    footerText: "학원명"
};

export const DEFAULT_SETTINGS = {
    zoom: 1.0,
    columns: 2,
    marginTopMm: 15,
    marginSideMm: 10,
    columnGapMm: 5,
    fontFamily: 'serif',
    fontSizePt: 10.5,
    labelFontFamily: 'gothic',
    labelFontSizePt: null,
    labelBold: true,
    labelUnderline: false,
    pageLayouts: {}
};

export const DEFAULT_BLOCK = {
    id: 'b0',
    type: 'concept',
    content: '<span class="q-label">안내</span> 내용 입력...'
};

export const buildDefaultDocMeta = () => ({ ...DEFAULT_DOC_META });

export const buildDefaultSettings = () => ({
    ...DEFAULT_SETTINGS,
    pageLayouts: {}
});

export const buildDefaultBlock = () => ({ ...DEFAULT_BLOCK });

export const buildDefaultDocData = () => ({
    meta: buildDefaultDocMeta(),
    blocks: [buildDefaultBlock()]
});

export const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

export const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

export const normalizeDocMeta = (rawMeta) => {
    const meta = isPlainObject(rawMeta) ? { ...rawMeta } : {};
    const defaults = buildDefaultDocMeta();

    meta.title = typeof meta.title === 'string' ? meta.title : defaults.title;
    meta.subtitle = typeof meta.subtitle === 'string' ? meta.subtitle : defaults.subtitle;
    meta.footerText = typeof meta.footerText === 'string' ? meta.footerText : defaults.footerText;

    return meta;
};

export const normalizeSettings = (rawSettings) => {
    const settings = isPlainObject(rawSettings) ? { ...rawSettings } : {};
    const defaults = buildDefaultSettings();

    const zoom = toNumber(settings.zoom);
    settings.zoom = zoom && zoom > 0 ? zoom : defaults.zoom;

    const columns = toNumber(settings.columns);
    settings.columns = columns === 1 ? 1 : 2;

    const marginTop = toNumber(settings.marginTopMm);
    settings.marginTopMm = marginTop !== null && marginTop >= 0 ? marginTop : defaults.marginTopMm;

    const marginSide = toNumber(settings.marginSideMm);
    settings.marginSideMm = marginSide !== null && marginSide >= 0 ? marginSide : defaults.marginSideMm;

    const columnGap = toNumber(settings.columnGapMm);
    settings.columnGapMm = columnGap !== null && columnGap >= 0 ? columnGap : defaults.columnGapMm;

    settings.fontFamily = typeof settings.fontFamily === 'string' && settings.fontFamily.trim()
        ? settings.fontFamily
        : defaults.fontFamily;

    const fontSize = toNumber(settings.fontSizePt);
    settings.fontSizePt = fontSize && fontSize > 0 ? fontSize : defaults.fontSizePt;

    settings.labelFontFamily = typeof settings.labelFontFamily === 'string' && settings.labelFontFamily.trim()
        ? settings.labelFontFamily
        : defaults.labelFontFamily;

    if (settings.labelFontSizePt === null || settings.labelFontSizePt === '') {
        settings.labelFontSizePt = null;
    } else {
        const labelSize = toNumber(settings.labelFontSizePt);
        settings.labelFontSizePt = labelSize && labelSize > 0 ? labelSize : null;
    }

    settings.labelBold = typeof settings.labelBold === 'boolean' ? settings.labelBold : defaults.labelBold;
    settings.labelUnderline = typeof settings.labelUnderline === 'boolean' ? settings.labelUnderline : defaults.labelUnderline;

    if (isPlainObject(settings.pageLayouts)) {
        const normalizedLayouts = {};
        Object.entries(settings.pageLayouts).forEach(([key, value]) => {
            const layout = toNumber(value);
            if (layout === 1 || layout === 2) normalizedLayouts[key] = layout;
        });
        settings.pageLayouts = normalizedLayouts;
    } else {
        settings.pageLayouts = {};
    }

    return settings;
};

export const normalizeBlock = (rawBlock, index, usedIds, options = {}) => {
    const opts = { sanitize: false, sanitizeHtml: null, normalizeMathHtml: null, ...options };
    const block = isPlainObject(rawBlock) ? { ...rawBlock } : {};
    let id = typeof block.id === 'string' ? block.id.trim() : '';
    if (!id || usedIds.has(id)) {
        id = `b_${Date.now()}_${index}_${Math.random().toString(16).slice(2, 6)}`;
    }
    usedIds.add(id);
    block.id = id;

    block.type = typeof block.type === 'string' && block.type.trim() ? block.type.trim() : 'example';

    if (typeof block.content !== 'string') block.content = '';
    if (opts.sanitize && typeof opts.sanitizeHtml === 'function') {
        block.content = opts.sanitizeHtml(block.content);
    }
    if (typeof opts.normalizeMathHtml === 'function') {
        block.content = opts.normalizeMathHtml(block.content);
    }

    if (block.type === 'spacer') {
        const height = toNumber(block.height);
        block.height = height && height > 0 ? height : 50;
    }

    if ('bordered' in block && typeof block.bordered !== 'boolean') delete block.bordered;
    if ('bgGray' in block && typeof block.bgGray !== 'boolean') delete block.bgGray;

    if ('fontFamily' in block && (typeof block.fontFamily !== 'string' || !block.fontFamily.trim())) delete block.fontFamily;
    if ('fontSizePt' in block) {
        const size = toNumber(block.fontSizePt);
        if (!size || size <= 0) delete block.fontSizePt;
        else block.fontSizePt = size;
    }

    if ('derived' in block && typeof block.derived !== 'string') delete block.derived;

    if ('conceptAnswerStart' in block) {
        const value = toNumber(block.conceptAnswerStart);
        if (value === null) delete block.conceptAnswerStart;
        else block.conceptAnswerStart = value;
    }
    if ('conceptAnswerAssigned' in block) {
        const value = toNumber(block.conceptAnswerAssigned);
        if (value === null) delete block.conceptAnswerAssigned;
        else block.conceptAnswerAssigned = value;
    }
    if ('conceptAnswerSeparators' in block) {
        if (!isPlainObject(block.conceptAnswerSeparators)) {
            delete block.conceptAnswerSeparators;
        } else {
            const raw = block.conceptAnswerSeparators;
            const next = {};
            if (Object.prototype.hasOwnProperty.call(raw, 'leading') && typeof raw.leading === 'string') {
                next.leading = raw.leading;
            }
            if (Object.prototype.hasOwnProperty.call(raw, 'trailing') && typeof raw.trailing === 'string') {
                next.trailing = raw.trailing;
            }
            if (Array.isArray(raw.between)) {
                next.between = raw.between.filter(value => typeof value === 'string');
            }
            block.conceptAnswerSeparators = next;
        }
    }

    if ('style' in block) {
        if (!isPlainObject(block.style)) {
            delete block.style;
        } else if (block.style.textAlign && !['left', 'center', 'right'].includes(block.style.textAlign)) {
            delete block.style.textAlign;
        }
    }

    return block;
};

export const normalizeBlocks = (rawBlocks, options = {}) => {
    const opts = { sanitize: false, ensureAtLeastOne: false, sanitizeHtml: null, ...options };
    const blocks = Array.isArray(rawBlocks) ? rawBlocks : [];
    const usedIds = new Set();
    const normalized = blocks.map((block, index) => normalizeBlock(block, index, usedIds, opts)).filter(Boolean);
    if (opts.ensureAtLeastOne && normalized.length === 0) {
        normalized.push(buildDefaultBlock());
    }
    return normalized;
};

export const normalizeDocData = (raw, options = {}) => {
    const opts = { sanitize: false, ensureAtLeastOne: true, sanitizeHtml: null, ...options };
    const base = isPlainObject(raw) ? raw : {};
    const normalized = { ...base };
    normalized.meta = normalizeDocMeta(base.meta);
    normalized.blocks = normalizeBlocks(base.blocks, opts);
    return normalized;
};

export const normalizeProjectData = (raw, options = {}) => {
    const opts = { sanitize: false, ensureAtLeastOne: true, sanitizeHtml: null, ...options };
    const base = isPlainObject(raw) ? raw : {};
    const normalized = { ...base };
    normalized.data = normalizeDocData(base.data, opts);
    normalized.settings = normalizeSettings(base.settings);
    return normalized;
};
