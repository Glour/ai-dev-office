#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"
require_command hermes

profile="${1:-}"
if [ -z "$profile" ]; then
  echo "Использование: scripts/run-agent-local.sh <profile>" >&2
  exit 2
fi

export HERMES_HOME="$(runtime_home)"
export HERMES_AUTH_STORE="${HERMES_AUTH_STORE:-$HOME/.hermes/auth.json}"
exec hermes --profile "$profile" gateway run --replace
