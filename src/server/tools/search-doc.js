const fs = require('fs');
const path = require('path');
const MiniSearch = require('minisearch');
const EnvManager = require('../../cli/utils/env-manager');

// Tool definition
const definition = {
  name: 'search_doc',
  description: 'Search documentation using MiniSearch. Indexes all documentation files and provides fast, relevance-ranked search with fuzzy matching.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for documentation',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)',
        optional: true,
      },
      fuzzy: {
        type: 'boolean',
        description: 'Enable fuzzy matching for typos (default: true)',
        optional: true,
      },
    },
    required: ['query'],
  },
};

// Cache for the MiniSearch instance
let searchCache = {
  instance: null,
  docsPath: null,
  lastIndexed: null,
};

// Recursively find all documentation files
function findDocFiles(dir, files = []) {
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!item.startsWith('.') && item !== 'node_modules') {
          findDocFiles(fullPath, files);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (['.md', '.mdx', '.html', '.htm', '.txt'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Directory might not exist or be readable
  }
  
  return files;
}

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

// Extract title from content
function extractTitle(content, filePath) {
  // Try markdown heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  
  // Try HTML title
  const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  
  // Fallback to filename
  return path.basename(filePath, path.extname(filePath));
}

// Extract content sections for better indexing
function extractSections(content, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let text = content;
  
  if (ext === '.html' || ext === '.htm') {
    text = stripHtml(content);
  } else {
    // Markdown processing
    text = content
      .replace(/^---[\s\S]*?---\n?/, '') // Remove frontmatter
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images -> alt text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links -> text
      .replace(/```[\s\S]*?```/g, ' ') // Remove code blocks
      .replace(/`([^`]+)`/g, '$1') // Inline code
      .replace(/#+\s+/g, ' ') // Remove heading markers
      .replace(/\*\*?|__?/g, '') // Remove bold/italic markers
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return text;
}

// Index all documentation files
async function indexDocs(docsPath) {
  const files = findDocFiles(docsPath);
  
  if (files.length === 0) {
    return { miniSearch: null, fileCount: 0 };
  }
  
  const miniSearch = new MiniSearch({
    fields: ['title', 'content'],
    storeFields: ['title', 'file', 'content'],
    searchOptions: {
      boost: { title: 3 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
  
  const documents = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const rawContent = fs.readFileSync(file, 'utf-8');
      const title = extractTitle(rawContent, file);
      const content = extractSections(rawContent, file);
      
      documents.push({
        id: i,
        title,
        file: path.relative(docsPath, file),
        content: content.substring(0, 50000), // Limit content size
      });
    } catch (error) {
      console.error(`[search_docs] Failed to read ${file}:`, error.message);
    }
  }
  
  miniSearch.addAll(documents);
  
  return { miniSearch, fileCount: files.length };
}

// Get or create search index
async function getSearchIndex(docsPath) {
  // Check if we need to reindex
  const shouldReindex = !searchCache.instance || 
                        searchCache.docsPath !== docsPath ||
                        !searchCache.lastIndexed ||
                        (Date.now() - searchCache.lastIndexed) > 5 * 60 * 1000; // 5 min cache
  
  if (shouldReindex) {
    console.error(`[search_docs] Indexing documentation at ${docsPath}...`);
    const { miniSearch, fileCount } = await indexDocs(docsPath);
    
    if (!miniSearch) {
      return null;
    }
    
    searchCache = {
      instance: miniSearch,
      docsPath,
      lastIndexed: Date.now(),
      fileCount,
    };
    
    console.error(`[search_docs] Indexed ${fileCount} files`);
  }
  
  return searchCache.instance;
}

// Extract snippets from search results
function extractSnippets(content, query, maxSnippets = 3) {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const contentLower = content.toLowerCase();
  const snippets = [];
  const usedRanges = [];
  
  for (const term of queryTerms) {
    let index = contentLower.indexOf(term);
    
    while (index !== -1 && snippets.length < maxSnippets) {
      // Check if this range overlaps with existing snippets
      const overlap = usedRanges.some(r => 
        (index >= r.start && index <= r.end) || 
        (index + term.length >= r.start && index + term.length <= r.end)
      );
      
      if (!overlap) {
        const start = Math.max(0, index - 160);
        const end = Math.min(content.length, index + term.length + 240);
        let snippet = content.substring(start, end);
        
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        
        snippets.push(snippet);
        usedRanges.push({ start: start, end: end });
      }
      
      // Find next occurrence
      index = contentLower.indexOf(term, index + 1);
    }
    
    if (snippets.length >= maxSnippets) break;
  }
  
  return snippets;
}

// Tool handler
async function handler(args) {
  try {
    const { query, maxResults = 10, fuzzy = true } = args;
    
    console.error(`[search_docs] Searching: "${query}"`);
    
    if (!query || query.trim() === '') {
      throw new Error('Search query is required');
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
    
    // Get or build search index
    const miniSearch = await getSearchIndex(docsPath);
    
    if (!miniSearch) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query,
              docsPath,
              results: [],
              message: 'No documentation files found (.md, .mdx, .html, .txt)',
            }, null, 2),
          },
        ],
      };
    }
    
    // Perform search
    const searchOptions = {
      boost: { title: 3 },
      prefix: true,
    };
    
    if (fuzzy) {
      searchOptions.fuzzy = 0.2; // 20% typo tolerance
    }
    
    const results = miniSearch.search(query, searchOptions);
    const limitedResults = results.slice(0, Math.min(maxResults, 20));
    
    if (limitedResults.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query,
              docsPath,
              filesIndexed: searchCache.fileCount,
              results: [],
              message: 'No matches found. Try different search terms.',
            }, null, 2),
          },
        ],
      };
    }
    
    // Build response with snippets
    const formattedResults = limitedResults.map(result => {
      const snippets = extractSnippets(result.content, query);
      
      return {
        file: result.file,
        title: result.title,
        score: result.score,
        match: result.match,
        snippets: snippets.length > 0 ? snippets : [result.content.substring(0, 200).trim() + '...'],
      };
    });
    
    const output = {
      query,
      docsPath,
      filesIndexed: searchCache.fileCount,
      resultsCount: formattedResults.length,
      results: formattedResults,
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
          text: `Error in search_docs tool: ${error.message}`,
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
