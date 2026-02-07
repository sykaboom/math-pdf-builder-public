#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAIL=0
TARGET="$ROOT/canvas-editor-app/src"
VENDOR_DIR="$ROOT/vendor/canvas-editor/canvas-editor-main"

if ! command -v rg >/dev/null 2>&1; then
  echo "rg (ripgrep) is required." >&2
  exit 2
fi

if [ ! -d "$TARGET" ]; then
  echo "[ERROR] Missing target directory: $TARGET" >&2
  exit 2
fi

check_none() {
  local label="$1"
  local pattern="$2"
  local path="$3"
  local matches
  matches=$(rg -n "$pattern" "$path" || true)
  if [ -n "$matches" ]; then
    echo "[VIOLATION] $label"
    echo "$matches"
    echo
    FAIL=1
  fi
}

# Hard checks for maintained code area only (canvas-editor-app).
check_none "eval/new Function is forbidden in maintained app" "eval\\(|new Function" "$TARGET"
check_none "window global assignments are forbidden in maintained app" "window\\.[A-Za-z0-9_]+\\s*=|window\\[['\"][A-Za-z0-9_]+['\"]\\]\\s*=" "$TARGET"
check_none "unsafe HTML sinks are forbidden in maintained app (innerHTML/dangerouslySetInnerHTML)" "dangerouslySetInnerHTML|\\.innerHTML\\s*=" "$TARGET"
check_none "editor layer must not import React/UI directly" "from ['\"]react['\"]|from ['\"]\\.\\./App" "$TARGET/editor"

# Spaghetti threshold check (single-file size) for maintained app.
while IFS= read -r -d '' file; do
  lines="$(wc -l < "$file" | tr -d ' ')"
  if [ "$lines" -ge 900 ]; then
    echo "[VIOLATION] file too large (>=900 lines): $file ($lines)"
    FAIL=1
  fi
done < <(find "$TARGET" -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' \) -print0)

# Treat vendored engine as read-only in this repo.
if [ -d "$VENDOR_DIR" ] && git -C "$ROOT" status --porcelain -- "$VENDOR_DIR" | rg -q .; then
  echo "[VIOLATION] vendored Canvas-Editor source is modified: $VENDOR_DIR"
  echo "Treat vendor as read-only. Implement behavior in wrappers/adapters."
  git -C "$ROOT" status --short -- "$VENDOR_DIR"
  echo
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "Guardrails check: OK"
