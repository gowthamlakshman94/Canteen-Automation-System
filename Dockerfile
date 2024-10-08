# Use an official Nginx image as the base image
FROM nginx:alpine

# Remove default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy your HTML files to the Nginx web server directory
COPY . /usr/share/nginx/html

# Expose port 80 to access the webpage
EXPOSE 80

# Start the Nginx server
CMD ["nginx", "-g", "daemon off;"]
