#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

root="$(repo_root)"
home_dir="$(runtime_home)"
repo_path="$(repo_runtime_path)"

require_command hermes
require_command git
require_command curl
ensure_user_systemd

echo "Bootstrap Hermes для AI Dev Office"
echo "Репозиторий: $root"
echo "Runtime home: $home_dir"
echo

owner_user_id="$(read_default "Telegram user id владельца" "${TELEGRAM_ALLOWED_USERS:-}")"
default_chat_id="$(read_default "Telegram group/chat id по умолчанию; оставь пустым для DM-only" "${TELEGRAM_HOME_CHANNEL:-}")"

mkdir -p "$home_dir/profiles"

for profile in "${profiles[@]}"; do
  echo
  echo "Профиль: $profile"
  src="$root/hermes/profiles/$profile"
  dst="$home_dir/profiles/$profile"
  mkdir -p "$dst"
  cp "$src/config.yaml" "$dst/config.yaml"
  cp "$src/AGENTS.md" "$dst/AGENTS.md"
  token="$(read_secret "Telegram bot token для $profile: ")"
  if [ -z "$token" ]; then
    echo "Для профиля $profile нужен токен." >&2
    exit 1
  fi
  validate_telegram_token "$token" "$profile"
  if [ -n "$default_chat_id" ]; then
    thread_id="$(read_default "Telegram topic/thread id для $profile" "")"
    home_channel="$default_chat_id"
  else
    thread_id=""
    home_channel="$owner_user_id"
  fi
  cat > "$dst/.env" <<ENV
TELEGRAM_BOT_TOKEN=$token
TELEGRAM_ALLOWED_USERS=$owner_user_id
TELEGRAM_HOME_CHANNEL=$home_channel
TELEGRAM_HOME_CHANNEL_THREAD_ID=$thread_id
TELEGRAM_REACTIONS=true
TELEGRAM_REQUIRE_MENTION=true
TELEGRAM_GROUP_ALLOWED_CHATS=$default_chat_id
TELEGRAM_FREE_RESPONSE_THREADS=$home_channel${thread_id:+:$thread_id}
HERMES_INFERENCE_PROVIDER=openai-codex
HERMES_INFERENCE_MODEL=gpt-5.5
HERMES_ACCEPT_HOOKS=1
HERMES_YOLO_MODE=1
AI_DEV_OFFICE_REPO=$repo_path
CODEX_CLI_BIN=${CODEX_CLI_BIN:-codex}
ENV
  chmod 600 "$dst/.env"
  mkdir -p "$dst/logs" "$dst/sessions" "$dst/memory"
done

mkdir -p "$HOME/.config/systemd/user"
cp "$root/hermes/systemd/hermes-gateway-ai-dev-office@.service" "$HOME/.config/systemd/user/hermes-gateway-ai-dev-office@.service"
mkdir -p "$HOME/.config/systemd/user/$(template_service_name).d"
cat > "$HOME/.config/systemd/user/$(template_service_name).d/10-runtime.conf" <<ENV
[Service]
Environment="HERMES_HOME=$home_dir"
Environment="HERMES_AUTH_STORE=$HOME/.hermes/auth.json"
Environment="AI_DEV_OFFICE_REPO=$repo_path"
ENV
systemctl --user daemon-reload

for profile in "${profiles[@]}"; do
  systemctl --user enable "$(service_name "$profile")" >/dev/null
done

echo
echo "Bootstrap завершен."
echo "Запусти агентов командой: scripts/start-agents.sh"
