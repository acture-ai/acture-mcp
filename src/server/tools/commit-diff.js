const { execSync } = require('child_process');
const GhManager = require('../../cli/utils/gh-manager');
const EnvManager = require('../../cli/utils/env-manager');

// Tool definition
const definition = {
  name: 'commit_diff',
  description: 'Get the diff (changes) for a specific commit using GitHub API. Shows file statistics and optionally the full patch.',
  inputSchema: {
    type: 'object',
    properties: {
      commitSha: {
        type: 'string',
        description: 'Commit SHA to get diff for (full or short hash)',
      },
      repo: {
        type: 'string',
        description: 'Repository in "owner/repo" format. Defaults to the configured repository',
        optional: true,
      },
      statOnly: {
        type: 'boolean',
        description: 'Return only file statistics (additions/deletions count) without full diff content',
        optional: true,
      },
    },
    required: ['commitSha'],
  },
};

// Helper function to execute gh CLI commands
function execGh(args, ghPath, githubToken) {
  const env = { ...process.env, GH_TOKEN: githubToken };
  
  const result = execSync(`"${ghPath}" ${args}`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
    timeout: 30000,
  });
  
  return result.trim();
}

// Tool handler
async function handler(args) {
  try {
    const { commitSha, repo, statOnly = false } = args || {};
    
    if (!commitSha) {
      throw new Error('Commit SHA is required');
    }

    console.error(`[commit_diff] Getting diff for commit ${commitSha}`);

    const envManager = new EnvManager();
    const config = envManager.loadConfig();
    
    if (!config?.githubToken) {
      throw new Error('GitHub token not configured. Run "acture-mcp init" first.');
    }
    
    const ghManager = new GhManager(config.githubToken);
    const ghPath = ghManager.getGhPath();
    const githubToken = config.githubToken;

    const targetRepo = repo || config?.repository;
    if (!targetRepo || !targetRepo.includes('/')) {
      throw new Error('Repository required in owner/repo format');
    }
    
    const [owner, repoName] = targetRepo.split('/');

    // Get commit info from GitHub API
    const commitJson = execGh(
      `api repos/${owner}/${repoName}/commits/${commitSha}`,
      ghPath,
      githubToken
    );
    
    const commit = JSON.parse(commitJson);
    const fullSha = commit.sha;
    const isMerge = commit.parents && commit.parents.length > 1;
    const parentCount = commit.parents ? commit.parents.length : 0;

    // Get file stats
    const fileStats = (commit.files || []).map(file => ({
      path: file.filename,
      status: file.status, // added, removed, modified, renamed
      changes: file.changes,
      additions: file.additions,
      deletions: file.deletions,
      patch: statOnly ? undefined : file.patch,
    }));

    const totalAdditions = fileStats.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = fileStats.reduce((sum, f) => sum + f.deletions, 0);

    const result = {
      commitSha: fullSha.substring(0, 7),
      fullSha: fullSha,
      message: commit.commit.message.split('\n')[0],
      fullMessage: commit.commit.message,
      author: commit.commit.author.name,
      authorEmail: commit.commit.author.email,
      authorLogin: commit.author?.login || null,
      date: commit.commit.author.date,
      url: commit.html_url,
      isMerge,
      parentCount,
      stats: {
        filesChanged: fileStats.length,
        additions: totalAdditions,
        deletions: totalDeletions,
        fileStats: statOnly ? fileStats.map(f => ({
          path: f.path,
          status: f.status,
          changes: f.changes,
          additions: f.additions,
          deletions: f.deletions,
        })) : undefined,
      },
      files: statOnly ? undefined : fileStats,
    };

    // Remove undefined fields
    if (statOnly) {
      delete result.files;
    } else {
      delete result.stats.fileStats;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error.stderr?.toString().includes('404') || error.message?.includes('404')) {
      return {
        content: [
          {
            type: 'text',
            text: `Commit "${args?.commitSha}" not found in repository.`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: `Error in commit_diff tool: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

module.exports = {
  definition,
  handler,
};
