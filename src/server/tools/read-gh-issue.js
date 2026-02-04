const { execSync } = require('child_process');
const GhManager = require('../../cli/utils/gh-manager');
const EnvManager = require('../../cli/utils/env-manager');

// Tool definition
const definition = {
  name: 'read_issue',
  description: 'Read a specific GitHub issue by number using gh CLI. Returns full issue details including body and comments.',
  inputSchema: {
    type: 'object',
    properties: {
      number: {
        type: 'number',
        description: 'Issue number to read',
      },
      repo: {
        type: 'string',
        description: 'Repository in "owner/repo" format. Defaults to the configured repository',
        optional: true,
      },
      comments: {
        type: 'boolean',
        description: 'Include issue comments (default: true)',
        optional: true,
      },
    },
    required: ['number'],
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
      ...options,
    });
    return result.trim();
  } catch (error) {
    if (error.stderr) {
      const stderr = error.stderr.toString();
      if (stderr.includes('not found') || stderr.includes('404')) {
        throw new Error(`Issue not found`);
      }
      if (stderr.includes('not logged in') || stderr.includes('401') || stderr.includes('Bad credentials')) {
        throw new Error('Not authenticated with GitHub');
      }
      throw new Error(`gh CLI error: ${stderr}`);
    }
    throw error;
  }
}

// Tool handler
async function handler(args) {
  try {
    const { 
      number, 
      repo,
      comments = true,
    } = args || {};
    
    if (!number || number < 1) {
      throw new Error('Issue number is required');
    }

    console.error(`[read_issue] Reading issue #${number}`);

    // Ensure GitHub CLI is ready
    const envManager = new EnvManager();
    const config = envManager.loadConfig();
    
    if (!config?.githubToken) {
      throw new Error('GitHub token not configured. Run "acture-mcp init" first.');
    }
    
    const ghManager = new GhManager(config.githubToken);
    const ghPath = ghManager.getGhPath();
    const githubToken = config.githubToken;

    // Build base command
    const targetRepo = repo || config?.repository;
    let repoFlag = '';
    if (targetRepo) {
      repoFlag = `--repo ${targetRepo}`;
    }

    // Get issue details
    const issueJson = execGh(
      `issue view ${number} ${repoFlag} --json number,title,state,author,assignees,labels,createdAt,updatedAt,closedAt,url,body,milestone,stateReason`,
      ghPath,
      githubToken
    );
    
    const issue = JSON.parse(issueJson);

    // Get comments if requested
    let issueComments = [];
    if (comments) {
      try {
        const commentsJson = execGh(
          `issue view ${number} ${repoFlag} --comments --json comments`,
          ghPath,
          githubToken
        );
        const commentsData = JSON.parse(commentsJson);
        issueComments = commentsData.comments || [];
      } catch (e) {
        // Comments might fail, continue without them
        console.error(`[read_issue] Could not fetch comments: ${e.message}`);
      }
    }

    // Format the result
    const result = {
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author: issue.author?.login,
      assignees: issue.assignees?.map(a => a.login) || [],
      labels: issue.labels?.map(l => l.name) || [],
      milestone: issue.milestone?.title || null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      closedAt: issue.closedAt,
      stateReason: issue.stateReason || null,
      url: issue.url,
      body: issue.body,
      comments: issueComments.map(c => ({
        author: c.author?.login,
        createdAt: c.createdAt,
        body: c.body,
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
          text: `Error in read_issue tool: ${error.message}`,
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
