FROM mongo:7.0

COPY ./image/mongodb/products.json /docker-entrypoint-initdb.d/products.json
COPY ./image/mongodb/mongo-init.sh /docker-entrypoint-initdb.d/mongo-init.sh