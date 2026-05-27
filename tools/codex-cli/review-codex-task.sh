#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  review-codex-task.sh --task-file <path> [--artifacts-dir <dir>] [--codex-bin <bin>] [--dry-run]

Creates a structured artifact for a Codex CLI code review run.
USAGE
}

task_file=""
artifacts_dir="${AI_OFFICE_ARTIFACTS_DIR:-./artifacts}/codex-reviews"
codex_bin="${CODEX_CLI_BIN:-codex}"
dry_run=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --task-file) task_file="${2:-}"; shift 2 ;;
    --artifacts-dir) artifacts_dir="${2:-}"; shift 2 ;;
    --codex-bin) codex_bin="${2:-}"; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

if [ -z "$task_file" ] || [ ! -f "$task_file" ]; then
  echo "Missing --task-file or file does not exist: $task_file" >&2
  exit 2
fi

run_id="$(date -u +%Y%m%dT%H%M%SZ)-$(basename "$task_file" | tr -cd '[:alnum:]_.-' | cut -c1-48)"
run_dir="$artifacts_dir/$run_id"
mkdir -p "$run_dir"
cp "$task_file" "$run_dir/task.md"

review_prompt="$(mktemp)"
{
  echo "Review the following task/change request. Lead with bugs, risks, regressions, and missing tests. Do not edit files."
  echo
  cat "$task_file"
} > "$review_prompt"

if [ "$dry_run" -eq 1 ]; then
  status="dry-run"
  printf 'Dry run: would invoke %s review with %s\n' "$codex_bin" "$task_file" > "$run_dir/stdout.log"
  : > "$run_dir/stderr.log"
  cp "$review_prompt" "$run_dir/review.md"
else
  if ! command -v "$codex_bin" >/dev/null 2>&1; then
    echo "Codex CLI not found: $codex_bin" > "$run_dir/stderr.log"
    status="failed"
  else
    set +e
    "$codex_bin" "$(cat "$review_prompt")" > "$run_dir/stdout.log" 2> "$run_dir/stderr.log"
    code=$?
    set -e
    if [ "$code" -eq 0 ]; then status="succeeded"; else status="failed"; fi
    cp "$run_dir/stdout.log" "$run_dir/review.md"
  fi
fi
rm -f "$review_prompt"

cat > "$run_dir/run.json" <<JSON
{
  "kind": "codex_review_run",
  "status": "$status",
  "task_file": "$task_file",
  "artifact_dir": "$run_dir",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo "$run_dir"
[ "$status" != "failed" ]
