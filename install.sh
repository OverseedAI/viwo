#!/bin/bash
set -e

# VIWO installer script
# Usage: curl -fsSL https://raw.githubusercontent.com/OverseedAI/viwo/main/install.sh | bash

REPO="OverseedAI/viwo"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="viwo"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}==>${NC} $1"
}

warn() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

error() {
    echo -e "${RED}Error:${NC} $1"
    exit 1
}

# Detect OS and architecture
detect_platform() {
    local os=""
    local arch=""

    # Detect OS
    case "$(uname -s)" in
        Linux*)     os="linux" ;;
        Darwin*)    os="macos" ;;
        MINGW*|MSYS*|CYGWIN*) os="windows" ;;
        *)          error "Unsupported operating system: $(uname -s)" ;;
    esac

    # Detect architecture
    case "$(uname -m)" in
        x86_64|amd64)   arch="x64" ;;
        aarch64|arm64)  arch="arm64" ;;
        *)              error "Unsupported architecture: $(uname -m)" ;;
    esac

    PLATFORM="${os}-${arch}"

    # Set binary extension for Windows
    if [ "$os" = "windows" ]; then
        BINARY_EXT=".exe"
    else
        BINARY_EXT=""
    fi

    info "Detected platform: ${PLATFORM}"
}

# Get latest release version
get_latest_version() {
    info "Fetching latest release version..."

    local latest_url="https://api.github.com/repos/${REPO}/releases/latest"
    VERSION=$(curl -fsSL "$latest_url" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

    if [ -z "$VERSION" ]; then
        error "Failed to fetch latest version"
    fi

    info "Latest version: ${VERSION}"
}

# Download binary
download_binary() {
    local binary_name="viwo-${PLATFORM}${BINARY_EXT}"
    local download_url="https://github.com/${REPO}/releases/download/${VERSION}/${binary_name}"
    local checksum_url="${download_url}.sha256"
    local tmp_dir=$(mktemp -d)
    local tmp_binary="${tmp_dir}/${binary_name}"
    local tmp_checksum="${tmp_dir}/${binary_name}.sha256"

    info "Downloading VIWO ${VERSION} for ${PLATFORM}..."

    # Download binary
    if ! curl -fsSL -o "$tmp_binary" "$download_url"; then
        error "Failed to download binary from ${download_url}"
    fi

    # Download checksum
    if ! curl -fsSL -o "$tmp_checksum" "$checksum_url"; then
        warn "Failed to download checksum, skipping verification"
    else
        info "Verifying checksum..."

        # Verify checksum
        cd "$tmp_dir"
        if command -v sha256sum >/dev/null 2>&1; then
            if ! sha256sum -c "${binary_name}.sha256" >/dev/null 2>&1; then
                error "Checksum verification failed"
            fi
        elif command -v shasum >/dev/null 2>&1; then
            if ! shasum -a 256 -c "${binary_name}.sha256" >/dev/null 2>&1; then
                error "Checksum verification failed"
            fi
        else
            warn "No checksum utility found, skipping verification"
        fi
        cd - >/dev/null

        info "Checksum verified successfully"
    fi

    DOWNLOADED_BINARY="$tmp_binary"
}

# Install binary
install_binary() {
    info "Installing VIWO to ${INSTALL_DIR}..."

    # Check if install directory exists
    if [ ! -d "$INSTALL_DIR" ]; then
        error "Install directory ${INSTALL_DIR} does not exist"
    fi

    # Check if we have write permissions
    if [ ! -w "$INSTALL_DIR" ]; then
        if command -v sudo >/dev/null 2>&1; then
            warn "Installing to ${INSTALL_DIR} requires sudo privileges"
            sudo install -m 755 "$DOWNLOADED_BINARY" "${INSTALL_DIR}/${BINARY_NAME}"
        else
            error "No write permission to ${INSTALL_DIR} and sudo not available"
        fi
    else
        install -m 755 "$DOWNLOADED_BINARY" "${INSTALL_DIR}/${BINARY_NAME}"
    fi

    # Verify installation
    if ! command -v "$BINARY_NAME" >/dev/null 2>&1; then
        warn "VIWO installed but not found in PATH. Add ${INSTALL_DIR} to your PATH."
    fi

    info "VIWO ${VERSION} installed successfully!"
}

# Cleanup
cleanup() {
    if [ -n "$DOWNLOADED_BINARY" ]; then
        rm -rf "$(dirname "$DOWNLOADED_BINARY")"
    fi
}

# Main installation process
main() {
    trap cleanup EXIT

    echo ""
    echo "╦  ╦╦╦ ╦╔═╗"
    echo "╚╗╔╝║║║║║ ║"
    echo " ╚╝ ╩╚╩╝╚═╝"
    echo ""
    echo "AI-powered development environment orchestrator"
    echo ""

    detect_platform
    get_latest_version
    download_binary
    install_binary

    echo ""
    info "Installation complete! Here are your next steps:"
    echo ""
    echo "  1. Register your Anthropic API key:"
    echo "     ${BINARY_NAME} auth"
    echo ""
    echo "     Get your API key from: https://console.anthropic.com/settings/keys"
    echo ""
    echo "  2. Register a repository:"
    echo "     cd /path/to/your/repo"
    echo "     ${BINARY_NAME} register"
    echo ""
    echo "  3. Start a new session:"
    echo "     ${BINARY_NAME} start"
    echo ""
    echo "  For more information, run: ${BINARY_NAME} --help"
    echo ""
}

main