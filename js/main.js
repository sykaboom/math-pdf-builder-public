// Filename: js/main.js
import { State } from './state.js';
import { Utils } from './utils.js';
import { ManualRenderer, FileSystem } from './services.js';
import { Renderer } from './renderer.js';
import { Actions } from './actions.js';
import { Events } from './events.js';

const formatDateYMD = (value, timeZone) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    if (timeZone && typeof Intl !== 'undefined') {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formatter.format(date);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getFileHandleByPath = async (root, relPath) => {
    const parts = relPath.split('/').filter(Boolean);
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i]);
    }
    return dir.getFileHandle(parts[parts.length - 1]);
};

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
    const normalizeLlm = document.getElementById('setting-normalize-llm');
    if(Actions.confirmImport(document.getElementById('import-textarea').value.trim(), overwrite, parseInt(document.getElementById('setting-limit').value)||0, document.getElementById('setting-spacer').checked, normalizeLlm ? normalizeLlm.checked : false)) {
        Renderer.renderPages(); ManualRenderer.renderAll();
    }
};
window.executeFindReplace = () => {
    const f = document.getElementById('fr-find-input').value; const r = document.getElementById('fr-replace-input').value;
    if(!f) return;
    let replaceCount = 0;
    State.docData.blocks.forEach(b => {
        if (!b.content) return;
        let idx = b.content.indexOf(f);
        if (idx === -1) return;
        while (idx !== -1) { replaceCount++; idx = b.content.indexOf(f, idx + f.length); }
        b.content = b.content.replaceAll(f, r);
    });
    Renderer.renderPages(); ManualRenderer.renderAll(); State.saveHistory(); Utils.closeModal('find-replace-modal');
    Utils.showToast(`"${f}" → "${r}" ${replaceCount}건 바꿈`, replaceCount ? "success" : "info");
};
window.performUndo = () => { if(State.undo()) { Renderer.renderPages(); ManualRenderer.renderAll(); } };
window.performRedo = () => { if(State.redo()) { Renderer.renderPages(); ManualRenderer.renderAll(); } };
window.resetProject = () => { if(confirm('초기화하시겠습니까? (저장되지 않은 내용은 삭제됩니다)')) { State.docData.blocks=[{ id: 'b0', type: 'concept', content: '<span class="q-label">안내</span> 내용 입력...' }]; Renderer.renderPages(); State.saveHistory(); } };
let printPreflightData = null;
const doPrint = () => { Utils.showLoading("🖨️ 인쇄 준비 중..."); window.print(); Utils.hideLoading(); };

window.printWithMath = () => {
    const placeholderCount = document.querySelectorAll('.image-placeholder').length;
    const unrenderedMathCount = Array.from(document.querySelectorAll('.editable-box'))
        .filter(b => (b.textContent || '').includes('$')).length;

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
    if (mode === 'render') await ManualRenderer.renderAll(null, { force: true });
    doPrint();
    printPreflightData = null;
};

const updateRenderingToggleUI = () => {
    const btn = document.getElementById('toggle-rendering-btn');
    if (!btn) return;
    btn.textContent = State.renderingEnabled ? '🔓 렌더링 해제 (편집 모드)' : '🔒 렌더링 적용 (렌더 모드)';
};

window.toggleRenderingMode = async (forceState) => {
    const next = (typeof forceState === 'boolean') ? forceState : !State.renderingEnabled;
    State.renderingEnabled = next;
    Renderer.renderPages();
    if (next) {
        await ManualRenderer.renderAll();
    } else {
        const container = document.getElementById('paper-container');
        if (container) {
            const boxes = container.querySelectorAll('.editable-box');
            boxes.forEach(box => {
                Utils.replaceTablesWithTokensInDom(box);
                Utils.replaceBlockBoxesWithTokensInDom(box);
                const cleaned = Utils.cleanRichContentToTex(box.innerHTML);
                box.innerHTML = cleaned;
                const wrap = box.closest('.block-wrapper');
                if (wrap) Actions.updateBlockContent(wrap.dataset.id, cleaned, false);
            });
            State.saveHistory();
        }
    }
    updateRenderingToggleUI();
};

window.renderAllSafe = async () => {
    if (!State.renderingEnabled) { await window.toggleRenderingMode(true); return; }
    await ManualRenderer.renderAll();
};
window.insertImageBoxSafe = () => Events.insertImageBoxSafe();
window.addImageBlockBelow = (id) => Events.addImageBlockBelow(id);
window.insertImagePlaceholderAtEnd = (id) => Events.insertImagePlaceholderAtEnd(id);
window.splitBlockAtCursor = (id) => Renderer.performAndRender(() => Events.splitBlockAtCursor(id));
window.applyBlockFont = () => Events.applyBlockFontFromMenu();
window.applyInlineFontFamily = (value) => Events.applyInlineFontFamily(value);
window.applyInlineFontSize = (value) => Events.applyInlineFontSize(value);
window.openModal = Utils.openModal;
window.closeModal = Utils.closeModal;
window.execStyle = (cmd, val) => document.execCommand(cmd, false, val);
window.downloadPromptFile = async (target) => {
    const btn = typeof target === 'string'
        ? document.querySelector(`.prompt-download[data-prompt-path="${target}"]`)
        : target;
    const path = typeof target === 'string' ? target : (btn && btn.dataset ? btn.dataset.promptPath : '');
    if (!path) return;
    const promptName = (btn && btn.dataset ? btn.dataset.promptName : '') || '';
    const promptDate = (btn && btn.dataset ? btn.dataset.promptDate : '') || '';
    const fallbackName = path.split('/').pop() || 'prompt.txt';
    const baseName = promptName || fallbackName.replace(/\.txt$/i, '');
    const cleanedBaseName = baseName.replace(/\s*다운로드\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const safeBaseName = cleanedBaseName || baseName;
    const filename = promptDate ? `${safeBaseName} (${promptDate}).txt` : `${safeBaseName}.txt`;
    const triggerDownload = (url, useNewTab = false) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        if (useNewTab) link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    try {
        let blob = null;
        if (FileSystem.dirHandle) {
            const fileHandle = await getFileHandleByPath(FileSystem.dirHandle, path);
            const file = await fileHandle.getFile();
            blob = file;
        } else if (window.location.protocol !== 'file:') {
            const response = await fetch(encodeURI(path), { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            blob = await response.blob();
        } else {
            throw new Error('file-protocol');
        }
        const url = URL.createObjectURL(blob);
        triggerDownload(url);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        // 최후 수단: 브라우저 기본 다운로드 동작에 맡김
        triggerDownload(encodeURI(path), true);
    }
};
window.updatePromptDates = async () => {
    const buttons = Array.from(document.querySelectorAll('.prompt-download[data-prompt-path]'));
    if (!buttons.length) return;

    const setDateText = (btn, text) => {
        const span = btn.querySelector('.prompt-date');
        if (!span) return;
        span.textContent = text ? `(${text})` : '';
        if (btn && btn.dataset) btn.dataset.promptDate = text === 'n/a' ? '' : (text || '');
    };

    const readDateFromGitHub = async (path) => {
        const repo = 'sykaboom/math-pdf-builder-public';
        const apiUrl = `https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(path)}&per_page=1`;
        try {
            const response = await fetch(apiUrl, { cache: 'no-store' });
            if (!response.ok) return '';
            const data = await response.json();
            const commitDate = data && data[0] && data[0].commit && data[0].commit.committer && data[0].commit.committer.date;
            return commitDate ? formatDateYMD(commitDate, 'Asia/Seoul') : '';
        } catch (e) {
            return '';
        }
    };

    for (const btn of buttons) {
        const path = btn.dataset.promptPath;
        if (!path) continue;
        const dateText = await readDateFromGitHub(path);
        setDateText(btn, dateText || 'n/a');
    }
};

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
    updateRenderingToggleUI();
    window.updatePromptDates();

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

    const columnsSel = document.getElementById('setting-columns');
    const marginTopInp = document.getElementById('setting-margin-top');
    const marginSideInp = document.getElementById('setting-margin-side');
    const columnGapInp = document.getElementById('setting-column-gap');
    const footerTextInp = document.getElementById('setting-footer-text');
    const meta = State.docData.meta;

    if (columnsSel) columnsSel.value = meta.columns || 2;
    if (marginTopInp) marginTopInp.value = meta.marginTopMm || 15;
    if (marginSideInp) marginSideInp.value = meta.marginSideMm || 10;
    if (columnGapInp) columnGapInp.value = meta.columnGapMm || 5;
    if (footerTextInp) footerTextInp.value = meta.footerText || '';

    if (columnsSel) columnsSel.addEventListener('change', async (e) => {
        State.docData.meta.columns = parseInt(e.target.value) === 1 ? 1 : 2;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    const numberHandler = async (key, inp, def) => {
        if (!inp) return;
        inp.addEventListener('change', async (e) => {
            const v = parseInt(e.target.value) || def;
            State.docData.meta[key] = v;
            Renderer.renderPages();
            await ManualRenderer.renderAll();
            State.saveHistory();
        });
    };
    numberHandler('marginTopMm', marginTopInp, 15);
    numberHandler('marginSideMm', marginSideInp, 10);
    numberHandler('columnGapMm', columnGapInp, 5);
    if (footerTextInp) footerTextInp.addEventListener('input', (e) => {
        State.docData.meta.footerText = e.target.value;
        Renderer.renderPages();
        State.saveHistory(500);
    });

    const fontFamilySel = document.getElementById('setting-font-family');
    const fontSizeInp = document.getElementById('setting-font-size');
    const labelFontFamilySel = document.getElementById('setting-label-font-family');
    const labelFontSizeInp = document.getElementById('setting-label-font-size');
    const labelBoldChk = document.getElementById('setting-label-bold');
    const labelUnderlineChk = document.getElementById('setting-label-underline');
    if (fontFamilySel) fontFamilySel.value = meta.fontFamily || 'serif';
    if (fontSizeInp) fontSizeInp.value = meta.fontSizePt || 10.5;
    if (labelFontFamilySel) labelFontFamilySel.value = meta.labelFontFamily || 'gothic';
    if (labelFontSizeInp) labelFontSizeInp.value = Number.isFinite(meta.labelFontSizePt) ? meta.labelFontSizePt : '';
    if (labelBoldChk) labelBoldChk.checked = meta.labelBold !== false;
    if (labelUnderlineChk) labelUnderlineChk.checked = meta.labelUnderline === true;
    if (fontFamilySel) fontFamilySel.addEventListener('change', async (e) => {
        State.docData.meta.fontFamily = e.target.value;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    if (fontSizeInp) fontSizeInp.addEventListener('change', async (e) => {
        State.docData.meta.fontSizePt = parseFloat(e.target.value) || 10.5;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    if (labelFontFamilySel) labelFontFamilySel.addEventListener('change', async (e) => {
        State.docData.meta.labelFontFamily = e.target.value;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    if (labelFontSizeInp) labelFontSizeInp.addEventListener('change', async (e) => {
        const raw = e.target.value;
        const value = raw === '' ? null : parseFloat(raw);
        State.docData.meta.labelFontSizePt = Number.isFinite(value) ? value : null;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    if (labelBoldChk) labelBoldChk.addEventListener('change', async (e) => {
        State.docData.meta.labelBold = !!e.target.checked;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    if (labelUnderlineChk) labelUnderlineChk.addEventListener('change', async (e) => {
        State.docData.meta.labelUnderline = !!e.target.checked;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
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
