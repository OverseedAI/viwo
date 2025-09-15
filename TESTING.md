# Testing Guide

This project uses [Bun](https://bun.sh) and its built‑in test runner. Tests live in the `tests` directory and use the `.test.ts` suffix.

## Running Tests

```bash
bun test
```

The command above runs the full test suite. To run a single test file, provide its path:

```bash
bun test tests/worktree-manager.test.ts
```

## Writing Tests

- Place new tests in the `tests/` folder.
- Use `describe` and `it` blocks from `bun:test` for structure.
- Name files after the module under test, e.g. `core.test.ts`.
- Mock external CLI calls (Git, Docker, etc.) so tests remain fast and idempotent. The built-in `mock.module` helper from `bun:test` is used for this project.
- Each new feature or bug fix should include corresponding tests.
- Run `bun run format` before committing to ensure consistent style.

## Contributing

1. Create your tests following the guidelines above.
2. Run `bun test` and ensure all tests pass.
3. Submit your pull request with a clear description of the changes.
