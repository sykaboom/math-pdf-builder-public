// Filename: js/history-logic.js
export const buildSnapshot = (docData, settings, options = {}) => {
    const { cleanContent } = options;
    const cleanData = JSON.parse(JSON.stringify(docData));
    if (typeof cleanContent === 'function') {
        cleanData.blocks.forEach(b => { b.content = cleanContent(b.content); });
    }
    const snapshot = {
        data: cleanData,
        settings: JSON.parse(JSON.stringify(settings))
    };
    const snapshotStr = JSON.stringify(snapshot);
    return { snapshot, snapshotStr };
};

export const buildHistoryMetaInfo = (meta) => {
    if (!meta || typeof meta !== 'object') return null;
    return {
        reason: meta.reason || 'manual',
        blockId: meta.blockId || null,
        coalesceMs: Number.isFinite(meta.coalesceMs) ? meta.coalesceMs : 2000
    };
};

export const buildHistoryMetaEntry = (metaInfo, now) => {
    if (metaInfo) {
        return { reason: metaInfo.reason, blockId: metaInfo.blockId, time: now };
    }
    return { reason: 'manual', blockId: null, time: now };
};

export const shouldCoalesceHistory = (options = {}) => {
    const { historyIndex, historyStackLength, historyMeta, metaInfo, now } = options;
    if (!metaInfo || metaInfo.reason !== 'typing') return false;
    if (historyIndex < 0 || historyIndex !== historyStackLength - 1) return false;
    if (!historyMeta || historyMeta.reason !== 'typing') return false;
    if ((now - historyMeta.time) > metaInfo.coalesceMs) return false;
    if (metaInfo.blockId && metaInfo.blockId !== historyMeta.blockId) return false;
    return true;
};
