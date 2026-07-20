from app.products import bp
from flask import jsonify
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

@bp.route('/add/', methods=['POST'])
def add():
    return 'Here where you add a new product'

@bp.route('/update/', methods=['PUT'])
def update():
    return 'Here where you update a product'

@bp.route('/remove/', methods=['DELETE'])
def remove():
    return 'Here where you remove a product'