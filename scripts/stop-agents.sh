#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"
ensure_user_systemd

for profile in "${profiles[@]}"; do
  systemctl --user stop "$(service_name "$profile")" || true
done

"$(dirname "$0")/status-agents.sh"
