// Filename: js/concept-blank.js
export const resetConceptBlankTracking = (tracker) => {
    if (!tracker) return;
    tracker.conceptBlankCounter = 0;
    tracker.conceptBlankAnswers = [];
    tracker.conceptBlankAnswersIsMath = [];
    tracker.conceptBlankMathQueue = [];
};

export const recordConceptBlank = (tracker, rawAnswer = '', options = {}) => {
    if (!tracker) return 0;
    const isMath = options && options.isMath === true;
    const tmp = document.createElement('div');
    tmp.innerHTML = String(rawAnswer);
    const normalized = (tmp.textContent || '').replace(/\u00A0/g, ' ');
    tracker.conceptBlankCounter += 1;
    tracker.conceptBlankAnswers.push(normalized);
    tracker.conceptBlankAnswersIsMath.push(isMath);
    return tracker.conceptBlankCounter;
};

export const syncConceptBlankAnswers = (tracker, state) => {
    if (!tracker || !state) return false;
    const nextAnswers = tracker.conceptBlankAnswers.slice();
    const nextIsMath = tracker.conceptBlankAnswersIsMath.slice();
    const nextHash = JSON.stringify({ answers: nextAnswers, isMath: nextIsMath });
    const hasAnswerBlocks = Array.isArray(state.docData.blocks)
        && state.docData.blocks.some(block => block.derived === 'concept-answers');
    if (nextHash === state.conceptBlankAnswersHash && (hasAnswerBlocks || nextAnswers.length === 0)) return false;
    state.conceptBlankAnswers = nextAnswers;
    state.conceptBlankAnswersIsMath = nextIsMath;
    state.conceptBlankAnswersHash = nextHash;
    return true;
};
