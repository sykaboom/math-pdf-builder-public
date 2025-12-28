// Filename: js/main.js
import { State } from './state.js';
import { ManualRenderer, FileSystem } from './services.js';
import { Renderer } from './renderer.js';
import { Actions } from './actions.js';
import { Events } from './events.js';
import { buildDefaultToc } from './state-normalize.js';

window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('editorAutoSave');
    if(saved) State.loadFromHistory(saved);
    
    Events.initGlobalListeners();
    Events.toggleRenderingMode(false);
    Renderer.renderPages();

    // [Fix] 줌 최적화 로직 복구 (입력시 CSS Transform, 놓으면 렌더링)
    const zoomRange = document.getElementById('zoomRange');
    zoomRange.addEventListener('input', (e) => { 
        const z = parseFloat(e.target.value);
        State.settings.zoom = z;
        const container = document.getElementById('paper-container');
        if(container) {
            container.style.transform = `scale(${State.settings.zoom})`;
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
    const metaTitleInp = document.getElementById('setting-meta-title');
    const metaSubtitleInp = document.getElementById('setting-meta-subtitle');
    const footerTextInp = document.getElementById('setting-footer-text');
    const documentModeSel = document.getElementById('setting-document-mode');
    const tocEnabledChk = document.getElementById('setting-toc-enabled');
    const tocHeaderHeightInp = document.getElementById('setting-toc-header-height');
    const themeMainInp = document.getElementById('setting-theme-main');
    const themeSubInp = document.getElementById('setting-theme-sub');
    const themeTextInp = document.getElementById('setting-theme-text');
    const themeHeaderTextInp = document.getElementById('setting-theme-header-text');
    const themeTocTextInp = document.getElementById('setting-theme-toc-text');
    const meta = State.docData.meta;
    const settings = State.settings;
    const toc = State.docData.toc;

    if (columnsSel) columnsSel.value = settings.columns || 2;
    if (marginTopInp) marginTopInp.value = settings.marginTopMm || 15;
    if (marginSideInp) marginSideInp.value = settings.marginSideMm || 10;
    if (columnGapInp) columnGapInp.value = settings.columnGapMm || 5;
    if (metaTitleInp) metaTitleInp.value = meta.title || '';
    if (metaSubtitleInp) metaSubtitleInp.value = meta.subtitle || '';
    if (footerTextInp) footerTextInp.value = meta.footerText || '';
    if (documentModeSel) documentModeSel.value = settings.documentMode === 'textbook' ? 'textbook' : 'exam';
    if (tocEnabledChk) tocEnabledChk.checked = toc ? toc.enabled === true : false;
    if (tocHeaderHeightInp) tocHeaderHeightInp.value = toc && toc.headerHeightMm ? toc.headerHeightMm : 80;
    if (themeMainInp) themeMainInp.value = settings.designConfig?.themeMain || '#1a1a2e';
    if (themeSubInp) themeSubInp.value = settings.designConfig?.themeSub || '#333333';
    if (themeTextInp) themeTextInp.value = settings.designConfig?.textColor || '#000000';
    if (themeHeaderTextInp) themeHeaderTextInp.value = settings.designConfig?.headerTextColor || '#ffffff';
    if (themeTocTextInp) themeTocTextInp.value = settings.designConfig?.tocTextColor || '#000000';

    if (columnsSel) columnsSel.addEventListener('change', async (e) => {
        State.settings.columns = parseInt(e.target.value) === 1 ? 1 : 2;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    const numberHandler = async (key, inp, def) => {
        if (!inp) return;
        inp.addEventListener('change', async (e) => {
            const v = parseInt(e.target.value) || def;
            State.settings[key] = v;
            Renderer.renderPages();
            await ManualRenderer.renderAll();
            State.saveHistory();
        });
    };
    numberHandler('marginTopMm', marginTopInp, 15);
    numberHandler('marginSideMm', marginSideInp, 10);
    numberHandler('columnGapMm', columnGapInp, 5);
    if (metaTitleInp) metaTitleInp.addEventListener('input', (e) => {
        State.docData.meta.title = e.target.value;
        Renderer.renderPages();
        State.saveHistory(500);
    });
    if (metaSubtitleInp) metaSubtitleInp.addEventListener('input', (e) => {
        State.docData.meta.subtitle = e.target.value;
        Renderer.renderPages();
        State.saveHistory(500);
    });
    if (footerTextInp) footerTextInp.addEventListener('input', (e) => {
        State.docData.meta.footerText = e.target.value;
        Renderer.renderPages();
        State.saveHistory(500);
    });

    if (documentModeSel) documentModeSel.addEventListener('change', async (e) => {
        const mode = e.target.value === 'textbook' ? 'textbook' : 'exam';
        State.settings.documentMode = mode;
        Renderer.renderPages();
        if (State.renderingEnabled) await ManualRenderer.renderAll();
        State.saveHistory();
    });

    if (tocEnabledChk) tocEnabledChk.addEventListener('change', async (e) => {
        const enabled = e.target.checked === true;
        if (enabled) {
            if (!State.docData.toc) State.docData.toc = buildDefaultToc();
            State.docData.toc.enabled = true;
        } else if (State.docData.toc) {
            State.docData.toc.enabled = false;
        }
        Renderer.renderPages();
        if (State.renderingEnabled) await ManualRenderer.renderAll();
        State.saveHistory();
    });

    if (tocHeaderHeightInp) tocHeaderHeightInp.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value, 10);
        if (!State.docData.toc) State.docData.toc = buildDefaultToc();
        State.docData.toc.headerHeightMm = value && value > 0 ? value : 80;
        Renderer.renderPages();
        if (State.renderingEnabled) await ManualRenderer.renderAll();
        State.saveHistory();
    });

    const updateDesignConfig = async (patch) => {
        const current = State.settings.designConfig || {};
        State.settings.designConfig = { ...current, ...patch };
        Renderer.renderPages();
        if (State.renderingEnabled) await ManualRenderer.renderAll();
        State.saveHistory();
    };

    if (themeMainInp) themeMainInp.addEventListener('change', async (e) => {
        await updateDesignConfig({ themeMain: e.target.value || '#1a1a2e' });
    });
    if (themeSubInp) themeSubInp.addEventListener('change', async (e) => {
        await updateDesignConfig({ themeSub: e.target.value || '#333333' });
    });
    if (themeTextInp) themeTextInp.addEventListener('change', async (e) => {
        await updateDesignConfig({ textColor: e.target.value || '#000000' });
    });
    if (themeHeaderTextInp) themeHeaderTextInp.addEventListener('change', async (e) => {
        await updateDesignConfig({ headerTextColor: e.target.value || '#ffffff' });
    });
    if (themeTocTextInp) themeTocTextInp.addEventListener('change', async (e) => {
        await updateDesignConfig({ tocTextColor: e.target.value || '#000000' });
    });

    const fontFamilySel = document.getElementById('setting-font-family');
    const fontSizeInp = document.getElementById('setting-font-size');
    const labelFontFamilySel = document.getElementById('setting-label-font-family');
    const labelFontSizeInp = document.getElementById('setting-label-font-size');
    const labelBoldChk = document.getElementById('setting-label-bold');
    const labelUnderlineChk = document.getElementById('setting-label-underline');
    if (fontFamilySel) fontFamilySel.value = settings.fontFamily || 'serif';
    if (fontSizeInp) fontSizeInp.value = settings.fontSizePt || 10.5;
    if (labelFontFamilySel) labelFontFamilySel.value = settings.labelFontFamily || 'gothic';
    if (labelFontSizeInp) labelFontSizeInp.value = Number.isFinite(settings.labelFontSizePt) ? settings.labelFontSizePt : '';
    if (labelBoldChk) labelBoldChk.checked = settings.labelBold !== false;
    if (labelUnderlineChk) labelUnderlineChk.checked = settings.labelUnderline === true;
    if (fontFamilySel) fontFamilySel.addEventListener('change', async (e) => {
        State.settings.fontFamily = e.target.value;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    if (fontSizeInp) fontSizeInp.addEventListener('change', async (e) => {
        State.settings.fontSizePt = parseFloat(e.target.value) || 10.5;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    if (labelFontFamilySel) labelFontFamilySel.addEventListener('change', async (e) => {
        State.settings.labelFontFamily = e.target.value;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    if (labelFontSizeInp) labelFontSizeInp.addEventListener('change', async (e) => {
        const raw = e.target.value;
        const value = raw === '' ? null : parseFloat(raw);
        State.settings.labelFontSizePt = Number.isFinite(value) ? value : null;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    if (labelBoldChk) labelBoldChk.addEventListener('change', async (e) => {
        State.settings.labelBold = !!e.target.checked;
        Renderer.renderPages();
        await ManualRenderer.renderAll();
        State.saveHistory();
    });
    if (labelUnderlineChk) labelUnderlineChk.addEventListener('change', async (e) => {
        State.settings.labelUnderline = !!e.target.checked;
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

    const tocImageInput = document.getElementById('tocImageUpload');
    const tocOverlayImageInput = document.getElementById('tocOverlayImageUpload');
    const applyTocImage = async (file, targetKey) => {
        if (!file) return;
        if (!State.docData.toc) State.docData.toc = buildDefaultToc();
        const fallbackDataUrl = (fileObj) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(fileObj);
        });
        if (FileSystem.dirHandle) {
            const saved = await FileSystem.saveImage(file);
            if (saved) {
                State.docData.toc[targetKey] = { src: saved.url || '', path: saved.path || '' };
            } else {
                State.docData.toc[targetKey] = { src: await fallbackDataUrl(file), path: '' };
            }
        } else {
            State.docData.toc[targetKey] = { src: await fallbackDataUrl(file), path: '' };
        }
        Renderer.renderPages();
        if (State.renderingEnabled) await ManualRenderer.renderAll();
        State.saveHistory();
    };
    if (tocImageInput) tocImageInput.addEventListener('change', async (e) => {
        await applyTocImage(e.target.files && e.target.files[0], 'headerImage');
        e.target.value = '';
    });
    if (tocOverlayImageInput) tocOverlayImageInput.addEventListener('change', async (e) => {
        await applyTocImage(e.target.files && e.target.files[0], 'headerOverlayImage');
        e.target.value = '';
    });

});
