const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const EnvManager = require('../utils/env-manager');
const GitSync = require('../utils/git-sync');

async function syncCommand() {
  console.log(chalk.blue.bold('\n🔄 Synchronizing Repository\n'));

  const envManager = new EnvManager();
  
  // Check if config exists
  if (!envManager.configExists()) {
    console.error(chalk.red('❌ Configuration not found. Please run "acture-mcp init" first.'));
    process.exit(1);
  }

  let config;
  try {
    config = envManager.loadConfig();
  } catch (error) {
    console.error(chalk.red(`❌ Failed to load configuration: ${error.message}`));
    process.exit(1);
  }

  const gitSync = new GitSync(config.localPath, config.githubToken);
  const repoUrl = gitSync.getRepoUrlFromConfig(config.repository);

  try {
    // Check repository status first
    const statusSpinner = ora('Checking repository status...').start();
    const repoStatus = await gitSync.getRepositoryStatus();
    
    if (!repoStatus.isCloned) {
      statusSpinner.text = 'Repository not cloned yet';
      statusSpinner.stop();
      
      console.log(chalk.yellow(`Repository will be cloned to: ${config.localPath}`));
      
      const syncSpinner = ora('Cloning repository...').start();
      const result = await gitSync.syncRepository(repoUrl);
      
      if (result.success) {
        syncSpinner.succeed(chalk.green('Repository cloned successfully'));
        
        // Show initial file stats
        const statsSpinner = ora('Analyzing repository structure...').start();
        const fileStats = await gitSync.getFileStats();
        statsSpinner.stop();
        
        if (fileStats.exists) {
          console.log(chalk.blue('\n📊 Repository Statistics:'));
          console.log(chalk.white(`  Files: ${fileStats.files.toLocaleString()}`));
          console.log(chalk.white(`  Directories: ${fileStats.directories.toLocaleString()}`));
          console.log(chalk.white(`  Total size: ${formatFileSize(fileStats.size)}`));
        }
      } else {
        syncSpinner.fail(chalk.red(`Clone failed: ${result.message}`));
        process.exit(1);
      }
    } else {
      statusSpinner.succeed(`Repository found at: ${config.localPath}`);
      
      // Show current status
      console.log(chalk.gray(`\nCurrent branch: ${repoStatus.branch || 'unknown'}`));
      console.log(chalk.gray(`Commit: ${repoStatus.commit || 'unknown'}`));
      
      const syncSpinner = ora('Pulling latest changes...').start();
      const result = await gitSync.syncRepository(repoUrl);
      
      if (result.success) {
        if (result.message === 'Repository is up to date') {
          syncSpinner.info(chalk.blue('Repository is already up to date'));
        } else {
          syncSpinner.succeed(chalk.green(result.message));
          
          if (result.stats) {
            console.log(chalk.blue('\n📊 Update Statistics:'));
            if (result.stats.filesChanged > 0) {
              console.log(chalk.white(`  Files changed: ${result.stats.filesChanged}`));
              console.log(chalk.white(`  Insertions: +${result.stats.insertions}`));
              console.log(chalk.white(`  Deletions: -${result.stats.deletions}`));
            }
          }
        }
      } else {
        syncSpinner.fail(chalk.red(`Pull failed: ${result.message}`));
        process.exit(1);
      }
    }

    // Update last sync timestamp
    config.lastSync = new Date().toISOString();
    envManager.saveConfig(config);
    
    // Show final repository status
    console.log(chalk.blue('\n📋 Final Status:'));
    const finalStatus = await gitSync.getRepositoryStatus();
    console.log(chalk.white(`  Local path: ${config.localPath}`));
    console.log(chalk.white(`  Last sync: ${formatDate(config.lastSync)}`));
    
    if (finalStatus.isCloned) {
      console.log(chalk.white(`  Commit: ${finalStatus.commit || 'unknown'}`));
      console.log(chalk.white(`  Status: ${finalStatus.isClean ? chalk.green('clean') : chalk.yellow('modified')}`));
      
      if (finalStatus.ahead > 0 || finalStatus.behind > 0) {
        console.log(chalk.white(`  Sync status: ${finalStatus.ahead} ahead, ${finalStatus.behind} behind`));
      }
    }
    
    // Show file statistics
    const finalStats = await gitSync.getFileStats();
    if (finalStats.exists) {
      console.log(chalk.white(`  Files: ${finalStats.files.toLocaleString()}`));
      console.log(chalk.white(`  Total size: ${formatFileSize(finalStats.size)}`));
    }
    
    console.log(chalk.green('\n✅ Synchronization complete!'));
    console.log();

  } catch (error) {
    console.error(chalk.red(`\n❌ Sync failed: ${error.message}`));
    
    if (error.message.includes('Authentication failed')) {
      console.error(chalk.yellow('  Your GitHub token may be invalid or expired.'));
      console.error(chalk.yellow('  Run "acture-mcp init" to update your token.'));
    } else if (error.message.includes('repository not found')) {
      console.error(chalk.yellow('  Repository not found. Check the owner/repo format.'));
    }
    
    process.exit(1);
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

module.exports = syncCommand;
