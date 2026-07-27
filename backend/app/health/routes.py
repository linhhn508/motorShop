from flask import jsonify

from app.health import bp


@bp.route("", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy"}), 200
