#!/usr/bin/env bash
# Servidor para el preview del editor (puerto fijo 3200, misma DB de smoke)
set -e
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
cd "$HOME/git/polla_amigos"
PGLITE_DIR=./data/pglite-smoke exec npx next start -p 3200
