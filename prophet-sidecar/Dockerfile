# Dockerfile (prophet sidecar) - updated for Debian trixie / python:3.10-slim
FROM python:3.10-slim

ENV DEBIAN_FRONTEND=noninteractive
# install build dependencies required by prophet (and keep image lean)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      gcc \
      g++ \
      gfortran \
      libgfortran5 \
      libblas-dev \
      liblapack-dev \
      libatlas3-base \
      ca-certificates \
      git \
      wget \
      python3-dev && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Upgrade pip, wheel, setuptools first
RUN python -m pip install --upgrade pip setuptools wheel

WORKDIR /app

# Copy requirements and install. Keep --no-cache-dir to reduce image size.
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY forecast_service.py /app/forecast_service.py
RUN chmod +x /app/forecast_service.py

ENV PORT=5000
EXPOSE 5000

CMD ["python", "/app/forecast_service.py"]

