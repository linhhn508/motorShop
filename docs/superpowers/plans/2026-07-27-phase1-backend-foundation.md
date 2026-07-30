# Phase 1: Backend Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Flask backend with working CRUD, search, contact (SES), feedback, health check endpoints, JWT auth for write operations, structured JSON logging, linting, and comprehensive tests — all running locally with Docker Compose.

**Architecture:** Flask app factory pattern with blueprints. Products blueprint at `/api/products`, new auth blueprint at `/api/auth`, new contact blueprint at `/api/contact`, new feedback blueprint at `/api/feedback`. MongoDB via `flask-pymongo`. JWT via `PyJWT`. SES mocked locally.

**Tech Stack:** Python 3.12, Flask 3.x, flask-pymongo, PyJWT, boto3 (SES), pytest, mongomock, ruff

## Global Constraints

- Python >= 3.12, managed with `uv`
- All routes return JSON (`jsonify`)
- All MongoDB queries exclude `_id` from results (`{"_id": False}`)
- Product lookup is by `id` field (slug string), not `_id`
- Database name: `my_web_app`, collection: `products`
- MONGO_URI built from env vars: `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, `MONGODB_HOST`
- CORS is currently disabled (commented out) — leave it as-is for now
- Gunicorn with 4 workers on port 5000
- Entry point: `app:create_app()`

---

## File Structure

```
backend/
├── pyproject.toml              # MODIFY — add dev deps (pytest, mongomock, ruff, PyJWT, boto3)
├── app/
│   ├── __init__.py             # MODIFY — register new blueprints, add logging config, load JWT secret
│   ├── auth/
│   │   ├── __init__.py         # CREATE — auth blueprint
│   │   └── routes.py           # CREATE — POST /api/auth/login
│   ├── contact/
│   │   ├── __init__.py         # CREATE — contact blueprint
│   │   └── routes.py           # CREATE — POST /api/contact
│   ├── feedback/
│   │   ├── __init__.py         # CREATE — feedback blueprint
│   │   └── routes.py           # CREATE — POST /api/feedback
│   ├── health/
│   │   ├── __init__.py         # CREATE — health blueprint
│   │   └── routes.py           # CREATE — GET /api/health
│   ├── middleware.py           # CREATE — @token_required decorator
│   ├── logging_config.py       # CREATE — JSON log formatter
│   ├── products/
│   │   ├── __init__.py         # NO CHANGE
│   │   └── routes.py           # MODIFY — implement CRUD stubs, add search, add @token_required
│   └── main/
│       ├── __init__.py         # NO CHANGE
│       └── routes.py           # NO CHANGE
├── tests/
│   ├── conftest.py             # CREATE — shared fixtures (app, client, mock db)
│   ├── test_routes.py          # MODIFY — fix broken URL, use shared fixtures
│   ├── test_products_crud.py   # CREATE — tests for add/update/remove
│   ├── test_search.py          # CREATE — tests for search endpoint
│   ├── test_auth.py            # CREATE — tests for login + token_required
│   ├── test_contact.py         # CREATE — tests for contact form
│   ├── test_feedback.py        # CREATE — tests for feedback
│   └── test_health.py          # CREATE — tests for health check
├── ruff.toml                   # CREATE — ruff config
```

---

### Task 1: Setup Dev Dependencies and Tooling

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/ruff.toml`

**Interfaces:**
- Consumes: nothing
- Produces: dev dependencies available for all subsequent tasks (`pytest`, `mongomock`, `ruff`, `PyJWT`, `boto3`)

- [ ] **Step 1: Add dev dependencies and pytest config to pyproject.toml**

```toml
[project]
name = "back-end"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "flask>=3.1.3",
    "flask-cors>=6.0.5",
    "flask-pymongo>=3.0.1",
    "gunicorn>=26.0.0",
    "pymongo>=4.17.0",
    "PyJWT>=2.9.0",
    "boto3>=1.35.0",
]

[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "mongomock>=4.3.0",
    "ruff>=0.8.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 2: Create ruff config**

Create `backend/ruff.toml`:

```toml
line-length = 120
target-version = "py312"

[lint]
select = ["E", "F", "W", "I"]
```

- [ ] **Step 3: Install dependencies**

Run:
```bash
cd backend && uv sync
```
Expected: all deps installed successfully, `uv.lock` updated.

- [ ] **Step 4: Verify ruff runs**

Run:
```bash
cd backend && uv run ruff check app/
```
Expected: either clean or shows existing style issues (no crash).

- [ ] **Step 5: Verify pytest runs**

Run:
```bash
cd backend && uv run pytest --co
```
Expected: collects existing `test_routes.py` tests (they may not pass yet — that is Task 2).

- [ ] **Step 6: Commit**

```bash
git add backend/pyproject.toml backend/ruff.toml backend/uv.lock
git commit -m "chore: add dev dependencies (pytest, ruff, PyJWT, boto3)"
```

---

### Task 2: Fix Existing Tests and Create Shared Fixtures

**Files:**
- Create: `backend/tests/conftest.py`
- Modify: `backend/tests/test_routes.py`

**Interfaces:**
- Consumes: dev dependencies from Task 1
- Produces: `conftest.py` with fixtures `app`, `client`, `mock_db`, `seed_products` used by all test files

- [ ] **Step 1: Create conftest.py with shared fixtures**

Create `backend/tests/conftest.py`:

```python
import os

import pytest
import mongomock
from unittest.mock import patch

from app import create_app


@pytest.fixture
def mock_db():
    client = mongomock.MongoClient()
    db = client["my_web_app"]
    return db


@pytest.fixture
def app(mock_db):
    os.environ.setdefault("MONGO_INITDB_ROOT_USERNAME", "test")
    os.environ.setdefault("MONGO_INITDB_ROOT_PASSWORD", "test")
    os.environ.setdefault("MONGODB_HOST", "localhost")

    with patch("flask_pymongo.PyMongo.init_app"):
        test_app = create_app()
    test_app.config["TESTING"] = True
    return test_app


@pytest.fixture
def client(app, mock_db):
    import app as app_module

    with patch.object(app_module, "mongo") as mock_mongo:
        mock_mongo.db = mock_db
        with app.test_client() as client:
            yield client


@pytest.fixture
def seed_products(mock_db):
    products = [
        {
            "id": "yen-doi-triump-speed-400",
            "name": "Yen doi TRIUMP SPEED 400",
            "price": 197,
            "category": "Yen",
            "stock": 10,
            "product": {
                "overall": {
                    "brand": "Triumph",
                    "made_in": "Anh",
                    "material": "Da cao cap",
                    "color": "Den",
                },
                "detail": "Yen doi cho xe Triumph Speed 400",
            },
        },
        {
            "id": "po-akrapovic-r1",
            "name": "Po Akrapovic R1",
            "price": 358,
            "category": "Po xe",
            "stock": 5,
            "product": {
                "overall": {
                    "brand": "Akrapovic",
                    "made_in": "Slovenia",
                    "material": "Titanium",
                    "color": "Bac",
                },
                "detail": "Po xe Akrapovic cho R1",
            },
        },
    ]
    mock_db.products.insert_many(products)
    return products
```

- [ ] **Step 2: Rewrite test_routes.py to use shared fixtures and fix URL bug**

Replace `backend/tests/test_routes.py` with:

```python
def test_get_products(client, seed_products):
    response = client.get("/api/products/")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2
    assert data[0]["id"] == "yen-doi-triump-speed-400"


def test_get_product_by_id(client, seed_products):
    response = client.get("/api/products/yen-doi-triump-speed-400/info")
    assert response.status_code == 200
    data = response.get_json()
    assert data["name"] == "Yen doi TRIUMP SPEED 400"
    assert data["price"] == 197


def test_get_product_not_found(client, seed_products):
    response = client.get("/api/products/nonexistent/info")
    assert response.status_code == 404
    data = response.get_json()
    assert data["error"] == "Product not found"


def test_get_categories(client, seed_products):
    response = client.get("/api/products/categories/")
    assert response.status_code == 200
    data = response.get_json()
    assert "Yen" in data
    assert "Po xe" in data
```

- [ ] **Step 3: Run tests to verify they pass**

Run:
```bash
cd backend && uv run pytest tests/test_routes.py -v
```
Expected: 4 tests PASS.

- [ ] **Step 4: Run ruff on test files**

Run:
```bash
cd backend && uv run ruff check tests/
```
Expected: clean or only minor issues.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/conftest.py backend/tests/test_routes.py
git commit -m "test: fix existing tests, add shared fixtures"
```

---

### Task 3: Health Check Endpoint

**Files:**
- Create: `backend/app/health/__init__.py`
- Create: `backend/app/health/routes.py`
- Modify: `backend/app/__init__.py` (register blueprint)
- Create: `backend/tests/test_health.py`

**Interfaces:**
- Consumes: `create_app()` from `app/__init__.py`
- Produces: `GET /api/health` returns `{"status": "healthy"}` 200

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_health.py`:

```python
def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && uv run pytest tests/test_health.py -v
```
Expected: FAIL with 404 (route does not exist yet).

- [ ] **Step 3: Create health blueprint**

Create `backend/app/health/__init__.py`:

```python
from flask import Blueprint

bp = Blueprint("health", __name__)

from app.health import routes
```

Create `backend/app/health/routes.py`:

```python
from app.health import bp
from flask import jsonify


@bp.route("", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy"}), 200
```

- [ ] **Step 4: Register health blueprint in app factory**

In `backend/app/__init__.py`, add after the products blueprint registration (after line 24):

```python
    from app.health import bp as health_bp
    app.register_blueprint(health_bp, url_prefix='/api/health')
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
cd backend && uv run pytest tests/test_health.py -v
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/health/ backend/tests/test_health.py backend/app/__init__.py
git commit -m "feat: add health check endpoint"
```

---

### Task 4: Implement Product CRUD (Add, Update, Remove)

**Files:**
- Modify: `backend/app/products/routes.py` (implement stubs)
- Create: `backend/tests/test_products_crud.py`

**Interfaces:**
- Consumes: `mongo.db.products` collection, product schema from `products.json`
- Produces:
  - `POST /api/products/add/` — accepts JSON `{id, name, price, category, stock, product}`, returns `{"message": "Product added", "id": "<id>"}` 201
  - `PUT /api/products/update/` — accepts JSON `{id, ...fields}`, returns `{"message": "Product updated"}` 200
  - `DELETE /api/products/remove/` — accepts JSON `{id}`, returns `{"message": "Product removed"}` 200

- [ ] **Step 1: Write failing tests for CRUD**

Create `backend/tests/test_products_crud.py`:

```python
import json


def test_add_product(client, mock_db):
    new_product = {
        "id": "test-product",
        "name": "Test Product",
        "price": 100,
        "category": "Test",
        "stock": 5,
        "product": {
            "overall": {
                "brand": "TestBrand",
                "made_in": "Vietnam",
                "material": "Steel",
                "color": "Red",
            },
            "detail": "A test product",
        },
    }
    response = client.post(
        "/api/products/add/",
        data=json.dumps(new_product),
        content_type="application/json",
    )
    assert response.status_code == 201
    data = response.get_json()
    assert data["message"] == "Product added"
    assert data["id"] == "test-product"

    saved = mock_db.products.find_one({"id": "test-product"})
    assert saved is not None
    assert saved["name"] == "Test Product"


def test_add_product_missing_fields(client):
    response = client.post(
        "/api/products/add/",
        data=json.dumps({"name": "Incomplete"}),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_add_product_duplicate_id(client, seed_products):
    duplicate = {
        "id": "yen-doi-triump-speed-400",
        "name": "Duplicate",
        "price": 100,
        "category": "Test",
        "stock": 1,
        "product": {
            "overall": {"brand": "X", "made_in": "X", "material": "X", "color": "X"},
            "detail": "X",
        },
    }
    response = client.post(
        "/api/products/add/",
        data=json.dumps(duplicate),
        content_type="application/json",
    )
    assert response.status_code == 409


def test_update_product(client, seed_products):
    response = client.put(
        "/api/products/update/",
        data=json.dumps({"id": "yen-doi-triump-speed-400", "price": 250}),
        content_type="application/json",
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Product updated"


def test_update_product_not_found(client, seed_products):
    response = client.put(
        "/api/products/update/",
        data=json.dumps({"id": "nonexistent", "price": 100}),
        content_type="application/json",
    )
    assert response.status_code == 404


def test_remove_product(client, seed_products):
    response = client.delete(
        "/api/products/remove/",
        data=json.dumps({"id": "po-akrapovic-r1"}),
        content_type="application/json",
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Product removed"


def test_remove_product_not_found(client, seed_products):
    response = client.delete(
        "/api/products/remove/",
        data=json.dumps({"id": "nonexistent"}),
        content_type="application/json",
    )
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && uv run pytest tests/test_products_crud.py -v
```
Expected: all tests FAIL (stubs return strings, not JSON).

- [ ] **Step 3: Implement CRUD routes**

Replace the three stubs in `backend/app/products/routes.py` (lines 29-39) with:

```python
@bp.route('/add/', methods=['POST'])
def add():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    required_fields = ["id", "name", "price", "category", "stock", "product"]
    missing = [f for f in required_fields if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    existing = mongo.db.products.find_one({"id": data["id"]})
    if existing:
        return jsonify({"error": "Product with this id already exists"}), 409

    mongo.db.products.insert_one(data)
    return jsonify({"message": "Product added", "id": data["id"]}), 201


@bp.route('/update/', methods=['PUT'])
def update():
    data = request.get_json()
    if not data or "id" not in data:
        return jsonify({"error": "Request body with 'id' is required"}), 400

    product_id = data.pop("id")
    if not data:
        return jsonify({"error": "No fields to update"}), 400

    result = mongo.db.products.update_one({"id": product_id}, {"$set": data})
    if result.matched_count == 0:
        return jsonify({"error": "Product not found"}), 404

    return jsonify({"message": "Product updated"}), 200


@bp.route('/remove/', methods=['DELETE'])
def remove():
    data = request.get_json()
    if not data or "id" not in data:
        return jsonify({"error": "Request body with 'id' is required"}), 400

    result = mongo.db.products.delete_one({"id": data["id"]})
    if result.deleted_count == 0:
        return jsonify({"error": "Product not found"}), 404

    return jsonify({"message": "Product removed"}), 200
```

Also add `request` to the flask import at line 2:

```python
from flask import jsonify, request
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd backend && uv run pytest tests/test_products_crud.py -v
```
Expected: all 7 tests PASS.

- [ ] **Step 5: Run all tests**

Run:
```bash
cd backend && uv run pytest -v
```
Expected: all tests PASS (existing + new).

- [ ] **Step 6: Commit**

```bash
git add backend/app/products/routes.py backend/tests/test_products_crud.py
git commit -m "feat: implement product CRUD endpoints"
```

---

### Task 5: Product Search Endpoint

**Files:**
- Modify: `backend/app/products/routes.py` (add search route)
- Create: `backend/tests/test_search.py`

**Interfaces:**
- Consumes: `mongo.db.products` collection
- Produces: `GET /api/products/search?q=<query>` returns JSON array of matching products

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_search.py`:

```python
def test_search_by_name(client, seed_products):
    response = client.get("/api/products/search?q=akrapovic")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 1
    assert data[0]["id"] == "po-akrapovic-r1"


def test_search_by_category(client, seed_products):
    response = client.get("/api/products/search?q=Yen")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) >= 1


def test_search_no_results(client, seed_products):
    response = client.get("/api/products/search?q=nonexistent")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 0


def test_search_missing_query(client):
    response = client.get("/api/products/search")
    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && uv run pytest tests/test_search.py -v
```
Expected: FAIL with 404 (route does not exist).

- [ ] **Step 3: Add search route**

Add to `backend/app/products/routes.py` (after the `categories` route, before `add`):

```python
@bp.route('/search', methods=['GET'])
def search():
    query = request.args.get('q')
    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400

    results = list(
        mongo.db.products.find(
            {"$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"category": {"$regex": query, "$options": "i"}},
            ]},
            {"_id": False},
        )
    )
    return jsonify(results)
```

Note: We use `$regex` instead of `$text` search because mongomock does not support text indexes. `$regex` with `$options: "i"` gives case-insensitive search which works well for 9 products.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd backend && uv run pytest tests/test_search.py -v
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/products/routes.py backend/tests/test_search.py
git commit -m "feat: add product search endpoint"
```

---

### Task 6: JWT Authentication

**Files:**
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/routes.py`
- Create: `backend/app/middleware.py`
- Modify: `backend/app/__init__.py` (register auth blueprint, add JWT config)
- Modify: `backend/app/products/routes.py` (protect write routes)
- Modify: `backend/tests/test_products_crud.py` (add auth headers)
- Create: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` from app config
- Produces:
  - `POST /api/auth/login` — accepts `{username, password}`, returns `{"token": "<jwt>"}` 200
  - `token_required(f)` decorator — checks `Authorization: Bearer <token>`, returns 401 on failure
  - Protected routes: `add`, `update`, `remove` require valid JWT

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_auth.py`:

```python
import json


def test_login_success(client):
    response = client.post(
        "/api/auth/login",
        data=json.dumps({"username": "admin", "password": "admin123"}),
        content_type="application/json",
    )
    assert response.status_code == 200
    data = response.get_json()
    assert "token" in data


def test_login_wrong_password(client):
    response = client.post(
        "/api/auth/login",
        data=json.dumps({"username": "admin", "password": "wrong"}),
        content_type="application/json",
    )
    assert response.status_code == 401


def test_login_missing_fields(client):
    response = client.post(
        "/api/auth/login",
        data=json.dumps({"username": "admin"}),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_protected_route_no_token(client):
    response = client.post(
        "/api/products/add/",
        data=json.dumps({"id": "test"}),
        content_type="application/json",
    )
    assert response.status_code == 401


def test_protected_route_invalid_token(client):
    response = client.post(
        "/api/products/add/",
        data=json.dumps({"id": "test"}),
        content_type="application/json",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert response.status_code == 401


def test_protected_route_with_valid_token(client, mock_db):
    login_resp = client.post(
        "/api/auth/login",
        data=json.dumps({"username": "admin", "password": "admin123"}),
        content_type="application/json",
    )
    token = login_resp.get_json()["token"]

    new_product = {
        "id": "auth-test-product",
        "name": "Auth Test",
        "price": 100,
        "category": "Test",
        "stock": 1,
        "product": {
            "overall": {"brand": "X", "made_in": "X", "material": "X", "color": "X"},
            "detail": "X",
        },
    }
    response = client.post(
        "/api/products/add/",
        data=json.dumps(new_product),
        content_type="application/json",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && uv run pytest tests/test_auth.py -v
```
Expected: FAIL (auth blueprint does not exist, routes not protected).

- [ ] **Step 3: Create middleware with token_required decorator**

Create `backend/app/middleware.py`:

```python
import functools

import jwt
from flask import current_app, jsonify, request


def token_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Token is missing"}), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0] != "Bearer":
            return jsonify({"error": "Invalid authorization header"}), 401

        token = parts[1]
        try:
            jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)

    return decorated
```

- [ ] **Step 4: Create auth blueprint**

Create `backend/app/auth/__init__.py`:

```python
from flask import Blueprint

bp = Blueprint("auth", __name__)

from app.auth import routes
```

Create `backend/app/auth/routes.py`:

```python
import datetime

import jwt
from flask import current_app, jsonify, request

from app.auth import bp


@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Username and password are required"}), 400

    if (
        data["username"] != current_app.config["ADMIN_USERNAME"]
        or data["password"] != current_app.config["ADMIN_PASSWORD"]
    ):
        return jsonify({"error": "Invalid credentials"}), 401

    token = jwt.encode(
        {
            "sub": data["username"],
            "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1),
        },
        current_app.config["JWT_SECRET"],
        algorithm="HS256",
    )
    return jsonify({"token": token}), 200
```

- [ ] **Step 5: Update app factory — register auth blueprint and add JWT config**

The full updated `backend/app/__init__.py`:

```python
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_pymongo import PyMongo
import os

mongo = PyMongo()


def create_app():
    app = Flask(__name__)
    app.config["MONGO_URI"] = f"mongodb://{os.environ['MONGO_INITDB_ROOT_USERNAME']}:{os.environ['MONGO_INITDB_ROOT_PASSWORD']}@{os.environ['MONGODB_HOST']}/my_web_app?authSource=admin"

    app.config["JWT_SECRET"] = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
    app.config["ADMIN_USERNAME"] = os.environ.get("ADMIN_USERNAME", "admin")
    app.config["ADMIN_PASSWORD"] = os.environ.get("ADMIN_PASSWORD", "admin123")

    # Initialize Flask extensions here
    mongo.init_app(app)

    # Register blueprints here
    from app.main import bp as main_bp
    app.register_blueprint(main_bp)

    from app.products import bp as products_bp
    app.register_blueprint(products_bp, url_prefix='/api/products')

    from app.health import bp as health_bp
    app.register_blueprint(health_bp, url_prefix='/api/health')

    from app.auth import bp as auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    @app.route('/test/')
    def test_page():
        return '<h1>Testing the Flask Application Factory Pattern</h1>'

    @app.errorhandler(404)
    def not_found_error(error):
        if request.accept_mimetypes.best_match(['text/html', 'application/json']) == 'application/json':
            return jsonify({'error': 'Not found'}), 404
        return '<h1>404 Not Found</h1>', 404

    return app
```

- [ ] **Step 6: Protect CRUD routes with @token_required**

In `backend/app/products/routes.py`, add the import at the top:

```python
from app.middleware import token_required
```

Then add `@token_required` decorator to the three write routes (after `@bp.route`, before `def`):

```python
@bp.route('/add/', methods=['POST'])
@token_required
def add():
    # ... existing implementation unchanged ...

@bp.route('/update/', methods=['PUT'])
@token_required
def update():
    # ... existing implementation unchanged ...

@bp.route('/remove/', methods=['DELETE'])
@token_required
def remove():
    # ... existing implementation unchanged ...
```

- [ ] **Step 7: Update CRUD tests to include auth tokens**

Replace `backend/tests/test_products_crud.py` with the version that gets auth tokens:

```python
import json


def get_auth_token(client):
    resp = client.post(
        "/api/auth/login",
        data=json.dumps({"username": "admin", "password": "admin123"}),
        content_type="application/json",
    )
    return resp.get_json()["token"]


def test_add_product(client, mock_db):
    token = get_auth_token(client)
    new_product = {
        "id": "test-product",
        "name": "Test Product",
        "price": 100,
        "category": "Test",
        "stock": 5,
        "product": {
            "overall": {
                "brand": "TestBrand",
                "made_in": "Vietnam",
                "material": "Steel",
                "color": "Red",
            },
            "detail": "A test product",
        },
    }
    response = client.post(
        "/api/products/add/",
        data=json.dumps(new_product),
        content_type="application/json",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.get_json()
    assert data["message"] == "Product added"
    assert data["id"] == "test-product"

    saved = mock_db.products.find_one({"id": "test-product"})
    assert saved is not None
    assert saved["name"] == "Test Product"


def test_add_product_missing_fields(client):
    token = get_auth_token(client)
    response = client.post(
        "/api/products/add/",
        data=json.dumps({"name": "Incomplete"}),
        content_type="application/json",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400


def test_add_product_duplicate_id(client, seed_products):
    token = get_auth_token(client)
    duplicate = {
        "id": "yen-doi-triump-speed-400",
        "name": "Duplicate",
        "price": 100,
        "category": "Test",
        "stock": 1,
        "product": {
            "overall": {"brand": "X", "made_in": "X", "material": "X", "color": "X"},
            "detail": "X",
        },
    }
    response = client.post(
        "/api/products/add/",
        data=json.dumps(duplicate),
        content_type="application/json",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 409


def test_update_product(client, seed_products):
    token = get_auth_token(client)
    response = client.put(
        "/api/products/update/",
        data=json.dumps({"id": "yen-doi-triump-speed-400", "price": 250}),
        content_type="application/json",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Product updated"


def test_update_product_not_found(client, seed_products):
    token = get_auth_token(client)
    response = client.put(
        "/api/products/update/",
        data=json.dumps({"id": "nonexistent", "price": 100}),
        content_type="application/json",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_remove_product(client, seed_products):
    token = get_auth_token(client)
    response = client.delete(
        "/api/products/remove/",
        data=json.dumps({"id": "po-akrapovic-r1"}),
        content_type="application/json",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Product removed"


def test_remove_product_not_found(client, seed_products):
    token = get_auth_token(client)
    response = client.delete(
        "/api/products/remove/",
        data=json.dumps({"id": "nonexistent"}),
        content_type="application/json",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404
```

- [ ] **Step 8: Run auth tests**

Run:
```bash
cd backend && uv run pytest tests/test_auth.py -v
```
Expected: all 6 tests PASS.

- [ ] **Step 9: Run ALL tests**

Run:
```bash
cd backend && uv run pytest -v
```
Expected: ALL tests PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/app/auth/ backend/app/middleware.py backend/app/__init__.py backend/app/products/routes.py backend/tests/test_auth.py backend/tests/test_products_crud.py
git commit -m "feat: add JWT authentication, protect CRUD routes"
```

---

### Task 7: Contact Form Endpoint (SES)

**Files:**
- Create: `backend/app/contact/__init__.py`
- Create: `backend/app/contact/routes.py`
- Modify: `backend/app/__init__.py` (register blueprint)
- Create: `backend/tests/test_contact.py`

**Interfaces:**
- Consumes: `FLASK_ENV`, `SES_SENDER_EMAIL`, `SES_RECIPIENT_EMAIL` from app config
- Produces: `POST /api/contact` — accepts `{name, email, message}`, returns `{"message": "Message sent"}` 200

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_contact.py`:

```python
import json


def test_contact_submit(client):
    response = client.post(
        "/api/contact",
        data=json.dumps({
            "name": "Test User",
            "email": "test@example.com",
            "message": "Hello, this is a test message.",
        }),
        content_type="application/json",
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Message sent"


def test_contact_missing_fields(client):
    response = client.post(
        "/api/contact",
        data=json.dumps({"name": "Test"}),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_contact_invalid_email(client):
    response = client.post(
        "/api/contact",
        data=json.dumps({
            "name": "Test",
            "email": "not-an-email",
            "message": "Hello",
        }),
        content_type="application/json",
    )
    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && uv run pytest tests/test_contact.py -v
```
Expected: FAIL (blueprint does not exist).

- [ ] **Step 3: Create contact blueprint**

Create `backend/app/contact/__init__.py`:

```python
from flask import Blueprint

bp = Blueprint("contact", __name__)

from app.contact import routes
```

Create `backend/app/contact/routes.py`:

```python
import logging
import re

from flask import current_app, jsonify, request

from app.contact import bp

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


@bp.route("", methods=["POST"])
def submit_contact():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    required = ["name", "email", "message"]
    missing = [f for f in required if f not in data or not data[f].strip()]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    if not EMAIL_REGEX.match(data["email"]):
        return jsonify({"error": "Invalid email format"}), 400

    env = current_app.config.get("FLASK_ENV", "development")
    if env == "production":
        _send_ses_email(data)
    else:
        logger.info(
            "Contact form (dev mode - not sending email): name=%s email=%s message=%s",
            data["name"],
            data["email"],
            data["message"],
        )

    return jsonify({"message": "Message sent"}), 200


def _send_ses_email(data):
    import boto3

    ses = boto3.client("ses", region_name=current_app.config.get("AWS_REGION", "ap-southeast-1"))
    ses.send_email(
        Source=current_app.config["SES_SENDER_EMAIL"],
        Destination={"ToAddresses": [current_app.config["SES_RECIPIENT_EMAIL"]]},
        Message={
            "Subject": {"Data": f"Contact Form: {data['name']}"},
            "Body": {
                "Text": {
                    "Data": f"Name: {data['name']}\nEmail: {data['email']}\n\nMessage:\n{data['message']}"
                }
            },
        },
    )
```

- [ ] **Step 4: Register contact blueprint**

Add to `backend/app/__init__.py` after the auth blueprint registration:

```python
    from app.contact import bp as contact_bp
    app.register_blueprint(contact_bp, url_prefix='/api/contact')
```

- [ ] **Step 5: Run tests**

Run:
```bash
cd backend && uv run pytest tests/test_contact.py -v
```
Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/contact/ backend/tests/test_contact.py backend/app/__init__.py
git commit -m "feat: add contact form endpoint with SES support"
```

---

### Task 8: Feedback Endpoint

**Files:**
- Create: `backend/app/feedback/__init__.py`
- Create: `backend/app/feedback/routes.py`
- Modify: `backend/app/__init__.py` (register blueprint)
- Create: `backend/tests/test_feedback.py`

**Interfaces:**
- Consumes: `mongo.db.feedback` collection (new collection)
- Produces: `POST /api/feedback` — accepts `{name, rating, comment}`, returns `{"message": "Feedback submitted"}` 201

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_feedback.py`:

```python
import json


def test_submit_feedback(client, mock_db):
    response = client.post(
        "/api/feedback",
        data=json.dumps({
            "name": "Test User",
            "rating": 5,
            "comment": "Great shop!",
        }),
        content_type="application/json",
    )
    assert response.status_code == 201
    data = response.get_json()
    assert data["message"] == "Feedback submitted"

    saved = mock_db.feedback.find_one({"name": "Test User"})
    assert saved is not None
    assert saved["rating"] == 5


def test_submit_feedback_missing_fields(client):
    response = client.post(
        "/api/feedback",
        data=json.dumps({"name": "Test"}),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_submit_feedback_invalid_rating(client):
    response = client.post(
        "/api/feedback",
        data=json.dumps({
            "name": "Test",
            "rating": 6,
            "comment": "Hello",
        }),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_submit_feedback_rating_must_be_int(client):
    response = client.post(
        "/api/feedback",
        data=json.dumps({
            "name": "Test",
            "rating": "five",
            "comment": "Hello",
        }),
        content_type="application/json",
    )
    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && uv run pytest tests/test_feedback.py -v
```
Expected: FAIL.

- [ ] **Step 3: Create feedback blueprint**

Create `backend/app/feedback/__init__.py`:

```python
from flask import Blueprint

bp = Blueprint("feedback", __name__)

from app.feedback import routes
```

Create `backend/app/feedback/routes.py`:

```python
from flask import jsonify, request

from app import mongo
from app.feedback import bp


@bp.route("", methods=["POST"])
def submit_feedback():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    required = ["name", "rating", "comment"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    if not isinstance(data["rating"], int) or not (1 <= data["rating"] <= 5):
        return jsonify({"error": "Rating must be an integer between 1 and 5"}), 400

    mongo.db.feedback.insert_one({
        "name": data["name"],
        "rating": data["rating"],
        "comment": data["comment"],
    })

    return jsonify({"message": "Feedback submitted"}), 201
```

- [ ] **Step 4: Register feedback blueprint**

Add to `backend/app/__init__.py` after the contact blueprint registration:

```python
    from app.feedback import bp as feedback_bp
    app.register_blueprint(feedback_bp, url_prefix='/api/feedback')
```

- [ ] **Step 5: Run tests**

Run:
```bash
cd backend && uv run pytest tests/test_feedback.py -v
```
Expected: all 4 tests PASS.

- [ ] **Step 6: Run all tests**

Run:
```bash
cd backend && uv run pytest -v
```
Expected: ALL tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/feedback/ backend/tests/test_feedback.py backend/app/__init__.py
git commit -m "feat: add feedback submission endpoint"
```

---

### Task 9: Structured JSON Logging

**Files:**
- Create: `backend/app/logging_config.py`
- Modify: `backend/app/__init__.py` (call logging setup)

**Interfaces:**
- Consumes: nothing
- Produces: `setup_logging()` function; all Flask logs output as JSON lines

- [ ] **Step 1: Create JSON log formatter**

Create `backend/app/logging_config.py`:

```python
import json
import logging
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def setup_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
```

- [ ] **Step 2: Call setup_logging in app factory**

Add to `backend/app/__init__.py` at the top of `create_app()`, before other setup:

```python
def create_app():
    from app.logging_config import setup_logging
    setup_logging()

    app = Flask(__name__)
    # ... rest of factory unchanged ...
```

- [ ] **Step 3: Verify logs are JSON**

Run:
```bash
cd backend && uv run pytest -v 2>&1 | head -5
```
Expected: tests pass, any log output is JSON-formatted.

- [ ] **Step 4: Commit**

```bash
git add backend/app/logging_config.py backend/app/__init__.py
git commit -m "feat: add structured JSON logging"
```

---

### Task 10: Final Lint Pass and Cleanup

**Files:**
- Potentially modify any file with lint issues

**Interfaces:**
- Consumes: all files from Tasks 1-9
- Produces: clean lint, all tests passing

- [ ] **Step 1: Run ruff on entire backend**

Run:
```bash
cd backend && uv run ruff check app/ tests/ --fix
```
Expected: auto-fixes applied, or clean.

- [ ] **Step 2: Run ruff format**

Run:
```bash
cd backend && uv run ruff format app/ tests/
```
Expected: files formatted.

- [ ] **Step 3: Run full test suite**

Run:
```bash
cd backend && uv run pytest -v
```
Expected: ALL tests PASS.

- [ ] **Step 4: Commit**

```bash
git add -A backend/
git commit -m "chore: lint and format all backend code"
```

- [ ] **Step 5: Verify test count**

Run:
```bash
cd backend && uv run pytest --co -q
```
Expected: ~28+ tests collected across all test files.
