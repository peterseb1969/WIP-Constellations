# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files and local lib tarballs
COPY apps/statement-manager/package.json ./
COPY apps/statement-manager/wip-client-0.1.0.tgz ./
COPY apps/statement-manager/wip-react-0.1.0.tgz ./

# Rewrite file: deps to local tarballs and install
RUN sed -i 's|"file:/Users/peter/Development/WorldInPie/libs/wip-client"|"file:./wip-client-0.1.0.tgz"|' package.json && \
    sed -i 's|"file:/Users/peter/Development/WorldInPie/libs/wip-react"|"file:./wip-react-0.1.0.tgz"|' package.json && \
    npm install --ignore-scripts

# Copy source (node_modules already installed above)
COPY apps/statement-manager/src ./src
COPY apps/statement-manager/public ./public
COPY apps/statement-manager/index.html ./
COPY apps/statement-manager/vite.config.ts ./
COPY apps/statement-manager/tsconfig*.json ./
COPY apps/statement-manager/tailwind.config.ts ./
COPY apps/statement-manager/postcss.config.js ./
COPY apps/statement-manager/eslint.config.js ./
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
