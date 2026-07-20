# CI/CD + Kubernetes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full GitHub Actions CI/CD pipeline that lints, tests, builds Docker images, pushes to GHCR, and deploys to a local minikube cluster on every merge to `main`.

**Architecture:** Three-stage pipeline (CI → Build/Push → Deploy). Kubernetes manifests in `k8s/` describe all four services in a `motor-shop` namespace. A self-hosted GitHub Actions runner on the local machine runs the deploy stage against minikube.

**Tech Stack:** GitHub Actions, GitHub Container Registry (GHCR), minikube, kubectl, Python 3.12, uv, pytest, mongomock, flake8

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `.github/workflows/ci.yml` | Stage 1: lint + test + manifest dry-run |
| Create | `.github/workflows/cd.yml` | Stage 2+3: build/push images + deploy |
| Create | `k8s/namespace.yaml` | motor-shop namespace |
| Create | `k8s/configmap.yaml` | App env vars + nginx.conf + mongo-init.sh |
| Create | `k8s/backend-deployment.yaml` | Backend Deployment + ClusterIP Service |
| Create | `k8s/mongodb-deployment.yaml` | MongoDB Deployment + ClusterIP Service + PVC |
| Create | `k8s/minio-deployment.yaml` | MinIO Deployment + ClusterIP Service + PVC |
| Create | `k8s/frontend-deployment.yaml` | Nginx Deployment + NodePort Service |
| Create | `backend/tests/__init__.py` | Makes tests a package |
| Create | `backend/tests/test_routes.py` | pytest suite with mongomock |
| Modify | `backend/pyproject.toml` | Add pytest + mongomock dev dependencies |
| Modify | `.gitignore` | Add k8s/secret.yaml |

---

## Prerequisites (do these manually before starting tasks)

1. **Install minikube** on your local machine: https://minikube.sigs.k8s.io/docs/start/
2. **Start minikube:** `minikube start`
3. **Verify kubectl works:** `kubectl get nodes` — should show one node `Ready`
4. **Install a self-hosted GitHub Actions runner** on your local machine:
   - Go to your GitHub repo → Settings → Actions → Runners → New self-hosted runner
   - Follow the Linux/macOS/Windows instructions shown
   - The runner process must be running when the CD pipeline triggers
5. **Confirm your GitHub username** — used in image names as `ghcr.io/<your-username>/...`

---

## Task 1: Add pytest + mongomock dependencies

**Files:**
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Add dev dependencies to pyproject.toml**

Open `backend/pyproject.toml` and add an optional dev group:

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
]

[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "mongomock>=4.1.2",
]
```

- [ ] **Step 2: Sync dependencies**

```bash
cd backend
uv sync --group dev
```

Expected: uv resolves and installs pytest and mongomock. No errors.

- [ ] **Step 3: Commit**

```bash
cd ..
git add backend/pyproject.toml backend/uv.lock
git commit -m "[backend] Add pytest and mongomock dev dependencies"
```

---

## Task 2: Write the backend test suite

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_routes.py`

- [ ] **Step 1: Create the tests package**

```bash
mkdir backend/tests
touch backend/tests/__init__.py
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_routes.py` with this content:

```python
import pytest
import mongomock
from unittest.mock import patch
from app import create_app


@pytest.fixture
def app():
    """Create app with mongomock patching PyMongo's MongoClient."""
    with patch("flask_pymongo.PyMongo.init_app"):
        application = create_app()
        application.config["TESTING"] = True
        yield application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def mock_mongo(app):
    """Replace mongo.db with a mongomock database for every test."""
    import app as app_module
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["my_web_app"]

    # Seed test data
    mock_db.products.insert_many([
        {
            "id": "lop-michelin-city-grip-2",
            "name": "Lốp Michelin City Grip 2",
            "price": 850000,
            "category": "Lốp xe",
            "description": "Lốp xe cao cấp",
            "image": "lop-michelin-city-grip-2/main.jpg",
        },
        {
            "id": "po-akrapovic-r1",
            "name": "Pô Akrapovic R1",
            "price": 4500000,
            "category": "Pô xe",
            "description": "Pô độ cao cấp",
            "image": "po-akrapovic-r1/main.jpg",
        },
    ])

    with patch.object(app_module.mongo, "db", mock_db):
        yield


def test_products_list_returns_200(client):
    response = client.get("/api/products/all/")
    assert response.status_code == 200


def test_products_list_returns_json_array(client):
    response = client.get("/api/products/all/")
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) == 2


def test_products_list_contains_expected_fields(client):
    response = client.get("/api/products/all/")
    product = response.get_json()[0]
    for field in ("id", "name", "price", "category", "description", "image"):
        assert field in product


def test_get_product_by_id_returns_200(client):
    response = client.get("/api/products/lop-michelin-city-grip-2/info")
    assert response.status_code == 200


def test_get_product_by_id_returns_correct_product(client):
    response = client.get("/api/products/lop-michelin-city-grip-2/info")
    data = response.get_json()
    assert data["id"] == "lop-michelin-city-grip-2"
    assert data["name"] == "Lốp Michelin City Grip 2"


def test_get_nonexistent_product_returns_404(client):
    response = client.get("/api/products/does-not-exist/info")
    assert response.status_code == 404


def test_categories_returns_list(client):
    response = client.get("/api/products/categories/")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert "Lốp xe" in data
```

- [ ] **Step 3: Run tests — expect them to fail first**

```bash
cd backend
uv run --group dev pytest tests/ -v
```

Expected: errors about `MONGODB_HOST` env var not set (the app reads `os.environ['MONGODB_HOST']` in `create_app()`). This is expected — we need to fix the mock.

- [ ] **Step 4: Fix the app fixture to set the env var**

The `create_app()` call reads `os.environ['MONGODB_HOST']` directly. Patch it in the fixture. Update the `app` fixture in `backend/tests/test_routes.py`:

```python
@pytest.fixture
def app():
    """Create app with mongomock patching PyMongo's MongoClient."""
    import os
    os.environ.setdefault("MONGODB_HOST", "localhost")
    with patch("flask_pymongo.PyMongo.init_app"):
        application = create_app()
        application.config["TESTING"] = True
        yield application
```

- [ ] **Step 5: Run tests — expect them to pass**

```bash
cd backend
uv run --group dev pytest tests/ -v
```

Expected output:
```
PASSED tests/test_routes.py::test_products_list_returns_200
PASSED tests/test_routes.py::test_products_list_returns_json_array
PASSED tests/test_routes.py::test_products_list_contains_expected_fields
PASSED tests/test_routes.py::test_get_product_by_id_returns_200
PASSED tests/test_routes.py::test_get_product_by_id_returns_correct_product
PASSED tests/test_routes.py::test_get_nonexistent_product_returns_404
PASSED tests/test_routes.py::test_categories_returns_list
7 passed in ...
```

- [ ] **Step 6: Commit**

```bash
cd ..
git add backend/tests/
git commit -m "[backend] Add pytest test suite with mongomock"
```

---

## Task 3: Kubernetes namespace + ConfigMap

**Files:**
- Create: `k8s/namespace.yaml`
- Create: `k8s/configmap.yaml`

- [ ] **Step 1: Create namespace manifest**

Create `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: motor-shop
```

- [ ] **Step 2: Create configmap manifest**

Create `k8s/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: motor-shop
data:
  FLASK_APP: "app"
  MONGODB_HOST: "mongodb"
  nginx.conf: |
    server {
        listen 80;

        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;
        }

        location /product/ {
            root /usr/share/nginx/html;
            try_files $uri /pages/product_info.html;
        }

        location /api/ {
            proxy_pass http://backend:5000/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location /image/product/ {
            proxy_pass http://minio:9000/product-image/;
            proxy_set_header Host minio:9000;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
  mongo-init.sh: |
    #!/bin/bash
    set -e
    mongoimport --db my_web_app --collection products \
      --file /docker-entrypoint-initdb.d/products.json --jsonArray
```

- [ ] **Step 3: Apply and verify**

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl get configmap app-config -n motor-shop
```

Expected: `app-config` listed with `DATA: 4`.

- [ ] **Step 4: Commit**

```bash
git add k8s/namespace.yaml k8s/configmap.yaml
git commit -m "[k8s] Add namespace and configmap"
```

---

## Task 4: Create the MinIO k8s Secret (manually)

Secrets are never committed. You create this once on the cluster.

- [ ] **Step 1: Create the secret on minikube**

Replace `<your-minio-user>` and `<your-minio-password>` with the values from your `.env` file:

```bash
kubectl create secret generic minio-credentials \
  --from-literal=MINIO_ROOT_USER=<your-minio-user> \
  --from-literal=MINIO_ROOT_PASSWORD=<your-minio-password> \
  --namespace motor-shop
```

- [ ] **Step 2: Verify**

```bash
kubectl get secret minio-credentials -n motor-shop
```

Expected: secret listed with `TYPE: Opaque`.

- [ ] **Step 3: Add secret.yaml to .gitignore**

Open `.gitignore` (create it at the repo root if it doesn't exist) and add:

```
k8s/secret.yaml
.env
```

```bash
git add .gitignore
git commit -m "[infra] Gitignore k8s secret and .env"
```

---

## Task 5: MongoDB Kubernetes manifests

**Files:**
- Create: `k8s/mongodb-deployment.yaml`

- [ ] **Step 1: Create MongoDB deployment + service + PVC**

Create `k8s/mongodb-deployment.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
  namespace: motor-shop
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
  namespace: motor-shop
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
        - name: mongodb
          image: IMAGE_TAG_MONGODB
          ports:
            - containerPort: 27017
          volumeMounts:
            - name: mongodb-data
              mountPath: /data/db
            - name: init-script
              mountPath: /docker-entrypoint-initdb.d/mongo-init.sh
              subPath: mongo-init.sh
            - name: init-script
              mountPath: /docker-entrypoint-initdb.d/products.json
              subPath: products.json
          readinessProbe:
            exec:
              command:
                - mongosh
                - --eval
                - "db.runCommand('ping').ok"
            initialDelaySeconds: 20
            periodSeconds: 10
            failureThreshold: 5
      volumes:
        - name: mongodb-data
          persistentVolumeClaim:
            claimName: mongodb-pvc
        - name: init-script
          configMap:
            name: app-config
---
apiVersion: v1
kind: Service
metadata:
  name: mongodb
  namespace: motor-shop
spec:
  selector:
    app: mongodb
  ports:
    - port: 27017
      targetPort: 27017
  type: ClusterIP
```

**Note:** `IMAGE_TAG_MONGODB` is a placeholder — the CD pipeline replaces it with the actual GHCR image + SHA tag at deploy time.

**Note:** `products.json` is large to embed in a ConfigMap. Instead, the custom MongoDB Docker image already bakes it in via `mongo-init.sh` in the Dockerfile. So this manifest uses the custom GHCR image (`motor-shop-mongodb`) which already contains the seed script. The `init-script` volume mount for `mongo-init.sh` from ConfigMap is therefore **not needed** — remove those two `volumeMounts` and the `init-script` volume entry. The final manifest:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
  namespace: motor-shop
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
  namespace: motor-shop
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
        - name: mongodb
          image: IMAGE_TAG_MONGODB
          ports:
            - containerPort: 27017
          volumeMounts:
            - name: mongodb-data
              mountPath: /data/db
          readinessProbe:
            exec:
              command:
                - mongosh
                - --eval
                - "db.runCommand('ping').ok"
            initialDelaySeconds: 20
            periodSeconds: 10
            failureThreshold: 5
      volumes:
        - name: mongodb-data
          persistentVolumeClaim:
            claimName: mongodb-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: mongodb
  namespace: motor-shop
spec:
  selector:
    app: mongodb
  ports:
    - port: 27017
      targetPort: 27017
  type: ClusterIP
```

- [ ] **Step 2: Dry-run validate**

```bash
kubectl apply --dry-run=client -f k8s/mongodb-deployment.yaml
```

Expected: `persistentvolumeclaim/mongodb-pvc configured (dry run)`, `deployment.apps/mongodb configured (dry run)`, `service/mongodb configured (dry run)`

- [ ] **Step 3: Commit**

```bash
git add k8s/mongodb-deployment.yaml
git commit -m "[k8s] Add MongoDB deployment, service, and PVC"
```

---

## Task 6: MinIO Kubernetes manifests

**Files:**
- Create: `k8s/minio-deployment.yaml`

- [ ] **Step 1: Create MinIO deployment + service + PVC**

Create `k8s/minio-deployment.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: minio-pvc
  namespace: motor-shop
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
  namespace: motor-shop
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minio
  template:
    metadata:
      labels:
        app: minio
    spec:
      containers:
        - name: minio
          image: IMAGE_TAG_MINIO
          ports:
            - containerPort: 9000
            - containerPort: 9001
          env:
            - name: MINIO_ROOT_USER
              valueFrom:
                secretKeyRef:
                  name: minio-credentials
                  key: MINIO_ROOT_USER
            - name: MINIO_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: minio-credentials
                  key: MINIO_ROOT_PASSWORD
          volumeMounts:
            - name: minio-data
              mountPath: /data
          readinessProbe:
            httpGet:
              path: /minio/health/live
              port: 9000
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 30
      volumes:
        - name: minio-data
          persistentVolumeClaim:
            claimName: minio-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: minio
  namespace: motor-shop
spec:
  selector:
    app: minio
  ports:
    - name: api
      port: 9000
      targetPort: 9000
    - name: console
      port: 9001
      targetPort: 9001
  type: ClusterIP
```

- [ ] **Step 2: Dry-run validate**

```bash
kubectl apply --dry-run=client -f k8s/minio-deployment.yaml
```

Expected: 3 lines, each ending with `(dry run)`.

- [ ] **Step 3: Commit**

```bash
git add k8s/minio-deployment.yaml
git commit -m "[k8s] Add MinIO deployment, service, and PVC"
```

---

## Task 7: Backend Kubernetes manifests

**Files:**
- Create: `k8s/backend-deployment.yaml`

- [ ] **Step 1: Create backend deployment + service**

Create `k8s/backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: motor-shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: IMAGE_TAG_BACKEND
          ports:
            - containerPort: 5000
          env:
            - name: FLASK_APP
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: FLASK_APP
            - name: MONGODB_HOST
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: MONGODB_HOST
          livenessProbe:
            httpGet:
              path: /api/products/all/
              port: 5000
            initialDelaySeconds: 30
            periodSeconds: 15
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/products/all/
              port: 5000
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 5
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: motor-shop
spec:
  selector:
    app: backend
  ports:
    - port: 5000
      targetPort: 5000
  type: ClusterIP
```

- [ ] **Step 2: Dry-run validate**

```bash
kubectl apply --dry-run=client -f k8s/backend-deployment.yaml
```

Expected: `deployment.apps/backend configured (dry run)`, `service/backend configured (dry run)`

- [ ] **Step 3: Commit**

```bash
git add k8s/backend-deployment.yaml
git commit -m "[k8s] Add backend deployment and service"
```

---

## Task 8: Frontend Kubernetes manifests

**Files:**
- Create: `k8s/frontend-deployment.yaml`

- [ ] **Step 1: Create frontend deployment + NodePort service**

Create `k8s/frontend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: motor-shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: IMAGE_TAG_FRONTEND
          ports:
            - containerPort: 80
          volumeMounts:
            - name: nginx-config
              mountPath: /etc/nginx/conf.d/default.conf
              subPath: nginx.conf
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 5
      volumes:
        - name: nginx-config
          configMap:
            name: app-config
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: motor-shop
spec:
  selector:
    app: frontend
  type: NodePort
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
```

- [ ] **Step 2: Dry-run validate all manifests together**

```bash
kubectl apply --dry-run=client -f k8s/
```

Expected: all resources listed with `(dry run)`.

- [ ] **Step 3: Commit**

```bash
git add k8s/frontend-deployment.yaml
git commit -m "[k8s] Add frontend deployment and NodePort service"
```

---

## Task 9: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install uv
        run: pip install uv

      - name: Install dependencies
        run: |
          cd backend
          uv sync --group dev

      - name: Lint with flake8
        run: |
          cd backend
          uv run flake8 app/ --max-line-length=120 --exclude=__pycache__

      - name: Run tests
        run: |
          cd backend
          uv run --group dev pytest tests/ -v

  validate-manifests:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: "latest"

      - name: Replace image tag placeholders for dry-run
        run: |
          find k8s/ -name "*.yaml" -exec sed -i 's|IMAGE_TAG_[A-Z]*|nginx:alpine|g' {} +

      - name: Validate Kubernetes manifests
        run: kubectl apply --dry-run=client -f k8s/
```

**Note:** The manifest validation job replaces `IMAGE_TAG_*` placeholders with a dummy image (`nginx:alpine`) so `kubectl --dry-run` doesn't reject the manifests for having invalid image references.

- [ ] **Step 2: Add flake8 to dev dependencies**

Open `backend/pyproject.toml` and add `flake8` to the dev group:

```toml
[dependency-groups]
dev = [
    "flake8>=7.0.0",
    "pytest>=8.0.0",
    "mongomock>=4.1.2",
]
```

```bash
cd backend && uv sync --group dev && cd ..
```

- [ ] **Step 3: Run flake8 locally to check for lint errors**

```bash
cd backend
uv run flake8 app/ --max-line-length=120 --exclude=__pycache__
```

Expected: no output (zero lint errors). Fix any errors before continuing.

- [ ] **Step 4: Commit**

```bash
cd ..
git add .github/workflows/ci.yml backend/pyproject.toml backend/uv.lock
git commit -m "[ci] Add GitHub Actions CI workflow (lint + test + manifest validation)"
```

- [ ] **Step 5: Push and verify CI passes**

```bash
git push origin main
```

Go to your GitHub repo → Actions tab. The CI workflow should appear, run, and all jobs should show green checkmarks.

---

## Task 10: GitHub Actions CD workflow

**Files:**
- Create: `.github/workflows/cd.yml`

- [ ] **Step 1: Add GitHub Actions secrets**

In your GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- `MINIO_ROOT_USER` — your MinIO username
- `MINIO_ROOT_PASSWORD` — your MinIO password

These are used by the CD workflow to recreate the k8s Secret on each deploy.

- [ ] **Step 2: Create the CD workflow**

Create `.github/workflows/cd.yml`:

```yaml
name: CD

on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.meta.outputs.sha }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set image tag
        id: meta
        run: echo "sha=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Build and push backend image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./infra/service/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/motor-shop-backend:latest
            ghcr.io/${{ github.repository_owner }}/motor-shop-backend:${{ steps.meta.outputs.sha }}

      - name: Build and push mongodb image
        uses: docker/build-push-action@v5
        with:
          context: ./infra/mongodb
          file: ./infra/mongodb/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/motor-shop-mongodb:latest
            ghcr.io/${{ github.repository_owner }}/motor-shop-mongodb:${{ steps.meta.outputs.sha }}

      - name: Build and push minio image
        uses: docker/build-push-action@v5
        with:
          context: ./infra/minio
          file: ./infra/minio/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/motor-shop-minio:latest
            ghcr.io/${{ github.repository_owner }}/motor-shop-minio:${{ steps.meta.outputs.sha }}

      - name: Build and push frontend image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./infra/frontend/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/motor-shop-frontend:latest
            ghcr.io/${{ github.repository_owner }}/motor-shop-frontend:${{ steps.meta.outputs.sha }}

  deploy:
    runs-on: self-hosted
    needs: build-and-push
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Recreate MinIO secret on cluster
        run: |
          kubectl create secret generic minio-credentials \
            --from-literal=MINIO_ROOT_USER=${{ secrets.MINIO_ROOT_USER }} \
            --from-literal=MINIO_ROOT_PASSWORD=${{ secrets.MINIO_ROOT_PASSWORD }} \
            --namespace motor-shop \
            --dry-run=client -o yaml | kubectl apply -f -

      - name: Substitute image tags in manifests
        run: |
          SHA=${{ needs.build-and-push.outputs.image_tag }}
          OWNER=${{ github.repository_owner }}
          sed -i "s|IMAGE_TAG_BACKEND|ghcr.io/${OWNER}/motor-shop-backend:${SHA}|g" k8s/backend-deployment.yaml
          sed -i "s|IMAGE_TAG_MONGODB|ghcr.io/${OWNER}/motor-shop-mongodb:${SHA}|g" k8s/mongodb-deployment.yaml
          sed -i "s|IMAGE_TAG_MINIO|ghcr.io/${OWNER}/motor-shop-minio:${SHA}|g" k8s/minio-deployment.yaml
          sed -i "s|IMAGE_TAG_FRONTEND|ghcr.io/${OWNER}/motor-shop-frontend:${SHA}|g" k8s/frontend-deployment.yaml

      - name: Apply namespace and config
        run: |
          kubectl apply -f k8s/namespace.yaml
          kubectl apply -f k8s/configmap.yaml

      - name: Apply all manifests
        run: kubectl apply -f k8s/

      - name: Wait for rollouts
        run: |
          kubectl rollout status deployment/backend -n motor-shop --timeout=120s
          kubectl rollout status deployment/frontend -n motor-shop --timeout=120s
          kubectl rollout status deployment/mongodb -n motor-shop --timeout=120s
          kubectl rollout status deployment/minio -n motor-shop --timeout=120s
```

- [ ] **Step 3: Make GHCR packages public (one-time)**

After the first push, GHCR creates the packages as private by default. Go to:
`github.com/<your-username>` → Packages → each `motor-shop-*` package → Package settings → Change visibility → Public

This allows minikube to pull the images without authentication. Alternatively, configure an image pull secret (more advanced — optional for local learning).

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/cd.yml
git commit -m "[ci] Add GitHub Actions CD workflow (build/push + deploy)"
git push origin main
```

- [ ] **Step 5: Verify the pipeline**

1. Go to GitHub → Actions tab
2. Watch the CD workflow run: `build-and-push` job on `ubuntu-latest`, then `deploy` job on `self-hosted`
3. After it completes, verify the app is running:

```bash
kubectl get pods -n motor-shop
```

Expected: all pods in `Running` state.

```bash
minikube service frontend -n motor-shop --url
```

Open the printed URL in your browser. You should see the motor shop product listing page.

---

## Task 11: Verify rollback works

- [ ] **Step 1: Check current rollout history**

```bash
kubectl rollout history deployment/backend -n motor-shop
```

Expected: at least 1 revision listed.

- [ ] **Step 2: Simulate a bad deploy by breaking the backend image (optional test)**

You can skip this step and just verify the command syntax works:

```bash
# Dry-run: see what rollback would do
kubectl rollout undo deployment/backend -n motor-shop --dry-run=client
```

- [ ] **Step 3: Confirm pods are healthy**

```bash
kubectl get pods -n motor-shop
kubectl describe deployment backend -n motor-shop | grep Image
```

Expected: image tag matches the SHA from the last successful pipeline run.

- [ ] **Step 4: Final commit — update README**

Add a `## DevOps` section to the root `README.md` with:

```markdown
## DevOps

### CI/CD

- **CI:** Runs on every push and PR — lints Python (`flake8`), runs tests (`pytest` + `mongomock`), validates Kubernetes manifests
- **CD:** Runs on merge to `main` — builds and pushes 4 Docker images to GHCR, deploys to local minikube via self-hosted runner

### Kubernetes (local)

- Cluster: single-node minikube
- Namespace: `motor-shop`
- Access app: `minikube service frontend -n motor-shop --url`

### Rollback

```bash
kubectl rollout undo deployment/<name> -n motor-shop
```

### Future phases

See `docs/superpowers/specs/2026-07-20-cicd-kubernetes-design.md` for the full roadmap (EKS, Helm, ArgoCD).
```

```bash
git add README.md
git commit -m "[docs] Add DevOps section to README"
git push origin main
```

---

## Done ✓

At this point you have:
- A working CI pipeline that gates all PRs with lint + tests
- Docker images automatically built and pushed to GHCR on every merge
- Kubernetes manifests for all 4 services running in minikube
- Automatic deploy via self-hosted GitHub Actions runner
- Rollback capability via `kubectl rollout undo`
