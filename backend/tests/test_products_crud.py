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
            "overall": {"brand": "TestBrand", "made_in": "Vietnam", "material": "Steel", "color": "Red"},
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
    assert response.get_json()["message"] == "Product updated"


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
    assert response.get_json()["message"] == "Product removed"


def test_remove_product_not_found(client, seed_products):
    token = get_auth_token(client)
    response = client.delete(
        "/api/products/remove/",
        data=json.dumps({"id": "nonexistent"}),
        content_type="application/json",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404
