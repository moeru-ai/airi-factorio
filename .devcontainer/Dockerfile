# Factorio does not have stable support for arm64
FROM --platform=linux/amd64 factoriotools/factorio:2.0.30

# install nodejs
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get update && apt-get install -y nodejs git file
RUN corepack enable
RUN corepack prepare pnpm@10.0.0 --activate
