const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('TFS Checkout extension is now active!');

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

async function checkoutFile(filePath) {
    return new Promise((resolve) => {
        const command = `tf checkout "${filePath}"`;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "TFS Checkout",
            cancellable: false
        }, (progress) => {
            progress.report({ message: `Checking out: ${path.basename(filePath)}` });

            return new Promise((progressResolve) => {
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        if (stderr.includes('already checked out') || stdout.includes('already checked out')) {
                            vscode.window.showInformationMessage(`File already checked out: ${path.basename(filePath)}`);
                        } else {
                            vscode.window.showErrorMessage(`TFS Checkout failed: ${error.message}`);
                        }
                    } else {
                        vscode.window.showInformationMessage(`Successfully checked out: ${path.basename(filePath)}`);
                    }
                    progressResolve();
                    resolve();
                });
            });
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

                        // Parse and colorize the status output
                        const lines = stdout.split('\n').filter(line => line.trim());
                        let changeCount = 0;

                        for (const line of lines) {
                            if (line.includes('edit') || line.includes('Edit')) {
                                outputChannel.appendLine(`✏️  EDIT    ${line.replace(/edit|Edit/i, '').trim()}`);
                                changeCount++;
                            } else if (line.includes('add') || line.includes('Add')) {
                                outputChannel.appendLine(`➕ ADD     ${line.replace(/add|Add/i, '').trim()}`);
                                changeCount++;
                            } else if (line.includes('delete') || line.includes('Delete')) {
                                outputChannel.appendLine(`🗑️  DELETE  ${line.replace(/delete|Delete/i, '').trim()}`);
                                changeCount++;
                            } else if (line.includes('rename') || line.includes('Rename')) {
                                outputChannel.appendLine(`🔄 RENAME  ${line.replace(/rename|Rename/i, '').trim()}`);
                                changeCount++;
                            } else if (line.trim() && !line.includes('===')) {
                                outputChannel.appendLine(`📄 ${line}`);
                            }
                        }

                        if (changeCount === 0) {
                            outputChannel.appendLine('✅ No pending changes found.');
                        } else {
                            outputChannel.appendLine('');
                            outputChannel.appendLine(`📊 Summary: ${changeCount} pending change(s)`);
                            outputChannel.appendLine('');
                            outputChannel.appendLine('Legend: ✏️ Edit  ➕ Add  🗑️ Delete  🔄 Rename');
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
