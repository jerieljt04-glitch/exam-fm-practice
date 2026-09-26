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
RUNNING_BUILD="$HOME/Library/Application Support/Exam FM Practice/running-build-id"

listening() { nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1; }
ours() { curl -sf --max-time 3 "http://127.0.0.1:$PORT" 2>/dev/null | grep -q "Exam FM Practice"; }

if ! listening; then
  rm -f "$PIDFILE"
  rm -f "$RUNNING_BUILD"
  echo "It was not running."
  exit 0
fi

if ! ours; then
  echo "Port $PORT is held by something that is not Exam FM Practice. Leaving it alone."
  exit 1
fi

# `npm start` forks a child that renames itself to "next-server", so neither
# process can be found by the command line used to launch it. Kill the recorded
# npm pid, then whatever still holds the port.
if [ -f "$PIDFILE" ]; then
  kill "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null || true
  rm -f "$PIDFILE"
fi
rm -f "$RUNNING_BUILD"

for _ in $(seq 1 10); do listening || break; sleep 1; done

if listening; then
  for pid in $(lsof -ti "tcp:$PORT" 2>/dev/null); do kill "$pid" 2>/dev/null || true; done
  for _ in $(seq 1 10); do listening || break; sleep 1; done
fi

if listening; then
  echo "Could not stop the server on port $PORT."
  exit 1
fi

echo "Exam FM Practice server stopped."
