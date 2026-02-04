# Acture MCP

Acture MCP turns raw engineering signals into narrative reports.

It exposes data from your development tools (code, version control, issues, documentation, tasks) via MCP (Model Context Protocol), allowing AI agents to synthesize structured, shareable engineering reports.

GitHub is the first supported source, with more integrations planned.

## Who This Is For

- Engineering managers who need weekly or sprint reports
- Tech leads who want narrative context, not raw metrics
- Teams already using GitHub + Notion
- Developers experimenting with MCP-powered workflows

## What It Does

**Input:**
- Source code and commits
- Pull requests and diffs  
- Issues and tasks
- Documentation

**Output:**
- Weekly engineering summaries with concrete references
- Sprint/milestone retrospectives grounded in actual work
- Daily standup reports generated from real activity
- Any custom report you define via prompts

All stored as structured Notion pages you can share, search, and reference later.

## How It Works

```
┌─────────────────────┐     ┌──────────────┐     ┌────────────────────┐
│ Engineering Signals │───▶│  Acture MCP  │───▶│  AI Agent (Claude   │
│ (GitHub, etc)       │     │  Server      │     │ Desktop or others) │
└─────────────────────┘     └──────────────┘     └────────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────┐            ┌─────────────┐
                        │  Tools:     │            │  Prompt:    │
                        │ - Commits   │            │ "Create     │
                        │ - Issues    │            │ weekly      │
                        │ - PRs       │            │ report"     │
                        └─────────────┘            └─────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────────────────────────────┐
                        │  AI synthesizes narrative report    │
                        │  referencing concrete commits, PRs  │
                        └─────────────────────────────────────┘
                                          │
                                          ▼
                                   ┌────────────┐
                                   │   Notion   │
                                   │   Page     │
                                   └────────────┘
```

1. **MCP Server** — exposes your repo data as structured tools
2. **AI Agent** — uses prompts to request reports
3. **AI researches** — reads commits, PRs, issues, docs via tools
4. **AI writes** — generates narrative report with specific references
5. **Published to Notion** — structured, shareable, searchable
6. **Query anytime** — ask follow-up questions about the report

## Installation

```bash
npm install -g acture-mcp
```

Or clone and install locally:

```bash
git clone https://github.com/vkhafizov/acture-mcp.git
cd acture-mcp
npm install
```

## Quick Setup

One command to configure everything:

```bash
acture-mcp init
```

This interactive setup will ask for:
- **GitHub token** — for API access (stored encrypted)
- **Repository** — the repo to analyze (format: `owner/repo`)
- **Local path** — where to sync the repo locally
- **Documentation path** — local directory with project docs (optional, for doc search)
- **Notion integration** — optional, for publishing reports

Then sync your repository:

```bash
acture-mcp sync
```

This clones/pulls the repo to your local path for fast code search.

## Configure your Agent. Example for Claude Desktop:

Add to your Claude Desktop config (`claude_desktop_config.json`):

### If installed via npm (global):

```json
{
     "mcpServers": {
       "acture-mcp": {
         "command": "npx",
         "args": ["acture-mcp-server"]
       }
     }
   }
```

### If installed locally (clone):

```json
{
  "mcpServers": {
    "acture-mcp": {
      "command": "node",
      "args": ["path to acture-mcp/bin/acture-mcp-server"]
    }
  }
}
```

**Config locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Restart Claude Desktop. You should see the tools and prompts available.

## Usage

### 1. Request a Report

In Claude Desktop, use one of the built-in prompts:

**`/weekly_report`** — Generate weekly engineering summary
> "Create a report covering what the team shipped this week, including specific PRs and their impact."

**`/milestone_report`** — Sprint/milestone retrospective  
> "Summarize the sprint: what was planned, what delivered, blockers encountered, and lessons learned."

**`/standup_report`** — Daily standup summary
> "Capture today's completed work, current progress, and any blockers."

### 2. The AI Does Research

The AI will automatically:
- Call `repo_metrics` for activity data
- Search commits and PRs via `search_codebase`
- List recent issues with `list_issues`
- Read specific issue details with `read_issue`
- Search documentation with `search_doc` (if docs path configured)

It finds the actual work — concrete commits, real PRs, specific issues.

### 3. Review and Publish

The AI presents findings and asks:
- "Any specific highlights you want to emphasize?"
- "Shall I publish this to Notion?"

Say yes, and it calls `publish_notion_report` — your report is live.

### 4. Query Later

Ask follow-up questions about any saved report:

> "What blockers did we have in last week's report?"

> "Show me the milestone report from January 15th"

The AI uses `read_notion_reports` to fetch and explain previous reports.

## Available Tools

Acture MCP exposes the following MCP tools to your AI agent:

| Tool | Purpose |
|------|---------|
| `search_codebase` | Search commits, PRs, issues, or code |
| `list_issues` | List GitHub issues with filters |
| `read_issue` | Get full issue details and comments |
| `linked_prs` | Find PRs linked to an issue |
| `repo_metrics` | Engineering metrics and DORA data |
| `search_doc` | Search documentation with fuzzy matching |
| `read_doc` | Read full documentation file |
| `publish_notion_report` | Publish report to Notion |
| `read_notion_reports` | List or fetch saved reports |

## Available Prompts

Three specialized prompts guide report generation:

| Prompt | Best For |
|--------|----------|
| `weekly_report` | 7-day summaries of shipped features, fixes, blockers |
| `milestone_report` | Sprint retrospectives with epics, velocity, learnings |
| `standup_report` | Daily sync with yesterday/today/blockers |

### Customizing Prompts

Prompts are editable `.txt` files in `src/server/prompts/`:

- `weekly-report.txt` — Weekly report instructions
- `milestone-report.txt` — Milestone review instructions  
- `standup-report.txt` — Standup report instructions

Edit these to change how reports are generated. Restart Claude Desktop to apply changes.

## Report Structure

Reports are flexible. The AI includes sections it has data for:

- **Narrative overview** — The story of the period
- **Key accomplishments** — Specific features, fixes, improvements
- **Contributors** — Who did what
- **Impact** — Why the work matters
- **Blockers** — Current impediments (if any)
- **Metrics** — Numbers in context (not standalone)
- **Looking ahead** — Next priorities

## Storage

Published reports are tracked locally in:

```
~/.config/acture-mcp/notion-reports.json       (Linux)
~/Library/Application Support/...               (macOS)
%APPDATA%/acture-mcp/...                        (Windows)
```

Stores: ID, URL, title, template type, creation date. Last 100 reports kept.

## Commands

```bash
acture-mcp init       # Configure (token, repo, Notion)
acture-mcp sync       # Clone/pull repository
acture-mcp status     # Check configuration and sync status
```

## Requirements

- Node.js 16+
- git
- GitHub account (for API token)
- Notion account (optional, for publishing)
- Claude Desktop or other MCP-compatible agent

## Security

- GitHub token stored encrypted (AES-256-CBC)
- Notion token stored encrypted
- All data stays local except Notion API calls

## License

Apache License 2.0

## Contributing & Collaboration

Acture MCP is under active development. Issues, forks, and contributions are welcome.

- **Open an issue** for questions, ideas, or integration requests — this is the preferred starting point.
- **Forking is encouraged**, especially for new data sources, MCP tools, or report styles.
- Small, focused PRs and documentation improvements are appreciated.

### Paid Pilots

If you want Acture MCP customized, extended, or implemented in your team, I’m open to paid pilots and  design partnerships.

Contact via GitHub issues or email: **khafizov.vr@gmail.com**

