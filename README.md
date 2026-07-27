# My Motor Shop

A full-stack e-commerce web application for a Vietnamese motorcycle parts and accessories store. Customers can browse a product catalogue, filter by category, search products, and view individual product detail pages. All services run in Docker containers orchestrated by Docker Compose.

---

## Features

- Product listing page with category sidebar and pagination
- Individual product detail pages with dynamic routing (`/product/<id>`)
- Product search by name or category
- Contact form with email support (AWS SES in production)
- Customer feedback/review submission with star ratings
- JWT-authenticated admin CRUD operations (add, update, remove products)
- Product images stored in MinIO and served through Nginx
- REST API backed by Flask and MongoDB
- Structured JSON logging for CloudWatch compatibility
- Single Nginx entry-point — no CORS configuration needed at the application layer
- Health checks on MongoDB and MinIO with service dependency ordering
- Comprehensive test suite (29 tests) with pytest

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
motorShop/
├── docker-compose.yml
├── .env                          # Credentials (not committed)
├── .env.example                  # Template for required env vars
│
├── backend/
│   ├── app/
│   │   ├── __init__.py           # App factory — initialises PyMongo, registers blueprints
│   │   ├── middleware.py         # JWT @token_required decorator
│   │   ├── logging_config.py    # Structured JSON log formatter
│   │   ├── main/                 # Main blueprint  →  GET /
│   │   ├── products/             # Products blueprint  →  /api/products/
│   │   ├── auth/                 # Auth blueprint  →  POST /api/auth/login
│   │   ├── contact/              # Contact blueprint  →  POST /api/contact
│   │   ├── feedback/             # Feedback blueprint  →  POST /api/feedback
│   │   └── health/               # Health blueprint  →  GET /api/health
│   ├── tests/
│   │   ├── conftest.py           # Shared test fixtures (app, client, mock db)
│   │   ├── test_routes.py        # Product listing/detail/category tests
│   │   ├── test_products_crud.py # CRUD endpoint tests
│   │   ├── test_search.py        # Search endpoint tests
│   │   ├── test_auth.py          # JWT auth tests
│   │   ├── test_contact.py       # Contact form tests
│   │   ├── test_feedback.py      # Feedback submission tests
│   │   └── test_health.py        # Health check tests
│   ├── pyproject.toml            # Dependencies (Flask, PyJWT, boto3, pytest, ruff)
│   ├── ruff.toml                 # Linter/formatter config
│   └── uv.lock
│
├── frontend/
│   ├── index.html                # Product listing page
│   ├── nginx.conf                # Nginx routing + reverse proxy config
│   ├── assets/                   # Icons, banners, placeholder images
│   ├── css/
│   │   ├── main.css              # Shared styles (header, footer, grid, menu)
│   │   ├── pages.css             # Blog, contact, feedback page styles
│   │   └── product_info.css      # Product detail page styles
│   ├── js/
│   │   ├── main.js               # Listing page — fetch products, render, paginate
│   │   └── product_info.js       # Detail page — read URL slug, fetch & render product
│   └── pages/
│       ├── product_info.html     # Product detail page
│       ├── blog.html             # Blog page
│       ├── contact.html          # Contact form page
│       └── feedback.html         # Feedback/review page
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

| Layer        | Technology                                          |
|--------------|-----------------------------------------------------|
| Frontend     | HTML / CSS / Vanilla JavaScript                     |
| Web server   | Nginx 1.27 (Alpine) — static files + reverse proxy  |
| Backend      | Python 3.12, Flask 3.x, flask-pymongo, PyJWT, boto3 |
| Database     | MongoDB 7.0                                         |
| Object store | MinIO RELEASE.2025-09-07 (S3-compatible)            |
| Testing      | pytest, mongomock                                   |
| Linting      | ruff                                                |
| Packaging    | [uv](https://github.com/astral-sh/uv)              |
| Containers   | Docker & Docker Compose                             |

---

## Services & Ports

| Service           | Container  | Host port | Description                           |
|-------------------|------------|-----------|---------------------------------------|
| `frontend`        | `frontend` | `8000`    | Nginx — serves UI and proxies traffic |
| `backend_service` | `backend`  | `5000`    | Flask REST API                        |
| `mongodb`         | `mongodb`  | —         | MongoDB (internal only)               |
| `minio`           | `minio`    | —         | Object storage (internal only)        |

---

## API Endpoints

Base URL: `http://localhost:5000` (direct) or `http://localhost:8000/api/` (via Nginx)

### Public Endpoints

| Method | Path                              | Description                      |
|--------|-----------------------------------|----------------------------------|
| `GET`  | `/`                               | Main blueprint health check      |
| `GET`  | `/api/health`                     | ALB health check                 |
| `GET`  | `/api/products/`                  | List all products                |
| `GET`  | `/api/products/categories/`       | List distinct categories         |
| `GET`  | `/api/products/<product_id>/info` | Get a single product by ID       |
| `GET`  | `/api/products/search?q=<query>`  | Search products by name/category |
| `POST` | `/api/auth/login`                 | Admin login — returns JWT token  |
| `POST` | `/api/contact`                    | Submit contact form              |
| `POST` | `/api/feedback`                   | Submit feedback with star rating |

### Protected Endpoints (require JWT)

| Method   | Path                     | Description       |
|----------|--------------------------|-------------------|
| `POST`   | `/api/products/add/`     | Add a new product |
| `PUT`    | `/api/products/update/`  | Update a product  |
| `DELETE` | `/api/products/remove/`  | Remove a product  |

Protected endpoints require an `Authorization: Bearer <token>` header. Obtain a token via `POST /api/auth/login`.

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- A `.env` file in the project root (see [Environment Variables](#environment-variables))

### Option 1 — Docker Compose (recommended)

```bash
cp .env.example .env
# Edit .env and fill in all values
docker compose up --build
```

| URL                     | What you see       |
|-------------------------|--------------------|
| `http://localhost:8000` | Shop frontend      |
| `http://localhost:5000` | Flask API (direct) |

To tear down and remove all volumes:

```bash
docker compose down -v
```

### Option 2 — Local development (backend only)

Requires a running MongoDB instance on `localhost:27017`.

```bash
cd backend
pip install uv
uv sync
# Set required env vars
export MONGO_INITDB_ROOT_USERNAME=your_user
export MONGO_INITDB_ROOT_PASSWORD=your_password
export MONGODB_HOST=localhost:27017
export JWT_SECRET=your-secret-key-at-least-32-bytes
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=your_admin_password
uv run flask run -h 0.0.0.0 -p 5000
```

### Running Tests

```bash
cd backend
source .venv/bin/activate
uv run pytest -v
```

### Linting

```bash
cd backend
source .venv/bin/activate
uv run ruff check app/ tests/
uv run ruff format app/ tests/
```

---

## Database

- **Database:** `my_web_app`
- **Collections:** `products`, `feedback`
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

Create a `.env` file from the template:

```bash
cp .env.example .env
```

| Variable                     | Service          | Description                              |
|------------------------------|------------------|------------------------------------------|
| `MONGO_INITDB_ROOT_USERNAME` | Backend, MongoDB | MongoDB root username                    |
| `MONGO_INITDB_ROOT_PASSWORD` | Backend, MongoDB | MongoDB root password                    |
| `JWT_SECRET`                 | Backend          | Secret key for JWT signing (≥32 bytes)   |
| `ADMIN_USERNAME`             | Backend          | Admin login username                     |
| `ADMIN_PASSWORD`             | Backend          | Admin login password                     |
| `MINIO_ROOT_USER`            | MinIO            | MinIO admin username                     |
| `MINIO_ROOT_PASSWORD`        | MinIO            | MinIO admin password                     |
