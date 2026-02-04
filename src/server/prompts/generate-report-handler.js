// MCP Prompt Handler for report generation
// Loads prompt text from .txt files in the same folder

const fs = require('fs');
const path = require('path');

// Three separate prompt definitions
const definitions = [
  {
    name: 'weekly_report',
    description: 'Generate weekly engineering report for Notion',
  },
  {
    name: 'milestone_report',
    description: 'Generate milestone/sprint review for Notion',
  },
  {
    name: 'standup_report',
    description: 'Generate daily standup report for Notion',
  },
];

function loadPromptFile(filename) {
  // Load from same directory as this file
  const filePath = path.join(__dirname, filename);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (e) {
    console.error(`[generate-report-handler] Failed to load ${filename}:`, e.message);
  }
  return null;
}

function getPrompt(name) {
  const fileMap = {
    weekly_report: 'weekly-report.txt',
    milestone_report: 'milestone-report.txt',
    standup_report: 'standup-report.txt',
  };

  const filename = fileMap[name];
  if (!filename) return null;

  const content = loadPromptFile(filename);
  if (!content) {
    return {
      description: `Generate ${name.replace('_', ' ')}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Generate a ${name.replace('_', ' ')}. Use available tools to research and publish to Notion via publish_notion_report with template_id="${name === 'weekly_report' ? 'weekly_engineering' : name === 'milestone_report' ? 'milestone_review' : 'daily_standup'}"`,
          },
        },
      ],
    };
  }

  const templateId = name === 'weekly_report' ? 'weekly_engineering' : 
                     name === 'milestone_report' ? 'milestone_review' : 
                     'daily_standup';

  const fullPrompt = `${content}\n\n---\nPublishing: Use publish_notion_report with template_id="${templateId}"`;

  return {
    description: `Generate ${name.replace('_', ' ')}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: fullPrompt,
        },
      },
    ],
  };
}

module.exports = {
  definitions,
  getPrompt,
};
