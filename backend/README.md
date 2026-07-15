docker build -f image/mongodb/Dockerfile . -t custom_mongo
docker run -d -p 27017:27017 --name mongodb custom_mongo

docker build -f image/service/Dockerfile . -t backend
docker run -d -p 5000:5000 --name backend -e MONGODB_HOST=192.168.58.128:27017 backend


docker build . -t shop_web
docker run -p 8000:80 --name frontend -d frontend