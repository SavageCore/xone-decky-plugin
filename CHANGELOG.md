# Changelog

### 0.3.3

 - Fix headers being installed for the wrong kernel package on SteamOS preview/beta builds (e.g. `-drm-exec`), causing an unbreakable DKMS "kernel headers mismatch" reboot loop ([xone-steam-deck-installer#1](https://github.com/SavageCore/xone-steam-deck-installer/issues/1)). Kernel package is now derived from the actual running kernel via `pkgbase` instead of guessing the latest installed `linux-neptune-N`
 - Fail with a clear message instead of rebooting when no headers package exists for the running kernel

### 0.3.2

 - Fix false "Update Available" banner after dkms is wiped by a SteamOS update
 - Deploy plugins by extracting as root on the Deck, not via unprivileged rsync
 - Switch local build/deploy to the official Decky CLI

### 0.3.1

 - Fix `set -e` / exit-code bugs in install.sh and improve error surfacing
 - Fix build artifact name
 - Remove leftover update zip and backup folder once an update finishes

### 0.3.0

 - Implement auto-update
 - Fix incorrect zip name when adding version, now finds any zip
 - Rename "Xone Manager" to "Xone Driver Manager"

### 0.2.1

 - Fix path to scripts dir after packaging moved to Decky CLI
 - Update README to reflect new update procedure

### 0.2.0

 - Implement update check system
 - Enhance UI with always-visible pairing toggle and version display
 - Fix package command for building the plugin
 - Standardize build process with official decky-cli
 - Switch local builds (Windows) to a custom remote builder

### 0.1.1

 - Add real-time pairing status polling
 - Clarify building-from-source installation steps

### 0.1.0

 - Initial release: Decky Loader plugin to manage xone and xpad-noone drivers on Steam Deck
