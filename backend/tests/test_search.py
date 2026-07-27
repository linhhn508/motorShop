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
