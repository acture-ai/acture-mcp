const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Import tools
const searchCodebaseTool = require('./tools/search-codebase');
const codeChangesTool = require('./tools/code-changes');
const listGhIssuesTool = require('./tools/list-gh-issues');
const readGhIssueTool = require('./tools/read-gh-issue');
const linkedPrsTool = require('./tools/linked-prs');
const prCommitsTool = require('./tools/pr-commits');
const commitDiffTool = require('./tools/commit-diff');
const repoMetricsTool = require('./tools/repo-metrics');
const searchDocTool = require('./tools/search-doc');
const readDocTool = require('./tools/read-doc');

// Import Notion tools
const publishNotionReportTool = require('./tools/notion/publish-notion-report');
const readNotionReportsTool = require('./tools/notion/read-notion-reports');

// Import prompts
const reportHandler = require('./prompts/generate-report-handler');

// Import utilities
const GhManager = require('../cli/utils/gh-manager');
const EnvManager = require('../cli/utils/env-manager');

class ActureMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: 'acture-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupPromptHandlers();
    
    // Error handling
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };
    
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          searchCodebaseTool.definition,
          codeChangesTool.definition,
          listGhIssuesTool.definition,
          readGhIssueTool.definition,
          linkedPrsTool.definition,
          prCommitsTool.definition,
          commitDiffTool.definition,
          repoMetricsTool.definition,
          searchDocTool.definition,
          readDocTool.definition,
          publishNotionReportTool.definition,
          readNotionReportsTool.definition,
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_codebase':
            return await searchCodebaseTool.handler(args);
          case 'analyze_code_changes':
            return await codeChangesTool.handler(args);
          case 'list_issues':
            return await listGhIssuesTool.handler(args);
          case 'read_issue':
            return await readGhIssueTool.handler(args);
          case 'linked_prs':
            return await linkedPrsTool.handler(args);
          case 'pr_commits':
            return await prCommitsTool.handler(args);
          case 'commit_diff':
            return await commitDiffTool.handler(args);
          case 'repo_metrics':
            return await repoMetricsTool.handler(args);
          case 'search_doc':
            return await searchDocTool.handler(args);
          case 'read_doc':
            return await readDocTool.handler(args);
          case 'publish_notion_report':
            return await publishNotionReportTool.handler(args);
          case 'read_notion_reports':
            return await readNotionReportsTool.handler(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  setupPromptHandlers() {
    // List available prompts - three separate report prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: reportHandler.definitions,
      };
    });

    // Handle prompt requests
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name } = request.params;

      const prompt = reportHandler.getPrompt(name);
      if (prompt) {
        return prompt;
      }

      throw new Error(`Unknown prompt: ${name}`);
    });
  }

  async run() {
    // Ensure GitHub CLI is set up (silent mode - no output)
    await this.setupGhCli();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Acture-MCP server running on stdio');
  }

  async setupGhCli() {
    try {
      const envManager = new EnvManager();
      const config = envManager.loadConfig();
      
      if (config?.githubToken) {
        const ghManager = new GhManager(config.githubToken);
        const isReady = await ghManager.quickSetup();
        
        if (isReady) {
          console.error('[GhManager] GitHub CLI ready');
        } else {
          console.error('[GhManager] GitHub CLI not available - list_issues may not work');
        }
      } else {
        console.error('[GhManager] No GitHub token configured - list_issues will not work');
      }
    } catch (error) {
      console.error('[GhManager] Setup error:', error.message);
    }
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new ActureMcpServer();
  server.run().catch((error) => {
    console.error('Fatal error running server:', error);
    process.exit(1);
  });
}

module.exports = ActureMcpServer;
