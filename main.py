import os
import asyncio
import subprocess
import glob
import decky

# Constants
XONE_LOCAL_REPO = "/home/deck/repos/xone"
XPAD_NOONE_LOCAL_REPO = "/home/deck/repos/xpad-noone"
XONE_REMOTE_REPO = "https://github.com/dlundqvist/xone"
XPAD_NOONE_REMOTE_REPO = "https://github.com/forkymcforkface/xpad-noone"
XPAD_NOONE_VERSION = "1.0"

REQUIRED_PACKAGES = [
    "curl",
    "wget",
    "git",
    "gcc",
    "cabextract",
    "dkms",
    "libisl",
    "libmpc",
    "plymouth",
]


def get_clean_env():
    """Get a clean environment for subprocess calls.

    Decky's environment can have LD_LIBRARY_PATH/LD_PRELOAD that conflict
    with system binaries like bash/readline. We need to clean these.
    """
    env = os.environ.copy()
    # Add common binary paths
    env["PATH"] = "/usr/sbin:/usr/bin:/sbin:/bin:" + env.get("PATH", "")
    # Remove library overrides that can cause conflicts
    env.pop("LD_LIBRARY_PATH", None)
    env.pop("LD_PRELOAD", None)
    return env


class Plugin:
    """Xone Driver Manager Decky Plugin"""

    async def _main(self):
        """Called when the plugin loads"""
        self.loop = asyncio.get_event_loop()
        decky.logger.info("Xone Driver Manager loaded")

        # Check for SteamOS updates on startup
        await self._check_kernel_mismatch()

    async def _unload(self):
        """Called when the plugin unloads"""
        decky.logger.info("Xone Driver Manager unloaded")

    async def _uninstall(self):
        """Called when plugin is uninstalled"""
        decky.logger.info("Xone Driver Manager uninstalled")

    # =========================================================================
    # Status Methods
    # =========================================================================

    async def get_install_status(self) -> dict:
        """Check if xone and xpad-noone drivers are installed"""
        try:
            env = get_clean_env()

            xone_result = subprocess.run(
                ["dkms", "status", "xone"], capture_output=True, text=True, env=env
            )
            xpad_result = subprocess.run(
                ["dkms", "status", "xpad-noone"],
                capture_output=True,
                text=True,
                env=env,
            )

            # Log the results for debugging
            decky.logger.info(
                f"dkms status xone: stdout='{xone_result.stdout.strip()}' stderr='{xone_result.stderr.strip()}' rc={xone_result.returncode}"
            )
            decky.logger.info(
                f"dkms status xpad-noone: stdout='{xpad_result.stdout.strip()}' stderr='{xpad_result.stderr.strip()}' rc={xpad_result.returncode}"
            )

            # Check for "installed" in the output (more reliable than just checking if non-empty)
            xone_installed = "installed" in xone_result.stdout.lower()
            xpad_installed = "installed" in xpad_result.stdout.lower()

            decky.logger.info(
                f"Install status: xone={xone_installed}, xpad={xpad_installed}"
            )

            return {
                "xone_installed": xone_installed,
                "xpad_installed": xpad_installed,
                "fully_installed": xone_installed and xpad_installed,
            }
        except Exception as e:
            decky.logger.error(f"Error checking install status: {e}")
            return {
                "xone_installed": False,
                "xpad_installed": False,
                "fully_installed": False,
                "error": str(e),
            }

    async def get_pairing_status(self) -> dict:
        """Check if dongle is in pairing mode"""
        try:
            pairing_paths = glob.glob("/sys/bus/usb/drivers/xone-dongle/*/pairing")
            if not pairing_paths:
                decky.logger.info("No pairing path found")
                return {"available": False, "pairing": False}

            with open(pairing_paths[0], "r") as f:
                status = f.read().strip()
                decky.logger.info(f"Pairing status from hardware: '{status}'")

            return {"available": True, "pairing": status == "1"}
        except Exception as e:
            decky.logger.error(f"Error checking pairing status: {e}")
            return {"available": False, "pairing": False, "error": str(e)}

    async def _check_kernel_mismatch(self):
        """Check if the kernel has changed since last install and emit event if so"""
        try:
            status = await self.get_install_status()
            if not status.get("fully_installed"):
                return  # Not installed, nothing to check

            # Get current kernel version
            current_kernel = subprocess.run(
                ["uname", "-r"], capture_output=True, text=True, env=get_clean_env()
            ).stdout.strip()

            # Read saved kernel version
            settings_dir = os.environ.get("DECKY_PLUGIN_SETTINGS_DIR", "/tmp")
            kernel_file = os.path.join(settings_dir, "installed_kernel_version")

            if os.path.exists(kernel_file):
                with open(kernel_file, "r") as f:
                    saved_kernel = f.read().strip()

                if saved_kernel != current_kernel:
                    decky.logger.info(
                        f"Kernel mismatch detected: was {saved_kernel}, now {current_kernel}"
                    )
                    await decky.emit(
                        "kernel_update_detected", saved_kernel, current_kernel
                    )
            else:
                # First run after install, save current kernel
                await self._save_kernel_version(current_kernel)

        except Exception as e:
            decky.logger.error(f"Error checking kernel mismatch: {e}")

    async def _save_kernel_version(self, version: str = None):
        """Save current kernel version to settings"""
        try:
            if version is None:
                version = subprocess.run(
                    ["uname", "-r"], capture_output=True, text=True, env=get_clean_env()
                ).stdout.strip()

            settings_dir = os.environ.get("DECKY_PLUGIN_SETTINGS_DIR", "/tmp")
            os.makedirs(settings_dir, exist_ok=True)
            kernel_file = os.path.join(settings_dir, "installed_kernel_version")

            with open(kernel_file, "w") as f:
                f.write(version)

            decky.logger.info(f"Saved kernel version: {version}")
        except Exception as e:
            decky.logger.error(f"Error saving kernel version: {e}")

    # =========================================================================
    # Pairing Methods
    # =========================================================================

    async def enable_pairing(self) -> dict:
        """Enable pairing mode on the dongle"""
        try:
            pairing_paths = glob.glob("/sys/bus/usb/drivers/xone-dongle/*/pairing")
            if not pairing_paths:
                return {"success": False, "error": "No dongle found"}

            for path in pairing_paths:
                with open(path, "w") as f:
                    f.write("1")

            decky.logger.info("Pairing mode enabled")
            return {"success": True}
        except Exception as e:
            decky.logger.error(f"Error enabling pairing: {e}")
            return {"success": False, "error": str(e)}

    async def disable_pairing(self) -> dict:
        """Disable pairing mode on the dongle"""
        try:
            pairing_paths = glob.glob("/sys/bus/usb/drivers/xone-dongle/*/pairing")
            if not pairing_paths:
                return {"success": False, "error": "No dongle found"}

            for path in pairing_paths:
                with open(path, "w") as f:
                    f.write("0")

            decky.logger.info("Pairing mode disabled")
            return {"success": True}
        except Exception as e:
            decky.logger.error(f"Error disabling pairing: {e}")
            return {"success": False, "error": str(e)}

    # =========================================================================
    # Installation Methods
    # =========================================================================

    async def install_drivers(self) -> dict:
        """Install xone and xpad-noone drivers"""
        try:
            decky.logger.info("Starting driver installation...")

            # Get plugin directory for scripts
            plugin_dir = os.environ.get(
                "DECKY_PLUGIN_DIR", os.path.dirname(os.path.abspath(__file__))
            )
            install_script = os.path.join(
                plugin_dir, "defaults", "scripts", "install.sh"
            )

            if not os.path.exists(install_script):
                return {"success": False, "error": "Install script not found"}

            # Run install script with clean environment
            result = subprocess.run(
                ["bash", install_script],
                capture_output=True,
                text=True,
                timeout=600,  # 10 minute timeout
                env=get_clean_env(),
            )

            # Check for reboot required (exit code 100)
            if result.returncode == 100 or "REBOOT_REQUIRED" in result.stdout:
                decky.logger.info("Kernel upgraded, reboot required")
                return {
                    "success": False,
                    "reboot_required": True,
                    "message": "Kernel has been upgraded to match headers. Please reboot and try again.",
                    "output": result.stdout,
                }

            if result.returncode != 0:
                decky.logger.error(f"Install failed: {result.stderr}")
                return {
                    "success": False,
                    "error": result.stderr or "Installation failed",
                    "output": result.stdout,
                }

            # Save kernel version after successful install
            await self._save_kernel_version()

            decky.logger.info("Driver installation completed successfully")
            return {"success": True, "output": result.stdout}

        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Installation timed out (10 minutes)"}
        except Exception as e:
            decky.logger.error(f"Error during installation: {e}")
            return {"success": False, "error": str(e)}

    async def uninstall_drivers(self) -> dict:
        """Uninstall xone and xpad-noone drivers"""
        try:
            decky.logger.info("Starting driver uninstallation...")

            # Get plugin directory for scripts
            plugin_dir = os.environ.get(
                "DECKY_PLUGIN_DIR", os.path.dirname(os.path.abspath(__file__))
            )
            uninstall_script = os.path.join(
                plugin_dir, "defaults", "scripts", "uninstall.sh"
            )

            if not os.path.exists(uninstall_script):
                return {"success": False, "error": "Uninstall script not found"}

            # Run uninstall script with clean environment
            result = subprocess.run(
                ["bash", uninstall_script],
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                env=get_clean_env(),
            )

            if result.returncode != 0:
                decky.logger.error(f"Uninstall failed: {result.stderr}")
                return {
                    "success": False,
                    "error": result.stderr or "Uninstallation failed",
                    "output": result.stdout,
                }

            # Clear saved kernel version
            settings_dir = os.environ.get("DECKY_PLUGIN_SETTINGS_DIR", "/tmp")
            kernel_file = os.path.join(settings_dir, "installed_kernel_version")
            if os.path.exists(kernel_file):
                os.remove(kernel_file)

            decky.logger.info("Driver uninstallation completed successfully")
            return {"success": True, "output": result.stdout}

        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Uninstallation timed out (5 minutes)"}
        except Exception as e:
            decky.logger.error(f"Error during uninstallation: {e}")
            return {"success": False, "error": str(e)}
