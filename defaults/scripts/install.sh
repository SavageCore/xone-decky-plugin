#!/bin/bash
# Xone Driver Installation Script for Steam Deck
# Adapted from https://github.com/SavageCore/xone-steam-deck-installer
# This script runs as root via Decky Loader

set -e

# Configuration
XONE_LOCAL_REPO="/home/deck/repos/xone"
XPAD_NOONE_LOCAL_REPO="/home/deck/repos/xpad-noone"
XONE_REMOTE_REPO="https://github.com/dlundqvist/xone"
XPAD_NOONE_REMOTE_REPO="https://github.com/forkymcforkface/xpad-noone"
XPAD_NOONE_VERSION="1.0"

REQUIRED_PACKAGES=("curl" "wget" "git" "gcc" "cabextract" "dkms" "libisl" "libmpc" "plymouth")

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo "[INFO] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

# Check for kernel header mismatch and attempt auto-fix
# Returns: 0 if fixed (reboot needed), 1 if no mismatch, 2 if fix failed
check_kernel_header_mismatch() {
    local dkms_output="$1"
    
    # Check if the error message indicates missing kernel headers
    if echo "$dkms_output" | grep -q "Your kernel headers for kernel .* cannot be found"; then
        log_error "Kernel headers mismatch detected!"
        log_info "Your running kernel does not match the installed kernel headers."
        log_info "This is a known issue on SteamOS after system updates."
        
        # Get the linux-neptune package name
        local linux_pkg
        linux_pkg=$(pacman -Qsq linux-neptune 2>/dev/null | grep -E "^linux-neptune-[0-9]+$" | tail -n 1 || echo "")
        
        if [ -n "$linux_pkg" ]; then
            log_info "Attempting to upgrade kernel package: $linux_pkg"
            
            if pacman -S "$linux_pkg" --noconfirm >/dev/null 2>&1; then
                log_info "Kernel package upgraded successfully!"
                echo "KERNEL_UPGRADED"
                return 0  # Fixed, reboot needed
            else
                log_error "Failed to upgrade kernel package"
                echo "KERNEL_UPGRADE_FAILED"
                return 2  # Fix failed
            fi
        else
            log_error "Could not determine kernel package name"
            echo "KERNEL_PACKAGE_UNKNOWN"
            return 2  # Fix failed
        fi
    fi
    
    return 1  # No mismatch detected
}

# Check and save steamos-readonly state
ORIGINAL_READONLY_STATE="unknown"
check_readonly_state() {
    ORIGINAL_READONLY_STATE=$(steamos-readonly status 2>/dev/null || echo "unknown")
    log_info "Original steamos-readonly state: $ORIGINAL_READONLY_STATE"
}

# Disable steamos-readonly if enabled
disable_readonly() {
    if [ "$ORIGINAL_READONLY_STATE" = "enabled" ]; then
        log_info "Disabling steamos-readonly..."
        steamos-readonly disable
    fi
}

# Restore steamos-readonly to original state
restore_readonly() {
    if [ "$ORIGINAL_READONLY_STATE" = "enabled" ]; then
        log_info "Re-enabling steamos-readonly..."
        steamos-readonly enable
    else
        log_info "Leaving steamos-readonly in current state (was: $ORIGINAL_READONLY_STATE)"
    fi
}

# Initialize pacman keyring if needed
init_pacman() {
    if ! pacman-key --list-keys >/dev/null 2>&1; then
        log_info "Initializing pacman keyring..."
        pacman-key --init
    fi
    
    log_info "Refreshing pacman keys..."
    pacman-key --populate archlinux holo >/dev/null 2>&1 || true
}

# Install linux headers for current kernel
install_linux_headers() {
    log_info "Checking for linux headers..."
    
    local linux_pkg
    linux_pkg=$(pacman -Qsq linux-neptune 2>/dev/null | grep -E "^linux-neptune-[0-9]+$" | tail -n 1 || echo "")
    
    if [ -z "$linux_pkg" ]; then
        log_error "Could not determine linux-neptune package"
        return 1
    fi
    
    local kernel_headers="${linux_pkg}-headers"
    log_info "Using kernel headers package: $kernel_headers"
    
    # Check if already installed and up to date
    if pacman -Qs "$kernel_headers" >/dev/null 2>&1 && ! pacman -Qu "$kernel_headers" >/dev/null 2>&1; then
        log_info "Kernel headers already installed and up to date"
        return 0
    fi
    
    log_info "Installing kernel headers..."
    pacman -Sy "$kernel_headers" --noconfirm >/dev/null
}

# Install required packages
install_packages() {
    log_info "Checking required packages..."
    
    local packages_to_install=()
    
    for package in "${REQUIRED_PACKAGES[@]}"; do
        if ! pacman -Qs "^${package}$" >/dev/null 2>&1; then
            packages_to_install+=("$package")
        fi
    done
    
    # Check base-devel group
    local base_devel_packages
    base_devel_packages=$(pacman -Sg base-devel 2>/dev/null | cut -d ' ' -f 2)
    for package in $base_devel_packages; do
        if ! pacman -Qs "^${package}$" >/dev/null 2>&1; then
            packages_to_install+=("$package")
        fi
    done
    
    if [ ${#packages_to_install[@]} -gt 0 ]; then
        log_info "Installing packages: ${packages_to_install[*]}"
        pacman -S "${packages_to_install[@]}" --noconfirm >/dev/null
    else
        log_info "All required packages already installed"
    fi
}

# Rename fakeroot.conf to avoid build errors
fix_fakeroot_conf() {
    if [ -f /etc/ld.so.conf.d/fakeroot.conf ]; then
        log_info "Renaming fakeroot.conf..."
        mv /etc/ld.so.conf.d/fakeroot.conf /etc/ld.so.conf.d/fakeroot.conf.bck
    fi
}

# Clone or update xone repo
setup_xone_repo() {
    log_info "Setting up xone repository..."
    
    if [ -d "$XONE_LOCAL_REPO" ]; then
        cd "$XONE_LOCAL_REPO"
        
        # Check if using correct remote
        local current_remote
        current_remote=$(git remote get-url origin 2>/dev/null || echo "")
        
        if [ "$current_remote" != "$XONE_REMOTE_REPO" ]; then
            log_info "Switching to correct xone fork..."
            cd /home/deck/repos
            rm -rf "$XONE_LOCAL_REPO"
            git clone "$XONE_REMOTE_REPO" "$XONE_LOCAL_REPO"
        else
            # Update existing repo
            log_info "Updating xone repository..."
            git reset --hard >/dev/null 2>&1
            git pull >/dev/null 2>&1 || true
        fi
    else
        # Clone new
        log_info "Cloning xone repository..."
        mkdir -p /home/deck/repos
        git clone "$XONE_REMOTE_REPO" "$XONE_LOCAL_REPO"
    fi
}

# Clone or update xpad-noone repo
setup_xpad_noone_repo() {
    log_info "Setting up xpad-noone repository..."
    
    if [ -d "$XPAD_NOONE_LOCAL_REPO" ]; then
        cd "$XPAD_NOONE_LOCAL_REPO"
        
        # Check if using old medusalix repo
        local current_remote
        current_remote=$(git remote get-url origin 2>/dev/null || echo "")
        
        if [ "$current_remote" = "https://github.com/medusalix/xpad-noone" ]; then
            log_info "Switching to forkymcforkface fork..."
            # Uninstall old driver first
            modprobe -r xpad-noone 2>/dev/null || true
            if dkms status xpad-noone >/dev/null 2>&1; then
                dkms remove -m xpad-noone -v "$XPAD_NOONE_VERSION" --all 2>/dev/null || true
                rm -rf "/usr/src/xpad-noone-$XPAD_NOONE_VERSION"
            fi
            cd /home/deck/repos
            rm -rf "$XPAD_NOONE_LOCAL_REPO"
            rm -f /etc/modules-load.d/xpad-noone.conf
            git clone "$XPAD_NOONE_REMOTE_REPO" "$XPAD_NOONE_LOCAL_REPO"
        else
            # Update existing repo
            log_info "Updating xpad-noone repository..."
            git reset --hard >/dev/null 2>&1
            git pull >/dev/null 2>&1 || true
        fi
    else
        # Clone new
        log_info "Cloning xpad-noone repository..."
        mkdir -p /home/deck/repos
        git clone "$XPAD_NOONE_REMOTE_REPO" "$XPAD_NOONE_LOCAL_REPO"
    fi
}

# Install xone driver
install_xone() {
    if dkms status xone 2>/dev/null | grep -q "installed"; then
        log_info "xone driver already installed"
        return 0
    fi
    
    log_info "Installing xone driver..."
    cd "$XONE_LOCAL_REPO"
    
    # Run the install script and capture output to check for errors
    local install_output
    install_output=$(./install.sh --release 2>&1) || true
    local install_exit_code=$?
    
    # Check for kernel header mismatch error
    if echo "$install_output" | grep -q "Your kernel headers for kernel .* cannot be found"; then
        check_kernel_header_mismatch "$install_output"
        local mismatch_result=$?
        if [ $mismatch_result -eq 0 ]; then
            echo "REBOOT_REQUIRED"
            return 100  # Special code for reboot needed
        elif [ $mismatch_result -eq 2 ]; then
            log_error "xone installation failed - kernel header mismatch could not be fixed"
            echo "$install_output"
            return 1
        fi
    fi
    
    # Check if installation failed for other reasons
    if [ $install_exit_code -ne 0 ]; then
        log_error "xone installation failed with exit code $install_exit_code"
        echo "$install_output"
        return 1
    fi
    
    log_info "Downloading xone firmware..."
    ./install/firmware.sh --skip-disclaimer
}

# Install xpad-noone driver
install_xpad_noone() {
    if dkms status xpad-noone 2>/dev/null | grep -q "installed"; then
        log_info "xpad-noone driver already installed"
        return 0
    fi
    
    log_info "Installing xpad-noone driver..."
    
    modprobe -r xpad-noone 2>/dev/null || true
    cp -r "$XPAD_NOONE_LOCAL_REPO" "/usr/src/xpad-noone-$XPAD_NOONE_VERSION"
    
    # Run dkms install and capture output to check for errors
    local dkms_output
    dkms_output=$(dkms install -m xpad-noone -v "$XPAD_NOONE_VERSION" 2>&1) || true
    local dkms_exit_code=$?
    
    # Check for kernel header mismatch error
    if echo "$dkms_output" | grep -q "Your kernel headers for kernel .* cannot be found"; then
        check_kernel_header_mismatch "$dkms_output"
        local mismatch_result=$?
        if [ $mismatch_result -eq 0 ]; then
            echo "REBOOT_REQUIRED"
            return 100  # Special code for reboot needed
        elif [ $mismatch_result -eq 2 ]; then
            log_error "xpad-noone installation failed - kernel header mismatch could not be fixed"
            echo "$dkms_output"
            return 1
        fi
    fi
    
    # Check if installation failed for other reasons
    if [ $dkms_exit_code -ne 0 ]; then
        log_error "xpad-noone installation failed with exit code $dkms_exit_code"
        echo "$dkms_output"
        return 1
    fi
}

# Load kernel modules
load_modules() {
    log_info "Loading kernel modules..."
    
    # Load xone_dongle
    if ! lsmod | grep -q xone_dongle; then
        modprobe xone_dongle || log_error "Failed to load xone_dongle module"
        
        # Set up autoload
        echo "xone-dongle" > /etc/modules-load.d/xone-dongle.conf
    fi
    
    # Load xpad-noone
    if ! lsmod | grep -q xpad_noone; then
        modprobe xpad-noone || log_error "Failed to load xpad-noone module"
        
        # Set up autoload
        echo "xpad-noone" > /etc/modules-load.d/xpad-noone.conf
    fi
    
    # Remove conflicting xpad.conf if exists
    if [ -f /etc/modules-load.d/xpad.conf ]; then
        rm /etc/modules-load.d/xpad.conf
    fi
}

# ============================================================================
# Main Installation
# ============================================================================

main() {
    log_info "Starting xone driver installation..."
    
    # Save and disable readonly filesystem
    check_readonly_state
    disable_readonly
    
    # Set up trap to restore readonly on exit
    trap restore_readonly EXIT
    
    # Initialize pacman
    init_pacman
    
    # Fix fakeroot issue
    fix_fakeroot_conf
    
    # Install dependencies
    install_linux_headers
    install_packages
    
    # Set up repositories
    setup_xone_repo
    setup_xpad_noone_repo
    
    # Install drivers
    install_xone
    local xone_result=$?
    if [ $xone_result -eq 100 ]; then
        log_info "Kernel upgraded, reboot required"
        echo "REBOOT_REQUIRED"
        exit 100
    elif [ $xone_result -ne 0 ]; then
        log_error "xone installation failed"
        exit 1
    fi
    
    install_xpad_noone
    local xpad_result=$?
    if [ $xpad_result -eq 100 ]; then
        log_info "Kernel upgraded, reboot required"
        echo "REBOOT_REQUIRED"
        exit 100
    elif [ $xpad_result -ne 0 ]; then
        log_error "xpad-noone installation failed"
        exit 1
    fi
    
    # Load modules
    load_modules
    
    log_info "Installation completed successfully!"
}

main "$@"
