#!/bin/bash
set -e

mongoimport \
  --username "${MONGO_INITDB_ROOT_USERNAME}" \
  --password "${MONGO_INITDB_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  --db my_web_app \
  --collection products \
  --file /docker-entrypoint-initdb.d/products.json \
  --jsonArray