const { execSync } = require('child_process');
const GhManager = require('../../cli/utils/gh-manager');
const EnvManager = require('../../cli/utils/env-manager');

// Tool definition
const definition = {
  name: 'repo_metrics',
  description: 'Collect engineering metrics and DORA approximations for stakeholder reports. Tracks velocity, quality, and delivery performance over a configurable time period.',
  inputSchema: {
    type: 'object',
    properties: {
      repo: {
        type: 'string',
        description: 'Repository in "owner/repo" format. Defaults to configured repository',
        optional: true,
      },
      since: {
        type: 'string',
        description: 'Start date in YYYY-MM-DD format. Defaults to 7 days ago',
        optional: true,
      },
      until: {
        type: 'string',
        description: 'End date in YYYY-MM-DD format. Defaults to today',
        optional: true,
      },
      days: {
        type: 'number',
        description: 'Alternative to since/until: number of days back to analyze (default: 7)',
        optional: true,
      },
      bugLabels: {
        type: 'string',
        description: 'Comma-separated list of labels to count as bugs (default: "bug")',
        optional: true,
      },
      bugTypes: {
        type: 'string',
        description: 'Comma-separated list of issue types to count as bugs (default: "Bug")',
        optional: true,
      },
    },
  },
};

// Helper function to execute gh CLI commands
function execGh(args, ghPath, githubToken) {
  const env = { ...process.env, GH_TOKEN: githubToken };
  
  const result = execSync(`"${ghPath}" ${args}`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
    timeout: 60000,
  });
  
  return result.trim();
}

// Get date N days ago in YYYY-MM-DD format
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// Get today's date in YYYY-MM-DD format
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// Calculate days between two dates
function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
}

// Fetch closed issues in period
function fetchIssues(owner, repo, since, until, state, ghPath, githubToken) {
  try {
    const searchQuery = `repo:${owner}/${repo} is:issue ${state === 'closed' ? 'is:closed' : ''} closed:${since}..${until}`;
    const output = execGh(
      `search issues ${searchQuery} --limit 1000 --json number,title,state,createdAt,closedAt,labels,author`,
      ghPath,
      githubToken
    );
    return JSON.parse(output || '[]');
  } catch (e) {
    return [];
  }
}

// Fetch bug issues by a specific label (single label search)
function fetchBugIssuesBySingleLabel(owner, repo, since, until, label, ghPath, githubToken) {
  try {
    const searchQuery = `repo:${owner}/${repo} is:issue is:closed closed:${since}..${until} label:"${label}"`;
    const output = execGh(
      `search issues ${searchQuery} --limit 1000 --json number,title,state,createdAt,closedAt,labels,author`,
      ghPath,
      githubToken
    );
    return JSON.parse(output || '[]');
  } catch (e) {
    return [];
  }
}

// Fetch bug issues by a specific GitHub Issue Type (single type search)
function fetchBugIssuesBySingleType(owner, repo, since, until, type, ghPath, githubToken) {
  try {
    const searchQuery = `repo:${owner}/${repo} is:issue is:closed closed:${since}..${until} type:"${type}"`;
    const output = execGh(
      `search issues ${searchQuery} --limit 1000 --json number,title,state,createdAt,closedAt,labels,author`,
      ghPath,
      githubToken
    );
    return JSON.parse(output || '[]');
  } catch (e) {
    return [];
  }
}

// Fetch all bug issues by trying multiple labels and types
async function fetchAllBugIssues(owner, repo, since, until, bugLabels, bugTypes, ghPath, githubToken) {
  // Fetch issues for each label and type separately (OR queries are fragile)
  const labelPromises = bugLabels.map(label => 
    fetchBugIssuesBySingleLabel(owner, repo, since, until, label, ghPath, githubToken)
  );
  const typePromises = bugTypes.map(type => 
    fetchBugIssuesBySingleType(owner, repo, since, until, type, ghPath, githubToken)
  );
  
  const results = await Promise.all([...labelPromises, ...typePromises]);
  
  // Deduplicate by issue number
  const bugMap = new Map();
  results.flat().forEach(issue => {
    bugMap.set(issue.number, issue);
  });
  
  return Array.from(bugMap.values());
}

// Fetch merged PRs in period (using closedAt as proxy for mergedAt)
function fetchPRs(owner, repo, since, until, ghPath, githubToken) {
  try {
    const searchQuery = `repo:${owner}/${repo} is:pr is:merged closed:${since}..${until}`;
    const output = execGh(
      `search prs ${searchQuery} --limit 1000 --json number,title,createdAt,closedAt,author`,
      ghPath,
      githubToken
    );
    // Map closedAt to mergedAt for consistency
    const prs = JSON.parse(output || '[]');
    return prs.map(pr => ({
      ...pr,
      mergedAt: pr.closedAt,
    }));
  } catch (e) {
    return [];
  }
}

// Fetch PR reviews for review time calculation
function fetchPRReviews(owner, repo, prNumber, ghPath, githubToken) {
  try {
    const output = execGh(
      `api repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      ghPath,
      githubToken
    );
    return JSON.parse(output || '[]');
  } catch (e) {
    return [];
  }
}

// Tool handler
async function handler(args) {
  try {
    const { 
      repo,
      since,
      until,
      days = 7,
      bugLabels = 'bug',
      bugTypes = 'Bug',
    } = args || {};

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
    
    // Determine date range
    const startDate = since || getDateDaysAgo(days);
    const endDate = until || getToday();
    const periodDays = daysBetween(startDate, endDate);
    
    console.error(`[repo_metrics] Analyzing ${targetRepo} from ${startDate} to ${endDate} (${periodDays} days)`);

    // Parse bug labels and types
    const bugLabelList = bugLabels.split(',').map(l => l.trim().toLowerCase());
    const bugTypeList = bugTypes.split(',').map(t => t.trim());
    
    // Fetch data
    const [closedIssues, mergedPRs] = await Promise.all([
      fetchIssues(owner, repoName, startDate, endDate, 'closed', ghPath, githubToken),
      fetchPRs(owner, repoName, startDate, endDate, ghPath, githubToken),
    ]);

    // Calculate metrics
    
    // 1. Velocity: Issues closed per week/day
    const issuesClosed = closedIssues.length;
    const issuesPerDay = issuesClosed / periodDays;
    const issuesPerWeek = issuesPerDay * 7;
    
    // 2. Bug trend - fetch bugs by BOTH label AND type, then deduplicate
    // GitHub Issue Types (Bug/Feature/Task) are separate from labels
    // Some repos use type:"Bug", others use label:"bug" or label:"type: bug"
    // We search for each and merge results (OR queries are fragile in gh CLI)
    const bugIssues = await fetchAllBugIssues(
      owner, repoName, startDate, endDate,
      bugLabels.split(',').map(l => l.trim()),
      bugTypeList,
      ghPath, githubToken
    );
    
    const bugCount = bugIssues.length;
    const nonBugCount = issuesClosed - bugCount;
    const bugRatio = issuesClosed > 0 ? (bugCount / issuesClosed) * 100 : 0;
    
    // 3. PRs merged
    const prsMerged = mergedPRs.length;
    const prsPerDay = prsMerged / periodDays;
    const prsPerWeek = prsPerDay * 7;
    
    // 4. PR Size Distribution (estimated by title keywords since API doesn't give additions/deletions)
    const prSizes = mergedPRs.map(pr => {
      const title = pr.title || '';
      const titleLower = title.toLowerCase();
      
      // Estimate by title keywords
      if (titleLower.includes('doc') || titleLower.includes('typo') || titleLower.includes('readme')) return 'xs';
      if (titleLower.includes('deps') || titleLower.includes('bump')) return 's';
      if (titleLower.includes('fix') || titleLower.includes('feat')) return 'm';
      if (titleLower.includes('refactor') || title.length > 80) return 'l';
      return 'm'; // Default to medium
    });
    
    const sizeDistribution = {
      xs: prSizes.filter(s => s === 'xs').length,
      s: prSizes.filter(s => s === 's').length,
      m: prSizes.filter(s => s === 'm').length,
      l: prSizes.filter(s => s === 'l').length,
      xl: prSizes.filter(s => s === 'xl').length,
    };
    
    // Average PR size (estimated)
    const sizeWeights = { xs: 25, s: 75, m: 300, l: 750, xl: 1500 };
    const totalSizeEstimate = prSizes.reduce((sum, size) => sum + sizeWeights[size], 0);
    const avgPRSize = prsMerged > 0 ? Math.round(totalSizeEstimate / prsMerged) : 0;
    
    // 5. Contributor Activity
    const contributorStats = {};
    
    mergedPRs.forEach(pr => {
      const author = pr.author?.login || 'unknown';
      if (!contributorStats[author]) {
        contributorStats[author] = { prs: 0, issues: 0 };
      }
      contributorStats[author].prs++;
    });
    
    closedIssues.forEach(issue => {
      const author = issue.author?.login || 'unknown';
      if (!contributorStats[author]) {
        contributorStats[author] = { prs: 0, issues: 0 };
      }
      contributorStats[author].issues = (contributorStats[author].issues || 0) + 1;
    });
    
    const activeContributors = Object.keys(contributorStats).length;
    const topContributors = Object.entries(contributorStats)
      .sort((a, b) => (b[1].prs + (b[1].issues || 0)) - (a[1].prs + (a[1].issues || 0)))
      .slice(0, 10)
      .map(([login, stats]) => ({
        login,
        prs: stats.prs,
        issues: stats.issues || 0,
      }));
    
    // 6. Review Turnaround Time (sample first 10 PRs)
    let totalReviewHours = 0;
    let reviewedPRCount = 0;
    
    const prsToCheck = mergedPRs.slice(0, 10);
    for (const pr of prsToCheck) {
      try {
        const reviews = await fetchPRReviews(owner, repoName, pr.number, ghPath, githubToken);
        if (reviews.length > 0) {
          const firstReview = reviews[0];
          const prCreated = new Date(pr.createdAt);
          const firstReviewDate = new Date(firstReview.submitted_at);
          const hours = (firstReviewDate - prCreated) / (1000 * 60 * 60);
          if (hours > 0 && hours < 168) {
            totalReviewHours += hours;
            reviewedPRCount++;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    const avgReviewTimeHours = reviewedPRCount > 0 
      ? Math.round(totalReviewHours / reviewedPRCount) 
      : null;
    
    // DORA Approximations
    
    // Lead Time: PR created → merged
    let totalLeadTimeHours = 0;
    let leadTimeCount = 0;
    
    mergedPRs.forEach(pr => {
      const created = new Date(pr.createdAt);
      const merged = new Date(pr.mergedAt);
      const hours = (merged - created) / (1000 * 60 * 60);
      if (hours > 0 && hours < 720) {
        totalLeadTimeHours += hours;
        leadTimeCount++;
      }
    });
    
    const doraLeadTimeHours = leadTimeCount > 0 
      ? Math.round(totalLeadTimeHours / leadTimeCount) 
      : null;
    
    // Deployment Frequency
    const doraDeploymentFrequency = {
      perDay: parseFloat(prsPerDay.toFixed(2)),
      perWeek: parseFloat(prsPerWeek.toFixed(1)),
      note: 'Based on PR merges (assumes merge ≈ deployment)',
    };
    
    // Change Failure Rate
    const doraChangeFailureRate = issuesClosed > 0 
      ? parseFloat(((bugCount / issuesClosed) * 100).toFixed(1))
      : 0;
    
    // MTTR
    let totalBugResolutionHours = 0;
    let resolvedBugCount = 0;
    
    bugIssues.forEach(issue => {
      const created = new Date(issue.createdAt);
      const closed = new Date(issue.closedAt);
      const hours = (closed - created) / (1000 * 60 * 60);
      if (hours > 0 && hours < 720) {
        totalBugResolutionHours += hours;
        resolvedBugCount++;
      }
    });
    
    const doraMTTRHours = resolvedBugCount > 0 
      ? Math.round(totalBugResolutionHours / resolvedBugCount) 
      : null;
    
    // Build result
    const result = {
      repository: targetRepo,
      period: {
        startDate,
        endDate,
        days: periodDays,
      },
      
      summary: {
        issuesClosed,
        prsMerged,
        activeContributors,
        avgPRSize,
      },
      
      velocity: {
        issuesClosed,
        issuesPerDay: parseFloat(issuesPerDay.toFixed(2)),
        issuesPerWeek: parseFloat(issuesPerWeek.toFixed(1)),
        prsMerged,
        prsPerDay: parseFloat(prsPerDay.toFixed(2)),
        prsPerWeek: parseFloat(prsPerWeek.toFixed(1)),
      },
      
      quality: {
        bugCount,
        nonBugCount,
        bugRatio: parseFloat(bugRatio.toFixed(1)),
        bugLabels: bugLabelList,
        bugTypes: bugTypeList,
      },
      
      prMetrics: {
        totalMerged: prsMerged,
        avgSize: avgPRSize,
        sizeDistribution,
        avgReviewTimeHours,
      },
      
      contributors: {
        total: activeContributors,
        top: topContributors,
      },
      
      doraApproximation: {
        note: 'DORA metrics are APPROXIMATIONS based on GitHub data. True DORA requires production deployment data.',
        leadTime: doraLeadTimeHours !== null ? {
          hours: doraLeadTimeHours,
          days: parseFloat((doraLeadTimeHours / 24).toFixed(1)),
          note: 'PR created → merged (proxy for commit → production)',
        } : null,
        deploymentFrequency: doraDeploymentFrequency,
        changeFailureRate: {
          percentage: doraChangeFailureRate,
          note: 'Bug issues / total issues (proxy for failed deployments)',
        },
        mttr: doraMTTRHours !== null ? {
          hours: doraMTTRHours,
          note: 'Average time to resolve bug issues (proxy for incident recovery)',
        } : null,
      },
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
          text: `Error in repo_metrics tool: ${error.message}`,
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
