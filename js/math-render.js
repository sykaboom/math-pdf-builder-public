// Filename: js/math-render.js
export const buildMathFragmentFromText = async (text, options = {}) => {
    const {
        decodeMathEntities,
        sanitizeMathTokens,
        applyMathDisplayRules,
        trackConceptBlanks = true,
        getConceptBlankIndex,
        mathCache,
        tex2svgPromise
    } = options;
    const fragment = document.createDocumentFragment();
    if (!text) return fragment;
    const regex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g;
    let lastIndex = 0;
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
        }
        const fullTex = match[0];
        const isDisplay = fullTex.startsWith('$$');
        const cleanTex = isDisplay ? fullTex.slice(2, -2) : fullTex.slice(1, -1);
        const decodedTex = typeof decodeMathEntities === 'function' ? decodeMathEntities(cleanTex) : cleanTex;
        const preparedTex = typeof sanitizeMathTokens === 'function'
            ? sanitizeMathTokens(decodedTex, { trackConceptBlanks, getConceptBlankIndex })
            : decodedTex;
        const finalTex = typeof applyMathDisplayRules === 'function'
            ? applyMathDisplayRules(preparedTex)
            : preparedTex;
        const cacheKey = `${finalTex}${isDisplay ? '_D' : '_I'}`;
        let mjxNode = null;

        if (mathCache && mathCache.has(cacheKey)) {
            mjxNode = mathCache.get(cacheKey).cloneNode(true);
        } else if (typeof tex2svgPromise === 'function') {
            try {
                mjxNode = await tex2svgPromise(finalTex, { display: isDisplay });
                if (mjxNode) {
                    mjxNode.setAttribute('data-tex', decodedTex);
                    mjxNode.setAttribute('display', isDisplay);
                    mjxNode.setAttribute('contenteditable', 'false');
                    mjxNode.classList.add('math-atom');
                    if (mathCache) mathCache.set(cacheKey, mjxNode.cloneNode(true));
                }
            } catch (e) { console.error(e); }
        }

        if (mjxNode) fragment.appendChild(mjxNode);
        else fragment.appendChild(document.createTextNode(fullTex));
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    return fragment;
};
