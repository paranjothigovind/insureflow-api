# syntax=docker/dockerfile:1

# ---- Build stage: install everything, compile TypeScript ----
FROM node:24-bookworm-slim AS builder

# Prisma's engines need OpenSSL.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/

RUN npx prisma generate
RUN npm run build


# ---- Production stage: runtime dependencies + compiled output only ----
FROM node:24-bookworm-slim AS production

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Everything below is owned by the unprivileged `node` user, so Prisma can
# write to node_modules if it needs to fetch an engine binary.
WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# Generate the client against this image's own Prisma install.
COPY --chown=node:node prisma ./prisma/
RUN npx prisma generate

COPY --from=builder --chown=node:node /app/dist ./dist

EXPOSE 3000

# Apply pending migrations, then start the server. `migrate deploy` is safe to
# run on every start: it only applies migrations that are not yet recorded,
# and Prisma takes a database lock so concurrent instances don't collide.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
