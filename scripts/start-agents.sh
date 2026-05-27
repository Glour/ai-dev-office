#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"
ensure_user_systemd

for profile in "${profiles[@]}"; do
  systemctl --user start "$(service_name "$profile")"
done

"$(dirname "$0")/status-agents.sh"
