// Filename: js/state.js
import { Utils } from './utils.js';
import {
    buildDefaultDocData,
    buildDefaultSettings,
    normalizeBlocks as normalizeBlocksCore,
    normalizeDocData as normalizeDocDataCore,
    normalizeProjectData as normalizeProjectDataCore,
    normalizeSettings as normalizeSettingsCore
} from './state-normalize.js';

const normalizeBlocks = (rawBlocks, options = {}) => normalizeBlocksCore(rawBlocks, {
    ...options,
    sanitizeHtml: Utils.sanitizeHtml
});

const normalizeDocData = (raw, options = {}) => normalizeDocDataCore(raw, {
    ...options,
    sanitizeHtml: Utils.sanitizeHtml
});

const normalizeProjectData = (raw, options = {}) => normalizeProjectDataCore(raw, {
    ...options,
    sanitizeHtml: Utils.sanitizeHtml
});

const normalizeSettings = (rawSettings) => normalizeSettingsCore(rawSettings);

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
