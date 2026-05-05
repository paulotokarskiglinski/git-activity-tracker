import * as vscode from 'vscode';
import { GitExtension, Repository, Commit } from './git';

export interface ActivityCommit extends Commit {
    branchName?: string;
}

export interface RepositoryCommits {
    repositoryName: string;
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

    public async getDailyCommits(): Promise<RepositoryCommits[]> {
        const api = await this.getApi();
        const repositories: Repository[] = api.repositories;
        const result: RepositoryCommits[] = [];

        if (repositories.length === 0) {
            return result;
        }

        // Get global author email to use as fallback
        const firstRepo = repositories[0];
        const globalEmail = await firstRepo.getGlobalConfig('user.email');
        const globalName = await firstRepo.getGlobalConfig('user.name');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const repo of repositories) {
            try {
                // Try to get local config first, fallback to global
                let email = await repo.getConfig('user.email') || globalEmail;
                let name = await repo.getConfig('user.name') || globalName;

                // Log options: we fetch a decent chunk of recent commits and filter
                // Or we can rely on git log arguments
                const commits = await repo.log({ maxEntries: 100 });
                
                const authorCommits = commits.filter(c => {
                    const commitDate = c.authorDate || c.commitDate;
                    if (!commitDate || commitDate < today) {
                        return false;
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
