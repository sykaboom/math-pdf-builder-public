// Filename: js/main.js
import { State } from './state.js';
import { ManualRenderer, FileSystem } from './services.js';
import { Renderer } from './renderer.js';
import { Actions } from './actions.js';
import { Events } from './events.js';
import { buildDefaultHeaderFooterContent, buildDefaultToc, EXAM_HEADER_HEIGHT_MM } from './state-normalize.js';

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
    const headerHeightInp = document.getElementById('setting-header-height');
    const footerHeightInp = document.getElementById('setting-footer-height');
    const headerTemplateSel = document.getElementById('setting-header-template');
    const footerTemplateSel = document.getElementById('setting-footer-template');
    const headerFreeFamilySel = document.getElementById('setting-header-free-font-family');
    const headerFreeSizeInp = document.getElementById('setting-header-free-font-size');
    const headerFreeWeightInp = document.getElementById('setting-header-free-font-weight');
    const headerFreeAlignSel = document.getElementById('setting-header-free-align');
    const footerFreeFamilySel = document.getElementById('setting-footer-free-font-family');
    const footerFreeSizeInp = document.getElementById('setting-footer-free-font-size');
    const footerFreeWeightInp = document.getElementById('setting-footer-free-font-weight');
    const footerFreeAlignSel = document.getElementById('setting-footer-free-align');
    const headerTableRowsInp = document.getElementById('setting-header-table-rows');
    const headerTableColsInp = document.getElementById('setting-header-table-cols');
    const footerTableRowsInp = document.getElementById('setting-footer-table-rows');
    const footerTableColsInp = document.getElementById('setting-footer-table-cols');
    const tocHeaderHeightInp = document.getElementById('setting-toc-header-height');
    const themeMainInp = document.getElementById('setting-theme-main');
    const themeSubInp = document.getElementById('setting-theme-sub');
    const themeTextInp = document.getElementById('setting-theme-text');
    const themeHeaderTextInp = document.getElementById('setting-theme-header-text');
    const themeTocTextInp = document.getElementById('setting-theme-toc-text');
    const meta = State.docData.meta;
    const settings = State.settings;
    const toc = State.docData.toc;
    const ensureHeaderFooterContent = () => {
        if (!State.docData.headerFooter) {
            State.docData.headerFooter = buildDefaultHeaderFooterContent();
        }
        if (!State.docData.headerFooter.header) {
            State.docData.headerFooter.header = buildDefaultHeaderFooterContent().header;
        }
        if (!State.docData.headerFooter.footer) {
            State.docData.headerFooter.footer = buildDefaultHeaderFooterContent().footer;
        }
        return State.docData.headerFooter;
    };

    if (columnsSel) columnsSel.value = settings.columns || 2;
    if (marginTopInp) marginTopInp.value = settings.marginTopMm || 15;
    if (marginSideInp) marginSideInp.value = settings.marginSideMm || 10;
    if (columnGapInp) columnGapInp.value = settings.columnGapMm || 5;
    if (metaTitleInp) metaTitleInp.value = meta.title || '';
    if (metaSubtitleInp) metaSubtitleInp.value = meta.subtitle || '';
    const headerConfig = settings.headerConfig || {};
    const footerConfig = settings.footerConfig || {};
    if (headerHeightInp) headerHeightInp.value = Number.isFinite(headerConfig.heightMm) ? headerConfig.heightMm : 0;
    if (footerHeightInp) footerHeightInp.value = Number.isFinite(footerConfig.heightMm) ? footerConfig.heightMm : 0;
    if (headerTemplateSel) headerTemplateSel.value = headerConfig.template || 'exam';
    if (footerTemplateSel) footerTemplateSel.value = footerConfig.template || 'exam';
    if (headerFreeFamilySel) headerFreeFamilySel.value = headerConfig.freeTypography?.fontFamily || '';
    if (headerFreeSizeInp) headerFreeSizeInp.value = Number.isFinite(headerConfig.freeTypography?.fontSizePt) ? headerConfig.freeTypography.fontSizePt : '';
    if (headerFreeWeightInp) headerFreeWeightInp.value = Number.isFinite(headerConfig.freeTypography?.fontWeight) ? headerConfig.freeTypography.fontWeight : '';
    if (headerFreeAlignSel) headerFreeAlignSel.value = headerConfig.freeTypography?.textAlign || 'center';
    if (footerFreeFamilySel) footerFreeFamilySel.value = footerConfig.freeTypography?.fontFamily || '';
    if (footerFreeSizeInp) footerFreeSizeInp.value = Number.isFinite(footerConfig.freeTypography?.fontSizePt) ? footerConfig.freeTypography.fontSizePt : '';
    if (footerFreeWeightInp) footerFreeWeightInp.value = Number.isFinite(footerConfig.freeTypography?.fontWeight) ? footerConfig.freeTypography.fontWeight : '';
    if (footerFreeAlignSel) footerFreeAlignSel.value = footerConfig.freeTypography?.textAlign || 'center';
    if (headerTableRowsInp) headerTableRowsInp.value = headerConfig.table?.rows || 1;
    if (headerTableColsInp) headerTableColsInp.value = headerConfig.table?.cols || 1;
    if (footerTableRowsInp) footerTableRowsInp.value = footerConfig.table?.rows || 1;
    if (footerTableColsInp) footerTableColsInp.value = footerConfig.table?.cols || 1;
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

    const toggleTemplateControls = (target, template) => {
        document.querySelectorAll(`.template-controls[data-target="${target}"]`).forEach((el) => {
            el.classList.toggle('active', el.dataset.template === template);
        });
    };
    if (headerTemplateSel) toggleTemplateControls('header', headerTemplateSel.value);
    if (footerTemplateSel) toggleTemplateControls('footer', footerTemplateSel.value);
    const applyExamHeaderHeightLock = () => {
        if (!headerHeightInp || !headerTemplateSel) return;
        const isExam = headerTemplateSel.value === 'exam';
        headerHeightInp.disabled = isExam;
        if (isExam) {
            headerHeightInp.value = EXAM_HEADER_HEIGHT_MM;
            if (State.settings.headerConfig) {
                State.settings.headerConfig.heightMm = EXAM_HEADER_HEIGHT_MM;
            }
        }
    };
    applyExamHeaderHeightLock();

    const applyHeaderFooterConfig = async (target, patch) => {
        const config = target === 'header' ? State.settings.headerConfig : State.settings.footerConfig;
        if (!config) return;
        Object.assign(config, patch);
        Renderer.renderPages();
        if (State.renderingEnabled) await ManualRenderer.renderAll();
        State.saveHistory();
    };

    const updateFreeTypography = async (target, patch) => {
        const config = target === 'header' ? State.settings.headerConfig : State.settings.footerConfig;
        if (!config) return;
        config.freeTypography = { ...(config.freeTypography || {}), ...patch };
        Renderer.renderPages();
        if (State.renderingEnabled) await ManualRenderer.renderAll();
        State.saveHistory();
    };

    const resizeTableData = (contentSection, rows, cols) => {
        if (!contentSection) return;
        const table = contentSection.table || {};
        const current = Array.isArray(table.data) ? table.data : [];
        const next = [];
        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                row.push((current[r] && current[r][c]) ? current[r][c] : '');
            }
            next.push(row);
        }
        contentSection.table = { data: next };
    };

    if (headerHeightInp) headerHeightInp.addEventListener('change', async (e) => {
        if (headerTemplateSel && headerTemplateSel.value === 'exam') {
            headerHeightInp.value = EXAM_HEADER_HEIGHT_MM;
            await applyHeaderFooterConfig('header', { heightMm: EXAM_HEADER_HEIGHT_MM });
            return;
        }
        const value = parseInt(e.target.value, 10);
        await applyHeaderFooterConfig('header', { heightMm: Number.isFinite(value) ? value : 0 });
    });
    if (footerHeightInp) footerHeightInp.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value, 10);
        await applyHeaderFooterConfig('footer', { heightMm: Number.isFinite(value) ? value : 0 });
    });
    if (headerTemplateSel) headerTemplateSel.addEventListener('change', async (e) => {
        const value = e.target.value;
        toggleTemplateControls('header', value);
        if (value === 'exam') {
            await applyHeaderFooterConfig('header', { template: value, heightMm: EXAM_HEADER_HEIGHT_MM });
            applyExamHeaderHeightLock();
            return;
        }
        await applyHeaderFooterConfig('header', { template: value });
        applyExamHeaderHeightLock();
    });
    if (footerTemplateSel) footerTemplateSel.addEventListener('change', async (e) => {
        const value = e.target.value;
        toggleTemplateControls('footer', value);
        await applyHeaderFooterConfig('footer', { template: value });
    });
    if (headerFreeFamilySel) headerFreeFamilySel.addEventListener('change', async (e) => {
        await updateFreeTypography('header', { fontFamily: e.target.value });
    });
    if (headerFreeSizeInp) headerFreeSizeInp.addEventListener('change', async (e) => {
        const value = parseFloat(e.target.value);
        await updateFreeTypography('header', { fontSizePt: Number.isFinite(value) ? value : null });
    });
    if (headerFreeWeightInp) headerFreeWeightInp.addEventListener('change', async (e) => {
        const value = parseFloat(e.target.value);
        await updateFreeTypography('header', { fontWeight: Number.isFinite(value) ? value : null });
    });
    if (headerFreeAlignSel) headerFreeAlignSel.addEventListener('change', async (e) => {
        await updateFreeTypography('header', { textAlign: e.target.value });
    });
    if (footerFreeFamilySel) footerFreeFamilySel.addEventListener('change', async (e) => {
        await updateFreeTypography('footer', { fontFamily: e.target.value });
    });
    if (footerFreeSizeInp) footerFreeSizeInp.addEventListener('change', async (e) => {
        const value = parseFloat(e.target.value);
        await updateFreeTypography('footer', { fontSizePt: Number.isFinite(value) ? value : null });
    });
    if (footerFreeWeightInp) footerFreeWeightInp.addEventListener('change', async (e) => {
        const value = parseFloat(e.target.value);
        await updateFreeTypography('footer', { fontWeight: Number.isFinite(value) ? value : null });
    });
    if (footerFreeAlignSel) footerFreeAlignSel.addEventListener('change', async (e) => {
        await updateFreeTypography('footer', { textAlign: e.target.value });
    });
    if (headerTableRowsInp) headerTableRowsInp.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value, 10);
        const config = State.settings.headerConfig;
        if (config && config.table) {
            const rows = Number.isFinite(value) ? Math.min(8, Math.max(1, value)) : config.table.rows;
            config.table.rows = rows;
            const contentSection = ensureHeaderFooterContent().header;
            resizeTableData(contentSection, rows, config.table.cols || 1);
            Renderer.renderPages();
            if (State.renderingEnabled) await ManualRenderer.renderAll();
            State.saveHistory();
        }
    });
    if (headerTableColsInp) headerTableColsInp.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value, 10);
        const config = State.settings.headerConfig;
        if (config && config.table) {
            const cols = Number.isFinite(value) ? Math.min(8, Math.max(1, value)) : config.table.cols;
            config.table.cols = cols;
            const contentSection = ensureHeaderFooterContent().header;
            resizeTableData(contentSection, config.table.rows || 1, cols);
            Renderer.renderPages();
            if (State.renderingEnabled) await ManualRenderer.renderAll();
            State.saveHistory();
        }
    });
    if (footerTableRowsInp) footerTableRowsInp.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value, 10);
        const config = State.settings.footerConfig;
        if (config && config.table) {
            const rows = Number.isFinite(value) ? Math.min(8, Math.max(1, value)) : config.table.rows;
            config.table.rows = rows;
            const contentSection = ensureHeaderFooterContent().footer;
            resizeTableData(contentSection, rows, config.table.cols || 1);
            Renderer.renderPages();
            if (State.renderingEnabled) await ManualRenderer.renderAll();
            State.saveHistory();
        }
    });
    if (footerTableColsInp) footerTableColsInp.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value, 10);
        const config = State.settings.footerConfig;
        if (config && config.table) {
            const cols = Number.isFinite(value) ? Math.min(8, Math.max(1, value)) : config.table.cols;
            config.table.cols = cols;
            const contentSection = ensureHeaderFooterContent().footer;
            resizeTableData(contentSection, config.table.rows || 1, cols);
            Renderer.renderPages();
            if (State.renderingEnabled) await ManualRenderer.renderAll();
            State.saveHistory();
        }
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
        const file = e.target.files[0];
        if (!file) {
            if (State.headerFooterImageTarget) State.headerFooterImageTarget = null;
            return;
        }

        const applyHeaderFooterImage = (target, url, path) => {
            const content = target === 'header'
                ? ensureHeaderFooterContent().header
                : ensureHeaderFooterContent().footer;
            if (!content) return;
            const nextImage = {
                src: url,
                path: path || null,
                style: content.image && content.image.style
                    ? { ...content.image.style }
                    : { leftPct: 0, topPct: 0, widthPct: 100, heightPct: 100 }
            };
            content.image = nextImage;
            State.headerFooterImageTarget = null;
            Renderer.renderPages();
            ManualRenderer.renderAll();
            State.saveHistory();
        };

        const applyBlockImage = (url, path) => {
            const newImg = document.createElement('img');
            newImg.src = url;
            if (path) newImg.dataset.path = path;
            newImg.style.maxWidth = '100%';
            State.selectedPlaceholder.replaceWith(newImg);
            Actions.updateBlockContent(newImg.closest('.block-wrapper').dataset.id, newImg.closest('.editable-box').innerHTML);
            State.selectedPlaceholder = null;
        };

        const target = State.headerFooterImageTarget;
        if (target) {
            if (FileSystem.dirHandle) {
                FileSystem.saveImage(file).then(saved => {
                    if (saved) applyHeaderFooterImage(target, saved.url, saved.path);
                });
            } else {
                const reader = new FileReader();
                reader.onload = (ev) => applyHeaderFooterImage(target, ev.target.result, null);
                reader.readAsDataURL(file);
            }
            e.target.value = '';
            return;
        }

        if (!State.selectedPlaceholder) return;
        if (FileSystem.dirHandle) FileSystem.saveImage(file).then(s => { if (s) applyBlockImage(s.url, s.path); });
        else { const r = new FileReader(); r.onload = (ev) => applyBlockImage(ev.target.result, null); r.readAsDataURL(file); }
        e.target.value = '';
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
