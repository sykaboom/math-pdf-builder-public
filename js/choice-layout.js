// Filename: js/choice-layout.js
export const choiceLayoutGrid = {
    '1': [[1, 2, 3, 4, 5]],
    '2': [[1, 2, 3], [4, 5, 0]],
    '5': [[1], [2], [3], [4], [5]]
};

export const normalizeChoiceLayout = (value) => {
    const v = String(value || '').trim();
    if (v === '1' || v === '1행') return '1';
    if (v === '2' || v === '2행') return '2';
    if (v === '5' || v === '5행') return '5';
    return '2';
};

export const getChoiceLayoutGrid = (layout) => {
    const normalized = normalizeChoiceLayout(layout);
    return choiceLayoutGrid[normalized] || choiceLayoutGrid['2'];
};

export const getChoiceColumnCount = (layout) => {
    const grid = getChoiceLayoutGrid(layout);
    return grid[0] ? grid[0].length : 1;
};
