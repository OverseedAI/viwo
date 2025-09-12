# Project Outline

The main objective of the project is to create a CLI application that can also be
used as a Node library to manage containerized git worktrees using Docker. This
is done for the purpose of running AI agents in these environments with
`dangerously-skip-permissions` or other similar flags while limiting the potential
runaway damage caused by the AI agent.

## Target APIs

- `viwo list` - List current worktrees.
- `viwo add [name]` - Creates a worktree with [name].
- `viwo remove [name]` - Removes worktree. Cleans up directories/files and runs `git worktree remove`.
- `viwo dev [name]` - Starts a Docker container with the given worktree and execs into it and starts a Claude Code or
  Codex instance.
- `viwo version` - Should print the current app name and version.
- `viwo settings` - Should give the user the ability to set a default tool between Claude Code and Codex.
- `viwo update` - Updates the CLI to the latest version.
- `viwo help` - Should be an alias for `viwo -h` or `viwo --help`, but basically prints the docs to viwo.

## Considerations

- The project should be written in TypeScript and follow Test Driven Development standards.
- The runtime should be Bun.js
- The CLI part of the app should have APIs that match the SDK. There should be a core API that takes a standard set of
  inputs for each function and merely gathers the required parameters through the CLI or SDK. For clarification, the
  core API should be reused between the CLI and SDK.
- There should be a schema validator like Zod to verify that the incoming parameter structure from either the CLI or SDK is consistent with what the core API expects.
- The repository should follow functional programming paradigms, but can break away from the paradigm where it makes sense.
- In general, the core APIs will take time to complete, such as spinning up a docker container or setting up a git worktree. As such, most core APIs should be asynchronous in nature so we do not run into race conditions.
