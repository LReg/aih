FROM node:22-alpine AS deps
WORKDIR /data
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.app.json tsconfig.spec.json angular.json ./

FROM deps AS build-deps
RUN npm ci

FROM build-deps AS build
WORKDIR /build
COPY --from=build-deps /data/node_modules ./node_modules
COPY --from=build-deps /data/package.json /data/package-lock.json /data/tsconfig.json /data/tsconfig.app.json /data/angular.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM nginx:1.27.4 AS frontend
COPY docker/remote.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist/frontend/browser /usr/share/nginx/html
# Renders /config.json from real env vars at container start — see docker-entrypoint.sh.
# Values are no longer baked into the JS bundle at build time (see environments/environment.ts):
# the same image now runs unmodified in any environment, docker-compose or k8s.
COPY docker-entrypoint.sh /docker-entrypoint.d/40-write-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-write-runtime-config.sh
EXPOSE 80
