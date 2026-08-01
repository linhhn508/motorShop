FROM python:3.12-slim

ENV FLASK_APP=app

ENV DEPLOY_PRODUCTION=false

WORKDIR /web-service

RUN pip install uv

COPY backend/pyproject.toml backend/uv.lock ./

RUN uv sync

COPY backend/app ./app

EXPOSE 5000

CMD ["uv", "run", "--", "gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:create_app()"]