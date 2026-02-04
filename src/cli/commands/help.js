const chalk = require('chalk');
const { program } = require('commander');
const packageJson = require('../../../package.json');

async function helpCommand(command) {
  if (command) {
    // Show help for specific command
    showCommandHelp(command);
  } else {
    // Show general help
    showGeneralHelp();
  }
}

function showGeneralHelp() {
  console.log(chalk.blue.bold('\n🚀 Acture-MCP v' + packageJson.version));
  console.log(chalk.gray('Local GitHub repository intelligence CLI\n'));
  
  console.log(chalk.white.bold('USAGE:'));
  console.log(chalk.white('  acture-mcp <command> [options]\n'));
  
  console.log(chalk.white.bold('COMMANDS:'));
  console.log(chalk.green('  init      ') + chalk.white('Interactive setup for GitHub token, repository, and local path'));
  console.log(chalk.green('  sync      ') + chalk.white('Clone repository (if new) or pull latest changes'));
  console.log(chalk.green('  status    ') + chalk.white('Show configuration and repository status'));
  console.log(chalk.green('  help      ') + chalk.white('Show this help message or help for a specific command'));
  console.log();
  
  console.log(chalk.white.bold('OPTIONS:'));
  console.log(chalk.yellow('  -V, --version   ') + chalk.white('Show version number'));
  console.log(chalk.yellow('  -h, --help      ') + chalk.white('Show help\n'));
  
  console.log(chalk.white.bold('EXAMPLES:'));
  console.log(chalk.gray('  # Initial setup'));
  console.log(chalk.white('  $ acture-mcp init\n'));
  
  console.log(chalk.gray('  # Sync repository'));
  console.log(chalk.white('  $ acture-mcp sync\n'));
  
  console.log(chalk.gray('  # Check status'));
  console.log(chalk.white('  $ acture-mcp status\n'));
  
  console.log(chalk.white.bold('CONFIGURATION:'));
  console.log(chalk.white('  Configuration is stored in OS-specific directories:'));
  console.log(chalk.gray('  - Linux: ~/.config/acture-mcp/config.json'));
  console.log(chalk.gray('  - macOS: ~/Library/Application Support/acture-mcp/config.json'));
  console.log(chalk.gray('  - Windows: %APPDATA%/acture-mcp/config.json'));
  console.log();
  
  console.log(chalk.white.bold('GITHUB TOKEN:'));
  console.log(chalk.white('  Required: Personal Access Token (classic) with repo scope'));
  console.log(chalk.white('  Create: https://github.com/settings/tokens'));
  console.log();
  
  console.log(chalk.blue('For help with a specific command:'));
  console.log(chalk.white('  $ acture-mcp help <command>'));
  console.log();
}

function showCommandHelp(commandName) {
  switch (commandName) {
    case 'init':
      showInitHelp();
      break;
    case 'sync':
      showSyncHelp();
      break;
    case 'status':
      showStatusHelp();
      break;
    case 'help':
      showHelpCommandHelp();
      break;
    default:
      console.log(chalk.red(`Unknown command: ${commandName}`));
      console.log(chalk.yellow('Available commands: init, sync, status, help'));
      console.log();
      console.log(chalk.blue('Run "acture-mcp help" for general help.'));
      console.log();
  }
}

function showInitHelp() {
  console.log(chalk.blue.bold('\n🚀 acture-mcp init\n'));
  
  console.log(chalk.white('Interactive setup for configuring Acture-MCP.\n'));
  
  console.log(chalk.white.bold('USAGE:'));
  console.log(chalk.white('  acture-mcp init\n'));
  
  console.log(chalk.white.bold('PROMPTS:'));
  console.log(chalk.yellow('  GitHub Token:     ') + chalk.white('Your GitHub Personal Access Token (masked with *)'));
  console.log(chalk.gray('                    Will be validated against GitHub API\n'));
  
  console.log(chalk.yellow('  Repository:       ') + chalk.white('GitHub repository in owner/repo format'));
  console.log(chalk.gray('                    Example: facebook/react\n'));
  
  console.log(chalk.yellow('  Local Path:       ') + chalk.white('Local directory to sync the repository'));
  console.log(chalk.gray('                    Default: ~/.acture-mcp/repos/ (or OS equivalent)\n'));
  
  console.log(chalk.yellow('  Docs URL:         ') + chalk.white('URL to external documentation (optional)'));
  console.log(chalk.gray('                    Must be a valid URL if provided\n'));
  
  console.log(chalk.white.bold('EXAMPLE:'));
  console.log(chalk.gray('  $ acture-mcp init'));
  console.log(chalk.gray('  ? GitHub Personal Access Token: ********'));
  console.log(chalk.gray('  ? GitHub Repository (owner/repo format): myorg/myproject'));
  console.log(chalk.gray('  ? Local Sync Path: ~/.acture-mcp/repos/myproject'));
  console.log(chalk.gray('  ? Documentation URL (optional): https://docs.myproject.com'));
  console.log(chalk.green('  ✔ Configuration saved successfully!\n'));
}

function showSyncHelp() {
  console.log(chalk.blue.bold('\n🔄 acture-mcp sync\n'));
  
  console.log(chalk.white('Clone a repository (if not already cloned) or pull the latest changes.\n'));
  
  console.log(chalk.white.bold('USAGE:'));
  console.log(chalk.white('  acture-mcp sync\n'));
  
  console.log(chalk.white.bold('DESCRIPTION:'));
  console.log(chalk.white('  If the repository has not been cloned to the local path,'));
  console.log(chalk.white('  this command will clone it using the configured GitHub token.'));
  console.log(chalk.white('  If already cloned, it will pull the latest changes from the remote.\n'));
  
  console.log(chalk.white.bold('OUTPUT:'));
  console.log(chalk.white('  - Repository status check'));
  console.log(chalk.white('  - Clone/pull progress with file statistics'));
  console.log(chalk.white('  - Final repository state and statistics'));
  console.log(chalk.white('  - Updated last sync timestamp\n'));
  
  console.log(chalk.white.bold('EXAMPLE:'));
  console.log(chalk.gray('  $ acture-mcp sync'));
  console.log(chalk.blue('  Checking repository status...'));
  console.log(chalk.green('  ✔ Repository found at: /home/user/.acture-mcp/repos/myproject'));
  console.log(chalk.blue('  Pulling latest changes...'));
  console.log(chalk.green('  ✔ Repository updated successfully'));
  console.log(chalk.blue('  Update Statistics:'));
  console.log(chalk.white('    Files changed: 5'));
  console.log(chalk.white('    Insertions: +125'));
  console.log(chalk.white('    Deletions: -30\n'));
}

function showStatusHelp() {
  console.log(chalk.blue.bold('\n📊 acture-mcp status\n'));
  
  console.log(chalk.white('Display the current configuration and repository status.\n'));
  
  console.log(chalk.white.bold('USAGE:'));
  console.log(chalk.white('  acture-mcp status\n'));
  
  console.log(chalk.white.bold('DISPLAYS:'));
  console.log(chalk.yellow('  Configuration:    ') + chalk.white('Config validation, file location, and settings'));
  console.log(chalk.yellow('  Repository:       ') + chalk.white('Local clone status, commit hash, sync status'));
  console.log(chalk.yellow('  File Statistics:  ') + chalk.white('File count, directory count, total size'));
  console.log(chalk.yellow('  GitHub API:       ') + chalk.white('Token validation and rate limit info'));
  console.log(chalk.yellow('  Recommendations: ') + chalk.white('Next steps based on current status\n'));
  
  console.log(chalk.white.bold('EXAMPLE:'));
  console.log(chalk.gray('  $ acture-mcp status'));
  console.log(chalk.blue('  Configuration Status:'));
  console.log(chalk.green('    ✓ Valid'));
  console.log(chalk.white('    Config file: /home/user/.config/acture-mcp/config.json\n'));
  console.log(chalk.blue('  Repository Status:'));
  console.log(chalk.green('    ✓ Repository found'));
  console.log(chalk.white('    Path: /home/user/.acture-mcp/repos/myproject'));
  console.log(chalk.white('    Current branch: main'));
  console.log(chalk.white('    Latest commit: a1b2c3d'));
  console.log(chalk.white('    Working tree: clean'));
  console.log(chalk.white('    Sync status: in sync with remote\n'));
}

function showHelpCommandHelp() {
  console.log(chalk.blue.bold('\n❓ acture-mcp help\n'));
  
  console.log(chalk.white('Display help information about Acture-MCP or a specific command.\n'));
  
  console.log(chalk.white.bold('USAGE:'));
  console.log(chalk.white('  acture-mcp help [command]\n'));
  
  console.log(chalk.white.bold('ARGUMENTS:'));
  console.log(chalk.yellow('  [command]  ') + chalk.white('Optional command name to show detailed help\n'));
  
  console.log(chalk.white.bold('EXAMPLES:'));
  console.log(chalk.gray('  # General help'));
  console.log(chalk.white('  $ acture-mcp help\n'));
  
  console.log(chalk.gray('  # Help for specific command'));
  console.log(chalk.white('  $ acture-mcp help init'));
  console.log(chalk.white('  $ acture-mcp help sync'));
  console.log(chalk.white('  $ acture-mcp help status\n'));
}

module.exports = helpCommand;
