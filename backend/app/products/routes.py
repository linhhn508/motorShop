from app.products import bp
import os
from flask import jsonify
from pymongo import MongoClient

MONGODB_HOST = os.environ["MONGODB_HOST"]
client = MongoClient(MONGODB_HOST)
db = client["my_web_app"]
collection = db["products"]

@bp.route('/', methods=['GET'])
def index():
    productList = []
    productQuery = collection.find({}, {"_id": False})

    for product in productQuery:
        productList.append(product)
    
    return jsonify(productList)


@bp.route('/categories/', methods=['GET'])
def categories():
    categoryList = []
    categoryList = collection.distinct("category")
    return jsonify(categoryList)

@bp.route('/info/', methods=['GET'])
def info():
    return 'Here where you get the product info'

@bp.route('/add/', methods=['POST'])
def add():
    return 'Here where you add a new product'

@bp.route('/update/', methods=['PUT'])
def update():
    return 'Here where you update a product'

@bp.route('/remove/', methods=['DELETE'])
def remove():
    return 'Here where you remove a product'