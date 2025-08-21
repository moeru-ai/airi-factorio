#!/bin/bash

Xvfb $DISPLAY -screen 0 640x640x16 &

while ! xdpyinfo -display $DISPLAY >/dev/null 2>&1; do
  sleep 0.1
done

x11vnc -display $DISPLAY -nopw -forever &
websockify --web=/usr/share/novnc/ 5901 localhost:5900 &

./factorio/bin/x64/factorio \
  --disable-audio \
  --force-graphics-preset very-low \
  --window-size 640x640 \
  --graphics-quality low \
  --video-memory-usage low
