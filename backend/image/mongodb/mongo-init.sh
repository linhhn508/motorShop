#!/bin/bash
set -e

mongoimport --db my_web_app --collection products --file /docker-entrypoint-initdb.d/products.json --jsonArray