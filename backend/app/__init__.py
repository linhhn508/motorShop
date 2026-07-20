from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_pymongo import PyMongo
import os

mongo = PyMongo()

def create_app():
    app = Flask(__name__)
    app.config["MONGO_URI"] = f"mongodb://{os.environ['MONGO_INITDB_ROOT_USERNAME']}:{os.environ['MONGO_INITDB_ROOT_PASSWORD']}@{os.environ['MONGODB_HOST']}/my_web_app?authSource=admin"
    
    #CORS enable here, enabling cross-origin requests for all routes and origins
    #CORS(app)

    # Initialize Flask extensions here
    mongo.init_app(app)

    # Register blueprints here

    from app.main import bp as main_bp
    app.register_blueprint(main_bp)

    from app.products import bp as products_bp
    app.register_blueprint(products_bp, url_prefix='/api/products')

    @app.route('/test/')
    def test_page():
        return '<h1>Testing the Flask Application Factory Pattern</h1>'

    @app.errorhandler(404)
    def not_found_error(error):
        if request.accept_mimetypes.best_match(['text/html', 'application/json']) == 'application/json':
            return jsonify({'error': 'Not found'}), 404
            
        return '<h1>404 Not Found</h1>', 404

    return app