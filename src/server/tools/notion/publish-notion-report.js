/**
 * MCP Tool: publish_notion_report
 * 
 * Publishes structured report to Notion with rich formatting.
 * Supports: weekly_engineering, milestone_review, daily_standup.
 * Enhanced with rich text, callouts, tables, and visual hierarchy.
 */

const { Client } = require('@notionhq/client');
const EnvManager = require('../../../cli/utils/env-manager');
const ReportStorage = require('../../../cli/utils/report-storage');

// Tool definition
const definition = {
  name: 'publish_notion_report',
  description: 'Publishes structured report to Notion. Supports: weekly_engineering, milestone_review, daily_standup. Provide whatever data you have; the tool will format it appropriately.',
  inputSchema: {
    type: 'object',
    properties: {
      template_id: {
        type: 'string',
        description: 'Template style: weekly_engineering, milestone_review, or daily_standup',
        enum: ['weekly_engineering', 'milestone_review', 'daily_standup'],
      },
      data: {
        type: 'object',
        description: 'Report data. Include whatever fields you have: narrative, highlights, accomplishments, blockers, etc.',
      },
      title: {
        type: 'string',
        description: 'Custom title for the Notion page. Auto-generated if not provided.',
        optional: true,
      },
      parent_page_id: {
        type: 'string',
        description: 'Notion page ID where report will be created. Uses configured default if not provided.',
        optional: true,
      },
    },
    required: ['template_id', 'data'],
  },
};

function getNotionClient(token) {
  return new Client({ auth: token });
}

function buildPageTitle(templateId, data, customTitle) {
  if (customTitle) return customTitle;

  const date = new Date().toISOString().split('T')[0];
  const templates = {
    weekly_engineering: `Weekly Engineering Report - ${date}`,
    milestone_review: `Milestone Review - ${date}`,
    daily_standup: `Daily Standup - ${date}`,
  };
  return templates[templateId] || `Engineering Report - ${date}`;
}

/**
 * Parse markdown-style text into Notion rich text objects
 * Supports: **bold**, *italic*, `code`, [links](url)
 */
function parseRichText(text) {
  if (!text) return [];
  
  const str = String(text);
  const segments = [];
  let currentIndex = 0;
  
  // Pattern to match markdown: **bold**, *italic*, `code`, [text](url)
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let match;
  
  while ((match = pattern.exec(str)) !== null) {
    // Add text before the match
    if (match.index > currentIndex) {
      segments.push({
        type: 'text',
        text: { content: str.slice(currentIndex, match.index) },
      });
    }
    
    const content = match[0];
    
    if (content.startsWith('**') && content.endsWith('**')) {
      // Bold
      segments.push({
        type: 'text',
        text: { content: content.slice(2, -2) },
        annotations: { bold: true },
      });
    } else if (content.startsWith('*') && content.endsWith('*') && !content.startsWith('**')) {
      // Italic
      segments.push({
        type: 'text',
        text: { content: content.slice(1, -1) },
        annotations: { italic: true },
      });
    } else if (content.startsWith('`') && content.endsWith('`')) {
      // Inline code
      segments.push({
        type: 'text',
        text: { content: content.slice(1, -1) },
        annotations: { code: true },
      });
    } else if (content.startsWith('[') && content.includes('](')) {
      // Link [text](url)
      const linkMatch = content.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        segments.push({
          type: 'text',
          text: { 
            content: linkMatch[1],
            link: { url: linkMatch[2] },
          },
        });
      } else {
        segments.push({
          type: 'text',
          text: { content: content },
        });
      }
    }
    
    currentIndex = match.index + content.length;
  }
  
  // Add remaining text
  if (currentIndex < str.length) {
    segments.push({
      type: 'text',
      text: { content: str.slice(currentIndex) },
    });
  }
  
  return segments.length > 0 ? segments : [{ type: 'text', text: { content: str.slice(0, 2000) } }];
}

/**
 * Create a heading block with appropriate level
 */
function createHeading(text, level = 2) {
  const type = level === 1 ? 'heading_1' : level === 2 ? 'heading_2' : 'heading_3';
  return {
    type,
    [type]: { rich_text: parseRichText(text) },
  };
}

/**
 * Create a paragraph block
 */
function createParagraph(text) {
  return {
    type: 'paragraph',
    paragraph: { rich_text: parseRichText(text) },
  };
}

/**
 * Create a callout block with emoji
 */
function createCallout(text, emoji = '💡', color = 'blue_background') {
  return {
    type: 'callout',
    callout: {
      rich_text: parseRichText(text),
      icon: { emoji },
      color,
    },
  };
}

/**
 * Create a quote block
 */
function createQuote(text) {
  return {
    type: 'quote',
    quote: { rich_text: parseRichText(text) },
  };

}

/**
 * Create a code block
 */
function createCode(text, language = 'plain text') {
  return {
    type: 'code',
    code: {
      rich_text: [{ type: 'text', text: { content: text } }],
      language,
    },
  };
}

/**
 * Create a bulleted list item
 */
function createBullet(text) {
  return {
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: parseRichText(text) },
  };
}

/**
 * Create a numbered list item
 */
function createNumbered(text) {
  return {
    type: 'numbered_list_item',
    numbered_list_item: { rich_text: parseRichText(text) },
  };
}

/**
 * Create a to-do item
 */
function createTodo(text, checked = false) {
  return {
    type: 'to_do',
    to_do: {
      rich_text: parseRichText(text),
      checked,
    },
  };
}

/**
 * Create a divider
 */
function createDivider() {
  return { type: 'divider', divider: {} };
}

/**
 * Format a key-value pair as a paragraph with bold key
 */
function createKeyValue(key, value) {
  const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  if (value === undefined || value === null) return null;
  
  if (typeof value === 'string' || typeof value === 'number') {
    return {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { type: 'text', text: { content: label + ': ' }, annotations: { bold: true } },
          ...parseRichText(String(value)),
        ],
      },
    };
  }
  
  return {
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: label + ': ' }, annotations: { bold: true } },
        { type: 'text', text: { content: JSON.stringify(value).slice(0, 200) } },
      ],
    },
  };
}

/**
 * Create a table from array of objects
 */
function createTable(objects, maxRows = 20) {
  if (!Array.isArray(objects) || objects.length === 0) return null;
  
  const keys = Object.keys(objects[0]);
  if (keys.length === 0) return null;
  
  // Limit rows
  const rows = objects.slice(0, maxRows);
  
  const tableBlock = {
    type: 'table',
    table: {
      table_width: keys.length,
      has_column_header: true,
      has_row_header: false,
      children: [
        // Header row
        {
          type: 'table_row',
          table_row: {
            cells: keys.map(key => [
              {
                type: 'text',
                text: { content: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) },
                annotations: { bold: true },
              },
            ]),
          },
        },
        // Data rows
        ...rows.map(obj => ({
          type: 'table_row',
          table_row: {
            cells: keys.map(key => {
              const val = obj[key];
              const text = val === undefined || val === null ? '' : String(val).slice(0, 100);
              return [{ type: 'text', text: { content: text } }];
            }),
          },
        })),
      ],
    },
  };
  
  return tableBlock;
}

/**
 * Check if array contains objects (not just strings)
 */
function isArrayOfObjects(arr) {
  return Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null;
}

/**
 * Check if array should be displayed as a table (array of objects with consistent keys)
 */
function shouldRenderAsTable(arr) {
  if (!isArrayOfObjects(arr) || arr.length < 2) return false;
  
  // Check if objects have similar structure (at least 2 keys)
  const firstKeys = Object.keys(arr[0]);
  if (firstKeys.length < 2) return false;
  
  // At least 50% of objects should have similar keys
  const similarObjects = arr.filter(obj => {
    const keys = Object.keys(obj);
    const matchingKeys = keys.filter(k => firstKeys.includes(k));
    return matchingKeys.length >= firstKeys.length * 0.5;
  });
  
  return similarObjects.length >= arr.length * 0.5;
}

/**
 * Create a two-column table from a key-value object (for metrics)
 */
function createKeyValueTable(obj) {
  const entries = Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return null;
  
  return {
    type: 'table',
    table: {
      table_width: 2,
      has_column_header: true,
      has_row_header: false,
      children: [
        // Header row
        {
          type: 'table_row',
          table_row: {
            cells: [
              [{ type: 'text', text: { content: 'Metric' }, annotations: { bold: true } }],
              [{ type: 'text', text: { content: 'Value' }, annotations: { bold: true } }],
            ],
          },
        },
        // Data rows
        ...entries.map(([k, v]) => ({
          type: 'table_row',
          table_row: {
            cells: [
              [{ 
                type: 'text', 
                text: { content: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) } 
              }],
              [{ type: 'text', text: { content: String(v).slice(0, 100) } }],
            ],
          },
        })),
      ],
    },
  };
}

/**
 * Build section content based on type and structure
 */
function buildSectionContent(key, content, blocks) {
  // Skip empty content
  if (!content) return;
  
  // Special handling for known section types
  const sectionConfig = {
    // Blockers get special callout treatment
    blockers: { icon: '🚧', color: 'red_background' },
    challenges: { icon: '⚠️', color: 'yellow_background' },
    risks: { icon: '⚡', color: 'orange_background' },
    concerns: { icon: '💭', color: 'gray_background' },
    
    // Success/completion sections
    highlights: { icon: '✨', color: 'green_background' },
    accomplishments: { icon: '🏆', color: 'green_background' },
    deliverables: { icon: '📦', color: 'blue_background' },
    
    // Info sections
    summary: { icon: '📝', color: 'default' },
    overview: { icon: '👁️', color: 'default' },
    narrative: { icon: '📖', color: 'default' },
    
    // Team sections
    contributors: { icon: '👥', color: 'purple_background' },
    team: { icon: '🤝', color: 'purple_background' },
    
    // Planning sections
    upcoming: { icon: '🔮', color: 'blue_background' },
    next_steps: { icon: '👣', color: 'blue_background' },
    
    // Data sections - will be rendered as tables
    metrics: { icon: '📊', color: 'default', renderAsTable: true },
    velocity: { icon: '📈', color: 'default', renderAsTable: true },
  };
  
  const config = sectionConfig[key] || {};
  const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  // Add section heading
  blocks.push(createHeading(title, 2));
  
  // Special handling for metrics/velocity - render as table
  if (config.renderAsTable && typeof content === 'object' && !Array.isArray(content)) {
    const table = createKeyValueTable(content);
    if (table) {
      blocks.push(table);
      return;
    }
  }
  
  // Handle string content
  if (typeof content === 'string') {
    if (config.icon) {
      blocks.push(createCallout(content, config.icon, config.color));
    } else {
      blocks.push(createParagraph(content));
    }
    return;
  }
  
  // Handle arrays
  if (Array.isArray(content)) {
    // Empty array
    if (content.length === 0) return;
    
    // Array of strings → bulleted list
    if (!isArrayOfObjects(content)) {
      content.forEach(item => {
        if (typeof item === 'string') {
          blocks.push(createBullet(item));
        } else {
          blocks.push(createBullet(String(item)));
        }
      });
      return;
    }
    
    // Array of objects - decide format
    if (shouldRenderAsTable(content)) {
      const table = createTable(content);
      if (table) blocks.push(table);
    } else {
      // Render as nested key-value blocks
      content.forEach((obj, index) => {
        if (index > 0) blocks.push(createDivider());
        
        Object.entries(obj).forEach(([k, v]) => {
          if (v === undefined || v === null) return;
          
          const kvBlock = createKeyValue(k, v);
          if (kvBlock) blocks.push(kvBlock);
        });
      });
    }
    return;
  }
  
  // Handle objects
  if (typeof content === 'object') {
    // Special handling for retrospective object
    if (key === 'retrospective' || key === 'goals_vs_reality') {
      Object.entries(content).forEach(([k, v]) => {
        const subTitle = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        blocks.push(createHeading(subTitle, 3));
        
        if (Array.isArray(v)) {
          v.forEach(item => blocks.push(createBullet(item)));
        } else if (typeof v === 'string') {
          blocks.push(createParagraph(v));
        } else {
          const kv = createKeyValue(k, v);
          if (kv) blocks.push(kv);
        }
      });
      return;
    }
    
    // Regular object → key-value pairs
    Object.entries(content).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      
      const kvBlock = createKeyValue(k, v);
      if (kvBlock) blocks.push(kvBlock);
    });
  }
}

/**
 * Build Notion blocks from data object with rich formatting
 */
function buildBlocks(data) {
  const blocks = [];
  
  // Process ordered sections first
  const orderedSections = [
    'summary',
    'daily_summary',
    'overview',
    'narrative',
    'highlights',
    'work_completed',
    'completed_today',
    'deliverables',
    'in_progress',
    'accomplishments',
    'milestones',
    'epics',
    'updates',
    'metrics',
    'velocity',
    'goals_vs_reality',
    'contributors',
    'team',
    'blockers',
    'challenges',
    'risks',
    'concerns',
    'learnings',
    'retrospective',
    'upcoming',
    'upcoming_tomorrow',
    'next_steps',
    'decisions_made',
    'help_needed',
    'notes',
  ];
  
  // Build each section
  for (const key of orderedSections) {
    if (data[key]) {
      buildSectionContent(key, data[key], blocks);
    }
  }
  
  // Add any remaining sections not in the ordered list
  for (const [key, value] of Object.entries(data)) {
    if (orderedSections.includes(key)) continue;
    if (key === 'title') continue;
    if (key === 'date') continue; // Metadata, not content
    
    buildSectionContent(key, value, blocks);
  }
  
  if (blocks.length === 0) {
    blocks.push(createParagraph('No content provided'));
  }
  
  return blocks;
}

async function handler(args) {
  try {
    const { template_id, data, title, parent_page_id } = args || {};

    if (!template_id || !data) {
      return {
        content: [{ type: 'text', text: 'Error: template_id and data are required' }],
        isError: true,
      };
    }

    // Load config
    const envManager = new EnvManager();
    const config = envManager.loadConfig();

    if (!config?.notionToken) {
      return {
        content: [{ type: 'text', text: 'Error: Notion not configured. Run "acture-mcp init" first.' }],
        isError: true,
      };
    }

    // Determine parent page
    const targetParentId = parent_page_id || config.notionReportsPageId;
    if (!targetParentId) {
      return {
        content: [{ type: 'text', text: 'Error: No parent page configured. Run "acture-mcp init" or provide parent_page_id.' }],
        isError: true,
      };
    }

    // Build page
    const notion = getNotionClient(config.notionToken);
    const pageTitle = buildPageTitle(template_id, data, title);
    const blocks = buildBlocks(data);

    console.error(`[publish_notion_report] Creating page "${pageTitle}" with ${blocks.length} blocks`);

    const response = await notion.pages.create({
      parent: { page_id: targetParentId },
      properties: {
        title: {
          title: [{ type: 'text', text: { content: pageTitle } }],
        },
      },
      children: blocks.slice(0, 100),
    });

    // Add remaining blocks if needed
    if (blocks.length > 100) {
      for (let i = 100; i < blocks.length; i += 100) {
        await notion.blocks.children.append({
          block_id: response.id,
          children: blocks.slice(i, i + 100),
        });
      }
    }

    // Save to local storage
    const storage = new ReportStorage();
    storage.add({
      id: response.id,
      pageId: response.id,
      url: response.url,
      title: pageTitle,
      templateId: template_id,
      createdAt: new Date().toISOString(),
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          page: {
            id: response.id,
            title: pageTitle,
            url: response.url,
            blocks: blocks.length,
          },
          stored: true,
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error('[publish_notion_report] Error:', error.message);
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

module.exports = { definition, handler };
