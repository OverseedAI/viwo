# viwo

TypeScript monorepo powered by Bun.

## Structure

```
viwo/
├── packages/        # Shared packages (@viwo/*)
│   ├── core/       # Core functionality
│   └── cli/        # CLI tool
└── apps/           # Standalone applications
```

## Setup

```bash
bun install
```

## Development

```bash
# Build all packages
bun run build

# Run type checking
bun run typecheck

# Lint code
bun run lint

# Format code
bun run format
```
