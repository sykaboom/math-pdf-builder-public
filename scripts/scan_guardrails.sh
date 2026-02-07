#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAINTAINED="$ROOT/canvas-editor-app/src"
LEGACY_JS="$ROOT/js"
LEGACY_CANVAS_APP="$ROOT/canvas-app/src"

if ! command -v rg >/dev/null 2>&1; then
  echo "rg (ripgrep) is required." >&2
  exit 2
fi

echo "== Guardrail scan (info only) =="
echo "Maintained area: $MAINTAINED"
echo "Legacy/reference areas: $LEGACY_JS, $LEGACY_CANVAS_APP"

echo
echo "[Maintained] eval/new Function"
rg -n "eval\\(|new Function" "$MAINTAINED" || true

echo
echo "[Maintained] window assignments"
rg -n "window\\.[A-Za-z0-9_]+\\s*=|window\\[['\"][A-Za-z0-9_]+['\"]\\]\\s*=" "$MAINTAINED" || true

echo
echo "[Maintained] innerHTML / dangerouslySetInnerHTML"
rg -n "innerHTML|dangerouslySetInnerHTML" "$MAINTAINED" || true

echo
echo "[Legacy snapshot] innerHTML / dangerouslySetInnerHTML"
rg -n "innerHTML|dangerouslySetInnerHTML" "$LEGACY_JS" "$LEGACY_CANVAS_APP" || true

echo
echo "[Top 12 largest files] js + canvas-app/src + canvas-editor-app/src"
find "$LEGACY_JS" "$LEGACY_CANVAS_APP" "$MAINTAINED" -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' \) -print0 \
  | xargs -0 wc -l \
  | sort -nr \
  | head -n 12
