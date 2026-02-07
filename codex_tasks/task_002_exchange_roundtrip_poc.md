# Task 002: Exchange Roundtrip PoC (ToolResult -> NormalizedContent -> DOCX/v10)

Status: COMPLETED  
Owner: Codex  
Date: 2026-02-07

## Goal
- What to change:
  - Implement one executable exchange path in `canvas-editor-app`:
    - `ToolResult JSON` input
    - `NormalizedContent` normalization
    - `DOCX draft` + `v10 draft` conversion
    - basic roundtrip check (`normalized -> docx -> normalized`)
  - Add a small debug UI section in the app for this flow (development-only behavior).
  - Keep this path deterministic so core validation works without premium LLM calls.
- What must NOT change:
  - Do not freeze schema versions beyond current draft version `1`.
  - Do not add provider/model-specific logic into core/editor bootstrap.
  - Do not modify legacy production files (`index.html`, `js/`, `css/`).

## Scope
Touched files/directories:
- `canvas-editor-app/src/App.jsx`
- `canvas-editor-app/src/App.css`
- `canvas-editor-app/src/adapters/exchange/`
- `canvas-editor-app/src/contracts/docxDraftContract.js`
- `canvas-editor-app/src/features/exchange-playground/` (new)
- `codex_tasks/task_002_exchange_roundtrip_poc.md`

Out of scope:
- Full DOCX parser/writer integration
- Real v10 repo API wiring
- PDF multimodal ingestion runtime
- Authentication/payment/community backend

## Dependencies / constraints
- New dependencies allowed? no
- Key guardrails:
  - no window globals in maintained area
  - no eval/new Function
  - sanitize external HTML inputs
  - JSON-safe persistence only
  - if legacy production files (`index.html`, `js/`, `css/`) are changed, update `PATCH_NOTES.txt`

## Acceptance criteria
- [x] App can ingest a sample `ToolResult` JSON and produce valid `NormalizedContent`.
- [x] App can derive `DOCX draft` and `v10 draft` JSON from the normalized payload.
- [x] App can run a roundtrip check (`normalized -> docx -> normalized`) and show mismatch count.
- [x] Export buttons download JSON payloads for `normalized`, `docx draft`, `v10 draft`.
- [x] `canvas-editor-app` lint/build and repo guardrails pass.

## Manual verification
- Step 1: `cd canvas-editor-app && npm run dev`
- Step 2: Open app and paste/load sample `ToolResult` JSON in exchange panel.
- Step 3: Confirm summary counters (`blocks`, `images`, `roundtrip mismatches`) render.
- Step 4: Click export actions and confirm JSON files are downloaded.
- Step 5: Run:
  - `cd canvas-editor-app && npm run lint`
  - `cd canvas-editor-app && npm run build`
  - `bash scripts/guardrails.sh`

## Risks / rollback
- Risk: Mapping drift between draft contracts and UI expectations.
- Rollback: Keep adapters pure and revert UI playground only.
- Risk: Roundtrip false positives due to default field insertion.
- Rollback: Add canonical normalize step before diff compare.

## Notes
- This task implements only a development-grade proof path.
- Production import/export adapters can evolve behind the same contract boundary.

---

## Implementation Log
Status: COMPLETED
Changed files:
- `canvas-editor-app/src/App.jsx`
- `canvas-editor-app/src/App.css`
- `canvas-editor-app/src/features/exchange-playground/ExchangePlayground.jsx`
- `canvas-editor-app/src/features/exchange-playground/sampleToolResult.js`
- `canvas-editor-app/src/features/exchange-playground/index.js`
- `codex_tasks/task_002_exchange_roundtrip_poc.md`
- `README.md`
- `PATCH_NOTES.txt`
- `AI_READ_ME_MAP.md`

Commands run:
- `bash scripts/scan_guardrails.sh`
- `cd canvas-editor-app && npm run lint`
- `cd canvas-editor-app && npm run build`
- `bash scripts/check_guardrails.sh`
- `bash scripts/guardrails.sh`
- `bash scripts/gen_ai_read_me_map.sh`

Notes:
- Built on top of `task_001` contract/adapters baseline.
