// Filename: js/renderer.js
import { State } from './state.js';
import { Actions } from './actions.js';
import { ManualRenderer } from './services.js';
import { Utils } from './utils.js';
import { Events } from './events.js';
import { buildDefaultChapterCover, buildDefaultHeaderFooterContent, buildDefaultToc, EXAM_HEADER_HEIGHT_MM } from './state-normalize.js';

const INLINE_TAG_PATTERN = /<\/?(span|b|strong|i|em|u|br|font)\b/i;
const EXAM_HEADER_EMPTY_HEIGHT_MM = 12;

const decodeHtml = (value = '') => {
    const tmp = document.createElement('div');
    const raw = String(value || '');
    const safe = raw.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    tmp.innerHTML = safe;
    return tmp.textContent || '';
};

const setEditableContent = (el, value = '') => {
    if (!el) return;
    const raw = String(value ?? '');
    if (INLINE_TAG_PATTERN.test(raw)) {
        el.innerHTML = Utils.sanitizeHtml(raw);
        return;
    }
    el.textContent = decodeHtml(raw);
};

const getEditableHtml = (el) => Utils.sanitizeHtml(el?.innerHTML || '');
const getEditableText = (el) => (el?.textContent || '').replace(/\u00A0/g, ' ').trim();

const hexToRgba = (hex, alpha = 0.1) => {
    const raw = String(hex || '').trim();
    const match = raw.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!match) return `rgba(0, 0, 0, ${alpha})`;
    let value = match[1];
    if (value.length === 3) value = value.split('').map(ch => ch + ch).join('');
    const intVal = parseInt(value, 16);
    const r = (intVal >> 16) & 255;
    const g = (intVal >> 8) & 255;
    const b = intVal & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const mixHexWithWhite = (hex, ratio = 0.5) => {
    const raw = String(hex || '').trim();
    const match = raw.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!match) return 'rgb(204, 204, 204)';
    let value = match[1];
    if (value.length === 3) value = value.split('').map(ch => ch + ch).join('');
    const intVal = parseInt(value, 16);
    const r = (intVal >> 16) & 255;
    const g = (intVal >> 8) & 255;
    const b = intVal & 255;
    const mix = (channel) => Math.round(channel + (255 - channel) * ratio);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};

export const Renderer = {
    conceptBlankSyncing: false,
    conceptBlankPending: null,
    queueConceptBlankSummaryUpdate(changedBlockId = null) {
        if (!this.conceptBlankPending) {
            this.conceptBlankPending = { changedBlockId: changedBlockId || null, timer: null };
        } else if (changedBlockId) {
            if (this.conceptBlankPending.changedBlockId && this.conceptBlankPending.changedBlockId !== changedBlockId) {
                this.conceptBlankPending.changedBlockId = null;
            } else if (!this.conceptBlankPending.changedBlockId) {
                this.conceptBlankPending.changedBlockId = changedBlockId;
            }
        }
        if (this.conceptBlankPending.timer) return;
        this.conceptBlankPending.timer = setTimeout(() => this.flushConceptBlankSummaryUpdate(), 80);
    },
    async flushConceptBlankSummaryUpdate() {
        const pending = this.conceptBlankPending;
        if (!pending) return;
        if (this.conceptBlankSyncing || ManualRenderer.isRendering) {
            pending.timer = setTimeout(() => this.flushConceptBlankSummaryUpdate(), 80);
            return;
        }
        this.conceptBlankPending = null;
        await this.updateConceptBlankSummary({ changedBlockId: pending.changedBlockId });
    },
    getPageColumnsCount(pageNum) {
        const settings = State.settings || {};
        const layouts = settings.pageLayouts || {};
        const override = layouts[pageNum];
        if (override === 1 || override === 2) return override;
        return parseInt(settings.columns) === 1 ? 1 : 2;
    },

    getPageColumns(pageNum, pageEl) {
        let count = null;
        if (pageEl && pageEl.dataset && pageEl.dataset.planId) {
            const plan = Array.isArray(State.docData.pagePlan) ? State.docData.pagePlan : [];
            const entry = plan.find(item => item.id === pageEl.dataset.planId);
            if (entry && (entry.columns === 1 || entry.columns === 2)) count = entry.columns;
        }
        if (!count) count = this.getPageColumnsCount(pageNum);
        if (count === 1) return [pageEl.querySelector('.column.single')];
        return [pageEl.querySelector('.column.left'), pageEl.querySelector('.column.right')];
    },

    resolveHeaderFooterConfig(kind) {
        const settings = State.settings || {};
        if (kind === 'header') return settings.headerConfig || {};
        return settings.footerConfig || {};
    },
    resolveHeaderFooterConfigForEntry(kind, planEntry) {
        const base = { ...(this.resolveHeaderFooterConfig(kind) || {}) };
        const override = planEntry && planEntry[kind] && typeof planEntry[kind] === 'object' ? planEntry[kind] : null;
        if (!override) return base;
        const allowedTemplates = new Set(['exam', 'basic', 'free', 'table', 'image', 'none']);
        if (typeof override.template === 'string' && allowedTemplates.has(override.template)) {
            base.template = override.template;
        }
        const heightRaw = typeof override.heightMm === 'number' ? override.heightMm : parseFloat(override.heightMm);
        if (Number.isFinite(heightRaw) && heightRaw >= 0) {
            base.heightMm = heightRaw;
        }
        return base;
    },
    resolveHeaderFooterContent(kind) {
        if (!State.docData.headerFooter) {
            State.docData.headerFooter = buildDefaultHeaderFooterContent();
        }
        if (!State.docData.headerFooter.header) {
            State.docData.headerFooter.header = buildDefaultHeaderFooterContent().header;
        }
        if (!State.docData.headerFooter.footer) {
            State.docData.headerFooter.footer = buildDefaultHeaderFooterContent().footer;
        }
        if (kind === 'header') return State.docData.headerFooter.header;
        return State.docData.headerFooter.footer;
    },

    applyHeaderFooterSize(area, heightMm) {
        const height = Number.isFinite(heightMm) ? heightMm : null;
        if (height === null) return;
        area.style.height = `${height}mm`;
        area.style.minHeight = `${height}mm`;
    },

    applyFreeTypography(target, typography) {
        if (!target || !typography) return;
        const familyMap = {
            serif: "'Noto Serif KR', serif",
            gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
            gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
            'noto-sans': "'Noto Sans KR', sans-serif",
            'noto-serif': "'Noto Serif KR', serif"
        };
        if (typography.fontFamily) {
            target.style.fontFamily = familyMap[typography.fontFamily] || typography.fontFamily;
        }
        if (typography.fontSizePt) target.style.fontSize = `${typography.fontSizePt}pt`;
        if (typography.fontWeight) target.style.fontWeight = typography.fontWeight;
        if (typography.textAlign) target.style.textAlign = typography.textAlign;
        if (typography.color) target.style.color = typography.color;
    },

    applyRelativeImageStyle(img, style) {
        if (!img || !style) return;
        img.style.left = `${style.leftPct}%`;
        img.style.top = `${style.topPct}%`;
        img.style.width = `${style.widthPct}%`;
        img.style.height = `${style.heightPct}%`;
        img.style.right = 'auto';
        img.style.bottom = 'auto';
    },

    syncHeaderFooterTableData(table, content) {
        if (!table || !content) return;
        const rows = Array.from(table.rows);
        const data = rows.map(row => Array.from(row.cells).map(cell => Utils.sanitizeHtml(cell.innerHTML || '')));
        content.table = { data };
        State.saveHistory(500);
    },

    buildHeaderFooterTable(config, content) {
        const table = document.createElement('table');
        table.className = 'header-footer-table';
        const rows = config.table?.rows || 1;
        const cols = config.table?.cols || 1;
        const data = Array.isArray(content?.table?.data) ? content.table.data : [];
        for (let r = 0; r < rows; r++) {
            const tr = document.createElement('tr');
            for (let c = 0; c < cols; c++) {
                const td = document.createElement('td');
                td.contentEditable = 'true';
                td.innerHTML = (data[r] && data[r][c]) ? data[r][c] : '';
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        const sync = Utils.debounce(() => this.syncHeaderFooterTableData(table, content), 300);
        table.addEventListener('input', sync);
        return table;
    },

    buildHeaderFooterFreeBox(config, content) {
        const box = document.createElement('div');
        box.className = 'header-footer-freebox';
        box.contentEditable = 'true';
        box.innerHTML = Utils.sanitizeHtml(content?.freeHtml || '');
        this.applyFreeTypography(box, config.freeTypography);
        box.addEventListener('input', () => {
            const nextHtml = Utils.sanitizeHtml(box.innerHTML || '');
            content.freeHtml = nextHtml;
            State.saveHistory(500);
        });
        return box;
    },

    buildHeaderFooterImage(content, kind) {
        const container = document.createElement('div');
        container.className = 'header-footer-image-container';
        const image = content?.image;
        if (image && (image.src || image.path)) {
            const img = document.createElement('img');
            img.className = `header-footer-image ${kind}-image`;
            img.src = image.src || image.path;
            if (image.path) img.dataset.path = image.path;
            img.dataset.hfTarget = kind;
            img.draggable = false;
            const style = image.style || { leftPct: 0, topPct: 0, widthPct: 100, heightPct: 100 };
            this.applyRelativeImageStyle(img, style);
            container.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'header-footer-image-placeholder';
            placeholder.textContent = '이미지 없음';
            container.appendChild(placeholder);
        }
        return container;
    },

    buildExamHeader(meta) {
        const table = document.createElement('table');
        table.className = 'header-table';
        table.innerHTML = `<colgroup><col class="col-title"><col class="col-label"><col class="col-input-wide"><col class="col-label"><col class="col-input-narrow"></colgroup><tr><td rowspan="2" class="col-title">TEST</td><td class="col-label">과정</td><td><input class="header-input meta-title"></td><td class="col-label">성명</td><td><input class="header-input"></td></tr><tr><td class="col-label">단원</td><td><input class="header-input meta-subtitle"></td><td class="col-label">점수</td><td></td></tr>`;
        const titleInput = table.querySelector('.meta-title');
        if (titleInput) titleInput.value = meta.title || '';
        const subtitleInput = table.querySelector('.meta-subtitle');
        if (subtitleInput) subtitleInput.value = meta.subtitle || '';
        return table;
    },

    buildBasicHeader() {
        const line = document.createElement('div');
        line.className = 'header-line';
        line.style.marginTop = 'auto';
        return line;
    },

    buildExamFooter(meta, pageNum) {
        const container = document.createElement('div');
        container.className = 'footer-content-first';
        container.innerHTML = `<div>- ${pageNum} -</div>`;
        return container;
    },

    buildBasicFooter(pageNum) {
        const container = document.createElement('div');
        container.innerHTML = `<div class="footer-line"></div><div>- ${pageNum} -</div>`;
        return container;
    },

    createPage(num, options = {}) {
        const { planEntry = null } = options;
        const div = document.createElement('div');
        div.className = 'page';
        if (num === 1) div.classList.add('page-first');

        const meta = State.docData.meta;
        const settings = State.settings;
        const headerConfig = this.resolveHeaderFooterConfigForEntry('header', planEntry);
        const footerConfig = this.resolveHeaderFooterConfigForEntry('footer', planEntry);
        const headerContentData = this.resolveHeaderFooterContent('header');
        const footerContentData = this.resolveHeaderFooterContent('footer');
        const isExamDoc = settings.documentMode === 'exam';
        const headerHeight = headerConfig.template === 'none'
            ? (isExamDoc ? EXAM_HEADER_EMPTY_HEIGHT_MM : 0)
            : (headerConfig.template === 'exam' ? EXAM_HEADER_HEIGHT_MM : headerConfig.heightMm);
        const footerHeight = footerConfig.template === 'none' ? 0 : footerConfig.heightMm;
        const columnsCount = planEntry && (planEntry.columns === 1 || planEntry.columns === 2)
            ? planEntry.columns
            : this.getPageColumnsCount(num);

        const headerArea = document.createElement('div');
        headerArea.className = 'header-area';
        this.applyHeaderFooterSize(headerArea, headerHeight);
        if (headerConfig.template === 'none') {
            headerArea.style.marginBottom = '0';
        }
        if (headerHeight === 0) {
            headerArea.style.marginBottom = '0';
            headerArea.style.overflow = 'visible';
        }
        let headerContent = null;
        if (headerConfig.template === 'exam') headerContent = this.buildExamHeader(meta);
        else if (headerConfig.template === 'basic') headerContent = this.buildBasicHeader();
        else if (headerConfig.template === 'free') headerContent = this.buildHeaderFooterFreeBox(headerConfig, headerContentData);
        else if (headerConfig.template === 'table') headerContent = this.buildHeaderFooterTable(headerConfig, headerContentData);
        else if (headerConfig.template === 'image') headerContent = this.buildHeaderFooterImage(headerContentData, 'header');
        if (headerContent) headerArea.appendChild(headerContent);

        const bodyClass = columnsCount === 1 ? 'body-container single-column' : 'body-container';
        const bodyContainer = document.createElement('div');
        bodyContainer.className = bodyClass;
        if (columnsCount === 1) {
            const col = document.createElement('div');
            col.className = 'column single';
            bodyContainer.appendChild(col);
        } else {
            const left = document.createElement('div');
            const right = document.createElement('div');
            left.className = 'column left';
            right.className = 'column right';
            bodyContainer.appendChild(left);
            bodyContainer.appendChild(right);
        }

        const footerArea = document.createElement('div');
        footerArea.className = 'page-footer';
        this.applyHeaderFooterSize(footerArea, footerHeight);
        if (footerHeight === 0) {
            footerArea.style.marginTop = '0';
            footerArea.style.overflow = 'visible';
        }
        let footerContent = null;
        if (footerConfig.template === 'exam') footerContent = this.buildExamFooter(meta, num);
        else if (footerConfig.template === 'basic') footerContent = this.buildBasicFooter(num);
        else if (footerConfig.template === 'free') footerContent = this.buildHeaderFooterFreeBox(footerConfig, footerContentData);
        else if (footerConfig.template === 'table') footerContent = this.buildHeaderFooterTable(footerConfig, footerContentData);
        else if (footerConfig.template === 'image') footerContent = this.buildHeaderFooterImage(footerContentData, 'footer');
        if (footerContent) footerArea.appendChild(footerContent);

        div.appendChild(headerArea);
        div.appendChild(bodyContainer);
        div.appendChild(footerArea);
        this.attachHeaderFooterControls(div, planEntry);

        div.style.padding = `${settings.marginTopMm || 15}mm ${settings.marginSideMm || 10}mm`;
        if (columnsCount === 2) {
            const gap = settings.columnGapMm || 5;
            const leftCol = div.querySelector('.column.left');
            const rightCol = div.querySelector('.column.right');
            if (leftCol) leftCol.style.paddingRight = gap + 'mm';
            if (rightCol) rightCol.style.paddingLeft = gap + 'mm';
        }

        const titleInp = div.querySelector('.meta-title');
        const subInp = div.querySelector('.meta-subtitle');
        if (titleInp) titleInp.oninput = (e) => { State.docData.meta.title = e.target.value; State.saveHistory(500); };
        if (subInp) subInp.oninput = (e) => { State.docData.meta.subtitle = e.target.value; State.saveHistory(500); };
        return div;
    },

    createTocPage(toc) {
        const page = document.createElement('div');
        page.className = 'page toc-page';
        page.style.padding = '0';

        const design = State.settings.designConfig || {};
        page.style.setProperty('--toc-main-color', design.themeMain || '#1a1a2e');
        page.style.setProperty('--toc-sub-color', design.themeSub || '#333333');
        page.style.setProperty('--toc-text-color', design.textColor || '#000000');
        page.style.setProperty('--toc-header-text-color', design.headerTextColor || '#ffffff');
        page.style.setProperty('--toc-body-text-color', design.tocTextColor || design.textColor || '#000000');
        const fontFamilyMap = {
            serif: "'Noto Serif KR', serif",
            gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
            gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
            'noto-sans': "'Noto Sans KR', sans-serif",
            'noto-serif': "'Noto Serif KR', serif"
        };
        const tocTypography = design.tocTypography || {};
        const applyTypographyVars = (key, prefix) => {
            const config = tocTypography[key];
            if (!config) return;
            const familyKey = config.fontFamily || 'serif';
            const familyValue = fontFamilyMap[familyKey] || familyKey;
            page.style.setProperty(`--${prefix}-font-family`, familyValue);
            page.style.setProperty(`--${prefix}-font-size`, `${config.fontSizePt}pt`);
            page.style.setProperty(`--${prefix}-font-weight`, config.fontWeight);
            page.style.setProperty(`--${prefix}-font-style`, config.italic ? 'italic' : 'normal');
            page.style.setProperty(`--${prefix}-text-decoration`, config.underline ? 'underline' : 'none');
            page.style.setProperty(`--${prefix}-color`, config.color);
        };
        applyTypographyVars('title', 'toc-title');
        applyTypographyVars('subtitle', 'toc-subtitle');
        applyTypographyVars('section', 'toc-section');
        applyTypographyVars('part', 'toc-part');
        applyTypographyVars('sub', 'toc-sub');

        const header = document.createElement('div');
        header.className = 'toc-header-container';
        const height = Number.isFinite(toc.headerHeightMm) ? toc.headerHeightMm : 80;
        header.style.height = `${height}mm`;

        const applyTocImageStyle = (img, style) => {
            if (!img || !style) return;
            const left = Number.isFinite(style.leftPct) ? style.leftPct : null;
            const top = Number.isFinite(style.topPct) ? style.topPct : null;
            const width = Number.isFinite(style.widthPct) ? style.widthPct : null;
            const heightPct = Number.isFinite(style.heightPct) ? style.heightPct : null;
            if ([left, top, width, heightPct].some(value => value === null)) return;
            img.style.left = `${left}%`;
            img.style.top = `${top}%`;
            img.style.width = `${width}%`;
            img.style.height = `${heightPct}%`;
            img.style.right = 'auto';
            img.style.bottom = 'auto';
        };

        const headerImage = toc.headerImage;
        if (headerImage && (headerImage.src || headerImage.path)) {
            const img = document.createElement('img');
            img.className = 'toc-bg-image';
            img.src = headerImage.src || headerImage.path;
            if (headerImage.path) img.dataset.path = headerImage.path;
            img.dataset.tocImageKey = 'headerImage';
            img.draggable = false;
            applyTocImageStyle(img, headerImage.style);
            header.appendChild(img);
        }

        const overlayImage = toc.headerOverlayImage;
        if (overlayImage && (overlayImage.src || overlayImage.path)) {
            const img = document.createElement('img');
            img.className = 'toc-overlay-image';
            img.src = overlayImage.src || overlayImage.path;
            if (overlayImage.path) img.dataset.path = overlayImage.path;
            img.dataset.tocImageKey = 'headerOverlayImage';
            img.draggable = false;
            applyTocImageStyle(img, overlayImage.style);
            header.appendChild(img);
        }

        const headerInner = document.createElement('div');
        headerInner.className = 'toc-header-inner';

        const titleBox = document.createElement('div');
        titleBox.className = 'toc-title-box';

        const titleEl = document.createElement('div');
        titleEl.className = 'toc-title';
        titleEl.contentEditable = 'true';
        setEditableContent(titleEl, toc.title || 'CONTENTS');
        titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
        titleEl.addEventListener('input', () => {
            toc.title = getEditableHtml(titleEl);
            State.saveHistory(500);
        });

        const subtitleEl = document.createElement('div');
        subtitleEl.className = 'toc-subtitle';
        subtitleEl.contentEditable = 'true';
        setEditableContent(subtitleEl, toc.subtitle || '');
        subtitleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
        subtitleEl.addEventListener('input', () => {
            toc.subtitle = getEditableHtml(subtitleEl);
            State.saveHistory(500);
        });

        titleBox.appendChild(titleEl);
        titleBox.appendChild(subtitleEl);
        headerInner.appendChild(titleBox);
        header.appendChild(headerInner);

        const imageControls = document.createElement('div');
        imageControls.className = 'toc-image-controls toc-edit-control';

        const bgBtn = document.createElement('button');
        bgBtn.type = 'button';
        bgBtn.className = 'toc-image-btn';
        bgBtn.dataset.action = 'toc-upload-image';
        bgBtn.textContent = headerImage && (headerImage.src || headerImage.path) ? '배경 이미지 변경' : '배경 이미지 추가';

        const overlayBtn = document.createElement('button');
        overlayBtn.type = 'button';
        overlayBtn.className = 'toc-image-btn';
        overlayBtn.dataset.action = 'toc-upload-overlay-image';
        overlayBtn.textContent = overlayImage && (overlayImage.src || overlayImage.path) ? '오버레이 변경' : '오버레이 추가';

        imageControls.appendChild(bgBtn);
        imageControls.appendChild(overlayBtn);
        header.appendChild(imageControls);

        const list = document.createElement('div');
        list.className = 'toc-list-container';
        const listInner = document.createElement('div');
        listInner.className = 'toc-list-inner';

        if (!Array.isArray(toc.items)) toc.items = [];

        const createItemId = () => `toc_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
        const rerender = async () => {
            this.renderPages();
            if (State.renderingEnabled) await ManualRenderer.renderAll();
        };
        const updateItem = (id, patch) => {
            const item = toc.items.find(entry => entry.id === id);
            if (!item) return;
            const nextPatch = { ...patch };
            if (typeof nextPatch.text === 'string') nextPatch.text = Utils.sanitizeHtml(nextPatch.text);
            Object.assign(item, nextPatch);
            State.saveHistory(500);
        };
        const toRoman = (num) => {
            const map = [
                { value: 1000, symbol: 'M' },
                { value: 900, symbol: 'CM' },
                { value: 500, symbol: 'D' },
                { value: 400, symbol: 'CD' },
                { value: 100, symbol: 'C' },
                { value: 90, symbol: 'XC' },
                { value: 50, symbol: 'L' },
                { value: 40, symbol: 'XL' },
                { value: 10, symbol: 'X' },
                { value: 9, symbol: 'IX' },
                { value: 5, symbol: 'V' },
                { value: 4, symbol: 'IV' },
                { value: 1, symbol: 'I' }
            ];
            let value = Math.max(0, Math.floor(num));
            if (!value) return '';
            let result = '';
            map.forEach((entry) => {
                while (value >= entry.value) {
                    result += entry.symbol;
                    value -= entry.value;
                }
            });
            return result;
        };
        const createItemControls = (item) => {
            const controls = document.createElement('div');
            controls.className = 'toc-item-controls toc-edit-control';

            const levelSelect = document.createElement('select');
            levelSelect.className = 'toc-item-level';
            levelSelect.innerHTML = '<option value="1">L1</option><option value="2">L2</option><option value="3">L3</option>';
            levelSelect.value = String(item.level || 3);
            levelSelect.addEventListener('change', async (e) => {
                updateItem(item.id, { level: parseInt(e.target.value, 10) || 3 });
                await rerender();
            });

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'toc-item-remove';
            removeBtn.textContent = '삭제';
            removeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                toc.items = toc.items.filter(entry => entry.id !== item.id);
                State.saveHistory();
                await rerender();
            });

            controls.appendChild(levelSelect);
            controls.appendChild(removeBtn);
            return controls;
        };

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn toc-add-item toc-edit-control';
        addBtn.textContent = '+ 항목';
        addBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            toc.items.push({ id: createItemId(), level: 3, text: '', page: '' });
            State.saveHistory();
            await rerender();
        });
        imageControls.appendChild(addBtn);

        const emptyNote = document.createElement('div');
        emptyNote.className = 'toc-empty toc-edit-control';
        emptyNote.textContent = '목차 항목을 추가하세요.';

        if (toc.items.length === 0) {
            listInner.appendChild(emptyNote);
        }

        const sections = [];
        let currentSection = null;
        let currentPart = null;
        let l1Index = 0;
        let l2Index = 0;
        let l3Index = 0;

        const ensureSection = () => {
            if (currentSection) return;
            l1Index += 1;
            currentSection = { index: l1Index, item: null, parts: [] };
            sections.push(currentSection);
        };
        const ensurePart = () => {
            if (currentPart) return;
            l2Index += 1;
            l3Index = 0;
            currentPart = { index: l2Index, item: null, subs: [] };
            if (currentSection) currentSection.parts.push(currentPart);
        };

        toc.items.forEach((item) => {
            const level = item.level || 3;
            if (level === 1) {
                l1Index += 1;
                l2Index = 0;
                l3Index = 0;
                currentSection = { index: l1Index, item, parts: [] };
                sections.push(currentSection);
                currentPart = null;
                return;
            }
            if (level === 2) {
                ensureSection();
                l2Index += 1;
                l3Index = 0;
                currentPart = { index: l2Index, item, subs: [] };
                currentSection.parts.push(currentPart);
                return;
            }
            ensureSection();
            ensurePart();
            l3Index += 1;
            currentPart.subs.push({ index: l3Index, item });
        });

        sections.forEach((section) => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'toc-section';

            if (section.item) {
                const titleRow = document.createElement('div');
                titleRow.className = 'toc-section-title';

                const indexEl = document.createElement('span');
                indexEl.className = 'toc-section-index';
                indexEl.textContent = `${toRoman(section.index)}.`;

                const textSpan = document.createElement('span');
                textSpan.className = 'toc-section-text';
                textSpan.contentEditable = 'true';
                setEditableContent(textSpan, section.item.text || '');
                textSpan.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
                textSpan.addEventListener('input', () => {
                    updateItem(section.item.id, { text: getEditableHtml(textSpan) });
                });

                titleRow.appendChild(indexEl);
                titleRow.appendChild(textSpan);
                titleRow.appendChild(createItemControls(section.item));
                sectionEl.appendChild(titleRow);
            }

            if (section.parts.length > 0) {
                const card = document.createElement('div');
                card.className = 'toc-section-card';

                section.parts.forEach((part) => {
                    if (part.item) {
                        const partRow = document.createElement('div');
                        partRow.className = 'toc-part-title';

                        const partIndex = document.createElement('span');
                        partIndex.className = 'toc-part-index';
                        partIndex.textContent = `Part ${part.index}.`;

                        const partText = document.createElement('span');
                        partText.className = 'toc-part-text';
                        partText.contentEditable = 'true';
                        setEditableContent(partText, part.item.text || '');
                        partText.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
                        partText.addEventListener('input', () => {
                            updateItem(part.item.id, { text: getEditableHtml(partText) });
                        });

                        partRow.appendChild(partIndex);
                        partRow.appendChild(partText);
                        partRow.appendChild(createItemControls(part.item));
                        card.appendChild(partRow);
                    }

                    if (part.subs.length > 0) {
                        const subList = document.createElement('div');
                        subList.className = 'toc-sub-list';

                        part.subs.forEach((sub) => {
                            const subRow = document.createElement('div');
                            subRow.className = 'toc-sub-item';

                            const subIndex = document.createElement('span');
                            subIndex.className = 'toc-sub-index';
                            subIndex.textContent = `${String(sub.index).padStart(2, '0')}.`;

                            const subText = document.createElement('span');
                            subText.className = 'toc-sub-text';
                            subText.contentEditable = 'true';
                            setEditableContent(subText, sub.item.text || '');
                            subText.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
                            subText.addEventListener('input', () => {
                                updateItem(sub.item.id, { text: getEditableHtml(subText) });
                            });

                            subRow.appendChild(subIndex);
                            subRow.appendChild(subText);
                            subRow.appendChild(createItemControls(sub.item));
                            subList.appendChild(subRow);
                        });

                        card.appendChild(subList);
                    }
                });

                sectionEl.appendChild(card);
            }

            listInner.appendChild(sectionEl);
        });

        page.appendChild(header);
        list.appendChild(listInner);
        page.appendChild(list);
        return page;
    },

    createChapterCoverPage(cover) {
        const page = document.createElement('div');
        page.className = 'page chapter-cover-page';
        page.style.padding = '0';

        const design = State.settings.designConfig || {};
        const normalizeHex = (value) => {
            if (typeof value !== 'string') return null;
            const trimmed = value.trim();
            return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : null;
        };
        const toHex = (num) => num.toString(16).padStart(2, '0');
        const lightenHex = (hex, amount) => {
            const normalized = normalizeHex(hex);
            if (!normalized) return null;
            const r = parseInt(normalized.slice(1, 3), 16);
            const g = parseInt(normalized.slice(3, 5), 16);
            const b = parseInt(normalized.slice(5, 7), 16);
            const mix = (value) => Math.round(value + (255 - value) * amount);
            return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
        };
        const themeMain = design.themeMain || '#1a1a2e';
        const themeSub = design.themeSub || '#333333';
        const themeText = design.textColor || '#000000';
        const bgColor = lightenHex(themeSub, 0.92) || '#f7f7fb';
        page.style.setProperty('--chapter-main-color', themeMain);
        page.style.setProperty('--chapter-sub-color', themeSub);
        page.style.setProperty('--chapter-text-color', themeText);
        page.style.setProperty('--chapter-bg-color', bgColor);
        const fontFamilyMap = {
            serif: "'Noto Serif KR', serif",
            gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
            gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
            'noto-sans': "'Noto Sans KR', sans-serif",
            'noto-serif': "'Noto Serif KR', serif"
        };
        const chapterTypography = design.chapterTypography || {};
        const applyChapterTypographyVars = (key, prefix) => {
            const config = chapterTypography[key];
            if (!config) return;
            const familyKey = config.fontFamily || 'serif';
            const familyValue = fontFamilyMap[familyKey] || familyKey;
            page.style.setProperty(`--${prefix}-font-family`, familyValue);
            page.style.setProperty(`--${prefix}-font-size`, `${config.fontSizePt}pt`);
            page.style.setProperty(`--${prefix}-font-weight`, config.fontWeight);
            page.style.setProperty(`--${prefix}-font-style`, config.italic ? 'italic' : 'normal');
            page.style.setProperty(`--${prefix}-text-decoration`, config.underline ? 'underline' : 'none');
            page.style.setProperty(`--${prefix}-color`, config.color);
        };
        applyChapterTypographyVars('number', 'chapter-number');
        applyChapterTypographyVars('titleKo', 'chapter-title-ko');
        applyChapterTypographyVars('titleEn', 'chapter-title-en');
        applyChapterTypographyVars('pointsHeader', 'chapter-points-header');
        applyChapterTypographyVars('pointsBody', 'chapter-points-body');
        applyChapterTypographyVars('parts', 'chapter-parts');

        const bar = document.createElement('div');
        bar.className = 'chapter-bar';

        const inner = document.createElement('div');
        inner.className = 'chapter-inner';

        const titleBlock = document.createElement('div');
        titleBlock.className = 'chapter-title-block';

        const numberEl = document.createElement('div');
        numberEl.className = 'chapter-number';
        numberEl.contentEditable = 'true';
        setEditableContent(numberEl, cover.number || '');
        numberEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
        numberEl.addEventListener('input', () => {
            cover.number = getEditableHtml(numberEl);
            State.saveHistory(500);
        });

        const titleKoEl = document.createElement('div');
        titleKoEl.className = 'chapter-title-ko';
        titleKoEl.contentEditable = 'true';
        setEditableContent(titleKoEl, cover.titleKo || '');
        titleKoEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
        titleKoEl.addEventListener('input', () => {
            cover.titleKo = getEditableHtml(titleKoEl);
            State.saveHistory(500);
        });

        const titleEnEl = document.createElement('div');
        titleEnEl.className = 'chapter-title-en';
        titleEnEl.contentEditable = 'true';
        setEditableContent(titleEnEl, cover.titleEn || '');
        titleEnEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
        titleEnEl.addEventListener('input', () => {
            cover.titleEn = getEditableHtml(titleEnEl);
            State.saveHistory(500);
        });

        titleBlock.appendChild(numberEl);
        titleBlock.appendChild(titleKoEl);
        titleBlock.appendChild(titleEnEl);

        const pointsCard = document.createElement('div');
        pointsCard.className = 'chapter-points-card';

        const pointsHeader = document.createElement('div');
        pointsHeader.className = 'chapter-points-header';
        pointsHeader.contentEditable = 'true';
        setEditableContent(pointsHeader, cover.pointsTitle || 'LEARNING POINTS');
        pointsHeader.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
        pointsHeader.addEventListener('input', () => {
            cover.pointsTitle = getEditableHtml(pointsHeader);
            State.saveHistory(500);
        });

        const pointsBody = document.createElement('div');
        pointsBody.className = 'chapter-points-body';

        const updatePoints = () => {
            cover.points = Array.from(pointsBody.querySelectorAll('.chapter-point-item'))
                .map(item => {
                    const text = getEditableText(item);
                    return text ? getEditableHtml(item) : '';
                })
                .filter(Boolean);
            State.saveHistory(500);
        };

        const pointItems = Array.isArray(cover.points) && cover.points.length ? cover.points : [''];
        pointItems.forEach((text) => {
            const item = document.createElement('div');
            item.className = 'chapter-point-item';
            item.contentEditable = 'true';
            setEditableContent(item, text || '');
            item.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
            item.addEventListener('input', updatePoints);
            pointsBody.appendChild(item);
        });

        pointsCard.appendChild(pointsHeader);
        pointsCard.appendChild(pointsBody);

        const partsBox = document.createElement('div');
        partsBox.className = 'chapter-parts';

        const updateParts = () => {
            cover.parts = Array.from(partsBox.querySelectorAll('.chapter-part-item'))
                .map(item => {
                    const text = getEditableText(item);
                    return text ? getEditableHtml(item) : '';
                })
                .filter(Boolean);
            State.saveHistory(500);
        };

        const partItems = Array.isArray(cover.parts) && cover.parts.length ? cover.parts : [''];
        partItems.forEach((text) => {
            const item = document.createElement('div');
            item.className = 'chapter-part-item';
            item.contentEditable = 'true';
            setEditableContent(item, text || '');
            item.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
            item.addEventListener('input', updateParts);
            partsBox.appendChild(item);
        });

        inner.appendChild(titleBlock);
        inner.appendChild(pointsCard);
        inner.appendChild(partsBox);

        page.appendChild(bar);
        page.appendChild(inner);
        return page;
    },

    createBlankPage() {
        const page = document.createElement('div');
        page.className = 'page blank-page';
        page.style.padding = '0';
        return page;
    },

    attachHeaderFooterControls(pageEl, entry) {
        if (!pageEl || !entry || entry.kind !== 'content') return;
        this.attachHeaderFooterControl(pageEl, entry, 'header');
        this.attachHeaderFooterControl(pageEl, entry, 'footer');
    },

    attachHeaderFooterControl(pageEl, entry, kind) {
        const area = kind === 'header' ? pageEl : pageEl.querySelector('.page-footer');
        if (!area) return;
        const labelText = kind === 'header' ? '머릿말' : '꼬릿말';
        const controlClass = kind === 'header' ? 'header-control' : 'footer-control';
        const existing = area.querySelector(`.header-footer-control.${controlClass}`);
        const control = existing || (() => {
            const div = document.createElement('div');
            div.className = `header-footer-control ${controlClass}`;
            area.appendChild(div);
            return div;
        })();
        control.innerHTML = '';

        const config = this.resolveHeaderFooterConfigForEntry(kind, entry);
        const template = config.template || 'exam';
        const isExamDoc = State.settings.documentMode === 'exam';
        const isHeader = kind === 'header';

        let displayHeight = 0;
        let lockHeight = false;
        if (template === 'none') {
            displayHeight = isHeader && isExamDoc ? EXAM_HEADER_EMPTY_HEIGHT_MM : 0;
            lockHeight = true;
        } else if (isHeader && template === 'exam') {
            displayHeight = EXAM_HEADER_HEIGHT_MM;
            lockHeight = true;
        } else {
            displayHeight = Number.isFinite(config.heightMm) ? config.heightMm : 0;
        }

        const label = document.createElement('span');
        label.className = 'page-layout-label';
        label.textContent = labelText;

        const templateSelect = document.createElement('select');
        templateSelect.className = 'page-layout-select';
        templateSelect.innerHTML = [
            '<option value="exam">시험지</option>',
            '<option value="basic">기본</option>',
            '<option value="free">프리박스</option>',
            '<option value="table">표</option>',
            '<option value="image">이미지</option>',
            '<option value="none">없음</option>'
        ].join('');
        templateSelect.value = template;

        const heightInput = document.createElement('input');
        heightInput.type = 'number';
        heightInput.min = '0';
        heightInput.max = '60';
        heightInput.step = '1';
        heightInput.className = 'page-layout-input';
        heightInput.value = Number.isFinite(displayHeight) ? displayHeight : 0;
        heightInput.disabled = lockHeight;

        const heightLabel = document.createElement('span');
        heightLabel.className = 'page-layout-label';
        heightLabel.textContent = '높이';

        templateSelect.addEventListener('change', async (e) => {
            const nextTemplate = e.target.value;
            if (!entry[kind] || typeof entry[kind] !== 'object') entry[kind] = {};
            entry[kind].template = nextTemplate;
            if (isHeader && nextTemplate === 'exam') {
                entry[kind].heightMm = EXAM_HEADER_HEIGHT_MM;
            } else if (nextTemplate === 'none') {
                entry[kind].heightMm = isHeader && isExamDoc ? EXAM_HEADER_EMPTY_HEIGHT_MM : 0;
            } else if (!Number.isFinite(entry[kind].heightMm)) {
                entry[kind].heightMm = Number.isFinite(config.heightMm) ? config.heightMm : 0;
            }
            State.saveHistory();
            this.renderPages();
            await ManualRenderer.renderAll();
        });

        heightInput.addEventListener('change', async (e) => {
            if (heightInput.disabled) {
                heightInput.value = Number.isFinite(displayHeight) ? displayHeight : 0;
                return;
            }
            const raw = parseFloat(e.target.value);
            const nextHeight = Number.isFinite(raw) ? Math.max(0, Math.min(60, raw)) : 0;
            if (!entry[kind] || typeof entry[kind] !== 'object') entry[kind] = {};
            if (!entry[kind].template) entry[kind].template = template;
            entry[kind].heightMm = nextHeight;
            State.saveHistory();
            this.renderPages();
            await ManualRenderer.renderAll();
        });

        control.appendChild(label);
        control.appendChild(templateSelect);
        control.appendChild(heightLabel);
        control.appendChild(heightInput);
    },

    attachPagePlanControl(pageEl, entry, index) {
        if (!pageEl || !entry) return;
        pageEl.dataset.planId = entry.id;
        const control = pageEl.querySelector('.page-layout-control') || (() => {
            const div = document.createElement('div');
            div.className = 'page-layout-control';
            pageEl.appendChild(div);
            return div;
        })();
        control.classList.add('page-plan-control');
        control.innerHTML = '';

        const typeLabel = document.createElement('span');
        typeLabel.className = 'page-layout-label';
        typeLabel.textContent = '페이지';

        const typeSelect = document.createElement('select');
        typeSelect.className = 'page-layout-select page-type-select';
        typeSelect.innerHTML = '<option value="content">본문</option><option value="toc">목차</option><option value="chapter-cover">대단원</option><option value="blank">빈페이지</option>';
        typeSelect.value = entry.kind;

        control.appendChild(typeLabel);
        control.appendChild(typeSelect);

        if (entry.kind === 'content') {
            const layoutLabel = document.createElement('span');
            layoutLabel.className = 'page-layout-label';
            layoutLabel.textContent = '단';
            const layoutSelect = document.createElement('select');
            layoutSelect.className = 'page-layout-select page-columns-select';
            layoutSelect.innerHTML = '<option value="1">1단</option><option value="2">2단</option>';
            const defaultColumns = parseInt(State.settings.columns) === 1 ? 1 : 2;
            layoutSelect.value = String(entry.columns === 1 ? 1 : (entry.columns === 2 ? 2 : defaultColumns));
            layoutSelect.addEventListener('change', async (e) => {
                const next = parseInt(e.target.value, 10) === 1 ? 1 : 2;
                entry.columns = next;
                State.saveHistory();
                this.renderPages();
                await ManualRenderer.renderAll();
            });
            control.appendChild(layoutLabel);
            control.appendChild(layoutSelect);
        }

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'page-plan-btn';
        addBtn.textContent = '+';
        addBtn.title = '페이지 추가';
        addBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const plan = Array.isArray(State.docData.pagePlan) ? State.docData.pagePlan : [];
            const insertIndex = Math.min(Math.max(index + 1, 0), plan.length);
            plan.splice(insertIndex, 0, {
                id: `pg_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
                kind: 'content',
                columns: parseInt(State.settings.columns) === 1 ? 1 : 2
            });
            State.docData.pagePlan = plan;
            State.saveHistory();
            this.renderPages();
            await ManualRenderer.renderAll();
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'page-plan-btn';
        removeBtn.textContent = '–';
        removeBtn.title = '페이지 삭제';
        removeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const plan = Array.isArray(State.docData.pagePlan) ? State.docData.pagePlan : [];
            if (plan.length <= 1) return;
            const removeIndex = plan.findIndex(item => item.id === entry.id);
            if (removeIndex === -1) return;
            plan.splice(removeIndex, 1);
            if (!plan.some(item => item.kind === 'content')) {
                plan.unshift({
                    id: `pg_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
                    kind: 'content',
                    columns: parseInt(State.settings.columns) === 1 ? 1 : 2
                });
            }
            State.docData.pagePlan = plan;
            State.saveHistory();
            this.renderPages();
            await ManualRenderer.renderAll();
        });

        control.appendChild(addBtn);
        control.appendChild(removeBtn);

        typeSelect.addEventListener('change', async (e) => {
            const nextKind = e.target.value;
            if (entry.kind === nextKind) return;
            entry.kind = nextKind;
            if (nextKind === 'content') {
                entry.columns = parseInt(State.settings.columns) === 1 ? 1 : 2;
                delete entry.coverId;
            } else if (nextKind === 'chapter-cover') {
                const covers = Array.isArray(State.docData.chapterCovers) ? State.docData.chapterCovers : [];
                const newCover = buildDefaultChapterCover();
                covers.push(newCover);
                State.docData.chapterCovers = covers;
                entry.coverId = newCover.id;
                delete entry.columns;
            } else if (nextKind === 'toc') {
                if (!State.docData.toc) State.docData.toc = buildDefaultToc();
                delete entry.columns;
                delete entry.coverId;
            } else {
                delete entry.columns;
                delete entry.coverId;
            }
            State.saveHistory();
            this.renderPages();
            await ManualRenderer.renderAll();
        });

    },

    renderPages() {
        const workspace = document.getElementById('workspace');
        const scrollTop = workspace ? workspace.scrollTop : 0;
        const labelFamilyMap = {
            serif: "'Noto Serif KR', serif",
            gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
            gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
            'noto-sans': "'Noto Sans KR', sans-serif",
            'noto-serif': "'Noto Serif KR', serif"
        };
        const labelKey = State.settings.labelFontFamily || 'gothic';
        const labelBold = State.settings.labelBold !== false;
        const labelUnderline = State.settings.labelUnderline === true;
        const labelSize = State.settings.labelFontSizePt;
        const container = document.getElementById('paper-container');
        const cssTarget = container || document.documentElement;
        cssTarget.style.setProperty('--label-font-family', labelFamilyMap[labelKey] || labelFamilyMap.gothic);
        cssTarget.style.setProperty('--label-font-weight', labelBold ? '800' : '400');
        cssTarget.style.setProperty('--label-text-decoration', labelUnderline ? 'underline' : 'none');
        cssTarget.style.setProperty('--label-font-size', Number.isFinite(labelSize) ? `${labelSize}pt` : 'inherit');
        const design = State.settings.designConfig || {};
        const themeMain = design.themeMain || '#1a1a2e';
        const themeSub = design.themeSub || '#333333';
        const themeText = design.textColor || '#000000';
        cssTarget.style.setProperty('--theme-main', themeMain);
        cssTarget.style.setProperty('--theme-sub', themeSub);
        cssTarget.style.setProperty('--theme-text', themeText);
        cssTarget.style.setProperty('--theme-main-soft', hexToRgba(themeMain, 0.12));
        cssTarget.style.setProperty('--theme-sub-soft', hexToRgba(themeSub, 0.08));
        cssTarget.style.setProperty('--theme-sub-50', mixHexWithWhite(themeSub, 0.5));

        let preserveScrollAfterFocus = false;
        if (!State.lastFocusId) {
            const activeWrap = document.activeElement ? document.activeElement.closest('.block-wrapper') : null;
            const activeId = activeWrap && activeWrap.dataset ? activeWrap.dataset.id : null;
            if (activeId) {
                State.lastFocusId = activeId;
                preserveScrollAfterFocus = true;
            }
        }

        container.innerHTML = ''; 
        if(State.settings.zoom) { container.style.transform = `scale(${State.settings.zoom})`; container.style.transformOrigin = 'top center'; document.getElementById('zoomRange').value = State.settings.zoom; }

        let pageNum = 1;
        let planExpanded = false;
        if (!Array.isArray(State.docData.pagePlan)) State.docData.pagePlan = [];
        const plan = State.docData.pagePlan;
        const covers = Array.isArray(State.docData.chapterCovers) ? State.docData.chapterCovers : [];
        const coverMap = new Map(covers.map(item => [item.id, item]));
        const contentPages = [];

        const resolveColumnsCount = (entry, pageNumber) => {
            if (entry && (entry.columns === 1 || entry.columns === 2)) return entry.columns;
            return this.getPageColumnsCount(pageNumber);
        };

        const getColumnsForEntry = (entry, pageEl, pageNumber) => {
            const count = resolveColumnsCount(entry, pageNumber);
            if (count === 1) return [pageEl.querySelector('.column.single')];
            return [pageEl.querySelector('.column.left'), pageEl.querySelector('.column.right')];
        };

        const addContentEntry = (pageNumber) => {
            const entry = {
                id: `pg_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
                kind: 'content',
                columns: resolveColumnsCount(null, pageNumber)
            };
            plan.push(entry);
            planExpanded = true;
            return entry;
        };

        const createPageFromEntry = (entry, index) => {
            let page = null;
            if (entry.kind === 'toc') {
                if (!State.docData.toc) State.docData.toc = buildDefaultToc();
                page = this.createTocPage(State.docData.toc);
            } else if (entry.kind === 'chapter-cover') {
                const cover = coverMap.get(entry.coverId) || buildDefaultChapterCover();
                if (!coverMap.has(cover.id)) {
                    coverMap.set(cover.id, cover);
                    covers.push(cover);
                    entry.coverId = cover.id;
                    planExpanded = true;
                }
                page = this.createChapterCoverPage(cover);
            } else if (entry.kind === 'blank') {
                page = this.createBlankPage();
            } else {
                if (!(entry.columns === 1 || entry.columns === 2)) {
                    entry.columns = resolveColumnsCount(entry, pageNum);
                    planExpanded = true;
                }
                page = this.createPage(pageNum, { planEntry: entry });
                contentPages.push({ page, entry, pageNumber: pageNum });
            }
            container.appendChild(page);
            this.attachPagePlanControl(page, entry, index);
            pageNum += 1;
        };

        plan.forEach((entry, index) => createPageFromEntry(entry, index));
        if (!contentPages.length) {
            const entry = addContentEntry(pageNum);
            createPageFromEntry(entry, plan.length - 1);
        }

        let contentIndex = 0;
        let currentPage = contentPages[contentIndex].page;
        let columns = getColumnsForEntry(contentPages[contentIndex].entry, currentPage, contentPages[contentIndex].pageNumber);
        let colIndex = 0;
        let curCol = columns[colIndex];

        const moveToNextColumn = () => {
            colIndex++;
            if (colIndex >= columns.length) {
                contentIndex++;
                if (contentIndex >= contentPages.length) {
                    const entry = addContentEntry(pageNum);
                    createPageFromEntry(entry, plan.length - 1);
                    contentIndex = contentPages.length - 1;
                }
                currentPage = contentPages[contentIndex].page;
                columns = getColumnsForEntry(contentPages[contentIndex].entry, currentPage, contentPages[contentIndex].pageNumber);
                colIndex = 0;
            }
            curCol = columns[colIndex];
        };

        State.docData.blocks.forEach((block) => { 
            if (block.type === 'break') { curCol.appendChild(this.createBlock(block)); moveToNextColumn(); return; } 
            const el = this.createBlock(block); curCol.appendChild(el); 
            if (curCol.scrollHeight > curCol.clientHeight + 5) { 
                if (curCol.children.length === 1) { moveToNextColumn(); } 
                else { curCol.removeChild(el); moveToNextColumn(); curCol.appendChild(el); } 
            } 
        });

        if (planExpanded) {
            State.docData.chapterCovers = covers;
            State.saveHistory(0, { reason: 'page-plan-auto', coalesceMs: 1500 });
        }

        if (workspace) workspace.scrollTop = scrollTop;
        this.updatePreflightPanel();
        
        if(State.lastFocusId) {
            const focusId = State.lastFocusId;
            setTimeout(() => {
                const el = document.querySelector(`.block-wrapper[data-id="${focusId}"] .editable-box`);
                if(el) {
                    el.focus();
                    const r=document.createRange(); r.selectNodeContents(el); r.collapse(false);
                    const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
                }
                State.lastFocusId=null;
                if (preserveScrollAfterFocus && workspace) workspace.scrollTop = scrollTop;
                Events.updateImageInsertAvailability();
            }, 0);
        } else {
            Events.updateImageInsertAvailability();
        }
    },

    // [Fix] 순환 참조 방지를 위한 렌더링 헬퍼
    async performAndRender(actionFn) {
        if(actionFn()) {
            this.renderPages();
            await ManualRenderer.renderAll();
        }
    },

    createBlock(block) {
        const isConceptDerived = block.derived === 'concept-answers';
        const variantClass = block.variant ? `variant-${block.variant}` : '';
        if (block.derived && !isConceptDerived) {
            const wrap = document.createElement('div');
            wrap.className = 'block-wrapper derived-block';
            wrap.dataset.derived = block.derived;
            if (block.style && block.style.textAlign) wrap.style.textAlign = block.style.textAlign;
            if (block.bgGray) wrap.classList.add('bg-gray-block');
            if (variantClass) wrap.classList.add(variantClass);

            const box = document.createElement('div');
            box.className = `editable-box ${block.type}-box`;
            box.innerHTML = block.content;
            box.contentEditable = false;
            if (block.type === 'concept') box.classList.add('concept-box');
            if (block.bordered) box.classList.add('bordered-box');
            if (variantClass) box.classList.add(`${variantClass}-box`);

            const familyKey = block.fontFamily || State.settings.fontFamily || 'serif';
            const sizePt = block.fontSizePt || State.settings.fontSizePt || 10.5;
            const familyMap = {
                serif: "'Noto Serif KR', serif",
                gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
                gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
                'noto-sans': "'Noto Sans KR', sans-serif",
                'noto-serif': "'Noto Serif KR', serif"
            };
            box.style.fontFamily = familyMap[familyKey] || familyMap.serif;
            box.style.fontSize = sizePt + 'pt';

            wrap.appendChild(box);
            return wrap;
        }

        const wrap = document.createElement('div'); wrap.className = 'block-wrapper'; wrap.dataset.id = block.id;
        if (isConceptDerived) wrap.dataset.derived = 'concept-answers';
        if(block.style && block.style.textAlign) wrap.style.textAlign = block.style.textAlign;
        if(block.bgGray) wrap.classList.add('bg-gray-block'); 
        if (variantClass) wrap.classList.add(variantClass);

        if (!isConceptDerived) {
            wrap.addEventListener('click', (e) => {
                 if (!(e.ctrlKey || e.metaKey)) return;
                 if (e.altKey) { e.preventDefault(); e.stopPropagation(); this.performAndRender(() => Actions.addBlockBelow('break', block.id)); return; }
                 if (e.shiftKey) { e.preventDefault(); e.stopPropagation(); this.performAndRender(() => Actions.addBlockBelow('spacer', block.id)); return; }
            });
        }

        wrap.draggable = false; 
        const handle = document.createElement('div'); handle.className = 'block-handle'; handle.draggable = true; 
        handle.addEventListener('dragstart', (e) => {
            e.stopPropagation(); State.dragSrcId = block.id;
            const wrapper = e.target.closest('.block-wrapper'); wrapper.classList.add('dragging');
            if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', block.id); }
        });
        handle.addEventListener('dragend', (e) => {
             e.stopPropagation(); State.dragSrcId = null;
             document.querySelectorAll('.block-wrapper').forEach(w => w.classList.remove('dragging', 'drop-target-top', 'drop-target-bottom'));
             this.syncAllBlocks();
        });
        
        // [Fix] 메뉴 토글 로직 (display check)
        handle.onclick = (e) => {
            if (isConceptDerived) return;
            e.stopPropagation();
            const m = document.getElementById('context-menu');
            if (m.style.display === 'block' && State.contextTargetId === block.id) {
                m.style.display = 'none';
                return;
            }
            State.contextTargetId = block.id;
            Events.populateFontMenu(block.id);
            m.style.display = 'block';
            let left = e.clientX; let top = e.clientY;
            const pad = 8;
            const rect = m.getBoundingClientRect();
            if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
            if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
            if (left < pad) left = pad;
            if (top < pad) top = pad;
            m.style.left = left + 'px'; m.style.top = top + 'px';
        };
        wrap.appendChild(handle);

        wrap.ondragover=(e)=>{ e.preventDefault(); const r=wrap.getBoundingClientRect(); wrap.classList.remove('drop-target-top','drop-target-bottom'); if((e.clientY-r.top)<(r.height/2)) wrap.classList.add('drop-target-top'); else wrap.classList.add('drop-target-bottom'); };
        wrap.ondrop=(e)=>{ 
            const types = e.dataTransfer.types;
            if (types && (Array.from(types).includes('Files'))) return;
            e.preventDefault(); e.stopPropagation(); 
            if(State.dragSrcId && State.dragSrcId !== block.id){ 
                const srcIdx=State.docData.blocks.findIndex(b=>b.id===State.dragSrcId); const tgtIdx=State.docData.blocks.findIndex(b=>b.id===block.id); 
                const [moved]=State.docData.blocks.splice(srcIdx,1); 
                if(wrap.classList.contains('drop-target-bottom')) State.docData.blocks.splice(tgtIdx+1,0,moved); else State.docData.blocks.splice(tgtIdx,0,moved); 
                this.renderPages(); ManualRenderer.renderAll(); State.saveHistory();
            } 
            document.querySelectorAll('.block-wrapper').forEach(w=>w.classList.remove('dragging','drop-target-top','drop-target-bottom')); 
        };

        if(block.type==='break'){
            const br=document.createElement('div'); br.className='break-line'; 
            br.onclick=async ()=>{ if(confirm("단 나누기 삭제?")) this.performAndRender(() => Actions.deleteBlockById(block.id)); }; 
            wrap.appendChild(br);
        } else if(block.type==='spacer'){
            const sp=document.createElement('div'); sp.className='spacer-block'; sp.style.height=(block.height||50)+'px';
            sp.onmousedown=(e)=>{ const sY=e.clientY, sH=parseInt(sp.style.height); const mv=(ev)=>{ const nH=Math.max(10, sH+(ev.clientY-sY)); sp.style.height=nH+'px'; block.height=nH; }; window.addEventListener('mousemove',mv); window.addEventListener('mouseup',()=>{window.removeEventListener('mousemove',mv); State.saveHistory();},{once:true}); }; wrap.appendChild(sp);
        } else {
            const box=document.createElement('div'); box.className=`editable-box ${block.type}-box`;
            if(block.type==='concept') box.classList.add('concept-box');
            if(block.bordered) box.classList.add('bordered-box');
            if (variantClass) box.classList.add(`${variantClass}-box`);
            box.innerHTML=block.content;
            const isConceptAnswer = isConceptDerived;
            box.contentEditable = true;
            if (isConceptAnswer) {
                box.classList.add('concept-answer-box');
                box.tabIndex = 0;
                if (block.conceptAnswerStart) box.dataset.answerStart = String(block.conceptAnswerStart);
                if (block.conceptAnswerAssigned) box.dataset.answerCount = String(block.conceptAnswerAssigned);
            }
            const placeholderMap = {
                concept: "개념 내용 입력… (수식: $...$ / 줄바꿈: Shift+Enter)",
                example: "내용 입력… (수식: $...$ / 줄바꿈: Shift+Enter)",
                answer: "해설 입력… (수식: $...$ / 줄바꿈: Shift+Enter)"
            };
            if (!isConceptAnswer) box.dataset.placeholder = placeholderMap[block.type] || placeholderMap.example;

            const familyKey = block.fontFamily || State.settings.fontFamily || 'serif';
            const sizePt = block.fontSizePt || State.settings.fontSizePt || 10.5;
            const familyMap = {
                serif: "'Noto Serif KR', serif",
                gothic: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
                gulim: "Gulim, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
                'noto-sans': "'Noto Sans KR', sans-serif",
                'noto-serif': "'Noto Serif KR', serif"
            };
            box.style.fontFamily = familyMap[familyKey] || familyMap.serif;
            box.style.fontSize = sizePt + 'pt';
            
            if (!isConceptAnswer) {
                const handleBlockExit = async () => {
                    const hasRawEdit = !!box.querySelector('.raw-edit');
                    const shouldStripRawEdit = hasRawEdit && State.renderingEnabled;
                    const cleaned = shouldStripRawEdit
                        ? Utils.cleanRichContentToTex(box.innerHTML)
                        : Utils.cleanRichContentToTexPreserveRaw(box.innerHTML);
                    const contentChanged = cleaned !== block.content;
                    if (!contentChanged && !shouldStripRawEdit) return;

                    if (contentChanged) Actions.updateBlockContent(block.id, cleaned, true);
                    if (!State.renderingEnabled) {
                        this.debouncedRebalance();
                        this.updatePreflightPanel();
                        return;
                    }
                    if (!window.isMathJaxReady) {
                        this.debouncedRebalance();
                        this.updatePreflightPanel();
                        return;
                    }

                    if (shouldStripRawEdit) box.innerHTML = cleaned;

                    const hasConceptBlank = /\[개념빈칸[:_]/.test(cleaned);
                    const needsTypeset = /\[빈칸[:_]/.test(cleaned)
                        || cleaned.includes('$')
                        || cleaned.includes('[이미지')
                        || cleaned.includes('[블록박스')
                        || cleaned.includes('[블록사각형')
                        || cleaned.includes('[표_')
                        || cleaned.includes('[선지_')
                        || cleaned.includes('[BOLD')
                        || cleaned.includes('[굵게')
                        || cleaned.includes('[밑줄');
                    if (hasConceptBlank) {
                        await ManualRenderer.renderAll();
                    } else if (needsTypeset) {
                        await ManualRenderer.typesetElement(box);
                    }
                    this.debouncedRebalance(); 
                    this.updatePreflightPanel();
                };
                box.addEventListener('focusout', async (e) => {
                    if (box.contains(e.relatedTarget)) return;
                    if (box.contains(document.activeElement)) return;
                    await handleBlockExit();
                });
                box.oninput=(e)=>{ 
                    const cleanHTML = Utils.cleanRichContentToTexPreserveRaw(box.innerHTML); 
                    Actions.updateBlockContent(block.id, cleanHTML, false);
                    const inputType = e && e.inputType ? e.inputType : '';
                    const isDelete = typeof inputType === 'string' && inputType.startsWith('delete');
                    const delay = isDelete ? 0 : 1000;
                    const reason = isDelete ? 'edit' : 'typing';
                    State.saveHistory(delay, { reason, blockId: block.id, coalesceMs: 2000 });
                    this.debouncedRebalance(); // 입력 시 자동 레이아웃 조정
                    this.updatePreflightPanel();
                };
                // 렌더링 콜백을 Events로 전달
                box.onkeydown = (e) => Events.handleBlockKeydown(e, block.id, box, () => { this.renderPages(); ManualRenderer.renderAll(); });
                box.onmousedown = (e) => Events.handleBlockMousedown(e, block.id);
            } else {
                box.onkeydown = (e) => Events.handleConceptAnswerKeydown(e, block.id, box);
                box.onmousedown = () => { box.focus(); };
                box.addEventListener('input', (e) => Events.handleConceptAnswerInput(e, block.id, box));
                box.addEventListener('blur', (e) => Events.handleConceptAnswerInput(e, block.id, box, { immediate: true }));
            }
            wrap.appendChild(box);
        }
        return wrap;
    },

    createConceptAnswerBlock(capacity = null, manualSplit = false) {
        const suffix = Math.random().toString(16).slice(2, 6);
        const block = {
            id: `concept_${Date.now()}_${suffix}`,
            type: 'answer',
            content: '',
            bgGray: true,
            derived: 'concept-answers'
        };
        if (Number.isFinite(capacity) && capacity > 0) block.conceptAnswerCount = capacity;
        if (manualSplit) block.conceptAnswerSplit = true;
        return block;
    },

    syncConceptAnswerBlocks(answersInput) {
        const answers = Array.isArray(answersInput)
            ? answersInput
            : (Array.isArray(State.conceptBlankAnswers) ? State.conceptBlankAnswers : []);
        const answersIsMath = Array.isArray(State.conceptBlankAnswersIsMath)
            ? State.conceptBlankAnswersIsMath
            : [];
        let structureChanged = false;
        let contentChanged = false;

        const blocks = State.docData.blocks;
        let conceptBlocks = [];
        blocks.forEach((block, idx) => {
            if (block.derived === 'concept-answers') {
                conceptBlocks.push(block);
            }
        });

        if (!answers.length) {
            if (conceptBlocks.length) {
                State.docData.blocks = blocks.filter(block => block.derived !== 'concept-answers');
                structureChanged = true;
            }
            return { structureChanged, contentChanged, blocks: [] };
        }

        const hasManualSplit = conceptBlocks.some(block => block.conceptAnswerSplit);
        if (conceptBlocks.length > 1 && !hasManualSplit) {
            const keep = conceptBlocks[0];
            State.docData.blocks = blocks.filter(block => block.derived !== 'concept-answers' || block === keep);
            structureChanged = true;
            conceptBlocks = [keep];
        }
        if (!conceptBlocks.length) {
            const created = this.createConceptAnswerBlock();
            blocks.push(created);
            conceptBlocks = [created];
            structureChanged = true;
        }

        const escapeHtml = (value = '') => {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };
        const normalizeAnswer = (value = '') => {
            return String(value).replace(/\r\n/g, '\n').replace(/\n/g, ' ').trim();
        };
        const wrapMathAnswer = (value = '', isMath = false) => {
            const normalized = normalizeAnswer(value);
            if (!isMath) return normalized;
            if (!normalized) return normalized;
            if (normalized.includes('$')) return normalized;
            return `$${normalized}$`;
        };
        const sanitizeSeparatorHtml = (value = '') => {
            if (typeof value !== 'string' || !value) return '';
            const container = document.createElement('div');
            container.innerHTML = value;
            const nodes = Array.from(container.querySelectorAll('*'));
            nodes.forEach((node) => {
                const tag = node.tagName ? node.tagName.toLowerCase() : '';
                if (tag === 'br') return;
                node.replaceWith(document.createTextNode(node.textContent || ''));
            });
            return container.innerHTML;
        };
        const buildSeparatorConfig = (block, itemCount, includeLabel) => {
            const stored = block && typeof block === 'object' ? block.conceptAnswerSeparators : null;
            const hasLeading = stored && Object.prototype.hasOwnProperty.call(stored, 'leading');
            const hasTrailing = stored && Object.prototype.hasOwnProperty.call(stored, 'trailing');
            const leadingDefault = includeLabel ? ' ' : '';
            const leading = sanitizeSeparatorHtml(hasLeading ? stored.leading : leadingDefault);
            const trailing = sanitizeSeparatorHtml(hasTrailing ? stored.trailing : '');
            let between = Array.isArray(stored && stored.between)
                ? stored.between.map(sanitizeSeparatorHtml)
                : [];
            const needed = Math.max(0, itemCount - 1);
            if (between.length > needed) between = between.slice(0, needed);
            if (between.length < needed) {
                const fill = between.length ? between[between.length - 1] : '&nbsp;&nbsp;';
                while (between.length < needed) between.push(fill);
            }
            const normalized = { leading, between, trailing };
            if (block) block.conceptAnswerSeparators = normalized;
            return normalized;
        };
        const buildContent = (slice, startIndex, includeLabel, block) => {
            const items = slice.map((answer, idx) => {
                const index = startIndex + idx + 1;
                const isMath = !!answersIsMath[index - 1];
                const displayAnswer = wrapMathAnswer(answer, isMath);
                const cleaned = escapeHtml(displayAnswer);
                return `<span class="concept-answer-item" data-answer-index="${index}" contenteditable="false">(${index}) ${cleaned}</span>`;
            });
            const separators = buildSeparatorConfig(block, items.length, includeLabel);
            const labelHtml = includeLabel ? `<span class="q-label" contenteditable="false">개념 빈칸 정답</span>` : '';
            let html = labelHtml;
            html += separators.leading || '';
            items.forEach((item, idx) => {
                html += item;
                if (idx < items.length - 1) html += separators.between[idx] || '&nbsp;&nbsp;';
            });
            html += separators.trailing || '';
            return html;
        };

        if (conceptBlocks.length === 1) {
            const block = conceptBlocks[0];
            const nextContent = buildContent(answers, 0, true, block);
            if (block.content !== nextContent) {
                block.content = nextContent;
                contentChanged = true;
            }
            block.type = 'answer';
            block.bgGray = true;
            block.derived = 'concept-answers';
            block.conceptAnswerSplit = false;
            block.conceptAnswerCount = answers.length;
            block.conceptAnswerStart = answers.length ? 1 : null;
            block.conceptAnswerAssigned = answers.length;
            return { structureChanged, contentChanged, blocks: conceptBlocks };
        }

        const capacities = conceptBlocks.map((block) => {
            const count = parseInt(block.conceptAnswerCount, 10);
            if (Number.isFinite(count) && count > 0) return count;
            const assigned = parseInt(block.conceptAnswerAssigned, 10);
            if (Number.isFinite(assigned) && assigned > 0) return assigned;
            return null;
        });

        const assignments = [];
        let answerIndex = 0;
        for (let i = 0; i < conceptBlocks.length; i++) {
            const remaining = answers.length - answerIndex;
            let count = 0;
            if (remaining > 0) {
                if (i === conceptBlocks.length - 1) {
                    count = remaining;
                } else {
                    const capacity = capacities[i];
                    if (capacity) count = Math.min(capacity, remaining);
                }
            }
            assignments.push({ block: conceptBlocks[i], startIndex: answerIndex, count });
            answerIndex += count;
        }

        let lastNonEmpty = -1;
        assignments.forEach((assignment, idx) => {
            if (assignment.count > 0) lastNonEmpty = idx;
        });
        for (let i = assignments.length - 1; i > lastNonEmpty; i--) {
            const block = assignments[i].block;
            const idx = blocks.indexOf(block);
            if (idx !== -1) {
                blocks.splice(idx, 1);
                structureChanged = true;
            }
            assignments.pop();
        }
        if (assignments.length === 1) {
            const onlyBlock = assignments[0].block;
            const nextContent = buildContent(answers, 0, true, onlyBlock);
            if (onlyBlock.content !== nextContent) {
                onlyBlock.content = nextContent;
                contentChanged = true;
            }
            onlyBlock.type = 'answer';
            onlyBlock.bgGray = true;
            onlyBlock.derived = 'concept-answers';
            onlyBlock.conceptAnswerSplit = false;
            onlyBlock.conceptAnswerCount = answers.length;
            onlyBlock.conceptAnswerStart = answers.length ? 1 : null;
            onlyBlock.conceptAnswerAssigned = answers.length;
            return { structureChanged, contentChanged, blocks: [onlyBlock] };
        }

        assignments.forEach((assignment, idx) => {
            const includeLabel = idx === 0;
            const slice = answers.slice(assignment.startIndex, assignment.startIndex + assignment.count);
            const nextContent = buildContent(slice, assignment.startIndex, includeLabel, assignment.block);
            if (assignment.block.content !== nextContent) {
                assignment.block.content = nextContent;
                contentChanged = true;
            }
            assignment.block.type = 'answer';
            assignment.block.bgGray = true;
            assignment.block.derived = 'concept-answers';
            assignment.block.conceptAnswerSplit = true;
            if (idx === assignments.length - 1) {
                assignment.block.conceptAnswerCount = assignment.count;
            } else if (assignment.block.conceptAnswerCount === undefined || assignment.block.conceptAnswerCount === null) {
                assignment.block.conceptAnswerCount = assignment.count;
            }
            assignment.block.conceptAnswerStart = assignment.count ? assignment.startIndex + 1 : null;
            assignment.block.conceptAnswerAssigned = assignment.count;
        });

        return { structureChanged, contentChanged, blocks: assignments.map(a => a.block) };
    },

    async refreshConceptBlankAnswerBlocks(answersInput) {
        const container = document.getElementById('paper-container');
        if (!container) return;

        const syncResult = this.syncConceptAnswerBlocks(answersInput);

        if (!State.renderingEnabled) {
            if (syncResult.structureChanged) this.renderPages();
            this.debouncedRebalance();
            return;
        }

        const domBlocks = container.querySelectorAll('.block-wrapper[data-derived="concept-answers"]');
        const expectedCount = syncResult.blocks.length;
        const needsFullRender = syncResult.structureChanged || domBlocks.length !== expectedCount;
        if (needsFullRender) {
            this.renderPages();
            await ManualRenderer.renderAll(null, { skipConceptBlankSync: true });
            this.debouncedRebalance();
            return;
        } else if (syncResult.contentChanged) {
            domBlocks.forEach((wrap) => {
                const id = wrap.dataset.id;
                const block = State.docData.blocks.find(item => item.id === id);
                if (!block) return;
                const box = wrap.querySelector('.editable-box');
                if (!box) return;
                if (box.innerHTML !== block.content) box.innerHTML = block.content;
                if (block.conceptAnswerStart) box.dataset.answerStart = String(block.conceptAnswerStart);
                if (block.conceptAnswerAssigned !== undefined) box.dataset.answerCount = String(block.conceptAnswerAssigned);
            });
        }

        const conceptBoxes = Array.from(document.querySelectorAll('.block-wrapper[data-derived="concept-answers"] .editable-box'));
        if (window.isMathJaxReady && conceptBoxes.length) {
            await Promise.all(conceptBoxes.map(box => ManualRenderer.typesetElement(box, { trackConceptBlanks: false })));
        }

        this.debouncedRebalance();
    },

    async updateConceptBlankSummary(options = {}) {
        if (this.conceptBlankSyncing) {
            this.queueConceptBlankSummaryUpdate(options.changedBlockId);
            return;
        }
        if (!State.renderingEnabled) {
            await this.refreshConceptBlankAnswerBlocks([]);
            return;
        }
        if (!window.isMathJaxReady) return;
        if (ManualRenderer.isRendering) {
            this.queueConceptBlankSummaryUpdate(options.changedBlockId);
            return;
        }

        const idsWithConceptBlank = new Set();
        State.docData.blocks.forEach((block) => {
            if (typeof block.content === 'string' && block.content.includes('[개념빈칸')) {
                idsWithConceptBlank.add(block.id);
            }
        });
        if (options.changedBlockId) idsWithConceptBlank.add(options.changedBlockId);

        this.conceptBlankSyncing = true;
        try {
            ManualRenderer.resetConceptBlankTracking();
            for (const block of State.docData.blocks) {
                if (!idsWithConceptBlank.has(block.id)) continue;
                const wrap = document.querySelector(`.block-wrapper[data-id="${block.id}"]`);
                if (!wrap) continue;
                const box = wrap.querySelector('.editable-box');
                if (!box) continue;
                await ManualRenderer.typesetElement(box);
            }
            ManualRenderer.syncConceptBlankAnswers();
            await this.refreshConceptBlankAnswerBlocks();
            this.updatePreflightPanel();
        } finally {
            this.conceptBlankSyncing = false;
        }
    },

    rebalanceLayout: Utils.debounce(function() {
        const container = document.getElementById('paper-container');
        let pages = Array.from(container.querySelectorAll('.page'));
        let columns = [];
        pages.forEach((p, idx) => {
            const pageNum = idx + 1;
            const pageColumns = this.getPageColumns(pageNum, p).filter(Boolean);
            if (pageColumns.length) columns.push(...pageColumns);
        });
        const MAX_LOOPS = 50; let loopCount = 0;
        for (let i = 0; i < columns.length; i++) {
            let col = columns[i];
            if (loopCount++ > MAX_LOOPS) break;
            while (col.scrollHeight > col.clientHeight + 2) {
                if (col.children.length <= 1) break; 
                const lastBlock = col.lastElementChild;
                let nextCol = columns[i + 1];
                if (!nextCol) {
                    this.renderPages();
                    ManualRenderer.renderAll();
                    return;
                }
                if (nextCol.firstChild) nextCol.insertBefore(lastBlock, nextCol.firstChild); else nextCol.appendChild(lastBlock);
            }
        }
    }, 300),

    debouncedRebalance: function() { this.rebalanceLayout(); },

    updatePreflightPanel() {
        const panel = document.getElementById('preflight-panel');
        if (!panel) return;
        const mathBoxes = Array.from(document.querySelectorAll('.editable-box')).filter(b => (b.textContent || '').includes('$'));
        const placeholders = document.querySelectorAll('.image-placeholder');
        const mathCount = mathBoxes.length;
        const imageCount = placeholders.length;

        const mathEl = document.getElementById('preflight-math-count');
        const imgEl = document.getElementById('preflight-image-count');
        if (mathEl) mathEl.textContent = mathCount;
        if (imgEl) imgEl.textContent = imageCount;

        panel.querySelectorAll('.preflight-item').forEach(item => {
            const type = item.dataset.type;
            const count = type === 'math' ? mathCount : imageCount;
            if (count > 0) item.classList.add('warn'); else item.classList.remove('warn');
        });
    },

    jumpToPreflight(type) {
        let wrap = null;
        if (type === 'math') {
            const box = Array.from(document.querySelectorAll('.editable-box')).find(b => (b.textContent || '').includes('$'));
            if (box) wrap = box.closest('.block-wrapper');
        } else if (type === 'image') {
            const ph = document.querySelector('.image-placeholder');
            if (ph) wrap = ph.closest('.block-wrapper');
        }
        if (!wrap) return;
        wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        wrap.classList.add('preflight-highlight');
        setTimeout(() => wrap.classList.remove('preflight-highlight'), 1500);
        const box = wrap.querySelector('.editable-box');
        if (box) box.focus();
    },
    
    // [Fix] 누락된 수식 동기화 함수 복구
    syncBlock(id, recordHistory = false) {
        const wrap = document.querySelector(`.block-wrapper[data-id="${id}"]`); if (!wrap) return;
        const box = wrap.querySelector('.editable-box');
        if (box) Actions.updateBlockContent(id, Utils.cleanRichContentToTexPreserveRaw(box.innerHTML), recordHistory);
    },

    syncAllBlocks() { 
        const newBlocks = [];
        document.querySelectorAll('.block-wrapper').forEach(wrap => {
            const id = wrap.dataset.id;
            const block = State.docData.blocks.find(b => b.id === id);
            if(block) {
                const box = wrap.querySelector('.editable-box');
                if(box) block.content = Utils.cleanRichContentToTexPreserveRaw(box.innerHTML);
                newBlocks.push(block);
            }
        });
        State.docData.blocks = newBlocks;
        State.saveHistory(500); 
    }
};
