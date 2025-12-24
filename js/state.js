// Filename: js/state.js
import { Utils } from './utils.js';

const DEFAULT_DOC_META = {
    title: "시험지 제목",
    subtitle: "단원명",
    footerText: "학원명"
};

const DEFAULT_SETTINGS = {
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

const DEFAULT_BLOCK = {
    id: 'b0',
    type: 'concept',
    content: '<span class="q-label">안내</span> 내용 입력...'
};

const buildDefaultDocMeta = () => ({ ...DEFAULT_DOC_META });

const buildDefaultSettings = () => ({
    ...DEFAULT_SETTINGS,
    pageLayouts: {}
});

const buildDefaultBlock = () => ({ ...DEFAULT_BLOCK });

const buildDefaultDocData = () => ({
    meta: buildDefaultDocMeta(),
    blocks: [buildDefaultBlock()]
});

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const normalizeDocMeta = (rawMeta) => {
    const meta = isPlainObject(rawMeta) ? { ...rawMeta } : {};
    const defaults = buildDefaultDocMeta();

    meta.title = typeof meta.title === 'string' ? meta.title : defaults.title;
    meta.subtitle = typeof meta.subtitle === 'string' ? meta.subtitle : defaults.subtitle;
    meta.footerText = typeof meta.footerText === 'string' ? meta.footerText : defaults.footerText;

    return meta;
};

const normalizeSettings = (rawSettings) => {
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

const normalizeBlock = (rawBlock, index, usedIds, options) => {
    const block = isPlainObject(rawBlock) ? { ...rawBlock } : {};
    let id = typeof block.id === 'string' ? block.id.trim() : '';
    if (!id || usedIds.has(id)) {
        id = `b_${Date.now()}_${index}_${Math.random().toString(16).slice(2, 6)}`;
    }
    usedIds.add(id);
    block.id = id;

    block.type = typeof block.type === 'string' && block.type.trim() ? block.type.trim() : 'example';

    if (typeof block.content !== 'string') block.content = '';
    if (options.sanitize) block.content = Utils.sanitizeHtml(block.content);

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

    if ('style' in block) {
        if (!isPlainObject(block.style)) {
            delete block.style;
        } else if (block.style.textAlign && !['left', 'center', 'right'].includes(block.style.textAlign)) {
            delete block.style.textAlign;
        }
    }

    return block;
};

const normalizeBlocks = (rawBlocks, options = {}) => {
    const opts = { sanitize: false, ensureAtLeastOne: false, ...options };
    const blocks = Array.isArray(rawBlocks) ? rawBlocks : [];
    const usedIds = new Set();
    const normalized = blocks.map((block, index) => normalizeBlock(block, index, usedIds, opts)).filter(Boolean);
    if (opts.ensureAtLeastOne && normalized.length === 0) {
        normalized.push(buildDefaultBlock());
    }
    return normalized;
};

const normalizeDocData = (raw, options = {}) => {
    const opts = { sanitize: false, ensureAtLeastOne: true, ...options };
    const base = isPlainObject(raw) ? raw : {};
    const normalized = { ...base };
    normalized.meta = normalizeDocMeta(base.meta);
    normalized.blocks = normalizeBlocks(base.blocks, opts);
    return normalized;
};

const normalizeProjectData = (raw, options = {}) => {
    const opts = { sanitize: false, ensureAtLeastOne: true, ...options };
    const base = isPlainObject(raw) ? raw : {};
    const normalized = { ...base };
    normalized.data = normalizeDocData(base.data, opts);
    normalized.settings = normalizeSettings(base.settings);
    return normalized;
};

export const State = {
    docData: buildDefaultDocData(),
    settings: buildDefaultSettings(),
    historyStack: [],
    historyIndex: -1,
    renderTimer: null,
    draftTimer: null,
    historyMeta: null,
    
    // 런타임 상태
    contextTargetId: null,
    dragSrcId: null,
    selectedPlaceholder: null,
    selectedImage: null,
    lastFocusId: null,
    lastEditableId: null,
    renderingEnabled: true,
    selectionRange: null,
    selectionBlockId: null,
    conceptBlankAnswers: [],
    conceptBlankAnswersIsMath: [],
    conceptBlankAnswersHash: '',
    keysPressed: {},

    normalizeDocData,
    normalizeBlocks,
    normalizeSettings,
    normalizeProjectData,

    applyProjectData(raw, options = {}) {
        const normalized = normalizeProjectData(raw, options);
        this.docData = normalized.data;
        this.settings = normalized.settings;
        return normalized;
    },

    applyProjectSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return false;
        this.docData = snapshot.data || buildDefaultDocData();
        this.settings = snapshot.settings || buildDefaultSettings();
        return true;
    },

    saveHistory(debounceTime = 0, options = null) {
        let delay = debounceTime;
        let meta = options;
        if (typeof debounceTime === 'object' && debounceTime !== null) {
            meta = debounceTime;
            delay = 0;
        }
        const doSave = () => {
            const cleanData = JSON.parse(JSON.stringify(this.docData));
            cleanData.blocks.forEach(b => b.content = Utils.cleanRichContentToTex(b.content));
            const snapshot = {
                data: cleanData,
                settings: JSON.parse(JSON.stringify(this.settings))
            };
            const str = JSON.stringify(snapshot);

            const now = Date.now();
            const metaInfo = meta && typeof meta === 'object' ? {
                reason: meta.reason || 'manual',
                blockId: meta.blockId || null,
                coalesceMs: Number.isFinite(meta.coalesceMs) ? meta.coalesceMs : 2000
            } : null;
            const canCoalesce = metaInfo
                && metaInfo.reason === 'typing'
                && this.historyIndex >= 0
                && this.historyIndex === this.historyStack.length - 1
                && this.historyMeta
                && this.historyMeta.reason === 'typing'
                && (now - this.historyMeta.time) <= metaInfo.coalesceMs
                && (!metaInfo.blockId || metaInfo.blockId === this.historyMeta.blockId);

            if (canCoalesce) {
                if (this.historyStack[this.historyIndex] === str) return;
                this.historyStack[this.historyIndex] = str;
                this.historyMeta = { reason: 'typing', blockId: metaInfo.blockId, time: now };
                localStorage.setItem('editorAutoSave', str);
                return;
            }
            
            if (this.historyIndex >= 0 && this.historyStack[this.historyIndex] === str) return;
            
            this.historyIndex++;
            this.historyStack = this.historyStack.slice(0, this.historyIndex);
            this.historyStack.push(str);
            
            if (this.historyStack.length > 30) {
                this.historyStack.shift();
                this.historyIndex--;
            }
            this.historyMeta = metaInfo ? { reason: metaInfo.reason, blockId: metaInfo.blockId, time: now } : { reason: 'manual', blockId: null, time: now };
            localStorage.setItem('editorAutoSave', str);
        };

        if (delay > 0) {
            clearTimeout(this.renderTimer);
            this.renderTimer = setTimeout(doSave, delay);
        } else {
            doSave();
        }
    },

    autosaveDraft(debounceTime = 0) {
        const doSave = () => {
            const cleanData = JSON.parse(JSON.stringify(this.docData));
            cleanData.blocks.forEach(b => b.content = Utils.cleanRichContentToTex(b.content));
            const snapshot = {
                data: cleanData,
                settings: JSON.parse(JSON.stringify(this.settings))
            };
            const str = JSON.stringify(snapshot);
            localStorage.setItem('editorAutoSave', str);
        };

        if (debounceTime > 0) {
            clearTimeout(this.draftTimer);
            this.draftTimer = setTimeout(doSave, debounceTime);
        } else {
            doSave();
        }
    },

    loadFromHistory(str) {
        if (!str) return false;
        try {
            const parsed = JSON.parse(str);
            this.applyProjectData(parsed);
            return true;
        } catch(e) { console.error(e); return false; }
    },

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.applyProjectSnapshot(JSON.parse(this.historyStack[this.historyIndex]));
            this.historyMeta = null;
            return true;
        }
        return false;
    },

    redo() {
        if (this.historyIndex < this.historyStack.length - 1) {
            this.historyIndex++;
            this.applyProjectSnapshot(JSON.parse(this.historyStack[this.historyIndex]));
            this.historyMeta = null;
            return true;
        }
        return false;
    }
};
