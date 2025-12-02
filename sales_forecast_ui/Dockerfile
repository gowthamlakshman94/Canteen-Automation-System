
# Use a slim Python image for a smaller footprint
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file and install dependencies
# This is done first to leverage Docker's build cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application files
# 1. Copy the main application script
COPY app.py .
# 2. Copy the templates folder and its contents
COPY templates templates/

# Expose the port that Flask runs on (default 5000)
EXPOSE 5000

# Define the command to run the application
# We use Python's built-in web server for simple Docker deployment
CMD ["python", "app.py"]
