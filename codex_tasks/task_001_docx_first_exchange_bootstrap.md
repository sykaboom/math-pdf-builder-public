# Task 001: DOCX-first exchange bootstrap (v10 + pdf-builder)

Status: COMPLETED  
Owner: Codex  
Date: 2026-02-07

## Goal
- What to change:
  - Define the first executable path for `DOCX-friendly internal model -> v10 data`.
  - Keep AI-powered multi-file merge (`PDF -> multimodal LLM`) as optional/experimental pipeline.
  - Set cost-aware defaults so premium LLM calls are not required for core editing.
- What must NOT change:
  - Do not couple editor core to provider/model-specific logic.
  - Do not freeze final schema versions yet.

## Scope
Touched files/directories:
- `docs/refactor-plan.md`
- `AI_READ_ME.md`
- `README.md`
- `codex_tasks/task_001_docx_first_exchange_bootstrap.md`
- `canvas-editor-app/src/contracts/docxDraftContract.js`
- `canvas-editor-app/src/adapters/exchange/`

Out of scope:
- Full DOCX import/export implementation
- Production PDF multimodal parser pipeline
- v10 repository code changes

## Dependencies / constraints
- New dependencies allowed? no
- Key guardrails:
  - no window globals in maintained area
  - no eval/new Function
  - sanitize external HTML inputs
  - JSON-safe persistence only
  - if legacy production files (`index.html`, `js/`, `css/`) are changed, update `PATCH_NOTES.txt`

## Acceptance criteria
- [x] Roadmap explicitly states `DOCX` as first-class exchange target.
- [x] Roadmap places `PDF -> multimodal LLM` behind validation/confidence and user-review gate.
- [x] Start sequence is clear enough to begin implementation without schema freeze.
- [x] Cost-aware principle is documented (core path should run without premium LLM dependency).

## Manual verification
- Step 1: Read `docs/refactor-plan.md` and confirm P6/P7 ordering and boundaries.
- Step 2: Read `AI_READ_ME.md` and confirm exchange + PDF gating are captured.
- Step 3: Read `README.md` migration section and confirm direction summary matches.

## Risks / rollback
- Risk: Premature schema freeze may slow product iteration.
- Rollback: Keep contracts draft-level and treat mappings as adapter-layer only.

---

## Implementation Log
Status: COMPLETED
Changed files:
- `docs/refactor-plan.md`
- `AI_READ_ME.md`
- `AI_READ_ME_MAP.md`
- `README.md`
- `codex_tasks/task_001_docx_first_exchange_bootstrap.md`
- `canvas-editor-app/src/contracts/docxDraftContract.js`
- `canvas-editor-app/src/adapters/exchange/docxExchangeAdapter.js`
- `canvas-editor-app/src/adapters/exchange/v10ExchangeAdapter.js`
- `canvas-editor-app/src/adapters/exchange/toolResultAdapter.js`
- `canvas-editor-app/src/adapters/exchange/index.js`

Commands run:
- `bash scripts/scan_guardrails.sh`
- `bash scripts/gen_ai_read_me_map.sh`
- `bash scripts/check_guardrails.sh`
- `cd canvas-editor-app && npm run lint`
- `cd canvas-editor-app && npm run build`
- `bash scripts/guardrails.sh`

Notes:
- Skill references mention `codex_tasks/task_071_mcp_ready_content_pipeline_spec.md`, but that file is not present in this repo.
- Continue with local repo docs as source of truth until a shared canonical task spec is added.
