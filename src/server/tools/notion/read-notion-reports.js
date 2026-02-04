/**
 * MCP Tool: read_notion_reports
 * 
 * List saved reports or fetch report content from Notion.
 * Stores metadata locally, fetches content from Notion API.
 */

const { Client } = require('@notionhq/client');
const EnvManager = require('../../../cli/utils/env-manager');
const ReportStorage = require('../../../cli/utils/report-storage');

// Tool definition
const definition = {
  name: 'read_notion_reports',
  description: 'List saved Notion reports or fetch report content. No arguments = list all reports. Provide report_id to fetch specific report content.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action to perform: "list" (all reports), "get" (specific report), "search" (find by query)',
        enum: ['list', 'get', 'search'],
        optional: true,
      },
      report_id: {
        type: 'string',
        description: 'Notion page ID to fetch content from (use with action="get")',
        optional: true,
      },
      template_id: {
        type: 'string',
        description: 'Filter by template type: weekly_engineering, milestone_review, daily_standup',
        enum: ['weekly_engineering', 'milestone_review', 'daily_standup'],
        optional: true,
      },
      query: {
        type: 'string',
        description: 'Search query to find reports by title (use with action="search")',
        optional: true,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of reports to return (default: 20, max: 100)',
        optional: true,
      },
    },
  },
};

function getNotionClient(token) {
  return new Client({ auth: token });
}

async function fetchPageContent(notion, pageId) {
  try {
    // Fetch page properties
    const page = await notion.pages.retrieve({ page_id: pageId });
    
    // Fetch page blocks (content)
    const blocks = [];
    let cursor = undefined;
    
    while (true) {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100,
      });
      
      blocks.push(...response.results);
      
      if (!response.has_more) break;
      cursor = response.next_cursor;
    }
    
    return { page, blocks };
  } catch (error) {
    throw new Error(`Failed to fetch page: ${error.message}`);
  }
}

function extractTextFromBlock(block) {
  const type = block.type;
  const content = block[type];
  
  if (!content) return '';
  
  // Extract text from rich_text array
  if (content.rich_text) {
    return content.rich_text.map(rt => rt.plain_text || rt.text?.content || '').join('');
  }
  
  // Handle table rows specially
  if (type === 'table' && content.children) {
    return `[Table with ${content.children.length} rows]`;
  }
  
  return '';
}

function formatBlock(block, depth = 0) {
  const type = block.type;
  const indent = '  '.repeat(depth);
  
  switch (type) {
    case 'paragraph':
      const text = extractTextFromBlock(block);
      return text ? `${indent}${text}` : '';
      
    case 'heading_1':
      return `\n${indent}# ${extractTextFromBlock(block)}`;
    case 'heading_2':
      return `\n${indent}## ${extractTextFromBlock(block)}`;
    case 'heading_3':
      return `\n${indent}### ${extractTextFromBlock(block)}`;
      
    case 'bulleted_list_item':
      return `${indent}- ${extractTextFromBlock(block)}`;
    case 'numbered_list_item':
      return `${indent}1. ${extractTextFromBlock(block)}`;
    case 'to_do':
      const checked = block.to_do?.checked ? '[x]' : '[ ]';
      return `${indent}${checked} ${extractTextFromBlock(block)}`;
      
    case 'callout':
      const calloutText = extractTextFromBlock(block);
      const icon = block.callout?.icon?.emoji || '💡';
      return `${indent}${icon} ${calloutText}`;
      
    case 'divider':
      return `${indent}---`;
      
    case 'quote':
      return `${indent}> ${extractTextFromBlock(block)}`;
      
    case 'code':
      const code = block.code?.rich_text?.map(rt => rt.plain_text).join('') || '';
      const language = block.code?.language || '';
      return `\n${indent}\`\`\`${language}\n${code}\n${indent}\`\`\``;
      
    default:
      return `${indent}[${type}]`;
  }
}

function formatContent(page, blocks) {
  const title = page.properties?.title?.title?.[0]?.plain_text || 'Untitled';
  const url = page.url || '';
  const created = page.created_time || '';
  
  let output = `# ${title}\n`;
  output += `URL: ${url}\n`;
  output += `Created: ${created}\n\n`;
  output += '---\n\n';
  
  for (const block of blocks) {
    const formatted = formatBlock(block);
    if (formatted) {
      output += formatted + '\n';
    }
  }
  
  return output;
}

async function handler(args) {
  try {
    const storage = new ReportStorage();
    const envManager = new EnvManager();
    const config = envManager.loadConfig();
    
    const action = args?.action || 'list';
    
    // LIST: Return all reports
    if (action === 'list') {
      const options = {};
      if (args?.template_id) options.templateId = args.template_id;
      if (args?.limit) options.limit = Math.min(parseInt(args.limit), 100);
      
      const reports = storage.getAll(options);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: reports.length,
            reports: reports.map(r => ({
              id: r.id,
              title: r.title,
              url: r.url,
              templateId: r.templateId,
              createdAt: r.createdAt,
            })),
          }, null, 2),
        }],
      };
    }
    
    // SEARCH: Find by query
    if (action === 'search') {
      if (!args?.query) {
        return {
          content: [{ type: 'text', text: 'Error: query required for search action' }],
          isError: true,
        };
      }
      
      const reports = storage.search(args.query);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query: args.query,
            matches: reports.length,
            reports: reports.map(r => ({
              id: r.id,
              title: r.title,
              url: r.url,
              templateId: r.templateId,
              createdAt: r.createdAt,
            })),
          }, null, 2),
        }],
      };
    }
    
    // GET: Fetch specific report content
    if (action === 'get') {
      if (!args?.report_id) {
        return {
          content: [{ type: 'text', text: 'Error: report_id required for get action' }],
          isError: true,
        };
      }
      
      // Try to find in storage first
      const report = storage.getById(args.report_id);
      
      if (!config?.notionToken) {
        // Return stored metadata only
        if (report) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                found: true,
                fromStorage: true,
                metadata: report,
                note: 'Notion not configured. Cannot fetch full content.',
              }, null, 2),
            }],
          };
        }
        return {
          content: [{ type: 'text', text: 'Error: Report not found in storage and Notion not configured.' }],
          isError: true,
        };
      }
      
      // Fetch from Notion API
      const notion = getNotionClient(config.notionToken);
      const { page, blocks } = await fetchPageContent(notion, args.report_id);
      const formattedContent = formatContent(page, blocks);
      
      return {
        content: [{
          type: 'text',
          text: formattedContent,
        }],
      };
    }
    
    return {
      content: [{ type: 'text', text: `Error: Unknown action "${action}"` }],
      isError: true,
    };
    
  } catch (error) {
    console.error('[read_notion_reports] Error:', error.message);
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

module.exports = { definition, handler };
