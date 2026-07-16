FROM mongo:7.0

COPY ./products.json /docker-entrypoint-initdb.d/products.json
COPY ./mongo-init.sh /docker-entrypoint-initdb.d/mongo-init.sh