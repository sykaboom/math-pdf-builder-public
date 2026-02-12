# codex_tasks

이 폴더는 중간 이상 작업의 스펙과 작업 로그를 관리합니다.

## 파일 규칙
- 일반 작업: `task_###_<short_name>.md`
- 핫픽스: `hotfix/hotfix_###_<short_name>.md`
- 위임 실행 플레이북: `_PLAYBOOK_subagent_oneclick.md` (보조 문서)

## 최소 워크플로우
1. 템플릿 복사 (`task_template.md` 또는 `hotfix/hotfix_template.md`)
2. 목표/범위/수용기준 작성
3. 스펙 자체검토 + 사용자 승인
4. 구현 후 같은 파일에 결과 로그 기록 (`COMPLETED`)
5. 필요 시 가드레일 스크립트 수행
   - `bash scripts/scan_guardrails.sh`
   - `bash scripts/check_guardrails.sh`
   - `bash scripts/guardrails.sh`

## 원칙
- 스펙에 없는 파일은 함부로 수정하지 않습니다.
- 핫픽스는 범위를 매우 작게 유지합니다.
- `_PLAYBOOK_subagent_oneclick.md`는 실행 보조 기준이며, 권한 SSOT는 항상 `AGENTS.md`입니다.

## 워크플로우 일관성 체크리스트
- 권한 순서 문구가 `AGENTS.md` / `GEMINI_CODEX_PROTOCOL.md` / `AI_READ_ME.md`에서 동일한지 확인
- `delegated`, `escalation`, `fallback`, `hotfix` 용어 의미가 문서별로 충돌하지 않는지 확인
- 비로컬 가정 금지 확인:
  - foreign app root path assumptions
  - non-local node-based AI map generator assumptions
- 로컬 경로/스크립트 유지 확인:
  - `canvas-editor-app/`, `index.html`, `js/`, `css/`, `vendor/canvas-editor/canvas-editor-main/`
  - `bash scripts/scan_guardrails.sh`
  - `bash scripts/check_guardrails.sh`
  - `bash scripts/guardrails.sh`
- 최종 점검:
  - `bash scripts/check_guardrails.sh`
