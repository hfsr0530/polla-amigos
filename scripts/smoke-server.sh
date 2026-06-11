#!/usr/bin/env bash
# Servidor de producción con base de datos desechable (PGlite) para smoke tests
set -e
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
cd "$HOME/git/polla_amigos"
rm -rf data/pglite-smoke
PGLITE_DIR=./data/pglite-smoke exec npx next start -p 3100
