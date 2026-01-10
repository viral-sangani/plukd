# Claude Code Configuration for Plukd

This directory contains project-level Claude Code configurations that are shared across all team members and between your local and server installations.

## Structure

```
.claude/
├── settings.json    # Project-level settings, plugins, hooks, auto-approved tools
├── agents/          # Custom agents for plukd development
├── skills/          # Custom skills (shortcuts/workflows)
└── README.md        # This file

../.mcp.json         # Project MCP servers (context7, claude-in-chrome, supabase, etc.)
```

## What's Configured

### MCP Servers (`.mcp.json`)
- **context7**: Documentation lookup for libraries
- **claude-in-chrome**: Browser automation for testing
- **Parallel-search-mcp**: Web search capabilities
- **supabase**: Database management (requires env vars)

### Plugins (`settings.json`)
- **pr-review-toolkit**: Comprehensive PR review agents
- **code-review**: Basic code review
- **frontend-design**: UI component creation
- **figma**: Figma-to-code workflow

### Custom Agents (`agents/`)
Development agents:
- `senior-developer-generic.md` - Feature implementation
- `code-analyzer.md` - Code quality analysis
- `code-cleaner.md` - Dead code removal, refactoring

Testing agents:
- `test-auditor.md` - Test coverage analysis
- `test-writer.md` - Test generation with mocks

Review/Security agents:
- `pr-reviewer.md` - PR review
- `security-auditor.md` - Security vulnerability scanning
- `error-logging-auditor.md` - Error handling audit

### Custom Skills (`skills/`)
- `/commit-pr-push` - Automate commit → create PR → push workflow

### Auto-Approved Tools
Pre-approved tools that don't require permission prompts:
- Package management: `pnpm install`, `pnpm add`, `npm install`
- Build commands: `pnpm build`, `pnpm dev`, `pnpm lint`
- Database: `npx supabase`
- Git read operations: `git diff`, `git status`, `git log`
- Web fetches to trusted domains (supabase.com, grammy.dev, etc.)

### Hooks
- **pre-commit**: Runs `pnpm lint && pnpm typecheck`
- **post-build**: Success confirmation message

## Environment Variables Required

The following environment variables must be set before running Claude Code:

```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
export TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
export GOPHER_API_KEY="your-gopher-api-key"
export GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"
```

These are referenced in `settings.json` as `${VARIABLE_NAME}` and used by MCP servers and hooks.

## Syncing Between Local & Server

### First Time Setup on Server

1. Clone the plukd repository
2. Set environment variables (see above)
3. Open project in Claude Code - you'll be prompted to:
   - Trust the project folder
   - Approve MCP servers from `.mcp.json`
   - Install plugins from `settings.json`

### Keeping Configs in Sync

Since these are **project-level configs**, they're automatically synced via git:

```bash
# On local machine - commit changes
git add .claude/ .mcp.json
git commit -m "Update Claude Code configs"
git push

# On server - pull changes
git pull
# Claude Code will detect changes and prompt for approval
```

### Global/User-Level Configs

For your **personal** global configs (not in this repo):

**On local machine:**
```bash
# View your global configs
cat ~/.claude/settings.json
cat ~/.claude.json  # Contains MCP servers + auth tokens

# To export (manually copy to server)
scp ~/.claude/settings.json user@server:~/.claude/
```

**Important:** Never commit `~/.claude.json` as it contains auth tokens!

## What to Commit to Git

✅ **Safe to commit:**
- `.claude/settings.json`
- `.claude/agents/`
- `.claude/skills/`
- `.mcp.json`
- This README

❌ **Never commit:**
- `~/.claude.json` (contains auth tokens)
- API keys or secrets directly in files
- `.claude/settings.local.json` (machine-specific overrides)

## First Time Using This Project

When you first open plukd in Claude Code, you'll see prompts:

1. **Trust this folder?** → Yes (to enable project configs)
2. **Approve MCP servers?** → Review and approve each server
3. **Install plugins?** → Yes (installs the 4 configured plugins)

After approval, all tools and agents will be available for development.

## Manual Configuration Updates

To modify project configurations:

1. **Add/remove MCP servers:** Edit `.mcp.json`
2. **Add/remove plugins:** Edit `.claude/settings.json` → `enabledPlugins`
3. **Modify auto-approved tools:** Edit `.claude/settings.json` → `autoApprovedTools`
4. **Add custom agents:** Add `.md` files to `.claude/agents/`
5. **Add custom skills:** Add `.md` files to `.claude/skills/` with `invocable: true` in frontmatter
6. **Update hooks:** Edit `.claude/settings.json` → `hooks`

Then commit and push changes so team members get updates.

## Troubleshooting

**Q: MCP servers not working?**
- Ensure environment variables are set before starting Claude Code
- Check that you approved the servers when prompted

**Q: Plugins not installed?**
- Run `claude plugin install <plugin-name>@claude-plugins-official --scope project`

**Q: Agents not showing up?**
- Ensure `.claude/agents/` directory exists with `.md` files
- Check file permissions (should be readable)

**Q: Different configs on local vs server?**
- Pull latest changes from git: `git pull`
- Check if you have local overrides in `~/.claude/settings.json`
