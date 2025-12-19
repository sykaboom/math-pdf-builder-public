// Filename: js/config.js
window.MathJax = {
    loader: {
        load: ['[tex]/html', '[tex]/bbox']
    },
    tex: { 
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']],
        processEscapes: true,
        packages: ['base', 'ams', 'noerrors', 'noundefined', 'html', 'bbox']
    },
    svg: { 
        fontCache: 'none', 
        scale: 1.0, 
        displayAlign: 'left',
        internalSpeechTitles: false 
    },
    options: {
        ignoreHtmlClass: 'tex2jax_ignore',
        processHtmlClass: 'tex2jax_process',
        renderActions: {
            assistiveMml: [] 
        }
    },
    startup: { 
        typeset: false,
        pageReady: () => {
            return MathJax.startup.defaultPageReady().then(() => {
                console.log('MathJax Engine Ready');
                window.isMathJaxReady = true;
            });
        }
    }
};
