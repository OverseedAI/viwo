# Claude Code CLI Container
# Optimized for running: claude --dangerously-skip-permissions [PROMPT]

FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install essential packages and Node.js in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user for security
# Use higher UID/GID to avoid conflicts with base image defaults
RUN groupadd --gid 10001 claude \
    && useradd --uid 10001 --gid claude --shell /bin/bash --create-home claude

# Set up workspace directory with proper ownership
RUN mkdir -p /workspace && chown claude:claude /workspace

# Switch to non-root user
USER claude

# Set working directory
WORKDIR /workspace

# Default command shows help
CMD ["claude", "--help"]