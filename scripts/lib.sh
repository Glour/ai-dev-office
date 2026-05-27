#!/usr/bin/env bash
set -euo pipefail

profiles=(
  owner-assistant
  orchestrator
  dev-builder
  dev-reviewer
  qa-lead
  materials-librarian
  daily-auditor
)

repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

runtime_home() {
  echo "${HERMES_RUNTIME_HOME:-$HOME/.hermes-ai-dev-office}"
}

repo_runtime_path() {
  local root
  root="$(repo_root)"
  echo "${AI_DEV_OFFICE_REPO:-$root}"
}

service_name() {
  echo "hermes-gateway-ai-dev-office@$1.service"
}

template_service_name() {
  echo "hermes-gateway-ai-dev-office@.service"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_user_systemd() {
  if ! command -v systemctl >/dev/null 2>&1; then
    echo "systemctl is not available on this host." >&2
    exit 1
  fi
  if ! systemctl --user show-environment >/dev/null 2>&1; then
    echo "systemd user session is not available. Log in as the target user and retry." >&2
    exit 1
  fi
}

read_secret() {
  local prompt="$1"
  local value
  read -r -s -p "$prompt" value
  echo >&2
  echo "$value"
}

read_default() {
  local prompt="$1"
  local default_value="$2"
  local value
  read -r -p "$prompt [$default_value]: " value
  echo "${value:-$default_value}"
}
