# Hotfix 001: AI_READ_ME authority wording alignment

Status: COMPLETED
Owner: Codex
Date: 2026-02-12

## Why hotfix
- Urgent reason:
  - `AI_READ_ME.md`의 권한 충돌 문구가 같은 파일의 SSOT 순서 및 `AGENTS.md`와 논리 충돌.
- User hotfix approval reference (chat quote/date):
  - "오케기 그렇게해. 핫픽스로 진행해." (2026-02-12)

## Scope (strictly minimal)
Touched files:
- `AI_READ_ME.md`
- `codex_tasks/hotfix/hotfix_001_ai_readme_authority_alignment.md`

Out of scope:
- SSOT 순서 자체 변경 (`PROJECT_BLUEPRINT.md`, `AGENTS.md`, `GEMINI_CODEX_PROTOCOL.md`)
- 기능/코드/UI 변경

## What changed
- `AI_READ_ME.md` 서두 문구를 다음 원칙으로 정렬:
  - 실무 시작점은 `AGENTS.md`
  - 충돌 판정은 `AI_READ_ME.md` 내 SSOT 순서 따름
- SSOT 순서 목록은 변경하지 않고 표현 충돌만 제거

## Verification
- Commands:
  - `bash scripts/scan_guardrails.sh`
  - `bash scripts/check_guardrails.sh`
- Manual checks:
  - `AI_READ_ME.md` 내부 권한 문구와 같은 파일의 SSOT 순서가 충돌하지 않는지 확인

## Safety checks
- [x] No scope expansion beyond urgent fix
- [x] No new dependencies
- [x] No vendor edits
- [x] If legacy production files (`index.html`, `js/`, `css/`) changed, `PATCH_NOTES.txt` updated (N/A: legacy untouched)

## Follow-up
- Convert to full task spec needed? (yes/no): no
- If yes, planned task id:
- Residual risks:
  - 운영 규칙 변경이 필요할 경우 별도 정식 task에서 SSOT 재합의 필요

---

## Closeout Log
Status: COMPLETED
Changed files:
- `AI_READ_ME.md`
- `codex_tasks/hotfix/hotfix_001_ai_readme_authority_alignment.md`

Commands run:
- `bash scripts/scan_guardrails.sh`
- `bash scripts/check_guardrails.sh`

Notes:
- pre-existing 문서 내 표현 충돌 수정이며, 신규 기능/코드 변경 없음
- `README.md`/`PATCH_NOTES.txt` 업데이트 필요 없음(기능/UI/레거시 변경 아님)
