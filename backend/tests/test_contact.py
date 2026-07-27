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
