---
allowed-tools: Bash(git checkout --branch:*), Bash(git add:*), Bash(git status:*), Bash(git push:*), Bash(git commit:*), Bash(gh pr create:*)
description: Commit, push, and open a PR
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`

## Your task

Based on the above changes:
1. Create a new branch if on main
2. Push the branch to origin
3. Create a pull request using `gh pr create`. If your current branch starts with `dev-###`, always start the PR title with `[DEV-###] ` and use the remaining branch name as the PR title.
4. For the description, summarize the `git diff` in 2~3 lines for short PRs and 4~5 lines for big PRs.
5. You have the capability to call multiple tools in a single response. You MUST do all of the above in a single message. Do not use any other tools or do anything else. Do not send any other text or messages besides these tool calls.
