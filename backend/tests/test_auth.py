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
