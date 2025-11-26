# Installing VIWO

VIWO (Virtualized Isolated Worktree Orchestrator) can be installed in multiple ways depending on your preference.



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


## Getting Started

