#!/bin/bash
# Xone Driver Uninstallation Script for Steam Deck
# This script runs as root via Decky Loader

set -e

# Configuration
XONE_LOCAL_REPO="/home/deck/repos/xone"
XPAD_NOONE_LOCAL_REPO="/home/deck/repos/xpad-noone"
XPAD_NOONE_VERSION="1.0"

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo "[INFO] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
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

# Uninstall xone driver
uninstall_xone() {
    log_info "Uninstalling xone driver..."
    
    # Unload modules
    local modules
    modules=$(lsmod | grep '^xone' | cut -d ' ' -f 1 | tr '\n' ' ')
    if [ -n "$modules" ]; then
        log_info "Unloading xone modules: $modules"
        modprobe -r -a $modules 2>/dev/null || true
    fi
    
    # Remove via DKMS
    if dkms status xone >/dev/null 2>&1 && [ -n "$(dkms status xone)" ]; then
        log_info "Removing xone from DKMS..."
        
        # Get installed version
        local version
        version=$(dkms status xone 2>/dev/null | head -1 | grep -oP '\d+\.\d+\.\d+' || echo "")
        
        if [ -n "$version" ]; then
            dkms remove -m xone -v "$version" --all 2>/dev/null || true
            rm -rf "/usr/src/xone-$version" 2>/dev/null || true
        fi
    fi
    
    # Run uninstall script if available
    if [ -d "$XONE_LOCAL_REPO" ] && [ -f "$XONE_LOCAL_REPO/uninstall.sh" ]; then
        log_info "Running xone uninstall script..."
        cd "$XONE_LOCAL_REPO"
        ./uninstall.sh 2>/dev/null || true
    fi
    
    # Remove autoload config
    rm -f /etc/modules-load.d/xone-dongle.conf
    
    log_info "xone driver uninstalled"
}

# Uninstall xpad-noone driver
uninstall_xpad_noone() {
    log_info "Uninstalling xpad-noone driver..."
    
    # Unload module
    if lsmod | grep -q xpad_noone; then
        log_info "Unloading xpad-noone module..."
        modprobe -r xpad-noone 2>/dev/null || true
    fi
    
    # Remove via DKMS
    if dkms status xpad-noone >/dev/null 2>&1 && [ -n "$(dkms status xpad-noone)" ]; then
        log_info "Removing xpad-noone from DKMS..."
        dkms remove -m xpad-noone -v "$XPAD_NOONE_VERSION" --all 2>/dev/null || true
        rm -rf "/usr/src/xpad-noone-$XPAD_NOONE_VERSION" 2>/dev/null || true
    fi
    
    # Remove autoload config
    rm -f /etc/modules-load.d/xpad-noone.conf
    
    log_info "xpad-noone driver uninstalled"
}

# Clean up repositories (optional)
cleanup_repos() {
    log_info "Cleaning up repository directories..."
    
    if [ -d "$XONE_LOCAL_REPO" ]; then
        rm -rf "$XONE_LOCAL_REPO"
        log_info "Removed xone repository"
    fi
    
    if [ -d "$XPAD_NOONE_LOCAL_REPO" ]; then
        rm -rf "$XPAD_NOONE_LOCAL_REPO"
        log_info "Removed xpad-noone repository"
    fi
    
    # Remove parent dir if empty
    rmdir /home/deck/repos 2>/dev/null || true
}

# ============================================================================
# Main Uninstallation
# ============================================================================

main() {
    log_info "Starting xone driver uninstallation..."
    
    # Save and disable readonly filesystem
    check_readonly_state
    disable_readonly
    
    # Set up trap to restore readonly on exit
    trap restore_readonly EXIT
    
    # Uninstall drivers
    uninstall_xone
    uninstall_xpad_noone
    
    # Clean up repos
    cleanup_repos
    
    log_info "Uninstallation completed successfully!"
}

main "$@"
