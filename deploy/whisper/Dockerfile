# whisper.cpp HTTP-сервер для распознавания греческой речи. Собирается из исходников под arm64 (официальный
# образ только amd64). Модель скачивается при первом старте в volume /models.
FROM ubuntu:24.04 AS build
ARG WHISPER_REF=v1.9.3
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 --branch ${WHISPER_REF} https://github.com/ggml-org/whisper.cpp.git . \
    && cmake -B build -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --config Release --target whisper-server -j"$(nproc)"

FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/build/bin/whisper-server /usr/local/bin/whisper-server
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENV WHISPER_MODEL=small WHISPER_THREADS=6
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
