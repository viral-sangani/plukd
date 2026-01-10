# Commit, Create PR, and Push

This skill automates the complete workflow of committing your changes, creating a pull request, and pushing to the remote repository for the plukd project.

## Workflow

Follow these steps in order:

### 1. Check Current Status

First, understand the current state:

- Run `git status` to see all untracked and modified files
- Run `git diff` to see staged and unstaged changes
- Run `git branch` to see current branch name
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

### 4. Create Commit

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

### 5. Handle Pre-commit Hooks

If pre-commit hooks fail:

- Fix the issues (linting, type errors, etc.)
- Stage the fixes
- Create a NEW commit (do NOT amend unless explicitly told)
- Verify the commit succeeded with `git status`

### 6. Push to Remote

- If the current branch doesn't have an upstream, push with `-u` flag:
  ```bash
  git push -u origin <branch-name>
  ```
- If the branch already has an upstream, just push:
  ```bash
  git push
  ```

### 7. Create Pull Request

- Run `git diff main...HEAD` to understand all changes since branching from main
- Run `git log main..HEAD` to see all commits that will be in the PR
- Analyze ALL commits (not just the latest) to understand the full scope
- Draft a PR summary with:
  - **Title**: Clear, descriptive (e.g., "Add AI reply generation feature")
  - **Summary**: 1-3 bullet points describing the changes
  - **Test plan**: Bulleted checklist of how to test the changes
  - **Claude Code signature** at the end
- Create the PR using:

  ```bash
  gh pr create --title "PR title" --body "$(cat <<'EOF'
  ## Summary
  - Bullet point 1
  - Bullet point 2

  ## Test plan
  - [ ] Test item 1
  - [ ] Test item 2

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```

- Return the PR URL to the user

## Important Notes

### DO NOT:

- Commit files with sensitive data (.env files, API keys, credentials, secrets)
- Skip secret checking - this is CRITICAL
- Use `git commit --amend` unless the user explicitly requests it
- Skip pre-commit hooks with `--no-verify`
- Create PRs without analyzing the full diff from main
- Batch multiple unrelated changes in one commit

### DO:

- **ALWAYS check for secrets before committing** - this is mandatory
- Verify all changes before committing
- Follow the plukd commit message style
- Handle pre-commit hook failures gracefully
- Create descriptive PR summaries based on ALL commits
- Return the PR URL when done
- Use HEREDOC for multi-line commit and PR messages

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

User runs: `/commit-pr-push`

Assistant should:

1. Check git status and diff
2. **Check for secrets** (mandatory step)
3. Stage appropriate files
4. Create commit with descriptive message
5. Push to remote (with -u if needed)
6. Analyze full diff from main
7. Create PR with summary and test plan
8. Return PR URL

## Error Handling

If any step fails:

- **Secrets found**: STOP immediately, inform user
- **Commit fails**: Fix issues, create new commit
- **Push fails**: Check if branch exists, handle conflicts
- **PR creation fails**: Ensure `gh` CLI is installed and authenticated
- **Pre-commit hook fails**: Fix issues, don't skip hooks

## Project Context

This skill is for the **plukd** project:

- Monorepo with packages: backend, frontend, shared
- Uses pnpm for package management
- Has pre-commit hooks for linting and type checking
- Main branch: `main`
- Tech stack: Express.js, Next.js, Supabase, TypeScript
