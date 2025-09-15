# virtual-workspaces

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.js
```

## About this project

`viwo`, or **vi**rtual **wo**rktrees, is a tool to help scaffold virtualized
environments on your local machine for you to run AI Agents. This brings the following
benefits:

**🔒 Enhanced Security**

- Isolate AI agents within specific directories to limit potential damage
- Prevent agents from accessing or modifying files outside their designated workspace
- Reduce risk of unintended system-wide changes or sensitive data exposure

**🚀 Improved Productivity**

- Run multiple AI agents simultaneously on different projects or branches
- Enable parallel development workflows without interference
- Maintain separate development contexts for different tasks or experiments

**🔀 Reduced Code Conflicts**

- Leverage Git worktrees to create isolated copies of your repository
- Work on multiple features or branches simultaneously without switching contexts
- Eliminate merge conflicts caused by concurrent AI agent operations
- Maintain clean, separate environments for different development phases

## CLI Usage

### Installation

Install the package globally to use the CLI:

```bash
npm install -g viwo
# or
bun install -g viwo
```

### Prerequisites

The CLI requires the following tools to be installed and running:

- **Docker** - Both CLI and daemon must be available
- **Git** - For repository management and worktree operations

### Commands

#### List Workspaces

View all available virtual workspaces:

```bash
# Human-readable format
viwo list

# JSON output for programmatic use
viwo list --json
```

Example output:

```
Available Workspaces:
====================

ID: 1
Name: Frontend Project
Path: /Users/dev/projects/frontend
Description: React-based frontend application
Tags: react, typescript, frontend
Created: 2024-01-01
Updated: 2024-01-15
```

### Development

For development, you can run the CLI directly from source:

```bash
# Clone the repository
git clone https://github.com/OverseedAI/virtual-workspaces.git
cd virtual-workspaces

# Install dependencies
bun install

# Run CLI in development mode
bun run dev list
bun run dev list --json
```

### Testing

See [TESTING.md](./TESTING.md) for details on running and contributing to tests. The short version:

```bash
bun test
```
