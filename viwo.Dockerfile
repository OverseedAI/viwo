FROM overseedai/viwo-claude-code:0.10.1

USER root

# Bun's official installer needs `unzip` to extract its archive. Install
# both unzip and Bun itself at build time so each session starts fast and
# the preAgent hook just runs `bun install`.
RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash -s "bun-v1.1.34" \
    && chmod +x /usr/local/bin/bun

USER claude
