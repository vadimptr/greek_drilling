#!/bin/sh
# Скачивает ggml-модель, если её ещё нет, и запускает whisper-server на греческом языке.
set -eu
MODEL_FILE="/models/ggml-${WHISPER_MODEL}.bin"
if [ ! -s "$MODEL_FILE" ]; then
  echo "downloading model ${WHISPER_MODEL}..."
  curl -fL --retry 5 -o "$MODEL_FILE.part" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${WHISPER_MODEL}.bin"
  mv "$MODEL_FILE.part" "$MODEL_FILE"
fi
# -ac 768: окно энкодера ~15 с вместо 30 (наши записи ≤ 4 с) — в 2–3 раза быстрее;
# -bs 1: жадное декодирование; -nf: без перебора температур. На M2 Pro в docker: ~1.5 с на слово.
exec whisper-server -m "$MODEL_FILE" -l el -t "$WHISPER_THREADS" --host 0.0.0.0 --port 8080 \
  --no-timestamps -nf -ac 768 -bs 1
