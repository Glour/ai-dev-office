#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"
ensure_user_systemd

profile="${1:-}"
if [ -z "$profile" ]; then
  echo "Использование: scripts/logs-agent.sh <profile>" >&2
  exit 2
fi

journalctl --user -u "$(service_name "$profile")" -f
