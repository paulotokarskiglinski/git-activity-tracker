# Git Activity Tracker

A VS Code extension designed to automatically track your Git commits across all active workspace repositories and generate a Markdown report.

## Features

- Scans all active Git repositories in your current VS Code workspace.
- Define a list of "Watched Directories" in your VS Code Settings to always scan specific projects, even when they aren't open!
- Retrieves all commits made today by you (using your local or global git config).
- Determines the specific branch for each commit.
- Generates a local `git-activity-report.md` file in your `~/.git-activity-tracker` folder.
- Perfect for copying and pasting into your daily standup or timesheet!

## Extension Settings

This extension contributes the following settings:

* `gitActivityTracker.watchedDirectories`: An array of absolute folder paths to Git repositories. These will always be checked for daily activity.

## Usage

1. Open a workspace with at least one Git repository.
2. Open the VS Code Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
3. Run **`Git Activity: Generate Activity Report`**.

---
*Created as a productivity tool for developers managing multiple codebases.*

## License

MIT
