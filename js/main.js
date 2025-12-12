// Filename: js/main.js
import { State } from './state.js';
import { Utils } from './utils.js';
import { ManualRenderer, FileSystem } from './services.js';
import { Renderer } from './renderer.js';
import { Actions } from './actions.js';
import { Events } from './events.js';

window.FileSystem = FileSystem;
window.ManualRenderer = ManualRenderer;
window.saveProjectJSON = () => FileSystem.saveProjectJSON(() => Renderer.syncAllBlocks());
window.loadProjectJSONFromInput = (input) => {
    const file = input.files[0]; if(!file) return;
    const r = new FileReader();
    r.onload = async (e) => { try { State.docData = JSON.parse(e.target.result); await FileSystem.loadImagesForDisplay(State.docData.blocks); Renderer.renderPages(); ManualRenderer.renderAll(); State.saveHistory(); } catch(err) { alert("파일 로드 실패: "+err.message); } };
    r.readAsText(file);
};
window.confirmImport = (overwrite) => {
    if(Actions.confirmImport(document.getElementById('import-textarea').value.trim(), overwrite, parseInt(document.getElementById('setting-limit').value)||0, document.getElementById('setting-spacer').checked)) {
        Renderer.renderPages(); ManualRenderer.renderAll();
    }
};
window.executeFindReplace = () => {
    const f = document.getElementById('fr-find-input').value; const r = document.getElementById('fr-replace-input').value;
    if(!f) return;
    State.docData.blocks.forEach(b => b.content = b.content.replaceAll(f, r));
    Renderer.renderPages(); ManualRenderer.renderAll(); State.saveHistory(); Utils.closeModal('find-replace-modal');
};
window.performUndo = () => { if(State.undo()) { Renderer.renderPages(); ManualRenderer.renderAll(); } };
window.performRedo = () => { if(State.redo()) { Renderer.renderPages(); ManualRenderer.renderAll(); } };
window.resetProject = () => { if(confirm('초기화하시겠습니까? (저장되지 않은 내용은 삭제됩니다)')) { State.docData.blocks=[{ id: 'b0', type: 'concept', content: '<span class="q-label">안내</span> 내용 입력...' }]; Renderer.renderPages(); State.saveHistory(); } };
let printPreflightData = null;
const doPrint = () => { Utils.showLoading("🖨️ 인쇄 준비 중..."); window.print(); Utils.hideLoading(); };

window.printWithMath = () => {
    const placeholderCount = document.querySelectorAll('.image-placeholder').length;
    const unrenderedMathCount = State.docData.blocks.reduce((acc, b) => acc + (b.content && b.content.includes('$') ? 1 : 0), 0);

    if (placeholderCount > 0 || unrenderedMathCount > 0) {
        printPreflightData = { placeholderCount, unrenderedMathCount };
        const body = document.getElementById('print-preflight-body');
        if (body) {
            const lines = [];
            if (placeholderCount > 0) lines.push(`• 미삽입 이미지 박스: ${placeholderCount}개`);
            if (unrenderedMathCount > 0) lines.push(`• 미렌더 수식($ 포함): ${unrenderedMathCount}개`);
            body.innerHTML = lines.join('<br>');
        }
        Utils.openModal('print-preflight-modal');
        return;
    }
    doPrint();
};

window.printPreflightAction = async (mode) => {
    Utils.closeModal('print-preflight-modal');
    if (mode === 'cancel') { printPreflightData = null; return; }
    if (mode === 'render') await ManualRenderer.renderAll();
    doPrint();
    printPreflightData = null;
};
window.insertImageBoxSafe = () => Events.insertImageBoxSafe();
window.openModal = Utils.openModal;
window.closeModal = Utils.closeModal;
window.execStyle = (cmd, val) => document.execCommand(cmd, false, val);

// [Fix] Actions 호출 후 렌더링 파이프라인 연결
window.toggleGrayBg = () => { if(Actions.toggleStyle('bgGray')) { Renderer.renderPages(); ManualRenderer.renderAll(); } };
window.toggleBorder = () => { if(Actions.toggleStyle('bordered')) { Renderer.renderPages(); ManualRenderer.renderAll(); } };
window.applyAlign = (a) => { if(Actions.applyAlign(a)) { Renderer.renderPages(); ManualRenderer.renderAll(); } };
window.duplicateTargetBlock = () => { if(Actions.duplicateTargetBlock()) { Renderer.renderPages(); ManualRenderer.renderAll(); } };
window.addBlockAbove = (t) => { if(Actions.addBlockAbove(t)) { Renderer.renderPages(); ManualRenderer.renderAll(); } };
window.addBlockBelow = (t) => { if(Actions.addBlockBelow(t)) { Renderer.renderPages(); ManualRenderer.renderAll(); } };
window.deleteTargetBlock = () => { if(State.contextTargetId && Actions.deleteBlockById(State.contextTargetId)) { Renderer.renderPages(); ManualRenderer.renderAll(); } Utils.closeModal('context-menu'); };

window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('editorAutoSave');
    if(saved) State.loadFromHistory(saved);
    
    Renderer.renderPages(); 
    State.saveHistory(); 
    Events.initGlobalListeners();

    // [Fix] 줌 최적화 로직 복구 (입력시 CSS Transform, 놓으면 렌더링)
    const zoomRange = document.getElementById('zoomRange');
    zoomRange.addEventListener('input', (e) => { 
        const z = parseFloat(e.target.value);
        State.docData.meta.zoom = z;
        const container = document.getElementById('paper-container');
        if(container) {
            container.style.transform = `scale(${State.docData.meta.zoom})`;
            container.style.transformOrigin = 'top center';
        }
    });
    zoomRange.addEventListener('change', async () => {
        Renderer.renderPages();
        await ManualRenderer.renderAll();
    });
    
    document.getElementById('imgUpload').addEventListener('change', (e) => {
        if(!State.selectedPlaceholder || !e.target.files[0]) return;
        const file = e.target.files[0];
        const cb = (url, path) => { 
            const newImg = document.createElement('img'); newImg.src = url; if(path) newImg.dataset.path = path; newImg.style.maxWidth = '100%'; 
            State.selectedPlaceholder.replaceWith(newImg); 
            Actions.updateBlockContent(newImg.closest('.block-wrapper').dataset.id, newImg.closest('.editable-box').innerHTML); 
            State.selectedPlaceholder=null; 
        };
        if(FileSystem.dirHandle) FileSystem.saveImage(file).then(s => { if(s) cb(s.url, s.path); });
        else { const r=new FileReader(); r.onload=(ev)=>cb(ev.target.result, null); r.readAsDataURL(file); }
        e.target.value='';
    });

    console.log("🚀 Editor System Initialized (v4.0.1 Fixed - All Features Restored)");
});
