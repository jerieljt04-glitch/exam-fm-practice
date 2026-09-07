#!/bin/bash
#
# Stops the background server started by Exam FM Practice.app.
#
# The app is a launcher: it starts the server detached and exits, so that
# clicking its Dock icon always reopens the exam. That means quitting the app
# does not stop the server — use this when you want it gone.
#
set -euo pipefail

PORT="${EXAM_FM_PORT:-4173}"
PIDFILE="$HOME/Library/Application Support/Exam FM Practice/server.pid"

stopped=0

if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null && stopped=1
  fi
  rm -f "$PIDFILE"
fi

# Also catch a server started before this script existed, or a stale pid file.
for pid in $(pgrep -f "next start --port $PORT" 2>/dev/null || true); do
  kill "$pid" 2>/dev/null && stopped=1
done

sleep 1
if nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1; then
  echo "Something is still listening on port $PORT."
  exit 1
fi

[ "$stopped" = "1" ] && echo "Exam FM Practice server stopped." || echo "It was not running."
