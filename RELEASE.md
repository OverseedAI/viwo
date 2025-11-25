1. Build locally (optional, to test):
   cd packages/cli
   bun run build:binaries
2. Create and push a version tag:
   git tag v0.1.0
   git push origin v0.1.0
3. GitHub Actions will automatically:
   - Build all platform binaries
   - Create a GitHub Release
   - Upload binaries and checksums
4. Users can then install with the one-liner above

Next Steps

1. Commit these changes to git
2. When ready for your first release, create a tag: git tag v0.1.0 && git push origin v0.1.0
3. Users can install with: curl -fsSL https://raw.githubusercontent.com/OverseedAI/viwo/main/install.sh |
   bash

The binaries are ~60-100MB each (self-contained with Bun runtime), so no Node/Bun installation required
for end users!
