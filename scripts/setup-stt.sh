#!/bin/bash
# FlowTate — one-time STT setup: whisper-cpp + ffmpeg + base.en model (~150MB).
set -e
export PATH="/opt/homebrew/bin:$PATH"
brew install whisper-cpp ffmpeg || true
mkdir -p ~/flowtate/models
if [ ! -f ~/flowtate/models/ggml-base.en.bin ]; then
  curl -L -o ~/flowtate/models/ggml-base.en.bin \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
fi
echo "STT setup done. Model: ~/flowtate/models/ggml-base.en.bin"
