const { execSync } = require('child_process');
const GhManager = require('../../cli/utils/gh-manager');
const EnvManager = require('../../cli/utils/env-manager');

// Tool definition
const definition = {
  name: 'linked_prs',
  description: 'Find pull requests linked to an issue via mention in PR body/title (e.g., "Fixes #123", "Closes #123"). Uses GitHub search API.',
  inputSchema: {
    type: 'object',
    properties: {
      issueNumber: {
        type: 'number',
        description: 'Issue number to find linked PRs for',
      },
      repo: {
        type: 'string',
        description: 'Repository in "owner/repo" format. Defaults to the configured repository',
        optional: true,
      },
      state: {
        type: 'string',
        description: 'Filter PR state: "open", "closed", "merged", "all"',
        enum: ['open', 'closed', 'merged', 'all'],
        optional: true,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of PRs to return (default: 30)',
        optional: true,
      },
    },
    required: ['issueNumber'],
  },
};

// Helper function to execute gh CLI commands
function execGh(command, ghPath, githubToken, options = {}) {
  try {
    const env = { ...process.env, GH_TOKEN: githubToken };
    
    const result = execSync(`"${ghPath}" ${command}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      timeout: 30000,
      ...options,
    });
    return result.trim();
  } catch (error) {
    if (error.stderr) {
      const stderr = error.stderr.toString();
      if (stderr.includes('not found') || stderr.includes('404')) {
        throw new Error(`Not found`);
      }
      if (stderr.includes('not logged in') || stderr.includes('401') || stderr.includes('Bad credentials')) {
        throw new Error('Not authenticated with GitHub');
      }
      throw new Error(`gh CLI error: ${stderr}`);
    }
    throw error;
  }
}

// Search for PRs mentioning the issue
function searchLinkedPrs(owner, repo, issueNumber, state, limit, ghPath, githubToken) {
  const parts = [`repo:${owner}/${repo}`, 'is:pr'];
  if (state && state !== 'all') parts.push(`is:${state}`);
  parts.push(`#${issueNumber}`);
  const searchQuery = parts.join(' ');
  
  const env = { ...process.env, GH_TOKEN: githubToken };
  
  // Build command - search query without quotes (gh CLI handles it correctly)
  const cmd = `"${ghPath}" search prs ${searchQuery} --limit ${limit} --json number,title,state,url,createdAt,updatedAt,closedAt,body`;
  
  const result = execSync(cmd, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
    timeout: 30000,
  });
  
  return JSON.parse(result.trim());
}

// Also search for closing keywords
function searchClosingPrs(owner, repo, issueNumber, state, limit, ghPath, githubToken) {
  const seenNumbers = new Set();
  const allPrs = [];
  
  const keywords = ['closes', 'fixes', 'resolves', 'close', 'fix', 'resolve'];
  
  for (const keyword of keywords) {
    try {
      const parts = [`repo:${owner}/${repo}`, 'is:pr'];
      if (state && state !== 'all') parts.push(`is:${state}`);
      parts.push(`${keyword} #${issueNumber}`);
      const searchQuery = parts.join(' ');
      
      const env = { ...process.env, GH_TOKEN: githubToken };
      const cmd = `"${ghPath}" search prs ${searchQuery} --limit ${limit} --json number,title,state,url,createdAt,updatedAt,closedAt,body`;
      
      const result = execSync(cmd, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
        timeout: 30000,
      });
      
      const results = JSON.parse(result.trim());
      
      for (const pr of results) {
        if (!seenNumbers.has(pr.number)) {
          seenNumbers.add(pr.number);
          pr.linkType = 'closes';
          allPrs.push(pr);
        }
      }
    } catch (e) {
      // Continue with next keyword
    }
  }
  
  return allPrs;
}

// Tool handler
async function handler(args) {
  try {
    const { 
      issueNumber, 
      repo,
      state = 'all',
      limit = 30,
    } = args || {};
    
    if (!issueNumber || issueNumber < 1) {
      throw new Error('Issue number is required');
    }

    console.error(`[linked_prs] Finding PRs mentioning issue #${issueNumber}`);

    // Ensure GitHub CLI is ready
    const envManager = new EnvManager();
    const config = envManager.loadConfig();
    
    if (!config?.githubToken) {
      throw new Error('GitHub token not configured. Run "acture-mcp init" first.');
    }
    
    const ghManager = new GhManager(config.githubToken);
    const ghPath = ghManager.getGhPath();
    const githubToken = config.githubToken;

    // Parse repo
    const targetRepo = repo || config?.repository;
    if (!targetRepo || !targetRepo.includes('/')) {
      throw new Error('Repository required in owner/repo format');
    }
    
    const [owner, repoName] = targetRepo.split('/');

    // Search for PRs
    const seenNumbers = new Set();
    const linkedPrs = [];
    
    // 1. Search for PRs with closing keywords
    const closingPrs = searchClosingPrs(owner, repoName, issueNumber, state, limit, ghPath, githubToken);
    for (const pr of closingPrs) {
      seenNumbers.add(pr.number);
      linkedPrs.push(pr);
    }
    
    // 2. Search for PRs mentioning the issue
    const mentioningPrs = searchLinkedPrs(owner, repoName, issueNumber, state, limit, ghPath, githubToken);
    for (const pr of mentioningPrs) {
      if (!seenNumbers.has(pr.number)) {
        seenNumbers.add(pr.number);
        pr.linkType = 'mentioned';
        linkedPrs.push(pr);
      }
    }

    // Format the result
    const result = {
      issueNumber,
      repository: targetRepo,
      totalFound: linkedPrs.length,
      pullRequests: linkedPrs.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        linkType: pr.linkType || 'mentioned',
        url: pr.url,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        closedAt: pr.closedAt,
        body: pr.body,
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
    return {
      content: [
        {
          type: 'text',
          text: `Error in linked_prs tool: ${error.message}`,
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
