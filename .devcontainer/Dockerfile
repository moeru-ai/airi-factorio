FROM factoriotools/factorio:2.0.28

# install nodejs
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
RUN sudo apt-get install -y nodejs
RUN corepack enable
RUN corepack prepare pnpm@10.0.0 --activate
