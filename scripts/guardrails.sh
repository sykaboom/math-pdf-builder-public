#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/2] Guardrail scan (report)"
bash "$ROOT/scripts/scan_guardrails.sh"

echo
echo "[2/2] Guardrail check (must pass)"
bash "$ROOT/scripts/check_guardrails.sh"
