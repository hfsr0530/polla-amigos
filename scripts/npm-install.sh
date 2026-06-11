#!/usr/bin/env bash
set -e
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
cd "$HOME/git/polla_amigos"
npm install --no-audit --no-fund
echo "INSTALL_OK"
