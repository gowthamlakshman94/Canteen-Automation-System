
FROM nginx:alpine

# Remove default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy website files
COPY . /usr/share/nginx/html

# Copy template and entrypoint script
COPY config.js.template /usr/share/nginx/html/config.js.template
COPY generate-config.sh /docker-entrypoint.d/

# Fix permissions
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chmod 755 /docker-entrypoint.d/generate-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

