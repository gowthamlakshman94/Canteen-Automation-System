
#!/bin/bash

# Default to http://localhost:3000 if BASE_URL is not set
BASE_URL=${BASE_URL:-"http://localhost:3000"}

# Path to the project folder
PROJECT_DIR="/usr/share/nginx/html"
TEMPLATE_FILE="$PROJECT_DIR/config.js.template"
OUTPUT_FILE="$PROJECT_DIR/config.js"

# Step 1: Use envsubst to replace the placeholder with the actual environment variable
echo "Generating config.js from config.js.template..."
envsubst < "$TEMPLATE_FILE" > "$OUTPUT_FILE"
echo "✅ Created config.js with BASE_URL=$BASE_URL"

# Start the server (NGINX, HTTPD, or another static server)
# In the case of Nginx, no further command is required because it's a static server

