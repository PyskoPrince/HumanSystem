# ════════════════════════════════════════════════════
#  STAGE 1: BUILDER
# ════════════════════════════════════════════════════
FROM node:20 AS builder

# Corrección: Usar apt-get para Debian (imagen node:20)
RUN apt-get update && apt-get install -y \
    python3 make g++ build-essential libcairo2-dev \
    libjpeg-dev libpango1.0-dev libgif-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# ════════════════════════════════════════════════════
#  STAGE 2: RUNNER (Producción Segura)
# ════════════════════════════════════════════════════
FROM node:20-alpine AS runner

# Crear usuario sin privilegios
RUN addgroup -g 1001 -S humansystem && \
    adduser -u 1001 -S humansystem -G humansystem

# Instalar librerías necesarias en Alpine
RUN apk add --no-cache cairo pango jpeg giflib dumb-init curl

WORKDIR /app

# Copiar desde el builder
COPY --from=builder --chown=humansystem:humansystem /app/node_modules ./node_modules
COPY --chown=humansystem:humansystem package*.json ./
COPY --chown=humansystem:humansystem . .

# Eliminar basura
RUN rm -rf .git .env* *.md tests/ Dockerfile docker-compose*.yml

# Cambiar a usuario seguro
USER humansystem

EXPOSE 7777

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:7777/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/app.js"]