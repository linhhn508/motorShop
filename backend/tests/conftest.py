import os
from unittest.mock import patch

import mongomock
import pytest

from app import create_app


@pytest.fixture
def mock_db():
    client = mongomock.MongoClient()
    db = client["my_web_app"]
    return db


@pytest.fixture
def app(mock_db):
    os.environ.setdefault("MONGO_ROOT_USERNAME", "test")
    os.environ.setdefault("MONGO_ROOT_PASSWORD", "test")
    os.environ.setdefault("MONGODB_HOST", "localhost")
    os.environ.setdefault("JWT_SECRET", "test-secret-key-at-least-32-bytes!!")
    os.environ.setdefault("ADMIN_USERNAME", "admin")
    os.environ.setdefault("ADMIN_PASSWORD", "admin123")

    with patch("flask_pymongo.PyMongo.init_app"):
        test_app = create_app()
    test_app.config["TESTING"] = True
    return test_app


@pytest.fixture
def client(app, mock_db):
    import app as app_module

    with patch.object(app_module.mongo, "db", mock_db):
        with app.test_client() as test_client:
            yield test_client


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
