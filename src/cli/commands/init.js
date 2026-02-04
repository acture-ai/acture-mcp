const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');
const EnvManager = require('../utils/env-manager');
const GhManager = require('../utils/gh-manager');
const { configSchema } = require('../../config/schema');

async function initCommand() {
  console.log(chalk.blue.bold('\n🚀 Acture-MCP Configuration Setup\n'));

  const envManager = new EnvManager();
  const existingConfig = envManager.loadConfig() || {};
  const defaultRepoPath = envManager.getDefaultRepoPath();

  try {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'githubToken',
        message: 'GitHub Personal Access Token:',
        mask: '*',
        validate: async (input) => {
          if (!input || input.trim().length === 0) {
            return 'GitHub token is required';
          }
          
          // Test API access
          const spinner = ora('Validating token...').start();
          try {
            const response = await axios.get('https://api.github.com/user', {
              headers: {
                Authorization: `token ${input}`,
                Accept: 'application/vnd.github.v3+json',
              },
            });
            
            spinner.succeed(chalk.green('Token validated successfully'));
            return true;
          } catch (error) {
            spinner.fail(chalk.red('Token validation failed'));
            if (error.response?.status === 401) {
              return 'Invalid token. Please check your GitHub Personal Access Token.';
            }
            return `API error: ${error.message}`;
          }
        },
        when: () => !existingConfig.githubToken,
      },
      {
        type: 'input',
        name: 'repository',
        message: 'GitHub Repository (owner/repo format):',
        default: existingConfig.repository,
        validate: (input) => {
          if (!input || !input.includes('/')) {
            return 'Repository must be in owner/repo format (e.g., facebook/react)';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'localPath',
        message: 'Local Sync Path:',
        default: existingConfig.localPath || defaultRepoPath,
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Local path is required';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'docsPath',
        message: 'Documentation Path (local directory):',
        default: existingConfig.docsPath || '',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Documentation path is required';
          }
          return true;
        },
      },
      {
        type: 'confirm',
        name: 'configureNotion',
        message: 'Configure Notion integration for reports?',
        default: !!(existingConfig.notionToken),
      },
      {
        type: 'password',
        name: 'notionToken',
        message: 'Notion Integration Token (from https://www.notion.so/my-integrations):',
        mask: '*',
        validate: async (input) => {
          if (!input || input.trim().length === 0) {
            return 'Notion token is required';
          }
          
          // Test Notion API access
          const spinner = ora('Validating Notion token...').start();
          try {
            const response = await axios.get('https://api.notion.com/v1/users/me', {
              headers: {
                'Authorization': `Bearer ${input}`,
                'Notion-Version': '2022-06-28',
              },
            });
            
            spinner.succeed(chalk.green('Notion token validated successfully'));
            return true;
          } catch (error) {
            spinner.fail(chalk.red('Notion token validation failed'));
            if (error.response?.status === 401) {
              return 'Invalid token. Please check your Notion Integration Token.';
            }
            return `API error: ${error.message}`;
          }
        },
        when: (answers) => answers.configureNotion,
      },
      {
        type: 'input',
        name: 'notionReportsPageId',
        message: 'Notion Reports Page ID (the page where reports will be created):',
        default: existingConfig.notionReportsPageId || '',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Page ID is required';
          }
          // Notion page IDs are typically 32 characters
          const cleanId = input.replace(/-/g, '');
          if (cleanId.length !== 32) {
            return 'Invalid Notion page ID format. Should be 32 characters (with or without dashes).';
          }
          return true;
        },
        when: (answers) => answers.configureNotion,
      },
    ]);

    // Use existing token if not provided
    if (existingConfig.githubToken && !answers.githubToken) {
      answers.githubToken = existingConfig.githubToken;
    }

    // Preserve existing Notion config if not updating
    if (!answers.configureNotion) {
      if (existingConfig.notionToken) {
        answers.notionToken = existingConfig.notionToken;
      }
      if (existingConfig.notionReportsPageId) {
        answers.notionReportsPageId = existingConfig.notionReportsPageId;
      }
    }

    // Clean up the answers object
    delete answers.configureNotion;



    // Validate the complete configuration
    const validationResult = configSchema.safeParse(answers);
    
    if (!validationResult.success) {
      console.error(chalk.red('\nConfiguration validation failed:'));
      validationResult.error.errors.forEach(err => {
        console.error(chalk.red(`  - ${err.path.join('.')}: ${err.message}`));
      });
      process.exit(1);
    }

    // Test repository access
    const spinner = ora('Testing repository access...').start();
    try {
      const [owner, repo] = answers.repository.split('/');
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `token ${answers.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      
      spinner.succeed(chalk.green(`Repository "${response.data.full_name}" found`));
    } catch (error) {
      spinner.fail(chalk.red('Repository access failed'));
      if (error.response?.status === 404) {
        console.error(chalk.yellow('  Repository not found or token lacks access.'));
      } else {
        console.error(chalk.yellow(`  Error: ${error.message}`));
      }
      
      const { continueSetup } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueSetup',
          message: 'Continue with setup anyway?',
          default: false,
        },
      ]);
      
      if (!continueSetup) {
        console.log(chalk.yellow('\nSetup cancelled.'));
        process.exit(0);
      }
    }

    // Save configuration
    envManager.saveConfig(validationResult.data);

    console.log(chalk.green.bold('\n✅ Configuration saved successfully!'));
    console.log(chalk.gray(`\nConfig location: ${envManager.configFile}`));

    // Download GitHub CLI (gh) portable binary
    const ghManager = new GhManager(answers.githubToken);
    
    if (!ghManager.isInstalled()) {
      const dlSpinner = ora('Downloading GitHub CLI...').start();
      try {
        await ghManager.download();
        dlSpinner.succeed(chalk.green('GitHub CLI downloaded'));
      } catch (error) {
        dlSpinner.fail(chalk.red('Download failed'));
        console.log(chalk.yellow(`⚠️  ${error.message}`));
        console.log(chalk.gray('The list_issues tool will not work without gh CLI.'));
      }
    }
    
    // Authenticate gh with token
    if (ghManager.isInstalled()) {
      const authSpinner = ora('Authenticating GitHub CLI...').start();
      try {
        // Always verify token works (skip check, just verify)
        await ghManager.authenticate();
        authSpinner.succeed(chalk.green('GitHub CLI authenticated'));
      } catch (error) {
        authSpinner.fail(chalk.red('Authentication failed'));
        console.log(chalk.yellow(`⚠️  ${error.message}`));
      }
    }
    
    console.log(chalk.blue('\nConfiguration Summary:'));
    console.log(chalk.white(`  GitHub Repository: ${validationResult.data.repository}`));
    console.log(chalk.white(`  Local Path: ${validationResult.data.localPath}`));
    if (validationResult.data.notionToken) {
      console.log(chalk.white(`  Notion Integration: ${chalk.green('Configured')}`));
      console.log(chalk.white(`  Notion Reports Page: ${validationResult.data.notionReportsPageId}`));
    } else {
      console.log(chalk.white(`  Notion Integration: ${chalk.gray('Not configured')}`));
    }
    
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.white('  1. Run "acture-mcp sync" to clone/pull the repository'));
    console.log(chalk.white('  2. Run "acture-mcp status" to check the status'));
    if (validationResult.data.notionToken) {
      console.log(chalk.white('  3. Use MCP tools get_template_schema and publish_notion_report to create reports'));
    }
    console.log();
    
    // Force exit to clean up any hanging connections
    process.exit(0);

  } catch (error) {
    console.error(chalk.red(`\n❌ Setup failed: ${error.message}`));
    if (error.response) {
      console.error(chalk.gray(`  API Status: ${error.response.status}`));
      console.error(chalk.gray(`  API Message: ${error.response.data?.message}`));
    }
    process.exit(1);
  }
}

module.exports = initCommand;
