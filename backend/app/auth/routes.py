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
