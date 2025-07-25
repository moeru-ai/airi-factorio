#!/bin/bash

Xvfb $DISPLAY -screen 0 1024x768x16 &

while ! xdpyinfo -display $DISPLAY >/dev/null 2>&1; do
  sleep 0.1
done

x11vnc -display $DISPLAY -nopw -forever &

./factorio/bin/x64/factorio
