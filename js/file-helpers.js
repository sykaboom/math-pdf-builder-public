// Filename: js/file-helpers.js
export const getImageFolderName = (options = {}) => {
    const { inputId = 'setting-img-folder', defaultName = 'images' } = options;
    const input = document.getElementById(inputId);
    const value = input ? String(input.value || '') : '';
    return value || defaultName;
};

export const buildImageFilename = (file, now = new Date()) => {
    const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(2, 14);
    const ext = file && file.name ? file.name.split('.').pop() : '';
    const safeExt = ext || 'png';
    return `img_${timestamp}.${safeExt}`;
};

const sanitizeBaseName = (value) => {
    return String(value || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 40);
};

export const buildSafeProjectFilename = (inputName, defaultBase, extension = '.json') => {
    let baseName = String(inputName || '').trim();
    if (!baseName) baseName = String(defaultBase || '');
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    const extPattern = new RegExp(`${ext.replace('.', '\\.')}$`, 'i');
    baseName = baseName.replace(extPattern, '');
    if (ext.toLowerCase() !== '.json') baseName = baseName.replace(/\.json$/i, '');
    if (ext.toLowerCase() !== '.msk') baseName = baseName.replace(/\.msk$/i, '');
    const safeBase = sanitizeBaseName(baseName);
    const fallbackBase = sanitizeBaseName(defaultBase) || 'project';
    const finalBase = safeBase || fallbackBase;
    return `${finalBase}${ext}`;
};

export const buildProjectSaveData = (docData, settings, options = {}) => {
    const { cleanContent } = options;
    const rawData = {
        data: JSON.parse(JSON.stringify(docData)),
        settings: JSON.parse(JSON.stringify(settings))
    };
    const normalizeImageRef = (ref) => {
        if (!ref || typeof ref !== 'object') return;
        if (ref.path) ref.src = ref.path;
    };
    normalizeImageRef(rawData.data?.headerFooter?.header?.image);
    normalizeImageRef(rawData.data?.headerFooter?.footer?.image);
    rawData.data.blocks.forEach(block => {
        if (typeof cleanContent === 'function') {
            block.content = cleanContent(block.content);
        }
        if (block.content.includes('<img')) {
            const div = document.createElement('div');
            div.innerHTML = block.content;
            div.querySelectorAll('img').forEach(img => {
                if (img.dataset.path) img.src = img.dataset.path;
            });
            block.content = div.innerHTML;
        }
    });
    return rawData;
};
