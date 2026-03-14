# Usa la imagen oficial de Nginx ligera (Alpine)
FROM nginx:alpine

# Copia los archivos del proyecto (HTML, CSS, JS, etc.) a la carpeta de Nginx
COPY . /usr/share/nginx/html

# Expone el puerto 80 (el que Nginx usa por defecto y Easypanel mapeará)
EXPOSE 80

# Inicia Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
