# CI/CD + Kubernetes Design — My Motor Shop

**Date:** 2026-07-20  
**Scope:** Phase 1 — GitHub Actions pipeline + local minikube deployment  
**Out of scope:** EKS migration, Helm, ArgoCD, TLS, autoscaling, frontend tests

---

## Goal

Add a full CI/CD pipeline using GitHub Actions that automatically lints, tests, builds Docker images, pushes them to GitHub Container Registry (GHCR), and deploys the app to a local minikube Kubernetes cluster on every merge to `main`.

---

## Approach

**GitHub Actions → GHCR → minikube (self-hosted runner)**

- CI runs on every push and PR
- Build & deploy run only on push to `main`, after CI passes
- A self-hosted GitHub Actions runner on the local machine bridges GitHub to the local minikube cluster
- Kubernetes manifests live in `k8s/` in the repo — the same manifests will target EKS in a future phase

---

## Pipeline Structure

### Stage 1 — CI (triggers: all pushes, all PRs)

1. Checkout code
2. Set up Python + `uv`
3. Run `flake8` lint on `backend/`
4. Run `pytest backend/tests/ -v` (mocked MongoDB via `mongomock`)
5. Validate Kubernetes manifests: `kubectl apply --dry-run=client -f k8s/`

If any step fails, the pipeline stops. No images are built, no deploy happens.

### Stage 2 — Build & Push (triggers: push to `main` only, after Stage 1 passes)

1. Log in to GHCR using `GITHUB_TOKEN` (no extra secrets needed)
2. Build all 4 Docker images using existing Dockerfiles:
   - `ghcr.io/${{ github.repository_owner }}/motor-shop-backend`
   - `ghcr.io/${{ github.repository_owner }}/motor-shop-mongodb`
   - `ghcr.io/${{ github.repository_owner }}/motor-shop-minio`
   - `ghcr.io/${{ github.repository_owner }}/motor-shop-frontend`
   (`github.repository_owner` resolves automatically — no manual placeholder needed)
3. Tag each image with both `latest` and the short Git SHA (e.g., `abc1234`)
4. Push all images to GHCR

### Stage 3 — Deploy (triggers: after Stage 2 passes, runs on self-hosted runner)

1. Apply namespace and ConfigMaps: `kubectl apply -f k8s/namespace.yaml -f k8s/configmap.yaml`
2. Create/update Secret for MinIO credentials from GitHub Actions secrets
3. Patch the image tag in each Deployment manifest using `sed` to replace a placeholder (e.g., `IMAGE_TAG`) with the actual Git SHA — manifests in the repo use the placeholder, the pipeline substitutes it at deploy time
4. Apply all manifests: `kubectl apply -f k8s/`
5. Wait for rollout: `kubectl rollout status deployment/<name> -n motor-shop`

---

## Kubernetes Manifests (`k8s/`)

**Cluster:** Single-node minikube  
**Namespace:** `motor-shop`

| File | Resource | Notes |
|------|----------|-------|
| `namespace.yaml` | Namespace | `motor-shop` |
| `configmap.yaml` | ConfigMap | `FLASK_APP`, `MONGODB_HOST`, `nginx.conf`, `mongo-init.sh` |
| `secret.yaml` | — | Never committed; created by CD workflow from GitHub Actions secrets |
| `backend-deployment.yaml` | Deployment + ClusterIP Service | 2 replicas, rolling update, liveness + readiness probes on `/api/products/` |
| `mongodb-deployment.yaml` | Deployment + ClusterIP Service + PVC | 1 replica, PVC for data durability |
| `minio-deployment.yaml` | Deployment + ClusterIP Service + PVC | 1 replica, PVC for object storage |
| `frontend-deployment.yaml` | Deployment + NodePort Service | 2 replicas, exposed on host port `30080`, `nginx.conf` from ConfigMap |

**Known simplification:** MongoDB and MinIO use `Deployment` instead of `StatefulSet`. This is acceptable for learning but not production — pod rescheduling can cause brief data unavailability.

---

## Repository Structure Changes

```
webapp_project/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Stage 1: lint + test + manifest validation
│       └── cd.yml              # Stage 2+3: build/push + deploy
│
├── k8s/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── backend-deployment.yaml
│   ├── mongodb-deployment.yaml
│   ├── minio-deployment.yaml
│   └── frontend-deployment.yaml
│
├── backend/
│   └── tests/
│       └── test_routes.py      # New: pytest suite with mongomock
│
└── (everything else unchanged)
```

`docker-compose.yml` is retained for local development without Kubernetes.

---

## Secrets Management

| Secret | Where stored | How used |
|--------|-------------|----------|
| `MINIO_ROOT_USER` | GitHub Actions secret | Injected into cluster as k8s Secret by CD workflow |
| `MINIO_ROOT_PASSWORD` | GitHub Actions secret | Injected into cluster as k8s Secret by CD workflow |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions | Used to push images to GHCR |

`secret.yaml` is added to `.gitignore`. The CD workflow creates the k8s Secret via:
```bash
kubectl create secret generic minio-credentials \
  --from-literal=MINIO_ROOT_USER=${{ secrets.MINIO_ROOT_USER }} \
  --from-literal=MINIO_ROOT_PASSWORD=${{ secrets.MINIO_ROOT_PASSWORD }} \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## Testing Strategy

**New file:** `backend/tests/test_routes.py`

Tests:
- `GET /api/products/` returns HTTP 200 and a JSON array
- `GET /api/products/<id>` returns expected fields: `name`, `price`, `category`, `description`, `image`
- `GET /api/products/<nonexistent-id>` returns HTTP 404

All tests use `mongomock` to mock MongoDB — no real database required in CI. Tests run with `uv run pytest`.

**Out of scope:** frontend JS tests, end-to-end tests, load tests.

---

## Error Handling & Rollback

**Pipeline failure behaviour:**
- CI failure → pipeline stops, cluster unchanged, PR blocked
- Build failure → deploy skipped, cluster runs previous image version
- Deploy failure → `kubectl rollout status` returns non-zero, workflow fails; Kubernetes does not replace healthy pods with failing ones (readiness probe guards this)

**Manual rollback:**
```bash
kubectl rollout undo deployment/backend -n motor-shop
```
Kubernetes retains the previous ReplicaSet, making rollback instant.

---

## Self-Hosted Runner Setup (summary)

The self-hosted runner must be installed on the local machine where minikube runs. It needs:
- `kubectl` configured with the minikube kubeconfig
- `minikube` running before the deploy stage executes
- Runner registered to the GitHub repo under Settings → Actions → Runners

Detailed setup steps are in the implementation plan.

---

## Known Limitations (Phase 1)

- Single-node minikube only — no multi-node scheduling
- No TLS/HTTPS
- No horizontal pod autoscaling
- No Ingress controller — frontend accessed via NodePort (`localhost:30080`)
- MongoDB/MinIO use Deployment not StatefulSet
- No monitoring or alerting

---

## Future Phases

| Phase | Work |
|-------|------|
| 2 | Add second minikube node; observe scheduler behaviour |
| 3 | Migrate to AWS EKS — swap kubeconfig, add node groups |
| 4 | Add Helm charts for templating and versioned releases |
| 5 | Layer in ArgoCD for GitOps |
| 6 | Add authentication service and Redis caching |
