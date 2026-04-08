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
    tmux \
    locales \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
    && locale-gen

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code@2.1.96

# Create non-root user for security
# Use higher UID/GID to avoid conflicts with base image defaults
RUN groupadd --gid 10001 claude \
    && useradd --uid 10001 --gid claude --shell /bin/bash --create-home claude

# Set up workspace directory with proper ownership
RUN mkdir -p /workspace && chown claude:claude /workspace

# After installing claude and creating user, before USER switch or after; just ensure ownership
USER root
COPY claude-bootstrap.sh /usr/local/bin/claude-bootstrap
RUN chmod +x /usr/local/bin/claude-bootstrap && chown claude:claude /usr/local/bin/claude-bootstrap

USER claude
WORKDIR /workspace

ENTRYPOINT ["claude-bootstrap"]
