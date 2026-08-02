#!/bin/sh
# Kill node processes listening via vite/srvx binaries by matching ONLY the first argv.
for dir in /proc/[0-9]*; do
  pid=${dir#/proc/}
  [ -r "$dir/cmdline" ] || continue
  # Reconstruct argv as lines
  tr '\0' '\n' < "$dir/cmdline" 2>/dev/null | {
    read -r arg0 || exit 0
    # vite binary
    case "$arg0" in
      */.bin/vite|*/vite/bin/vite.js|*/node_modules/vite/bin/vite.js)
        echo "kill vite $pid"
        kill "$pid" 2>/dev/null || true
        exit 0
        ;;
    esac
    # node + vite/srvx as subsequent arg
    if [ "$arg0" = "node" ] || [ "$(basename "$arg0")" = "node" ]; then
      while read -r a; do
        case "$a" in
          */.bin/vite|*/vite/bin/vite.js|*srvx*|*__server.func*)
            echo "kill node-server $pid ($a)"
            kill "$pid" 2>/dev/null || true
            break
            ;;
        esac
      done
    fi
  }
done
