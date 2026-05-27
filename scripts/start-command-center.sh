#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"
ensure_user_systemd

root="$(repo_root)"
service="ai-dev-office-command-center.service"
port="${COMMAND_CENTER_PORT:-3310}"

mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/$service" <<SERVICE
[Unit]
Description=AI Dev Office Command Center
After=network.target

[Service]
Type=simple
WorkingDirectory=$root/apps/command-center
Environment=NODE_ENV=production
Environment=COMMAND_CENTER_PORT=$port
Environment=HERMES_RUNTIME_HOME=${HERMES_RUNTIME_HOME:-$HOME/.hermes-ai-dev-office}
Environment=POSTGRES_HOST=${POSTGRES_HOST:-127.0.0.1}
Environment=POSTGRES_PORT=${POSTGRES_PORT:-5432}
Environment=POSTGRES_DB=${POSTGRES_DB:-ai_dev_office}
Environment=POSTGRES_USER=${POSTGRES_USER:-ai_dev_office}
Environment=POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-change-me}
ExecStart=/usr/bin/env npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
SERVICE

systemctl --user daemon-reload
systemctl --user enable --now "$service"
systemctl --user --no-pager status "$service"
