# TFS Checkout Extension

Enhanced TFS (Team Foundation Server) integration for Visual Studio Code with checkout commands, auto-checkout functionality, and colorized change viewing.

## ✨ Features

### 🔒 **TFS Checkout Commands**

-   **Checkout Current File** (`Ctrl+Alt+O`) - Checkout the currently active file
-   **Checkout All Open Files** (`Ctrl+Shift+Alt+O`) - Checkout all files open in editor tabs
-   **Auto-checkout** - Automatically checkout C# (.cs) and resource (.resx) files on first edit

### 🔍 **TFS Changes View (Colorized)**

-   **Show Pending Changes** (`Ctrl+Alt+P`) - View all workspace changes with color coding
-   **Show File Status** (`Ctrl+Alt+S`) - Check individual file TFS status
-   **Show Change Details** - View file diffs in VS Code's built-in diff viewer or colorized output
-   **Undo Changes** - Revert files to TFS version with confirmation

### 🛠️ **Build Integration**

-   **Build .NET Solution** (`Ctrl+Alt+Shift+B`) - Build the workspace solution

## 🎨 Color Coding

-   ✏️ **Edit** - Modified files
-   ➕ **Add** - New files
-   🗑️ **Delete** - Deleted files
-   🔄 **Rename** - Renamed files
-   ✅ **Up to Date** - No changes
-   ➕ **Added lines** in diff
-   ➖ **Removed lines** in diff
-   🔍 **Section headers** in diff

## 📋 Commands

| Command                      | Keyboard Shortcut  | Description              |
| ---------------------------- | ------------------ | ------------------------ |
| TFS: Checkout This File      | `Ctrl+Alt+O`       | Checkout active file     |
| TFS: Checkout All Open Files | `Ctrl+Shift+Alt+O` | Checkout all open files  |
| TFS: Build .NET Solution     | `Ctrl+Alt+Shift+B` | Build solution           |
| TFS: Show Pending Changes    | `Ctrl+Alt+P`       | View all pending changes |
| TFS: Show File Status        | `Ctrl+Alt+S`       | Check file status        |
| TFS: Show Change Details     | -                  | View file diff           |
| TFS: Undo Changes            | -                  | Revert file changes      |

## 🚀 Usage

### Quick Access Methods:

1. **Keyboard Shortcuts** - Direct hotkeys for common operations
2. **Command Palette** (`Ctrl+Shift+P`) - Type "TFS" to see all commands
3. **Context Menu** - Right-click files in Explorer for TFS operations

### Auto-Checkout:

The extension automatically attempts to checkout `.cs` and `.resx` files when you make your first edit, streamlining the development workflow.

## ⚙️ Requirements

-   Visual Studio Code 1.60.0 or higher
-   Team Foundation Server command-line tools (`tf` command available in PATH)
-   Active TFS workspace

## 🔧 Installation

1. Download the `.vsix` file
2. In VS Code: `Ctrl+Shift+P` → "Extensions: Install from VSIX..."
3. Select the downloaded `.vsix` file
4. Reload VS Code

## 📝 Release Notes

### 1.4.0

-   Added colorized diff output
-   Enhanced VS Code built-in diff viewer integration
-   Improved status indicators with emoji
-   Better error handling and user feedback

### 1.3.0

-   Added TFS changes viewing functionality
-   Context menu integration
-   Undo changes capability
-   File status checking

### 1.2.0

-   Auto-checkout on first edit for C# and resource files
-   Build solution command
-   Improved user feedback

## 🤝 Contributing

This extension is developed for internal use at Alborz. For issues or feature requests, please contact the development team.

## 📄 License

Internal use only - Alborz Development Team
