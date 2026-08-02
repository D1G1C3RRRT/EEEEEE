#!/bin/sh
# Kill only processes whose argv0/path is the vite binary (not shells embedding this script).
for dir in /proc/[0-9]*; do
  pid=${dir#/proc/}
  [ -r "$dir/cmdline" ] || continue
  # Read first arg only
  first=$(tr '\0' '\n' < "$dir/cmdline" 2>/dev/null | head -n1)
  case "$first" in
    */vite|vite)
      echo "kill $pid ($first)"
      kill "$pid" 2>/dev/null || true
      ;;
  esac
  # Also npm wrappers that exec node .../vite
  full=$(tr '\0' ' ' < "$dir/cmdline" 2>/dev/null)
  case "$full" in
    node\ */node_modules/.bin/vite\ *|node\ */vite/bin/*)
      echo "kill $pid ($full)"
      kill "$pid" 2>/dev/null || true
      ;;
  esac
done
