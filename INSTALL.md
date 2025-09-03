# TFS Checkout Extension

## Quick Install

### Method 1: Download VSIX

1. Download `tfs-checkout-1.4.0.vsix` from releases
2. In VS Code: `Ctrl+Shift+P` → "Extensions: Install from VSIX..."
3. Select the downloaded file

### Method 2: PowerShell Script

```powershell
.\install-tfs-extension.ps1
```

### Method 3: Command Line

```bash
code --install-extension tfs-checkout-1.4.0.vsix
```

## Team Distribution

### For Team Leads:

1. Copy `tfs-checkout-1.4.0.vsix` to shared network drive
2. Send installation instructions to team
3. Optionally: Add to your team's extension recommendations

### Add to Workspace Recommendations:

Add to `.vscode/extensions.json`:

```json
{
    "recommendations": ["alborz-team.tfs-checkout"]
}
```

## Build from Source

```bash
npm install -g @vscode/vsce
cd path/to/extension
vsce package
```
