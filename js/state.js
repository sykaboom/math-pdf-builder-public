// Filename: js/state.js
import { Utils } from './utils.js';

export const State = {
    docData: {
        meta: { title: "시험지 제목", subtitle: "단원명", footerText: "학원명", zoom: 1.0, columns: 2, marginTopMm: 15, marginSideMm: 10, columnGapMm: 5, fontFamily: 'serif', fontSizePt: 10.5, labelFontFamily: 'gothic', labelFontSizePt: null, labelBold: true, labelUnderline: false, pageLayouts: {} },
        blocks: [ { id: 'b0', type: 'concept', content: '<span class="q-label">안내</span> 내용 입력...' } ]
    },
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
    conceptBlankAnswersHash: '',
    keysPressed: {},

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
            const str = JSON.stringify(cleanData);

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
            const str = JSON.stringify(cleanData);
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
            this.docData = parsed;
            this.docData.meta = Object.assign({
                title: "시험지 제목",
                subtitle: "단원명",
                footerText: "학원명",
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
            }, parsed.meta || {});
            return true;
        } catch(e) { console.error(e); return false; }
    },

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.docData = JSON.parse(this.historyStack[this.historyIndex]);
            this.historyMeta = null;
            return true;
        }
        return false;
    },

    redo() {
        if (this.historyIndex < this.historyStack.length - 1) {
            this.historyIndex++;
            this.docData = JSON.parse(this.historyStack[this.historyIndex]);
            this.historyMeta = null;
            return true;
        }
        return false;
    }
};
