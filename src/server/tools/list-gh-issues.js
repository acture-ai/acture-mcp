const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const GhManager = require('../../cli/utils/gh-manager');
const EnvManager = require('../../cli/utils/env-manager');

// Tool definition
const definition = {
  name: 'list_issues',
  description: 'List GitHub issues for a specific period using gh CLI. Returns issues created or updated within the specified date range.',
  inputSchema: {
    type: 'object',
    properties: {
      since: {
        type: 'string',
        description: 'Start date in YYYY-MM-DD format or relative time like "7 days ago", "1 week ago"',
        optional: true,
      },
      until: {
        type: 'string',
        description: 'End date in YYYY-MM-DD format or relative time like "today", "yesterday". Defaults to now.',
        optional: true,
      },
      state: {
        type: 'string',
        description: 'Filter by issue state: "open", "closed", "all"',
        enum: ['open', 'closed', 'all'],
        optional: true,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 100, max: 1000)',
        optional: true,
      },
      assignee: {
        type: 'string',
        description: 'Filter by assignee username, "@me" for current user, or "none" for unassigned',
        optional: true,
      },
      author: {
        type: 'string',
        description: 'Filter by author username',
        optional: true,
      },
      label: {
        type: 'string',
        description: 'Filter by label name (comma-separated for multiple)',
        optional: true,
      },
      repo: {
        type: 'string',
        description: 'Repository in "owner/repo" format. Defaults to the current repository',
        optional: true,
      },
    },
  },
};

// Helper function to execute gh CLI commands
function execGh(command, ghPath, githubToken, options = {}) {
  try {
    // Use GH_TOKEN env var for authentication
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
      if (stderr.includes('not logged in') || stderr.includes('401') || stderr.includes('Bad credentials')) {
        throw new Error('Not authenticated with GitHub. Please run "acture-mcp init" to reconfigure.');
      }
      if (stderr.includes('not found') || stderr.includes('not a git repository')) {
        throw new Error('Not in a git repository or repository not found on GitHub.');
      }
      throw new Error(`gh CLI error: ${stderr}`);
    }
    throw error;
  }
}

// Helper function to parse date input
function parseDate(dateInput) {
  if (!dateInput) return null;
  
  // If it's already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  
  // Handle relative dates like "7 days ago", "1 week ago", "today", "yesterday"
  const now = new Date();
  const lowerInput = dateInput.toLowerCase();
  
  if (lowerInput === 'today') {
    return now.toISOString().split('T')[0];
  }
  
  if (lowerInput === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  
  // Parse relative time expressions
  const daysMatch = lowerInput.match(/(\d+)\s*days?\s*ago/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
  
  const weeksMatch = lowerInput.match(/(\d+)\s*weeks?\s*ago/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10);
    const date = new Date(now);
    date.setDate(date.getDate() - (weeks * 7));
    return date.toISOString().split('T')[0];
  }
  
  const monthsMatch = lowerInput.match(/(\d+)\s*months?\s*ago/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date.toISOString().split('T')[0];
  }
  
  // Try parsing as a date
  const parsed = new Date(dateInput);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  throw new Error(`Invalid date format: ${dateInput}. Use YYYY-MM-DD or relative time like "7 days ago"`);
}

// Tool handler
async function handler(args) {
  try {
    const { 
      since, 
      until, 
      state = 'all', 
      limit = 100, 
      assignee, 
      author, 
      label,
      repo 
    } = args || {};
    
    console.error(`[list_issues] Listing issues - since: "${since || 'none'}", until: "${until || 'none'}", state: "${state}"`);

    // Ensure GitHub CLI is ready
    const envManager = new EnvManager();
    const config = envManager.loadConfig();
    
    if (!config?.githubToken) {
      throw new Error('GitHub token not configured. Run "acture-mcp init" first.');
    }
    
    const ghManager = new GhManager(config.githubToken);
    const ghPath = ghManager.getGhPath();
    const githubToken = config.githubToken;

    // Build the gh issue list command
    let command = 'issue list';
    
    // Add repo - use provided repo, or config repository, or gh will use current directory
    const targetRepo = repo || config?.repository;
    if (targetRepo) {
      command += ` --repo ${targetRepo}`;
    }
    
    // Add state filter
    command += ` --state ${state}`;
    
    // Add limit
    const safeLimit = Math.min(Math.max(1, limit), 1000);
    command += ` --limit ${safeLimit}`;
    
    // Add assignee filter
    if (assignee) {
      command += ` --assignee ${assignee}`;
    }
    
    // Add author filter
    if (author) {
      command += ` --author ${author}`;
    }
    
    // Add label filter
    if (label) {
      command += ` --label ${label}`;
    }
    
    // Add JSON output format for easier parsing
    command += ' --json number,title,state,author,assignees,labels,createdAt,updatedAt,closedAt,url';
    
    // Execute the command
    const output = execGh(command, ghPath, githubToken);
    let issues = JSON.parse(output || '[]');
    
    // Filter by date range if specified
    const sinceDate = parseDate(since);
    const untilDate = parseDate(until);
    
    if (sinceDate || untilDate) {
      issues = issues.filter(issue => {
        const createdAt = new Date(issue.createdAt);
        const updatedAt = new Date(issue.updatedAt);
        const closedAt = issue.closedAt ? new Date(issue.closedAt) : null;
        
        // Consider the most recent activity date
        const activityDate = closedAt && closedAt > updatedAt ? closedAt : updatedAt;
        
        if (sinceDate) {
          const sinceDateTime = new Date(sinceDate);
          sinceDateTime.setHours(0, 0, 0, 0);
          if (activityDate < sinceDateTime) return false;
        }
        
        if (untilDate) {
          const untilDateTime = new Date(untilDate);
          untilDateTime.setHours(23, 59, 59, 999);
          if (activityDate > untilDateTime) return false;
        }
        
        return true;
      });
    }
    
    // Format the result
    const result = {
      query: {
        since: sinceDate || 'Not specified',
        until: untilDate || 'Not specified',
        state,
        limit: safeLimit,
        assignee: assignee || 'Not specified',
        author: author || 'Not specified',
        label: label || 'Not specified',
        repo: repo || 'Current repository',
      },
      totalCount: issues.length,
      issues: issues.map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        author: issue.author.login,
        assignees: issue.assignees.map(a => a.login),
        labels: issue.labels.map(l => l.name),
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        closedAt: issue.closedAt,
        url: issue.url,
        
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
          text: `Error in list_issues tool: ${error.message}`,
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
