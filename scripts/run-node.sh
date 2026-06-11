#!/usr/bin/env bash
# Ejecuta node con el entorno nvm dentro del proyecto: scripts/run-node.sh <archivo> [args]
set -e
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
cd "$HOME/git/polla_amigos"
exec node "$@"
