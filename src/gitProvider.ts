import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GitExtension, Repository, Commit } from './git';

export interface ActivityCommit extends Commit {
  branchName?: string;
}

export interface RepositoryCommits {
  repositoryName: string;
  repositoryPath: string;
  commits: ActivityCommit[];
}

export class GitProvider {
  private gitApi: any;

  constructor() {
    this.gitApi = null;
  }

  private async getApi() {
    if (this.gitApi) {
      return this.gitApi;
    }
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
    if (!gitExtension) {
      throw new Error('Git extension not found');
    }
    this.gitApi = gitExtension.getAPI(1);
    return this.gitApi;
  }

  public async getDailyCommits(daysAgo: number = 0): Promise<RepositoryCommits[]> {
    const api = await this.getApi();
    const watchedDirs = vscode.workspace.getConfiguration('gitActivityTracker').get<string[]>('watchedDirectories') || [];
    const apiRepositories: Repository[] = [...api.repositories];

    const repoPathsToOpen: string[] = [];

    for (const dir of watchedDirs) {
      try {
        if (!fs.existsSync(dir)) {
          continue;
        }

        // If the directory itself is a git repo, add it and skip looking deeper
        if (fs.existsSync(path.join(dir, '.git'))) {
          repoPathsToOpen.push(dir);
          continue;
        }

        // Otherwise, scan depth=1 for subdirectories containing a .git folder
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subDir = path.join(dir, entry.name);
            if (fs.existsSync(path.join(subDir, '.git'))) {
              repoPathsToOpen.push(subDir);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to scan watched directory: ${dir}`, err);
      }
    }

    for (const repoPath of repoPathsToOpen) {
      try {
        const uri = vscode.Uri.file(repoPath);
        // Check if already tracked to avoid duplicates
        if (!apiRepositories.some(r => r.rootUri.fsPath.toLowerCase() === uri.fsPath.toLowerCase())) {
          const repo = await api.openRepository(uri);
          if (repo) {
            apiRepositories.push(repo);
          }
        }
      } catch (err) {
        console.error(`Failed to open repository: ${repoPath}`, err);
      }
    }

    const result: RepositoryCommits[] = [];

    if (apiRepositories.length === 0) {
      return result;
    }

    // Get global author email to use as fallback
    const firstRepo = apiRepositories[0];
    const globalEmail = await firstRepo.getGlobalConfig('user.email');
    const globalName = await firstRepo.getGlobalConfig('user.name');

    const targetDate = new Date();
    targetDate.setHours(0, 0, 0, 0);
    targetDate.setDate(targetDate.getDate() - daysAgo);

    const customAuthorName = vscode.workspace.getConfiguration('gitActivityTracker').get<string>('authorName');

    for (const repo of apiRepositories) {
      try {
        // Try to get local config first, fallback to global
        let email = await repo.getConfig('user.email') || globalEmail;
        let name = customAuthorName || await repo.getConfig('user.name') || globalName;

        // Increase limit to 500 to catch older commits for longer timeframes
        const commits = await repo.log({ maxEntries: 500 });

        const authorCommits = commits.filter(c => {
          const commitDate = c.authorDate || c.commitDate;
          if (!commitDate || commitDate < targetDate) {
            return false;
          }
          if (daysAgo === 1) {
            // If specifically "Yesterday", exclude today's commits
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (commitDate >= today) {
              return false;
            }
          }
          // Filter by author name or email
          const isAuthor = (email && c.authorEmail === email) || (name && c.authorName === name);
          return isAuthor;
        });

        const enhancedCommits: ActivityCommit[] = [];
        for (const c of authorCommits) {
          let branchName = repo.state.HEAD?.name || 'unknown';
          try {
            const branches = await repo.getBranches({ contains: c.hash });
            if (branches.length > 0) {
              branchName = branches.find(b => b.name)?.name || branchName;
            }
          } catch (e) {
            // ignore and use fallback
          }
          enhancedCommits.push({ ...c, branchName });
        }

        if (enhancedCommits.length > 0) {
          const repoName = repo.rootUri.path.split('/').pop() || 'Unknown Repository';
          result.push({
            repositoryName: repoName,
            repositoryPath: repo.rootUri.fsPath,
            commits: enhancedCommits
          });
        }
      } catch (err) {
        console.error(`Error fetching commits for repo:`, err);
      }
    }

    return result;
  }
}
