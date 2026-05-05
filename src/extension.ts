import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { GitProvider } from './gitProvider';
import { ReportGenerator } from './reportGenerator';

export function activate(context: vscode.ExtensionContext) {
    console.log('Git Activity Tracker is now active!');

    const disposable = vscode.commands.registerCommand('git-activity-tracker.generateReport', async () => {
        try {
            vscode.window.showInformationMessage('Fetching Git activity...');
            
            const gitProvider = new GitProvider();
            const repos = await gitProvider.getDailyCommits();
            
            const markdown = ReportGenerator.generateMarkdown(repos);
            
            // Define global save path
            const homeDir = os.homedir();
            const trackerDir = path.join(homeDir, '.git-activity-tracker');
            
            if (!fs.existsSync(trackerDir)) {
                fs.mkdirSync(trackerDir, { recursive: true });
            }
            
            const reportPath = path.join(trackerDir, 'daily-report.md');
            fs.writeFileSync(reportPath, markdown, 'utf8');
            
            // Open the file in VS Code
            const doc = await vscode.workspace.openTextDocument(reportPath);
            await vscode.window.showTextDocument(doc);
            
            vscode.window.showInformationMessage('Git Activity Report generated successfully!');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to generate report: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
