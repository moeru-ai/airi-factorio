FROM --platform=linux/amd64 ubuntu:22.04

ARG factorio_version
ARG factorio_login
ARG factorio_pwd

WORKDIR /workspace

# factorio downloader dependencies
RUN apt-get update
RUN apt-get install -y \
    wget \
    curl \
    jq \
    xz-utils \
    ca-certificates

RUN wget https://raw.githubusercontent.com/moviuro/factorio-dl/refs/heads/master/factorio-dl
RUN chmod +x factorio-dl

# avoid password prompt
COPY factorio_dl_wrapper.sh /workspace/factorio_dl_wrapper.sh
RUN chmod +x factorio_dl_wrapper.sh

RUN ./factorio_dl_wrapper.sh
RUN ls

RUN tar -xvf factorio_linux_${factorio_version}.tar.xz

ENV DEBIAN_FRONTEND=noninteractive

# factorio dependencies
RUN apt-get install -y \
    # graphics
    xvfb x11-apps mesa-utils \
    # noVNC
    x11vnc novnc websockify

COPY start-factorio.sh /workspace/start-factorio.sh
RUN chmod +x start-factorio.sh

# clean
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# start
ENV DISPLAY=:1
EXPOSE 5900 5901

ENTRYPOINT ["./start-factorio.sh"]
