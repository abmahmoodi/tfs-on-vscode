# - **TFS Sidebar** - Dedicated sidebar panel showing pending changes (similar to Git Source Control)

    - Click any file to view diff instantly
    - Inline **Diff** button (📄) to view changes
    - Inline **Undo** button (🗑️) to revert changes
    - Right-click context menu for additional actionsFS Checkou### 🔍 \*\*TFS Ch### 🔍 **TFS Changes View (Colorized)**

- **TFS Sidebar** - Dedicated sidebar panel showing pending changes (similar to Git Source Control)
- **Show Pending Changes** (`Ctrl+Alt+P`) - View all workspace changes with color coding in output panel
- **Interactive Pending Changes** (`Ctrl+Shift+Alt+P`) - Quick Pick menu for instant file diff access
- **Show File Status** (`Ctrl+Alt+S`) - Check individual file TFS status
- **Show Change Details** - View file diffs in VS Code's built-in diff viewer or colorized output
- **Undo Changes** - Revert files to TFS version with confirmationView (Int| Command | Keyboard Shortcut | Description |

| ------------------------------------- | --------------------- | -------------------------------------- |
| TFS: Checkout This File | `Ctrl+Alt+O` | Get latest + checkout active file |
| TFS: Get Latest Version | `Ctrl+Alt+G` | Get latest version of active file |
| TFS: Checkout All Open Files | `Ctrl+Shift+Alt+O` | Get latest + checkout all open files |
| TFS: Build .NET Solution | `Ctrl+Alt+Shift+B` | Build solution |
| TFS: Show Pending Changes | `Ctrl+Alt+P` | View all pending changes (output) |
| TFS: Show Pending Changes with Actions| `Ctrl+Shift+Alt+P` | Interactive pending changes with diffs|
| TFS: Show File Status | `Ctrl+Alt+S` | Check file status |
| TFS: Show Change Details | - | View file diff |
| TFS: Undo Changes | - | Revert file changes | Colorized)\*\*

- **Show Pending Changes** (`Ctrl+Alt+P`) - View all workspace changes with color coding
- **Show Pending Changes with Actions** (`Ctrl+Shift+Alt+P`) - Interactive view with clickable file selection for diffs
- **Show File Status** (`Ctrl+Alt+S`) - Check individual file TFS status
- **Show Change Details** - View file diffs in VS Code's built-in diff viewer or colorized output
- **Undo Changes** - Revert files to TFS version with confirmationnsion

Enhanced TFS (Team Foundation Server) integration for Visual Studio Code with get latest + checkout commands, auto-checkout functionality, and colorized change viewing.

## ✨ Features

### 🔒 **TFS Get Latest + Checkout Commands**

- **Checkout Current File** (`Ctrl+Alt+O`) - Get latest version then checkout the currently active file
- **Get Latest Version** (`Ctrl+Alt+G`) - Get the latest version of the current file from TFS
- **Checkout All Open Files** (`Ctrl+Shift+Alt+O`) - Get latest then checkout all files open in editor tabs
- **Auto-checkout** - Automatically get latest then checkout C# (.cs) and resource (.resx) files on first edit

### 🔍 **TFS Changes View (Colorized)**

- **Show Pending Changes** (`Ctrl+Alt+P`) - View all workspace changes with color coding
- **Show File Status** (`Ctrl+Alt+S`) - Check individual file TFS status
- **Show Change Details** - View file diffs in VS Code's built-in diff viewer or colorized output
- **Undo Changes** - Revert files to TFS version with confirmation

### 🛠️ **Build Integration**

- **Build .NET Solution** (`Ctrl+Alt+Shift+B`) - Build the workspace solution

## 🎨 Color Coding

- ✏️ **Edit** - Modified files
- ➕ **Add** - New files
- 🗑️ **Delete** - Deleted files
- 🔄 **Rename** - Renamed files
- ✅ **Up to Date** - No changes
- ➕ **Added lines** in diff
- ➖ **Removed lines** in diff
- 🔍 **Section headers** in diff

## 📋 Commands

| Command                      | Keyboard Shortcut  | Description                          |
| ---------------------------- | ------------------ | ------------------------------------ |
| TFS: Checkout This File      | `Ctrl+Alt+O`       | Get latest + checkout active file    |
| TFS: Get Latest Version      | `Ctrl+Alt+G`       | Get latest version of active file    |
| TFS: Checkout All Open Files | `Ctrl+Shift+Alt+O` | Get latest + checkout all open files |
| TFS: Build .NET Solution     | `Ctrl+Alt+Shift+B` | Build solution                       |
| TFS: Show Pending Changes    | `Ctrl+Alt+P`       | View all pending changes             |
| TFS: Show File Status        | `Ctrl+Alt+S`       | Check file status                    |
| TFS: Show Change Details     | -                  | View file diff                       |
| TFS: Undo Changes            | -                  | Revert file changes                  |

## 🚀 Usage

### Quick Access Methods:

1. **TFS Sidebar** - Click the TFS icon in the Activity Bar to see all pending changes in a tree view
2. **Keyboard Shortcuts** - Direct hotkeys for common operations
3. **Command Palette** (`Ctrl+Shift+P`) - Type "TFS" to see all commands
4. **Context Menu** - Right-click files in Explorer for TFS operations

### Auto-Checkout:

The extension automatically attempts to get the latest version and then checkout `.cs` and `.resx` files when you make your first edit, ensuring you're always working with the most recent version and streamlining the development workflow.

## ⚙️ Requirements

- Visual Studio Code 1.60.0 or higher
- Team Foundation Server command-line tools (`tf` command available in PATH)
- Active TFS workspace

## 🔧 Installation

1. Download the `.vsix` file
2. In VS Code: `Ctrl+Shift+P` → "Extensions: Install from VSIX..."
3. Select the downloaded `.vsix` file
4. Reload VS Code

## 📝 Release Notes

### 1.7.2

- **FIXED**: Resolved error with undo button in TFS sidebar tree view
- **FIXED**: Proper handling of VS Code tree item objects in command parameters
- **IMPROVED**: Enhanced error handling for tree view button commands

### 1.7.1

- **NEW**: Undo button for each file in TFS sidebar tree view
- **NEW**: Inline undo action (🗑️ icon) next to each pending file
- **NEW**: Right-click context menu in tree view with undo option
- **ENHANCED**: Auto-refresh tree view after undoing changes
- **IMPROVED**: Better file management workflow directly from sidebar

### 1.7.0

- **NEW**: Dedicated TFS Sidebar - Activity Bar icon with pending changes tree view (similar to Git Source Control)
- **NEW**: Click any file in TFS sidebar to view diff instantly
- **NEW**: Refresh button in sidebar to update pending changes
- **NEW**: Tree view shows file icons based on change type (edit, add, delete, rename)
- **ENHANCED**: Sidebar integrates with existing diff functionality
- **IMPROVED**: Better VS Code integration with dedicated TFS workspace area

### 1.6.0

- **NEW**: Interactive Pending Changes - New "Show Pending Changes with Actions" command (`Ctrl+Shift+Alt+P`)
- **NEW**: Quick Pick interface for pending files with instant diff access
- **NEW**: Click any file from pending changes list to view diff immediately
- **ENHANCED**: Two viewing modes - traditional output panel or interactive quick pick
- **IMPROVED**: Better file path parsing and display for pending changes
- **IMPROVED**: Streamlined workflow - from pending changes to diff in one click

### 1.5.0

- **NEW**: Auto get latest before checkout - All checkout operations now automatically get the latest version first
- **NEW**: Dedicated "Get Latest Version" command (`Ctrl+Alt+G`)
- **ENHANCED**: Auto-checkout now gets latest version before checking out files
- **ENHANCED**: Checkout all open files now gets latest versions for all files
- **IMPROVED**: Better progress reporting for get latest + checkout operations
- **IMPROVED**: Enhanced status messages showing both get latest and checkout results

### 1.4.0

- Added colorized diff output
- Enhanced VS Code built-in diff viewer integration
- Improved status indicators with emoji
- Better error handling and user feedback

### 1.3.0

- Added TFS changes viewing functionality
- Context menu integration
- Undo changes capability
- File status checking

### 1.2.0

- Auto-checkout on first edit for C# and resource files
- Build solution command
- Improved user feedback

## 🤝 Contributing

This extension is developed for internal use at Alborz. For issues or feature requests, please contact the development team.

## 📄 License

Internal use only - Alborz Development Team
