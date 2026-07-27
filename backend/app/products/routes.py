from app.products import bp
from flask import jsonify, request
from app import mongo


@bp.route('/', methods=['GET'])
def index():
    productList = []
    productQuery = mongo.db.products.find({}, {"_id": False})

    for product in productQuery:
        productList.append(product)

    return jsonify(productList)


@bp.route('/<product_id>/info', methods=['GET'])
def get_product(product_id):
    product = mongo.db.products.find_one({"id": product_id}, {"_id": False})
    if product:
        return jsonify(product)
    else:
        return jsonify({"error": "Product not found"}), 404


@bp.route('/categories/', methods=['GET'])
def categories():
    categoryList = mongo.db.products.distinct("category")
    return jsonify(categoryList)


@bp.route('/search', methods=['GET'])
def search():
    query = request.args.get('q')
    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400

    results = list(
        mongo.db.products.find(
            {"$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"category": {"$regex": query, "$options": "i"}},
            ]},
            {"_id": False},
        )
    )
    return jsonify(results)


@bp.route('/add/', methods=['POST'])
def add():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    required_fields = ["id", "name", "price", "category", "stock", "product"]
    missing = [f for f in required_fields if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    existing = mongo.db.products.find_one({"id": data["id"]})
    if existing:
        return jsonify({"error": "Product with this id already exists"}), 409

    mongo.db.products.insert_one(data)
    return jsonify({"message": "Product added", "id": data["id"]}), 201


@bp.route('/update/', methods=['PUT'])
def update():
    data = request.get_json()
    if not data or "id" not in data:
        return jsonify({"error": "Request body with 'id' is required"}), 400

    product_id = data.pop("id")
    if not data:
        return jsonify({"error": "No fields to update"}), 400

    result = mongo.db.products.update_one({"id": product_id}, {"$set": data})
    if result.matched_count == 0:
        return jsonify({"error": "Product not found"}), 404

    return jsonify({"message": "Product updated"}), 200


@bp.route('/remove/', methods=['DELETE'])
def remove():
    data = request.get_json()
    if not data or "id" not in data:
        return jsonify({"error": "Request body with 'id' is required"}), 400

    result = mongo.db.products.delete_one({"id": data["id"]})
    if result.deleted_count == 0:
        return jsonify({"error": "Product not found"}), 404

    return jsonify({"message": "Product removed"}), 200
