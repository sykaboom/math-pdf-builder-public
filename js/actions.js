// Filename: js/actions.js
import { State } from './state.js';
import { Utils } from './utils.js';
import { ImportParser } from './services.js';

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
        const newBlock = { id: 'b_' + Date.now(), type: type, content: '' };
        if (type === 'concept') newBlock.content = '<span class="q-label">개념</span> ';
        if (type === 'image') { newBlock.type = 'example'; newBlock.content = Utils.getImagePlaceholderHTML(); }
        if (type === 'break') newBlock.type = 'break';
        if (type === 'spacer') { newBlock.type = 'spacer'; newBlock.height = 50; }
        return newBlock;
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
        const clone = JSON.parse(JSON.stringify(State.docData.blocks[idx]));
        clone.id = 'copy_' + Date.now();
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

        const newBlock = JSON.parse(JSON.stringify(base));
        newBlock.id = 'b_' + Date.now() + '_' + Math.random().toString(16).slice(2, 6);
        newBlock.content = afterHtml || '';

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
            let isJson = false; let parsedJson = null;
            if (input.startsWith('[') || input.startsWith('{')) { try { parsedJson = JSON.parse(input); if (typeof parsedJson === 'object' && parsedJson !== null) isJson = true; } catch (e) {} }
            if (isJson) { const arr = Array.isArray(parsedJson) ? parsedJson : [parsedJson]; finalBlocks = arr.map(item => ({ id: 'imp_json_' + Date.now() + Math.random(), type: item.type || 'example', content: item.content || '', bordered: item.bordered || false, bgGray: item.bgGray || false })); } 
            else if (input.includes('<div') && input.includes('data-item')) { const parser = new DOMParser(); const doc = parser.parseFromString(input, 'text/html'); const items = doc.querySelectorAll('.data-item'); items.forEach(i => { let t = 'example', c = i.innerHTML; if(i.querySelector('.concept-box')) { t = 'concept'; c = i.querySelector('.concept-box').innerHTML; } else if(i.querySelector('.answer-area')) { t = 'answer'; c = i.querySelector('.answer-area').innerHTML; } finalBlocks.push({ id: 'imp_html_' + Date.now() + Math.random(), type: t, content: c }); }); } 
            else {
                const normalized = normalizeLlm ? Utils.normalizeLlmOutput(input) : input;
                finalBlocks = ImportParser.parse(normalized);
            }
            
            let processedBlocks = []; let countInColumn = 0;
            finalBlocks.forEach((b, idx) => { processedBlocks.push(b); if(b.type !== 'answer') { countInColumn++; if(addSpacer) processedBlocks.push({id:'sp_'+Math.random(), type:'spacer', height:50}); } if (limit > 0 && countInColumn >= limit && idx < finalBlocks.length - 1) { processedBlocks.push({id:'br_'+Math.random(), type:'break'}); countInColumn = 0; } });
            
            if(overwrite) State.docData.blocks = processedBlocks; else State.docData.blocks = State.docData.blocks.concat(processedBlocks);
            State.saveHistory();
            Utils.closeModal('import-modal');
            return true;
        } catch(e) { console.error(e); alert("데이터 인식 실패: "+e.message); return false; }
    }
};
