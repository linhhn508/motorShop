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
