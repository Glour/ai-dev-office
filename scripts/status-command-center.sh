#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"
ensure_user_systemd

systemctl --user --no-pager status ai-dev-office-command-center.service
