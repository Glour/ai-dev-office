#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"
ensure_user_systemd

printf "%-24s %-12s %-8s %s\n" "ПРОФИЛЬ" "СТАТУС" "PID" "СЕРВИС"
for profile in "${profiles[@]}"; do
  svc="$(service_name "$profile")"
  active="$(systemctl --user is-active "$svc" 2>/dev/null || true)"
  pid="$(systemctl --user show "$svc" -p MainPID --value 2>/dev/null || echo 0)"
  printf "%-24s %-12s %-8s %s\n" "$profile" "$active" "$pid" "$svc"
done
