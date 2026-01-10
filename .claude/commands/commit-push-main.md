# Commit and Push to Main

This skill automates the workflow of committing your changes and pushing directly to the main branch for the plukd project.

**⚠️ WARNING: This command pushes directly to main. Use with caution and only for safe, tested changes.**

## Workflow

Follow these steps in order:

### 1. Check Current Status

First, understand the current state:

- Run `git status` to see all untracked and modified files
- Run `git diff` to see staged and unstaged changes
- Run `git branch` to verify you're on the `main` branch (or will switch to it)
- Run `git log -3 --oneline` to see recent commits for commit message style

### 2. Check for Secrets and Sensitive Data

**CRITICAL: Before committing, thoroughly check for secrets:**

- Run `git diff` and review ALL changes line by line
- Check for common secret patterns:
  - API keys (look for patterns like `api_key`, `apikey`, `secret`, `token`)
  - Passwords (look for `password`, `pwd`, `passwd`)
  - Database credentials (connection strings, usernames, passwords)
  - Environment variables that might contain secrets (`.env` files)
  - Private keys (`.pem`, `.key` files)
  - OAuth tokens, JWT secrets
  - AWS/Azure/GCP credentials
- Use `grep` to search staged files for suspicious patterns:
  ```bash
  git diff --cached | grep -iE "(api[_-]?key|secret|password|token|credential)" || echo "No obvious secrets found"
  ```
- Verify no `.env` files are being committed (check `.gitignore` is working)
- Check that no hardcoded credentials exist in code
- If ANY secrets are found, STOP and remove them before proceeding

### 3. Analyze Changes

Before committing:

- Review all changes carefully
- Identify the nature of changes (feature, fix, refactor, docs, etc.)
- Ensure no sensitive files are being committed (.env files, credentials, etc.)
- Check that the changes are cohesive and belong in one commit
- Verify changes are safe to push directly to main (no breaking changes, tested)

### 4. Switch to Main Branch (if needed)

If not already on main:

- Check current branch: `git branch`
- Switch to main: `git checkout main` or `git switch main`
- Pull latest changes: `git pull origin main`
- Ensure your changes are applied (merge/rebase if needed)

### 5. Create Commit

- Stage relevant files with `git add <files>`
- Create a descriptive commit message that:

  - Summarizes the "why" rather than just the "what"
  - Follows the plukd commit style (check recent commits)
  - Is concise (1-2 sentences)
  - Ends with the Claude Code signature:

    ```

    🤖 Generated with [Claude Code](https://claude.com/claude-code)

    Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
    ```

- Use a HEREDOC for proper formatting:

  ```bash
  git commit -m "$(cat <<'EOF'
  Your commit message here.

  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
  EOF
  )"
  ```

### 6. Handle Pre-commit Hooks

If pre-commit hooks fail:

- Fix the issues (linting, type errors, etc.)
- Stage the fixes
- Create a NEW commit (do NOT amend unless explicitly told)
- Verify the commit succeeded with `git status`

### 7. Push to Main

**⚠️ Final verification before pushing:**

- Double-check you're on the `main` branch: `git branch`
- Review the commit one more time: `git show HEAD`
- Push to main:

  ```bash
  git push origin main
  ```

- If push fails due to conflicts, pull and resolve:
  ```bash
  git pull origin main
  # Resolve conflicts
  git add <resolved-files>
  git commit -m "Resolve merge conflicts"
  git push origin main
  ```

## Important Notes

### DO NOT:

- Commit files with sensitive data (.env files, API keys, credentials, secrets)
- Push to main without thorough review of all changes
- Skip secret checking - this is CRITICAL
- Use `git commit --amend` unless the user explicitly requests it
- Skip pre-commit hooks with `--no-verify`
- Push untested or breaking changes to main
- Batch multiple unrelated changes in one commit

### DO:

- **ALWAYS check for secrets before committing** - this is mandatory
- Verify all changes before committing
- Follow the plukd commit message style
- Handle pre-commit hook failures gracefully
- Ensure you're on the main branch before pushing
- Pull latest changes before pushing to avoid conflicts
- Use HEREDOC for multi-line commit messages
- Double-check the commit before pushing to main

## Secret Checking Checklist

Before every commit, verify:

- [ ] No `.env` files in staged changes
- [ ] No API keys or tokens in code
- [ ] No hardcoded passwords or credentials
- [ ] No database connection strings with credentials
- [ ] No private keys or certificates
- [ ] Ran `grep` check for common secret patterns
- [ ] Reviewed all file diffs manually
- [ ] Verified `.gitignore` is excluding sensitive files

## Example Usage

User runs: `/commit-push-main`

Assistant should:

1. Check git status and diff
2. **Check for secrets** (mandatory step)
3. Verify on main branch (or switch to it)
4. Pull latest changes from main
5. Stage appropriate files
6. Create commit with descriptive message
7. Push to main
8. Confirm push succeeded

## Error Handling

If any step fails:

- **Secrets found**: STOP immediately, remove secrets, inform user
- **Commit fails**: Fix issues, create new commit
- **Push fails**: Check for conflicts, pull and resolve, then push again
- **Pre-commit hook fails**: Fix issues, don't skip hooks
- **Not on main**: Switch to main, ensure changes are preserved

## Project Context

This skill is for the **plukd** project:

- Monorepo with packages: backend, frontend, shared
- Uses pnpm for package management
- Has pre-commit hooks for linting and type checking
- Main branch: `main`
- Tech stack: Express.js, Next.js, Supabase, TypeScript
