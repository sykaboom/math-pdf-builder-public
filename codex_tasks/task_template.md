# Task <id>: <short title>

Status: PENDING | APPROVED | COMPLETED
Owner: Codex
Target: canvas-editor-app/ | root-legacy/ | docs-only
Date: YYYY-MM-DD

## Goal
- What to change:
  - <concise observable change>
- What must NOT change:
  - <explicit non-goals / invariants>

## Scope (Codex must touch ONLY these)
Touched files/directories:
- <path>

Out of scope:
- <item>

## Design Artifacts (required for layout/structure tasks)
- [ ] Layout/structure changes included: YES / NO
- [ ] SVG path in `design_drafts/` (required if YES):
- [ ] SVG has explicit `viewBox` and ratio label
- [ ] Numeric redline resolved in spec

Note:
- SVG is structural draft only.
- SVG must not be embedded into production code.

## Dependencies / constraints
- New dependencies allowed: NO (default)
  - If YES, list and justify.
- Boundary rules:
  - provider/model-specific logic stays in adapters
  - core/contract layers remain generic
- Key guardrails:
  - no window globals in maintained area
  - no eval/new Function
  - sanitize external HTML inputs
  - JSON-safe persistence only
  - if legacy production files (`index.html`, `js/`, `css/`) are changed, update `PATCH_NOTES.txt`

## Speculative Defense Check
- [ ] Defensive branches added: YES / NO
- If YES:
  - evidence (real case / source):
  - sunset criteria:

## Documentation Update Check
- [ ] Structure changed (file/folder add/move/delete):
  - run `bash scripts/gen_ai_read_me_map.sh`
  - verify `AI_READ_ME_MAP.md`
- [ ] Workflow/rule/semantic changes:
  - verify `AI_READ_ME.md`

## Acceptance criteria (testable)
- [ ] AC-1: <pass/fail condition>
- [ ] AC-2: <pass/fail condition>

## Manual verification
1) Step:
   - Command / click path:
   - Expected:
   - Covers: AC-#

2) Step:
   - Command / click path:
   - Expected:
   - Covers: AC-#

## Risks / rollback
- Risks:
  - <what can fail>
- Rollback:
  - <revert strategy>

## Approval Gate
- [ ] Spec self-reviewed by Codex
- [ ] Explicit user approval received

Implementation must not start before this gate is satisfied (except approved hotfix path).

---

## Implementation Log
Status: PENDING
Changed files:
- <path>

Commands run:
- <command>

Manual verification notes:
- <result>

Notes:
- <pre-existing issue vs new issue>
