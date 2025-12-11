// Filename: js/state.js
import { Utils } from './utils.js';

export const State = {
    docData: {
        meta: { title: "시험지 제목", subtitle: "단원명", footerText: "학원명", zoom: 1.0 },
        blocks: [ { id: 'b0', type: 'concept', content: '<span class="q-label">안내</span> 내용 입력...' } ]
    },
    historyStack: [],
    historyIndex: -1,
    renderTimer: null,
    
    // 런타임 상태
    contextTargetId: null,
    dragSrcId: null,
    selectedPlaceholder: null,
    selectedImage: null,
    lastFocusId: null,
    keysPressed: {},

    saveHistory(debounceTime = 0) {
        const doSave = () => {
            const cleanData = JSON.parse(JSON.stringify(this.docData));
            cleanData.blocks.forEach(b => b.content = Utils.cleanRichContentToTex(b.content));
            const str = JSON.stringify(cleanData);
            
            if (this.historyIndex >= 0 && this.historyStack[this.historyIndex] === str) return;
            
            this.historyIndex++;
            this.historyStack = this.historyStack.slice(0, this.historyIndex);
            this.historyStack.push(str);
            
            if (this.historyStack.length > 30) {
                this.historyStack.shift();
                this.historyIndex--;
            }
            localStorage.setItem('editorAutoSave', str);
        };

        if (debounceTime > 0) {
            clearTimeout(this.renderTimer);
            this.renderTimer = setTimeout(doSave, debounceTime);
        } else {
            doSave();
        }
    },

    loadFromHistory(str) {
        if (!str) return false;
        try {
            this.docData = JSON.parse(str);
            return true;
        } catch(e) { console.error(e); return false; }
    },

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.docData = JSON.parse(this.historyStack[this.historyIndex]);
            return true;
        }
        return false;
    },

    redo() {
        if (this.historyIndex < this.historyStack.length - 1) {
            this.historyIndex++;
            this.docData = JSON.parse(this.historyStack[this.historyIndex]);
            return true;
        }
        return false;
    }
};