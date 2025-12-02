

FROM python:3.9-slim

# Install system dependencies for Prophet/Pandas
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python libraries
RUN pip install pandas sqlalchemy pymysql prophet

# Copy the script
COPY forecast_job.py .

# Command to run
CMD ["python", "forecast_job.py"]
