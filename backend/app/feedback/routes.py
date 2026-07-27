from flask import jsonify, request

from app import mongo
from app.feedback import bp


@bp.route("", methods=["POST"])
def submit_feedback():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    required = ["name", "rating", "comment"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    if not isinstance(data["rating"], int) or not (1 <= data["rating"] <= 5):
        return jsonify({"error": "Rating must be an integer between 1 and 5"}), 400

    mongo.db.feedback.insert_one({
        "name": data["name"],
        "rating": data["rating"],
        "comment": data["comment"],
    })

    return jsonify({"message": "Feedback submitted"}), 201
