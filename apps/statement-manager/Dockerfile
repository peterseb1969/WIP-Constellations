# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY apps/statement-manager/package*.json ./
RUN npm ci
COPY apps/statement-manager/ .
RUN npm run build

# Stage 2: Serve
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY apps/statement-manager/Caddyfile /etc/caddy/Caddyfile
COPY apps/statement-manager/docker-entrypoint.sh /docker-entrypoint.sh
COPY apps/statement-manager/app-manifest.json /app/app-manifest.json
COPY data-model/ /app/data-model/
RUN chmod +x /docker-entrypoint.sh
EXPOSE 3001
ENTRYPOINT ["/docker-entrypoint.sh"]
