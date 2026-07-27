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
