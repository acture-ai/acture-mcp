const fs = require('fs');
const path = require('path');
const EnvManager = require('../../cli/utils/env-manager');

// Tool definition
const definition = {
  name: 'read_doc',
  description: 'Read full content of a documentation file. Use after search_docs to get complete file content.',
  inputSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'Relative path to the documentation file (as returned by search_docs)',
      },
    },
    required: ['file'],
  },
};

// Strip HTML tags
function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Process file content for reading
function processContent(content, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.html' || ext === '.htm') {
    return stripHtml(content);
  }
  
  // Return markdown as-is (LLM can read it)
  return content;
}

// Tool handler
async function handler(args) {
  try {
    const { file } = args;
    
    console.error(`[read_doc] Reading file: "${file}"`);
    
    if (!file || file.trim() === '') {
      throw new Error('File path is required');
    }

    // Load config to get docsPath
    const envManager = new EnvManager();
    const config = envManager.loadConfig();
    
    if (!config?.docsPath) {
      throw new Error('Documentation path not configured. Run "acture-mcp init" and set the docsPath.');
    }
    
    const docsPath = config.docsPath;
    
    if (!fs.existsSync(docsPath)) {
      throw new Error(`Documentation path does not exist: ${docsPath}`);
    }
    
    // Resolve full path and ensure it's within docsPath (security check)
    const fullPath = path.resolve(path.join(docsPath, file));
    const resolvedDocsPath = path.resolve(docsPath);
    
    if (!fullPath.startsWith(resolvedDocsPath)) {
      throw new Error('Invalid file path: path traversal detected');
    }
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${file}`);
    }
    
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a file: ${file}`);
    }
    
    // Read file
    const rawContent = fs.readFileSync(fullPath, 'utf-8');
    const processedContent = processContent(rawContent, fullPath);
    
    // Extract title
    const titleMatch = rawContent.match(/^#\s+(.+)$/m) ||
                      rawContent.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : path.basename(file);
    
    const output = {
      file,
      title,
      size: processedContent.length,
      content: processedContent,
    };
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error in read_doc tool: ${error.message}`,
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
