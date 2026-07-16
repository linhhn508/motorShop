# My Motor Shop

A full-stack web application for a motorcycle parts and accessories store. The frontend displays a product catalog with category filtering and pagination, backed by a Flask REST API that reads from a MongoDB database. All services are containerised with Docker.

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
├── frontend/                 # Static web UI served by Nginx
│   ├── index.html            # Main shop page
│   ├── main.js               # Fetches products from API, renders UI
│   ├── styles.css            # Stylesheet
│   ├── Dockerfile            # Nginx image
│   └── image/                # Static assets
│
├── infra/                    # Docker build contexts for each service
│   ├── mongodb/
│   │   ├── Dockerfile
│   │   ├── mongo-init.sh     # Imports products.json on first start
│   │   └── products.json     # Seed data
│   ├── minio/
│   │   ├── Dockerfile
│   │   └── minio-init.sh     # Creates bucket, sets public access, seeds images
│   └── service/
│       └── Dockerfile        # Flask service Docker image
│
└── image/
    └── minio/
        └── product/          # Product images seeded into MinIO on first start
```

---

## Tech Stack

| Layer        | Technology                            |
|--------------|---------------------------------------|
| Frontend     | HTML / CSS / Vanilla JavaScript       |
| Web server   | Nginx 1.27 (Alpine)                   |
| Backend      | Python 3.12, Flask 3.x, flask-cors    |
| Database     | MongoDB 7.0                           |
| Object store | MinIO (S3-compatible)                 |
| Packaging    | [uv](https://github.com/astral-sh/uv) |
| Containers   | Docker & Docker Compose               |

---

## API Endpoints

Base URL: `http://<host>:5000`

| Method   | Path                      | Description               |
|----------|---------------------------|---------------------------|
| `GET`    | `/`                       | Main blueprint health check |
| `GET`    | `/test/`                  | Factory pattern test page |
| `GET`    | `/api/products/`          | List all products         |
| `GET`    | `/api/products/categories/` | List distinct categories |
| `GET`    | `/api/products/info/`     | Product info *(stub)*     |
| `POST`   | `/api/products/add/`      | Add a product *(stub)*    |
| `PUT`    | `/api/products/update/`   | Update a product *(stub)* |
| `DELETE` | `/api/products/remove/`   | Remove a product *(stub)* |

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)

---

### Option 1 — Docker Compose (recommended)

Starts all services (backend, MongoDB, and MinIO) together on an isolated network.

```bash
docker compose up --build
```

- Backend API: `http://localhost:5000`
- MinIO console: `http://localhost:9001`
- MinIO S3 API: `http://localhost:9000`
- MongoDB is only accessible internally to the backend service.

Then start the frontend separately:

```bash
cd frontend
docker build -t shop_web .
docker run -d -p 8000:80 --name frontend shop_web
```

- Frontend: `http://localhost:8000`

> **Note:** The frontend calls the backend at `http://192.168.58.128:5000` by default (see `frontend/main.js`). Update that URL to match your host if needed.

---

### Option 2 — Manual Docker builds

```bash
# 1. MongoDB
docker build -f infra/mongodb/Dockerfile infra/mongodb/ -t custom_mongo
docker run -d -p 27017:27017 --name mongodb custom_mongo

# 2. MinIO
docker build -f infra/minio/Dockerfile infra/minio/ -t custom_minio
docker run -d -p 9000:9000 -p 9001:9001 --name minio \
  -e MINIO_ROOT_USER=<user> -e MINIO_ROOT_PASSWORD=<password> custom_minio

# 3. Backend (set MONGODB_HOST to the IP where MongoDB is reachable)
docker build -f infra/service/Dockerfile . -t backend
docker run -d -p 5000:5000 --name backend -e MONGODB_HOST=<mongodb-host>:27017 backend

# 4. Frontend
docker build -t shop_web frontend/
docker run -d -p 8000:80 --name frontend shop_web
```

---

### Option 3 — Local development (backend only)

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
- The MongoDB image automatically seeds the database on first startup using `mongoimport` with `backend/image/mongodb/products.json`.

Each product document follows this schema:

```json
{
  "id": 1,
  "name": "Product name",
  "price": 197,
  "image": "image/product/product1.png",
  "category": "Category name"
}
```

---

## Environment Variables

| Variable              | Service  | Description                                  | Default (compose)  |
|-----------------------|----------|----------------------------------------------|--------------------|
| `MONGODB_HOST`        | Backend  | MongoDB host and port (`host:port`)          | `mongodb`          |
| `FLASK_APP`           | Backend  | Flask application entry point                | `app`              |
| `MINIO_ROOT_USER`     | MinIO    | MinIO admin username                         | set in `.env`      |
| `MINIO_ROOT_PASSWORD` | MinIO    | MinIO admin password                         | set in `.env`      |
