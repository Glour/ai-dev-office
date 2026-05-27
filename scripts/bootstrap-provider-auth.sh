#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib.sh"

runtime="$(runtime_home)"
source_auth="${HERMES_PROVIDER_AUTH_SOURCE:-}"

if [ -z "$source_auth" ]; then
  if [ -f "$HOME/.hermes/auth.json" ]; then
    source_auth="$HOME/.hermes/auth.json"
  elif [ -f "$HOME/.codex/auth.json" ]; then
    source_auth="$HOME/.codex/auth.json"
  fi
fi

if [ -z "$source_auth" ] || [ ! -f "$source_auth" ]; then
  cat >&2 <<'MSG'
Не найден provider auth.

Сначала авторизуй OpenAI Codex для Hermes:

  hermes auth add openai-codex

Если хочешь импортировать существующий файл явно:

  HERMES_PROVIDER_AUTH_SOURCE=/path/to/auth.json scripts/bootstrap-provider-auth.sh
MSG
  exit 1
fi

mkdir -p "$runtime"

AI_DEV_OFFICE_RUNTIME="$runtime" \
AI_DEV_OFFICE_SOURCE_AUTH="$source_auth" \
python3 - <<'PY'
import json
import os
import shutil
import stat
import time
from pathlib import Path

runtime = Path(os.environ["AI_DEV_OFFICE_RUNTIME"]).expanduser()
source = Path(os.environ["AI_DEV_OFFICE_SOURCE_AUTH"]).expanduser()
backup = runtime / "provider-auth-backups" / time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
backup.mkdir(parents=True, exist_ok=True)

raw = json.loads(source.read_text())

def provider_state_from(payload):
    providers = payload.get("providers")
    if isinstance(providers, dict):
        state = providers.get("openai-codex")
        if isinstance(state, dict) and isinstance(state.get("tokens"), dict):
            tokens = state["tokens"]
            if tokens.get("access_token") and tokens.get("refresh_token"):
                return state

    pool = payload.get("credential_pool")
    if isinstance(pool, dict):
        entries = pool.get("openai-codex")
        if isinstance(entries, list) and entries:
            entry = entries[0]
            if entry.get("access_token") and entry.get("refresh_token"):
                return {
                    "tokens": {
                        "access_token": entry.get("access_token"),
                        "refresh_token": entry.get("refresh_token"),
                    },
                    "last_refresh": entry.get("last_refresh"),
                    "auth_mode": "chatgpt",
                    "base_url": entry.get("base_url"),
                    "source": entry.get("source", "credential_pool"),
                }

    tokens = payload.get("tokens")
    if isinstance(tokens, dict) and tokens.get("access_token") and tokens.get("refresh_token"):
        return {
            "tokens": {
                "access_token": tokens.get("access_token"),
                "refresh_token": tokens.get("refresh_token"),
                **({"id_token": tokens["id_token"]} if tokens.get("id_token") else {}),
                **({"account_id": tokens["account_id"]} if tokens.get("account_id") else {}),
            },
            "last_refresh": payload.get("last_refresh"),
            "auth_mode": payload.get("auth_mode", "chatgpt"),
            "source": "codex-cli-auth-json",
        }

    raise SystemExit("В source auth нет OpenAI Codex access_token/refresh_token.")

state = provider_state_from(raw)

auth_store = {
    "version": 1,
    "active_provider": "openai-codex",
    "providers": {"openai-codex": state},
    "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
}

pool = raw.get("credential_pool")
if isinstance(pool, dict) and pool.get("openai-codex"):
    auth_store["credential_pool"] = {"openai-codex": pool["openai-codex"]}

targets = [runtime / "auth.json"]
profiles_dir = runtime / "profiles"
if profiles_dir.is_dir():
    for profile_dir in sorted(p for p in profiles_dir.iterdir() if p.is_dir()):
        targets.append(profile_dir / "auth.json")

for target in targets:
    if target.exists():
        shutil.copy2(target, backup / target.relative_to(runtime).as_posix().replace("/", "__"))
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_name(target.name + f".tmp.{os.getpid()}")
    tmp.write_text(json.dumps(auth_store, indent=2) + "\n")
    tmp.chmod(stat.S_IRUSR | stat.S_IWUSR)
    tmp.replace(target)
    target.chmod(stat.S_IRUSR | stat.S_IWUSR)

print(f"Provider auth установлен: {runtime}")
print(f"Источник: {source}")
print(f"Бэкап: {backup}")
PY

"$(dirname "$0")/check-provider-auth.sh"
