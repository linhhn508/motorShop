# My Motor Shop

A full-stack web application for a motorcycle parts and accessories store. The frontend displays a product catalog with category filtering and pagination, backed by a Flask REST API that reads from a MongoDB database. Product images are served from a MinIO object store. All services are containerised with Docker Compose.

---

## Architecture

```
Browser
  └─► Nginx (port 8000)
        ├─ /             → serves static files (HTML / CSS / JS)
        ├─ /api/         → reverse-proxied to Flask backend (port 5000)
        └─ /image/product/ → reverse-proxied to MinIO bucket (port 9000)
```

Nginx acts as the single entry-point. The browser never talks directly to the backend or MinIO, so no CORS configuration is required at the application layer.

---

## Project Structure

```
webapp_project/
├── docker-compose.yml        # Orchestrates all services
├── .env                      # Environment variables (MinIO credentials)
│
├── backend/                  # Flask REST API
│   ├── app/
│   │   ├── __init__.py       # Application factory (create_app)
│   │   ├── main/             # Main blueprint  →  GET /
│   │   └── products/         # Products blueprint  →  GET|POST|PUT|DELETE /api/products/
│   └── pyproject.toml        # Python project metadata & dependencies
│
├── frontend/                 # Static web UI
│   ├── index.html            # Main shop page
│   ├── main.js               # Fetches products from API, renders UI
│   ├── styles.css            # Stylesheet
│   ├── nginx.conf            # Nginx config (static files + reverse proxies)
│   └── assets/               # Static assets bundled into the Nginx image
│
└── infra/                    # Docker build contexts for each service
    ├── frontend/
    │   └── Dockerfile        # Nginx image (copies frontend/ into container)
    ├── mongodb/
    │   ├── Dockerfile
    │   ├── mongo-init.sh     # Runs mongoimport on first start
    │   └── products.json     # Seed data (9 products)
    ├── minio/
    │   ├── Dockerfile
    │   ├── minio-init.sh     # Creates bucket, sets public access, seeds images
    │   └── product/          # Product images bind-mounted into the container
    └── service/
        └── Dockerfile        # Flask service Docker image
```

---

## Tech Stack

| Layer        | Technology                                              |
|--------------|---------------------------------------------------------|
| Frontend     | HTML / CSS / Vanilla JavaScript                         |
| Web server   | Nginx 1.27 (Alpine)                                     |
| Backend      | Python 3.12, Flask 3.x, flask-pymongo, flask-cors       |
| Database     | MongoDB 7.0                                             |
| Object store | MinIO RELEASE.2025-09-07T16-13-09Z (S3-compatible)      |
| Packaging    | [uv](https://github.com/astral-sh/uv)                   |
| Containers   | Docker & Docker Compose                                 |

---

## Services & Ports

| Service    | Container name | Exposed port(s)      | Description                         |
|------------|----------------|----------------------|-------------------------------------|
| `frontend` | `frontend`     | `8000 → 80`          | Nginx (static files + reverse proxy)|
| `backend_service` | `backend` | `5000 → 5000`     | Flask REST API                      |
| `minio`    | `minio`        | *(internal only)*    | MinIO — not exposed to host         |
| `mongodb`  | `mongodb`      | *(internal only)*    | MongoDB — not exposed to host       |

---

## API Endpoints

Base URL (direct): `http://localhost:5000`  
Via Nginx proxy: `http://localhost:8000/api/`

| Method   | Path                        | Description                    |
|----------|-----------------------------|--------------------------------|
| `GET`    | `/`                         | Main blueprint health check    |
| `GET`    | `/test/`                    | Application factory test page  |
| `GET`    | `/api/products/`            | List all products              |
| `GET`    | `/api/products/categories/` | List distinct categories       |
| `GET`    | `/api/products/info/`       | Product info *(stub)*          |
| `POST`   | `/api/products/add/`        | Add a product *(stub)*         |
| `PUT`    | `/api/products/update/`     | Update a product *(stub)*      |
| `DELETE` | `/api/products/remove/`     | Remove a product *(stub)*      |

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- A `.env` file in the project root with MinIO credentials (see [Environment Variables](#environment-variables))

---

### Option 1 — Docker Compose (recommended)

Builds and starts all four services (frontend, backend, MongoDB, MinIO) on a shared `backend_network`.

```bash
docker compose up --build
```

| URL                         | Service             |
|-----------------------------|---------------------|
| `http://localhost:8000`     | Shop frontend       |
| `http://localhost:5000`     | Flask API (direct)  |

---

### Option 2 — Manual Docker builds

```bash
# 1. Create a shared network
docker network create backend_network

# 2. MongoDB
docker build -f infra/mongodb/Dockerfile infra/mongodb/ -t custom_mongo
docker run -d --network backend_network --name mongodb custom_mongo

# 3. MinIO
docker build -f infra/minio/Dockerfile infra/minio/ -t custom_minio
docker run -d --network backend_network -p 9000:9000 -p 9001:9001 --name minio \
  -v ./infra/minio/product:/home/image \
  -e MINIO_ROOT_USER=<user> -e MINIO_ROOT_PASSWORD=<password> custom_minio

# 4. Backend
docker build -f infra/service/Dockerfile . -t backend
docker run -d --network backend_network -p 5000:5000 --name backend \
  -e MONGODB_HOST=mongodb:27017 backend

# 5. Frontend
docker build -f infra/frontend/Dockerfile . -t frontend
docker run -d --network backend_network -p 8000:80 --name frontend frontend
```

---

### Option 3 — Local development (backend only)

Requires a running MongoDB instance on `localhost:27017`.

```bash
cd backend
pip install uv
uv sync
MONGODB_HOST=localhost:27017 uv run flask run
```

---

## Database

- **Database:** `my_web_app`
- **Collection:** `products`
- On first startup the MongoDB container automatically imports `infra/mongodb/products.json` via `mongoimport`.
- The seed file contains **9 products** across multiple motorcycle-parts categories.

Each product document follows this schema:

```json
{
  "id": 1,
  "name": "Product name",
  "price": 197,
  "category": "Category name"
}
```

Product images are stored separately in MinIO under the `product-image` bucket and served through Nginx at `/image/product/<id>/thumbnail.png`.

---

## Environment Variables

Create a `.env` file in the project root before running Docker Compose:

```dotenv
MINIO_ROOT_USER=your_minio_user
MINIO_ROOT_PASSWORD=your_minio_password
```

| Variable              | Service  | Description                                  | Default (compose)  |
|-----------------------|----------|----------------------------------------------|--------------------|
| `MONGODB_HOST`        | Backend  | MongoDB host and port (`host:port`)          | `mongodb`          |
| `FLASK_APP`           | Backend  | Flask application entry point                | `app`              |
| `MINIO_ROOT_USER`     | MinIO    | MinIO admin username                         | set in `.env`      |
| `MINIO_ROOT_PASSWORD` | MinIO    | MinIO admin password                         | set in `.env`      |
