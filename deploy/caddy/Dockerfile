# Caddy с плагинами: выдача сертификата через DNS Cloudflare и обновление A-записи при смене домашнего IP.
FROM caddy:2-builder AS builder
RUN xcaddy build \
    --with github.com/caddy-dns/cloudflare \
    --with github.com/mholt/caddy-dynamicdns

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
