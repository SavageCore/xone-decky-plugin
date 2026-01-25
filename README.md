# Xone Controller Manager - Decky Plugin

A [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin to install and manage Xbox wireless controller drivers ([xone](https://github.com/dlundqvist/xone) & [xpad-noone](https://github.com/forkymcforkface/xpad-noone)) on Steam Deck.

## Features

- **One-click driver installation** - Install the xone and xpad-noone drivers directly from Gaming Mode
- **Easy uninstallation** - Remove drivers cleanly with a single click
- **Pairing mode control** - Enable/disable dongle pairing mode without leaving Gaming Mode
- **SteamOS update detection** - Automatically notifies you when drivers need reinstalling after a system update

## Installation

### From Decky Plugin Store (Recommended)
1. Open Quick Access Menu (⋯ button)
2. Go to the Decky tab (plug icon)
3. Open the Plugin Store
4. Search for "Xone Controller Manager"
5. Click Install

### Manual Installation
1. Download the latest release from the [Releases](https://github.com/SavageCore/xone-decky-plugin/releases) page
2. Extract to `~/homebrew/plugins/xone-controller-manager/`
3. Restart Decky Loader

## Usage

1. Open Quick Access Menu (⋯ button)
2. Navigate to the Decky tab (plug icon)
3. Click on "Xone Controller Manager"
4. Click **Install Drivers** to install the Xbox wireless controller drivers
5. Once installed, use the **Pairing Mode** toggle to pair new controllers

### Pairing a Controller
1. Click the toggle to enable pairing mode (dongle LED will blink)
2. Hold the pairing button on your Xbox controller until the Xbox logo blinks rapidly
3. The controller will connect automatically
4. Disable pairing mode after successful connection

## After SteamOS Updates

When SteamOS updates, kernel modules are often removed. The plugin will detect this and show a notification prompting you to reinstall the drivers. Simply click **Reinstall Drivers** to restore functionality.

## Requirements

- Steam Deck with SteamOS 3.0+
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) installed
- Xbox Wireless Adapter for Windows 10/11

## Credits

- [xone](https://github.com/dlundqvist/xone) - Linux kernel driver for Xbox One/Series X|S accessories
- [xpad-noone](https://github.com/forkymcforkface/xpad-noone) - Companion driver for wireless adapter
- [Original install script](https://github.com/SavageCore/xone-steam-deck-installer) - The bash script this plugin is based on
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) - The plugin framework

## License

BSD-3-Clause License - See [LICENSE](LICENSE) for details.
