import os

from flask import Flask, jsonify, request
from flask_pymongo import PyMongo

mongo = PyMongo()


def create_app():
    from app.logging_config import setup_logging

    setup_logging()

    app = Flask(__name__)

    # Support both Atlas (single MONGO_URI) and local Docker (individual vars)
    if os.environ.get("DEPLOY_PRODUCTION") == "true":
        app.config["MONGO_URI"] = f"mongodb+srv://{os.environ['MONGO_ROOT_USERNAME']}:{os.environ['MONGO_ROOT_PASSWORD']}@{os.environ['MONGODB_HOST']}/my_web_app?retryWrites=true&w=majority"
    else:
        app.config["MONGO_URI"] = (
            f"mongodb://{os.environ['MONGO_ROOT_USERNAME']}:{os.environ['MONGO_ROOT_PASSWORD']}@{os.environ['MONGODB_HOST']}/my_web_app?authSource=admin"
        )

    app.config["JWT_SECRET"] = os.environ["JWT_SECRET"]
    app.config["ADMIN_USERNAME"] = os.environ["ADMIN_USERNAME"]
    app.config["ADMIN_PASSWORD"] = os.environ["ADMIN_PASSWORD"]

    # CORS enable here, enabling cross-origin requests for all routes and origins
    # CORS(app)

    # Initialize Flask extensions here
    mongo.init_app(app)

    # Register blueprints here

    from app.main import bp as main_bp

    app.register_blueprint(main_bp)

    from app.products import bp as products_bp

    app.register_blueprint(products_bp, url_prefix="/api/products")

    from app.health import bp as health_bp

    app.register_blueprint(health_bp, url_prefix="/api/health")

    from app.auth import bp as auth_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    from app.contact import bp as contact_bp

    app.register_blueprint(contact_bp, url_prefix="/api/contact")

    from app.feedback import bp as feedback_bp

    app.register_blueprint(feedback_bp, url_prefix="/api/feedback")

    @app.route("/test/")
    def test_page():
        return "<h1>Testing the Flask Application Factory Pattern</h1>"

    @app.errorhandler(404)
    def not_found_error(error):
        if request.accept_mimetypes.best_match(["text/html", "application/json"]) == "application/json":
            return jsonify({"error": "Not found"}), 404

        return "<h1>404 Not Found</h1>", 404

    return app
