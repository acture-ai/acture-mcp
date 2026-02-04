const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const GhManager = require('../../cli/utils/gh-manager');
const EnvManager = require('../../cli/utils/env-manager');

// Tool definition
const definition = {
  name: 'search_codebase',
  description: 'Search across GitHub entities. For code search: uses local repository (fast, no limits). For other types: uses GitHub API.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
      },
      type: {
        type: 'string',
        description: 'Type of search: "code" (local repo), "commits", "issues", "prs", "repos", "users" (GitHub API)',
        enum: ['code', 'commits', 'issues', 'prs', 'repos', 'users'],
      },
      repo: {
        type: 'string',
        description: 'Repository in "owner/repo" format. Required for code/commits/issues/prs.',
        optional: true,
      },
      language: {
        type: 'string',
        description: 'Filter by file extension for code search (e.g., "js", "ts", "py")',
        optional: true,
      },
      state: {
        type: 'string',
        description: 'Filter by state: "open", "closed", "all" (for issues/prs)',
        enum: ['open', 'closed', 'all'],
        optional: true,
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return (default: 30)',
        optional: true,
      },
    },
    required: ['query', 'type'],
  },
};

// Get local repo path (must match env-manager.js logic)
function getLocalRepoPath(repo) {
  if (!repo) return null;
  const repoName = repo.split('/')[1];
  if (!repoName) return null;
  
  // Windows: use LOCALAPPDATA, otherwise use home directory
  const baseDir = os.platform() === 'win32'
    ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'acture-mcp', 'repos')
    : path.join(os.homedir(), '.local', 'share', 'acture-mcp', 'repos');
  
  return path.join(baseDir, repoName);
}

// Execute git grep in local repo
function searchLocalCode(query, repoPath, language, limit) {
  try {
    // Build git grep command
    // Note: --include is not supported on Windows, so we filter by extension manually
    const args = ['grep', '-n', '-i', '--extended-regexp', query];
    
    // Execute git grep
    const result = execSync(`git ${args.join(' ')}`, {
      encoding: 'utf-8',
      cwd: repoPath,
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    // Parse results
    let lines = result.trim().split('\n').filter(Boolean);
    
    // Filter by language extension if specified
    if (language) {
      const extPattern = new RegExp(`\\.${language}$`, 'i');
      lines = lines.filter(line => {
        const filePath = line.split(':')[0];
        return extPattern.test(filePath);
      });
    }
    
    const matches = [];
    
    for (const line of lines.slice(0, limit)) {
      // Format: path:line_number:content
      const match = line.match(/^([^:]+):(\d+):(.+)$/);
      if (match) {
        matches.push({
          path: match[1],
          line: parseInt(match[2], 10),
          content: match[3].trim(),
        });
      }
    }
    
    return {
      source: 'local_repo',
      totalMatches: lines.length,
      matches,
    };
  } catch (e) {
    // git grep returns exit code 1 when no matches found
    if (e.status === 1) {
      return { source: 'local_repo', totalMatches: 0, matches: [] };
    }
    throw e;
  }
}

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

// Search commits via GitHub API
function searchCommits(query, repo, limit, ghPath, githubToken) {
  try {
    const searchQuery = `repo:${repo} ${query}`;
    
    const output = execGh(
      `search commits ${searchQuery} --limit ${limit} --json sha,commit,author,committer,repository`,
      ghPath,
      githubToken
    );
    
    return JSON.parse(output || '[]').map(item => ({
      type: 'commit',
      sha: item.sha?.substring(0, 7) || item.sha,
      fullSha: item.sha,
      message: item.commit?.message?.split('\n')[0] || item.commit?.message,
      fullMessage: item.commit?.message,
      author: item.author?.login || item.commit?.author?.name,
      authorEmail: item.commit?.author?.email,
      date: item.commit?.author?.date,
      repository: item.repository?.full_name || repo,
      url: item.url || `https://github.com/${item.repository?.full_name || repo}/commit/${item.sha}`,
    }));
  } catch (e) {
    console.error(`[search_codebase] Commits error: ${e.message}`);
    return [];
  }
}

// Search users via GitHub API
function searchUsers(query, limit, ghPath, githubToken) {
  try {
    const output = execGh(
      `search users "${query}" --limit ${limit} --json login,type,name,bio,url`,
      ghPath,
      githubToken
    );
    
    return JSON.parse(output || '[]').map(item => ({
      type: 'user',
      login: item.login,
      name: item.name,
      userType: item.type,
      bio: item.bio,
      url: item.url || item.html_url,
    }));
  } catch (e) {
    console.error(`[search_codebase] Users error: ${e.message}`);
    return [];
  }
}

// Search issues via GitHub API
function searchIssues(query, repo, state, limit, ghPath, githubToken) {
  try {
    let searchQuery = `repo:${repo} ${query} is:issue`;
    if (state && state !== 'all') {
      searchQuery += ` state:${state}`;
    }
    
    const output = execGh(
      `search issues ${searchQuery} --limit ${limit} --json number,title,state,url,createdAt,updatedAt,author`,
      ghPath,
      githubToken
    );
    
    return JSON.parse(output || '[]').map(item => ({
      type: 'issue',
      number: item.number,
      title: item.title,
      state: item.state,
      url: item.url || item.html_url,
      author: item.author?.login,
      createdAt: item.createdAt || item.created_at,
      updatedAt: item.updatedAt || item.updated_at,
    }));
  } catch (e) {
    console.error(`[search_codebase] Issues error: ${e.message}`);
    return [];
  }
}

// Search PRs via GitHub API
function searchPRs(query, repo, state, limit, ghPath, githubToken) {
  try {
    let searchQuery = `repo:${repo} ${query} is:pr`;
    if (state === 'open') searchQuery += ' state:open';
    else if (state === 'closed') searchQuery += ' state:closed';
    else if (state === 'merged') searchQuery += ' is:merged';
    
    const output = execGh(
      `search prs ${searchQuery} --limit ${limit} --json number,title,state,url,createdAt,updatedAt,author`,
      ghPath,
      githubToken
    );
    
    return JSON.parse(output || '[]').map(item => ({
      type: 'pr',
      number: item.number,
      title: item.title,
      state: item.state,
      url: item.url || item.html_url,
      author: item.author?.login,
      createdAt: item.createdAt || item.created_at,
      updatedAt: item.updatedAt || item.updated_at,
      merged: item.state === 'merged',
    }));
  } catch (e) {
    console.error(`[search_codebase] PRs error: ${e.message}`);
    return [];
  }
}

// Search repos via GitHub API
function searchRepos(query, limit, ghPath, githubToken) {
  try {
    const output = execGh(
      `search repos "${query}" --limit ${limit} --json fullName,description,url,stargazersCount,forksCount,language,updatedAt`,
      ghPath,
      githubToken
    );
    
    return JSON.parse(output || '[]').map(item => ({
      type: 'repo',
      fullName: item.fullName || item.full_name,
      description: item.description,
      url: item.url || item.html_url,
      stars: item.stargazersCount || item.stargazers_count || 0,
      forks: item.forksCount || item.forks_count || 0,
      language: item.language,
      updatedAt: item.updatedAt || item.updated_at,
    }));
  } catch (e) {
    console.error(`[search_codebase] Repos error: ${e.message}`);
    return [];
  }
}

// Tool handler
async function handler(args) {
  try {
    const { 
      query, 
      type,
      repo,
      language,
      state = 'all',
      limit = 30,
    } = args || {};
    
    if (!query || query.trim() === '') {
      throw new Error('Search query is required');
    }
    
    if (!type || !['code', 'commits', 'issues', 'prs', 'repos', 'users'].includes(type)) {
      throw new Error('Type must be one of: code, commits, issues, prs, repos, users');
    }

    const envManager = new EnvManager();
    const config = envManager.loadConfig();
    const targetRepo = repo || config?.repository;
    
    // Validate repo for types that require it
    if (['commits', 'issues', 'prs'].includes(type) && !targetRepo) {
      throw new Error(`Repository is required for ${type} search`);
    }

    // CODE SEARCH: Use local repo (fast, no limits, complete results)
    if (type === 'code') {
      if (!targetRepo) {
        throw new Error('Repository is required for code search');
      }
      
      const localRepoPath = getLocalRepoPath(targetRepo);
      
      if (!localRepoPath || !fs.existsSync(localRepoPath)) {
        return {
          content: [
            {
              type: 'text',
              text: `Local repository not found for ${targetRepo}.\n\nRun "acture-mcp sync" first to clone the repository, then search again.`,
            },
          ],
          isError: true,
        };
      }
      
      console.error(`[search_codebase] Searching code locally in ${targetRepo}`);
      
      const searchResult = searchLocalCode(query, localRepoPath, language, limit);
      
      if (searchResult.totalMatches === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No code found matching "${query}" in ${targetRepo}${language ? ` (${language} files)` : ''}.`,
            },
          ],
        };
      }
      
      const result = {
        query,
        type: 'code',
        repository: targetRepo,
        source: 'local_repo',
        totalFound: searchResult.totalMatches,
        returned: searchResult.matches.length,
        language: language || 'all',
        matches: searchResult.matches,
      };
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    // OTHER SEARCHES: Use GitHub API
    console.error(`[search_codebase] Searching ${type} via GitHub API`);
    
    if (!config?.githubToken) {
      throw new Error('GitHub token not configured. Run "acture-mcp init" first.');
    }
    
    const ghManager = new GhManager(config.githubToken);
    const ghPath = ghManager.getGhPath();
    const githubToken = config.githubToken;

    let results = [];
    
    switch (type) {
      case 'commits':
        results = searchCommits(query, targetRepo, limit, ghPath, githubToken);
        break;
      case 'issues':
        results = searchIssues(query, targetRepo, state, limit, ghPath, githubToken);
        break;
      case 'prs':
        results = searchPRs(query, targetRepo, state, limit, ghPath, githubToken);
        break;
      case 'repos':
        results = searchRepos(query, limit, ghPath, githubToken);
        break;
      case 'users':
        results = searchUsers(query, limit, ghPath, githubToken);
        break;
    }

    if (results.length === 0) {
      const repoContext = targetRepo ? ` in ${targetRepo}` : '';
      return {
        content: [
          {
            type: 'text',
            text: `No ${type} found matching "${query}"${repoContext}.`,
          },
        ],
      };
    }

    const result = {
      query,
      type,
      repository: ['repos', 'users'].includes(type) ? undefined : targetRepo,
      source: 'github_api',
      totalFound: results.length,
      results,
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
          text: `Error in search_codebase tool: ${error.message}`,
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
