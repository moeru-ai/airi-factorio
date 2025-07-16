# Factorio does not have stable support for arm64
FROM factoriotools/factorio:2.0.30

ARG PNPM_VERSION=10.13.1
ENV PNPM_VERSION=${PNPM_VERSION:-10.13.1}
# https://pnpm.io/docker
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# install nodejs
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
RUN apt-get update && apt-get install -y nodejs git file curl ca-certificates
RUN corepack enable

# install debug tools
RUN apt-get install -y lsof net-tools iproute2 telnet procps

# install pnpm
RUN export NPM_PKG_SHA_PNPM=$(npm view pnpm@$PNPM_VERSION dist.shasum) && \
    corepack prepare pnpm@$PNPM_VERSION+sha1.$NPM_PKG_SHA_PNPM --activate

# install ni
RUN pnpm install -g @antfu/ni
