# TFS Extension Installation Script
# Save as: install-tfs-extension.ps1

param(
    [string]$ExtensionPath = ".\tfs-checkout-1.4.0.vsix"
)

Write-Host "Installing TFS Checkout Extension..." -ForegroundColor Green

try {
    # Check if VS Code is installed
    $vscodePath = Get-Command code -ErrorAction SilentlyContinue
    if (-not $vscodePath) {
        throw "VS Code not found in PATH"
    }

    # Install the extension
    & code --install-extension $ExtensionPath --force
    
    Write-Host "✅ TFS Checkout Extension installed successfully!" -ForegroundColor Green
    Write-Host "📋 Available commands:" -ForegroundColor Yellow
    Write-Host "  - Ctrl+Alt+O: Checkout current file" -ForegroundColor White
    Write-Host "  - Ctrl+Alt+P: Show pending changes" -ForegroundColor White
    Write-Host "  - Ctrl+Alt+S: Show file status" -ForegroundColor White
    Write-Host "  - Ctrl+Shift+Alt+O: Checkout all open files" -ForegroundColor White
    Write-Host "  - Ctrl+Alt+Shift+B: Build solution" -ForegroundColor White
    Write-Host ""
    Write-Host "🎯 Use Command Palette (Ctrl+Shift+P) and type 'TFS' to see all commands" -ForegroundColor Cyan
    
}
catch {
    Write-Host "❌ Installation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
