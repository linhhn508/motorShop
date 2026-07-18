FROM python:3.12-slim

ARG MONGODB_HOST

ENV FLASK_APP=app
ENV MONGODB_HOST=${MONGODB_HOST}

WORKDIR /web-service

RUN pip install uv

COPY backend/pyproject.toml backend/uv.lock ./

RUN uv sync

COPY backend/app ./app

CMD ["uv", "run", "--", "gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:create_app()"]