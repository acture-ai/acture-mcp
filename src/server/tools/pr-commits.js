const { execSync } = require('child_process');
const GhManager = require('../../cli/utils/gh-manager');
const EnvManager = require('../../cli/utils/env-manager');

// Tool definition
const definition = {
  name: 'pr_commits',
  description: 'Get all commits from a pull request with essential metadata (sha, message, author, date). Uses GitHub CLI.',
  inputSchema: {
    type: 'object',
    properties: {
      prNumber: {
        type: 'number',
        description: 'Pull request number to get commits for',
      },
      repo: {
        type: 'string',
        description: 'Repository in "owner/repo" format. Defaults to the configured repository',
        optional: true,
      },
    },
    required: ['prNumber'],
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
    const { prNumber, repo } = args || {};
    
    if (!prNumber || prNumber < 1) {
      throw new Error('PR number is required');
    }

    console.error(`[pr_commits] Getting commits for PR #${prNumber}`);

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

    // Get commits from PR using GitHub API
    const commitsJson = execGh(
      `api repos/${owner}/${repoName}/pulls/${prNumber}/commits --paginate`,
      ghPath,
      githubToken
    );
    
    const commits = JSON.parse(commitsJson);
    
    if (!commits || commits.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No commits found for PR #${prNumber} in ${targetRepo}.`,
          },
        ],
      };
    }

    // Get PR info for context
    let prInfo = null;
    try {
      const prJson = execGh(
        `api repos/${owner}/${repoName}/pulls/${prNumber}`,
        ghPath,
        githubToken
      );
      prInfo = JSON.parse(prJson);
    } catch (e) {
      // PR info not critical
    }

    // Format commits with essential metadata
    const result = {
      prNumber,
      repository: targetRepo,
      prTitle: prInfo?.title || null,
      prState: prInfo?.state || null,
      prMerged: prInfo?.merged || false,
      totalCommits: commits.length,
      commits: commits.map(commit => ({
        sha: commit.sha,
        shortSha: commit.sha.substring(0, 7),
        message: commit.commit.message.split('\n')[0], // First line only
        fullMessage: commit.commit.message,
        author: commit.commit.author.name,
        authorEmail: commit.commit.author.email,
        authorLogin: commit.author?.login || null,
        date: commit.commit.author.date,
        url: commit.html_url,
      })),
    };

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
            text: `PR #${args?.prNumber} not found in repository.`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: `Error in pr_commits tool: ${error.message}`,
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
