FROM python:3.12-slim

ARG MONGODB_HOST

ENV FLASK_APP=app
ENV MONGODB_HOST=${MONGODB_HOST}

WORKDIR /web-service

RUN pip install uv

COPY backend/pyproject.toml backend/uv.lock ./

RUN uv sync

COPY backend/app ./app

CMD ["uv", "run", "--", "flask", "run", "-h", "0.0.0.0", "-p", "5000"]