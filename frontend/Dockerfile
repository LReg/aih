FROM node:22-alpine AS deps
WORKDIR /data
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.app.json tsconfig.spec.json angular.json ./

FROM deps AS build-deps
RUN npm ci

FROM build-deps AS build
WORKDIR /build
COPY --from=build-deps /data/node_modules ./node_modules
COPY src ./src
COPY public ./public
ARG BASE_URL
ARG API_URL
ARG AUTH_URL
ARG CLIENT_ID
ENV BASE_URL=$BASE_URL
ENV API_URL=$API_URL
ENV AUTH_URL=$AUTH_URL
ENV CLIENT_ID=$CLIENT_ID
RUN npm run envvars && npm run build

FROM nginx:1.27.4 AS frontend
COPY docker/remote.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
