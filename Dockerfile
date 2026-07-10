# ===== VALENTIM IA — Professora Alessandra (Railway, serviço único) =====

# 1) Constrói o frontend (React/Vite)
FROM node:20-slim AS frontend
WORKDIR /app
COPY frontend/package.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# 2) Backend + frontend juntos
FROM node:20-slim
WORKDIR /app
# OpenSSL é necessário para o Prisma conectar no PostgreSQL
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY backend/package.json ./
RUN npm install
COPY backend/ .
COPY --from=frontend /app/dist ./public
RUN npx prisma generate
EXPOSE 3000
CMD sh -c "npx prisma db push --skip-generate && node src/seed.js && node src/index.js"
