#!/usr/bin/env bash
# Ejecuta un comando npm dentro del entorno nvm de WSL: scripts/run.sh <script npm>
set -e
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
cd "$HOME/git/polla_amigos"
exec npm run "$@"
