# ============================================================
# AI SERVICE DOCKERFILE
# ai_service/Dockerfile
# ============================================================
FROM python:3.11-slim AS base

WORKDIR /app

# Install system dependencies for torch
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt ./
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
  pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY app.py ./
COPY stages/ ./stages/
COPY model/ ./model/
COPY training/ ./training/
COPY data/ ./data/
COPY tests/ ./tests/

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Run with uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "2"]
