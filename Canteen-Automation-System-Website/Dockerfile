
# Use an official Nginx image as the base image
FROM nginx:alpine

# Remove default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy your HTML files to the Nginx web server directory
COPY . /usr/share/nginx/html

# Copy template and entrypoint script separately if needed (optional but recommended)
COPY config.js.template /usr/share/nginx/html/config.js.template
COPY generate-config.sh /docker-entrypoint.d/generate-config.sh

# Set permissions and ownership
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chmod +x /docker-entrypoint.d/generate-config.sh

# Expose port 80 to access the webpage
EXPOSE 80

# Start the Nginx server (entrypoint script will run automatically)
CMD ["nginx", "-g", "daemon off;"]

