const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const ora = require('ora');
const EnvManager = require('../utils/env-manager');
const GitSync = require('../utils/git-sync');
const GhManager = require('../utils/gh-manager');
const { configSchema } = require('../../config/schema');

async function statusCommand() {
  console.log(chalk.blue.bold('\n📊 Acture-MCP Status\n'));

  const envManager = new EnvManager();
  
  // Check if config exists
  if (!envManager.configExists()) {
    console.log(chalk.red('❌ Configuration not found'));
    console.log(chalk.yellow('\nRun "acture-mcp init" to set up your configuration.'));
    console.log();
    return;
  }

  let config;
  let configValid = false;
  let configErrors = [];
  
  try {
    config = envManager.loadConfig();
    
    // Validate configuration
    const validationResult = configSchema.safeParse(config);
    if (validationResult.success) {
      configValid = true;
    } else {
      configErrors = validationResult.error.errors;
    }
  } catch (error) {
    console.error(chalk.red(`❌ Failed to load configuration: ${error.message}`));
    process.exit(1);
  }

  // Display configuration status
  console.log(chalk.blue('⚙️  Configuration Status:'));
  
  if (configValid) {
    console.log(chalk.white(`  Status: ${chalk.green('✓ Valid')}`));
  } else {
    console.log(chalk.white(`  Status: ${chalk.red('✗ Invalid')}`));
    console.log(chalk.red('\n  Validation Errors:'));
    configErrors.forEach(err => {
      console.log(chalk.red(`    - ${err.path.join('.')}: ${err.message}`));
    });
  }
  
  console.log(chalk.white(`  Config file: ${envManager.configFile}`));
  
  // Display configuration details
  console.log(chalk.blue('\n📋 Configuration Details:'));
  console.log(chalk.white(`  Repository: ${config.repository || chalk.gray('not set')}`));
  console.log(chalk.white(`  Local path: ${config.localPath || chalk.gray('not set')}`));
  console.log(chalk.white(`  Docs URL: ${config.docsUrl || chalk.gray('not set')}`));
  console.log(chalk.white(`  GitHub token: ${config.githubToken ? chalk.green('✓ Set') : chalk.red('✗ Missing')}`));
  console.log(chalk.white(`  Notion integration: ${config.notionToken ? chalk.green('✓ Configured') : chalk.gray('Not configured')}`));
  if (config.notionToken && config.notionReportsPageId) {
    console.log(chalk.white(`  Notion reports page: ${config.notionReportsPageId}`));
  }
  console.log(chalk.white(`  Last sync: ${formatDate(config.lastSync)}`));

  // Check local repository status
  console.log(chalk.blue('\n🗂️  Local Repository Status:'));
  
  if (!config.localPath || !fs.existsSync(config.localPath)) {
    console.log(chalk.white(`  Status: ${chalk.yellow('Not cloned yet')}`));
    console.log(chalk.white(`  Path: ${config.localPath || chalk.gray('not configured')}`));
  } else {
    const gitSync = new GitSync(config.localPath, config.githubToken);
    
    try {
      const repoStatus = await gitSync.getRepositoryStatus();
      
      if (!repoStatus.isCloned) {
        console.log(chalk.white(`  Status: ${chalk.yellow('Directory exists but not a Git repository')}`));
        console.log(chalk.white(`  Path: ${config.localPath}`));
      } else {
        console.log(chalk.white(`  Status: ${chalk.green('✓ Repository found')}`));
        console.log(chalk.white(`  Path: ${config.localPath}`));
        console.log(chalk.white(`  Current branch: ${repoStatus.branch || chalk.gray('unknown')}`));
        console.log(chalk.white(`  Latest commit: ${repoStatus.commit || chalk.gray('unknown')}`));
        
        if (repoStatus.isClean) {
          console.log(chalk.white(`  Working tree: ${chalk.green('clean')}`));
        } else {
          console.log(chalk.white(`  Working tree: ${chalk.yellow('modified')}`));
          console.log(chalk.white(`  Modified files: ${repoStatus.modified || 0}`));
          console.log(chalk.white(`  Staged files: ${repoStatus.staged || 0}`));
        }
        
        if (repoStatus.ahead > 0 || repoStatus.behind > 0) {
          console.log(chalk.white(`  Sync status: ${repoStatus.ahead} ahead, ${repoStatus.behind} behind remote`));
        } else {
          console.log(chalk.white(`  Sync status: ${chalk.green('in sync with remote')}`));
        }
        
        // Get file statistics
        const fileStats = await gitSync.getFileStats();
        if (fileStats.exists) {
          console.log(chalk.blue('\n📊 Repository Statistics:'));
          console.log(chalk.white(`  Files: ${fileStats.files.toLocaleString()}`));
          console.log(chalk.white(`  Directories: ${fileStats.directories.toLocaleString()}`));
          console.log(chalk.white(`  Total size: ${formatFileSize(fileStats.size)}`));
        }
      }
    } catch (error) {
      console.log(chalk.white(`  Status: ${chalk.red('Error checking repository')}`));
      console.log(chalk.white(`  Error: ${error.message}`));
    }
  }

  // GitHub API connectivity check
  console.log(chalk.blue('\n🔗 GitHub API Status:'));
  
  if (config.githubToken) {
    let spinner;
    try {
      const axios = require('axios');
      spinner = ora('Testing GitHub API connection...').start();
      
      const response = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${config.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 5000,
      });
      
      spinner.succeed(chalk.green('GitHub API connection successful'));
      console.log(chalk.white(`  Authenticated as: ${response.data.login}`));
      console.log(chalk.white(`  Rate limit: ${response.headers['x-ratelimit-remaining']}/${response.headers['x-ratelimit-limit']}`));
    } catch (error) {
      if (spinner) {
        spinner.fail(chalk.red('GitHub API connection failed'));
      } else {
        console.log(chalk.red('GitHub API connection failed before spinner initialization'));
      }
      console.log(chalk.white(`  Error: ${error.message}`));
      
      if (error.response?.status === 401) {
        console.log(chalk.yellow('  Your token may be invalid or expired.'));
        console.log(chalk.yellow('  Run "acture-mcp init" to update your token.'));
      }
    }
  } else {
    console.log(chalk.white(`  Status: ${chalk.red('No token configured')}`));
  }

  // GitHub CLI (gh) Status
  try {
    const ghManager = new GhManager(config.githubToken);
    const version = ghManager.getVersion();
    console.log(chalk.blue(`\n📦 GitHub CLI: ${version || chalk.yellow('not installed')}`));
  } catch {
    console.log(chalk.blue(`\n📦 GitHub CLI: ${chalk.yellow('not installed')}`));
  }

  // Notion API Status
  console.log(chalk.blue('\n📝 Notion Integration:'));
  if (config.notionToken) {
    let notionSpinner;
    try {
      const axios = require('axios');
      notionSpinner = ora('Testing Notion API connection...').start();
      
      const response = await axios.get('https://api.notion.com/v1/users/me', {
        headers: {
          'Authorization': `Bearer ${config.notionToken}`,
          'Notion-Version': '2022-06-28',
        },
        timeout: 5000,
      });
      
      notionSpinner.succeed(chalk.green('Notion API connection successful'));
      console.log(chalk.white(`  Authenticated as: ${response.data.name || response.data.bot?.owner?.user?.name || 'Integration'}`));
      if (config.notionReportsPageId) {
        console.log(chalk.white(`  Reports page ID: ${config.notionReportsPageId}`));
      }
    } catch (error) {
      if (notionSpinner) {
        notionSpinner.fail(chalk.red('Notion API connection failed'));
      } else {
        console.log(chalk.red('Notion API connection failed'));
      }
      console.log(chalk.white(`  Error: ${error.message}`));
      
      if (error.response?.status === 401) {
        console.log(chalk.yellow('  Your Notion token may be invalid or expired.'));
        console.log(chalk.yellow('  Run "acture-mcp init" to update your Notion configuration.'));
      }
    }
  } else {
    console.log(chalk.white(`  Status: ${chalk.gray('Not configured')}`));
    console.log(chalk.white(`  Run "acture-mcp init" to configure Notion integration.`));
  }

  // Show actionable recommendations
  console.log(chalk.blue('\n💡 Recommendations:'));
  
  if (!configValid) {
    console.log(chalk.yellow('  • Run "acture-mcp init" to fix configuration issues'));
  } else if (!config.lastSync) {
    console.log(chalk.yellow('  • Run "acture-mcp sync" to clone the repository'));
  } else if (!fs.existsSync(config.localPath)) {
    console.log(chalk.yellow('  • Run "acture-mcp sync" to clone the repository'));
  } else {
    console.log(chalk.green('  ✓ Configuration is valid'));
    console.log(chalk.yellow('  • Run "acture-mcp sync" to update the repository'));
  }
  
  console.log();
}

function formatDate(dateString) {
  if (!dateString) return chalk.gray('Never');
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return chalk.green('Just now');
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = statusCommand;
