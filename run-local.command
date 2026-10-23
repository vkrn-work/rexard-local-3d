#!/bin/zsh
cd -- "$(dirname -- "$0")"
echo 'REXARD: http://127.0.0.1:4173/'
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 4173 --bind 127.0.0.1
else
  "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3" -m http.server 4173 --bind 127.0.0.1
fi
