# ════════════════════════════════════════════════════
#  STAGE 1: BUILDER
# ════════════════════════════════════════════════════
FROM node:20 AS builder

# Instalar dependencias para compilar bcrypt, canvas, ethers
RUN apk add --no-cache python3 make g++ build-base cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app
COPY package*.json ./
# Instalar TODO (para poder compilar los binarios)
RUN npm install

COPY . .

# ════════════════════════════════════════════════════
#  STAGE 2: RUNNER (Producción Segura)
# ════════════════════════════════════════════════════
FROM node:20-alpine AS runner

# Crear usuario sin privilegios por seguridad
RUN addgroup -g 1001 -S humansystem && \
    adduser -u 1001 -S humansystem -G humansystem

# Instalar librerías gráficas necesarias para Canvas en runtime, más curl y dumb-init
RUN apk add --no-cache cairo pango jpeg giflib dumb-init curl

WORKDIR /app

# Copiar desde el builder
COPY --from=builder --chown=humansystem:humansystem /app/node_modules ./node_modules
COPY --chown=humansystem:humansystem package*.json ./
COPY --chown=humansystem:humansystem . .

# Eliminar basura para aligerar la imagen
RUN rm -rf .git .env* *.md tests/ Dockerfile docker-compose*.yml

# Cambiar a usuario seguro
USER humansystem

# Tu puerto es el 7777 (basado en tu compose)
EXPOSE 7777

# Healthcheck apuntando a tu puerto 7777
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:7777/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/app.js"]