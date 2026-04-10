# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
bun install

# Type checking
bun run typecheck              # All packages
cd packages/core && bun run typecheck  # Core only

# Testing
cd packages/core && bun test   # Run all tests
bun test <test-file>.test.ts   # Run specific test

# Code quality
bun run format                 # Format code
bun run format:check           # Check formatting
bun run lint                   # Lint code

# Build for production
bun run build                  # All packages

# Database (schema changes)
cd packages/core
bun run db:generate            # Step 1: Generate Drizzle SQL migrations from schema files
bun run db:migrate             # Step 2: Convert SQL migrations to JS migration format in src/migrations/index.ts

# Run CLI during development
bun packages/cli/src/cli.ts --help  # Direct source execution
viwo --help                         # If globally linked

# Release
bun run release 0.1.2          # Bump version, commit, and tag
```

## Release Process

To release a new version:

1. **Bump version and create tag**:

    ```bash
    bun run release <version>
    # Example: bun run release 0.1.2
    ```

    This will:
    - Update version in `packages/core/package.json` and `packages/cli/package.json`
    - Create a git commit: "chore: bump version to X.Y.Z"
    - Create a git tag: vX.Y.Z

2. **Push to trigger release workflow**:

    ```bash
    git push origin main
    git push origin vX.Y.Z
    ```

3. **GitHub Actions workflow** (`.github/workflows/release.yml`):
    - Triggered on tag push matching `v*`
    - Builds binaries for all platforms (Linux, macOS, Windows)
    - Uses native GitHub runners for platform-specific binaries (macOS binaries are built on macOS runners, Windows on Windows, Linux on Linux)
    - Pins Bun to a known-good version for release builds
    - Creates checksums
    - Creates GitHub release with binaries attached

**Important**: Always bump package.json versions before creating git tags to keep them in sync.

## Architecture Overview

VIWO (Virtualized Isolated Worktree Orchestrator) manages git worktrees, Docker containers, and AI agents for isolated development sessions.

### Monorepo Structure

- **packages/core** (`@viwo/core`) - SDK with managers for git, docker, sessions, agents, ports, and repositories
- **packages/cli** (`@viwo/cli`) - Commander.js CLI built on core

### Key Design Patterns

**No build required during development** - Core exports TypeScript source directly (`main: "./src/index.ts"`), Bun's native TS support handles it.

**Functional manager pattern** - Each manager (`packages/core/src/managers/`) exports functions and a namespace object:

- `git-manager.ts` - Worktree operations via simple-git (including `pruneWorktrees` for cleaning up stale worktree references, and `deleteBranch` for removing local branches)
- `docker-manager.ts` - Container orchestration via dockerode
- `session-manager.ts` - Session CRUD via Drizzle ORM
- `agent-manager.ts` - AI agent initialization with automatic container lifecycle management (only Claude Code implemented)
- `repository-manager.ts` - Repository CRUD and default branch management
- `port-manager.ts` - Port allocation via get-port
- `config-manager.ts` - Configuration management (API keys, GitHub/GitLab tokens, GitLab instance URL, auth method, IDE preferences, model preference, worktrees storage location)
- `credential-manager.ts` - OAuth credential extraction from host system (macOS Keychain, Linux credential files)
- `ide-manager.ts` - IDE detection and launching
- `github-manager.ts` - GitHub issue URL detection, fetching via REST API, prompt expansion; token resolution from gh CLI/env
- `gitlab-manager.ts` - GitLab issue/MR URL detection, fetching via REST API, prompt expansion; token resolution from glab CLI/env; self-hosted instance support
- `project-config-manager.ts` - Project configuration file detection and parsing (viwo.yml/viwo.yaml)

**Schema-first validation** - All inputs validated with Zod schemas in `packages/core/src/schemas.ts`

**Centralized public types** - All public types and interfaces are exported from `packages/core/src/types.ts`. Manager files in `packages/core/src/managers/` should import types from this central file rather than exporting their own types. Internal types (not exported) can remain in manager files.

### Database

- **SQLite database** stored at `~/.viwo/sqlite.db` for new installations. Existing installations that used the legacy platform-specific directory (macOS: `~/Library/Application Support/viwo`, Linux: `~/.local/share/viwo`, Windows: `%APPDATA%/viwo`) continue using that location automatically
- **Drizzle ORM** with schemas in `packages/core/src/db-schemas/`
- **Tables**: repositories, sessions, chats, configurations
- **Repository storage**: The `repositories` table includes a `defaultBranch` field (nullable) — when set, new worktrees are based from this branch instead of HEAD
- **Configuration storage**: The `configurations` table stores user preferences including:
    - API keys (encrypted)
    - Auth method (`'api-key'` or `'oauth'`)
    - Preferred IDE
    - Preferred Claude model (`'sonnet'`, `'opus'`, or `'haiku'` — defaults to Sonnet)
    - GitHub token (encrypted) for issue fetching and container forwarding
    - GitLab token (encrypted) for issue/MR fetching and container forwarding
    - GitLab instance URL for self-hosted GitLab support
    - Worktrees storage location (supports absolute or relative paths)
- **Session storage**: The `sessions` table stores worktree session details including:
    - Container output (`containerOutput` field) - Full stdout/stderr captured when session completes or errors
- **Migrations**: Never edit `packages/core/src/migrations/index.ts` directly. The migration workflow is:
    1. Update Drizzle schema files in `packages/core/src/db-schemas/`
    2. Run `bun run db:generate` (in packages/core) to generate SQL migration files in `drizzle/`
    3. Run `bun run db:migrate` (in packages/core) to convert SQL migrations into the JS format in `src/migrations/index.ts`
    4. Migrations are applied automatically on startup via `initializeDatabase()`
- **Timestamp handling**: SQLite stores timestamps as TEXT in format `YYYY-MM-DD HH:MM:SS` using `CURRENT_TIMESTAMP`. The `parseSqliteTimestamp()` helper in `packages/core/src/utils/types.ts` converts these to JavaScript Date objects by transforming to ISO 8601 format.
- **Test isolation**: Tests automatically use in-memory databases when run with `NODE_ENV=test`. The `packages/core/src/db.ts` module detects the test environment and uses `:memory:` instead of the production database file. For explicit control, tests can use `createTestDatabase()` from `packages/core/src/test-helpers/db.ts` to create isolated database instances.

### Core SDK Flow

The main SDK in `packages/core/src/viwo.ts` exposes:

- `createViwo()` - Factory function returning Viwo instance
- `start()` - Creates worktree session: validate repo → check Docker → generate branch → create worktree → copy env → run post-install hooks → init agent
- `cleanup()` - Removes session: stop containers → remove containers → remove worktree → delete branch → update status

### Project Configuration (viwo.yml/viwo.yaml)

VIWO automatically detects and loads project-specific configuration from the repository root:

- **Configuration files**: `viwo.yml` or `viwo.yaml` (checked in this order)
- **Location**: Must be at the root of the repository
- **Schema validation**: Validated using Zod schemas in `packages/core/src/schemas.ts`
- **Supported configuration**:
    - `postInstall`: Array of shell commands to run after git worktree creation
        - Commands execute in the worktree directory
        - Commands run before agent initialization
        - If any command fails, session initialization fails and error is reported
        - Example use cases: dependency installation, environment setup, build steps

**Example configuration**:

```yaml
postInstall:
    - npm install
    - npm run build
    - cp .env.example .env
```

**Implementation**:

- `project-config-manager.ts` handles detection and parsing via YAML library
- `loadProjectConfig()` reads and validates configuration file
- `hasProjectConfig()` checks if configuration file exists
- Post-install hooks execute in `viwo.start()` flow after worktree creation

### Worktrees Storage Configuration

Git worktrees storage location is configurable through the `config-manager.ts`:

- **Default location**: `~/.viwo/worktrees/`
- **Custom location**: Users can configure a custom path via `config worktrees` CLI command
- **Path types**:
    - Absolute paths (e.g., `/home/user/viwo-worktrees`) are used as-is
    - Tilde expansion (e.g., `~/.config/viwo`) is supported and expands to the user's home directory
    - Relative paths are resolved relative to the app data directory
- **Implementation**:
    - The `paths.ts` utility provides `expandTilde()` to expand `~` to the user's home directory
    - `getWorktreesPath()` and `joinWorktreesPath()` check the configuration database first, then fall back to `~/.viwo/worktrees`
    - Existing installations may continue using a legacy data directory for the database/config, but the worktrees reset/default location is still `~/.viwo/worktrees`
    - Tilde expansion happens automatically when setting the worktrees storage location
- **Configuration methods**:
    - `setWorktreesStorageLocation(location)` - Set custom location (automatically expands tilde)
    - `getWorktreesStorageLocation()` - Get current custom location (null if using default)
    - `deleteWorktreesStorageLocation()` - Reset to default location

### Authentication

VIWO supports two authentication methods, configured via `viwo auth`:

- **API Key** (`auth_method = 'api-key'`): Traditional Anthropic API key (`sk-ant-api...`). Stored encrypted in the SQLite database. Passed to Docker container as `ANTHROPIC_API_KEY` env var.

- **OAuth / Claude Subscription** (`auth_method = 'oauth'`): For Claude Max, Pro, and Teams users. Credentials are extracted from the host's Claude Code installation at each session start (not stored in VIWO's database):
    - **macOS**: Read from Keychain service `"Claude Code-credentials"` via `security` CLI
    - **Linux**: Read from `~/.claude/.credentials.json`
    - Passed to container as `VIWO_OAUTH_CREDENTIALS` and `VIWO_OAUTH_ACCOUNT` env vars
    - The bootstrap script (`claude-bootstrap.sh`) writes them to `~/.claude/.credentials.json` inside the container, which Claude Code reads natively on Linux
    - Access tokens expire but Claude Code auto-refreshes using the refresh token

The `credential-manager.ts` handles host credential extraction, and `config-manager.ts` stores the auth method preference.

### GitHub & GitLab Integration

When a `viwo start` prompt contains GitHub issue URLs (`https://github.com/{owner}/{repo}/issues/{number}`) or GitLab issue/MR URLs (`https://gitlab.com/{group}/{project}/-/issues/{number}`, `https://gitlab.com/{group}/{project}/-/merge_requests/{number}`), VIWO automatically:

1. **Detects** supported URLs in the prompt
2. **Fetches** issue/MR content (title, body/description, labels, comments) using the provider REST API
3. **Expands** the prompt by replacing each URL with formatted markdown context
4. **Forwards** stored provider tokens into the container for API access and git auth

**GitHub token management** (`viwo config github`):

- Stored encrypted in the `configurations` table (`githubToken` field)
- Auto-detection: tries `gh auth token` CLI first, then `GITHUB_TOKEN`/`GH_TOKEN` env vars
- Manual entry also supported

**GitLab token management** (`viwo config gitlab`):

- Stored encrypted in the `configurations` table (`gitlabToken` field)
- Auto-detection: tries `glab auth token` CLI first, then `GITLAB_TOKEN` env var
- Supports a configurable self-hosted instance URL via `gitlabInstanceUrl`
- Manual entry also supported

**Implementation**:

- `github-manager.ts` handles GitHub URL parsing, API fetching, and prompt expansion
- `gitlab-manager.ts` handles GitLab issue/MR parsing, API fetching, self-hosted instance support, and prompt expansion
- `config-manager.ts` handles encrypted token CRUD and GitLab instance URL storage
- `viwo.ts` expands GitHub and GitLab URLs before starting the container
- `agent-manager.ts` injects `GITHUB_TOKEN` and `GITLAB_TOKEN` into the container env via `buildClaudeEnv()`

### Container Lifecycle Management

The `agent-manager.ts` implements automatic container cleanup:

- When a Claude Code container is started, a background monitor is set up via `monitorContainerCompletion()`
- The monitor uses Docker's `waitForContainer()` API to detect when the container exits
- Upon container exit, the monitor automatically:
    - Updates the session status to 'completed' (exit code 0) or 'error' (non-zero exit code)
    - Removes the container using `removeContainer()`
    - Logs the cleanup operation
- This ensures containers don't linger after the Claude Code process completes

### Git Inside Containers

Containers need working git for commits, pushes, and PR creation. VIWO achieves this by:

1. **Mounting the repo's `.git/` directory** at `/repo-git` inside the container (only git internals, not the repo's working tree)
2. **Rewriting the worktree's `.git` file** in `claude-bootstrap.sh` to point to `/repo-git/worktrees/<branch>` so git commands resolve correctly
3. **Configuring git credential helpers** so GitHub (`GITHUB_TOKEN`) and GitLab (`GITLAB_TOKEN`) pushes authenticate via the stored tokens

The parent repo's working tree is never mounted — the container only sees the worktree at `/workspace` and the git metadata at `/repo-git`. The `getWorktreeGitInfo()` function in `git-manager.ts` parses the worktree's `.git` file to extract the gitdir path and derive mount paths.

### Docker Integration

VIWO uses platform-specific Docker socket configuration:

- **Windows**: Named pipe at `\\.\pipe\docker_engine` (Docker Desktop, works with both WSL2 and Hyper-V backends)
- **macOS/Linux**: Unix socket at `/var/run/docker.sock`

The `docker-manager.ts` automatically detects the platform via `process.platform` and configures the correct socket path. This ensures Docker connectivity works reliably across all supported operating systems without requiring manual configuration.

### Docker State Synchronization

The `docker-manager.ts` provides `syncDockerState()` to keep the database in sync with Docker container states:

- **Automatic sync**: Called by `viwo list` command before displaying sessions to ensure accurate status
- **Container output capture**: When a session transitions to 'completed' or 'error' status, the full container stdout/stderr is captured and stored in the `sessions.containerOutput` field
- **Incremental log capture**: For running sessions, captures logs since `lastActivity` timestamp and stores them in the `chats` table
- **Status updates**: Syncs container state (running, exited, etc.) with session status in the database
- **Session details display**: The `viwo list` command shows captured container output in session details, with preview of first 500 characters for long outputs

### CLI Commands

Commands in `packages/cli/src/commands/`:

- `start` - Initialize new session with prompt and agent
    - Interactive multiline prompt that supports pasting multiple lines
    - Press Enter on an empty line or Ctrl+D to finish entering prompt
    - Allows users to paste large blocks of text without triggering execution
    - After initialization, displays session details and exits automatically
    - Container continues running in the background
- `list` - List all sessions in interactive mode
    - Keyboard-navigable list using @inquirer/prompts with session details and actions (cd to worktree, delete, go back)
- `clean` - Clean up all completed, errored, stopped, or initializing sessions (marks as 'cleaned', removes worktrees, deletes associated local branches, and runs `git worktree prune` for affected repositories)
- `auth` - Configure authentication method
    - Choose between Claude subscription (OAuth auto-detect) or Anthropic API key
    - OAuth mode detects credentials from host's Claude Code installation
    - Displays subscription details (email, org, expiry) for confirmation
- `repo` - Repository management (list, add, delete, set-branch)
    - `set-branch` sets a default branch per repository so worktrees are always based from it instead of HEAD
- `config model` - Configure preferred Claude model (sonnet, opus, haiku)
- `config ide` - Configure default IDE preference
    - Interactive list showing available IDEs on the system
    - Displays current default IDE setting
    - Allows changing to a different IDE or removing the default (prompts each time)
- `config worktrees` - Configure worktrees storage location
    - View current worktrees storage location (custom or default)
    - Set custom location (absolute or relative to app data directory)
    - Reset to default location (`~/.viwo/worktrees`)
- `config github` - Configure GitHub integration
    - Auto-detect token from `gh` CLI or `GITHUB_TOKEN` env var
    - Manual token entry
    - View status and remove stored token
- `config gitlab` - Configure GitLab integration
    - Auto-detect token from `glab` CLI or `GITLAB_TOKEN` env var
    - Manual token entry
    - Configure/reset self-hosted GitLab instance URL
    - View status and remove stored token
- `attach` - Attach to a running Claude Code session via tmux
    - With no args, shows interactive list of running sessions to choose from
    - With `<session-id>`, attaches directly to the specified session
    - Runs `docker exec -it viwo-{identifier} tmux attach -t viwo`
    - Prints detach hint (Ctrl+B, D) before attaching
    - Errors if container doesn't exist or isn't running

### Preflight Checks & Version Checking

The CLI performs automatic preflight checks before running commands via `packages/cli/src/utils/prerequisites.ts`:

- **Database migration** - Runs `viwo.migrate()` to ensure the database is up to date
- **Git installation** - Verifies git is available in PATH
- **Docker daemon** - Checks if Docker is running
- **Version check** - Compares current CLI version against latest GitHub release
    - Fetches latest version from GitHub releases API (`/repos/OverseedAI/viwo/releases/latest`)
    - Shows non-blocking warning when newer version is available
    - Displays update instructions: re-run install script or download from GitHub releases
    - Uses semantic version comparison (major.minor.patch)

The main function is `preflightChecksOrExit()` which:

- Runs database migrations first (exits on failure)
- Checks for git and Docker availability (configurable via options)
- Shows version update warnings (non-blocking)
- Called by all CLI commands including `viwo config` commands

## Testing

Tests use Bun's native test runner (`bun:test`). Test files are in `__tests__` directories with `.test.ts` suffix.

**Database isolation**: Tests automatically use in-memory databases to avoid overwriting production data. When running `bun run test` (or `bun test` directly in the core package), the `NODE_ENV=test` environment variable is set, which triggers the use of an in-memory SQLite database. Tests can also explicitly create isolated databases using `createTestDatabase()` from `packages/core/src/test-helpers/db.ts`.

Current test coverage focuses on:

- `git-manager.test.ts` - Branch name generation, repo validation, worktree pruning
- `docker-manager.test.ts` - Docker daemon status
- `agent-manager.test.ts` - Claude Code agent initialization (demonstrates test database usage)
- `credential-manager.test.ts` - OAuth token expiration, credential schema validation
- `prerequisites.test.ts` - Version comparison logic for update checking
- `formatters.test.ts` - Date formatting utilities

## Key Dependencies

- **drizzle-orm** - SQLite ORM
- **simple-git** - Git operations
- **dockerode** - Docker API
- **yaml** - YAML parsing for project configuration files
- **zod** - Runtime validation
- **commander** - CLI framework
- **@inquirer/prompts** - Interactive CLI prompts with keyboard navigation
- **chalk/ora** - CLI UI

## Non-Interactive CLI Usage (Agent Testing)

All CLI commands support fully non-interactive, flag-based execution for agent-driven workflows. When all required flags are provided, no interactive prompt is triggered.

```bash
# Start a session non-interactively
viwo start --repo <id> --branch <name> --prompt "Your prompt here"
viwo start --repo <id> --prompt-file ./prompt.txt

# List sessions as JSON
viwo list --json
viwo list --json --status running

# Configure auth
viwo auth --method oauth
viwo auth --api-key sk-ant-...

# Configure auth via config subcommand
viwo config auth --method oauth
viwo config auth --set sk-ant-...

# Configure model, IDE, worktrees
viwo config model --set opus
viwo config model --reset
viwo config ide --set vscode
viwo config ide --reset
viwo config worktrees --set /path/to/worktrees
viwo config worktrees --reset

# Configure GitHub token
viwo config github --auto
viwo config github --set <token>
viwo config github --remove
viwo config github --status

# Configure GitLab token / instance
viwo config gitlab --auto
viwo config gitlab --set <token>
viwo config gitlab --instance https://gitlab.company.com
viwo config gitlab --reset-instance
viwo config gitlab --remove
viwo config gitlab --status

# List repos as JSON
viwo repo list --json
```

## End-to-End Verification

After making changes to the codebase, verify the full session lifecycle using the development CLI (`bun packages/cli/src/cli.ts` or alias as `bun viwo`). This ensures Docker, git worktrees, and the agent pipeline work together correctly.

### Verification Steps

1. **List available repos** to get a repo ID:

    ```bash
    bun packages/cli/src/cli.ts repo list --json
    ```

2. **Start a test session non-interactively** (all flags required to skip prompts):

    ```bash
    bun packages/cli/src/cli.ts start \
      --repo <id> \
      --branch test-verify \
      --prompt "Say hello and then exit. Do not make any changes to the codebase."
    ```

    Confirm the CLI prints session details (ID, branch, worktree path, container name) and reports status as `running`.

3. **Verify container is running** via Docker directly:

    ```bash
    docker ps --filter "name=viwo-<container-name>"
    ```

4. **Cross-check with viwo list** to confirm the CLI's view matches Docker state:

    ```bash
    bun packages/cli/src/cli.ts list --json --status running
    ```

    Verify `status` is `"running"` and container info matches the `docker ps` output.

5. **Verify the Claude Code session received the prompt** inside the container:

    ```bash
    docker exec <container-name> tmux capture-pane -t viwo -p
    ```

    Confirm the prompt text appears and Claude Code has responded.

6. **Clean up** after verification:

    ```bash
    # Stop the container first
    docker stop <container-name>
    # Then clean the session
    bun packages/cli/src/cli.ts clean
    ```

### Key Points

- Always use `bun packages/cli/src/cli.ts` (not the globally installed `viwo`) to test development changes.
- Verify each layer independently: CLI output, Docker state (`docker ps`), and in-container state (`tmux capture-pane`). Don't assume one layer is correct because another looks fine.
- The `--repo`, `--branch`, and `--prompt` flags are all required for fully non-interactive `start`.

## Known Limitations

- Only Claude Code agent is implemented (Cline, Cursor throw "not yet implemented")
- Docker Compose support is incomplete
- Session storage uses in-memory Map alongside database (migration in progress)

## Instructions to Keep in Mind

- As you make changes to the codebase, come back to this file (CLAUDE.md) and make updates whenever a structure or flow is updated.
- Always follow DRY principles
- If your code changes renders a function or variable obsolete, make sure to remove it.
- Always follow existing coding patterns in the codebase. For example, if the code uses a request client like Axios, then stick to using the established agent rather than calling the native `fetch` API.
- Follow the 'less is more' paradigm where applicable. Strike a good balance between readability and succinctness of code.
- Prefer using a typed object for function arguments rather than a series of positional arguments.
- Use arrow functions over traditional functions.
- Imports should always just use the file name. Do not append .js at the end.
