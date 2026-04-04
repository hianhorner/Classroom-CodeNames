#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR"
RUN_DIR="$APP_DIR/.launcher/run"
PREVIEW_PID_FILE="$RUN_DIR/preview.pid"
LAN_URL_FILE="$RUN_DIR/lan-url.txt"

stop_from_pid_file() {
  local pid_file="$1"
  local label="$2"

  if [[ ! -f "$pid_file" ]]; then
    echo "$label pid file not found."
    return
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"

  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    echo "Stopping $label..."
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
    kill -9 "$pid" >/dev/null 2>&1 || true
  else
    echo "$label was not running."
  fi

  rm -f "$pid_file"
}

stop_port() {
  local port="$1"
  local label="$2"
  local pids

  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"

  if [[ -n "$pids" ]]; then
    echo "Cleaning up $label on port $port..."
    echo "$pids" | xargs kill >/dev/null 2>&1 || true
  fi
}

stop_from_pid_file "$PREVIEW_PID_FILE" "preview"

stop_port 4173 "preview"
stop_port 4000 "server"
stop_port 5173 "client"

rm -f "$LAN_URL_FILE"

echo
echo "Classroom Codenames has been stopped."
