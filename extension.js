const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * TFS Pending Changes Tree Data Provider
 */
class TfsPendingChangesProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.pendingFiles = [];
    }

    refresh() {
        this._loadPendingChanges();
    }

    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = element.tooltip;
        treeItem.description = element.description;
        treeItem.contextValue = 'pendingFile';
        treeItem.iconPath = new vscode.ThemeIcon(element.icon);
        treeItem.command = {
            command: 'tfsCheckout.openFileChange',
            title: 'Open Change',
            arguments: [element.filePath]
        };
        return treeItem;
    }

    getChildren(element) {
        if (!element) {
            return Promise.resolve(this.pendingFiles);
        }
        return Promise.resolve([]);
    }

    async _loadPendingChanges() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            this.pendingFiles = [];
            this._onDidChangeTreeData.fire();
            return;
        }

        return new Promise((resolve) => {
            const command = 'tf status /recursive /format:detailed';
            const rootPath = workspaceFolder.uri.fsPath;

            exec(command, { cwd: rootPath }, (error, stdout, stderr) => {
                this.pendingFiles = [];

                if (error) {
                    if (!stderr.includes('No pending changes') && !stdout.includes('No pending changes')) {
                        console.error('TFS Status error:', error.message);
                    }
                    this._onDidChangeTreeData.fire();
                    resolve();
                    return;
                }

                // Parse the output to extract files
                const lines = stdout.split('\n').filter(line => line.trim());

                // Parse detailed format output
                let currentFile = null;
                let currentChange = null;

                for (const line of lines) {
                    const trimmedLine = line.trim();

                    // Check if this is a file path line (starts with $/ or full path)
                    if (trimmedLine.startsWith('$/') || trimmedLine.match(/^[A-Z]:\\/)) {
                        // Extract file path (remove changeset info if present)
                        currentFile = trimmedLine.split(';')[0];
                        currentChange = null; // Reset change type
                    }
                    // Check if this is a change type line
                    else if (trimmedLine.startsWith('Change     :')) {
                        currentChange = trimmedLine.replace('Change     :', '').trim();
                    }
                    // Check if this is a local item line (contains the actual local path)
                    else if (trimmedLine.startsWith('Local item :') && currentFile && currentChange) {
                        // Extract the local path
                        const localPathMatch = trimmedLine.match(/Local item\s*:\s*(?:\[.*?\]\s*)?(.+)$/);
                        if (localPathMatch) {
                            const localPath = localPathMatch[1].trim();
                            const fileName = path.basename(localPath);
                            const relativePath = path.relative(rootPath, localPath);

                            // Determine icon based on change type
                            let iconName = '';
                            let changeType = currentChange.toUpperCase();

                            switch (changeType) {
                                case 'EDIT':
                                    iconName = 'edit';
                                    break;
                                case 'ADD':
                                    iconName = 'add';
                                    break;
                                case 'DELETE':
                                    iconName = 'trash';
                                    break;
                                case 'RENAME':
                                    iconName = 'arrow-right';
                                    break;
                                default:
                                    iconName = 'file';
                                    break;
                            }

                            this.pendingFiles.push({
                                label: fileName,
                                description: relativePath,
                                tooltip: `${changeType}: ${localPath}`,
                                filePath: localPath,
                                changeType: changeType,
                                icon: iconName
                            });
                        }
                    }
                }

                this._onDidChangeTreeData.fire();
                resolve();
            });
        });
    }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('TFS Checkout extension is now active!');

    // Create and register TFS Pending Changes tree data provider
    const tfsPendingChangesProvider = new TfsPendingChangesProvider();
    vscode.window.registerTreeDataProvider('tfsPendingChanges', tfsPendingChangesProvider);

    // Register command for refreshing pending changes
    let refreshPendingChanges = vscode.commands.registerCommand('tfsCheckout.refreshPendingChanges', () => {
        tfsPendingChangesProvider.refresh();
    });
    context.subscriptions.push(refreshPendingChanges);

    // Register command for opening file changes
    let openFileChange = vscode.commands.registerCommand('tfsCheckout.openFileChange', async (filePathOrItem) => {
        let filePath;
        if (typeof filePathOrItem === 'string') {
            filePath = filePathOrItem;
        } else if (filePathOrItem && filePathOrItem.filePath) {
            filePath = filePathOrItem.filePath;
        }

        if (filePath) {
            await showTfsChangeDetails(filePath);
        }
    });
    context.subscriptions.push(openFileChange);

    // Register command for undoing file changes from tree view
    let undoFileChange = vscode.commands.registerCommand('tfsCheckout.undoFileChange', async (filePathOrItem) => {
        let filePath;
        if (typeof filePathOrItem === 'string') {
            filePath = filePathOrItem;
        } else if (filePathOrItem && filePathOrItem.filePath) {
            filePath = filePathOrItem.filePath;
        }

        if (filePath) {
            await undoTfsChanges(filePath);
            // Refresh the tree view after undoing changes
            tfsPendingChangesProvider.refresh();
        }
    });
    context.subscriptions.push(undoFileChange);

    // Load pending changes initially
    tfsPendingChangesProvider.refresh();

    // Register command for checking out current file
    let checkoutCurrentFile = vscode.commands.registerCommand('tfsCheckout.checkoutCurrentFile', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active file to checkout');
            return;
        }

        const filePath = activeEditor.document.fileName;
        await checkoutFile(filePath);
    });

    // Register command for checking out all open files
    let checkoutAllOpenFiles = vscode.commands.registerCommand('tfsCheckout.checkoutAllOpenFiles', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const scriptPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'checkout-open-files.ps1');

        if (fs.existsSync(scriptPath)) {
            await runPowerShellScript(scriptPath, workspaceFolder.uri.fsPath);
        } else {
            vscode.window.showErrorMessage('PowerShell script not found: ' + scriptPath);
        }
    });

    context.subscriptions.push(checkoutCurrentFile);
    context.subscriptions.push(checkoutAllOpenFiles);

    // Register command for building the current .NET solution (workspace root)
    let buildSolutionCmd = vscode.commands.registerCommand('tfsCheckout.buildSolution', async () => {
        await buildDotnetSolution();
    });
    context.subscriptions.push(buildSolutionCmd);

    // Register command for showing pending changes
    let showPendingChanges = vscode.commands.registerCommand('tfsCheckout.showPendingChanges', async () => {
        await showTfsPendingChanges();
    });
    context.subscriptions.push(showPendingChanges);

    // Register command for showing file status
    let showFileStatus = vscode.commands.registerCommand('tfsCheckout.showFileStatus', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active file to check status');
            return;
        }
        await showTfsFileStatus(activeEditor.document.fileName);
    });
    context.subscriptions.push(showFileStatus);

    // Register command for showing change details
    let showChangeDetails = vscode.commands.registerCommand('tfsCheckout.showChangeDetails', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active file to show details');
            return;
        }
        await showTfsChangeDetails(activeEditor.document.fileName);
    });
    context.subscriptions.push(showChangeDetails);

    // Register command for undoing changes
    let undoChanges = vscode.commands.registerCommand('tfsCheckout.undoChanges', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active file to undo changes');
            return;
        }
        await undoTfsChanges(activeEditor.document.fileName);
    });
    context.subscriptions.push(undoChanges);

    // Register command for getting latest version of current file
    let getLatestCurrentFile = vscode.commands.registerCommand('tfsCheckout.getLatestCurrentFile', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active file to get latest');
            return;
        }
        await getLatestFileWithProgress(activeEditor.document.fileName);
    });
    context.subscriptions.push(getLatestCurrentFile);

    // Register command for showing diff from pending changes
    let showDiffFromPendingChanges = vscode.commands.registerCommand('tfsCheckout.showDiffFromPendingChanges', async (filePath) => {
        if (filePath && typeof filePath === 'string') {
            await showTfsChangeDetails(filePath);
        } else {
            vscode.window.showWarningMessage('No file path provided for diff');
        }
    });
    context.subscriptions.push(showDiffFromPendingChanges);

    // Register command for interactive pending changes with actions
    let showPendingChangesWithActions = vscode.commands.registerCommand('tfsCheckout.showPendingChangesWithActions', async () => {
        await showInteractivePendingChanges();
    });
    context.subscriptions.push(showPendingChangesWithActions);

    // Auto checkout on first user edit for C# (.cs) or resource (.resx) files
    const autoCheckedOut = new Set();
    const autoCheckoutListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
        try {
            const doc = event.document;
            if (doc.isUntitled) return; // ignore unsaved new files
            const filePath = doc.fileName;
            if (!/\.(cs|resx)$/i.test(filePath)) return; // only target C# & resx
            if (autoCheckedOut.has(filePath)) return; // already attempted
            // Only react to actual content changes (ignore metadata only)
            if (!event.contentChanges || event.contentChanges.length === 0) return;

            // Check if file is writable; if already writable skip (already checked out or not under TFVC)
            fs.access(filePath, fs.constants.W_OK, async (err) => {
                if (!err) {
                    autoCheckedOut.add(filePath);
                    return; // writable, nothing to do
                }
                // Mark early to avoid duplicate concurrent attempts
                autoCheckedOut.add(filePath);
                await checkoutFile(filePath);
            });
        } catch (e) {
            console.warn('Auto checkout error:', e);
        }
    });
    context.subscriptions.push(autoCheckoutListener);
}

let buildInProgress = false;

async function buildDotnetSolution() {
    if (buildInProgress) {
        vscode.window.showWarningMessage('A build is already in progress.');
        return;
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found to build.');
        return;
    }

    const rootPath = workspaceFolder.uri.fsPath;
    const outputChannel = vscode.window.createOutputChannel('TFS Build');
    outputChannel.show(true);
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Starting dotnet build at root: ${rootPath}`);

    buildInProgress = true;
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Building .NET Solution',
            cancellable: false
        }, () => {
            return new Promise((resolve) => {
                const { spawn } = require('child_process');
                const build = spawn('dotnet', ['build'], { cwd: rootPath, shell: true });

                build.stdout.on('data', data => outputChannel.append(data.toString()));
                build.stderr.on('data', data => outputChannel.append(data.toString()));
                build.on('close', code => {
                    if (code === 0) {
                        outputChannel.appendLine('Build succeeded.');
                        vscode.window.showInformationMessage('dotnet build succeeded');
                    } else {
                        outputChannel.appendLine(`Build failed with exit code ${code}.`);
                        vscode.window.showErrorMessage(`dotnet build failed (exit code ${code})`);
                    }
                    resolve();
                });
                build.on('error', err => {
                    outputChannel.appendLine('Failed to start build: ' + err.message);
                    vscode.window.showErrorMessage('Failed to start dotnet build: ' + err.message);
                    resolve();
                });
            });
        });
    } finally {
        buildInProgress = false;
    }
}

async function getLatestFile(filePath) {
    return new Promise((resolve, reject) => {
        const command = `tf get "${filePath}" /recursive`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                // Check if it's just "up to date" message
                if (stderr.includes('up to date') || stdout.includes('up to date') ||
                    stderr.includes('All files are up to date') || stdout.includes('All files are up to date')) {
                    resolve({ success: true, message: 'File is already up to date', isUpToDate: true });
                } else {
                    reject(new Error(`TFS Get Latest failed: ${error.message}`));
                }
            } else {
                // Check if file was actually updated
                const isUpdated = stdout.includes('Getting') || stdout.includes('Replacing');
                resolve({
                    success: true,
                    message: isUpdated ? 'File updated to latest version' : 'File is already up to date',
                    isUpToDate: !isUpdated
                });
            }
        });
    });
}

async function getLatestFileWithProgress(filePath) {
    return new Promise(async (resolve) => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TFS Get Latest",
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: `Getting latest: ${path.basename(filePath)}` });

                const result = await getLatestFile(filePath);

                // If file was updated, reload it in editor if it's currently open
                if (!result.isUpToDate) {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor && activeEditor.document.fileName === filePath) {
                        await vscode.commands.executeCommand('workbench.action.files.revert');
                    }
                }

                vscode.window.showInformationMessage(
                    `${result.message}: ${path.basename(filePath)}`
                );

                resolve();
            } catch (error) {
                vscode.window.showErrorMessage(`TFS Get Latest failed: ${error.message}`);
                resolve();
            }
        });
    });
}

async function checkoutFile(filePath) {
    return new Promise(async (resolve) => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TFS Get Latest & Checkout",
            cancellable: false
        }, async (progress) => {
            try {
                // Step 1: Get latest version first
                progress.report({ message: `Getting latest: ${path.basename(filePath)}` });

                const getLatestResult = await getLatestFile(filePath);

                // If file was updated, reload it in editor if it's currently open
                if (!getLatestResult.isUpToDate) {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor && activeEditor.document.fileName === filePath) {
                        await vscode.commands.executeCommand('workbench.action.files.revert');
                    }
                }

                // Step 2: Now checkout the file
                progress.report({ message: `Checking out: ${path.basename(filePath)}` });

                const command = `tf checkout "${filePath}"`;

                return new Promise((progressResolve) => {
                    exec(command, (error, stdout, stderr) => {
                        if (error) {
                            if (stderr.includes('already checked out') || stdout.includes('already checked out')) {
                                vscode.window.showInformationMessage(
                                    `${getLatestResult.message}. File already checked out: ${path.basename(filePath)}`
                                );
                            } else {
                                vscode.window.showErrorMessage(`TFS Checkout failed: ${error.message}`);
                            }
                        } else {
                            vscode.window.showInformationMessage(
                                `${getLatestResult.message}. Successfully checked out: ${path.basename(filePath)}`
                            );
                        }
                        progressResolve();
                        resolve();
                    });
                });
            } catch (error) {
                vscode.window.showErrorMessage(`TFS operation failed: ${error.message}`);
                resolve();
            }
        });
    });
}

async function runPowerShellScript(scriptPath, workspaceRoot) {
    return new Promise((resolve) => {
        const command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -WorkspaceRoot "${workspaceRoot}"`;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TFS Checkout All Files",
            cancellable: false
        }, (progress) => {
            progress.report({ message: "Running checkout script..." });

            return new Promise((progressResolve) => {
                exec(command, { cwd: workspaceRoot }, (error, stdout, stderr) => {
                    if (error) {
                        vscode.window.showErrorMessage(`TFS Checkout script failed: ${error.message}`);
                    } else {
                        // Show the script output in an information message
                        const outputLines = stdout.split('\n').filter(line => line.trim());
                        const summary = outputLines.slice(-4).join(' | '); // Get last few lines as summary
                        vscode.window.showInformationMessage(`TFS Checkout completed: ${summary}`);

                        // Also show in output channel for detailed view
                        const outputChannel = vscode.window.createOutputChannel('TFS Checkout');
                        outputChannel.clear();
                        outputChannel.appendLine(stdout);
                        if (stderr) outputChannel.appendLine('STDERR: ' + stderr);
                        outputChannel.show(true);
                    }
                    progressResolve();
                    resolve();
                });
            });
        });
    });
}

async function showTfsPendingChanges() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    return new Promise((resolve) => {
        const command = 'tf status /recursive /format:detailed';
        const rootPath = workspaceFolder.uri.fsPath;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TFS Pending Changes",
            cancellable: false
        }, (progress) => {
            progress.report({ message: "Checking for pending changes..." });

            return new Promise((progressResolve) => {
                exec(command, { cwd: rootPath }, (error, stdout, stderr) => {
                    const outputChannel = vscode.window.createOutputChannel('TFS Pending Changes');
                    outputChannel.clear();
                    outputChannel.show(true);

                    if (error) {
                        if (stderr.includes('No pending changes') || stdout.includes('No pending changes')) {
                            outputChannel.appendLine('✅ No pending changes found in the workspace.');
                            vscode.window.showInformationMessage('No pending changes found');
                        } else {
                            outputChannel.appendLine('❌ Error checking pending changes:');
                            outputChannel.appendLine(error.message);
                            if (stderr) outputChannel.appendLine(stderr);
                            vscode.window.showErrorMessage('Failed to check pending changes');
                        }
                    } else {
                        outputChannel.appendLine('📋 TFS Pending Changes:');
                        outputChannel.appendLine('========================');
                        outputChannel.appendLine('');

                        // Parse and display the status output with enhanced formatting
                        const lines = stdout.split('\n').filter(line => line.trim());
                        let changeCount = 0;
                        const pendingFiles = [];

                        // Parse detailed format output
                        let currentFile = null;
                        let currentChange = null;

                        for (const line of lines) {
                            const trimmedLine = line.trim();

                            // Check if this is a file path line (starts with $/ or full path)
                            if (trimmedLine.startsWith('$/') || trimmedLine.match(/^[A-Z]:\\/)) {
                                // Extract file path (remove changeset info if present)
                                currentFile = trimmedLine.split(';')[0];
                                currentChange = null; // Reset change type
                            }
                            // Check if this is a change type line
                            else if (trimmedLine.startsWith('Change     :')) {
                                currentChange = trimmedLine.replace('Change     :', '').trim();
                            }
                            // Check if this is a local item line (contains the actual local path)
                            else if (trimmedLine.startsWith('Local item :') && currentFile && currentChange) {
                                // Extract the local path
                                const localPathMatch = trimmedLine.match(/Local item\s*:\s*(?:\[.*?\]\s*)?(.+)$/);
                                if (localPathMatch) {
                                    const localPath = localPathMatch[1].trim();

                                    // Determine icon based on change type
                                    let icon = '';
                                    let changeType = currentChange.toUpperCase();

                                    switch (changeType) {
                                        case 'EDIT':
                                            icon = '✏️';
                                            break;
                                        case 'ADD':
                                            icon = '➕';
                                            break;
                                        case 'DELETE':
                                            icon = '🗑️';
                                            break;
                                        case 'RENAME':
                                            icon = '🔄';
                                            break;
                                        default:
                                            icon = '📄';
                                            break;
                                    }

                                    changeCount++;

                                    // Store for later use
                                    pendingFiles.push({ path: localPath, type: changeType, icon: icon });

                                    // Create formatted output
                                    const fileName = path.basename(localPath);
                                    const relativeDisplayPath = path.relative(rootPath, localPath);

                                    outputChannel.appendLine(`${icon} ${changeType.padEnd(8)} ${relativeDisplayPath}`);
                                    outputChannel.appendLine(`   File: ${localPath}`);
                                    outputChannel.appendLine('');
                                }
                            }
                        } if (changeCount === 0) {
                            outputChannel.appendLine('✅ No pending changes found.');
                        } else {
                            outputChannel.appendLine('📊 Summary: ' + changeCount + ' pending change(s)');
                            outputChannel.appendLine('');
                            outputChannel.appendLine('💡 Use Command Palette (Ctrl+Shift+P) → "TFS: Show Pending Changes with Actions" for clickable diff links');
                            outputChannel.appendLine('');
                            outputChannel.appendLine('Legend: ✏️ Edit  ➕ Add  🗑️ Delete  🔄 Rename');

                            // Store pending files for the interactive command
                            global.tfsCheckoutPendingFiles = pendingFiles;
                        }

                        vscode.window.showInformationMessage(`Found ${changeCount} pending change(s)`);
                    }
                    progressResolve();
                    resolve();
                });
            });
        });
    });
}

async function showInteractivePendingChanges() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    return new Promise((resolve) => {
        const command = 'tf status /recursive /format:detailed';
        const rootPath = workspaceFolder.uri.fsPath;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TFS Pending Changes",
            cancellable: false
        }, (progress) => {
            progress.report({ message: "Checking for pending changes..." });

            return new Promise((progressResolve) => {
                exec(command, { cwd: rootPath }, async (error, stdout, stderr) => {
                    if (error) {
                        if (stderr.includes('No pending changes') || stdout.includes('No pending changes')) {
                            vscode.window.showInformationMessage('No pending changes found');
                        } else {
                            vscode.window.showErrorMessage('Failed to check pending changes: ' + error.message);
                        }
                        progressResolve();
                        resolve();
                        return;
                    }                    // Parse the output to extract files
                    const lines = stdout.split('\n').filter(line => line.trim());
                    const pendingFiles = [];

                    // Parse detailed format output
                    let currentFile = null;
                    let currentChange = null;

                    for (const line of lines) {
                        const trimmedLine = line.trim();

                        // Check if this is a file path line (starts with $/ or full path)
                        if (trimmedLine.startsWith('$/') || trimmedLine.match(/^[A-Z]:\\/)) {
                            // Extract file path (remove changeset info if present)
                            currentFile = trimmedLine.split(';')[0];
                            currentChange = null; // Reset change type
                        }
                        // Check if this is a change type line
                        else if (trimmedLine.startsWith('Change     :')) {
                            currentChange = trimmedLine.replace('Change     :', '').trim();
                        }
                        // Check if this is a local item line (contains the actual local path)
                        else if (trimmedLine.startsWith('Local item :') && currentFile && currentChange) {
                            // Extract the local path
                            const localPathMatch = trimmedLine.match(/Local item\s*:\s*(?:\[.*?\]\s*)?(.+)$/);
                            if (localPathMatch) {
                                const localPath = localPathMatch[1].trim();

                                // Determine icon based on change type
                                let icon = '';
                                let changeType = currentChange.toUpperCase();

                                switch (changeType) {
                                    case 'EDIT':
                                        icon = '✏️';
                                        break;
                                    case 'ADD':
                                        icon = '➕';
                                        break;
                                    case 'DELETE':
                                        icon = '🗑️';
                                        break;
                                    case 'RENAME':
                                        icon = '🔄';
                                        break;
                                    default:
                                        icon = '📄';
                                        break;
                                }


                                pendingFiles.push({
                                    path: localPath,
                                    type: changeType,
                                    icon: icon,
                                    displayName: `${icon} ${changeType}: ${path.basename(localPath)}`
                                });
                            }
                        }
                    } console.log('Interactive TFS Status - Total pending files found:', pendingFiles.length);

                    if (pendingFiles.length === 0) {
                        vscode.window.showInformationMessage('No pending changes found');
                        progressResolve();
                        resolve();
                        return;
                    }                    // Show quick pick with file options
                    const quickPickItems = pendingFiles.map(file => ({
                        label: file.displayName,
                        description: path.relative(rootPath, file.path),
                        detail: `Click to view diff with TFS version`,
                        filePath: file.path
                    }));

                    quickPickItems.unshift({
                        label: '📋 Show All Pending Changes (Output Panel)',
                        description: 'View detailed list in output panel',
                        detail: 'Traditional view with all changes listed',
                        filePath: null
                    });

                    vscode.window.showQuickPick(quickPickItems, {
                        placeHolder: `Select a file to view diff (${pendingFiles.length} pending changes)`,
                        canPickMany: false,
                        ignoreFocusOut: true
                    }).then(async (selected) => {
                        if (selected) {
                            if (selected.filePath) {
                                // Show diff for selected file
                                await showTfsChangeDetails(selected.filePath);
                            } else {
                                // Show all pending changes in output panel
                                await showTfsPendingChanges();
                            }
                        }
                    });

                    progressResolve();
                    resolve();
                });
            });
        });
    });
}

async function showTfsFileStatus(filePath) {
    return new Promise((resolve) => {
        const command = `tf status "${filePath}"`;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TFS File Status",
            cancellable: false
        }, (progress) => {
            progress.report({ message: `Checking status: ${path.basename(filePath)}` });

            return new Promise((progressResolve) => {
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        if (stderr.includes('No pending changes') || stdout.includes('No pending changes')) {
                            vscode.window.showInformationMessage(`File is up to date: ${path.basename(filePath)}`);
                        } else {
                            vscode.window.showErrorMessage(`TFS Status failed: ${error.message}`);
                        }
                    } else {
                        const outputChannel = vscode.window.createOutputChannel('TFS File Status');
                        outputChannel.clear();
                        outputChannel.appendLine(`📄 File Status for: ${filePath}`);
                        outputChannel.appendLine('================================');
                        outputChannel.appendLine('');

                        // Parse and colorize the status
                        const lines = stdout.split('\n').filter(line => line.trim());
                        let statusIcon = '📄';
                        let statusText = 'Unknown';

                        for (const line of lines) {
                            if (line.includes('edit') || line.includes('Edit')) {
                                statusIcon = '✏️';
                                statusText = 'EDITED';
                                outputChannel.appendLine(`${statusIcon} Status: ${statusText}`);
                                outputChannel.appendLine(`📝 ${line.trim()}`);
                            } else if (line.includes('add') || line.includes('Add')) {
                                statusIcon = '➕';
                                statusText = 'ADDED';
                                outputChannel.appendLine(`${statusIcon} Status: ${statusText}`);
                                outputChannel.appendLine(`📝 ${line.trim()}`);
                            } else if (line.includes('delete') || line.includes('Delete')) {
                                statusIcon = '🗑️';
                                statusText = 'DELETED';
                                outputChannel.appendLine(`${statusIcon} Status: ${statusText}`);
                                outputChannel.appendLine(`📝 ${line.trim()}`);
                            } else if (line.includes('rename') || line.includes('Rename')) {
                                statusIcon = '🔄';
                                statusText = 'RENAMED';
                                outputChannel.appendLine(`${statusIcon} Status: ${statusText}`);
                                outputChannel.appendLine(`📝 ${line.trim()}`);
                            } else if (line.trim() && !line.includes('===')) {
                                outputChannel.appendLine(`📋 ${line}`);
                            }
                        }

                        if (statusText === 'Unknown') {
                            statusIcon = '✅';
                            statusText = 'UP TO DATE';
                            outputChannel.appendLine(`${statusIcon} Status: ${statusText}`);
                        }

                        outputChannel.show(true);
                        vscode.window.showInformationMessage(`${statusIcon} File status: ${statusText} - ${path.basename(filePath)}`);
                    }
                    progressResolve();
                    resolve();
                });
            });
        });
    });
}

async function showTfsChangeDetails(filePath) {
    return new Promise((resolve) => {
        const command = `tf diff "${filePath}"`;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TFS Change Details",
            cancellable: false
        }, (progress) => {
            progress.report({ message: `Getting changes: ${path.basename(filePath)}` });

            return new Promise((progressResolve) => {
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        if (stderr.includes('No differences') || stdout.includes('No differences')) {
                            vscode.window.showInformationMessage(`No changes in: ${path.basename(filePath)}`);
                        } else {
                            vscode.window.showErrorMessage('Failed to get change details');
                        }
                        progressResolve();
                        resolve();
                        return;
                    }

                    // Try to open diff in VS Code's built-in diff viewer
                    showColorizedDiff(filePath, stdout)
                        .then(() => {
                            vscode.window.showInformationMessage(`Diff opened for: ${path.basename(filePath)}`);
                        })
                        .catch(() => {
                            // Fallback to colorized output channel
                            showColorizedOutput(stdout, filePath);
                            vscode.window.showInformationMessage(`Change details shown for: ${path.basename(filePath)}`);
                        });

                    progressResolve();
                    resolve();
                });
            });
        });
    });
}

async function showColorizedDiff(filePath, diffOutput) {
    try {
        // Create temporary files for diff comparison
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) throw new Error('No workspace');

        const tempDir = path.join(workspaceFolder.uri.fsPath, '.vscode', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Get TFS version of the file
        const tfsVersionPath = path.join(tempDir, `${path.basename(filePath)}.tfs`);

        return new Promise((resolve, reject) => {
            const getTfsCommand = `tf view "${filePath}" /version:T`;
            exec(getTfsCommand, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                // Write TFS version to temp file
                fs.writeFileSync(tfsVersionPath, stdout);

                // Open VS Code's built-in diff viewer
                const tfsUri = vscode.Uri.file(tfsVersionPath);
                const currentUri = vscode.Uri.file(filePath);
                const title = `${path.basename(filePath)} (TFS ↔ Working)`;

                vscode.commands.executeCommand('vscode.diff', tfsUri, currentUri, title)
                    .then(() => {
                        resolve();
                        // Clean up temp file after a delay
                        setTimeout(() => {
                            try {
                                if (fs.existsSync(tfsVersionPath)) {
                                    fs.unlinkSync(tfsVersionPath);
                                }
                            } catch (e) {
                                console.warn('Failed to clean up temp file:', e);
                            }
                        }, 5000);
                    })
                    .catch(reject);
            });
        });
    } catch (e) {
        throw e;
    }
}

function showColorizedOutput(diffOutput, filePath) {
    const outputChannel = vscode.window.createOutputChannel('TFS Change Details');
    outputChannel.clear();
    outputChannel.show(true);

    // Add header
    outputChannel.appendLine(`Change Details for: ${filePath}`);
    outputChannel.appendLine('=====================================');
    outputChannel.appendLine('');

    // Parse and colorize the diff output
    const lines = diffOutput.split('\n');
    let inDiffSection = false;

    for (const line of lines) {
        if (line.startsWith('@@') || line.includes('@@')) {
            // Diff section header
            outputChannel.appendLine(`🔍 ${line}`);
            inDiffSection = true;
        } else if (line.startsWith('+') && inDiffSection) {
            // Added lines
            outputChannel.appendLine(`➕ ${line.substring(1)}`);
        } else if (line.startsWith('-') && inDiffSection) {
            // Removed lines
            outputChannel.appendLine(`➖ ${line.substring(1)}`);
        } else if (line.startsWith(' ') && inDiffSection) {
            // Context lines
            outputChannel.appendLine(`   ${line.substring(1)}`);
        } else if (line.trim() === '') {
            outputChannel.appendLine('');
        } else {
            // Other diff information
            if (line.includes('===') || line.includes('---') || line.includes('+++')) {
                outputChannel.appendLine(`📄 ${line}`);
            } else {
                outputChannel.appendLine(line);
            }
        }
    }

    outputChannel.appendLine('');
    outputChannel.appendLine('Legend: ➕ Added  ➖ Removed  🔍 Section  📄 File Info');
}

async function undoTfsChanges(filePath) {
    // Show confirmation dialog
    const result = await vscode.window.showWarningMessage(
        `Are you sure you want to undo all changes to ${path.basename(filePath)}? This cannot be undone.`,
        { modal: true },
        'Yes, Undo Changes'
    );

    if (result !== 'Yes, Undo Changes') {
        return;
    }

    return new Promise((resolve) => {
        const command = `tf undo "${filePath}"`;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TFS Undo Changes",
            cancellable: false
        }, (progress) => {
            progress.report({ message: `Undoing changes: ${path.basename(filePath)}` });

            return new Promise((progressResolve) => {
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        if (stderr.includes('No pending changes') || stdout.includes('No pending changes')) {
                            vscode.window.showInformationMessage(`No changes to undo: ${path.basename(filePath)}`);
                        } else {
                            vscode.window.showErrorMessage(`TFS Undo failed: ${error.message}`);
                        }
                    } else {
                        vscode.window.showInformationMessage(`Successfully undone changes: ${path.basename(filePath)}`);

                        // Reload the file if it's open in editor
                        const activeEditor = vscode.window.activeTextEditor;
                        if (activeEditor && activeEditor.document.fileName === filePath) {
                            vscode.commands.executeCommand('workbench.action.files.revert');
                        }
                    }
                    progressResolve();
                    resolve();
                });
            });
        });
    });
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
