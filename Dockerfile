FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero para aprovechar la caché de Docker
COPY package*.json ./
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto 80 que usa Easypanel por defecto y NodeJS en este caso
EXPOSE 80

# Asegurar que el directorio data exista para SQLite (Easypanel debe montar un volumen aquí)
RUN mkdir -p data

CMD ["node", "server.js"]
