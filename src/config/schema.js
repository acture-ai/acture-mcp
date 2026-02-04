const z = require('zod');

const configSchema = z.object({
  githubToken: z.string().min(1, 'GitHub token is required'),
  repository: z.string().regex(/^[^/]+\/[^/]+$/, 'Repository must be in owner/repo format'),
  localPath: z.string().min(1, 'Local path is required'),
  docsPath: z.string().min(1, 'Documentation path is required'),
  lastSync: z.string().datetime().optional().nullable(),
  notionToken: z.string().optional().nullable(),
  notionReportsPageId: z.string().optional().nullable(),
});

module.exports = {
  configSchema,
};
