# Docker Deployment Guide

This project is fully containerized and can be deployed with a single command using **Docker Compose**.

## Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- (Optional) [MongoDB Compass](https://www.mongodb.com/products/compass) if you want to inspect the database.

## Deployment Steps

1. **Build and Start**
   Open your terminal in the root directory of the project and run:
   ```bash
   docker compose up --build
   ```

2. **Access the Services**
   Once the containers are healthy, you can access the following:
   - **Dashboard (Frontend):** [http://localhost:3000](http://localhost:3000)
   - **Demo Website (Target):** [http://localhost:4000](http://localhost:4000)
   - **Backend API:** [http://localhost:3001](http://localhost:3001)
   - **Prometheus Metrics:** [http://localhost:9091](http://localhost:9091)
   - **AI Service:** [http://localhost:5000](http://localhost:5000)

## Service Architecture
- **selfheal-mongo**: MongoDB 7.0 (stores telemetry and predictions).
- **selfheal-backend**: Node.js API with background healing loops.
- **selfheal-ai**: Python FastAPI running an LSTM model for failure prediction.
- **selfheal-frontend**: React dashboard for monitoring and control.
- **selfheal-demo-site**: A demo site that simulates traffic for the system to monitor.
- **selfheal-prometheus**: Scrapes performance metrics from the backend.

## Common Operations

### View Logs
```bash
docker compose logs -f
```

### Stop the System
```bash
docker compose down
```

### Reset Database
```bash
docker compose down -v
```
