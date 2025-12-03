FROM python:3.10-slim

# Install build deps for prophet
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential curl gcc g++ libatlas-base-dev git ca-certificates python3-dev && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN python -m pip install --upgrade pip

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY forecast_service.py /app/forecast_service.py
RUN chmod +x /app/forecast_service.py

ENV PORT=5000
EXPOSE 5000
CMD ["python", "/app/forecast_service.py"]
