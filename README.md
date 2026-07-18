# My Motor Shop

A full-stack e-commerce web application for a Vietnamese motorcycle parts and accessories store. Customers can browse a product catalogue, filter by category, paginate results, and view individual product detail pages. All services run in Docker containers orchestrated by Docker Compose.

---

## Features

- Product listing page with category sidebar and pagination
- Individual product detail pages with dynamic routing (`/product/<id>`)
- Product images stored in MinIO and served through Nginx
- REST API backed by Flask and MongoDB
- Single Nginx entry-point — no CORS configuration needed at the application layer
- Health checks on MongoDB and MinIO with service dependency ordering

---

## Architecture

```
Browser
  └─► Nginx :8000
        ├─ /                → static files  (HTML / CSS / JS)
        ├─ /product/<id>    → product detail page (product_info.html)
        ├─ /api/            → reverse proxy → Flask :5000
        └─ /image/product/  → reverse proxy → MinIO :9000
```

All four services share a single Docker bridge network (`backend_network`). MinIO and MongoDB are not exposed to the host.

---

## Project Structure

```
webapp_project/
├── docker-compose.yml
├── .env                          # MinIO credentials (not committed)
│
├── backend/
│   ├── app/
│   │   ├── __init__.py           # App factory — initialises PyMongo, registers blueprints
│   │   ├── main/                 # Main blueprint  →  GET /
│   │   └── products/             # Products blueprint  →  /api/products/
│   ├── pyproject.toml            # Dependencies (Flask, flask-pymongo, flask-cors)
│   └── uv.lock
│
├── frontend/
│   ├── index.html                # Product listing page
│   ├── nginx.conf                # Nginx routing + reverse proxy config
│   ├── assets/                   # Icons, banners, placeholder images
│   ├── css/
│   │   ├── main.css              # Shared styles (header, footer, grid, menu)
│   │   └── product_info.css      # Product detail page styles
│   ├── js/
│   │   ├── main.js               # Listing page — fetch products, render, paginate
│   │   └── product_info.js       # Detail page — read URL slug, fetch & render product
│   └── pages/
│       └── product_info.html     # Product detail page template
│
└── infra/
    ├── frontend/
    │   └── Dockerfile            # Nginx image — copies frontend/ into container
    ├── mongodb/
    │   ├── Dockerfile
    │   ├── mongo-init.sh         # Runs mongoimport on first start
    │   └── products.json         # Seed data — 9 products
    ├── minio/
    │   ├── Dockerfile
    │   ├── minio-init.sh         # Creates bucket, sets public read, seeds images
    │   └── product/              # Product images bind-mounted at runtime
    └── service/
        └── Dockerfile            # Flask service — python:3.12-slim + uv
```

---

## Tech Stack

| Layer        | Technology                                         |
|--------------|----------------------------------------------------|
| Frontend     | HTML / CSS / Vanilla JavaScript                    |
| Web server   | Nginx 1.27 (Alpine) — static files + reverse proxy |
| Backend      | Python 3.12, Flask 3.x, flask-pymongo, flask-cors  |
| Database     | MongoDB 7.0                                        |
| Object store | MinIO RELEASE.2025-09-07 (S3-compatible)           |
| Packaging    | [uv](https://github.com/astral-sh/uv)              |
| Containers   | Docker & Docker Compose                            |

---

## Services & Ports

| Service          | Container  | Host port | Description                          |
|------------------|------------|-----------|--------------------------------------|
| `frontend`       | `frontend` | `8000`    | Nginx — serves UI and proxies traffic |
| `backend_service`| `backend`  | `5000`    | Flask REST API                        |
| `mongodb`        | `mongodb`  | —         | MongoDB (internal only)              |
| `minio`          | `minio`    | —         | Object storage (internal only)       |

---

## API Endpoints

Base URL: `http://localhost:5000` (direct) or `http://localhost:8000/api/` (via Nginx)

| Method   | Path                              | Description                   |
|----------|-----------------------------------|-------------------------------|
| `GET`    | `/`                               | Main blueprint health check   |
| `GET`    | `/test/`                          | App factory test page         |
| `GET`    | `/api/products/all/`              | List all products             |
| `GET`    | `/api/products/categories/`       | List distinct categories      |
| `GET`    | `/api/products/<product_id>/info` | Get a single product by ID    |
| `POST`   | `/api/products/add/`              | Add a product *(stub)*        |
| `PUT`    | `/api/products/update/`           | Update a product *(stub)*     |
| `DELETE` | `/api/products/remove/`           | Remove a product *(stub)*     |

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- A `.env` file in the project root (see [Environment Variables](#environment-variables))

### Option 1 — Docker Compose (recommended)

```bash
docker compose up --build
```

| URL                     | What you see           |
|-------------------------|------------------------|
| `http://localhost:8000` | Shop frontend          |
| `http://localhost:5000` | Flask API (direct)     |

To tear down and remove all volumes:

```bash
docker compose down -v
```

### Option 2 — Manual Docker builds

```bash
# 1. Shared network
docker network create backend_network

# 2. MongoDB
docker build -f infra/mongodb/Dockerfile infra/mongodb/ -t custom_mongodb
docker run -d --network backend_network --name mongodb custom_mongodb

# 3. MinIO
docker build -f infra/minio/Dockerfile infra/minio/ -t custom_minio
docker run -d --network backend_network --name minio \
  -v ./infra/minio/product:/home/image \
  -e MINIO_ROOT_USER=<user> -e MINIO_ROOT_PASSWORD=<password> custom_minio

# 4. Backend
docker build -f infra/service/Dockerfile . -t custom_backend
docker run -d --network backend_network -p 5000:5000 --name backend \
  -e MONGODB_HOST=mongodb:27017 custom_backend

# 5. Frontend
docker build -f infra/frontend/Dockerfile . -t custom_frontend
docker run -d --network backend_network -p 8000:80 --name frontend custom_frontend
```

### Option 3 — Local development (backend only)

Requires a running MongoDB instance on `localhost:27017`.

```bash
cd backend
pip install uv
uv sync
MONGODB_HOST=localhost:27017 uv run flask run -h 0.0.0.0 -p 5000
```

---

## Database

- **Database:** `my_web_app`
- **Collection:** `products`
- MongoDB seeds itself on first start via `mongoimport` with `infra/mongodb/products.json`
- Contains **9 products** across categories: Yên, Đèn, Pô xe, Bánh & Lốp, Phanh & Thắng, Phuộc & Giảm xóc, Gương & Kính, Đồ chơi CNC & Kiểng, Truyền động

### Product Schema

```json
{
  "id": "product-slug",
  "name": "Product name",
  "price": 197,
  "category": "Category name",
  "stock": 10,
  "product": {
    "overall": {
      "brand": "Brand",
      "made_in": "Country",
      "material": "Material",
      "color": "Color"
    },
    "detail": "Full product description"
  }
}
```

Product images are stored in MinIO under the `product-image` bucket and served at `/image/product/<id>/thumbnail.png`.

---

## Environment Variables

Create a `.env` file in the project root:

```dotenv
MINIO_ROOT_USER=your_minio_user
MINIO_ROOT_PASSWORD=your_minio_password
```

| Variable              | Service  | Description                         |
|-----------------------|----------|-------------------------------------|
| `FLASK_APP`           | Backend  | Flask application entry point       |
| `MONGODB_HOST`        | Backend  | MongoDB host (`host:port`)          |
| `MINIO_ROOT_USER`     | MinIO    | MinIO admin username                |
| `MINIO_ROOT_PASSWORD` | MinIO    | MinIO admin password                |

