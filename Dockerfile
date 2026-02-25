# ──────────────────────────────────────────────
# Etapa 1: BUILD
# Compilar la aplicación Vite + React + TypeScript
# ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos de dependencias primero (aprovecha el cache de capas)
COPY package.json package-lock.json* ./

# Instalar dependencias de forma reproducible
RUN npm ci

# Copiar el resto del código fuente
COPY . .

# Generar íconos PNG (usa generate-icons.mjs con Node.js nativo)
# Este paso también se ejecuta automáticamente vía "prebuild" en package.json
RUN node generate-icons.mjs

# Compilar TypeScript y construir el bundle de producción
RUN npm run build

# ──────────────────────────────────────────────
# Etapa 2: PRODUCTION
# Servir los archivos estáticos con Nginx
# ──────────────────────────────────────────────
FROM nginx:stable-alpine

# Eliminar la configuración por defecto de Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar los archivos compilados desde la etapa de build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
