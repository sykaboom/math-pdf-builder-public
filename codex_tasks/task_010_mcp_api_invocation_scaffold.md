# Task 010: MCP/API Invocation Scaffold for Canvas Editor App

Status: COMPLETED
Owner: Codex
Target: canvas-editor-app/
Date: 2026-02-12

## Goal
- What to change:
  - Add a deterministic MCP/API invocation path in `canvas-editor-app` so users can call remote MCP/API endpoints and load responses into the existing exchange conversion flow.
  - Keep provider/model specifics outside editor core by placing network invocation logic in adapter layer.
  - Extend the exchange playground UI with minimal remote call controls (MCP mode + generic API mode).
- What must NOT change:
  - Do not modify legacy production files (`index.html`, `js/`, `css/`).
  - Do not add new dependencies.
  - Do not couple remote provider-specific parsing directly into editor bootstrap/core.

## Execution dependencies (hard gate)
- Upstream prerequisites:
  - none
- Completion contract:
  - Remote invocation can fail gracefully and must not break existing local conversion path.

## Scope (Codex must touch ONLY these)
Touched files/directories:
- `canvas-editor-app/src/adapters/exchange/index.js`
- `canvas-editor-app/src/adapters/exchange/mcpApiAdapter.js` (new)
- `canvas-editor-app/src/features/exchange-playground/ExchangePlayground.jsx`
- `canvas-editor-app/src/App.css`
- `codex_tasks/task_010_mcp_api_invocation_scaffold.md`
- `README.md` (if usage docs need update)
- `PATCH_NOTES.txt` (if functional change note is needed)

Out of scope:
- Real external MCP server deployment or infra configuration
- Auth/payment/community backend integration
- Schema freeze/version bump for exchange contracts

## Design Artifacts (required for layout/structure tasks)
- [x] Layout/structure changes included: NO
- [ ] SVG path in `design_drafts/` (required if YES):
- [ ] SVG has explicit `viewBox` and ratio label
- [ ] Numeric redline resolved in spec

## Dependencies / constraints
- New dependencies allowed: NO
- Boundary rules:
  - remote invocation logic stays in adapter modules
  - existing `toolResultToNormalizedContent` path remains reusable
- Key guardrails:
  - no window globals in maintained area
  - no eval/new Function
  - sanitize external HTML inputs
  - JSON-safe persistence only
  - if legacy production files (`index.html`, `js/`, `css/`) are changed, update `PATCH_NOTES.txt`

## Speculative Defense Check
- [x] Defensive branches added: YES
- If YES:
  - evidence (real case / source): MCP/API 응답 형태 변형(`result.toolResult`, `payload`, `result.content[].text`)을 흡수하는 후보 추출 분기 추가. API `GET/HEAD`에서 body 전송 시 브라우저 `fetch` 오류를 피하도록 body 무시 분기 추가.
  - sunset criteria: MCP 게이트웨이 응답 스키마가 프로젝트 공용 계약으로 고정되면 후보 추출 분기를 계약 기반 단일 경로로 축소.

## Documentation Update Check
- [x] Structure changed (file/folder add/move/delete):
  - run `bash scripts/gen_ai_read_me_map.sh`
  - verify `AI_READ_ME_MAP.md`
- [x] Workflow/rule/semantic changes:
  - 해당 없음(워크플로우/룰 변경 없음), `AI_READ_ME.md` 수정 불필요로 확인

## Acceptance criteria (testable)
- [x] AC-1: Exchange panel supports remote invoke mode with both MCP call format and generic API call format.
- [x] AC-2: Successful remote response can be loaded into existing `ToolResult -> Normalized` conversion flow without regression.
- [x] AC-3: Remote call errors are surfaced in UI and do not crash editor app.
- [x] AC-4: `canvas-editor-app` lint/build and guardrail check pass.
- [x] AC-5: README/PATCH_NOTES update decision is applied (updated if needed, otherwise explicitly noted in log).

## Manual verification
1) Step:
   - Command / click path: `cd canvas-editor-app && npm run dev`
   - Expected: app loads and exchange panel renders remote invoke controls.
   - Covers: AC-1

2) Step:
   - Command / click path: In exchange panel, input endpoint + payload (MCP/API mode) and run invoke.
   - Expected: response JSON is loaded into input area; existing convert action remains usable.
   - Covers: AC-2

3) Step:
   - Command / click path: trigger remote call with invalid endpoint or invalid JSON.
   - Expected: clear error message appears; app remains interactive.
   - Covers: AC-3

4) Step:
   - Command / click path:
     - `cd canvas-editor-app && npm run lint`
     - `cd canvas-editor-app && npm run build`
     - `bash scripts/check_guardrails.sh`
   - Expected: commands pass.
   - Covers: AC-4

## Risks / rollback
- Risks:
  - Different MCP gateway response shapes may require adapter updates.
  - Overly strict parsing could reject valid but unfamiliar responses.
- Rollback:
  - Revert new remote adapter and UI section while keeping existing local exchange path intact.

## Approval Gate
- [x] Spec self-reviewed by Codex
- [x] Explicit user approval received

Implementation must not start before this gate is satisfied (except approved hotfix path).

---

## Implementation Log
Status: COMPLETED
Changed files:
- `canvas-editor-app/src/adapters/exchange/mcpApiAdapter.js` (new)
- `canvas-editor-app/src/adapters/exchange/index.js`
- `canvas-editor-app/src/features/exchange-playground/ExchangePlayground.jsx`
- `canvas-editor-app/src/App.css`
- `README.md`
- `PATCH_NOTES.txt`
- `AI_READ_ME_MAP.md`
- `codex_tasks/task_010_mcp_api_invocation_scaffold.md`

Commands run:
- `bash scripts/scan_guardrails.sh`
- `bash scripts/gen_ai_read_me_map.sh`
- `bash scripts/check_guardrails.sh`
- `cd canvas-editor-app && npm run lint` (초기 fail: eslint not found)
- `cd canvas-editor-app && npm run build` (초기 fail: vite not found)
- `cd canvas-editor-app && npm_config_cache=/tmp/npm-cache npm install --no-audit --no-fund` (초기 fail: network/DNS `EAI_AGAIN`)
- `cd canvas-editor-app && npm ci` (성공, 사용자 실행 로그 확인)
- `cd canvas-editor-app && npm run lint` (재실행 PASS)
- `cd canvas-editor-app && npm run build` (재실행 PASS)
- `bash scripts/guardrails.sh` (PASS)

## Gate Results
- Lint:
  - PASS (`cd canvas-editor-app && npm run lint`)
- Build:
  - PASS (`cd canvas-editor-app && npm run build`)
- Script checks:
  - PASS (`bash scripts/guardrails.sh`)

## Failure Classification
- Pre-existing failures:
  - 없음
- Newly introduced failures:
  - 없음(코드 단위에서 신규 런타임 예외 재현 없음)
- Blocking:
  - NO
- Mitigation:
  - 없음

Manual verification notes:
- 정적 코드 검토 기준으로 원격 호출 경로와 기존 변환 경로 분리 유지 확인.
- API `GET/HEAD` body 무시 처리로 브라우저 fetch 오류 가능성 완화.
- 정적 실행 검증(`lint/build/guardrails`) PASS.

Notes:
- 기능/문서/검증 게이트 완료.
