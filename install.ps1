# VIWO PowerShell installer script
# Usage: irm https://raw.githubusercontent.com/OverseedAI/viwo/main/install.ps1 | iex

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\viwo"
)

$ErrorActionPreference = 'Stop'

$Repo = "OverseedAI/viwo"
$BinaryName = "viwo.exe"

# Colors
function Write-Info {
    param([string]$Message)
    Write-Host "==> $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "Warning: $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "Error: $Message" -ForegroundColor Red
    exit 1
}

# Detect architecture
function Get-Platform {
    $arch = $env:PROCESSOR_ARCHITECTURE

    switch ($arch) {
        "AMD64" { return "windows-x64" }
        "ARM64" {
            Write-Warn "ARM64 detected. Only x64 binary is available. Attempting to use x64 binary (should work via emulation)."
            return "windows-x64"
        }
        default { Write-ErrorMsg "Unsupported architecture: $arch" }
    }
}

# Get latest release version
function Get-LatestVersion {
    Write-Info "Fetching latest release version..."

    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
        $version = $response.tag_name

        if ([string]::IsNullOrEmpty($version)) {
            Write-ErrorMsg "Failed to fetch latest version"
        }

        Write-Info "Latest version: $version"
        return $version
    }
    catch {
        Write-ErrorMsg "Failed to fetch latest version: $_"
    }
}

# Download binary
function Download-Binary {
    param(
        [string]$Platform,
        [string]$Version
    )

    $binaryName = "viwo-$Platform.exe"
    $downloadUrl = "https://github.com/$Repo/releases/download/$Version/$binaryName"
    $checksumUrl = "$downloadUrl.sha256"

    $tempDir = [System.IO.Path]::GetTempPath()
    $tempBinary = Join-Path $tempDir $binaryName
    $tempChecksum = Join-Path $tempDir "$binaryName.sha256"

    Write-Info "Downloading VIWO $Version for $Platform..."

    try {
        # Download binary
        Invoke-WebRequest -Uri $downloadUrl -OutFile $tempBinary

        # Download checksum
        try {
            Invoke-WebRequest -Uri $checksumUrl -OutFile $tempChecksum

            Write-Info "Verifying checksum..."

            # Read expected checksum
            $expectedChecksum = (Get-Content $tempChecksum -Raw).Split(' ')[0].Trim()

            # Calculate actual checksum
            $actualChecksum = (Get-FileHash -Path $tempBinary -Algorithm SHA256).Hash.ToLower()

            if ($expectedChecksum -ne $actualChecksum) {
                Write-ErrorMsg "Checksum verification failed"
            }

            Write-Info "Checksum verified successfully"
        }
        catch {
            Write-Warn "Failed to download or verify checksum, skipping verification"
        }

        return $tempBinary
    }
    catch {
        Write-ErrorMsg "Failed to download binary: $_"
    }
}

# Install binary
function Install-Binary {
    param(
        [string]$SourcePath,
        [string]$InstallDir
    )

    Write-Info "Installing VIWO to $InstallDir..."

    # Create install directory if it doesn't exist
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    $destinationPath = Join-Path $InstallDir $BinaryName

    # Copy binary
    Copy-Item -Path $SourcePath -Destination $destinationPath -Force

    # Add to PATH if not already there
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$InstallDir*") {
        Write-Info "Adding $InstallDir to PATH..."
        [Environment]::SetEnvironmentVariable(
            "Path",
            "$userPath;$InstallDir",
            "User"
        )
        Write-Warn "PATH updated. Please restart your terminal for changes to take effect."
    }

    Write-Info "VIWO installed successfully!"
}

# Cleanup
function Remove-TempFiles {
    param([string]$TempBinary)

    if (Test-Path $TempBinary) {
        Remove-Item $TempBinary -Force -ErrorAction SilentlyContinue
    }

    $tempChecksum = "$TempBinary.sha256"
    if (Test-Path $tempChecksum) {
        Remove-Item $tempChecksum -Force -ErrorAction SilentlyContinue
    }
}

# Main installation process
function Main {
    Write-Host ""
    Write-Host "╦  ╦╦╦ ╦╔═╗" -ForegroundColor Cyan
    Write-Host "╚╗╔╝║║║║║ ║" -ForegroundColor Cyan
    Write-Host " ╚╝ ╩╚╩╝╚═╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "AI-powered development environment orchestrator" -ForegroundColor Gray
    Write-Host ""

    $platform = Get-Platform
    Write-Info "Detected platform: $platform"

    $version = Get-LatestVersion
    $tempBinary = Download-Binary -Platform $platform -Version $version

    try {
        Install-Binary -SourcePath $tempBinary -InstallDir $InstallDir

        Write-Host ""
        Write-Info "Installation complete! Here are your next steps:"
        Write-Host ""
        Write-Host "  1. Register your Anthropic API key:" -ForegroundColor White
        Write-Host "     viwo auth" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "     Get your API key from: https://console.anthropic.com/settings/keys" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  2. Register a repository:" -ForegroundColor White
        Write-Host "     cd C:\path\to\your\repo" -ForegroundColor Cyan
        Write-Host "     viwo register" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  3. Start a new session:" -ForegroundColor White
        Write-Host "     viwo start" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  For more information, run: viwo --help" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Note: If 'viwo' is not recognized, restart your terminal." -ForegroundColor Yellow
        Write-Host ""
    }
    finally {
        Remove-TempFiles -TempBinary $tempBinary
    }
}

Main