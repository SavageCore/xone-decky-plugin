#!/usr/bin/env bash
# Build the plugin, then push it to a Steam Deck.
#
# This plugin requests the `root` flag, so Decky Loader re-chowns its
# install directory back to root every time the plugin reloads (a security
# measure - see plugin.py in decky-loader), including via its live-reload
# file watcher. An unprivileged rsync copy loses that race. Instead, upload
# the zip as `deck` (the plugins/ folder itself stays deck-writable) then
# extract it as root on the other end - mirroring the official
# decky-plugin-template's VS Code deploy tasks.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
. ./.env
set +a

pnpm run package

zip_path=$(ls out/*.zip)
zip_name=$(basename "$zip_path")
plugin_name="${zip_name%.zip}"
remote_plugins_dir="$DECK_DIR/homebrew/plugins"
remote_plugin_dir="$remote_plugins_dir/$plugin_name"
remote_zip_path="$remote_plugins_dir/$zip_name"

ssh_opts=(-p "$DECK_PORT" -i "$DECK_KEY")
scp_opts=(-P "$DECK_PORT" -i "$DECK_KEY")

ssh "${ssh_opts[@]}" "deck@$DECK_IP" \
  "echo '$DECK_PASS' | sudo -S chown deck:deck \"$remote_plugins_dir\""

scp "${scp_opts[@]}" "$zip_path" "deck@$DECK_IP:$remote_zip_path"

ssh "${ssh_opts[@]}" "deck@$DECK_IP" \
  "echo '$DECK_PASS' | sudo -S rm -rf \"$remote_plugin_dir\" \
  && echo '$DECK_PASS' | sudo -S mkdir -p \"$remote_plugin_dir\" \
  && echo '$DECK_PASS' | sudo -S bsdtar -xzpf \"$remote_zip_path\" -C \"$remote_plugin_dir\" --strip-components=1 --fflags \
  && echo '$DECK_PASS' | sudo -S rm -f \"$remote_zip_path\" \
  && echo '$DECK_PASS' | sudo -S systemctl restart plugin_loader.service"

echo "Deployed $plugin_name to $DECK_IP"
