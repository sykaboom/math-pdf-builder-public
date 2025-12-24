// Filename: js/actions.js
import { State } from './state.js';
import { Utils } from './utils.js';
import { ImportParser } from './import-parser.js';
import { buildNewBlockData, buildSplitBlockData, cloneBlockData } from './block-logic.js';
import { expandImportedBlocks, parseJsonImport } from './import-logic.js';

export const Actions = {
    // 렌더링을 직접 호출하지 않고 데이터만 조작
    updateBlockContent(id, html, recordHistory = true) {
        const b = State.docData.blocks.find(x => x.id === id);
        if (b) b.content = html;
        if (recordHistory) State.saveHistory(500);
    },

    deleteBlockById(id) {
        const initialLen = State.docData.blocks.length;
        State.docData.blocks = State.docData.blocks.filter(b => b.id !== id);
        // 변경 사항이 있을 때만 true 반환
        if (State.docData.blocks.length !== initialLen) {
            State.saveHistory();
            return true; 
        }
        return false;
    },

    createNewBlockData(type) {
        return buildNewBlockData(type, { imagePlaceholderHtml: Utils.getImagePlaceholderHTML() });
    },

    addBlockBelow(type, refId) {
        const targetId = refId || State.contextTargetId;
        let targetIdx = targetId ? State.docData.blocks.findIndex(b => b.id === targetId) : State.docData.blocks.length - 1;
        const newBlock = this.createNewBlockData(type);
        State.docData.blocks.splice(targetIdx + 1, 0, newBlock);
        if (type !== 'break') State.lastFocusId = newBlock.id;
        State.saveHistory();
        Utils.closeModal('context-menu');
        return true; // 변경됨
    },

    addBlockAbove(type, refId) {
        const targetId = refId || State.contextTargetId;
        if (!targetId) return false;
        let targetIdx = State.docData.blocks.findIndex(b => b.id === targetId);
        const newBlock = this.createNewBlockData(type);
        State.docData.blocks.splice(targetIdx, 0, newBlock);
        State.lastFocusId = newBlock.id;
        State.saveHistory();
        Utils.closeModal('context-menu');
        return true;
    },

    duplicateTargetBlock() {
        if (!State.contextTargetId) return false;
        const idx = State.docData.blocks.findIndex(b => b.id === State.contextTargetId);
        const clone = cloneBlockData(State.docData.blocks[idx]);
        State.docData.blocks.splice(idx + 1, 0, clone);
        State.saveHistory();
        Utils.closeModal('context-menu');
        return true;
    },

    toggleStyle(property) { 
        const b = State.docData.blocks.find(x => x.id === State.contextTargetId);
        if (b) {
            b[property] = !b[property];
            State.saveHistory();
            Utils.closeModal('context-menu');
            return true;
        }
        return false;
    },

    applyAlign(align) {
        const b = State.docData.blocks.find(x => x.id === State.contextTargetId);
        if (b) { 
            if (!b.style) b.style = {}; 
            b.style.textAlign = align; 
            State.saveHistory();
            Utils.closeModal('context-menu');
            return true;
        }
        return false;
    },

    setBlockFontFamily(id, familyKey) {
        const b = State.docData.blocks.find(x => x.id === id);
        if (!b) return false;
        if (!familyKey || familyKey === 'default') delete b.fontFamily;
        else b.fontFamily = familyKey;
        State.saveHistory();
        return true;
    },

    setBlockFontSize(id, sizePt) {
        const b = State.docData.blocks.find(x => x.id === id);
        if (!b) return false;
        const v = parseFloat(sizePt);
        if (!v || v <= 0) delete b.fontSizePt;
        else b.fontSizePt = v;
        State.saveHistory();
        return true;
    },

    splitBlockWithContents(id, beforeHtml, afterHtml) {
        const idx = State.docData.blocks.findIndex(b => b.id === id);
        if (idx < 0) return false;
        const base = State.docData.blocks[idx];
        if (!base || !['concept', 'example', 'answer'].includes(base.type)) return false;

        const newBlock = buildSplitBlockData(base, afterHtml);

        State.docData.blocks[idx].content = beforeHtml || '';
        State.docData.blocks.splice(idx + 1, 0, newBlock);
        State.lastFocusId = newBlock.id;
        State.lastEditableId = newBlock.id;
        State.saveHistory();
        return true;
    },

    confirmImport(input, overwrite, limit, addSpacer, normalizeLlm = false) {
        if(!input) return false;
        let finalBlocks = [];
        try {
            const jsonBlocks = parseJsonImport(input);
            if (jsonBlocks) {
                finalBlocks = jsonBlocks;
            } else if (input.includes('<div') && input.includes('data-item')) {
                alert('HTML 형식 데이터 입력은 지원하지 않습니다.');
                return false;
            } else {
                const normalized = normalizeLlm ? Utils.normalizeLlmOutput(input) : input;
                finalBlocks = ImportParser.parse(normalized);
            }
            finalBlocks = State.normalizeBlocks(finalBlocks, { sanitize: true });
            const processedBlocks = expandImportedBlocks(finalBlocks, { limit, addSpacer });

            if (overwrite) State.docData.blocks = processedBlocks;
            else State.docData.blocks = State.docData.blocks.concat(processedBlocks);
            State.saveHistory();
            Utils.closeModal('import-modal');
            return true;
        } catch(e) { console.error(e); alert("데이터 인식 실패: "+e.message); return false; }
    }
};
