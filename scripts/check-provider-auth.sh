#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

runtime="$(runtime_home)"

if [ ! -d "$runtime/profiles" ]; then
  echo "Нет runtime-профилей: $runtime/profiles" >&2
  exit 1
fi

require_command python3

failed=0
for profile in "${profiles[@]}"; do
  printf "=== %s ===\n" "$profile"
  if HERMES_HOME="$runtime/profiles/$profile" python3 - <<'PY'
from hermes_cli.auth import _read_codex_tokens
try:
    data = _read_codex_tokens()
    tokens = data.get("tokens", {})
    if not tokens.get("access_token") or not tokens.get("refresh_token"):
        raise RuntimeError("нет access_token/refresh_token")
    print("openai-codex: OK")
except Exception as exc:
    print(f"openai-codex: FAIL: {type(exc).__name__}: {exc}")
    raise SystemExit(1)
PY
  then
    true
  else
    failed=1
  fi
done

exit "$failed"
