from app.health import bp
from flask import jsonify


@bp.route("", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy"}), 200
