# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:24-bookworm-slim AS builder

# Prisma's query engine needs OpenSSL.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/

# Generate the Prisma client, then compile the NestJS app.
RUN npx prisma generate
RUN npm run build


# ---- Production stage ----
FROM node:24-bookworm-slim AS production

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Generated Prisma client + compiled output.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist

# Run as the unprivileged user that ships with the Node image.
USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
