FROM python:3.12-slim

ARG MONGODB_HOST

ENV FLASK_APP=app
ENV MONGODB_HOST=${MONGODB_HOST}

WORKDIR /web-service

RUN pip install uv

COPY pyproject.toml uv.lock ./

RUN uv sync

COPY app ./app

CMD ["uv", "run", "--", "flask", "run", "-h", "0.0.0.0", "-p", "5000"]