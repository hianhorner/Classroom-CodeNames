#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR"
LAUNCHER_DIR="$APP_DIR/.launcher"
LOG_DIR="$LAUNCHER_DIR/logs"
RUN_DIR="$LAUNCHER_DIR/run"
PREVIEW_PID_FILE="$RUN_DIR/preview.pid"
PREVIEW_LOG="$LOG_DIR/preview.log"
PREVIEW_PORT="${LAN_PREVIEW_PORT:-4173}"
HEALTH_URL="http://127.0.0.1:${PREVIEW_PORT}/api/health"
LAN_URL_FILE="$RUN_DIR/lan-url.txt"
SERVER_ENTRY="$APP_DIR/server/src/index.ts"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export DOTENV_CONFIG_PATH="$APP_DIR/.env"

mkdir -p "$LOG_DIR" "$RUN_DIR"

if [[ -f "$HOME/.zprofile" ]]; then
  source "$HOME/.zprofile" >/dev/null 2>&1 || true
fi

if [[ -f "$HOME/.zshrc" ]]; then
  source "$HOME/.zshrc" >/dev/null 2>&1 || true
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    echo "Make sure Node.js and npm are installed and available in Terminal."
    read -k 1 "?Press any key to close..."
    exit 1
  fi
}

is_pid_running() {
  local pid_file="$1"

  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"

  if [[ -z "$pid" ]]; then
    return 1
  fi

  kill -0 "$pid" >/dev/null 2>&1
}

stop_running_preview() {
  if ! is_pid_running "$PREVIEW_PID_FILE"; then
    local stale_pids
    stale_pids="$(lsof -ti tcp:"$PREVIEW_PORT" 2>/dev/null || true)"

    if [[ -n "$stale_pids" ]]; then
      echo "Cleaning up stale LAN preview process on port $PREVIEW_PORT..."
      echo "$stale_pids" | xargs kill >/dev/null 2>&1 || true
      sleep 1
      echo "$stale_pids" | xargs kill -9 >/dev/null 2>&1 || true
    fi

    return
  fi

  local pid
  pid="$(cat "$PREVIEW_PID_FILE" 2>/dev/null || true)"

  if [[ -n "$pid" ]]; then
    echo "Refreshing existing LAN preview..."
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi

  rm -f "$PREVIEW_PID_FILE"

  local stale_pids
  stale_pids="$(lsof -ti tcp:"$PREVIEW_PORT" 2>/dev/null || true)"

  if [[ -n "$stale_pids" ]]; then
    echo "$stale_pids" | xargs kill >/dev/null 2>&1 || true
    sleep 1
    echo "$stale_pids" | xargs kill -9 >/dev/null 2>&1 || true
  fi
}

start_preview() {
  stop_running_preview

  echo "Building Classroom Codenames..."
  (
    cd "$APP_DIR"
    npm run build >"$PREVIEW_LOG" 2>&1
  ) || {
    echo "Build failed."
    echo "Preview log: $PREVIEW_LOG"
    read -k 1 "?Press any key to close..."
    exit 1
  }

  echo "Starting LAN preview..."
  (
    cd "$APP_DIR/server"
    nohup env \
      PORT="$PREVIEW_PORT" \
      HOST="0.0.0.0" \
      SERVE_CLIENT="true" \
      APP_BASE_URL="$PREVIEW_URL" \
      DOTENV_CONFIG_PATH="$APP_DIR/.env" \
      node --import tsx src/index.ts </dev/null >>"$PREVIEW_LOG" 2>&1 &
    local pid=$!
    disown "$pid" 2>/dev/null || true
    echo "$pid" >"$PREVIEW_PID_FILE"
  )
}

show_access_dialog() {
  local preview_url="$1"
  local message

  message="Classroom Codenames is running on your local network.\n\nOpen this link on other devices:\n${preview_url}"

  printf '%s\n' "$preview_url" >"$LAN_URL_FILE"

  if command -v osascript >/dev/null 2>&1; then
    osascript <<EOF >/dev/null 2>&1 || true
display dialog "${message}" buttons {"OK"} default button "OK" with title "Classroom Codenames"
EOF
  fi
}

wait_for_url() {
  local url="$1"
  local name="$2"
  local attempts=0

  until curl -sf "$url" >/dev/null 2>&1; do
    attempts=$((attempts + 1))

    if (( attempts > 60 )); then
      echo "$name did not become ready in time."
      echo "Server log: $SERVER_LOG"
      echo "Client log: $CLIENT_LOG"
      read -k 1 "?Press any key to close..."
      exit 1
    fi

    sleep 1
  done
}

require_command node
require_command npm
require_command curl

if [[ ! -d "$APP_DIR/node_modules" ]]; then
  echo "Dependencies are missing. Running npm install first..."
  cd "$APP_DIR"
  npm install
fi

PREVIEW_URL="$(node "$APP_DIR/scripts/lanHost.mjs" --port "$PREVIEW_PORT")"

start_preview

echo "Waiting for LAN preview..."
wait_for_url "$HEALTH_URL" "LAN preview"

echo "Opening Classroom Codenames..."
open "$PREVIEW_URL"
show_access_dialog "$PREVIEW_URL"

echo
echo "Classroom Codenames is running."
echo "Open script: $0"
echo "Close script: $APP_DIR/Close Classroom Codenames.command"
echo "LAN URL: $PREVIEW_URL"
echo "Saved LAN URL: $LAN_URL_FILE"
echo "Preview log: $PREVIEW_LOG"
echo
echo "Use the Close Classroom Codenames.command file when you want to shut it down."
