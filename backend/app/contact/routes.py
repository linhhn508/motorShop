import logging
import re

from flask import current_app, jsonify, request

from app.contact import bp

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


@bp.route("", methods=["POST"])
def submit_contact():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    required = ["name", "email", "message"]
    missing = [f for f in required if f not in data or not data[f].strip()]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    if not EMAIL_REGEX.match(data["email"]):
        return jsonify({"error": "Invalid email format"}), 400

    env = current_app.config.get("FLASK_ENV", "development")
    if env == "production":
        _send_ses_email(data)
    else:
        logger.info(
            "Contact form (dev mode - not sending email): name=%s email=%s message=%s",
            data["name"],
            data["email"],
            data["message"],
        )

    return jsonify({"message": "Message sent"}), 200


def _send_ses_email(data):
    import boto3

    ses = boto3.client("ses", region_name=current_app.config.get("AWS_REGION", "ap-southeast-1"))
    ses.send_email(
        Source=current_app.config["SES_SENDER_EMAIL"],
        Destination={"ToAddresses": [current_app.config["SES_RECIPIENT_EMAIL"]]},
        Message={
            "Subject": {"Data": f"Contact Form: {data['name']}"},
            "Body": {"Text": {"Data": f"Name: {data['name']}\nEmail: {data['email']}\n\nMessage:\n{data['message']}"}},
        },
    )
