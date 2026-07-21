# Builds this repo's compiled dist/ output. Used today for the webhook relay
# service (docker/docker-compose.yml); the generic worker harness still runs
# via ts-node/node directly against an external app repo (see README).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/core/webhook-server.js"]
