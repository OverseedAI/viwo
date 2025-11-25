# Installing VIWO

VIWO (Virtualized Isolated Worktree Orchestrator) can be installed in multiple ways depending on your preference.

## Quick Install (Recommended)

### Linux & macOS

Install the latest version with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/OverseedAI/viwo/main/install.sh | bash
```

This will:
- Detect your operating system and architecture
- Download the appropriate binary from GitHub Releases
- Verify the checksum
- Install to `/usr/local/bin` (may require sudo)

**Custom Installation Directory:**

```bash
INSTALL_DIR="$HOME/.local/bin" curl -fsSL https://raw.githubusercontent.com/OverseedAI/viwo/main/install.sh | bash
```

### Windows

Install the latest version using PowerShell (run as user, not administrator):

```powershell
irm https://raw.githubusercontent.com/OverseedAI/viwo/main/install.ps1 | iex
```

This will:
- Download the Windows x64 binary from GitHub Releases
- Verify the checksum
- Install to `%LOCALAPPDATA%\Programs\viwo`
- Add the installation directory to your PATH

**Custom Installation Directory:**

```powershell
irm https://raw.githubusercontent.com/OverseedAI/viwo/main/install.ps1 | iex -InstallDir "C:\custom\path"
```

**Note:**
- You may need to restart your terminal after installation for the PATH changes to take effect.
- ARM64 Windows devices will use the x64 binary via emulation.

## Manual Installation

### Download Pre-built Binaries

Download the appropriate binary for your platform from the [latest release](https://github.com/OverseedAI/viwo/releases/latest):

- **Linux (x64)**: `viwo-linux-x64`
- **Linux (ARM64)**: `viwo-linux-arm64`
- **macOS (Intel)**: `viwo-macos-x64`
- **macOS (Apple Silicon)**: `viwo-macos-arm64`
- **Windows (x64)**: `viwo-windows-x64.exe`

Then:

```bash
# Download binary (example for macOS ARM64)
curl -LO https://github.com/OverseedAI/viwo/releases/latest/download/viwo-macos-arm64

# Make it executable
chmod +x viwo-macos-arm64

# Move to a directory in your PATH
mv viwo-macos-arm64 /usr/local/bin/viwo

# Verify installation
viwo --version
```

### Verify Checksums

Each binary includes a SHA256 checksum file:

```bash
# Download binary and checksum
curl -LO https://github.com/OverseedAI/viwo/releases/latest/download/viwo-macos-arm64
curl -LO https://github.com/OverseedAI/viwo/releases/latest/download/viwo-macos-arm64.sha256

# Verify
sha256sum -c viwo-macos-arm64.sha256
# or on macOS:
shasum -a 256 -c viwo-macos-arm64.sha256
```

## Platform Support

| Platform | Architecture | Binary Name |
|----------|--------------|-------------|
| Linux | x86_64 | `viwo-linux-x64` |
| Linux | ARM64 | `viwo-linux-arm64` |
| macOS | Intel (x64) | `viwo-macos-x64` |
| macOS | Apple Silicon (ARM64) | `viwo-macos-arm64` |
| Windows | x86_64 | `viwo-windows-x64.exe` |

## System Requirements

- **Docker**: Required for container orchestration
- **Git**: Required for worktree management
- **Disk Space**: ~100MB for the binary

## Uninstall

### Linux & macOS

```bash
rm /usr/local/bin/viwo  # or wherever you installed it
```

### Windows

```powershell
# Remove the binary
Remove-Item "$env:LOCALAPPDATA\Programs\viwo\viwo.exe"

# Remove from PATH (optional)
# Open "Edit environment variables for your account" and remove the viwo directory from PATH
```

## Getting Started

After installation, initialize your first session:

```bash
# Register a repository
viwo register /path/to/your/repo

# Start a session
viwo start

# List sessions
viwo list
```

For more information, see the [main README](./README.md) or run `viwo --help`.