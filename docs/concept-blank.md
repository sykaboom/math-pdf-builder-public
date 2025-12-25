# Concept Blank Behavior (Spec)

This document describes how concept blank tokens are parsed, rendered, and canceled.

## Tokens
- `[개념빈칸:#]answer[/개념빈칸]`
- `[빈칸:label]` or `[빈칸_label]` (no answer sync)

## Rendering Outside Math
- Tokens are converted into `.blank-box` elements in the DOM.
- Concept blanks record answers and indexes for the summary block.

## Rendering Inside Math ($...$ or $$...$$)
- Tokens remain in the math source string until MathJax rendering.
- `sanitizeMathTokens()` converts tokens to TeX-safe placeholders (e.g. `\bbox`).
- Answers recorded inside math are marked as math and shown as `$answer$` in the summary.

## Cancel / Unblank Inside Math
- Use the math menu button "빈칸 취소".
- The operation strips `[개념빈칸:...]...[/개념빈칸]` and keeps only the raw answer text.
- This works inside `matrix` / `cases` because it operates on the math source string.

## Notes
- If a single math expression contains multiple concept blanks, "빈칸 취소" clears all of them in that expression (concept blank set behavior).
